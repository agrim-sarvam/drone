const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const fixture = require('../tests/fixtures/dji-v2.json');
(async()=>{
 const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'sentinel-ui-'));
 const sender = dgram.createSocket('udp4');
 await new Promise(resolve=>sender.bind(0,'127.0.0.1',resolve));
 const port = sender.address().port;
 sender.close();
 const transmitter = dgram.createSocket('udp4');
 const packaged = process.env.SENTINEL_DESKTOP_EXECUTABLE;
 const app = await electron.launch({args:packaged ? [] : ['.'], ...(packaged ? {executablePath:path.resolve(packaged)} : {}),
  cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'production',SENTINEL_USER_DATA_DIR:temporary},timeout:30000});
 const errors=[];
 try {
  const page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.getByRole('button',{name:'Connect to Drone',exact:true}).waitFor();
  await page.locator('.local-addresses').filter({hasText:'Enter on phone:'}).waitFor();
  const settings=page.locator('.connection-settings');
  await settings.locator('input[type=text]').fill('127.0.0.1');
  await settings.locator('input[type=number]').nth(0).fill(String(port));
  await settings.locator('input[type=number]').nth(1).fill('500');
  await page.getByRole('button',{name:'Connect to Drone',exact:true}).click();
  await page.getByText('Telemetry: WAITING FOR TELEMETRY',{exact:true}).waitFor();
  // Live view from the phone arrives on the telemetry port + 1 as one JPEG per datagram.
  const jpeg = Buffer.from(await page.evaluate(() => {
   const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 360;
   const ctx = canvas.getContext('2d'); ctx.fillStyle = '#3a7'; ctx.fillRect(0, 0, 640, 360);
   return canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
  }), 'base64');
  await new Promise((resolve,reject)=>transmitter.send(jpeg,port+1,'127.0.0.1',e=>e?reject(e):resolve()));
  await page.getByText('LIVE — DJI camera via phone',{exact:true}).waitFor();
  await page.locator('img.sensor-live-frame').waitFor();
  await page.getByText('VIDEO LOST — showing demo clip',{exact:true}).waitFor({timeout:5000});
  const send=packet=>new Promise((resolve,reject)=>transmitter.send(Buffer.from(JSON.stringify(packet)),port,'127.0.0.1',e=>e?reject(e):resolve()));
  await page.getByRole('button',{name:'Record',exact:true}).click();
  await send({...fixture,timestamp:Date.now()});
  await page.getByText('Telemetry: RECEIVED',{exact:true}).waitFor();
  await page.getByText('Altitude: 40.0 m above takeoff',{exact:true}).waitFor();
  assert.equal(await page.locator('.drone-marker').count(),1);
  await send({...fixture,timestamp:Date.now(),sequence:2,position_valid:false,latitude:null,longitude:null,gps_satellites:0});
  await page.getByText('Telemetry: RECEIVING, WAITING FOR GPS FIX',{exact:true}).waitFor();
  assert.equal(await page.locator('.drone-marker').count(),0);
  await page.getByText('Lat: --',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Recording (REC)',exact:true}).click();
  await send({...fixture,timestamp:Date.now(),sequence:3,synthetic:true,drone_id:'SYNTHETIC_NETWORK_TEST'});
  await page.getByText('SYNTHETIC TEST DATA',{exact:true}).waitFor();
  await page.getByText('STALE DATA — last received position shown.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Disconnect Drone',exact:true}).click();
  await page.getByRole('button',{name:'Replay',exact:true}).click();
  await page.locator('.flight-selector select').selectOption({index:1});
  await page.getByRole('button',{name:'Load',exact:true}).click();
  await page.getByText('Altitude: 40.0 m above takeoff',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Exit to Live',exact:true}).click();
  assert.deepEqual(errors,[],'Renderer exceptions');
  fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
  await page.screenshot({path:path.join(__dirname,'../test-results/desktop-smoke.png'),fullPage:true});
  console.log('PASS: real Electron app → IPC listener → UDP → GPS/no-fix/test/stale UI → SQLite recording → replay. No renderer exceptions.');
 } finally {
  transmitter.close(); await app.close();
  assert.ok(fs.realpathSync(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep + 'sentinel-ui-'));
  fs.rmSync(temporary,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
