const {test} = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const {once} = require('node:events');
const {DJIAdapter, normalizePacket} = require('../../adapters/dji/DJIAdapter');
const fixture = require('../fixtures/dji-v2.json');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function receiver(t, timeout = 1000) {
    const adapter = new DJIAdapter();
    const sender = dgram.createSocket('udp4');
    t.after(() => { sender.close(); adapter.disconnect(); });
    await adapter.connect({host:'127.0.0.1',port:0,timeout});
    const port = adapter.udpSocket.address().port;
    const send = data => new Promise((resolve,reject) => sender.send(Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)),port,'127.0.0.1',e=>e?reject(e):resolve()));
    const receive = async data => {
        const event = once(adapter,'telemetry',{signal:AbortSignal.timeout(2000)});
        await send(data);
        return (await event)[0];
    };
    return {adapter,send,receive};
}

test('V2 shared fixture preserves takeoff height, zero speed and unknown MSL', () => {
    const data = normalizePacket(fixture);
    assert.equal(data.position.altitudeMSL,null);
    assert.equal(data.position.relativeAltitude,40);
    assert.equal(data.position.altitudeReference,'takeoff');
    assert.equal(data.velocity.groundSpeed,0);
    assert.equal(data.attitude.yaw,-90);
});

test('reject coercing numeric fields, missing valid position, unsupported schemas and invalid ranges', () => {
    for (const changes of [{latitude:null},{latitude:'28.6'},{longitude:200},{battery_percent:101},
        {relative_altitude_m:'40'},{schema_version:3},{position_valid:'true'},{sequence:-1},{altitude_m:40}]) {
        assert.throws(()=>normalizePacket({...fixture,...changes}));
    }
    const missing = {...fixture}; delete missing.position_valid;
    assert.throws(()=>normalizePacket(missing));
});

test('no fix keeps battery, suppresses map position; true zero coordinates remain valid', () => {
    const nofix = normalizePacket({...fixture,position_valid:false,latitude:null,longitude:null,gps_satellites:0});
    assert.equal(nofix.position.latitude,null);
    assert.equal(nofix.status.battery,80);
    const zero = normalizePacket({...fixture,latitude:0,longitude:0});
    assert.equal(zero.position.valid,true);
});

test('UDP fixture, sequence rejection, session restart, timeout and recovery', async t => {
    const {adapter,send,receive} = await receiver(t,150);
    const data = await receive(fixture);
    assert.equal(data.position.relativeAltitude,40);
    assert.equal(adapter.status,'TELEMETRY_RECEIVED');
    await send(fixture); await delay(30);
    assert.equal(adapter.diagnostics.reordered,1);
    await receive({...fixture,session_id:'new-session',sequence:0});
    await delay(220);
    assert.equal(adapter.status,'TELEMETRY_LOST');
    await receive({...fixture,sequence:2});
    assert.equal(adapter.status,'TELEMETRY_RECEIVED');
});

test('listener with no packets yet stays waiting instead of reporting lost telemetry', async t => {
    const {adapter} = await receiver(t,100);
    await delay(250);
    assert.equal(adapter.status,'UDP_LISTENER_ACTIVE');
});

test('simulator script output is accepted as aircraft telemetry (no fix, then fix)', async t => {
    const {adapter} = await receiver(t,2000);
    const port = adapter.udpSocket.address().port;
    const seen = [];
    adapter.on('telemetry', data => seen.push(data));
    const {spawn} = require('node:child_process');
    const simulator = spawn(process.execPath,[require('node:path').join(__dirname,'../../scripts/simulate_dji_stream.js'),'127.0.0.1',String(port)],{stdio:'ignore'});
    t.after(()=>simulator.kill());
    for (let i=0; i<100 && !seen.some(data=>data.position.valid); i++) await delay(100);
    assert.ok(seen.some(data=>data.position.valid),'simulator never reached a GPS fix');
    assert.equal(adapter.diagnostics.rejected,0);
    assert.ok(seen.some(data=>!data.position.valid));
    assert.equal(seen.at(-1).position.altitudeReference,'takeoff');
    assert.equal(seen.at(-1).status.synthetic,false);
});

test('malformed packets never emit telemetry or promote receiver state', async t => {
    const {adapter,send} = await receiver(t);
    let count=0; adapter.on('telemetry',()=>count++);
    for (const data of ['{bad', {...fixture,latitude:null},{...fixture,latitude:'28.6'},'x'.repeat(16385)]) await send(data);
    await delay(60);
    assert.equal(count,0);
    assert.equal(adapter.status,'UDP_LISTENER_ACTIVE');
    assert.equal(adapter.diagnostics.rejected,4);
});

test('no-fix and synthetic samples have distinct receiver states', async t => {
    const {adapter,receive}=await receiver(t);
    await receive({...fixture,position_valid:false,latitude:null,longitude:null,gps_satellites:0});
    assert.equal(adapter.status,'WAITING_FOR_GPS');
    const sample=await receive({...fixture,sequence:2,synthetic:true,drone_id:'SYNTHETIC_NETWORK_TEST'});
    assert.equal(sample.status.synthetic,true);
    assert.equal(adapter.status,'TEST_TELEMETRY_RECEIVED');
});

test('downstream exceptions are not swallowed as JSON parsing errors', async t => {
    const adapter=new DJIAdapter();
    t.after(()=>adapter.disconnect());
    await adapter.connect({host:'127.0.0.1',port:0});
    adapter.on('telemetry',()=>{throw new Error('consumer failure');});
    assert.throws(()=>adapter.udpSocket.emit('message',Buffer.from(JSON.stringify(fixture))),/consumer failure/);
    assert.equal(adapter.diagnostics.rejected,0);
});

test('failed bind cleans up and a subsequent connection succeeds', async t => {
    const first = new DJIAdapter(), second = new DJIAdapter();
    t.after(()=>{first.disconnect();second.disconnect();});
    await first.connect({host:'127.0.0.1',port:0});
    await assert.rejects(second.connect({host:'127.0.0.1',port:first.udpSocket.address().port}));
    assert.equal(second.udpSocket,null);
    first.disconnect();
    await second.connect({host:'127.0.0.1',port:0});
    assert.equal(second.status,'UDP_LISTENER_ACTIVE');
});

test('nullable display, takeoff labels and valid zero position',async()=>{
    const {formatNumber,hasPosition,altitudeLabel}=await import('../../client/src/telemetryDisplay.js');
    assert.equal(formatNumber(null),'--');
    assert.equal(formatNumber(0),'0.0');
    assert.equal(hasPosition({latitude:null,longitude:null}),false);
    assert.equal(hasPosition({latitude:0,longitude:0}),true);
    assert.equal(altitudeLabel({altitudeReference:'takeoff',relativeAltitude:40}),'40.0 m above takeoff');
});
