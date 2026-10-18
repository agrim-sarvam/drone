package com.sentinel.cop.dji;

import android.app.*;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import com.sentinel.cop.dji.telemetry.Destination;

/** Started explicitly from the visible Activity. Not sticky: process death requires user restart. */
public class BridgeService extends Service {
    private static final String CHANNEL = "bridge-telemetry";
    private boolean failed;
    private WifiManager.WifiLock wifiLock;
    @Override public void onCreate() {
        super.onCreate();
        // Wi-Fi power save batches outgoing frames once the screen is off, causing bursty, stale positions.
        WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
        if (wifi != null) {
            wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "sentinel:telemetry");
            wifiLock.setReferenceCounted(false);
            wifiLock.acquire();
        }
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Drone telemetry", NotificationManager.IMPORTANCE_LOW));
        }
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        PendingIntent stop = PendingIntent.getService(this, 1, new Intent(this, BridgeService.class).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder notification = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        startForeground(1, notification.setContentTitle("Sentinel telemetry bridge")
                .setContentText("Local UDP active. Open app for aircraft and send status.")
                .setSmallIcon(android.R.drawable.stat_sys_upload).setContentIntent(open).setOngoing(true)
                .addAction(android.R.drawable.ic_media_pause, "Stop UDP", stop).build());
    }
    @Override public int onStartCommand(Intent intent, int flags, int id) {
        BridgeController controller = ((BridgeApplication) getApplication()).controller();
        if (intent == null || "STOP".equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        try {
            controller.start(Destination.parse(intent.getStringExtra("host"), intent.getStringExtra("port")));
        } catch (Exception e) {
            controller.stop();
            failed = true;
            controller.udp = "START FAILED: " + e.getClass().getSimpleName();
            Diagnostics.record(controller.udp);
            stopSelf();
        }
        return START_NOT_STICKY;
    }
    @Override public void onDestroy() {
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        if (!failed) ((BridgeApplication) getApplication()).controller().stop();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent) { return null; }
}
