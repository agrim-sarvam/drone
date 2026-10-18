const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = process.env.SENTINEL_DATA_DIR || path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cop_database.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS flight_records (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    startTime INTEGER NOT NULL,
    endTime INTEGER
  );

  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_id TEXT,
    timestamp INTEGER NOT NULL,
    platform_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude_m REAL NOT NULL,
    relative_altitude_m REAL,
    heading_deg REAL,
    yaw_deg REAL,
    pitch_deg REAL,
    roll_deg REAL,
    speed_mps REAL,
    velocity_x_mps REAL,
    velocity_y_mps REAL,
    velocity_z_mps REAL,
    gps_satellites INTEGER,
    battery_percent INTEGER,
    flight_state TEXT,
    flying INTEGER
  );

  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mission_waypoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    missionId TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    gridReference TEXT,
    FOREIGN KEY(missionId) REFERENCES missions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS observations (
    id TEXT PRIMARY KEY,
    mission_id TEXT NOT NULL,
    platform_id TEXT,
    timestamp INTEGER NOT NULL,
    source TEXT,
    latitude REAL,
    longitude REAL,
    grid_reference TEXT,
    status TEXT,
    notes TEXT
  );
`);

// True SQLite Migration for existing databases
const tableInfo = db.pragma('table_info(telemetry)');
const columns = tableInfo.map(c => c.name);

if (columns.includes('flightId') && !columns.includes('flight_id')) {
    console.log("Migrating telemetry table to canonical snake_case schema...");
    const oldHeading = columns.includes('heading') ? 'heading' : 'NULL';
    
    db.exec(`
        BEGIN TRANSACTION;
        
        CREATE TABLE telemetry_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            flight_id TEXT,
            timestamp INTEGER NOT NULL,
            platform_id TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            altitude_m REAL NOT NULL,
            relative_altitude_m REAL,
            heading_deg REAL,
            yaw_deg REAL,
            pitch_deg REAL,
            roll_deg REAL,
            speed_mps REAL,
            velocity_x_mps REAL,
            velocity_y_mps REAL,
            velocity_z_mps REAL,
            gps_satellites INTEGER,
            battery_percent INTEGER,
            flight_state TEXT,
            flying INTEGER
        );
        
        INSERT INTO telemetry_new (
            id, flight_id, timestamp, platform_id, latitude, longitude, altitude_m, relative_altitude_m,
            heading_deg, yaw_deg, pitch_deg, roll_deg, speed_mps, velocity_x_mps, velocity_y_mps, velocity_z_mps,
            gps_satellites, battery_percent, flight_state, flying
        )
        SELECT 
            id, flightId, timestamp, platformId, latitude, longitude, altitude, relativeAltitude,
            ${oldHeading}, yaw, pitch, roll, groundSpeed, velocityX, velocityY, velocityZ,
            satellites, battery, flightState, flying
        FROM telemetry;
        
        DROP TABLE telemetry;
        ALTER TABLE telemetry_new RENAME TO telemetry;
        
        COMMIT;
    `);
    console.log("Migration complete.");
}

// V2 includes useful battery/status samples before GPS fix and does not invent MSL altitude.
// Rebuild once to remove the old NOT NULL constraints, preserving historical rows.
const canonical = db.pragma('table_info(telemetry)');
if (canonical.some(column => ['latitude', 'longitude', 'altitude_m'].includes(column.name) && column.notnull)) {
    const names = canonical.map(column => column.name);
    db.transaction(() => {
        db.exec(`CREATE TABLE telemetry_nullable (
            id INTEGER PRIMARY KEY AUTOINCREMENT, flight_id TEXT, timestamp INTEGER NOT NULL,
            platform_id TEXT NOT NULL, latitude REAL, longitude REAL, altitude_m REAL,
            relative_altitude_m REAL, heading_deg REAL, yaw_deg REAL, pitch_deg REAL, roll_deg REAL,
            speed_mps REAL, velocity_x_mps REAL, velocity_y_mps REAL, velocity_z_mps REAL,
            gps_satellites INTEGER, battery_percent INTEGER, flight_state TEXT, flying INTEGER
        )`);
        const fields = names.map(name => `"${name}"`).join(', ');
        db.exec(`INSERT INTO telemetry_nullable (${fields}) SELECT ${fields} FROM telemetry;
            DROP TABLE telemetry; ALTER TABLE telemetry_nullable RENAME TO telemetry;`);
    })();
}
const telemetryColumns = db.pragma('table_info(telemetry)').map(column => column.name);
if (!telemetryColumns.includes('position_valid')) db.exec('ALTER TABLE telemetry ADD COLUMN position_valid INTEGER');
if (!telemetryColumns.includes('synthetic')) db.exec('ALTER TABLE telemetry ADD COLUMN synthetic INTEGER NOT NULL DEFAULT 0');
if (!telemetryColumns.includes('altitude_reference')) db.exec("ALTER TABLE telemetry ADD COLUMN altitude_reference TEXT NOT NULL DEFAULT 'legacy-unspecified'");

module.exports = db;
