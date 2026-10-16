# Tactical COP (Common Operating Picture) - Setup & Operations Guide

This document provides instructions on how to install, run, and connect both **DJI SDK** and **MAVLink (PX4/ArduPilot)** drones to the Tactical Common Operating Picture (COP) ground station.

---

## 1. System Requirements & Installation

The ground station is built with Node.js and Electron for cross-platform compatibility (Windows, Mac, Linux) and operates 100% offline.

### Prerequisites:
1. **Node.js**: v18 or higher (Download from [nodejs.org](https://nodejs.org/)).
2. **Git** (optional): for repository cloning.

### Installation Commands:
Open PowerShell / Command Prompt / Terminal and execute:

```bash
# 1. Install root dependencies
npm install

# 2. Install client user interface dependencies
cd client
npm install
cd ..

# 3. (Optional) Download high-resolution offline map tiles:
node scripts/download_map.js
```
*(Note: An active internet connection is only required once during `download_map.js`. Once complete, all tactical imagery is stored locally in the `data/` folder and operates completely offline).*

### Running the Application:
To launch the application in operational mode:
```bash
npm run dev
```

To build a standalone desktop executable installer (`.exe` on Windows or `.dmg` on Mac):
```bash
npm run build
```

To run the automated verification test suite:
```bash
npm test
```

---

## 2. Network & IP Configuration

To transmit live telemetry over UDP from either an Android phone running DJI SDK or a MAVLink drone over Wi-Fi, both the Ground Station computer and the transmitting device must be on the **same local network** (e.g. connected to the same Wi-Fi router or an Android Mobile Hotspot hosted by the phone).

### Step A: Find your Laptop / PC IP Address
1. **On Windows**:
   - Open Command Prompt (`cmd`)
   - Run:
     ```cmd
     ipconfig
     ```
   - Look for **IPv4 Address** under your active Wi-Fi or Ethernet adapter (e.g., `192.168.1.50` or `10.0.0.15`).
2. **On Mac / Linux**:
   - Run:
     ```bash
     ipconfig getifaddr en0
     ```
     *(or `ip a` on Linux)*

### Step B: Windows Firewall Check
If running on Windows, ensure Windows Firewall permits UDP traffic on port `14550`:
- When prompted upon launching the app, check both **Private** and **Public** networks, then click **Allow Access**.

---

## 3. Connecting DJI Drones (DJI Mobile SDK)

DJI drones (Mini, Mavic, Air, Phantom, Inspire, Matrice series compatible with DJI Mobile SDK v4) connect through the **Sentinel DJI Bridge** Android app.

```
+----------------+        USB Cable        +--------------------+        UDP (Wi-Fi)        +----------------------+
|   DJI Drone    |  <==================>  | Android Phone      |  ----------------------->  | Ground Station (COP) |
|   & Controller |   (DJI SDK Protocol)   | Sentinel Bridge App|        Port: 14550         | Laptop / PC          |
+----------------+                        +--------------------+                            +----------------------+
```

### Step 1: Install the Android Bridge App
1. Open the project folder `android-dji-bridge/` in **Android Studio**.
2. If you have a custom DJI Developer API Key, ensure it is set in `local.properties`:
   ```properties
   dji.api.key=YOUR_DJI_DEVELOPER_KEY
   ```
3. Connect your Android phone via USB and run the app, or build the APK via Gradle:
   ```bash
   ./gradlew assembleDebug
   ```
   Install `app/build/outputs/apk/debug/app-debug.apk` onto the Android device.

### Step 2: Establish the Hardware Link
1. Connect your Android phone to the **DJI Remote Controller** via USB cable.
2. Ensure both the Android phone and the Ground Station laptop are connected to the same Wi-Fi network (or connect your laptop to the Android phone's Personal Hotspot).
3. Open **Sentinel DJI Bridge** on the phone.
4. When prompted, grant USB accessory permissions to allow the app to talk to the DJI remote.
5. Verify the on-screen indicators:
   - **DJI SDK**: `REGISTERED`
   - **Aircraft**: `CONNECTED`

### Step 3: Configure Destination IP & Start Streaming
1. In the **Windows IP** field on the phone, enter the **Ground Station PC's IPv4 address** (e.g., `192.168.1.50`).
2. In the **Port** field, enter `14550`.
3. To test the connection without flying, tap **"SEND STATIC TEST PACKET"**.
4. Tap **"START UDP"** to begin continuous 10 Hz telemetry streaming.

### Step 4: Connect on the Ground Station App
1. On the Ground Station desktop app, locate the **Hardware Connection** panel in the top-left corner.
2. Select the **DJI SDK (UDP)** option.
3. Configure settings:
   - **IP**: `0.0.0.0` (binds to all incoming network interfaces)
   - **Port**: `14550`
   - **Timeout (ms)**: `3000`
4. Click **"Connect to Drone"**.
5. Once packets arrive, the status turns green (**Connected**), and the drone appears on the live map with:
   - Live GPS position (lat/lon)
   - Altitude MSL & Relative Altitude
   - Independent Heading & Yaw angles
   - Pitch & Roll
   - Ground Speed & 3D Velocities (Vx, Vy, Vz)
   - GPS Satellite count & Battery %

---

## 4. Connecting MAVLink Drones (PX4 / ArduPilot)

The system includes a native MAVLink parser compatible with standard autopilots.

### Option A: MAVLink via Wi-Fi / UDP
1. Connect your laptop to the drone's telemetry Wi-Fi access point or ground router.
2. In the Ground Station app, select **MAVLink (UDP)**.
3. Set **IP** to `0.0.0.0` and **Port** to `14550`.
4. Click **"Connect to Drone"**.

### Option B: MAVLink via USB Telemetry Radio (Serial)
1. Plug your telemetry radio (SiK Radio, RFD900, or Pixhawk USB) into a USB port.
2. In the Ground Station app, select **Serial**.
3. Configure:
   - **Path**:
     - Windows: `COM3`, `COM4`, etc. (check Windows Device Manager -> Ports)
     - Linux / Mac: `/dev/ttyUSB0` or `/dev/tty.usbserial-*`
   - **Baud Rate**: `57600` (standard) or `115200`
4. Click **"Connect to Drone"**.

---

## 5. Offline Flight Recording & Replay

All incoming telemetry packets are automatically logged into the local SQLite database (`data/tactical_cop.sqlite`).

- **Recording**: Begins automatically when telemetry is received.
- **Mission Replay**: In the bottom Replay panel, select any past flight recording and click **Play** to review full 3D flight paths, speed, and attitudes offline with variable speed playback (1x, 2x, 5x, 10x).

---

## 6. Quick Troubleshooting

| Issue | Likely Cause | Solution |
| :--- | :--- | :--- |
| **"No packets received / Telemetry Lost"** | Incorrect IP on Android | Run `ipconfig` on the PC and ensure the Android app has that exact IP entered. |
| **"EADDRINUSE (Port in use)"** | Another app is using port 14550 | Close any instances of QGroundControl or Mission Planner, or disconnect previous session. |
| **"Aircraft: DISCONNECTED" on Android** | USB connection issue | Re-plug the USB-C cable between the phone and DJI remote controller; select "File Transfer / MIDI" or allow USB accessory. |
| **Radio buttons disabled in UI** | Already connected | Click **"Disconnect Drone"** first before switching between DJI SDK, MAVLink, and Serial. |
