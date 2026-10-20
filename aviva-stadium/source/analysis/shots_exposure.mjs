// Sun and shade at every frame of the day-sweep shots, on a fine grid of sample points (2.5 m).
// Reads data/shots_frames.json from shots_frames.py. Writes data/shots/points.json and, for each shot,
// <name>.sunlit.u8 with one byte per point per frame, frame-major.
//
// Usage: node shots_exposure.mjs ../aviva_stadium.glb
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareSamples, pointsJson } from './lib/sampling.mjs';
import { SITE, sunDirection } from '../viewer/src/site.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'data', 'shots');

const t0 = Date.now();
const lap = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

const frames = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'shots_frames.json'), 'utf8'));
const samples = await prepareSamples(process.argv[2], { pitchCell: 2.5, standCell: 2.5, log: lap });
const { pts, blocked } = samples;
const n = pts.length;

fs.mkdirSync(OUT, { recursive: true });
for (const shot of frames.shots) {
  const sunlit = new Uint8Array(shot.frames * n);
  for (let f = 0; f < shot.frames; f++) {
    const alt = shot.altitude[f];
    if (alt <= 0) continue;
    const dir = sunDirection(alt, shot.azimuth[f]);
    for (let i = 0; i < n; i++) if (!blocked(pts[i], dir)) sunlit[f * n + i] = 1;
  }
  fs.writeFileSync(path.join(OUT, `${shot.name}.sunlit.u8`), sunlit);
  let lit = 0;
  for (let i = 0; i < sunlit.length; i++) lit += sunlit[i];
  lap(`${shot.name}: ${shot.frames} frames, ${(100 * lit / sunlit.length).toFixed(1)}% of point-frames sunlit`);
}
fs.writeFileSync(path.join(OUT, 'points.json'), JSON.stringify(pointsJson(samples, { northBearingOfPlusZ: SITE.bearingOfPlusZ })));
lap(`wrote ${n} points to ${OUT}`);
