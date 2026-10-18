const EventEmitter = require('events');
const repo = require('./ReplayRepository');

class ReplayEngine extends EventEmitter {
    constructor() {
        super();
        this.flightId = null;
        this.telemetryData = [];
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        
        this.currentIndex = 0;
        this.startTime = 0;
        this.interval = null;
    }

    loadFlight(flightId) {
        this.stop();
        this.flightId = flightId;
        this.telemetryData = repo.getTelemetry(flightId);
        if (this.telemetryData.length === 0) {
            throw new Error('No telemetry found for this flight.');
        }
        this.currentIndex = 0;
        this.startTime = this.telemetryData[0].timestamp;
        console.log(`Replay Engine: Loaded flight ${flightId} with ${this.telemetryData.length} records.`);
        this._emitTelemetry();
    }

    play() {
        if (this.isPlaying || !this.flightId || this.currentIndex >= this.telemetryData.length - 1) return;
        this.isPlaying = true;
        this.emit('status', 'REPLAY_PLAYING');
        
        this._scheduleNext();
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        clearTimeout(this.interval);
        this.emit('status', 'REPLAY_PAUSED');
    }

    stop() {
        this.pause();
        this.currentIndex = 0;
        if (this.telemetryData.length > 0) {
            this._emitTelemetry();
        }
        this.emit('status', 'REPLAY_STOPPED');
    }

    seek(timestamp) {
        // Find closest index
        this.currentIndex = this.telemetryData.findIndex(t => t.timestamp >= timestamp);
        if (this.currentIndex === -1) this.currentIndex = this.telemetryData.length - 1;
        this._emitTelemetry();
    }

    setSpeed(speed) {
        this.playbackSpeed = speed;
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
    }

    _scheduleNext() {
        if (!this.isPlaying || this.currentIndex >= this.telemetryData.length - 1) {
            this.pause();
            return;
        }

        const current = this.telemetryData[this.currentIndex];
        const next = this.telemetryData[this.currentIndex + 1];
        
        const dt = (next.timestamp - current.timestamp) / this.playbackSpeed;
        
        this.interval = setTimeout(() => {
            this.currentIndex++;
            this._emitTelemetry();
            this._scheduleNext();
        }, Math.max(10, dt)); // Ensure we don't spam event loop if dt is very small
    }

    _emitTelemetry() {
        if (this.telemetryData.length === 0) return;
        const raw = this.telemetryData[this.currentIndex];
        
        // Re-construct the normalized telemetry object
        const telemetry = {
            timestamp: raw.timestamp,
            platformId: raw.platform_id,
            position: {
                latitude: raw.latitude,
                longitude: raw.longitude,
                altitudeMSL: raw.altitude_m,
                relativeAltitude: raw.relative_altitude_m !== null ? raw.relative_altitude_m : undefined,
                valid: raw.position_valid == null ? Number.isFinite(raw.latitude) && Number.isFinite(raw.longitude) : raw.position_valid === 1,
                altitudeReference: raw.altitude_reference ?? 'legacy-unspecified',
                gridReference: raw.gridReference || null
            },
            attitude: {
                roll: raw.roll_deg !== null ? raw.roll_deg : undefined,
                pitch: raw.pitch_deg !== null ? raw.pitch_deg : undefined,
                yaw: raw.yaw_deg !== null ? raw.yaw_deg : undefined,
                heading: raw.heading_deg !== null ? raw.heading_deg : undefined
            },
            velocity: {
                groundSpeed: raw.speed_mps !== null ? raw.speed_mps : undefined,
                velocityX: raw.velocity_x_mps !== null ? raw.velocity_x_mps : undefined,
                velocityY: raw.velocity_y_mps !== null ? raw.velocity_y_mps : undefined,
                velocityZ: raw.velocity_z_mps !== null ? raw.velocity_z_mps : undefined
            },
            status: {
                satellites: raw.gps_satellites !== null ? raw.gps_satellites : undefined,
                battery: raw.battery_percent !== null ? raw.battery_percent : undefined,
                flightMode: raw.flight_state !== null ? raw.flight_state : undefined,
                flying: raw.flying !== null ? (raw.flying === 1) : undefined,
                positionValid: raw.position_valid == null ? Number.isFinite(raw.latitude) && Number.isFinite(raw.longitude) : raw.position_valid === 1,
                synthetic: raw.synthetic === 1
            }
        };

        this.emit('telemetry', telemetry);
    }
}

module.exports = new ReplayEngine();
