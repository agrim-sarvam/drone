import React, { useState, useEffect } from 'react';
import './styles/layout.css';
import OfflineMap from './components/Map/OfflineMap';
import SimulatorControls from './components/Telemetry/SimulatorControls';
import SensorFeed from './components/Video/SensorFeed';
import ReplayControls from './components/Replay/ReplayControls';
import MissionPanel from './components/Mission/MissionPanel';
import ConnectionManager from './components/Telemetry/ConnectionManager';
import { formatNumber, altitudeLabel } from './telemetryDisplay';

function App() {
  const [appMode, setAppMode] = useState('LIVE'); // LIVE, REPLAY, PLANNING, OBSERVE
  const [telemetryState, setTelemetryState] = useState(null);
  const [simStatus, setSimStatus] = useState('STOPPED');
  const [replayStatus, setReplayStatus] = useState('REPLAY_STOPPED');
  const [isRecording, setIsRecording] = useState(false);
  const [waypoints, setWaypoints] = useState([]);
  const [observations, setObservations] = useState([]);
  const [showLayersMenu, setShowLayersMenu] = useState(false);
  const [layers, setLayers] = useState({
    flightPath: true,
    observations: true,
    waypoints: true
  });
  const [showGrid, setShowGrid] = useState(false);

  const loadObservations = async () => {
    if (window.electronAPI) {
      const obs = await window.electronAPI.getObservations();
      setObservations(obs);
    }
  };

  useEffect(() => {
    loadObservations();
    if (window.electronAPI) {
      const stopTelemetry = window.electronAPI.onTelemetry((data) => {
        setTelemetryState(data);
      });
      const stopStatus = window.electronAPI.onSimulatorStatus(setSimStatus);
      return () => { stopTelemetry(); stopStatus(); };
    }
  }, []);

  const toggleRecording = async () => {
    if (!window.electronAPI) return;
    if (isRecording) {
      await window.electronAPI.stopRecording();
      setIsRecording(false);
    } else {
      await window.electronAPI.startRecording();
      setIsRecording(true);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <button 
          onClick={() => setAppMode('PLANNING')}
          style={appMode === 'PLANNING' ? { backgroundColor: 'rgba(237, 137, 54, 0.2)', color: '#ed8936', borderColor: '#ed8936' } : {}}
        >
          Mission
        </button>
        <button 
          onClick={() => setAppMode('OBSERVE')}
          style={appMode === 'OBSERVE' ? { backgroundColor: 'rgba(72, 187, 120, 0.2)', color: '#48bb78', borderColor: '#48bb78' } : {}}
        >
          Observe
        </button>
        <div style={{position: 'relative'}}>
          <button 
            onClick={() => setShowLayersMenu(!showLayersMenu)}
            style={showLayersMenu ? { backgroundColor: 'rgba(255, 255, 255, 0.1)' } : {}}
          >
            Layers
          </button>
          {showLayersMenu && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, backgroundColor: '#1a202c', 
              border: '1px solid #2d3748', padding: '10px', borderRadius: '4px', 
              zIndex: 1000, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={layers.flightPath} onChange={e => setLayers({...layers, flightPath: e.target.checked})} />
                Flight Path
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={layers.observations} onChange={e => setLayers({...layers, observations: e.target.checked})} />
                Observations
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={layers.waypoints} onChange={e => setLayers({...layers, waypoints: e.target.checked})} />
                Waypoints
              </label>
            </div>
          )}
        </div>
        <button 
          onClick={() => setShowGrid(!showGrid)}
          style={showGrid ? { backgroundColor: 'rgba(99, 179, 237, 0.2)', color: '#63b3ed', borderColor: '#63b3ed' } : {}}
        >
          Grid
        </button>
        <button 
          onClick={toggleRecording}
          disabled={appMode !== 'LIVE'}
          style={isRecording ? { backgroundColor: 'rgba(245, 101, 101, 0.2)', color: '#fc8181', borderColor: '#fc8181' } : {}}
        >
          {isRecording ? 'Recording (REC)' : 'Record'}
        </button>
        <button 
          onClick={() => setAppMode('REPLAY')}
          style={appMode === 'REPLAY' ? { backgroundColor: 'rgba(99, 179, 237, 0.2)', color: '#63b3ed', borderColor: '#63b3ed' } : {}}
        >
          Replay
        </button>
        <button onClick={async () => {
          const id = prompt('Enter Mission ID to export (e.g. m-123):');
          if(id && window.electronAPI) {
              const res = await window.electronAPI.exportMission(id, 'JSON');
              if(res && res.success) alert(`Exported to ${res.filePath}`);
              else if(res && res.error) alert(`Error: ${res.error}`);
          }
        }}>Export JSON</button>
        <button onClick={async () => {
          const id = prompt('Enter Mission ID to export (e.g. m-123):');
          if(id && window.electronAPI) {
              const res = await window.electronAPI.exportMission(id, 'CSV');
              if(res && res.success) alert(`Exported CSVs to ${res.filePath}`);
              else if(res && res.error) alert(`Error: ${res.error}`);
          }
        }}>Export CSV</button>
      </header>

      <main className="app-main">
        <aside className="panel platform-panel">
          <h2>Platform Panel</h2>
          <div className="panel-content">
            <ConnectionManager clearTelemetry={() => setTelemetryState(null)} status={simStatus} />
            
            <div className="platform-stats">
              <p>Listener: {
                ['UDP_LISTENER_ACTIVE', 'TELEMETRY_RECEIVED', 'TEST_TELEMETRY_RECEIVED', 'WAITING_FOR_GPS', 'TELEMETRY_LOST'].includes(simStatus) ? 'ACTIVE' :
                simStatus === 'DISCONNECTED' || simStatus === 'STOPPED' ? 'INACTIVE' : 
                simStatus === 'ERROR' ? 'ERROR' : 'UNKNOWN'
              }</p>
              <p>Telemetry: {
                simStatus === 'UDP_LISTENER_ACTIVE' ? 'WAITING FOR TELEMETRY' :
                simStatus === 'TELEMETRY_RECEIVED' ? 'RECEIVED' :
                simStatus === 'TEST_TELEMETRY_RECEIVED' ? 'SYNTHETIC NETWORK TEST (not aircraft data)' :
                simStatus === 'WAITING_FOR_GPS' ? 'RECEIVING, WAITING FOR GPS FIX' :
                simStatus === 'TELEMETRY_LOST' ? 'LOST' :
                simStatus === 'RUNNING' ? 'SIMULATOR ACTIVE' :
                (simStatus === 'MAVLINK_ACTIVE' || simStatus === 'MAVLINK_CONNECTED') ? 'WAITING FOR MAVLINK' : 
                simStatus === 'ERROR' ? 'ERROR' : 'OFFLINE'
              }</p>
              <p>Lat: {formatNumber(telemetryState?.position?.latitude, 6)}</p>
              <p>Lon: {formatNumber(telemetryState?.position?.longitude, 6)}</p>
              <p>Altitude: {altitudeLabel(telemetryState?.position)}</p>
              {simStatus === 'TELEMETRY_LOST' && <p role="alert">STALE DATA — last received position shown.</p>}
              {telemetryState?.status?.synthetic && <p role="alert">SYNTHETIC TEST DATA</p>}
              <p>Grid (ESM): {telemetryState?.position?.gridReference || '--'}</p>
            </div>
          </div>
        </aside>

        <section className="panel map-area">
          <OfflineMap 
            telemetry={telemetryState} 
            appMode={appMode}
            waypoints={waypoints}
            setWaypoints={setWaypoints}
            observations={observations}
            loadObservations={loadObservations}
            layers={layers}
            showGrid={showGrid}
          />
        </section>

        <aside className="panel video-area">
          <h2>Sensor Video</h2>
          <SensorFeed telemetry={telemetryState} />
        </aside>

        <section className="panel telemetry-area">
          <h2>
            {appMode === 'LIVE' ? 'Telemetry Data' : 
             appMode === 'REPLAY' ? 'Replay Controls' : 'Mission Planning'}
          </h2>
          <div className="panel-content">
            {appMode === 'LIVE' && (
                <SimulatorControls 
                  onTelemetryUpdate={setTelemetryState} 
                  onStatusUpdate={setSimStatus}
                  setWaypoints={setWaypoints} 
                />
            )}
            {appMode === 'REPLAY' && (
                <ReplayControls 
                  onReplayStatusUpdate={setReplayStatus}
                  onModeChange={setAppMode}
                />
            )}
            {appMode === 'PLANNING' && (
                <MissionPanel 
                  waypoints={waypoints}
                  setWaypoints={setWaypoints}
                  onModeChange={setAppMode}
                />
            )}
          </div>
        </section>

        <section className="panel observation-area">
          <h2>Observations & Events</h2>
          <ul>
            {observations.map(obs => (
                <li key={obs.id}>[{new Date(obs.timestamp).toLocaleTimeString()}] Obs: {obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)} ({obs.status})</li>
            ))}
            <li>Application Started</li>
            <li>Database Initialized</li>
            {simStatus === 'RUNNING' && <li>Simulator Started</li>}
          </ul>
        </section>
      </main>

      <footer className="app-footer">
        <div className="status-indicator">
          <div className="status-dot"></div>
          <span>System: OK</span>
        </div>
        <div className="status-indicator">
          <div className={`status-dot ${isRecording ? '' : 'warning'}`}></div>
          <span>Database: {isRecording ? 'Recording...' : 'Connected (Idle)'}</span>
        </div>
        <div className="status-indicator">
          <div className="status-dot error"></div>
          <span>Video: None</span>
        </div>
        <div className="status-indicator">
          <div className={`status-dot ${simStatus === 'TELEMETRY_LOST' ? 'error' : (simStatus === 'RUNNING' || telemetryState || (simStatus && (simStatus.startsWith('MAVLINK') || simStatus.startsWith('DJI') || simStatus === 'TELEMETRY_RESTORED'))) ? '' : 'error'}`}></div>
          <span>Telemetry: {
            simStatus === 'RUNNING' ? 'Connected (SIM)' : 
            simStatus === 'TELEMETRY_LOST' ? 'Lost (Timeout)' :
            simStatus === 'WAITING_FOR_GPS' ? 'Receiving (Awaiting GPS)' :
            simStatus === 'TEST_TELEMETRY_RECEIVED' ? 'Synthetic network test' :
            (telemetryState ? 'Connected (Hardware)' : 
            (simStatus && (simStatus.startsWith('MAVLINK') || simStatus.startsWith('DJI') || simStatus === 'TELEMETRY_RESTORED') ? 'Connected (Awaiting GPS)' : 'Disconnected'))
          }</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
