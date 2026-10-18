const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

test('SQLite nullable migration preserves legacy rows and V2 no-fix / takeoff samples roundtrip',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sentinel-storage-'));
 const script=`
 const assert=require('node:assert/strict');
 const Database=require('better-sqlite3');
 const path=require('node:path');
 const dbPath=path.join(process.env.SENTINEL_DATA_DIR,'cop_database.sqlite');
 const seed=new Database(dbPath);
 seed.exec('CREATE TABLE telemetry (id INTEGER PRIMARY KEY AUTOINCREMENT, flight_id TEXT, timestamp INTEGER NOT NULL, platform_id TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, altitude_m REAL NOT NULL, relative_altitude_m REAL, heading_deg REAL, yaw_deg REAL, pitch_deg REAL, roll_deg REAL, speed_mps REAL, velocity_x_mps REAL, velocity_y_mps REAL, velocity_z_mps REAL, gps_satellites INTEGER, battery_percent INTEGER, flight_state TEXT, flying INTEGER)');
 seed.prepare('INSERT INTO telemetry (flight_id,timestamp,platform_id,latitude,longitude,altitude_m) VALUES (?,?,?,?,?,?)').run('old',1,'legacy',1,2,3);
 seed.close();
 const db=require('./database');
 assert.equal(db.prepare('SELECT altitude_m FROM telemetry WHERE flight_id=?').get('old').altitude_m,3);
 const logger=require('./adapters/storage/TelemetryLogger');
 const {normalizePacket}=require('./adapters/dji/DJIAdapter');
 const fixture=require('./tests/fixtures/dji-v2.json');
 const replay=require('./core/replay/ReplayEngine');
 logger.startRecording(); const id=logger.currentFlightId;
 logger.logTelemetry(normalizePacket({...fixture,position_valid:false,latitude:null,longitude:null}));
 logger.logTelemetry(normalizePacket({...fixture,sequence:2,synthetic:true}));
 logger.stopRecording();
 const rows=db.prepare('SELECT * FROM telemetry WHERE flight_id=? ORDER BY id').all(id);
 assert.equal(rows.length,2); assert.equal(rows[0].latitude,null); assert.equal(rows[0].altitude_m,null);
 assert.equal(rows[0].relative_altitude_m,40); assert.equal(rows[0].position_valid,0);
 let sample; replay.on('telemetry',d=>sample=d); replay.loadFlight(id);
 assert.equal(sample.position.valid,false); assert.equal(sample.position.altitudeReference,'takeoff');
 replay.seek(fixture.timestamp+1); assert.equal(sample.status.synthetic,true);
 assert.equal(sample.position.relativeAltitude,40); db.close();
 `;
 try{
  const result=spawnSync(process.execPath,['-e',script],{cwd:path.join(__dirname,'../..'),env:{...process.env,SENTINEL_DATA_DIR:dir},encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 } finally{assert.ok(fs.realpathSync(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'sentinel-storage-'));fs.rmSync(dir,{recursive:true,force:true});}
});

test('source data relocation preserves flights/WAL/maps and never overwrites user data',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'sentinel-migration-'));
 try {
  const old=path.join(root,'old'), next=path.join(root,'new'); fs.mkdirSync(old);
  for(const file of ['cop_database.sqlite','cop_database.sqlite-wal','map.mbtiles']) fs.writeFileSync(path.join(old,file),'legacy-'+file);
  const migrate=require('../../core/storage/migrateLegacyData'); migrate(old,next);
  assert.equal(fs.readFileSync(path.join(next,'cop_database.sqlite'),'utf8'),'legacy-cop_database.sqlite');
  assert.equal(fs.readFileSync(path.join(next,'cop_database.sqlite-wal'),'utf8'),'legacy-cop_database.sqlite-wal');
  fs.writeFileSync(path.join(next,'map.mbtiles'),'new-map'); migrate(old,next);
  assert.equal(fs.readFileSync(path.join(next,'map.mbtiles'),'utf8'),'new-map');
  assert.ok(fs.existsSync(path.join(old,'cop_database.sqlite')));
 } finally { assert.ok(fs.realpathSync(root).startsWith(path.resolve(os.tmpdir())+path.sep+'sentinel-migration-')); fs.rmSync(root,{recursive:true,force:true}); }
});
