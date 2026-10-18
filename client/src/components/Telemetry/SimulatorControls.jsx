import React, { useState, useEffect } from 'react';
import './SimulatorControls.css';

const SimulatorControls = ({ onTelemetryUpdate, onStatusUpdate, setWaypoints }) => {
    const [status, setStatus] = useState('STOPPED');
    const [speed, setSpeed] = useState(1.0);
    const [source, setSource] = useState('SIMULATOR');
    const [missions, setMissions] = useState([]);
    const [selectedMission, setSelectedMission] = useState('');

    useEffect(() => {
        if (window.electronAPI) {
            const stopTelemetry = window.electronAPI.onTelemetry((data) => {
                if (onTelemetryUpdate) onTelemetryUpdate(data);
            });

            const stopStatus = window.electronAPI.onSimulatorStatus((newStatus) => {
                setStatus(newStatus);
                if (onStatusUpdate) onStatusUpdate(newStatus);
            });
            
            // Load saved missions for Execution Mode
            window.electronAPI.getMissions().then(setMissions).catch(console.error);
            return () => { stopTelemetry(); stopStatus(); };
        }
    }, [onTelemetryUpdate, onStatusUpdate]);

    const handleStart = () => {
        if (window.electronAPI) window.electronAPI.startSimulator();
    };

    const handlePause = () => {
        if (window.electronAPI) window.electronAPI.pauseSimulator();
    };

    const handleReset = () => {
        if (window.electronAPI) {
            window.electronAPI.resetSimulator();
            if (setWaypoints) setWaypoints([]); // Clear mission route from map
            setSelectedMission('');
        }
    };

    const handleConnectMavlink = () => {
        if (window.electronAPI) {
            window.electronAPI.connectMavlink();
            setSource('MAVLINK');
        }
    };

    const handleDisconnectMavlink = () => {
        if (window.electronAPI) {
            window.electronAPI.disconnectMavlink();
            setSource('SIMULATOR');
        }
    };

    const handleSpeedChange = (e) => {
        setSpeed(parseFloat(e.target.value));
    };

    const handleSpeedCommit = (e) => {
        const newSpeed = parseFloat(e.target.value);
        if (window.electronAPI) window.electronAPI.setSimulatorSpeed(newSpeed);
    };

    const handleLoadMission = async () => {
        if (window.electronAPI && selectedMission) {
            const waypoints = await window.electronAPI.loadMissionToSimulator(selectedMission);
            if (waypoints && setWaypoints) {
                setWaypoints(waypoints); // This makes OfflineMap draw the loaded route!
                alert('Mission loaded into simulator successfully! Hit Start to fly it.');
            } else {
                alert('Failed to load mission.');
            }
        }
    };

    return (
        <div className="simulator-controls">
            <div className="controls-header">
                <h3>Simulator Controls</h3>
                <span className={`status-badge ${status.toLowerCase()}`}>{status}</span>
            </div>
            
            <div className="button-group">
                <button onClick={handleStart} disabled={status === 'RUNNING'} className="btn-start">Start</button>
                <button onClick={handlePause} disabled={status !== 'RUNNING'} className="btn-pause">Pause</button>
                <button onClick={handleReset} className="btn-reset">Reset</button>
            </div>

            <div className="execution-mode" style={{marginTop: '10px', display: 'flex', gap: '8px'}}>
                <select 
                    style={{flex: 1, padding: '4px', background: '#0d0f14', color: '#fff', border: '1px solid #4a5568'}}
                    value={selectedMission} 
                    onChange={(e) => setSelectedMission(e.target.value)}
                >
                    <option value="">-- Select Mission to Execute --</option>
                    {missions.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>
                <button 
                    style={{padding: '4px 12px', background: 'rgba(99, 179, 237, 0.2)', border: '1px solid #63b3ed', color: '#63b3ed'}}
                    disabled={!selectedMission || status === 'RUNNING'}
                    onClick={handleLoadMission}
                >
                    Load
                </button>
            </div>

            <div className="speed-control">
                <label>Playback Speed: {speed.toFixed(1)}x</label>
                <input 
                    type="range" min="0.1" max="5.0" step="0.1" 
                    value={speed} onChange={handleSpeedChange} 
                    onMouseUp={handleSpeedCommit} onTouchEnd={handleSpeedCommit}
                />
            </div>
        </div>
    );
};

export default SimulatorControls;
