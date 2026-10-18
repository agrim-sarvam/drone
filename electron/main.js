const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
if (process.env.SENTINEL_USER_DATA_DIR) app.setPath('userData', process.env.SENTINEL_USER_DATA_DIR);
// Installed applications cannot write their SQLite database inside app.asar.
process.env.SENTINEL_DATA_DIR = path.join(app.getPath('userData'), 'data');
if (!app.isPackaged) require('../core/storage/migrateLegacyData')(path.join(__dirname, '../data'), process.env.SENTINEL_DATA_DIR);
const mbtilesServer = require('../core/map/MbtilesServer');

// Register custom protocol for maps
protocol.registerSchemesAsPrivileged([
  { scheme: 'maptile', privileges: { bypassCSP: true, secure: true, standard: true } }
]);

// Determine if we are running in development mode
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // In development, Vite runs on port 5173 by default
    mainWindow.loadURL('http://localhost:5173');
    // Open the DevTools.
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app
    mainWindow.loadFile(path.join(__dirname, '../client/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  protocol.handle('maptile', (request) => {
    try {
      const url = new URL(request.url);
      const parts = url.pathname.split('/');
      // Expected path: /z/x/y.png or /z/x/y
      const z = parseInt(parts[1]);
      const x = parseInt(parts[2]);
      const y = parseInt(parts[3] ? parts[3].replace('.png', '').replace('.jpg', '') : 0);

      const tileData = mbtilesServer.getTile(z, x, y);
      
      if (tileData) {
        return new Response(tileData, {
          headers: { 'Content-Type': 'image/png' }
        });
      }
      
      // Return a transparent 1x1 image if tile not found to prevent Leaflet missing-tile icons
      const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      return new Response(transparentPixel, {
        headers: { 'Content-Type': 'image/png' }
      });
    } catch (err) {
      console.error("Failed to handle maptile request:", err);
      return new Response(null, { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const simulator = require('../adapters/simulator/SimulatorAdapter');
const logger = require('../adapters/storage/TelemetryLogger');

// Example IPC communication
ipcMain.handle('ping', () => 'pong');

const mavlink = require('../adapters/mavlink/MAVLinkAdapter');
const dji = require('../adapters/dji/DJIAdapter');
let currentTelemetrySource = simulator;

function attachTelemetrySource(source) {
  if (currentTelemetrySource) {
    currentTelemetrySource.removeAllListeners('telemetry');
    currentTelemetrySource.removeAllListeners('status');
  }
  
  currentTelemetrySource = source;

  currentTelemetrySource.on('telemetry', (data) => {
    logger.logTelemetry(data);
    if (mainWindow) {
      mainWindow.webContents.send('simulator:telemetry', data); // Keep IPC name for UI compatibility
    }
  });

  currentTelemetrySource.on('status', (status) => {
    if (mainWindow) {
      mainWindow.webContents.send('simulator:status', status);
    }
  });
}

// Initial attachment
attachTelemetrySource(simulator);

// Simulator IPCs
ipcMain.handle('simulator:start', () => {
  console.log('IPC Received: simulator:start');
  if (currentTelemetrySource === simulator) simulator.start();
});
ipcMain.handle('simulator:pause', () => {
  console.log('IPC Received: simulator:pause');
  if (currentTelemetrySource === simulator) simulator.pause();
});
ipcMain.handle('simulator:reset', () => {
  console.log('IPC Received: simulator:reset');
  if (currentTelemetrySource === simulator) simulator.reset();
});
ipcMain.handle('simulator:setSpeed', (event, speed) => {
  if (currentTelemetrySource === simulator) simulator.setSpeed(speed);
});
ipcMain.handle('simulator:loadMission', async (event, missionId) => {
  const waypoints = missionManager.getMissionWaypoints(missionId);
  if (waypoints && waypoints.length > 0) {
    simulator.loadWaypoints(waypoints);
    return waypoints;
  }
  return false;
});

// MAVLink IPCs
ipcMain.handle('mavlink:connect', async (event, config) => {
  attachTelemetrySource(mavlink);
  simulator.reset();
  try {
      await mavlink.connect(config);
      return { success: true };
  } catch (err) {
      return { success: false, error: err.message };
  }
});
ipcMain.handle('mavlink:disconnect', () => {
  mavlink.disconnect();
  attachTelemetrySource(simulator);
  return true;
});

// DJI IPCs
ipcMain.handle('dji:connect', async (event, config) => {
  attachTelemetrySource(dji);
  simulator.reset();
  try {
      await dji.connect(config);
      return { success: true };
  } catch (err) {
      return { success: false, error: err.message };
  }
});
ipcMain.handle('dji:disconnect', () => {
  dji.disconnect();
  attachTelemetrySource(simulator);
  return true;
});
ipcMain.handle('dji:diagnostics', () => dji.getDiagnostics());
// The phone needs the laptop's LAN address; listing it avoids gateway/VPN/loopback mistakes during setup.
ipcMain.handle('network:addresses', () => Object.entries(require('os').networkInterfaces())
  .flatMap(([name, entries]) => (entries || [])
    .filter(entry => entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
    .map(entry => ({ name, address: entry.address }))));

// Recording IPCs
ipcMain.handle('record:start', () => {
  logger.startRecording();
  return true;
});
ipcMain.handle('record:stop', () => {
  logger.stopRecording();
  return false;
});
const replayEngine = require('../core/replay/ReplayEngine');
const replayRepo = require('../core/replay/ReplayRepository');

// Replay IPCs
ipcMain.handle('replay:getFlights', () => replayRepo.getFlights());
ipcMain.handle('replay:load', (event, flightId) => replayEngine.loadFlight(flightId));
ipcMain.handle('replay:play', () => replayEngine.play());
ipcMain.handle('replay:pause', () => replayEngine.pause());
ipcMain.handle('replay:stop', () => replayEngine.stop());
ipcMain.handle('replay:setSpeed', (event, speed) => replayEngine.setSpeed(speed));
ipcMain.handle('replay:seek', (event, timestamp) => replayEngine.seek(timestamp));

const missionManager = require('../core/mission/MissionManager');

// Mission IPCs
ipcMain.handle('mission:save', (event, { name, waypoints }) => missionManager.saveMission(name, waypoints));
ipcMain.handle('mission:getAll', () => missionManager.getMissions());
ipcMain.handle('mission:getWaypoints', (event, missionId) => missionManager.getMissionWaypoints(missionId));

const observationManager = require('../core/observations/ObservationManager');

// Observation IPCs
ipcMain.handle('observations:save', (event, data) => observationManager.saveObservation(data));
ipcMain.handle('observations:getAll', () => observationManager.getObservations());

// Forward replay events to renderer
replayEngine.on('telemetry', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('replay:telemetry', data);
  }
});
replayEngine.on('status', (status) => {
  if (mainWindow) {
    mainWindow.webContents.send('replay:status', status);
  }
});

// Export IPCs
const dataExporter = require('../core/export/DataExporter');
const { dialog } = require('electron');

ipcMain.handle('export:mission', async (event, { missionId, format }) => {
  if (!missionId) return { success: false, error: 'No mission selected' };

  if (format === 'JSON') {
      const { canceled, filePath } = await dialog.showSaveDialog({
          title: 'Export Mission Data',
          defaultPath: `mission_${missionId}.json`,
          filters: [{ name: 'JSON', extensions: ['json'] }]
      });
      if (canceled) return { success: false, canceled: true };
      
      await dataExporter.exportMissionJSON(missionId, filePath);
      return { success: true, filePath };
  } else if (format === 'CSV') {
      const { canceled, filePaths } = await dialog.showOpenDialog({
          title: 'Select Export Directory for CSVs',
          properties: ['openDirectory']
      });
      if (canceled || filePaths.length === 0) return { success: false, canceled: true };
      
      await dataExporter.exportMissionCSV(missionId, filePaths[0]);
      return { success: true, filePath: filePaths[0] };
  }
});
