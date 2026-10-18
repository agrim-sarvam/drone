/**
 * simulate_dji_stream.js
 *
 * Simulates the Sentinel Android Bridge streaming DJI telemetry over UDP, using the same
 * schema_version 2 packets the phone app sends (see tests/fixtures/dji-v2.json).
 * The first 3 seconds have no GPS fix, as on a real aircraft after power-on.
 *
 * Usage:
 *   node scripts/simulate_dji_stream.js [host] [port] [--v1]
 *   --v1  send the legacy schema_version 1 packets instead
 */

const dgram = require('dgram');
const crypto = require('crypto');
const client = dgram.createSocket('udp4');

const positional = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
const legacy = process.argv.includes('--v1');
const HOST = positional[0] || '127.0.0.1';
const PORT = parseInt(positional[1]) || 14550;
const SESSION = crypto.randomUUID();

console.log(`=======================================================`);
console.log(`🛰️  Simulating DJI Sentinel Android Bridge UDP Stream`);
console.log(`📡 Destination: ${HOST}:${PORT} (10 Hz, schema v${legacy ? 1 : 2})`);
console.log(`Press Ctrl+C to stop.`);
console.log(`=======================================================\n`);

let lat = 26.9124; // Jaipur, Rajasthan
let lon = 75.7873;
let relAlt = 45.0;
let heading = 45.0;
let speed = 8.5;
let battery = 95;
let packetsSent = 0;

function legacyPacket() {
    const rad = (heading * Math.PI) / 180;
    return {
        schema_version: 1,
        drone_id: "DJI-MAVIC-TEST",
        timestamp: Date.now(),
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        altitude_m: parseFloat((150 + Math.sin(packetsSent * 0.05) * 5).toFixed(1)),
        relative_altitude_m: parseFloat((relAlt + Math.sin(packetsSent * 0.05) * 5).toFixed(1)),
        heading_deg: parseFloat(heading.toFixed(1)),
        yaw_deg: parseFloat(heading.toFixed(1)),
        pitch_deg: 2.1,
        roll_deg: -1.4,
        speed_mps: speed,
        velocity_x_mps: parseFloat((Math.cos(rad) * speed).toFixed(2)),
        velocity_y_mps: parseFloat((Math.sin(rad) * speed).toFixed(2)),
        velocity_z_mps: 0.1,
        gps_satellites: 16,
        flying: true,
        flight_state: "IN_FLIGHT",
        battery_percent: battery
    };
}

// Mirrors TelemetryUdpExporter.encode on the phone.
function bridgePacket() {
    const rad = (heading * Math.PI) / 180;
    const fix = packetsSent >= 30;
    const yaw = heading > 180 ? heading - 360 : heading; // DJI yaw is -180..180
    return {
        schema_version: 2,
        drone_id: "DJI_AIRCRAFT",
        timestamp: Date.now(),
        session_id: SESSION,
        sequence: packetsSent,
        synthetic: false,
        position_valid: fix,
        latitude: fix ? parseFloat(lat.toFixed(7)) : null,
        longitude: fix ? parseFloat(lon.toFixed(7)) : null,
        altitude_m: null,
        altitude_reference: "takeoff",
        relative_altitude_m: parseFloat((relAlt + Math.sin(packetsSent * 0.05) * 5).toFixed(1)),
        heading_deg: parseFloat(heading.toFixed(1)),
        yaw_deg: parseFloat(yaw.toFixed(1)),
        pitch_deg: -2.1,
        roll_deg: -1.4,
        speed_mps: speed,
        velocity_x_mps: parseFloat((Math.cos(rad) * speed).toFixed(2)),
        velocity_y_mps: parseFloat((Math.sin(rad) * speed).toFixed(2)),
        velocity_z_mps: -0.1,
        gps_satellites: fix ? 16 : 0,
        flying: true,
        flight_state: fix ? "GPS_ATTI" : "ATTI",
        battery_percent: battery
    };
}

const interval = setInterval(() => {
    // Simulate flight movement
    heading = (heading + 0.5) % 360;
    const rad = (heading * Math.PI) / 180;
    lat += (Math.cos(rad) * speed * 0.1) / 111111;
    lon += (Math.sin(rad) * speed * 0.1) / (111111 * Math.cos((lat * Math.PI) / 180));

    // Slight battery drain every 50 packets
    if (packetsSent % 50 === 0 && battery > 10) {
        battery -= 1;
    }

    const packet = legacy ? legacyPacket() : bridgePacket();
    const message = Buffer.from(JSON.stringify(packet));
    client.send(message, PORT, HOST, (err) => {
        if (err) {
            console.error("UDP Send Error:", err.message);
        } else {
            packetsSent++;
            if (packetsSent % 10 === 0) {
                const position = packet.latitude === null ? 'waiting for GPS fix' : `Lat: ${packet.latitude} | Lon: ${packet.longitude}`;
                process.stdout.write(`\r[DJI Stream] Packets sent: ${packetsSent} | ${position} | Height: ${packet.relative_altitude_m}m | Bat: ${battery}%      `);
            }
        }
    });
}, 100);

process.on('SIGINT', () => {
    clearInterval(interval);
    client.close();
    console.log(`\n\nSimulator stopped. Total packets sent: ${packetsSent}`);
    process.exit(0);
});
