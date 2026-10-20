// Hourly sun and shade for the whole year at the fine sample grid (2.5 m), packed as bits, hour-major.
// Bit (i & 7) of byte (hour * bytesPerHour + (i >> 3)) is 1 when point i is in direct sun in that hour.
// Sun positions are Ladybug's half-hour positions, as in exposure.mjs.
//
// Usage: node annual_exposure.mjs ../aviva_stadium.glb
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSamples, pointsJson } from './lib/sampling.mjs';
import { SITE, sunDirection } from '../viewer/src/site.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'data', 'annual');
const SUN_JSON = path.join(HERE, '..', 'viewer', 'public', 'data', 'sun.json');

const t0 = Date.now();
const lap = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

const samples = await prepareSamples(process.argv[2], { pitchCell: 2.5, standCell: 2.5, log: lap });
const { pts, blocked } = samples;
const n = pts.length;
const bytesPerHour = Math.ceil(n / 8);
const HOURS = 365 * 24;

const sun = JSON.parse(fs.readFileSync(SUN_JSON, 'utf8'));
const perDay = 1440 / sun.stepMinutes;
const bits = new Uint8Array(bytesPerHour * HOURS);
let daylight = 0;
for (let d = 0; d < 365; d++) {
  for (let h = 0; h < 24; h++) {
    const slot = d * perDay + h * (60 / sun.stepMinutes) + 30 / sun.stepMinutes;
    const alt = sun.altitude[slot] / 10;
    if (alt <= 0) continue;
    daylight++;
    const dir = sunDirection(alt, sun.azimuth[slot] / 10);
    const base = (d * 24 + h) * bytesPerHour;
    for (let i = 0; i < n; i++) if (!blocked(pts[i], dir)) bits[base + (i >> 3)] |= 1 << (i & 7);
  }
  if (d % 60 === 59) lap(`day ${d + 1} of 365`);
}
lap(`sun tests done (${daylight} daylight hours)`);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'points.json'), JSON.stringify(pointsJson(samples, { northBearingOfPlusZ: SITE.bearingOfPlusZ, hours: HOURS, bytesPerHour })));
fs.writeFileSync(path.join(OUT, 'sunlit.bits'), bits);
lap(`wrote ${n} points and ${(bits.length / 1e6).toFixed(1)} MB of packed sunlit flags to ${OUT}`);
