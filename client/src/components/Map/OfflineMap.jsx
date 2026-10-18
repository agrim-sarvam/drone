import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './OfflineMap.css';
import PlatformMarker from './PlatformMarker';
import FlightTrack from './FlightTrack';
import { hasPosition } from '../../telemetryDisplay';

import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

// Fix for default marker icon in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: iconRetina,
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
});

// A simple base64 encoded SVG to create an infinite tactical grid
const TACTICAL_GRID_TILE = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iIzBkMGYxNCIgc3Ryb2tlPSIjMmQzNzQ4IiBzdHJva2Utd2lkdGg9IjEiLz48Y2lyY2xlIGN4PSIxMjgiIGN5PSIxMjgiIHI9IjIiIGZpbGw9IiM0YTU1NjgiLz48L3N2Zz4=";

const MapInteraction = ({ appMode, waypoints, setWaypoints, loadObservations }) => {
    useMapEvents({
        async click(e) {
            if (appMode === 'PLANNING' && setWaypoints) {
                const newWp = {
                    lat: e.latlng.lat,
                    lng: e.latlng.lng,
                    gridReference: ''
                };
                setWaypoints([...(waypoints || []), newWp]);
            } else if (appMode === 'OBSERVE' && window.electronAPI) {
                await window.electronAPI.saveObservation({
                    latitude: e.latlng.lat,
                    longitude: e.latlng.lng,
                    gridReference: 'N/A' // Convert in real app
                });
                if (loadObservations) loadObservations();
            }
        }
    });
    return null;
};

const OfflineMap = ({ telemetry, appMode, waypoints = [], setWaypoints, observations = [], loadObservations, layers = {flightPath: true, observations: true, waypoints: true}, showGrid = false }) => {
    const mapRef = useRef();

    // Pan map to follow drone if telemetry updates, but only if not planning
    useEffect(() => {
        if (mapRef.current && hasPosition(telemetry?.position) && appMode !== 'PLANNING') {
            const map = mapRef.current;
            map.panTo([telemetry.position.latitude, telemetry.position.longitude], { animate: true });
        }
    }, [telemetry, appMode]);

    return (
        <div className={`offline-map-container ${showGrid ? 'show-tactical-grid' : ''}`}>
            <div className="tactical-mode-badge" style={appMode === 'PLANNING' ? {backgroundColor: 'rgba(237, 137, 54, 0.8)', borderColor: '#ed8936', color: '#fff'} : {}}>
                {appMode === 'PLANNING' ? 'MISSION PLANNING MODE' : 'TACTICAL GRID MODE (OFFLINE)'}
            </div>
            
            <MapContainer 
                center={[18.9220, 72.8347]} // Gateway of India
                zoom={16} 
                style={{ height: "100%", width: "100%", backgroundColor: "#0d0f14", cursor: appMode === 'PLANNING' ? 'crosshair' : 'grab' }}
                zoomControl={true}
                ref={mapRef}
            >
                {/* 100% Offline Tactical Grid Fallback */}
                <TileLayer
                    url={TACTICAL_GRID_TILE}
                    attribution="&copy; Offline ESM Grid"
                />

                {/* Local MBTiles Map Server (will load real offline maps if available) */}
                <TileLayer
                    url="maptile://map/{z}/{x}/{y}.png"
                />

                <MapInteraction appMode={appMode} waypoints={waypoints} setWaypoints={setWaypoints} loadObservations={loadObservations} />

                {/* Render Mission Waypoints */}
                {layers.waypoints && waypoints.map((wp, i) => (
                    <Marker key={`wp-${i}`} position={[wp.lat, wp.lng]} />
                ))}
                
                {layers.waypoints && waypoints.length > 1 && (
                    <Polyline positions={waypoints.map(w => [w.lat, w.lng])} color="#ed8936" weight={3} />
                )}

                {/* Render Observations */}
                {layers.observations && observations && observations.map((obs) => (
                    <Marker key={`obs-${obs.id}`} position={[obs.latitude, obs.longitude]} />
                ))}

                {layers.flightPath && appMode !== 'PLANNING' && appMode !== 'OBSERVE' && <FlightTrack currentPosition={telemetry?.position} />}
                
                <PlatformMarker 
                    position={telemetry?.position} 
                    platformId={telemetry?.platformId} 
                />
            </MapContainer>
        </div>
    );
};

export default OfflineMap;
