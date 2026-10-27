// Fits the stadium model footprint to the OpenStreetMap outline of the Aviva Stadium.
// Unknowns: bearing of the model's +Z axis (beta, degrees clockwise from true north) and the position of the model origin
// (east, north metres from the reference point in geo.mjs). Scale is fixed at 1 (the model is in true millimetres).
//   (e, n) = x * (-cos beta, sin beta) + z * (sin beta, cos beta) + (te, tn)
// Usage: node twin/scripts/fit_osm.mjs   -> twin/data/fit.json and twin/data/fit_overlay.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toEN } from './geo.mjs';
import { png } from './png.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const osm = JSON.parse(fs.readFileSync(path.join(HERE, '../downloads/osm/osm.json'), 'utf8'));
const ras = JSON.parse(fs.readFileSync(path.join(HERE, '../data/model_raster.json'), 'utf8'));
const { cell: CELL, half: HALF, n: N } = ras;
const unpack = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const all = unpack(ras.all), roof = unpack(ras.roof), low = unpack(ras.low), grass = unpack(ras.grass);

// --- OSM rings (relation 3357396 members) in local metres
const byId = new Map(osm.elements.filter((e) => e.type === 'way').map((e) => [e.id, e]));
for (const m of osm.elements.find((e) => e.type === 'relation' && e.id === 3357396).members) if (m.type === 'way') byId.set(m.ref, m);
const ring = (id) => byId.get(id).geometry.map((p) => { const { e, n } = toEN(p.lat, p.lon); return [e, n]; });
const osmOuter = ring(249663148), osmInner = ring(249663147);

// --- model silhouettes
function floodOutside(g) {
  const out = new Uint8Array(N * N); const stack = [0]; out[0] = 1;
  while (stack.length) {
    const p = stack.pop(), x = p % N, y = (p / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const q = ny * N + nx; if (!out[q] && !g[q]) { out[q] = 1; stack.push(q); }
    }
  }
  return out;
}
// close small gaps first (3 cell dilation then erosion) so the outline is one clean curve
function closeMask(g, r = 3) {
  const dil = new Uint8Array(N * N), res = new Uint8Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y * N + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < N && ny < N) dil[ny * N + nx] = 1; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let ok = 1; for (let dy = -r; dy <= r && ok; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N || !dil[ny * N + nx]) { ok = 0; break; } } res[y * N + x] = ok; }
  return res;
}
const outsideAll = floodOutside(closeMask(all));
const silhouette = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) silhouette[i] = outsideAll[i] ? 0 : 1;
// Roof opening: the cells inside the silhouette that are outside the closed roof mask and reachable from the pitch centre.
const roofClosed = closeMask(roof, 2);
function openingOf(g, seedX, seedZ) {
  const seed = Math.floor((seedZ + HALF) / CELL) * N + Math.floor((seedX + HALF) / CELL);
  const res = new Uint8Array(N * N); if (g[seed]) return res; const stack = [seed]; res[seed] = 1;
  while (stack.length) {
    const p = stack.pop(), x = p % N, y = (p / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const q = ny * N + nx; if (!res[q] && !g[q]) { res[q] = 1; stack.push(q); } }
  }
  return res;
}
const roofOpening = openingOf(roofClosed, 0, 10); // pitch centre is around x 0, z 10 in the model frame
console.log('silhouette cells', silhouette.reduce((s, v) => s + v, 0), 'roof opening cells', roofOpening.reduce((s, v) => s + v, 0));

function boundary(mask) { // midpoints of the cell edges between mask and not-mask
  const pts = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = mask[y * N + x]; const cx = (x + 0.5) * CELL - HALF, cz = (y + 0.5) * CELL - HALF;
    if (x + 1 < N && mask[y * N + x + 1] !== v) pts.push([cx + CELL / 2, cz]);
    if (y + 1 < N && mask[(y + 1) * N + x] !== v) pts.push([cx, cz + CELL / 2]);
  }
  return pts;
}
const modelOuter = boundary(silhouette);
const modelInner = boundary(grass); // the grass mesh is the model counterpart of the OSM inner ring (the playing area)
console.log('boundary points', modelOuter.length, modelInner.length);

