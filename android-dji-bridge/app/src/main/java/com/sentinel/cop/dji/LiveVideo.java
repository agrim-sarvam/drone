package com.sentinel.cop.dji;

import android.content.Context;
import android.graphics.SurfaceTexture;
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
    private final Context context;
    private final TextView status;
    private SurfaceTexture surface;
    private int width, height;
    private volatile DJICodecManager codec;
    private VideoFeeder.VideoFeed feed;
    // Arrives on a DJI background thread.
    private final VideoFeeder.VideoDataListener listener = (data, size) -> {
        DJICodecManager decoder = codec;
        if (decoder != null) decoder.sendDataToDecoder(data, size);
    };

    LiveVideo(Context context, TextView status) {
        this.context = context;
        this.status = status;
    }

    /** Called from the Activity's render loop on the main thread. */
    void update(boolean aircraftConnected) {
        if (BuildConfig.NETWORK_ONLY) { status.setText("Camera: disabled in network-test build"); return; }
        if (!aircraftConnected) {
            release();
            status.setText("Camera: connect the aircraft to see live video");
            return;
        }
        if (codec == null && surface != null) codec = new DJICodecManager(context, surface, width, height);
        if (feed == null) {
            feed = VideoFeeder.getInstance().getPrimaryVideoFeed();
            if (feed != null) feed.addVideoDataListener(listener);
        }
        DJICodecManager decoder = codec;
        status.setText(decoder != null && decoder.hasVideoData() ? "Camera: LIVE" : "Camera: waiting for video from aircraft");
    }

    /** Activity no longer visible: stop feeding the decoder; update() resumes it. */
    void pause() {
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
