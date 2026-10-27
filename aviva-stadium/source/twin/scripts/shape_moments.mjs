// Diagnostic: principal axes of the OSM rings (as bearings) and of the model silhouettes (as angles in the model frame).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toEN } from './geo.mjs';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const osm = JSON.parse(fs.readFileSync(path.join(HERE, '../downloads/osm/osm.json'), 'utf8'));
const rel = osm.elements.find((e) => e.type === 'relation' && e.id === 3357396);
const geo = (ref) => rel.members.find((m) => m.ref === ref).geometry.map((p) => { const { e, n } = toEN(p.lat, p.lon); return [e, n]; });
function polyMoments(poly) { // area, centroid, covariance of the filled polygon
  let A = 0, cx = 0, cy = 0; for (let i = 0; i < poly.length - 1; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[i + 1]; const c = x0 * y1 - x1 * y0; A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; }
  A /= 2; cx /= 6 * A; cy /= 6 * A;
  let Ixx = 0, Iyy = 0, Ixy = 0; for (let i = 0; i < poly.length - 1; i++) { const [x0, y0] = [poly[i][0] - cx, poly[i][1] - cy], [x1, y1] = [poly[i + 1][0] - cx, poly[i + 1][1] - cy]; const c = x0 * y1 - x1 * y0; Ixx += (y0 * y0 + y0 * y1 + y1 * y1) * c; Iyy += (x0 * x0 + x0 * x1 + x1 * x1) * c; Ixy += (x0 * y1 + 2 * x0 * y0 + 2 * x1 * y1 + x1 * y0) * c; }
  const sgn = Math.sign(A); A = Math.abs(A); Ixx = Math.abs(Ixx / 12); Iyy = Math.abs(Iyy / 12); Ixy = (Ixy / 24) * sgn;
  // Ixx is the second moment about the x axis (sum y^2), Iyy about y (sum x^2)
  return { area: A, cx, cy, sxx: Iyy / A, syy: Ixx / A, sxy: Ixy / A }; // covariance of x,y
}
function axes(m) { const th = 0.5 * Math.atan2(2 * m.sxy, m.sxx - m.syy); const l1 = (m.sxx + m.syy) / 2 + Math.hypot((m.sxx - m.syy) / 2, m.sxy), l2 = (m.sxx + m.syy) / 2 - Math.hypot((m.sxx - m.syy) / 2, m.sxy); return { majorAngle: th, ratio: Math.sqrt(l1 / l2), sd: [Math.sqrt(l1), Math.sqrt(l2)] }; }
for (const [name, ref] of [['outer', 249663148], ['inner', 249663147]]) {
  const m = polyMoments(geo(ref)); const a = axes(m);
  const brg = ((90 - (a.majorAngle * 180) / Math.PI) % 180 + 180) % 180; // major axis as compass bearing (mod 180)
  console.log(`OSM ${name}: area ${m.area.toFixed(0)} m2, centroid E ${m.cx.toFixed(1)} N ${m.cy.toFixed(1)}, major axis bearing ${brg.toFixed(1)} (mod 180), axis ratio ${a.ratio.toFixed(3)}`);
}
// model masks
const ras = JSON.parse(fs.readFileSync(path.join(HERE, '../data/model_raster.json'), 'utf8')); const { cell, half, n } = ras;
for (const key of ['all', 'roof', 'low', 'grass', 'seats']) {
  const g = new Uint8Array(Buffer.from(ras[key], 'base64')); let c = 0, sx = 0, sz = 0, sxx = 0, szz = 0, sxz = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (g[j * n + i]) { const x = (i + 0.5) * cell - half, z = (j + 0.5) * cell - half; c++; sx += x; sz += z; sxx += x * x; szz += z * z; sxz += x * z; }
  const mx = sx / c, mz = sz / c; const m = { sxx: sxx / c - mx * mx, syy: szz / c - mz * mz, sxy: sxz / c - mx * mz }; const a = axes(m);
  console.log(`model ${key} (filled cells only, hollow shapes): centroid x ${mx.toFixed(1)} z ${mz.toFixed(1)}, major axis angle from +x toward +z ${(a.majorAngle * 180 / Math.PI).toFixed(1)}, ratio ${a.ratio.toFixed(3)}`);
}