function densify(poly, step) {
  const out = [];
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[i + 1], L = Math.hypot(bx - ax, by - ay), k = Math.max(1, Math.ceil(L / step));
    for (let j = 0; j < k; j++) out.push([ax + ((bx - ax) * j) / k, ay + ((by - ay) * j) / k]);
  }
  return out;
}
const dPoly = (px, py, poly) => { let best = Infinity; for (let i = 0; i < poly.length - 1; i++) { const [ax, ay] = poly[i], [bx, by] = poly[i + 1]; const dx = bx - ax, dy = by - ay; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); const d = Math.hypot(px - ax - t * dx, py - ay - t * dy); if (d < best) best = d; } return best; };
const toENfromModel = (x, z, p) => { const b = (p.beta * Math.PI) / 180; return [-x * Math.cos(b) + z * Math.sin(b) + p.te, x * Math.sin(b) + z * Math.cos(b) + p.tn]; };
const toModelFromEN = (e, n, p) => { const b = (p.beta * Math.PI) / 180; const de = e - p.te, dn = n - p.tn; return [-de * Math.cos(b) + dn * Math.sin(b), de * Math.sin(b) + dn * Math.cos(b)]; };

// Chamfer cost, both directions. Model boundary points go into EN, the OSM ring is tested as-is; OSM points go to model frame.
function makeCost(modelPts, osmRing) {
  const sub = modelPts.filter((_, i) => i % 4 === 0);
  const osmPts = densify(osmRing, 1.0);
  // model boundary as an ordered polyline is not available, so use a distance field for the reverse direction
  const field = new Float32Array(N * N).fill(1e9);
  for (const [x, z] of modelPts) { const gx = Math.floor((x + HALF) / CELL), gz = Math.floor((z + HALF) / CELL); field[gz * N + gx] = 0; }
  // two-pass chamfer distance transform (metres)
  const a = 1, b = Math.SQRT2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = field[y * N + x]; if (x > 0) v = Math.min(v, field[y * N + x - 1] + a); if (y > 0) { v = Math.min(v, field[(y - 1) * N + x] + a); if (x > 0) v = Math.min(v, field[(y - 1) * N + x - 1] + b); if (x < N - 1) v = Math.min(v, field[(y - 1) * N + x + 1] + b); } field[y * N + x] = v; }
  for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) { let v = field[y * N + x]; if (x < N - 1) v = Math.min(v, field[y * N + x + 1] + a); if (y < N - 1) { v = Math.min(v, field[(y + 1) * N + x] + a); if (x < N - 1) v = Math.min(v, field[(y + 1) * N + x + 1] + b); if (x > 0) v = Math.min(v, field[(y + 1) * N + x - 1] + b); } field[y * N + x] = v; }
  const fieldAt = (x, z) => { const fx = (x + HALF) / CELL - 0.5, fz = (z + HALF) / CELL - 0.5; const ix = Math.floor(fx), iz = Math.floor(fz); if (ix < 0 || iz < 0 || ix >= N - 1 || iz >= N - 1) return 1e3; const tx = fx - ix, tz = fz - iz; return (field[iz * N + ix] * (1 - tx) + field[iz * N + ix + 1] * tx) * (1 - tz) + (field[(iz + 1) * N + ix] * (1 - tx) + field[(iz + 1) * N + ix + 1] * tx) * tz; };
  const dists = (p) => {
    const d1 = sub.map(([x, z]) => { const [e, n] = toENfromModel(x, z, p); return dPoly(e, n, osmRing); }); // model to OSM
    const d2 = osmPts.map(([e, n]) => { const [x, z] = toModelFromEN(e, n, p); return fieldAt(x, z) * CELL; }); // OSM to model
    return [d1, d2];
  };
  const cost = (p) => { const [d1, d2] = dists(p); const m1 = d1.reduce((s, v) => s + v * v, 0) / d1.length, m2 = d2.reduce((s, v) => s + v * v, 0) / d2.length; return Math.sqrt((m1 + m2) / 2); };
  return { cost, dists };
}
function nelderMead(f, x0, steps, iters = 400) {
  const n = x0.length; let simplex = [x0.slice()]; for (let i = 0; i < n; i++) { const x = x0.slice(); x[i] += steps[i]; simplex.push(x); }
  let vals = simplex.map(f);
  for (let it = 0; it < iters; it++) {
    const idx = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]); simplex = idx.map((i) => simplex[i]); vals = idx.map((i) => vals[i]);
    const c = Array(n).fill(0); for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) c[k] += simplex[i][k] / n;
    const move = (t) => c.map((v, k) => v + t * (simplex[n][k] - v));
    const xr = move(-1), fr = f(xr);
    if (fr < vals[0]) { const xe = move(-2), fe = f(xe); if (fe < fr) { simplex[n] = xe; vals[n] = fe; } else { simplex[n] = xr; vals[n] = fr; } }
    else if (fr < vals[n - 1]) { simplex[n] = xr; vals[n] = fr; }
    else { const xc = move(fr < vals[n] ? -0.5 : 0.5), fc = f(xc); if (fc < Math.min(fr, vals[n])) { simplex[n] = xc; vals[n] = fc; } else { for (let i = 1; i <= n; i++) { simplex[i] = simplex[i].map((v, k) => simplex[0][k] + 0.5 * (v - simplex[0][k])); vals[i] = f(simplex[i]); } } }
  }
  const best = vals.indexOf(Math.min(...vals)); return { x: simplex[best], f: vals[best] };
}
const pOf = (v) => ({ beta: v[0], te: v[1], tn: v[2] });
// centroid of the OSM outer ring gives the starting translation
const cen = osmOuter.reduce((s, p) => [s[0] + p[0] / osmOuter.length, s[1] + p[1] / osmOuter.length], [0, 0]);
const outerOnly = makeCost(modelOuter, osmOuter);
const innerOnly = makeCost(modelInner, osmInner);
// Joint cost: the outer outline fixes size and position, the elongated inner ring (the pitch) fixes the rotation.
const outer = { dists: outerOnly.dists, cost: (p) => Math.sqrt((outerOnly.cost(p) ** 2 + innerOnly.cost(p) ** 2) / 2) };
// coarse search over the full circle in 5 degree steps (checks the 180 degree ambiguity), translation from centroid alignment
const coarse = [];
for (let beta = 0; beta < 360; beta += 5) {
  const r = nelderMead((v) => outer.cost(pOf([beta, v[0], v[1]])), [cen[0], cen[1]], [8, 8], 120);
  coarse.push({ beta, cost: r.f, te: r.x[0], tn: r.x[1] });
}
coarse.sort((a, b) => a.cost - b.cost);
console.log('best coarse bearings:', coarse.slice(0, 4).map((c) => `${c.beta} deg ${c.cost.toFixed(2)} m`).join(' | '));
const flip = coarse.find((c) => Math.abs(((c.beta - (coarse[0].beta + 180) + 540) % 360) - 180) < 6);
console.log('nearest 180-degree-flipped candidate:', flip.beta, flip.cost.toFixed(2), 'm');
const best = nelderMead((v) => outer.cost(pOf(v)), [coarse[0].beta, coarse[0].te, coarse[0].tn], [1, 2, 2], 400);
let p = pOf(best.x);
console.log('joint fit', p, 'joint rms', best.f.toFixed(3), 'outer-only rms', outerOnly.cost(p).toFixed(3), 'inner-only rms', innerOnly.cost(p).toFixed(3));
const [d1, d2] = outerOnly.dists(p); const allD = [...d1, ...d2].sort((a, b) => a - b);
const q = (a, f) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
const stats = { rms: outerOnly.cost(p), median: q(allD, 0.5), p90: q(allD, 0.9), p99: q(allD, 0.99), max: allD[allD.length - 1] };
console.log('outer outline distance stats (m):', stats);
const [i1, i2] = innerOnly.dists(p); const iD = [...i1, ...i2].sort((a, b) => a - b);
const innerStats = { rms: innerOnly.cost(p), median: q(iD, 0.5), p90: q(iD, 0.9), max: iD[iD.length - 1] };
console.log('inner ring (pitch) distance stats (m):', innerStats);

