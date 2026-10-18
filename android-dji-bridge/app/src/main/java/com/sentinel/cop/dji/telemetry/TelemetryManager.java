package com.sentinel.cop.dji.telemetry;

public class TelemetryManager {
    private volatile int battery = -1;
    public void reset() { battery = -1; }
    public void updateBattery(int percentage) { battery = percentage >= 0 && percentage <= 100 ? percentage : -1; }
    public TelemetryData updateFlightState(FlightSnapshot state) {
        TelemetryData data = new TelemetryData();
        data.drone_id = "DJI_AIRCRAFT";
        data.timestamp = System.currentTimeMillis();
        data.relative_altitude_m = state.locationPresent ? state.takeoffHeight : Double.NaN;
        if (state.locationPresent) {
            data.lat = state.latitude;
            data.lon = state.longitude;
            data.position_valid = state.gpsSignalAvailable && validPosition(data.lat, data.lon, state.satellites);
        }
        data.yaw_deg = state.yaw;
        data.heading_deg = (state.yaw % 360 + 360) % 360;
        data.pitch_deg = state.pitch;
        data.roll_deg = state.roll;
        data.velocity_x_mps = state.velocityX;
        data.velocity_y_mps = state.velocityY;
        data.velocity_z_mps = state.velocityZ;
        data.speed_mps = Math.hypot(state.velocityX, state.velocityY);
        data.gps_satellites = state.satellites;
        data.flying = state.flying;
        data.flight_state = state.flightMode;
        data.battery = battery;
        return data;
    }
    public static boolean validPosition(double lat, double lon, int satellites) {
        // Availability check, not an accuracy guarantee. SDK signal quality is checked separately.
        return satellites >= 4 && Double.isFinite(lat) && Double.isFinite(lon)
                && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }
}
