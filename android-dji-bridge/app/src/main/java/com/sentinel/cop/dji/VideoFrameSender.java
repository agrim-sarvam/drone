package com.sentinel.cop.dji;

import android.graphics.Bitmap;
import com.sentinel.cop.dji.telemetry.Destination;
import com.sentinel.cop.dji.telemetry.TelemetryUdpExporter;
import java.io.ByteArrayOutputStream;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Sends the live view to the laptop as one JPEG per UDP datagram on the telemetry port + 1.
 *
 * Frames come from the already-decoded preview, so this works whatever codec the aircraft streams.
 * Each frame stands alone: a lost datagram costs one frame and never corrupts the next. Frames that
 * cannot be compressed under one datagram are dropped. The original laptop app never listens on
 * this port, so it is unaffected.
 */
public final class VideoFrameSender {
    public static final int WIDTH = 640, HEIGHT = 360;
    static final int MAX_DATAGRAM = 60_000;
    private static final int[] QUALITIES = {60, 45, 30};
    private final TelemetryUdpExporter.Route route;
    private ThreadPoolExecutor worker;
    private DatagramSocket socket;
    private Destination target;
    private volatile boolean running;
    public final AtomicLong framesSent = new AtomicLong();
    public final AtomicLong framesTooLarge = new AtomicLong();
    public final AtomicLong sendErrors = new AtomicLong();

    VideoFrameSender(TelemetryUdpExporter.Route route) { this.route = route; }

    public synchronized void start(Destination telemetry) throws Exception {
        stop();
        target = Destination.parse(telemetry.host, String.valueOf(telemetry.port + 1));
        socket = new DatagramSocket();
        try { route.bind(socket, InetAddress.getByName(target.host)); } catch (Exception ignored) { /* default route still works */ }
        framesSent.set(0); framesTooLarge.set(0); sendErrors.set(0);
        // Queue of one, newest wins: a slow network shows a lower frame rate, never growing delay.
        worker = new ThreadPoolExecutor(1, 1, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(1),
                new ThreadPoolExecutor.DiscardOldestPolicy());
        running = true;
    }
    public synchronized void stop() {
        running = false;
        if (worker != null) worker.shutdownNow();
        if (socket != null) socket.close();
        worker = null; socket = null;
    }
    public boolean isRunning() { return running; }
    public int port() { Destination current = target; return current == null ? 0 : current.port; }

    /** Takes ownership of the bitmap and recycles it. */
    public synchronized void offer(Bitmap frame) {
        if (!running) { frame.recycle(); return; }
        final DatagramSocket activeSocket = socket;
        final Destination destination = target;
        worker.execute(() -> {
            try {
                byte[] jpeg = null;
                for (int quality : QUALITIES) {
                    ByteArrayOutputStream out = new ByteArrayOutputStream(MAX_DATAGRAM);
                    frame.compress(Bitmap.CompressFormat.JPEG, quality, out);
                    if (out.size() <= MAX_DATAGRAM) { jpeg = out.toByteArray(); break; }
                }
                if (jpeg == null) { framesTooLarge.incrementAndGet(); return; }
                activeSocket.send(new DatagramPacket(jpeg, jpeg.length, InetAddress.getByName(destination.host), destination.port));
                framesSent.incrementAndGet();
            } catch (Exception e) {
                if (running) sendErrors.incrementAndGet();
            } finally { frame.recycle(); }
        });
    }
}
