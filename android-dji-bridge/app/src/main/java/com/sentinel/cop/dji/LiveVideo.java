package com.sentinel.cop.dji;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.SurfaceTexture;
import android.os.Handler;
import android.os.Looper;
import android.view.TextureView;
import android.widget.TextView;
import dji.sdk.camera.VideoFeeder;
import dji.sdk.codec.DJICodecManager;

/**
 * Aircraft camera on the phone. While the bridge owns the RC's USB link DJI Fly cannot connect,
 * so without this the pilot has no camera view at all. Video stays on the phone; only telemetry
 * goes to the laptop.
 *
 * The decoder is created only once both a surface and a connected aircraft exist, so the SDK is
 * never touched before registration or in the network-test build.
 */
final class LiveVideo implements TextureView.SurfaceTextureListener {
    private static final long FRAME_INTERVAL_MS = 100;
    private final Context context;
    private final TextureView view;
    private final TextView status;
    private final VideoFrameSender sender;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean capturing;
    // Copies the on-screen live view for the laptop at ~10 fps while UDP is started.
    private final Runnable capture = new Runnable() {
        @Override public void run() {
            if (!capturing) return;
            if (sender.isRunning()) {
                Bitmap frame = view.getBitmap(VideoFrameSender.WIDTH, VideoFrameSender.HEIGHT);
                if (frame != null) sender.offer(frame);
            }
            main.postDelayed(this, FRAME_INTERVAL_MS);
        }
    };
    private SurfaceTexture surface;
    private int width, height;
    private volatile DJICodecManager codec;
    private VideoFeeder.VideoFeed feed;
    // Arrives on a DJI background thread.
    private final VideoFeeder.VideoDataListener listener = (data, size) -> {
        DJICodecManager decoder = codec;
        if (decoder != null) decoder.sendDataToDecoder(data, size);
    };

    LiveVideo(Context context, TextureView view, TextView status, VideoFrameSender sender) {
        this.context = context;
        this.view = view;
        this.status = status;
        this.sender = sender;
    }
    private void capture(boolean on) {
        if (on == capturing) return;
        capturing = on;
        main.removeCallbacks(capture);
        if (on) main.post(capture);
    }

    /** Called from the Activity's render loop on the main thread. */
    void update(boolean aircraftConnected) {
        if (BuildConfig.NETWORK_ONLY) { show("Camera: disabled in network-test build"); return; }
        if (!aircraftConnected) {
            release();
            show("Camera: connect the aircraft to see live video");
            return;
        }
        if (codec == null && surface != null) codec = new DJICodecManager(context, surface, width, height);
        if (feed == null) {
            feed = VideoFeeder.getInstance().getPrimaryVideoFeed();
            if (feed != null) feed.addVideoDataListener(listener);
        }
        DJICodecManager decoder = codec;
        boolean live = decoder != null && decoder.hasVideoData();
        capture(live);
        show(!live ? "Camera: waiting for video from aircraft"
                : sender.isRunning() ? "Camera: LIVE (also sent to laptop, " + sender.framesSent.get() + " frames)"
                : "Camera: LIVE (press START UDP to send it to the laptop too)");
    }

    private String shown = "", recorded = "";
    /**
     * Camera transitions go into the diagnostic report; video failures are otherwise invisible remotely.
     * Only the state before any "(detail)" is recorded, so the live frame counter does not flood the log.
     */
    private void show(String text) {
        if (text.equals(shown)) return;
        shown = text; status.setText(text);
        int detail = text.indexOf(" (");
        String state = detail < 0 ? text : text.substring(0, detail);
        if (!state.equals(recorded)) { recorded = state; Diagnostics.record(state); }
    }

    /** Activity no longer visible: stop feeding the decoder; update() resumes it. */
    void pause() {
        capture(false);
        if (feed != null) feed.removeVideoDataListener(listener);
        feed = null;
    }

    private void release() {
        pause();
        DJICodecManager decoder = codec;
        codec = null;
        if (decoder != null) { decoder.cleanSurface(); decoder.destroyCodec(); }
    }

    @Override public void onSurfaceTextureAvailable(SurfaceTexture texture, int w, int h) {
        surface = texture; width = w; height = h;
    }
    @Override public void onSurfaceTextureSizeChanged(SurfaceTexture texture, int w, int h) {
        width = w; height = h;
        DJICodecManager decoder = codec;
        if (decoder != null) decoder.onSurfaceSizeChanged(w, h, 0);
    }
    @Override public boolean onSurfaceTextureDestroyed(SurfaceTexture texture) {
        release();
        surface = null;
        return true;
    }
    @Override public void onSurfaceTextureUpdated(SurfaceTexture texture) { }
}
