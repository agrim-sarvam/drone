package com.sentinel.cop.dji;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.hardware.usb.UsbManager;
import android.view.TextureView;
import android.view.WindowManager;
import android.widget.*;
import com.sentinel.cop.dji.telemetry.*;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    private BridgeController controller;
    private TextView sdkText, aircraftText, udpText, telemetryText;
    private EditText ipInput, portInput;
    private Button startButton, testButton;
    private LiveVideo video;
    private final Runnable refresh = this::render;
    private static final int PERMISSIONS = 100, EXPORT = 101;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        controller = ((BridgeApplication) getApplication()).controller();
        sdkText = findViewById(R.id.dji_status);
        aircraftText = findViewById(R.id.aircraft_status);
        udpText = findViewById(R.id.udp_status);
        telemetryText = findViewById(R.id.telemetry_text);
        ipInput = findViewById(R.id.ip_input);
        portInput = findViewById(R.id.port_input);
        startButton = findViewById(R.id.start_button);
        testButton = findViewById(R.id.test_button);
        TextureView videoView = findViewById(R.id.video_view);
        video = new LiveVideo(this, findViewById(R.id.video_status));
        videoView.setSurfaceTextureListener(video);
        // The aircraft streams 16:9; size the preview to match the screen width.
        videoView.post(() -> {
            videoView.getLayoutParams().height = videoView.getWidth() * 9 / 16;
            videoView.requestLayout();
        });
        SharedPreferences settings = getSharedPreferences("bridge", MODE_PRIVATE);
        ipInput.setText(settings.getString("host", ""));
        portInput.setText(settings.getString("port", "14550"));
        startButton.setOnClickListener(v -> toggle());
        testButton.setOnClickListener(v -> test());
        findViewById(R.id.register_button).setOnClickListener(v -> requestSdkPermissions());
        findViewById(R.id.export_button).setOnClickListener(v -> {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("text/plain").putExtra(Intent.EXTRA_TITLE, "sentinel-diagnostics.txt");
            startActivityForResult(intent, EXPORT);
        });
        if (!BuildConfig.NETWORK_ONLY) requestSdkPermissions();
        handleUsbIntent(getIntent());
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleUsbIntent(intent);
    }
    private void handleUsbIntent(Intent intent) {
        if (intent != null && UsbManager.ACTION_USB_ACCESSORY_ATTACHED.equals(intent.getAction())) {
            controller.usbAttached();
            intent.setAction(null); // Activity recreation must not replay a past hardware arrival.
        }
    }
    @Override protected void onStart() { super.onStart(); controller.observe(refresh); }
    @Override protected void onStop() { controller.removeObserver(refresh); video.pause(); super.onStop(); }
    private Destination destination() {
        Destination target = Destination.parse(ipInput.getText().toString(), portInput.getText().toString());
        getSharedPreferences("bridge", MODE_PRIVATE).edit().putString("host", target.host)
                .putString("port", String.valueOf(target.port)).apply();
        return target;
    }
    private void toggle() {
        if (controller.exporter.isRunning()) { stopService(new Intent(this, BridgeService.class)); return; }
        try {
            Destination target = destination();
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 102);
            Intent intent = new Intent(this, BridgeService.class).putExtra("host", target.host).putExtra("port", String.valueOf(target.port));
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent); else startService(intent);
        } catch (Exception e) { message(e instanceof IllegalArgumentException ? e.getMessage() : "Cannot start telemetry service."); }
    }
    private void test() {
        try {
            Destination target = destination();
            testButton.setEnabled(false);
            controller.exporter.sendTestPacket(target, (ok, detail) -> runOnUiThread(() -> {
                testButton.setEnabled(true); message(detail);
                Diagnostics.record(ok ? "Network test sent (not acknowledged)" : "Network test send failed");
            }));
        } catch (IllegalArgumentException e) { message(e.getMessage()); }
    }
    private void message(String text) { Toast.makeText(this, text, Toast.LENGTH_LONG).show(); }
    private void render() {
        sdkText.setText("DJI SDK: " + controller.sdk);
        aircraftText.setText("Aircraft: " + controller.aircraft);
        video.update(controller.aircraft.startsWith("CONNECTED"));
        boolean running = controller.exporter.isRunning();
        udpText.setText("UDP: " + controller.udp + "\nEffective destination: " + controller.exporter.effectiveDestination()
                + "\nRoute: " + controller.exporter.route()
                + "\nPackets sent: " + controller.exporter.packetsSent.get() + " (not acknowledged)"
                + "\nSend errors: " + controller.exporter.sendErrors.get());
        startButton.setText(running ? "STOP UDP" : "START UDP");
        // Some OEM battery policies throttle background networking even with a foreground service.
        if (running) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        ipInput.setEnabled(!running); portInput.setEnabled(!running);
        TelemetryData sample = controller.latest;
        if (sample == null) telemetryText.setText("No aircraft samples. Network test works without a drone.");
        else telemetryText.setText(String.format(Locale.US,
                "Sample age: %d ms\nGPS: %s (%d satellites)\nLAT: %s\nLON: %s\nHeight above takeoff: %s m\nSpeed: %.1f m/s\nBattery: %s",
                Math.max(0, System.currentTimeMillis() - sample.timestamp), sample.position_valid ? "AVAILABLE" : "WAITING FOR FIX",
                sample.gps_satellites, sample.position_valid ? String.format(Locale.US, "%.6f", sample.lat) : "--",
                sample.position_valid ? String.format(Locale.US, "%.6f", sample.lon) : "--",
                Double.isFinite(sample.relative_altitude_m) ? String.format(Locale.US, "%.1f", sample.relative_altitude_m) : "--",
                sample.speed_mps, sample.battery < 0 ? "unknown" : sample.battery + "%"));
    }
    private String[] requiredPermissions() {
        ArrayList<String> list = new ArrayList<>();
        list.add(Manifest.permission.ACCESS_FINE_LOCATION);
        list.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        list.add(Manifest.permission.READ_PHONE_STATE);
        if (Build.VERSION.SDK_INT <= 28) { list.add(Manifest.permission.WRITE_EXTERNAL_STORAGE); list.add(Manifest.permission.READ_EXTERNAL_STORAGE); }
        return list.toArray(new String[0]);
    }
    private void requestSdkPermissions() {
        if (BuildConfig.NETWORK_ONLY) { message("DJI disabled in network-test build."); return; }
        ArrayList<String> missing = new ArrayList<>();
        for (String p : requiredPermissions()) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        if (missing.isEmpty()) controller.register();
        else requestPermissions(missing.toArray(new String[0]), PERMISSIONS);
    }
    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(code, permissions, results);
        if (code != PERMISSIONS) return;
        for (String p : requiredPermissions()) {
            if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) {
                controller.sdk = "PERMISSION REQUIRED (use Retry after granting in Settings)";
                Diagnostics.record("SDK permissions denied"); render(); return;
            }
        }
        controller.register();
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == EXPORT && result == RESULT_OK && data != null && data.getData() != null) {
            try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                if (out == null) throw new IllegalStateException();
                out.write(controller.diagnosticReport().getBytes(StandardCharsets.UTF_8));
                message("Report saved. Review it before sharing on GitHub.");
            } catch (Exception e) { message("Could not save diagnostic report."); }
        }
    }
}
