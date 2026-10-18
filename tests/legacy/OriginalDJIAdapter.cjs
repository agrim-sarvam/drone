// Verbatim copy of adapters/dji/DJIAdapter.js from vijayKota2776/drone main at 4adfa61 (before the bridge repair).
// Testers may still run this laptop build, so the phone's packets are checked against it in CI.
const TelemetrySource = require('../../core/telemetry/TelemetrySource');
const dgram = require('dgram');

class DJIAdapter extends TelemetrySource {
    constructor(platformId = 'DJI-UAV-01') {
        super(platformId);
        this.udpSocket = null;
        this.timeoutTimer = null;
        this.timeoutMs = 3000;
    }

    connect(config = { port: 14550, host: '0.0.0.0', timeout: 3000 }) {
        return new Promise((resolve, reject) => {
            if (this.isConnected) this.disconnect();
            
            this.timeoutMs = config.timeout || 3000;
            this.udpSocket = dgram.createSocket('udp4');
        
        this.udpSocket.on('message', (msg, rinfo) => {
            try {
                // Log raw received JSON for debugging as requested by client
                const rawJson = msg.toString();
                // console.log(`DJI Raw JSON: ${rawJson}`); 

                const data = JSON.parse(rawJson);
                
                // Validate schema version
                if (data.schema_version !== 1) {
                    console.warn(`Unsupported schema version: ${data.schema_version}`);
                    return;
                }

                // Validate latitude/longitude range
                if (!isFinite(data.latitude) || data.latitude < -90 || data.latitude > 90 ||
                    !isFinite(data.longitude) || data.longitude < -180 || data.longitude > 180) {
                    return; // Ignore invalid packets silently without crashing
                }

                // If this is the first packet or recovering from lost telemetry
                if (this.status !== 'TELEMETRY_RECEIVED') {
                    this.status = 'TELEMETRY_RECEIVED';
                    this.emitStatus('TELEMETRY_RECEIVED');
                }
                
                // Calculate ground speed from velocityX and velocityY if available
                let velX = data.velocity_x_mps !== undefined ? data.velocity_x_mps : (data.velocityX !== undefined ? data.velocityX : null);
                let velY = data.velocity_y_mps !== undefined ? data.velocity_y_mps : (data.velocityY !== undefined ? data.velocityY : null);
                let velZ = data.velocity_z_mps !== undefined ? data.velocity_z_mps : (data.velocityZ !== undefined ? data.velocityZ : null);
                
                let groundSpeed = null;
                if (velX !== null && velY !== null) {
                    groundSpeed = Math.sqrt(velX**2 + velY**2);
                }

                this.emitTelemetry({
                    position: {
                        latitude: data.latitude,
                        longitude: data.longitude,
                        altitudeMSL: data.altitude_m !== undefined ? data.altitude_m : (data.altitude !== undefined ? data.altitude : null),
                        relativeAltitude: data.relative_altitude_m !== undefined ? data.relative_altitude_m : (data.relativeAltitude !== undefined ? data.relativeAltitude : null)
                    },
                    attitude: {
                        yaw: data.yaw_deg !== undefined ? data.yaw_deg : null,
                        heading: data.heading_deg !== undefined ? data.heading_deg : null,
                        pitch: data.pitch_deg !== undefined ? data.pitch_deg : null,
                        roll: data.roll_deg !== undefined ? data.roll_deg : null
                    },
                    velocity: {
                        groundSpeed: data.speed_mps !== undefined ? data.speed_mps : groundSpeed,
                        velocityX: velX,
                        velocityY: velY,
                        velocityZ: velZ
                    },
                    status: {
                        battery: data.battery_percent !== undefined ? data.battery_percent : (data.battery !== undefined ? data.battery : null),
                        flightMode: data.flight_state !== undefined ? data.flight_state : (data.flightState !== undefined ? data.flightState : null),
                        satellites: data.gps_satellites !== undefined ? data.gps_satellites : (data.gpsSatellites !== undefined ? data.gpsSatellites : null),
                        flying: data.flying !== undefined ? data.flying : null,
                        armed: null // DJI UDP source does not provide a reliable armed state
                    },
                    platformId: data.drone_id !== undefined ? data.drone_id : this.platformId,
                    timestamp: data.timestamp !== undefined ? data.timestamp : Date.now()
                });

                this.resetTimeout();

            } catch (err) {
                // Reject malformed JSON and log the error without crashing
                console.error("DJI Adapter Error parsing payload:", err.message);
            }
        });

        this.udpSocket.on('listening', () => {
            console.log(`DJI Adapter listening on UDP ${config.host || '0.0.0.0'}:${config.port}`);
            this.isConnected = true;
            this.status = 'UDP_LISTENER_ACTIVE';
            this.emitStatus('UDP_LISTENER_ACTIVE');
            this.resetTimeout();
            resolve(true);
        });

        this.udpSocket.on('error', (err) => {
            console.error(`DJI Adapter Socket Error: ${err.message}`);
            this.disconnect();
            reject(err);
        });

        try {
            this.udpSocket.bind(config.port, config.host || '0.0.0.0');
        } catch(err) {
            reject(err);
        }
        });
    }

    resetTimeout() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
        }
        this.timeoutTimer = setTimeout(() => {
            if (this.isConnected) {
                this.status = 'TELEMETRY_LOST';
                this.emitStatus('TELEMETRY_LOST');
                console.log('DJI Telemetry Lost - no packets received');
            }
        }, this.timeoutMs);
    }

    disconnect() {
        if (!this.isConnected) return;
        
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }

        if (this.udpSocket) {
            this.udpSocket.close();
            this.udpSocket = null;
        }
        this.isConnected = false;
        this.status = 'DISCONNECTED';
        this.emitStatus('DISCONNECTED');
        console.log('DJI Adapter Disconnected');
    }
}

module.exports = new DJIAdapter();
