export function formatNumber(value, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : '--';
}
export function hasPosition(position) {
    return position?.valid !== false && Number.isFinite(position?.latitude) && Number.isFinite(position?.longitude);
}
export function altitudeLabel(position) {
    if (position?.altitudeReference === 'takeoff') return `${formatNumber(position.relativeAltitude)} m above takeoff`;
    const reference = position?.altitudeReference === 'legacy-unspecified' ? 'reference unknown' : 'MSL';
    return `${formatNumber(position?.altitudeMSL)} m (${reference})`;
}
