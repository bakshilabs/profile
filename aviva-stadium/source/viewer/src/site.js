import * as THREE from 'three';

export const SITE = {
  name: 'Aviva Stadium, Dublin',
  latitude: 53.3352,
  longitude: -6.2284,
  timeZone: 0,
  // Compass bearing, in degrees clockwise from true north, of the viewer's +Z axis.
  // Measured from Google Maps satellite imagery: the pitch long axis runs N 14 degrees W (+/- 2) and the
  // model's pitch axis is 1 degree off +Z. The -Z end is the south end, which carries more stand bulk.
  bearingOfPlusZ: 345,
};

// Unit vector in viewer coordinates for a horizontal compass bearing (0 = north, 90 = east).
// Clockwise seen from above runs from +Z towards -X.
export function compassToModel(bearingDeg) {
  const d = THREE.MathUtils.degToRad(bearingDeg - SITE.bearingOfPlusZ);
  return new THREE.Vector3(-Math.sin(d), 0, Math.cos(d));
}

// Unit vector pointing at the sun, from the Ladybug altitude and azimuth in degrees.
export function sunDirection(altitudeDeg, azimuthDeg) {
  const alt = THREE.MathUtils.degToRad(altitudeDeg);
  return compassToModel(azimuthDeg).multiplyScalar(Math.cos(alt)).setY(Math.sin(alt));
}
