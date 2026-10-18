import React, { useState, useEffect } from 'react';
import './ReplayControls.css';

const ReplayControls = ({ onReplayStatusUpdate, onModeChange }) => {
    const [flights, setFlights] = useState([]);
    const [selectedFlight, setSelectedFlight] = useState('');
    const [playbackStatus, setPlaybackStatus] = useState('REPLAY_STOPPED');
    const [speed, setSpeed] = useState(1.0);

    // Fetch flights on mount
    useEffect(() => {
        const fetchFlights = async () => {
            if (window.electronAPI) {
                const records = await window.electronAPI.getFlights();
                setFlights(records);
            }
        };
        fetchFlights();

        if (window.electronAPI) {
            return window.electronAPI.onReplayStatus((status) => {
                setPlaybackStatus(status);
                onReplayStatusUpdate(status);
            });
        }
    }, [onReplayStatusUpdate]);

    const handleLoad = async () => {
        if (!selectedFlight) return;
        await window.electronAPI.loadReplay(selectedFlight);
    };

    const handlePlay = () => window.electronAPI.playReplay();
    const handlePause = () => window.electronAPI.pauseReplay();
    const handleStop = () => window.electronAPI.stopReplay();
    
    const handleSpeed = async (e) => {
        const val = parseFloat(e.target.value);
        setSpeed(val);
        await window.electronAPI.setReplaySpeed(val);
    };

    return (
        <div className="replay-controls">
            <div className="replay-header">
                <h3>REPLAY MODE</h3>
                <button className="exit-btn" onClick={() => onModeChange('LIVE')}>Exit to Live</button>
            </div>
            
            <div className="flight-selector">
                <select value={selectedFlight} onChange={(e) => setSelectedFlight(e.target.value)}>
                    <option value="">-- Select Recorded Flight --</option>
                    {flights.map(f => (
                        <option key={f.id} value={f.id}>
                            {f.name} ({new Date(f.startTime).toLocaleString()})
                        </option>
                    ))}
                </select>
                <button onClick={handleLoad} disabled={!selectedFlight}>Load</button>
            </div>

            <div className="playback-controls">
                <button onClick={handlePlay} disabled={playbackStatus === 'REPLAY_PLAYING'}>Play</button>
                <button onClick={handlePause} disabled={playbackStatus !== 'REPLAY_PLAYING'}>Pause</button>
                <button onClick={handleStop}>Stop</button>
                
                <div className="speed-control">
                    <label>Speed: {speed}x</label>
                    <select value={speed} onChange={handleSpeed}>
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="1">1x</option>
                        <option value="2">2x</option>
                        <option value="4">4x</option>
                        <option value="8">8x</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default ReplayControls;
