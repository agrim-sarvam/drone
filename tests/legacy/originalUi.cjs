// The original laptop UI formats these fields with toFixed() (App.jsx, PlatformMarker.jsx, SensorFeed.jsx
// at 4adfa61). Any non-number here would throw and blank its screen, so packets must keep them numeric.
module.exports = function renderOriginalUi(telemetry) {
    return [
        telemetry.position.latitude.toFixed(6),
        telemetry.position.longitude.toFixed(6),
        telemetry.position.altitudeMSL.toFixed(1),
        telemetry.attitude.yaw.toFixed(1),
        telemetry.velocity.groundSpeed.toFixed(1)
    ];
};
