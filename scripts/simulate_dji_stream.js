/**
 * simulate_dji_stream.js
 * 
 * Simulates the Sentinel Android Bridge app streaming live DJI telemetry over UDP.
 * Sends valid schema_version: 1 packets at 10 Hz to 127.0.0.1:14550.
 * 
 * Usage:
 *   node scripts/simulate_dji_stream.js [host] [port]
 */

const dgram = require('dgram');
const client = dgram.createSocket('udp4');

const HOST = process.argv[2] || '127.0.0.1';
const PORT = parseInt(process.argv[3]) || 14550;

console.log(`=======================================================`);
console.log(`🛰️  Simulating DJI Sentinel Android Bridge UDP Stream`);
console.log(`📡 Destination: ${HOST}:${PORT} (10 Hz)`);
console.log(`Press Ctrl+C to stop.`);
console.log(`=======================================================\n`);

let lat = 26.9124; // Jaipur, Rajasthan
let lon = 75.7873;
let alt = 150.0;
let relAlt = 45.0;
let heading = 45.0;
let yaw = 45.0;
let speed = 8.5;
let battery = 95;
let packetsSent = 0;

const interval = setInterval(() => {
    // Simulate flight movement
    heading = (heading + 0.5) % 360;
    yaw = heading;
    const rad = (heading * Math.PI) / 180;
    
    // Move slightly
    lat += (Math.cos(rad) * speed * 0.1) / 111111;
    lon += (Math.sin(rad) * speed * 0.1) / (111111 * Math.cos((lat * Math.PI) / 180));
    
    // Slight battery drain every 50 packets
    if (packetsSent % 50 === 0 && battery > 10) {
        battery -= 1;
    }

    const packet = {
        schema_version: 1,
        drone_id: "DJI-MAVIC-TEST",
        timestamp: Date.now(),
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        altitude_m: parseFloat((alt + Math.sin(packetsSent * 0.05) * 5).toFixed(1)),
        relative_altitude_m: parseFloat((relAlt + Math.sin(packetsSent * 0.05) * 5).toFixed(1)),
        heading_deg: parseFloat(heading.toFixed(1)),
        yaw_deg: parseFloat(yaw.toFixed(1)),
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

    const message = Buffer.from(JSON.stringify(packet));
    client.send(message, PORT, HOST, (err) => {
        if (err) {
            console.error("UDP Send Error:", err.message);
        } else {
            packetsSent++;
            if (packetsSent % 10 === 0) {
                process.stdout.write(`\r[DJI Stream] Packets sent: ${packetsSent} | Lat: ${packet.latitude} | Lon: ${packet.longitude} | Alt: ${packet.altitude_m}m | Bat: ${battery}% `);
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
