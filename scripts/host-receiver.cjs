// Runs the desktop's real DJI receiver outside Electron so CI can check what the Android app actually sent.
//   node scripts/host-receiver.cjs listen <port> <report.json>   (until killed)
//   node scripts/host-receiver.cjs verify <report.json>
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { DJIAdapter } = require('../adapters/dji/DJIAdapter');

const [mode, ...args] = process.argv.slice(2);

if (mode === 'listen') {
    const [port, output] = [Number(args[0]), args[1]];
    const adapter = new DJIAdapter();
    const report = { statuses: [], aircraft: 0, synthetic: 0, withFix: 0, withoutFix: 0, sample: null };
    const write = () => fs.writeFileSync(output, JSON.stringify({ ...report, diagnostics: adapter.getDiagnostics() }, null, 2));
    adapter.on('status', status => { if (report.statuses.at(-1) !== status) report.statuses.push(status); write(); });
    adapter.on('telemetry', data => {
        if (data.status.synthetic) report.synthetic++;
        else {
            report.aircraft++;
            if (data.position.valid) { report.withFix++; report.sample = data; } else report.withoutFix++;
        }
        write();
    });
    adapter.connect({ host: '0.0.0.0', port, timeout: 60000 }).then(() => console.log(`Desktop receiver listening on UDP ${port}`));
    process.on('SIGTERM', () => { write(); adapter.disconnect(); process.exit(0); });
} else if (mode === 'verify') {
    const report = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    console.log(JSON.stringify(report, null, 2));
    assert.equal(report.diagnostics.rejected, 0, 'desktop rejected packets the phone produced');
    assert.ok(report.synthetic >= 1, 'phone network-test packet did not arrive');
    assert.equal(report.aircraft, 40, 'every aircraft sample sent at 10 Hz should arrive on loopback NAT');
    assert.equal(report.withoutFix, 10);
    assert.equal(report.withFix, 30);
    for (const status of ['TEST_TELEMETRY_RECEIVED', 'WAITING_FOR_GPS', 'TELEMETRY_RECEIVED']) assert.ok(report.statuses.includes(status), status);
    const { position, attitude, velocity, status } = report.sample;
    assert.equal(position.altitudeReference, 'takeoff');
    assert.equal(position.altitudeMSL, null);
    assert.ok(Math.abs(position.longitude - 77.209) < 1e-9);
    assert.ok(position.gridReference, 'MGRS grid reference computed');
    assert.ok(attitude.heading >= 0 && attitude.heading < 360);
    assert.equal(velocity.groundSpeed, 5);
    assert.equal(status.satellites, 14);
    console.log('PASS: Android app output accepted by the desktop receiver (test packet, no-fix and fix samples).');
} else {
    console.error('usage: host-receiver.cjs listen <port> <report> | verify <report>');
    process.exit(2);
}
