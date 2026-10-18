const TelemetrySource = require('../../core/telemetry/TelemetrySource');
const dgram = require('node:dgram');
const { isIP } = require('node:net');

const optionalNumber = (value, name, min = -Infinity, max = Infinity) => {
    if (value == null) return null;
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
    return value;
};

function normalizePacket(data) {
    if (!data || ![1, 2].includes(data.schema_version)) throw new Error('Unsupported schema');
    const modern = data.schema_version === 2;
    if (modern && typeof data.position_valid !== 'boolean') throw new Error('Missing GPS validity');
    const satellites = optionalNumber(data.gps_satellites ?? data.gpsSatellites, 'satellites', 0, 255);
    const valid = modern ? data.position_valid : !(satellites !== null && satellites < 4);
    let latitude = null, longitude = null;
    if (valid) {
        latitude = optionalNumber(data.latitude, 'latitude', -90, 90);
        longitude = optionalNumber(data.longitude, 'longitude', -180, 180);
        if (latitude === null || longitude === null) throw new Error('Missing valid position');
    } else if (modern && (data.latitude != null || data.longitude != null)) {
        throw new Error('Invalid GPS fix must have null coordinates');
    }
    if (data.timestamp != null && (!Number.isSafeInteger(data.timestamp) || data.timestamp < 0)) throw new Error('Invalid timestamp');
    if (data.drone_id != null && (typeof data.drone_id !== 'string' || !data.drone_id.length || data.drone_id.length > 128)) throw new Error('Invalid drone ID');
    if (modern && (typeof data.session_id !== 'string' || !data.session_id.length || data.session_id.length > 128
        || !Number.isSafeInteger(data.sequence) || data.sequence < 0 || typeof data.synthetic !== 'boolean'
        || data.altitude_reference !== 'takeoff')) throw new Error('Invalid V2 envelope');
    if (data.flying != null && typeof data.flying !== 'boolean') throw new Error('Invalid flying state');
    if (data.flight_state != null && (typeof data.flight_state !== 'string' || data.flight_state.length > 128)) throw new Error('Invalid flight state');
    const vx = optionalNumber(data.velocity_x_mps ?? data.velocityX, 'velocity X');
    const vy = optionalNumber(data.velocity_y_mps ?? data.velocityY, 'velocity Y');
    const vz = optionalNumber(data.velocity_z_mps ?? data.velocityZ, 'velocity Z');
    const altitude = optionalNumber(data.altitude_m ?? data.altitude, 'altitude');
    if (modern && altitude !== null) throw new Error('V2 takeoff height cannot claim MSL altitude');
    return {
        timestamp: data.timestamp ?? Date.now(),
        platformId: data.drone_id ?? 'DJI-UAV-01',
        position: {
            latitude, longitude, valid,
            // V1's reference was ambiguous; retain the value for legacy files, label it explicitly.
            altitudeMSL: modern ? null : altitude,
            altitudeReference: modern ? 'takeoff' : 'legacy-unspecified',
            relativeAltitude: optionalNumber(data.relative_altitude_m ?? data.relativeAltitude, 'relative altitude')
        },
        attitude: {
            yaw: optionalNumber(data.yaw_deg, 'yaw', -180, 180),
            heading: optionalNumber(data.heading_deg, 'heading', -180, 360),
            pitch: optionalNumber(data.pitch_deg, 'pitch', -180, 180),
            roll: optionalNumber(data.roll_deg, 'roll', -180, 180)
        },
        velocity: {
            groundSpeed: optionalNumber(data.speed_mps, 'speed', 0) ?? (vx !== null && vy !== null ? Math.hypot(vx, vy) : null),
            velocityX: vx, velocityY: vy, velocityZ: vz
        },
        status: {
            battery: optionalNumber(data.battery_percent ?? data.battery, 'battery', 0, 100),
            flightMode: data.flight_state ?? data.flightState ?? null,
            satellites, flying: data.flying ?? null, armed: null,
            positionValid: valid, synthetic: modern ? data.synthetic : data.drone_id === 'TEST_DRONE'
        }
    };
}

