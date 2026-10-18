import React, { useState, useEffect } from 'react';
import { Polyline } from 'react-leaflet';
import { hasPosition } from '../../telemetryDisplay';

const FlightTrack = ({ currentPosition }) => {
    const [track, setTrack] = useState([]);

    useEffect(() => {
        if (hasPosition(currentPosition)) {
            setTrack((prevTrack) => {
                const newPoint = [currentPosition.latitude, currentPosition.longitude];
                
                // Prevent duplicate consecutive points
                if (prevTrack.length > 0) {
                    const lastPoint = prevTrack[prevTrack.length - 1];
                    if (lastPoint[0] === newPoint[0] && lastPoint[1] === newPoint[1]) {
                        return prevTrack;
                    }
                }

                // Add new point, keeping only the last 100 points to prevent memory issues
                const updatedTrack = [...prevTrack, newPoint];
                if (updatedTrack.length > 100) {
                    updatedTrack.shift(); 
                }
                return updatedTrack;
            });
        }
    }, [currentPosition]);

    // Don't render if we don't have enough points for a line
    if (track.length < 2) return null;

    return (
        <Polyline 
            positions={track} 
            color="#fc8181" 
            weight={3} 
            opacity={0.8}
            dashArray="5, 10" // Make it a dashed trail line
        />
    );
};

export default FlightTrack;
