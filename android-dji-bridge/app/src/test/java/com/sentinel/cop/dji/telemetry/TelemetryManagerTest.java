package com.sentinel.cop.dji.telemetry;

import org.junit.Test;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;


import static org.junit.Assert.*;


public class TelemetryManagerTest {
    @Test public void joiningMidFlightDoesNotRebaseTakeoffHeight() {
        FlightSnapshot state=new FlightSnapshot();
        state.locationPresent=true; state.latitude=28.6139; state.longitude=77.209; state.takeoffHeight=40; state.gpsSignalAvailable=true;
        state.satellites=12;
        state.flying=true;
        TelemetryData sample=new TelemetryManager().updateFlightState(state);
        assertEquals(40,sample.relative_altitude_m,0);
        assertTrue(sample.position_valid);
    }
    @Test public void absentLocationDoesNotBecomeNullIsland() {
        FlightSnapshot state=new FlightSnapshot();
        TelemetryData sample=new TelemetryManager().updateFlightState(state);
        assertFalse(sample.position_valid);
        assertTrue(Double.isNaN(sample.relative_altitude_m));
        assertEquals(-1,sample.battery);
    }
    @Test public void gpsAvailabilityRejectsDjiNullIslandPlaceholderButNotZeroOnOneAxis() {
        assertFalse(TelemetryManager.validPosition(0,0,12));
        assertTrue(TelemetryManager.validPosition(0,77.209,12));
        assertTrue(TelemetryManager.validPosition(28.6,0,12));
        assertFalse(TelemetryManager.validPosition(28,77,0));
        assertFalse(TelemetryManager.validPosition(Double.NaN,77,12));
        assertFalse(TelemetryManager.validPosition(91,77,12));
    }
    /** tests/fixtures/dji-v1-bridge.json is also fed to the original and updated laptop receivers in Node tests. */
    @Test public void encoderMatchesSharedDesktopContract() throws Exception {
        try(java.io.InputStream in=getClass().getResourceAsStream("/dji-v1-bridge.json")) {
            assertNotNull(in);
            JSONObject fixture=new JSONObject(new String(in.readAllBytes(),StandardCharsets.UTF_8));
            TelemetryData sample=new TelemetryData();
            sample.drone_id=fixture.getString("drone_id"); sample.timestamp=fixture.getLong("timestamp");
            sample.position_valid=true; sample.lat=fixture.getDouble("latitude"); sample.lon=fixture.getDouble("longitude");
            sample.relative_altitude_m=40; sample.heading_deg=270; sample.yaw_deg=-90; sample.gps_satellites=12;
            sample.flying=true; sample.flight_state="GPS_NORMAL"; sample.battery=80;
            JSONObject actual=new JSONObject(new String(TelemetryUdpExporter.encode(sample,false),StandardCharsets.UTF_8));
            java.util.Iterator<String> keys=fixture.keys();
            while(keys.hasNext()) {
                String key=keys.next(); Object expected=fixture.get(key), value=actual.get(key);
                if(expected instanceof Number) assertEquals(key,((Number)expected).doubleValue(),((Number)value).doubleValue(),0.000001);
                else assertEquals(key,expected,value);
            }
        }
    }
}
