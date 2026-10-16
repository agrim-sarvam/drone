package com.sentinel.cop.dji.telemetry;

import android.util.Log;

import dji.common.flightcontroller.FlightControllerState;
import dji.common.battery.BatteryState;

public class TelemetryManager {
    private static final String TAG = "TELEMETRY_MGR";
    
    private final TelemetryUdpExporter exporter;
    private int currentBattery = -1;
    private Double referenceAltitude = null;
    
    public TelemetryManager(TelemetryUdpExporter exporter) {
        this.exporter = exporter;
    }
    
    public void resetReferenceAltitude() {
        this.referenceAltitude = null;
    }
    
    public void updateBattery(BatteryState state) {
        if (state != null) {
            this.currentBattery = state.getChargeRemainingInPercent();
        }
    }
    
    public TelemetryData updateFlightState(FlightControllerState state) {
        if (state == null) return null;
        
        TelemetryData data = new TelemetryData();
        data.drone_id = "AIR2S_01";
        data.timestamp = System.currentTimeMillis();
        
        if (state.getAircraftLocation() != null) {
            data.lat = state.getAircraftLocation().getLatitude();
            data.lon = state.getAircraftLocation().getLongitude();
            data.altitude_m = state.getAircraftLocation().getAltitude();
            
            // Fix: Calculate relative altitude properly
            if (referenceAltitude == null && state.isFlying()) {
                referenceAltitude = data.altitude_m;
            } else if (!state.isFlying()) {
                referenceAltitude = null; // Reset when landed
                data.relative_altitude_m = 0.0;
            }
            
            if (referenceAltitude != null) {
                data.relative_altitude_m = data.altitude_m - referenceAltitude;
            } else {
                data.relative_altitude_m = 0.0;
            }
        }
        
        if (state.getAttitude() != null) {
            data.heading_deg = state.getAttitude().yaw;
            data.yaw_deg = state.getAttitude().yaw;
            data.pitch_deg = state.getAttitude().pitch;
            data.roll_deg = state.getAttitude().roll;
        }
        
        data.velocity_x_mps = state.getVelocityX();
        data.velocity_y_mps = state.getVelocityY();
        data.velocity_z_mps = state.getVelocityZ();
        
        data.speed_mps = Math.sqrt(
            Math.pow(data.velocity_x_mps, 2) + 
            Math.pow(data.velocity_y_mps, 2)
        );
        
        data.gps_satellites = state.getSatelliteCount();
        data.flying = state.isFlying();
        data.flight_state = state.getFlightMode().name();
        data.battery = currentBattery;
        
        // Log periodically
        if (exporter.packetsSent.get() % 10 == 0) {
            Log.i(TAG, "[TELEMETRY] lat=" + data.lat + " lon=" + data.lon + " alt=" + data.altitude_m + " heading=" + data.heading_deg);
        }
        
        exporter.sendTelemetry(data);
        return data;
    }
}
