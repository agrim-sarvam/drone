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
        TelemetryData sample = withFix();
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
    @Test public void subnetMatchingSelectsOnlyTheLaptopsNetwork() {
        byte[] wifi = {(byte)192,(byte)168,1,23};
        assertTrue(Subnet.contains(wifi,24,new byte[]{(byte)192,(byte)168,1,50}));
        assertFalse(Subnet.contains(wifi,24,new byte[]{(byte)192,(byte)168,2,50}));
        assertTrue(Subnet.contains(new byte[]{10,(byte)128,0,1},9,new byte[]{10,(byte)200,3,4}));
        assertFalse(Subnet.contains(new byte[]{10,(byte)128,0,1},9,new byte[]{10,1,3,4}));
        assertTrue(Subnet.contains(wifi,32,wifi));
        assertFalse(Subnet.contains(wifi,33,wifi));
        assertFalse(Subnet.contains(new byte[16],64,new byte[16]));
    }
    @Test public void failedNetworkBindStillSendsOnDefaultRoute() throws Exception {
        TelemetryUdpExporter exporter = new TelemetryUdpExporter();
        exporter.setRoute((socket, destination) -> { throw new java.net.SocketException("ENONET"); });
        TelemetryData sample = withFix();
        try (DatagramSocket receiver=new DatagramSocket(0)) {
            receiver.setSoTimeout(2000);
            exporter.start(Destination.parse("127.0.0.1",String.valueOf(receiver.getLocalPort())));
            assertTrue(exporter.route().startsWith("system default"));
            exporter.sendTelemetry(sample);
            receiver.receive(new DatagramPacket(new byte[4096],4096));
        } finally { exporter.stop(); }
    }
    @Test public void tenHertzAircraftSamplesAreNotThinned() throws Exception {
        TelemetryUdpExporter exporter = new TelemetryUdpExporter();
        TelemetryData sample = withFix();
        try (DatagramSocket receiver=new DatagramSocket(0)) {
            receiver.setSoTimeout(2000);
            exporter.start(Destination.parse("127.0.0.1",String.valueOf(receiver.getLocalPort())));
            for (int i = 0; i < 10; i++) { exporter.sendTelemetry(sample); Thread.sleep(95); }
            for (int i = 0; i < 10; i++) receiver.receive(new DatagramPacket(new byte[4096],4096));
            // The counter is updated just after send() returns on the worker thread.
            for (int i = 0; i < 100 && exporter.packetsSent.get() < 10; i++) Thread.sleep(10);
            assertEquals(10, exporter.packetsSent.get());
        } finally { exporter.stop(); }
    }
    private static TelemetryData withFix() {
        TelemetryData sample = withFix();
        sample.position_valid=true; sample.lat=28.6; sample.lon=77.2; sample.gps_satellites=12;
        return sample;
    }
    @Test public void samplesWithoutGpsFixAreHeldNotSent() throws Exception {
        TelemetryUdpExporter exporter = new TelemetryUdpExporter();
        TelemetryData noFix = new TelemetryData(); noFix.drone_id="TEST"; noFix.timestamp=1;
        try (DatagramSocket receiver=new DatagramSocket(0)) {
            receiver.setSoTimeout(300);
            exporter.start(Destination.parse("127.0.0.1",String.valueOf(receiver.getLocalPort())));
            exporter.sendTelemetry(noFix);
            try { receiver.receive(new DatagramPacket(new byte[4096],4096)); fail("no-fix sample was sent"); }
            catch (java.net.SocketTimeoutException expected) { }
            assertEquals(1, exporter.waitingForFix.get());
            assertEquals(0, exporter.packetsSent.get());
        } finally { exporter.stop(); }
    }
    @Test public void originalLaptopDisplayFieldsAreAlwaysNumbers() throws Exception {
        // The original laptop UI calls toFixed() on these; a null would crash its screen.
        TelemetryData sample = withFix(); sample.relative_altitude_m=Double.NaN; sample.yaw_deg=Double.NaN; sample.speed_mps=Double.NaN;
        JSONObject data=new JSONObject(new String(TelemetryUdpExporter.encode(sample,false),StandardCharsets.UTF_8));
        assertEquals(1,data.getInt("schema_version"));
        for (String key : new String[]{"latitude","longitude","altitude_m","yaw_deg","speed_mps"})
            assertTrue(key, data.get(key) instanceof Number);
        assertTrue(data.isNull("relative_altitude_m"));
    }
}
