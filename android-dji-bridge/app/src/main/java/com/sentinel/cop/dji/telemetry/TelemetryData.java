package com.sentinel.cop.dji.telemetry;

public class TelemetryData {
    public String drone_id;
    public long timestamp;
    public double lat;
    public double lon;
    public boolean position_valid;
    public double altitude_m;
    public double relative_altitude_m;
    public double heading_deg;
    public double yaw_deg;
    public double pitch_deg;
    public double roll_deg;
    public double speed_mps;
    public double velocity_x_mps;
    public double velocity_y_mps;
    public double velocity_z_mps;
    public int gps_satellites;
    public boolean flying;
    public int battery;
    public String flight_state;

    public TelemetryData() {}
}
