// Builds a continuous terrace surface through the stand sample points, so each seating tier can be drawn as a
// filled area. The model's seats are thin row strips with gaps between them.
// Stand points sit one per plan cell and height band, so each point is joined to the neighbouring cells'
// points at the matching height, and every 2 x 2 block becomes up to two triangles. Tiers that overlap in
// plan stay separate because their heights differ.
// Output: viewer/public/data/terrace.json  { offset, triangles }   triangles index into the point arrays.
//
// Usage: node terrace.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const pts = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'annual', 'points.json'), 'utf8'));
const OUT = path.join(HERE, '..', 'viewer', 'public', 'data', 'terrace.json');
const HEAD = pts.pointHeight, CELL = pts.standCell;
const first = pts.kind.indexOf(1);
const n = pts.x.length;

const sy = (i) => pts.y[i] - HEAD;
const joined = (a, b) => {
  const h = Math.hypot(pts.x[a] - pts.x[b], pts.z[a] - pts.z[b]);
  return h <= 4.6 && Math.abs(sy(a) - sy(b)) <= 0.8 * h + 0.35;
};

const cells = new Map();
for (let i = first; i < n; i++) {
  const key = `${Math.floor(pts.x[i] / CELL)},${Math.floor(pts.z[i] / CELL)}`;
  if (!cells.has(key)) cells.set(key, []);
  cells.get(key).push(i);
}
// The point in a neighbouring cell at the closest height that is joined to p, or -1.
const neighbour = (p, cx, cz) => {
  let best = -1, bestD = Infinity;
  for (const q of cells.get(`${cx},${cz}`) ?? []) {
    const d = Math.abs(sy(q) - sy(p));
    if (joined(p, q) && d < bestD) { best = q; bestD = d; }
  }
  return best;
};

const triangles = [];
const addTriangle = (a, b, c) => {
  const ux = pts.x[b] - pts.x[a], uy = sy(b) - sy(a), uz = pts.z[b] - pts.z[a];
  const vx = pts.x[c] - pts.x[a], vy = sy(c) - sy(a), vz = pts.z[c] - pts.z[a];
  const ny = uz * vx - ux * vz;   // plan-view winding, so the surface faces up
  if (Math.abs(ny) < 0.3) return; // sliver
  triangles.push(ny >= 0 ? [a, b, c] : [a, c, b]);
};
for (let p = first; p < n; p++) {
  const cx = Math.floor(pts.x[p] / CELL), cz = Math.floor(pts.z[p] / CELL);
  const e = neighbour(p, cx + 1, cz), s = neighbour(p, cx, cz + 1);
  const d = e >= 0 ? neighbour(e, cx + 1, cz + 1) : -1;
  if (e >= 0 && s >= 0 && joined(e, s)) addTriangle(p, e, s);
  if (e >= 0 && s >= 0 && d >= 0 && joined(d, s)) addTriangle(e, d, s);
  else if (e >= 0 && d >= 0 && s < 0) { const s2 = neighbour(d, cx, cz + 1); if (s2 >= 0) addTriangle(p, e, d); }
}
fs.writeFileSync(OUT, JSON.stringify({ offset: first, triangles: triangles.flat() }));
// Area check: the surface should be about the area of the seating, not a multiple of it.
let area = 0;
for (const [a, b, c] of triangles) {
  const ux = pts.x[b] - pts.x[a], uy = sy(b) - sy(a), uz = pts.z[b] - pts.z[a];
  const vx = pts.x[c] - pts.x[a], vy = sy(c) - sy(a), vz = pts.z[c] - pts.z[a];
  area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}
console.log(`${triangles.length} triangles over ${n - first} stand points, surface area ${area.toFixed(0)} m2, wrote ${OUT}`);
