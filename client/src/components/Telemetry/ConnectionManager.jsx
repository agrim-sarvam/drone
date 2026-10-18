import React, { useState, useEffect } from 'react';
import './ConnectionManager.css';

const ConnectionManager = ({ clearTelemetry, status }) => {
    const [connectionType, setConnectionType] = useState('DJI_JSON');
    const [udpHost, setUdpHost] = useState('0.0.0.0');
    const [udpPort, setUdpPort] = useState(14550);
    const [timeoutMs, setTimeoutMs] = useState(3000);
    const [serialPort, setSerialPort] = useState('/dev/ttyUSB0');
    const [baudRate, setBaudRate] = useState(57600);
    const [legacyConnected, setIsConnected] = useState(false);
    const isConnected = connectionType === 'DJI_JSON'
        ? ['UDP_LISTENER_ACTIVE', 'TELEMETRY_RECEIVED', 'TEST_TELEMETRY_RECEIVED', 'WAITING_FOR_GPS', 'TELEMETRY_LOST'].includes(status)
        : legacyConnected;
    const [diagnostics, setDiagnostics] = useState(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!isConnected || connectionType !== 'DJI_JSON' || !window.electronAPI?.getDJIDiagnostics) return;
        let active = true;
        const refresh = () => window.electronAPI.getDJIDiagnostics().then(value => { if (active) setDiagnostics(value); }).catch(() => {});
        refresh();
        const timer = setInterval(refresh, 1000);
        return () => { active = false; clearInterval(timer); };
    }, [isConnected, connectionType]);

    const handleConnectToggle = async () => {
        if (!window.electronAPI) return;
        if (busy) return;
        if (!isConnected && (connectionType === 'DJI_JSON' || connectionType === 'MAVLINK_UDP')
            && (!Number.isInteger(udpPort) || udpPort < 1 || udpPort > 65535)) {
            alert('Port must be from 1 to 65535.'); return;
        }
        setBusy(true);
        try {

        if (isConnected) {
            if (connectionType === 'DJI_JSON') {
                await window.electronAPI.disconnectDJI();
            } else {
                await window.electronAPI.disconnectMavlink();
            }
            setIsConnected(false);
            if (clearTelemetry) clearTelemetry();
        } else {
            if (clearTelemetry) clearTelemetry();
            const config = { type: connectionType };
            let success = false;
            
            try {
                if (connectionType === 'MAVLINK_UDP' || connectionType === 'UDP') {
                    config.host = udpHost;
                    config.port = udpPort;
                    const res = await window.electronAPI.connectMavlink(config);
                    success = res && res.success;
                    if (!success && res && res.error) {
                        alert("MAVLink Connection Error: " + res.error);
                    }
                } else if (connectionType === 'DJI_JSON') {
                    config.host = udpHost;
                    config.port = udpPort;
                    config.timeout = timeoutMs;
                    const res = await window.electronAPI.connectDJI(config);
                    success = res && res.success;
                    if (!success && res && res.error) {
                        alert("DJI Connection Error: " + res.error);
                    }
                } else {
                    config.path = serialPort;
                    config.baudRate = baudRate;
                    const res = await window.electronAPI.connectMavlink(config);
                    success = res && res.success;
                    if (!success && res && res.error) {
                        alert("Serial Connection Error: " + res.error);
                    }
                }
            } catch (err) {
                console.error("Connection failed:", err);
                alert("Connection failed: " + err.message);
                success = false;
            }
            
            if (success) {
                setIsConnected(true);
            }
        }
        } finally { setBusy(false); }
    };

    return (
        <div className="connection-manager">
            <h3>Hardware Connection</h3>
            <p>Listener IP is the laptop bind address. Use 0.0.0.0 here; enter the laptop's Wi-Fi IPv4 address on the phone.</p>
            
            <div className="connection-type-selector">
                <label>
                    <input 
                        type="radio" 
                        name="connType" 
                        value="MAVLINK_UDP" 
                        checked={connectionType === 'MAVLINK_UDP'} 
                        onChange={() => setConnectionType('MAVLINK_UDP')}
                        disabled={isConnected}
                    /> 
                    MAVLink (UDP)
                </label>
                <label>
                    <input 
                        type="radio" 
                        name="connType" 
                        value="DJI_JSON" 
                        checked={connectionType === 'DJI_JSON'} 
                        onChange={() => setConnectionType('DJI_JSON')}
                        disabled={isConnected}
                    /> 
                    DJI SDK (UDP)
                </label>
                <label>
                    <input 
                        type="radio" 
                        name="connType" 
                        value="SERIAL" 
                        checked={connectionType === 'SERIAL'} 
                        onChange={() => setConnectionType('SERIAL')}
                        disabled={isConnected}
                    /> 
                    Serial
                </label>
            </div>

            {(connectionType === 'MAVLINK_UDP' || connectionType === 'DJI_JSON') && (
                <div className="connection-settings">
                    <label>IP: 
                        <input 
                            type="text" 
                            value={udpHost} 
                            onChange={e => setUdpHost(e.target.value)} 
                            disabled={isConnected} 
                            className="input-field"
                        />
                    </label>
                    <label>Port: 
                        <input 
                            type="number" 
                            value={udpPort} 
                            onChange={e => setUdpPort(parseInt(e.target.value))} 
                            disabled={isConnected} 
                            className="input-field"
                        />
                    </label>
                    {connectionType === 'DJI_JSON' && (
                        <label>Timeout (ms): 
                            <input 
                                type="number" 
                                value={timeoutMs} 
                                onChange={e => setTimeoutMs(parseInt(e.target.value))} 
                                disabled={isConnected} 
                                className="input-field"
                            />
                        </label>
                    )}
                </div>
            )}

            {connectionType === 'SERIAL' && (
                <div className="connection-settings">
                    <label>Path: 
                        <input 
                            type="text" 
                            value={serialPort} 
                            onChange={e => setSerialPort(e.target.value)} 
                            disabled={isConnected} 
                            className="input-field"
                        />
                    </label>
                    <label>Baud: 
                        <select 
                            value={baudRate} 
                            onChange={e => setBaudRate(parseInt(e.target.value))} 
                            disabled={isConnected}
                            className="input-field"
                        >
                            <option value={9600}>9600</option>
                            <option value={57600}>57600</option>
                            <option value={115200}>115200</option>
                        </select>
                    </label>
                </div>
            )}

            <button 
                disabled={busy}
                className={`connect-btn ${isConnected ? 'disconnect' : ''}`}
                onClick={handleConnectToggle}
            >
                {isConnected ? 'Disconnect Drone' : 'Connect to Drone'}
            </button>
            {diagnostics && connectionType === 'DJI_JSON' && (
                <details>
                    <summary>Receiver diagnostics (no coordinates)</summary>
                    <pre>{JSON.stringify(diagnostics, null, 2)}</pre>
                    <button onClick={() => {
                        const url = URL.createObjectURL(new Blob([JSON.stringify(diagnostics, null, 2)], { type: 'text/plain' }));
                        const link = document.createElement('a'); link.href = url; link.download = 'sentinel-receiver-diagnostics.txt'; link.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}>Save receiver report</button>
                </details>
            )}
        </div>
    );
};

export default ConnectionManager;
