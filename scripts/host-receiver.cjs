// Runs the desktop's DJI receivers outside Electron so CI can check what the Android app actually sent.
// Every datagram from the phone goes to both the updated receiver and the original laptop build's receiver
// (tests/legacy), since testers may still run the original laptop app.
//   node scripts/host-receiver.cjs listen <port> <report.json>   (until killed)
//   node scripts/host-receiver.cjs verify <report.json>
const fs = require('node:fs');
const dgram = require('node:dgram');
const assert = require('node:assert/strict');
const { DJIAdapter } = require('../adapters/dji/DJIAdapter');
const original = require('../tests/legacy/OriginalDJIAdapter.cjs');
const renderOriginalUi = require('../tests/legacy/originalUi.cjs');

const [mode, ...args] = process.argv.slice(2);

async function listen(port, output) {
    const updated = new DJIAdapter();
    const report = {
        datagrams: 0,
        updated: { statuses: [], aircraft: 0, synthetic: 0, sample: null },
        original: { telemetry: 0, renderFailures: 0, lastRender: null }
    };
    const write = () => fs.writeFileSync(output, JSON.stringify({ ...report, updatedDiagnostics: updated.getDiagnostics() }, null, 2));
    updated.on('status', status => { if (report.updated.statuses.at(-1) !== status) report.updated.statuses.push(status); write(); });
    updated.on('telemetry', data => {
        if (data.status.synthetic) report.updated.synthetic++; else { report.updated.aircraft++; report.updated.sample = data; }
        write();
    });
    original.on('telemetry', data => {
        report.original.telemetry++;
        try { report.original.lastRender = renderOriginalUi(data); } catch { report.original.renderFailures++; }
        write();
    });
    await updated.connect({ host: '127.0.0.1', port: 0, timeout: 60000 });
    await original.connect({ host: '127.0.0.1', port: 0, timeout: 60000 });
    const targets = [updated.udpSocket.address().port, original.udpSocket.address().port];
    const front = dgram.createSocket('udp4');
    front.on('message', message => {
        report.datagrams++;
        for (const target of targets) front.send(message, target, '127.0.0.1');
    });
    front.bind(port, '0.0.0.0', () => console.log(`Desktop receivers (updated + original) listening on UDP ${port}`));
    process.on('SIGTERM', () => { write(); front.close(); updated.disconnect(); original.disconnect(); process.exit(0); });
}

if (mode === 'listen') {
    listen(Number(args[0]), args[1]);
} else if (mode === 'verify') {
    const report = JSON.parse(fs.readFileSync(args[0], 'utf8'));
    console.log(JSON.stringify(report, null, 2));
    // 30 aircraft samples with a GPS fix + 1 test packet; the 10 no-fix samples are held on the phone.
    assert.equal(report.datagrams, 31, 'phone should send only fix samples plus the test packet');
    assert.equal(report.updatedDiagnostics.rejected, 0, 'updated receiver rejected packets the phone produced');
    assert.equal(report.updated.synthetic, 1, 'phone network-test packet did not arrive');
    assert.equal(report.updated.aircraft, 30);
    for (const status of ['TEST_TELEMETRY_RECEIVED', 'TELEMETRY_RECEIVED']) assert.ok(report.updated.statuses.includes(status), status);
    assert.equal(report.original.telemetry, 31, 'original laptop receiver dropped packets');
    assert.equal(report.original.renderFailures, 0, 'original laptop screen would crash on these packets');
    const { position, attitude, velocity, status } = report.updated.sample;
    assert.ok(Math.abs(position.longitude - 77.209) < 1e-9);
    assert.equal(position.altitudeReference, 'legacy-unspecified');
    assert.equal(position.altitudeMSL, position.relativeAltitude, 'V1 altitude carries the takeoff height');
    assert.ok(position.gridReference, 'MGRS grid reference computed');
    assert.ok(attitude.heading >= 0 && attitude.heading < 360);
    assert.equal(velocity.groundSpeed, 5);
    assert.equal(status.satellites, 14);
    console.log('PASS: Android app output accepted by the original and updated laptop receivers; original screen renders it.');
} else {
    console.error('usage: host-receiver.cjs listen <port> <report> | verify <report>');
    process.exit(2);
}
