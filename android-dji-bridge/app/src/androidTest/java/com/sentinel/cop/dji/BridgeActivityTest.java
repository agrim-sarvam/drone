package com.sentinel.cop.dji;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.platform.app.InstrumentationRegistry;
import android.os.SystemClock;
import com.sentinel.cop.dji.telemetry.FlightSnapshot;
import org.junit.Assume;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONObject;
import java.net.DatagramSocket;
import java.net.DatagramPacket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.matcher.ViewMatchers.withId;
import static androidx.test.espresso.matcher.ViewMatchers.withText;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static org.hamcrest.Matchers.containsString;

@RunWith(AndroidJUnit4.class)
public class BridgeActivityTest {
    @Rule public ActivityScenarioRule<MainActivity> rule = new ActivityScenarioRule<>(MainActivity.class);

    private BridgeController controller() {
        return ((BridgeApplication) InstrumentationRegistry.getInstrumentation().getTargetContext().getApplicationContext()).controller();
    }
    private void awaitRunning(boolean expected) {
        long until=SystemClock.uptimeMillis()+5000;
        while(controller().exporter.isRunning()!=expected && SystemClock.uptimeMillis()<until) SystemClock.sleep(50);
        assertEquals(expected,controller().exporter.isRunning());
    }
    @Test public void launchesWithoutDjiRegistrationAndRejectsInvalidPort() {
        assertTrue("Run instrumentation only with -PnetworkOnly",BuildConfig.NETWORK_ONLY);
        onView(withId(R.id.ip_input)).perform(replaceText("127.0.0.1"),closeSoftKeyboard());
        onView(withId(R.id.port_input)).perform(replaceText("65536"),closeSoftKeyboard());
        onView(withId(R.id.start_button)).perform(scrollTo(),click());
        assertFalse(controller().exporter.isRunning());
        assertTrue(controller().sdk.contains("NETWORK TEST ONLY"));
        // The camera panel lays out without touching the DJI decoder when DJI is disabled.
        onView(withId(R.id.video_status)).check(matches(withText(containsString("network-test build"))));
    }
    @Test public void phoneTestButtonSendsARealUdpPacketWithLiveSenderStopped() throws Exception {
        try(DatagramSocket receiver=new DatagramSocket(0)) {
            receiver.setSoTimeout(5000);
            onView(withId(R.id.ip_input)).perform(replaceText("127.0.0.1"),closeSoftKeyboard());
            onView(withId(R.id.port_input)).perform(replaceText(String.valueOf(receiver.getLocalPort())),closeSoftKeyboard());
            onView(withId(R.id.test_button)).perform(scrollTo(),click());
            DatagramPacket packet=new DatagramPacket(new byte[4096],4096); receiver.receive(packet);
            JSONObject data=new JSONObject(new String(packet.getData(),0,packet.getLength(),StandardCharsets.UTF_8));
            assertTrue(data.getBoolean("synthetic"));
            assertEquals("SYNTHETIC_NETWORK_TEST",data.getString("drone_id"));
            assertFalse(controller().exporter.isRunning());
        }
    }
    /**
     * Phone → laptop end to end, minus DJI hardware: the UI starts the real foreground sender, aircraft-shaped
     * snapshots (no fix, then fix) go through the same publish path DJI callbacks use, and the desktop's own
     * receiver listens on the CI host (10.0.2.2 from the emulator). scripts/host-receiver.cjs verifies arrival.
     */
    @Test public void aircraftSamplesReachDesktopReceiverOnHost() {
        String port = InstrumentationRegistry.getArguments().getString("hostReceiverPort");
        Assume.assumeNotNull(port);
        onView(withId(R.id.ip_input)).perform(replaceText("10.0.2.2"),closeSoftKeyboard());
        onView(withId(R.id.port_input)).perform(replaceText(port),closeSoftKeyboard());
        onView(withId(R.id.test_button)).perform(scrollTo(),click());
        onView(withId(R.id.start_button)).perform(scrollTo(),click());
        try {
            awaitRunning(true);
            assertFalse(controller().exporter.route(), controller().exporter.route().contains("bind failed"));
            for (int i = 0; i < 40; i++) {
                boolean fix = i >= 10;
                FlightSnapshot state = new FlightSnapshot();
                // DJI V4 reports NaN coordinates until the aircraft has a GPS position.
                state.locationPresent = true;
                state.latitude = fix ? 28.6139 + i * 0.00001 : Double.NaN;
                state.longitude = fix ? 77.2090 : Double.NaN;
                state.takeoffHeight = i * 0.5;
                state.yaw = -180 + i * 9; state.pitch = -5; state.roll = 2;
                state.velocityX = 3; state.velocityY = -4; state.velocityZ = -0.5;
                state.satellites = fix ? 14 : 0; state.gpsSignalAvailable = fix;
                state.flying = true; state.flightMode = "GPS_ATTI";
                controller().publish(state);
                SystemClock.sleep(100);
            }
            long until = SystemClock.uptimeMillis() + 2000;
            while (controller().exporter.packetsSent.get() < 40 && SystemClock.uptimeMillis() < until) SystemClock.sleep(50);
            assertEquals(40, controller().exporter.packetsSent.get());
            assertEquals(0, controller().exporter.sendErrors.get());
        } finally {
            InstrumentationRegistry.getInstrumentation().getTargetContext().stopService(new android.content.Intent(
                    InstrumentationRegistry.getInstrumentation().getTargetContext(),BridgeService.class));
            awaitRunning(false);
        }
    }
    @Test public void activityRecreationDoesNotStopExplicitlyStartedSender() {
        onView(withId(R.id.ip_input)).perform(replaceText("127.0.0.1"),closeSoftKeyboard());
        onView(withId(R.id.port_input)).perform(replaceText("14550"),closeSoftKeyboard());
        onView(withId(R.id.start_button)).perform(scrollTo(),click());
        try {
            awaitRunning(true);
            BridgeController before=controller();
            rule.getScenario().recreate();
            assertSame(before,controller());
            assertTrue(controller().exporter.isRunning());
            // Wait for the recreated Activity to render the process-owned state before clicking Stop.
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            onView(withId(R.id.start_button)).perform(scrollTo(),click());
            awaitRunning(false);
        } finally {
            InstrumentationRegistry.getInstrumentation().getTargetContext().stopService(new android.content.Intent(
                    InstrumentationRegistry.getInstrumentation().getTargetContext(),BridgeService.class));
        }
    }
}
