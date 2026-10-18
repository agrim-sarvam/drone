package com.sentinel.cop.dji.telemetry;

import org.junit.Test;
import org.json.JSONObject;
import java.net.DatagramSocket;
import java.net.DatagramPacket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import static org.junit.Assert.*;

public class TelemetryUdpExporterTest {
    @Test public void rejectsInvalidDestinationWithoutCrashingUi() {
        for (String host : new String[]{"", "host", "999.1.2.3", "0.0.0.0", "255.255.255.255", "224.0.0.1"}) {
            try { Destination.parse(host,"14550"); fail(host); } catch (IllegalArgumentException expected) { }
        }
        for (String port : new String[]{"", "abc", "0", "65536", "-1"}) {
            try { Destination.parse("192.168.1.2",port); fail(port); } catch (IllegalArgumentException expected) { }
        }
    }
    @Test public void testPacketActuallyArrivesWhileLiveSenderStopped() throws Exception {
        TelemetryUdpExporter exporter = new TelemetryUdpExporter();
        try (DatagramSocket receiver = new DatagramSocket(0)) {
            receiver.setSoTimeout(2000);
            CountDownLatch result = new CountDownLatch(1);
            exporter.sendTestPacket(Destination.parse("127.0.0.1", String.valueOf(receiver.getLocalPort())),
                    (ok,detail)->{ if(ok) result.countDown(); });
            DatagramPacket packet = new DatagramPacket(new byte[4096],4096);
            receiver.receive(packet);
            JSONObject data = new JSONObject(new String(packet.getData(),0,packet.getLength(),StandardCharsets.UTF_8));
            assertTrue(data.getBoolean("synthetic"));
            assertEquals("SYNTHETIC_NETWORK_TEST",data.getString("drone_id"));
            assertTrue(result.await(2,TimeUnit.SECONDS));
            assertFalse(exporter.isRunning());
        } finally { exporter.stop(); }
    }
    @Test public void senderStopsAndRestartsWithNewDestination() throws Exception {
        TelemetryUdpExporter exporter = new TelemetryUdpExporter();
        TelemetryData sample = new TelemetryData(); sample.drone_id="TEST"; sample.timestamp=1;
        try (DatagramSocket first=new DatagramSocket(0); DatagramSocket second=new DatagramSocket(0)) {
            first.setSoTimeout(2000); second.setSoTimeout(2000);
            exporter.start(Destination.parse("127.0.0.1",String.valueOf(first.getLocalPort())));
            exporter.sendTelemetry(sample);
            first.receive(new DatagramPacket(new byte[4096],4096));
            exporter.stop(); assertFalse(exporter.isRunning());
            exporter.start(Destination.parse("127.0.0.1",String.valueOf(second.getLocalPort())));
            exporter.sendTelemetry(sample);
            second.receive(new DatagramPacket(new byte[4096],4096));
            assertTrue(exporter.effectiveDestination().endsWith(":"+second.getLocalPort()));
        } finally {exporter.stop();}
    }
    @Test public void encodingHasExplicitNoFixAndNoInventedMsl() throws Exception {
        TelemetryData sample=new TelemetryData(); sample.drone_id="DJI_AIRCRAFT"; sample.relative_altitude_m=40; sample.battery=80;
        JSONObject data=new JSONObject(new String(TelemetryUdpExporter.encode(sample,"test-session",1,false),StandardCharsets.UTF_8));
        assertFalse(data.getBoolean("position_valid"));
        assertTrue(data.isNull("latitude")); assertTrue(data.isNull("longitude")); assertTrue(data.isNull("altitude_m"));
        assertEquals(40,data.getDouble("relative_altitude_m"),0);
        assertEquals(80,data.getInt("battery_percent"));
    }
}
