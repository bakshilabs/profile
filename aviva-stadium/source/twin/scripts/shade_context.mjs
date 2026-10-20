// How much do the surrounding buildings change winter-solstice direct sun on the pitch and in the stands?
// Re-uses analysis/lib/sampling.mjs (read only) for the stadium BVH and the sample points, and adds a second BVH built from the
// extruded OpenStreetMap buildings in viewer/public/twin/context.glb. Sun positions come from the NOAA formulas in viewer/src/twin/core.js,
// rotated into the model frame with the refined bearing in twin/data/fit.json.
// Usage: node twin/scripts/shade_context.mjs [dayOfYear=355]   -> twin/data/shade_context.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareSamples } from '../../analysis/lib/sampling.mjs';
import { solarPosition } from '../../viewer/src/twin/core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DAY = Number(process.argv[2] ?? 355);
const fit = JSON.parse(fs.readFileSync(path.join(HERE, '../data/fit.json'), 'utf8'));
const b = THREE.MathUtils.degToRad(fit.bearingOfPlusZ);
const north = new THREE.Vector3(Math.sin(b), 0, Math.cos(b)), east = new THREE.Vector3(-Math.cos(b), 0, Math.sin(b));

const samples = await prepareSamples(path.join(HERE, '../../aviva_stadium.glb'), { pitchCell: 4, standCell: 6, log: (m) => console.log(m) });
const { pts, blocked } = samples;

// context buildings
const buf = fs.readFileSync(path.join(HERE, '../../viewer/public/twin/context.glb'));
const gltf = await new GLTFLoader().parseAsync(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const bNode = new THREE.Group(); for (const n of ['context_buildings', 'context_buildings_ns']) { const node = gltf.scene.getObjectByName(n); if (node) bNode.add(node.clone()); } bNode.updateMatrixWorld(true);
function ctxBVH(heightScale) {
  const pos = [], idx = []; let base = 0;
  bNode.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position, ix = o.geometry.index; for (let i = 0; i < p.count; i++) pos.push(p.getX(i), p.getY(i) * heightScale, p.getZ(i)); for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base); base += p.count; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return new MeshBVH(g);
}
const ray = new THREE.Ray();
const hitCtx = (bvh, p, dir) => { ray.origin.set(p.x, p.y, p.z); ray.direction.copy(dir); return !!bvh.raycastFirst(ray, THREE.DoubleSide, 0, 3000); };

const cases = { 'stadium only': null, 'stadium and context': ctxBVH(1), 'context 1.5 times taller': ctxBVH(1.5), 'context only, no stadium': ctxBVH(1), 'no obstruction': null };
const ignoreStadium = new Set(['context only, no stadium', 'no obstruction']);
const STEP_MIN = 10;
const hours = []; for (let m = 0; m < 24 * 60; m += STEP_MIN) hours.push(m / 60);
const sunDirs = [];
for (const h of hours) { const s = solarPosition(DAY, h); if (s.altitude <= 0) continue; const az = THREE.MathUtils.degToRad(s.azimuth), alt = THREE.MathUtils.degToRad(s.altitude); sunDirs.push({ h, alt: s.altitude, az: s.azimuth, dir: new THREE.Vector3().addScaledVector(north, Math.cos(az)).addScaledVector(east, Math.sin(az)).multiplyScalar(Math.cos(alt)).setY(Math.sin(alt)) }); }
console.log(`day ${DAY}: ${sunDirs.length} sun positions, sunrise ${sunDirs[0].h.toFixed(2)} UTC, sunset ${sunDirs.at(-1).h.toFixed(2)} UTC, noon altitude ${Math.max(...sunDirs.map((s) => s.alt)).toFixed(1)} deg`);

const result = { day: DAY, stepMinutes: STEP_MIN, bearingOfPlusZ: fit.bearingOfPlusZ, noonAltitudeDeg: Math.max(...sunDirs.map((s) => s.alt)), cases: {} };
const sunlit = {}; // per case: Uint8Array [point][sunIndex]
for (const [name, bvh] of Object.entries(cases)) {
  const arr = new Uint8Array(pts.length * sunDirs.length);
  pts.forEach((p, i) => sunDirs.forEach((s, j) => { arr[i * sunDirs.length + j] = (ignoreStadium.has(name) || !blocked(p, s.dir)) && !(bvh && hitCtx(bvh, p, s.dir)) ? 1 : 0; }));
  sunlit[name] = arr;
}
const stat = (name, kind) => {
  const idx = pts.map((p, i) => i).filter((i) => pts[i].kind === kind); const arr = sunlit[name]; const per = idx.map((i) => { let c = 0; for (let j = 0; j < sunDirs.length; j++) c += arr[i * sunDirs.length + j]; return (c * STEP_MIN) / 60; });
  return { points: idx.length, meanSunHours: per.reduce((s, v) => s + v, 0) / per.length, per, idx };
};
for (const kind of [0, 1]) {
  const label = kind === 0 ? 'pitch' : 'stands';
  const base = stat('stadium only', kind);
  result[label] = { points: base.points };
  for (const name of Object.keys(cases)) {
    const s = stat(name, kind);
    const diffs = s.per.map((v, i) => base.per[i] - v);
    const sunlitAtNoon = (() => { const jn = sunDirs.reduce((best, sd, j) => (Math.abs(sd.h - 12) < Math.abs(sunDirs[best].h - 12) ? j : best), 0); return s.idx.reduce((c, i) => c + sunlit[name][i * sunDirs.length + jn], 0) / s.idx.length; })();
    result[label][name] = { meanSunHours: +s.meanSunHours.toFixed(3), meanReductionVsStadiumOnlyHours: +(base.meanSunHours - s.meanSunHours).toFixed(3), maxReductionHours: +Math.max(...diffs).toFixed(2), pointsWithAnyChange: diffs.filter((d) => d > 1e-6).length, shareOfPointsSunlitAtNoon: +sunlitAtNoon.toFixed(3) };
  }
  // sunlit fraction through the day, stadium only vs with context
  result[label].hourly = sunDirs.filter((_, j) => j % 3 === 0).map((sd) => { const j = sunDirs.indexOf(sd); const frac = (name) => { const idx = pts.map((p, i) => i).filter((i) => pts[i].kind === kind); return idx.reduce((c, i) => c + sunlit[name][i * sunDirs.length + j], 0) / idx.length; }; return { hourUTC: +sd.h.toFixed(2), altitude: +sd.alt.toFixed(1), azimuth: +sd.az.toFixed(0), sunlitShareStadiumOnly: +frac('stadium only').toFixed(3), sunlitShareWithContext: +frac('stadium and context').toFixed(3) }; });
}
fs.writeFileSync(path.join(HERE, `../data/shade_context_day${DAY}.json`), JSON.stringify(result, null, 1));
console.log(JSON.stringify({ pitch: { ...result.pitch, hourly: undefined }, stands: { ...result.stands, hourly: undefined } }, null, 1));
console.log(result.pitch.hourly.map((h) => `${h.hourUTC}h alt ${h.altitude} az ${h.azimuth}: ${h.sunlitShareStadiumOnly} -> ${h.sunlitShareWithContext}`).join('\n'));