class DJIAdapter extends TelemetrySource {
    constructor(platformId = 'DJI-UAV-01') {
        super(platformId);
        this.udpSocket = null;
        this.timeoutTimer = null;
        this.timeoutMs = 3000;
        this.sessions = new Map();
        this.diagnostics = { received: 0, rejected: 0, reordered: 0, lastReceivedAt: null, lastError: null };
    }
    async connect(config = {}) {
        this.disconnect();
        const host = config.host ?? '0.0.0.0', port = config.port ?? 14550;
        const timeout = config.timeout ?? 3000;
        if (isIP(host) !== 4 || !Number.isInteger(port) || port < 0 || port > 65535
            || !Number.isInteger(timeout) || timeout < 100 || timeout > 60000) throw new Error('Invalid IPv4, port or timeout');
        this.timeoutMs = timeout;
        this.sessions.clear();
        this.diagnostics = { received: 0, rejected: 0, reordered: 0, lastReceivedAt: null, lastError: null };
        const socket = dgram.createSocket('udp4');
        this.udpSocket = socket;
        return new Promise((resolve, reject) => {
            socket.on('message', msg => {
                if (this.udpSocket !== socket) return;
                let packet, normalized;
                try {
                    if (msg.length > 16384) throw new Error('Packet too large');
                    packet = JSON.parse(msg.toString('utf8'));
                    normalized = normalizePacket(packet);
                    if (packet.schema_version === 2) {
                        const key = `${packet.drone_id}:${packet.session_id}`;
                        const previous = this.sessions.get(key);
                        if (previous !== undefined && packet.sequence <= previous) {
                            this.diagnostics.reordered++; return;
                        }
                        this.sessions.set(key, packet.sequence);
                        if (this.sessions.size > 32) this.sessions.delete(this.sessions.keys().next().value);
                    }
                } catch (error) {
                    this.diagnostics.rejected++;
                    this.diagnostics.lastError = 'Rejected invalid telemetry packet';
                    return;
                }
                this.diagnostics.received++;
                this.diagnostics.lastReceivedAt = Date.now();
                this.diagnostics.lastError = null;
                this.resetTimeout();
                // Dispatch outside the parsing catch: downstream failures must not masquerade as bad JSON.
                this.emitTelemetry(normalized);
                this.status = normalized.status.synthetic ? 'TEST_TELEMETRY_RECEIVED'
                    : normalized.position.valid ? 'TELEMETRY_RECEIVED' : 'WAITING_FOR_GPS';
                this.emitStatus(this.status);
            });
            socket.once('listening', () => {
                if (this.udpSocket !== socket) { reject(new Error('Connection cancelled')); return; }
                this.isConnected = true;
                this.status = 'UDP_LISTENER_ACTIVE';
                this.emitStatus(this.status);
                this.resetTimeout();
                resolve(true);
            });
            socket.on('error', error => {
                if (this.udpSocket === socket) {
                    this.disconnect();
                    this.status = 'ERROR';
                    this.diagnostics.lastError = error.code || 'UDP socket error';
                    this.emitStatus(this.status);
                }
                reject(error);
            });
            socket.once('close', () => reject(new Error('Connection closed')));
            socket.bind(port, host);
        });
    }
    resetTimeout() {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = setTimeout(() => {
            if (this.isConnected) { this.status = 'TELEMETRY_LOST'; this.emitStatus(this.status); }
        }, this.timeoutMs);
    }
    disconnect() {
        clearTimeout(this.timeoutTimer);
        this.timeoutTimer = null;
        const socket = this.udpSocket;
        this.udpSocket = null;
        if (socket) { try { socket.close(); } catch { /* A failed bind may already have closed. */ } }
        this.isConnected = false;
        this.status = 'DISCONNECTED';
        this.emitStatus(this.status);
    }
    getDiagnostics() { return { status: this.status, ...this.diagnostics }; }
}
module.exports = new DJIAdapter();
module.exports.DJIAdapter = DJIAdapter;
module.exports.normalizePacket = normalizePacket;
