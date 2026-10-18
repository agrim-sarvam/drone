package com.sentinel.cop.dji;

import android.app.Application;
import android.content.Context;
// MSDK 4.18 renamed the loader (was com.secneo.sdk.Helper); the old name no longer starts the SDK.
import com.cySdkyc.clx.Helper;

public class BridgeApplication extends Application {
    private BridgeController controller;

    @Override protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        Diagnostics.initialize(this);
        Diagnostics.record("SDK loader starting");
        try { Helper.install(this); }
        catch (Throwable error) { Diagnostics.recordError(error); throw error; }
        Diagnostics.record("SDK loader ready");
    }

    @Override public void onCreate() {
        super.onCreate();
        Diagnostics.record("App started " + BuildConfig.VERSION_NAME + " revision=" + BuildConfig.SOURCE_REVISION);
        Thread.UncaughtExceptionHandler previous = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, error) -> {
            // Do not capture exception messages, SDK keys, coordinates, or arbitrary payloads.
            Diagnostics.recordError(error);
            if (previous != null) previous.uncaughtException(thread, error);
        });
        controller = new BridgeController(this);
    }

    public BridgeController controller() { return controller; }
}
