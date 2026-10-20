// Small geodesy helpers shared by the twin scripts. Pure maths, no dependencies.
const A = 6378137, F = 1 / 298.257223563, E2 = F * (2 - F);
export const REF = { lat: 53.3352, lon: -6.2284 }; // same reference as viewer/src/site.js

// Local tangent plane. Returns metres east and north of the reference point (equirectangular on the ellipsoid; the error is
// under 0.05 m within 1 km).
export function toEN(lat, lon, ref = REF) {
  const s = Math.sin((ref.lat * Math.PI) / 180);
  const w = Math.sqrt(1 - E2 * s * s);
  const M = (A * (1 - E2)) / (w * w * w); // meridional radius
  const N = A / w; // prime vertical radius
  const dLat = ((lat - ref.lat) * Math.PI) / 180, dLon = ((lon - ref.lon) * Math.PI) / 180;
  return { e: dLon * N * Math.cos((ref.lat * Math.PI) / 180), n: dLat * M };
}
export function fromEN(e, n, ref = REF) {
  const s = Math.sin((ref.lat * Math.PI) / 180);
  const w = Math.sqrt(1 - E2 * s * s);
  const M = (A * (1 - E2)) / (w * w * w), N = A / w;
  return { lat: ref.lat + ((n / M) * 180) / Math.PI, lon: ref.lon + ((e / (N * Math.cos((ref.lat * Math.PI) / 180))) * 180) / Math.PI };
}

// UTM forward projection (Kruger series). Returns easting, northing and grid convergence (degrees).
export function utmForward(lat, lon, zone = 29) {
  const k0 = 0.9996, lon0 = ((zone - 1) * 6 - 180 + 3) * (Math.PI / 180);
  const phi = (lat * Math.PI) / 180, lam = (lon * Math.PI) / 180 - lon0;
  const n = F / (2 - F), n2 = n * n, n3 = n2 * n, n4 = n3 * n;
  const Ah = (A / (1 + n)) * (1 + n2 / 4 + n4 / 64);
  const alpha = [
    n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4,
    (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4,
    (61 / 240) * n3 - (103 / 140) * n4,
    (49561 / 161280) * n4,
  ];
  const e = Math.sqrt(E2);
  const t = Math.sinh(Math.atanh(Math.sin(phi)) - e * Math.atanh(e * Math.sin(phi)));
  const xi = Math.atan2(t, Math.cos(lam));
  const eta = Math.atanh(Math.sin(lam) / Math.sqrt(1 + t * t));
  let x = eta, y = xi, p = 1, q = 0;
  for (let j = 1; j <= 4; j++) {
    y += alpha[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    x += alpha[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
    p += 2 * j * alpha[j - 1] * Math.cos(2 * j * xi) * Math.cosh(2 * j * eta);
    q += 2 * j * alpha[j - 1] * Math.sin(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const E = 500000 + k0 * Ah * x, Nn = k0 * Ah * y;
  const gamma = Math.atan2(t * Math.tan(lam), Math.sqrt(1 + t * t)) + Math.atan2(q, p);
  return { e: E, n: Nn, convergenceDeg: (gamma * 180) / Math.PI };
}