// Sensitivity: local fits (start at 345 degrees) with only the outer ring, only the inner ring, and the joint cost.
const variants = {};
for (const [name, fn] of [['outerOnly', outerOnly.cost], ['innerOnly', innerOnly.cost], ['joint', outer.cost]]) {
  const r = nelderMead((v) => fn(pOf(v)), [345, p.te, p.tn], [1, 2, 2], 400); variants[name] = { beta: r.x[0], te: r.x[1], tn: r.x[2], rms: r.f };
  console.log('local fit,', name, ':', `beta ${r.x[0].toFixed(2)}, shift E ${r.x[1].toFixed(1)} N ${r.x[2].toFixed(1)}, rms ${r.f.toFixed(2)}`);
}
// Uncertainty of beta: profile of the cost against beta with the translation re-optimised.
const profile = [];
for (let db = -3; db <= 3.001; db += 0.25) { const beta = p.beta + db; const r = nelderMead((v) => outer.cost(pOf([beta, v[0], v[1]])), [p.te, p.tn], [1, 1], 150); profile.push({ beta, cost: r.f }); }
const minC = Math.min(...profile.map((x) => x.cost));
console.log('profile (beta: rms)', profile.map((x) => `${x.beta.toFixed(2)}:${x.cost.toFixed(2)}`).join(' '));
// A fit is indistinguishable from the best when its rms is within sqrt(minC^2 + 0.5^2) (half a metre of extra misfit).
const lim = Math.sqrt(minC * minC + 0.5 * 0.5); const within = profile.filter((x) => x.cost <= lim);
console.log('bearings within 0.5 m of extra rms:', within[0]?.beta.toFixed(2), 'to', within[within.length - 1]?.beta.toFixed(2));

