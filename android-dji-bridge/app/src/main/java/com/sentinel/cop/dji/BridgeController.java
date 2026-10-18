package com.sentinel.cop.dji;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import com.sentinel.cop.dji.telemetry.*;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import dji.common.error.DJIError;
import dji.common.error.DJISDKError;
import dji.sdk.base.BaseComponent;
import dji.sdk.base.BaseProduct;
import dji.sdk.flightcontroller.FlightController;
import dji.sdk.battery.Battery;
import dji.sdk.products.Aircraft;
import dji.sdk.sdkmanager.DJISDKInitEvent;
import dji.sdk.sdkmanager.DJISDKManager;

/** Process-owned SDK state: Activity recreation must not own or close a live connection. */
public final class BridgeController {
    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final CopyOnWriteArraySet<Runnable> observers = new CopyOnWriteArraySet<>();
    public final TelemetryUdpExporter exporter = new TelemetryUdpExporter();
    private final TelemetryManager manager = new TelemetryManager();
    public volatile String sdk = BuildConfig.NETWORK_ONLY ? "NETWORK TEST ONLY (DJI disabled)" : "NOT REGISTERED";
    public volatile String aircraft = "DISCONNECTED";
    public volatile String udp = "STOPPED";
    public volatile TelemetryData latest;
    private volatile boolean registering;
    private boolean pendingUsbAttach;
    private volatile FlightController boundFlightController;
    private Battery boundBattery;
    private String lastSendState = "";
    private final Runnable retryAttach = this::attachCurrentProduct;
    private final Runnable refresh = new Runnable() {
        @Override public void run() { notifyObservers(); main.postDelayed(this, 1000); }
    };

    BridgeController(Context context) {
        this.context = context.getApplicationContext();
        exporter.setRoute(new LocalNetworkRoute(this.context));
        exporter.setObserver((success, detail) -> {
            String state = success ? "SENDING (not acknowledged)" : detail;
            udp = state;
            if (!state.equals(lastSendState)) { Diagnostics.record(state); lastSendState = state; }
        });
    }
    public void observe(Runnable observer) {
        boolean wasEmpty = observers.isEmpty(); observers.add(observer); observer.run();
        if (wasEmpty) main.post(refresh);
    }
    public void removeObserver(Runnable observer) {
        observers.remove(observer);
        if (observers.isEmpty()) main.removeCallbacks(refresh);
    }
    private void notifyObservers() { for (Runnable observer : observers) observer.run(); }

