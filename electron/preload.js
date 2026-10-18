const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electronAPI',
  {
    ping: () => ipcRenderer.invoke('ping'),
    
    // Simulator
    startSimulator: () => ipcRenderer.invoke('simulator:start'),
    pauseSimulator: () => ipcRenderer.invoke('simulator:pause'),
    resetSimulator: () => ipcRenderer.invoke('simulator:reset'),
    setSimulatorSpeed: (speed) => ipcRenderer.invoke('simulator:setSpeed', speed),
    loadMissionToSimulator: (missionId) => ipcRenderer.invoke('simulator:loadMission', missionId),
    
    // Recording
    startRecording: () => ipcRenderer.invoke('record:start'),
    stopRecording: () => ipcRenderer.invoke('record:stop'),
    
    // Replay
    getFlights: () => ipcRenderer.invoke('replay:getFlights'),
    loadReplay: (flightId) => ipcRenderer.invoke('replay:load', flightId),
    playReplay: () => ipcRenderer.invoke('replay:play'),
    pauseReplay: () => ipcRenderer.invoke('replay:pause'),
    stopReplay: () => ipcRenderer.invoke('replay:stop'),
    setReplaySpeed: (speed) => ipcRenderer.invoke('replay:setSpeed', speed),
    seekReplay: (timestamp) => ipcRenderer.invoke('replay:seek', timestamp),

    // MAVLink
    connectMavlink: (config) => ipcRenderer.invoke('mavlink:connect', config),
    disconnectMavlink: () => ipcRenderer.invoke('mavlink:disconnect'),

    // DJI
    connectDJI: (config) => ipcRenderer.invoke('dji:connect', config),
    disconnectDJI: () => ipcRenderer.invoke('dji:disconnect'),
    getDJIDiagnostics: () => ipcRenderer.invoke('dji:diagnostics'),

    // Mission
    saveMission: (name, waypoints) => ipcRenderer.invoke('mission:save', { name, waypoints }),
    getMissions: () => ipcRenderer.invoke('mission:getAll'),
    getMissionWaypoints: (missionId) => ipcRenderer.invoke('mission:getWaypoints', missionId),

    // Observations
    saveObservation: (data) => ipcRenderer.invoke('observations:save', data),
    getObservations: () => ipcRenderer.invoke('observations:getAll'),

    // Export
    exportMission: (missionId, format) => ipcRenderer.invoke('export:mission', { missionId, format }),

    // Event listeners
    onTelemetry: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on('simulator:telemetry', listener);
        ipcRenderer.on('replay:telemetry', listener);
        return () => { ipcRenderer.removeListener('simulator:telemetry', listener); ipcRenderer.removeListener('replay:telemetry', listener); };
    },
    onSimulatorStatus: (callback) => {
        const listener = (_event, status) => callback(status);
        ipcRenderer.on('simulator:status', listener);
        return () => ipcRenderer.removeListener('simulator:status', listener);
    },
    onReplayStatus: (callback) => {
        const listener = (_event, status) => callback(status);
        ipcRenderer.on('replay:status', listener);
        return () => ipcRenderer.removeListener('replay:status', listener);
    },
  }
);
