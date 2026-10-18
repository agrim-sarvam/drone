const db = require('../../database');
const crypto = require('crypto');

class TelemetryLogger {
    constructor() {
        this.isRecording = false;
        this.currentFlightId = null;
        
        this.insertFlightStmt = db.prepare(`
            INSERT INTO flight_records (id, name, startTime) VALUES (@id, @name, @startTime)
        `);
        
        this.updateFlightEndStmt = db.prepare(`
            UPDATE flight_records SET endTime = @endTime WHERE id = @id
        `);

        // Pre-compile the insert statement for max performance
        this.insertStmt = db.prepare(`
            INSERT INTO telemetry (
                flight_id, timestamp, platform_id, latitude, longitude, altitude_m, relative_altitude_m, heading_deg, yaw_deg, pitch_deg, roll_deg, speed_mps,
                velocity_x_mps, velocity_y_mps, velocity_z_mps, gps_satellites, battery_percent, flight_state, flying,
                position_valid, synthetic, altitude_reference
            ) VALUES (
                @flight_id, @timestamp, @platform_id, @latitude, @longitude, @altitude_m, @relative_altitude_m, @heading_deg, @yaw_deg, @pitch_deg, @roll_deg, @speed_mps,
                @velocity_x_mps, @velocity_y_mps, @velocity_z_mps, @gps_satellites, @battery_percent, @flight_state, @flying,
                @position_valid, @synthetic, @altitude_reference
            )
        `);
    }

    startRecording() {
        if (this.isRecording) return;
        this.currentFlightId = `FLIGHT-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        
        try {
            this.insertFlightStmt.run({
                id: this.currentFlightId,
                name: `Recorded Flight ${new Date().toISOString()}`,
                startTime: Date.now()
            });
            this.isRecording = true;
            console.log(`Telemetry Logger: Recording STARTED (Flight ID: ${this.currentFlightId})`);
        } catch (err) {
            console.error('Failed to start recording:', err);
        }
    }

    stopRecording() {
        if (!this.isRecording) return;
        try {
            this.updateFlightEndStmt.run({
                id: this.currentFlightId,
                endTime: Date.now()
            });
        } catch (err) {
            console.error('Failed to update flight end time:', err);
        }
        this.isRecording = false;
        this.currentFlightId = null;
        console.log('Telemetry Logger: Recording STOPPED');
    }

    logTelemetry(data) {
        if (!this.isRecording || !data || !this.currentFlightId) return;

        try {
            this.insertStmt.run({
                flight_id: this.currentFlightId,
                timestamp: data.timestamp,
                platform_id: data.platformId,
                latitude: data.position.latitude,
                longitude: data.position.longitude,
                altitude_m: data.position.altitudeMSL,
                relative_altitude_m: data.position.relativeAltitude !== undefined ? data.position.relativeAltitude : null,
                heading_deg: data.attitude.heading !== undefined ? data.attitude.heading : null,
                yaw_deg: data.attitude.yaw !== undefined ? data.attitude.yaw : null,
                pitch_deg: data.attitude.pitch,
                roll_deg: data.attitude.roll,
                speed_mps: data.velocity.groundSpeed,
                velocity_x_mps: data.velocity.velocityX !== undefined ? data.velocity.velocityX : null,
                velocity_y_mps: data.velocity.velocityY !== undefined ? data.velocity.velocityY : null,
                velocity_z_mps: data.velocity.velocityZ !== undefined ? data.velocity.velocityZ : null,
                gps_satellites: data.status.satellites !== undefined ? data.status.satellites : null,
                battery_percent: data.status.battery !== undefined ? data.status.battery : null,
                flight_state: data.status.flightMode !== undefined ? data.status.flightMode : null,
                flying: data.status.flying != null ? (data.status.flying ? 1 : 0) : null,
                position_valid: data.position.valid == null ? null : Number(data.position.valid),
                synthetic: Number(data.status.synthetic === true),
                altitude_reference: data.position.altitudeReference ?? 'legacy-unspecified'
            });
        } catch (err) {
            console.error('Failed to log telemetry to DB:', err);
        }
    }
}

module.exports = new TelemetryLogger();
