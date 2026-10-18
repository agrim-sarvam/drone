import React, { useEffect, useRef } from 'react';
import './SensorFeed.css';
import { formatNumber, altitudeLabel } from '../../telemetryDisplay';

const SensorFeed = ({ telemetry }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        
        let animationFrameId;
        let time = 0;

        const render = () => {
            const width = canvas.width;
            const height = canvas.height;

            // Clear background so video shows through
            ctx.clearRect(0, 0, width, height);

            // Draw scanning line (radar effect)
            const scanLineY = (time % 100) / 100 * height;
            ctx.fillStyle = 'rgba(99, 179, 237, 0.1)';
            ctx.fillRect(0, scanLineY, width, 4);

            // Draw central crosshairs
            ctx.strokeStyle = 'rgba(72, 187, 120, 0.8)';
            ctx.lineWidth = 1.5;
            
            const cx = width / 2;
            const cy = height / 2;

            ctx.beginPath();
            // Horizontal
            ctx.moveTo(cx - 40, cy);
            ctx.lineTo(cx + 40, cy);
            // Vertical
            ctx.moveTo(cx, cy - 40);
            ctx.lineTo(cx, cy + 40);
            
            // Reticle circle
            ctx.arc(cx, cy, 30, 0, Math.PI * 2);
            ctx.stroke();

            // Overlay Data (Simulating OSD - On Screen Display)
            ctx.fillStyle = '#48bb78';
            ctx.font = '12px monospace';
            
            if (telemetry && telemetry.position) {
                ctx.fillText(`LAT: ${formatNumber(telemetry.position.latitude, 6)}`, 10, 20);
                ctx.fillText(`LON: ${formatNumber(telemetry.position.longitude, 6)}`, 10, 40);
                ctx.fillText(`ALT: ${altitudeLabel(telemetry.position)}`, 10, 60);
                
                ctx.fillText(`YAW: ${formatNumber(telemetry.attitude?.yaw)}°`, width - 90, 20);
                ctx.fillText(`SPD: ${formatNumber(telemetry.velocity?.groundSpeed)}`, width - 90, 40);
            } else {
                ctx.fillText("NO TELEMETRY", 10, 20);
            }

            // Timecode
            ctx.fillStyle = '#a0aec0';
            ctx.fillText(new Date().toISOString().substring(11, 19) + 'Z', width - 80, height - 15);
            ctx.fillText('CAM: OPTICAL', 10, height - 15);

            time++;
            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [telemetry]);

    return (
        <div className="sensor-feed-container" style={{position: 'relative'}}>
            <video 
                src="./test-video.mp4"
                autoPlay 
                loop 
                muted 
                playsInline
                className="sensor-video"
            />
            <canvas 
                ref={canvasRef} 
                width={330} 
                height={260} 
                className="sensor-canvas"
            />
            <div className="sensor-overlay-text">
                <span className="live-badge">DEMO VIDEO — not a DJI live feed</span>
            </div>
        </div>
    );
};

export default SensorFeed;
