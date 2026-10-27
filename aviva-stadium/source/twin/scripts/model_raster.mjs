// Rasterises the stadium model from above, in the viewer's normalised frame (metres, Y up, footprint centre at the origin).
// Writes twin/data/model_raster.json with per-material bounds and an occupancy grid (0.5 m cells) for the non-ground meshes.
// Usage: node twin/scripts/model_raster.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { loadStadium } from '../../analysis/lib/model.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GLB = path.join(HERE, '../../aviva_stadium.glb');
const model = await loadStadium(GLB);
const CELL = 0.5, HALF = 200, N = (HALF * 2) / CELL;

const perMat = {};
const grids = { all: new Uint8Array(N * N), roof: new Uint8Array(N * N), low: new Uint8Array(N * N), grass: new Uint8Array(N * N), seats: new Uint8Array(N * N) };
const tmp = new THREE.Vector3();
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
function fillTri(g, ax, az, bx, bz, cx, cz) {
  const minx = Math.max(0, Math.floor((Math.min(ax, bx, cx) + HALF) / CELL));
  const maxx = Math.min(N - 1, Math.floor((Math.max(ax, bx, cx) + HALF) / CELL));
  const minz = Math.max(0, Math.floor((Math.min(az, bz, cz) + HALF) / CELL));
  const maxz = Math.min(N - 1, Math.floor((Math.max(az, bz, cz) + HALF) / CELL));
  const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
  if (Math.abs(d) < 1e-9) return;
  for (let j = minz; j <= maxz; j++) for (let i = minx; i <= maxx; i++) {
    const x = (i + 0.5) * CELL - HALF, z = (j + 0.5) * CELL - HALF;
    const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d;
    const l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d;
    if (l1 >= -0.02 && l2 >= -0.02 && 1 - l1 - l2 >= -0.02) g[j * N + i] = 1;
  }
}
model.updateMatrixWorld(true);
model.traverse((o) => {
  if (!o.isMesh) return;
  const mname = o.material.name || '?';
  const box = new THREE.Box3().setFromObject(o);
  const m = (perMat[mname] ??= { meshes: 0, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] });
  m.meshes++;
  for (let k = 0; k < 3; k++) { m.min[k] = Math.min(m.min[k], [box.min.x, box.min.y, box.min.z][k]); m.max[k] = Math.max(m.max[k], [box.max.x, box.max.y, box.max.z][k]); }
  if (mname === 'New_material_016') return; // ground plane
  const isGrass = mname === 'New_material_014', isSeats = mname === 'New_material_018';
  const pos = o.geometry.attributes.position, idx = o.geometry.index;
  const isRoof = mname === 'New_material_012' || mname === 'Default roof steel' || /roof/i.test(mname);
  const n = idx ? idx.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const i0 = idx ? idx.getX(t) : t, i1 = idx ? idx.getX(t + 1) : t + 1, i2 = idx ? idx.getX(t + 2) : t + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(o.matrixWorld);
    b.fromBufferAttribute(pos, i1).applyMatrix4(o.matrixWorld);
    c.fromBufferAttribute(pos, i2).applyMatrix4(o.matrixWorld);
    fillTri(grids.all, a.x, a.z, b.x, b.z, c.x, c.z);
    if (isGrass) fillTri(grids.grass, a.x, a.z, b.x, b.z, c.x, c.z);
    if (isSeats) fillTri(grids.seats, a.x, a.z, b.x, b.z, c.x, c.z);
    if (isRoof) fillTri(grids.roof, a.x, a.z, b.x, b.z, c.x, c.z);
    if (Math.min(a.y, b.y, c.y) < 6) fillTri(grids.low, a.x, a.z, b.x, b.z, c.x, c.z);
  }
});
const whole = new THREE.Box3().setFromObject(model);
console.log('whole model box (normalised frame):', whole.min.toArray().map((v) => +v.toFixed(2)), whole.max.toArray().map((v) => +v.toFixed(2)));
for (const [k, v] of Object.entries(perMat)) console.log(k, v.meshes, v.min.map((x) => +x.toFixed(1)).join(','), '|', v.max.map((x) => +x.toFixed(1)).join(','));
const pack = (g) => Buffer.from(g).toString('base64');
fs.writeFileSync(path.join(HERE, '../data/model_raster.json'), JSON.stringify({ cell: CELL, half: HALF, n: N, materials: perMat, all: pack(grids.all), roof: pack(grids.roof), low: pack(grids.low), grass: pack(grids.grass), seats: pack(grids.seats) }));
for (const k of Object.keys(grids)) console.log(k, 'cells', grids[k].reduce((s, v) => s + v, 0));