// Independent rotation check: the grass mesh long axis against the OSM pitch rectangles (228122478, 228122481).
const grassBox = ras.materials.New_material_014;
const pitchWay = (id) => { const g = ring(id); const edges = []; for (let i = 0; i < 4; i++) { const dx = g[i + 1][0] - g[i][0], dy = g[i + 1][1] - g[i][1]; edges.push({ len: Math.hypot(dx, dy), brg: ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 180 }); } edges.sort((a, b) => b.len - a.len); return edges[0]; };
const pitches = [228122478, 228122481].map((id) => ({ id, ...pitchWay(id) }));
console.log('OSM pitch rectangles, long-side bearing (mod 180):', pitches.map((x) => `${x.id}: ${x.brg.toFixed(1)} (${x.len.toFixed(0)} m)`).join(', '));
console.log('model grass box:', grassBox.min.map((v) => +v.toFixed(1)), grassBox.max.map((v) => +v.toFixed(1)));

// IoU of the filled OSM outer polygon against the model silhouette at the optimum
function rasterPoly(poly, p0, grid) { // rasterise an EN polygon into the model grid
  const pts = poly.map(([e, n]) => toModelFromEN(e, n, p0));
  for (let y = 0; y < N; y++) { const z = (y + 0.5) * CELL - HALF; const xs = [];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; if ((az <= z && bz > z) || (bz <= z && az > z)) xs.push(ax + ((z - az) / (bz - az)) * (bx - ax)); }
    xs.sort((a, b) => a - b); for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil((xs[k] + HALF) / CELL - 0.5); x <= Math.floor((xs[k + 1] + HALF) / CELL - 0.5); x++) if (x >= 0 && x < N) grid[y * N + x] = 1; }
}
const osmOuterMask = new Uint8Array(N * N), osmInnerMask = new Uint8Array(N * N);
rasterPoly(osmOuter, p, osmOuterMask); rasterPoly(osmInner, p, osmInnerMask);
let inter = 0, uni = 0; for (let i = 0; i < N * N; i++) { const a = silhouette[i], b = osmOuterMask[i]; if (a && b) inter++; if (a || b) uni++; }
const iouOuter = inter / uni;
console.log('IoU, OSM outer polygon vs model silhouette:', iouOuter.toFixed(3));

// Overlay image in the model frame, 1 px per cell (800 x 800): silhouette grey, roof green, OSM outer red, OSM inner blue, grass box yellow.
const img = new Uint8Array(N * N * 3).fill(255);
for (let i = 0; i < N * N; i++) { if (silhouette[i]) { img[i * 3] = img[i * 3 + 1] = img[i * 3 + 2] = 200; } if (roof[i]) { img[i * 3] = 140; img[i * 3 + 1] = 190; img[i * 3 + 2] = 140; } }
const mark = (pts, c) => { for (const [x, z] of pts) { const gx = Math.floor((x + HALF) / CELL), gz = Math.floor((z + HALF) / CELL); for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const px = gx + dx, pz = gz + dz; if (px >= 0 && pz >= 0 && px < N && pz < N) { img.set(c, (pz * N + px) * 3); } } } };
mark(densify(osmOuter, 0.5).map(([e, n]) => toModelFromEN(e, n, p)), [220, 30, 30]);
mark(densify(osmInner, 0.5).map(([e, n]) => toModelFromEN(e, n, p)), [30, 30, 220]);
fs.writeFileSync(path.join(HERE, '../data/fit_overlay.png'), png(N, N, img));

const result = { jointRms: best.f, method: 'joint chamfer fit of the OSM outer ring to the model silhouette and the OSM inner ring to the grass mesh', reference: { lat: 53.3352, lon: -6.2284 }, bearingOfPlusZ: p.beta, originOffsetMetres: { east: p.te, north: p.tn }, outer: stats, iouOuter, bearingRangeWithinHalfMetre: [within[0].beta, within[within.length - 1].beta], profile, coarseBest: coarse.slice(0, 5), inner: innerStats, variants, osmPitchBearings: pitches, priorBearing: 345 };
fs.writeFileSync(path.join(HERE, '../data/fit.json'), JSON.stringify(result, null, 1));
if (process.env.DEBUG_COARSE) console.log(coarse.sort((a, b) => a.beta - b.beta).map((c) => `${c.beta}:${c.cost.toFixed(2)}`).join(' '));
