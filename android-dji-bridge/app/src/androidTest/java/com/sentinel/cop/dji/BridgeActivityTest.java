package com.sentinel.cop.dji;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.ext.junit.rules.ActivityScenarioRule;
import androidx.test.platform.app.InstrumentationRegistry;
import android.os.SystemClock;
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
