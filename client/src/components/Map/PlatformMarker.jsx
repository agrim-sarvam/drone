import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { hasPosition, formatNumber, altitudeLabel } from '../../telemetryDisplay';

// Create a custom SVG drone icon
const droneIcon = new L.DivIcon({
  html: `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 22L12 18L22 22L12 2Z" fill="#63b3ed" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
    </svg>
  `,
  className: 'drone-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12], // Center of the SVG
  popupAnchor: [0, -12]
});

const PlatformMarker = ({ position, platformId }) => {
    if (!hasPosition(position)) {
        return null; // Don't render if no position
    }

    return (
        <Marker 
            position={[position.latitude, position.longitude]} 
            icon={droneIcon}
        >
            <Popup>
                <strong>{platformId || 'Platform'}</strong><br/>
                Lat: {formatNumber(position.latitude, 6)}<br/>
                Lon: {formatNumber(position.longitude, 6)}<br/>
                Alt: {altitudeLabel(position)}
            </Popup>
        </Marker>
    );
};

export default PlatformMarker;
