package com.sentinel.cop.dji.telemetry;

/** SDK-independent snapshot. DJI callbacks populate it; conversion and wire rules can run on a JVM. */
public final class FlightSnapshot {
    public boolean locationPresent;
    public double latitude, longitude, takeoffHeight = Double.NaN;
    public double yaw = Double.NaN, pitch = Double.NaN, roll = Double.NaN;
    public double velocityX, velocityY, velocityZ;
    public int satellites;
    public boolean gpsSignalAvailable;
    public boolean flying;
    public String flightMode;
}
