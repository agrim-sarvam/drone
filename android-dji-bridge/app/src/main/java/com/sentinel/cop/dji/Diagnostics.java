package com.sentinel.cop.dji;

import android.content.Context;
import android.os.Build;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStreamReader;
import java.util.ArrayDeque;

/** Bounded, local operational events. Never record telemetry, keys or destination addresses. */
public final class Diagnostics {
    private static final ArrayDeque<String> events = new ArrayDeque<>();
    private static File file;
    private Diagnostics() { }

    public static synchronized void initialize(Context context) {
        file = new File(context.getFilesDir(), "bridge-diagnostics.txt");
        if (file.isFile() && file.length() < 65536) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    events.addLast(line);
                    while (events.size() > 150) events.removeFirst();
                }
            } catch (Exception ignored) { /* A corrupt prior report must not block startup. */ }
        }
    }

    public static synchronized void record(String event) {
        events.addLast(System.currentTimeMillis() + " " + event);
        while (events.size() > 150) events.removeFirst();
        if (file != null) {
            try (FileOutputStream out = new FileOutputStream(file)) {
                out.write(String.join("\n", events).getBytes(StandardCharsets.UTF_8));
            } catch (Exception ignored) { /* Export still works from the bounded in-memory report. */ }
        }
    }

    public static synchronized String report(String state) {
        return "Sentinel Bridge " + BuildConfig.VERSION_NAME + "\nRevision: " + BuildConfig.SOURCE_REVISION
                + "\nAndroid API: " + Build.VERSION.SDK_INT + "\nDevice: " + Build.MANUFACTURER + " " + Build.MODEL
                + "\nNetwork test build: " + BuildConfig.NETWORK_ONLY + "\n" + state
                + "\nNo GPS coordinates, destination IP, DJI key or raw packets included.\nEvents:\n"
                + String.join("\n", events) + "\n";
    }

    public static void recordError(Throwable error) {
        StringBuilder trace = new StringBuilder("Failure: ").append(error.getClass().getName());
        StackTraceElement[] frames = error.getStackTrace();
        for (int i = 0; i < Math.min(8, frames.length); i++) trace.append("\n  at ").append(frames[i]);
        if (error.getCause() != null) trace.append("\nCaused by: ").append(error.getCause().getClass().getName());
        record(trace.toString());
    }
}
