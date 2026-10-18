const EventEmitter = require('node:events');
const dgram = require('node:dgram');
const { isIP } = require('node:net');

/**
 * Receives the phone bridge's live view: one complete JPEG per UDP datagram, on the telemetry port + 1.
 * Anything that is not a whole JPEG is counted and dropped, so a stray sender cannot reach the renderer.
 */
class VideoFrameReceiver extends EventEmitter {
    constructor() {
        super();
        this.socket = null;
        this.diagnostics = { frames: 0, rejected: 0, lastFrameAt: null, port: null };
    }
    async start({ host = '0.0.0.0', port }) {
        this.stop();
        if (isIP(host) !== 4 || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid video IPv4 or port');
        this.diagnostics = { frames: 0, rejected: 0, lastFrameAt: null, port };
        const socket = dgram.createSocket('udp4');
        this.socket = socket;
        socket.on('message', message => {
            if (this.socket !== socket) return;
            if (!isJpeg(message)) { this.diagnostics.rejected++; return; }
            this.diagnostics.frames++;
            this.diagnostics.lastFrameAt = Date.now();
            this.emit('frame', message);
        });
        await new Promise((resolve, reject) => {
            socket.once('error', error => { if (this.socket === socket) this.stop(); reject(error); });
            socket.bind(port, host, () => { this.diagnostics.port = socket.address().port; resolve(); });
        });
    }
    stop() {
        const socket = this.socket;
        this.socket = null;
        if (socket) { try { socket.close(); } catch { /* already closed after a failed bind */ } }
    }
    getDiagnostics() { return { ...this.diagnostics }; }
}

function isJpeg(buffer) {
    return buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8
        && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
}

module.exports = new VideoFrameReceiver();
module.exports.VideoFrameReceiver = VideoFrameReceiver;
module.exports.isJpeg = isJpeg;
