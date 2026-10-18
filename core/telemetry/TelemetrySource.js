const EventEmitter = require('events');
const mgrs = require('mgrs');
/**
 * Base class for all telemetry sources (Simulator, MAVLink, etc)
 * Enforces a normalized telemetry object format.
 */
class TelemetrySource extends EventEmitter {
    constructor(platformId) {
        super();
        this.platformId = platformId;
        this.isConnected = false;
    }

    connect() {
        throw new Error('connect() must be implemented by subclass');
    }

    disconnect() {
        throw new Error('disconnect() must be implemented by subclass');
    }

    /**
     * Subclasses must call this to emit normalized telemetry
     */
    emitTelemetry(data) {
        // Enforce normalized structure
        const normalized = {
            timestamp: data.timestamp !== undefined ? data.timestamp : Date.now(),
            platformId: data.platformId !== undefined ? data.platformId : this.platformId,
            position: {
                latitude: data.position?.latitude !== undefined ? data.position.latitude : null,
                longitude: data.position?.longitude !== undefined ? data.position.longitude : null,
                altitudeMSL: data.position?.altitudeMSL !== undefined ? data.position.altitudeMSL : null,
                relativeAltitude: data.position?.relativeAltitude !== undefined ? data.position.relativeAltitude : null,
                valid: data.position?.valid ?? (Number.isFinite(data.position?.latitude) && Number.isFinite(data.position?.longitude)),
                altitudeReference: data.position?.altitudeReference ?? 'msl',
                gridReference: data.position?.gridReference || (Number.isFinite(data.position?.latitude)
                    && Number.isFinite(data.position?.longitude) && data.position.latitude >= -80 && data.position.latitude <= 84
                    ? mgrs.forward([data.position.longitude, data.position.latitude]) : null)
            },
            attitude: {
                roll: data.attitude?.roll !== undefined ? data.attitude.roll : null,
                pitch: data.attitude?.pitch !== undefined ? data.attitude.pitch : null,
                yaw: data.attitude?.yaw !== undefined ? data.attitude.yaw : null,
                heading: data.attitude?.heading !== undefined ? data.attitude.heading : null
            },
            velocity: {
                groundSpeed: data.velocity?.groundSpeed !== undefined ? data.velocity.groundSpeed : null,
                velocityX: data.velocity?.velocityX !== undefined ? data.velocity.velocityX : null,
                velocityY: data.velocity?.velocityY !== undefined ? data.velocity.velocityY : null,
                velocityZ: data.velocity?.velocityZ !== undefined ? data.velocity.velocityZ : null
            },
            status: {
                connected: this.isConnected,
                armed: data.status?.armed !== undefined ? data.status.armed : null,
                flightMode: data.status?.flightMode !== undefined ? data.status.flightMode : null,
                battery: data.status?.battery !== undefined ? data.status.battery : null,
                satellites: data.status?.satellites !== undefined ? data.status.satellites : null,
                flying: data.status?.flying !== undefined ? data.status.flying : null,
                positionValid: data.position?.valid ?? (Number.isFinite(data.position?.latitude) && Number.isFinite(data.position?.longitude)),
                synthetic: data.status?.synthetic === true
            }
        };

        this.emit('telemetry', normalized);
    }

    emitStatus(statusStr) {
        this.emit('status', statusStr);
    }
}

module.exports = TelemetrySource;
