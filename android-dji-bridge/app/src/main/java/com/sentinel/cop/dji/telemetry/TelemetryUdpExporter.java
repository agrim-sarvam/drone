package com.sentinel.cop.dji.telemetry;

import org.json.JSONObject;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

public class TelemetryUdpExporter {
    public interface Result { void complete(boolean success, String detail); }
    /** Chooses the network a socket uses. Returns a description safe for diagnostics (no addresses). */
    public interface Route { String bind(DatagramSocket socket, InetAddress destination) throws IOException; }
    // DJI flight-controller state arrives at ~10 Hz with jitter; a 100 ms floor silently dropped about half of it.
    static final long MIN_SEND_INTERVAL_NANOS = 50_000_000L;
    private static final long REBIND_INTERVAL_NANOS = 1_000_000_000L;
    private ThreadPoolExecutor worker;
    private DatagramSocket socket;
    private Destination destination;
    private volatile boolean running;
    private long lastSendNanos;
    private long lastRebindNanos;
    private long sequence;
    private String session;
    private volatile Route route = (socket, destination) -> "system default";
    private volatile String routeDescription = "Not started";
    public final AtomicLong packetsSent = new AtomicLong();
    public final AtomicLong sendErrors = new AtomicLong();
    private Result observer = (success, detail) -> { };

    public synchronized void setObserver(Result observer) { this.observer = observer; }
    public void setRoute(Route route) { this.route = route; }
    public String route() { return routeDescription; }

    public synchronized void start(Destination destination) throws Exception {
        stop();
        this.destination = destination;
        socket = open(destination);
        session = UUID.randomUUID().toString();
        sequence = 0;
        lastSendNanos = 0;
        lastRebindNanos = System.nanoTime();
        packetsSent.set(0);
        sendErrors.set(0);
        worker = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(1), new ThreadPoolExecutor.DiscardOldestPolicy());
        running = true;
    }
    public synchronized void stop() {
        running = false;
        if (socket != null) socket.close();
        if (worker != null) worker.shutdownNow();
        socket = null;
        worker = null;
    }
    public boolean isRunning() { return running; }
    public synchronized String effectiveDestination() {
        return destination == null ? "Not configured" : destination.host + ":" + destination.port;
    }
    private DatagramSocket open(Destination target) throws IOException {
        DatagramSocket opened = new DatagramSocket();
        routeDescription = bindRoute(opened, target);
        return opened;
    }
    private String bindRoute(DatagramSocket opened, Destination target) {
        try { return route.bind(opened, InetAddress.getByName(target.host)); }
        catch (IOException | RuntimeException e) {
            // An unbound socket still works on a phone hotspot or when Wi-Fi is the default network.
            return "system default (network bind failed: " + e.getClass().getSimpleName() + ")";
        }
    }
    public synchronized void sendTelemetry(TelemetryData data) {
        if (!running) return;
        long now = System.nanoTime();
        if (lastSendNanos != 0 && now - lastSendNanos < MIN_SEND_INTERVAL_NANOS) return;
        lastSendNanos = now;
        final DatagramSocket activeSocket = socket;
        final Destination target = destination;
        final Result callback = observer;
        final String activeSession = session;
        final long next = sequence++;
        worker.execute(() -> {
            try {
                byte[] payload = encode(data, activeSession, next, false);
                activeSocket.send(new DatagramPacket(payload, payload.length, InetAddress.getByName(target.host), target.port));
                synchronized (TelemetryUdpExporter.this) {
                    if (activeSocket != socket) return;
                    packetsSent.incrementAndGet();
                    callback.complete(true, "UDP sent (delivery not acknowledged)");
                }
            } catch (Exception e) {
                synchronized (TelemetryUdpExporter.this) {
                    if (activeSocket == socket && !activeSocket.isClosed()) {
                        sendErrors.incrementAndGet();
                        callback.complete(false, "UDP send failed: " + e.getClass().getSimpleName());
                        rebindAfterFailure();
                    }
                }
            }
        });
    }
    /** A socket bound to a Wi-Fi network that has since dropped keeps failing; reopen it on the current route. */
    private void rebindAfterFailure() {
        long now = System.nanoTime();
        if (!running || now - lastRebindNanos < REBIND_INTERVAL_NANOS) return;
        lastRebindNanos = now;
        try {
            DatagramSocket replacement = open(destination);
            socket.close();
            socket = replacement;
        } catch (IOException e) {
            routeDescription = "reopen failed: " + e.getClass().getSimpleName();
        }
    }
    /** One-shot network test works with real telemetry stopped; it never changes the live destination. */
    public void sendTestPacket(Destination target, Result callback) {
        new Thread(() -> {
            try (DatagramSocket testSocket = new DatagramSocket()) {
                String via = bindRoute(testSocket, target);
                TelemetryData data = new TelemetryData();
                data.drone_id = "SYNTHETIC_NETWORK_TEST";
                data.timestamp = System.currentTimeMillis();
                data.lat = 28.6139;
                data.lon = 77.2090;
                data.position_valid = true;
                data.relative_altitude_m = 0;
                data.battery = -1;
                byte[] payload = encode(data, UUID.randomUUID().toString(), 0, true);
                testSocket.send(new DatagramPacket(payload, payload.length, InetAddress.getByName(target.host), target.port));
                callback.complete(true, "TEST sent via " + via + "; confirm SYNTHETIC_NETWORK_TEST on laptop");
            } catch (Exception e) {
                callback.complete(false, "TEST failed: " + e.getClass().getSimpleName());
            }
        }, "bridge-network-test").start();
    }
    static byte[] encode(TelemetryData d, String session, long sequence, boolean test) throws Exception {
        JSONObject json = new JSONObject();
        json.put("schema_version", 2);
        json.put("drone_id", d.drone_id);
        json.put("timestamp", d.timestamp);
        json.put("session_id", session);
        json.put("sequence", sequence);
        json.put("synthetic", test);
        json.put("position_valid", d.position_valid);
        json.put("latitude", d.position_valid ? d.lat : JSONObject.NULL);
        json.put("longitude", d.position_valid ? d.lon : JSONObject.NULL);
        // DJI V4 aircraft altitude is relative to takeoff, not MSL.
        json.put("altitude_m", JSONObject.NULL);
        json.put("altitude_reference", "takeoff");
        putFinite(json, "relative_altitude_m", d.relative_altitude_m);
        putFinite(json, "heading_deg", d.heading_deg);
        putFinite(json, "yaw_deg", d.yaw_deg);
        putFinite(json, "pitch_deg", d.pitch_deg);
        putFinite(json, "roll_deg", d.roll_deg);
        putFinite(json, "speed_mps", d.speed_mps);
        putFinite(json, "velocity_x_mps", d.velocity_x_mps);
        putFinite(json, "velocity_y_mps", d.velocity_y_mps);
        putFinite(json, "velocity_z_mps", d.velocity_z_mps);
        json.put("gps_satellites", d.gps_satellites);
        json.put("flying", d.flying);
        json.put("flight_state", d.flight_state == null ? JSONObject.NULL : d.flight_state);
        json.put("battery_percent", d.battery < 0 ? JSONObject.NULL : d.battery);
        return json.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static void putFinite(JSONObject json, String key, double value) throws Exception {
        json.put(key, Double.isFinite(value) ? value : JSONObject.NULL);
    }
}