    public void register() {
        if (BuildConfig.NETWORK_ONLY || registering || sdk.equals("REGISTERED")) return;
        registering = true;
        sdk = "REGISTERING (initial registration needs Internet)";
        Diagnostics.record("SDK registration requested");
        notifyObservers();
        // V4 registration can perform I/O; do not block the UI thread.
        java.util.concurrent.ExecutorService registrationWorker = Executors.newSingleThreadExecutor();
        registrationWorker.execute(() -> {
            try {
                DJISDKManager.getInstance().registerApp(context, new DJISDKManager.SDKManagerCallback() {
                    @Override public void onRegister(DJIError error) {
                        main.post(() -> {
                            registering = false;
                            boolean ok = error == DJISDKError.REGISTRATION_SUCCESS;
                            // DJI documents error names/descriptions, not numeric codes (e.g. "bundle not match" = package/key mismatch).
                            sdk = ok ? "REGISTERED" : "REGISTRATION FAILED: " + (error == null ? "unknown"
                                    : error.getDescription() + " (code " + error.getErrorCode() + ")")
                                    + " - check key, package, permissions and Internet";
                            Diagnostics.record("SDK registration " + (ok ? "success" : sdk));
                            if (ok) {
                                DJISDKManager.getInstance().startConnectionToProduct();
                                forwardUsbAttach();
                                attachCurrentProduct();
                            }
                            notifyObservers();
                        });
                    }
                    @Override public void onProductDisconnect() {
                        main.post(() -> {
                            detach(); latest = null; manager.reset(); aircraft = "DISCONNECTED";
                            Diagnostics.record("Aircraft disconnected"); notifyObservers();
                        });
                    }
                    @Override public void onProductConnect(BaseProduct product) { main.post(BridgeController.this::attachCurrentProduct); }
                    @Override public void onProductChanged(BaseProduct product) { main.post(BridgeController.this::attachCurrentProduct); }
                    @Override public void onComponentChange(BaseProduct.ComponentKey key, BaseComponent old, BaseComponent next) {
                        if (next != null) next.setComponentListener(connected -> main.post(BridgeController.this::attachCurrentProduct));
                        main.post(BridgeController.this::attachCurrentProduct);
                    }
                    @Override public void onInitProcess(DJISDKInitEvent event, int progress) { }
                    @Override public void onDatabaseDownloadProgress(long current, long total) { }
                });
            } catch (Throwable e) {
                main.post(() -> {
                    registering = false;
                    sdk = "SDK startup failed: " + e.getClass().getSimpleName();
                    Diagnostics.record(sdk); notifyObservers();
                });
            } finally { registrationWorker.shutdown(); }
        });
    }
    public void usbAttached() {
        if (BuildConfig.NETWORK_ONLY) return;
        pendingUsbAttach = true;
        Diagnostics.record("USB accessory attachment received");
        forwardUsbAttach();
    }
    private void forwardUsbAttach() {
        if (pendingUsbAttach && sdk.equals("REGISTERED")) {
            // DJI's V4 AOA connection code listens for this SDK action, not the Android action.
            context.sendBroadcast(new Intent(DJISDKManager.USB_ACCESSORY_ATTACHED).setPackage(context.getPackageName()));
            pendingUsbAttach = false;
            Diagnostics.record("USB attachment forwarded to SDK");
        }
    }
    private void attachCurrentProduct() {
        main.removeCallbacks(retryAttach);
        BaseProduct product = DJISDKManager.getInstance().getProduct();
        if (!(product instanceof Aircraft) || !product.isConnected()) {
            detach(); latest = null; manager.reset(); aircraft = "DISCONNECTED"; notifyObservers(); return;
        }
        Aircraft current = (Aircraft) product;
        FlightController flight = current.getFlightController();
        Battery battery = current.getBattery();
        if (boundFlightController != flight || boundBattery != battery) {
            detach();
            boundFlightController = flight;
            boundBattery = battery;
            if (battery != null) battery.setStateCallback(state -> manager.updateBattery(state.getChargeRemainingInPercent()));
            if (flight != null) flight.setStateCallback(state -> {
                // Ignore callbacks from a component that has since been detached.
                if (boundFlightController != flight) return;
                FlightSnapshot snapshot = new FlightSnapshot();
                if (state.getAircraftLocation() != null) {
                    snapshot.locationPresent = true;
                    snapshot.latitude = state.getAircraftLocation().getLatitude();
                    snapshot.longitude = state.getAircraftLocation().getLongitude();
                    snapshot.takeoffHeight = state.getAircraftLocation().getAltitude();
                }
                if (state.getAttitude() != null) {
                    snapshot.yaw = state.getAttitude().yaw;
                    snapshot.pitch = state.getAttitude().pitch;
                    snapshot.roll = state.getAttitude().roll;
                }
                snapshot.satellites = state.getSatelliteCount();
                snapshot.gpsSignalAvailable = state.getGPSSignalLevel() != null
                        && state.getGPSSignalLevel() != dji.common.flightcontroller.GPSSignalLevel.NONE
                        && state.getGPSSignalLevel().value() >= 2;
                snapshot.velocityX = state.getVelocityX(); snapshot.velocityY = state.getVelocityY(); snapshot.velocityZ = state.getVelocityZ();
                snapshot.flying = state.isFlying();
                snapshot.flightMode = state.getFlightMode() == null ? null : state.getFlightMode().name();
                publish(snapshot);
            });
            Diagnostics.record("Aircraft components attached");
        }
        aircraft = flight == null ? "CONNECTED, waiting for flight controller" : "CONNECTED";
        // Retry component readiness, not SDK registration. Never start UDP automatically.
        if (flight == null || battery == null) main.postDelayed(retryAttach, 1000);
        notifyObservers();
    }
    /** Single path from an SDK-independent snapshot to the wire; instrumentation tests drive it without DJI hardware. */
    void publish(FlightSnapshot snapshot) {
        TelemetryData sample = manager.updateFlightState(snapshot);
        latest = sample;
        exporter.sendTelemetry(sample);
    }
    private void detach() {
        main.removeCallbacks(retryAttach);
        if (boundFlightController != null) boundFlightController.setStateCallback(null);
        if (boundBattery != null) boundBattery.setStateCallback(null);
        boundFlightController = null; boundBattery = null;
    }
    public void start(Destination target) throws Exception {
        exporter.start(target);
        udp = "STARTED, waiting for aircraft samples";
        lastSendState = "";
        Diagnostics.record("UDP started via " + exporter.route()); notifyObservers();
    }
    public void stop() {
        exporter.stop(); udp = "STOPPED";
        Diagnostics.record("UDP stopped"); notifyObservers();
    }
    public String diagnosticReport() {
        return Diagnostics.report("SDK: " + sdk + "\nAircraft: " + aircraft + "\nUDP: " + udp + "\nRoute: " + exporter.route()
                + "\nPackets sent: " + exporter.packetsSent.get() + "\nSend errors: " + exporter.sendErrors.get()
                + "\nSample age ms: " + (latest == null ? "none" : Math.max(0, System.currentTimeMillis() - latest.timestamp)));
    }
}
