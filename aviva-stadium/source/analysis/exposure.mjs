// Annual sun and shade at coarse sample points on the pitch and in the seating bowl.
//   - whether each of the 8760 hours of the year has a sunlit point (sun at the Ladybug half-hour position)
//   - the sky view factor of each point
// Output goes to analysis/data. comfort.py turns it into radiation and UTCI.
//
// Usage: node exposure.mjs ../aviva_stadium.glb
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSamples, pointsJson } from './lib/sampling.mjs';
import { SITE, sunDirection } from '../viewer/src/site.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'data');
const SUN_JSON = path.join(HERE, '..', 'viewer', 'public', 'data', 'sun.json');

const t0 = Date.now();
const lap = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

const samples = await prepareSamples(process.argv[2], { pitchCell: 6, standCell: 5, log: lap });
const { pts, blocked } = samples;

const sun = JSON.parse(fs.readFileSync(SUN_JSON, 'utf8'));
const perDay = 1440 / sun.stepMinutes;
const slotAtHalfHour = 30 / sun.stepMinutes;
const hours = 365 * 24;
const sunlit = new Uint8Array(pts.length * hours);
let daylightHours = 0;
for (let d = 0; d < 365; d++) {
  for (let h = 0; h < 24; h++) {
    const slot = d * perDay + h * (60 / sun.stepMinutes) + slotAtHalfHour;
    const alt = sun.altitude[slot] / 10;
    if (alt <= 0) continue;
    daylightHours++;
    const dir = sunDirection(alt, sun.azimuth[slot] / 10);
    const hour = d * 24 + h;
    for (let i = 0; i < pts.length; i++) if (!blocked(pts[i], dir)) sunlit[i * hours + hour] = 1;
  }
  if (d % 60 === 59) lap(`day ${d + 1} of 365`);
}
lap(`sun tests done (${daylightHours} daylight hours)`);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'points.json'), JSON.stringify(pointsJson(samples, { northBearingOfPlusZ: SITE.bearingOfPlusZ, hours })));
fs.writeFileSync(path.join(OUT, 'sunlit.u8'), sunlit);
lap(`wrote ${pts.length} points and ${(sunlit.length / 1e6).toFixed(1)} MB of sunlit flags to ${OUT}`);
