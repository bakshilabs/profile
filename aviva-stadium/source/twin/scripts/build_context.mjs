// Builds the surrounding context for the stadium from OpenStreetMap (ODbL): extruded buildings, roads, railway, platforms,
// green areas and water, in the stadium model's frame (metres, Y up, origin at the model footprint centre, ground at y = 0).
// Reads twin/downloads/osm/osm.json and twin/data/fit.json. Writes viewer/public/twin/context.glb, viewer/public/twin/georef.json
// and twin/data/context_stats.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { toEN, fromEN, REF } from './geo.mjs';
import { writeGLB } from './gltf_writer.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RADIUS = 420;           // metres from the stadium model centre; buildings whose centroid lies inside are extruded
const STOREY = 3.0;           // metres per storey, used when only building:levels is tagged
const DEFAULT_LEVELS = { _: 2, shed: 1, garage: 1, garages: 1, carport: 1, hut: 1, kiosk: 1, service: 1, roof: 1, container: 1,
  apartments: 3, residential: 3, retail: 3, commercial: 3, office: 3, hotel: 3, industrial: 2, school: 2, university: 3, college: 3, kindergarten: 1, church: 2, temple: 2, police: 2, train_station: 2, grandstand: 2 };

const osm = JSON.parse(fs.readFileSync(path.join(HERE, '../downloads/osm/osm.json'), 'utf8'));
const fit = JSON.parse(fs.readFileSync(path.join(HERE, '../data/fit.json'), 'utf8'));
const beta = (fit.bearingOfPlusZ * Math.PI) / 180, te = fit.originOffsetMetres.east, tn = fit.originOffsetMetres.north;
const enToModel = (e, n) => { const de = e - te, dn = n - tn; return [-de * Math.cos(beta) + dn * Math.sin(beta), de * Math.sin(beta) + dn * Math.cos(beta)]; };
const llToModel = (p) => { const { e, n } = toEN(p.lat, p.lon); return enToModel(e, n); };

// ---------- geometry helpers
const area2 = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length]; a += x0 * z1 - x1 * z0; } return a; };
const centroid = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
const same = (a, b) => a.lat === b.lat && a.lon === b.lon;
function assembleRings(ways) { // join way fragments end to end into closed rings (lat/lon objects)
  const open = ways.map((w) => w.slice()); const rings = [];
  while (open.length) {
    let cur = open.pop();
    while (!same(cur[0], cur[cur.length - 1])) {
      const i = open.findIndex((w) => same(w[0], cur[cur.length - 1]) || same(w[w.length - 1], cur[cur.length - 1]) || same(w[0], cur[0]) || same(w[w.length - 1], cur[0]));
      if (i < 0) break; let w = open.splice(i, 1)[0];
      if (same(w[0], cur[cur.length - 1])) cur = cur.concat(w.slice(1));
      else if (same(w[w.length - 1], cur[cur.length - 1])) cur = cur.concat(w.slice(0, -1).reverse());
      else if (same(w[w.length - 1], cur[0])) cur = w.concat(cur.slice(1));
      else cur = w.slice().reverse().concat(cur.slice(1));
    }
    if (cur.length > 3 && same(cur[0], cur[cur.length - 1])) rings.push(cur.slice(0, -1));
  }
  return rings;
}
function featurePolygons(e) { // [{ outer: [[x,z]...], holes: [[...]] }] in the model frame
  if (e.type === 'way') { const g = e.geometry; if (!g || g.length < 4 || !same(g[0], g[g.length - 1])) return []; return [{ outer: g.slice(0, -1).map(llToModel), holes: [] }]; }
  if (e.type === 'relation' && e.tags?.type === 'multipolygon') {
    const outers = assembleRings(e.members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry).map((m) => m.geometry));
    const inners = assembleRings(e.members.filter((m) => m.type === 'way' && m.role === 'inner' && m.geometry).map((m) => m.geometry));
    const inPoly = (pt, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { if ((poly[i][1] > pt[1]) !== (poly[j][1] > pt[1]) && pt[0] < ((poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1])) / (poly[j][1] - poly[i][1]) + poly[i][0]) c = !c; } return c; };
    const O = outers.map((r) => r.map(llToModel)), I = inners.map((r) => r.map(llToModel));
    return O.map((outer) => ({ outer, holes: I.filter((h) => inPoly(h[0], outer)) }));
  }
  return [];
}

// ---------- mesh accumulators
class Mesh {
  constructor() { this.pos = []; this.nor = []; this.idx = []; }
  tri(a, b, c, n) { const base = this.pos.length / 3; for (const v of [a, b, c]) { this.pos.push(...v); this.nor.push(...n); } this.idx.push(base, base + 1, base + 2); }
  // triangle with the winding fixed so that its geometric normal agrees with n
  triOriented(a, b, c, n) { const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]; const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]; if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) this.tri(a, b, c, n); else this.tri(a, c, b, n); }
  prim(material) { return { positions: new Float32Array(this.pos), normals: new Float32Array(this.nor), indices: new Uint32Array(this.idx), material }; }
}
function flatPolygon(mesh, poly, y) {
  const contour = poly.outer.map(([x, z]) => new THREE.Vector2(x, z)); const holes = poly.holes.map((h) => h.map(([x, z]) => new THREE.Vector2(x, z)));
  const tris = THREE.ShapeUtils.triangulateShape(contour, holes); const all = contour.concat(...holes);
  for (const [a, b, c] of tris) mesh.triOriented([all[a].x, y, all[a].y], [all[b].x, y, all[b].y], [all[c].x, y, all[c].y], [0, 1, 0]);
}
function extrude(walls, roofs, poly, h) {
  flatPolygonAt(roofs, poly, h);
  for (const ring of [poly.outer, ...poly.holes]) {
    const isOuter = ring === poly.outer; const s = Math.sign(area2(ring)) * (isOuter ? 1 : -1);
    for (let i = 0; i < ring.length; i++) {
      const [x0, z0] = ring[i], [x1, z1] = ring[(i + 1) % ring.length]; const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 0.05) continue;
      const nrm = [(s * dz) / L, 0, (-s * dx) / L]; // outward for the outer ring, into the hole for holes (away from the solid)
      const A = [x0, 0, z0], B = [x1, 0, z1], At = [x0, h, z0], Bt = [x1, h, z1];
      walls.triOriented(A, B, Bt, nrm); walls.triOriented(A, Bt, At, nrm);
    }
  }
}
const flatPolygonAt = (mesh, poly, y) => flatPolygon(mesh, poly, y);
function ribbon(mesh, pts, width, y) { // flat strip along a polyline, mitred joins
  if (pts.length < 2) return; const hw = width / 2; const left = [], right = [];
  const dirs = []; for (let i = 0; i < pts.length - 1; i++) { const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dz) || 1; dirs.push([dx / L, dz / L]); }
  for (let i = 0; i < pts.length; i++) {
    const d0 = dirs[Math.max(0, i - 1)], d1 = dirs[Math.min(dirs.length - 1, i)]; let nx = -(d0[1] + d1[1]), nz = d0[0] + d1[0]; const L = Math.hypot(nx, nz);
    if (L < 1e-6) { nx = -d1[1]; nz = d1[0]; } else { nx /= L; nz /= L; } const dot = nx * -d1[1] + nz * d1[0]; const k = hw / Math.max(0.5, dot);
    left.push([pts[i][0] + nx * k, pts[i][1] + nz * k]); right.push([pts[i][0] - nx * k, pts[i][1] - nz * k]);
  }
  for (let i = 0; i < pts.length - 1; i++) { const a = [left[i][0], y, left[i][1]], b = [right[i][0], y, right[i][1]], c = [right[i + 1][0], y, right[i + 1][1]], d = [left[i + 1][0], y, left[i + 1][1]]; mesh.triOriented(a, b, c, [0, 1, 0]); mesh.triOriented(a, c, d, [0, 1, 0]); }
}

// ---------- buildings
const walls = new Mesh(), roofs = new Mesh(), wallsNS = new Mesh(), roofsNS = new Mesh();
// Houses beyond the north and south ends of the pitch axis (used by the story page to point out the neighbours to the north and south).
const isNS = (c) => Math.abs(c[0]) < 90 && (c[1] > 98 || c[1] < -102) && Math.hypot(c[0], c[1]) < 230;
const stats = { buildings: { total: 0, withHeightTag: 0, withLevelsTag: 0, defaulted: 0, skippedOutsideRadius: 0, skippedStadium: 0, maxHeight: 0 }, radiusMetres: RADIUS, storeyMetres: STOREY };
const heightLog = [];
for (const e of osm.elements) {
  const t = e.tags; if (!t || !t.building || !['way', 'relation'].includes(e.type)) continue;
  if (e.id === 3357396 && e.type === 'relation') { stats.buildings.skippedStadium++; continue; } // replaced by the detailed model
  for (const poly of featurePolygons(e)) {
    const c = centroid(poly.outer); if (Math.hypot(c[0], c[1]) > RADIUS) { stats.buildings.skippedOutsideRadius++; continue; }
    let h, src;
    const hv = parseFloat(String(t.height ?? '').replace(',', '.'));
    if (Number.isFinite(hv) && hv > 0) { h = hv; src = 'height'; stats.buildings.withHeightTag++; }
    else if (Number.isFinite(parseFloat(t['building:levels']))) { h = parseFloat(t['building:levels']) * STOREY; src = 'levels'; stats.buildings.withLevelsTag++; }
    else { h = (DEFAULT_LEVELS[t.building] ?? DEFAULT_LEVELS._) * STOREY; src = 'default'; stats.buildings.defaulted++; }
    h = Math.max(2.5, h); stats.buildings.total++; stats.buildings.maxHeight = Math.max(stats.buildings.maxHeight, h);
    heightLog.push({ id: e.id, h, src, x: +c[0].toFixed(1), z: +c[1].toFixed(1) });
    if (isNS(c)) { extrude(wallsNS, roofsNS, poly, h); stats.buildings.northSouthHighlighted = (stats.buildings.northSouthHighlighted ?? 0) + 1; } else extrude(walls, roofs, poly, h);
  }
}

// ---------- roads, railway, platforms, green, water
const roads = new Mesh(), rails = new Mesh(), platforms = new Mesh(), green = new Mesh(), water = new Mesh();
const ROAD_W = { motorway: 14, trunk: 12, primary: 10, secondary: 9, tertiary: 8, tertiary_link: 6, unclassified: 6.5, residential: 6.5, living_street: 5, service: 4, pedestrian: 5, footway: 2, cycleway: 2.5, path: 1.8, steps: 1.6, track: 3, corridor: 1.5 };
const stat = { roadWays: 0, railWays: 0, platforms: 0, green: 0, water: 0 };
const inRange = (pts) => { const c = centroid(pts); return Math.hypot(c[0], c[1]) <= RADIUS + 20; };
const clipPolyline = (pts) => { // keep the part of the line inside the radius
  const out = []; let cur = []; for (const p of pts) { if (Math.hypot(p[0], p[1]) <= RADIUS + 30) cur.push(p); else { if (cur.length > 1) out.push(cur); cur = []; } } if (cur.length > 1) out.push(cur); return out; };
for (const e of osm.elements) {
  const t = e.tags; if (!t) continue;
  if (e.type === 'way' && e.geometry) {
    const pts = e.geometry.map(llToModel);
    if (t.tunnel === 'yes' || t.tunnel === 'building_passage' || t.covered === 'yes' && t.highway === 'corridor') continue;
    if (t.highway && ROAD_W[t.highway] && !t.building) {
      const w = parseFloat(t.width) || ROAD_W[t.highway];
      for (const seg of clipPolyline(pts)) { ribbon(roads, seg, w, 0.14); stat.roadWays++; }
    } else if (t.railway === 'rail' || t.railway === 'light_rail' || t.railway === 'tram' || t.railway === 'narrow_gauge') {
      for (const seg of clipPolyline(pts)) { ribbon(rails, seg, 3.2, 0.17); stat.railWays++; }
    } else if (t.railway === 'platform') {
      const g = featurePolygons(e); if (g.length && inRange(pts)) { for (const p of g) flatPolygon(platforms, p, 0.16); stat.platforms++; } else for (const seg of clipPolyline(pts)) { ribbon(platforms, seg, 4, 0.16); stat.platforms++; }
    } else if (t.waterway && ['river', 'stream', 'canal'].includes(t.waterway)) {
      for (const seg of clipPolyline(pts)) { ribbon(water, seg, parseFloat(t.width) || (t.waterway === 'river' ? 14 : 6), 0.11); stat.water++; }
    } else if (t.natural === 'water' || t.natural === 'wetland') { for (const p of featurePolygons(e)) if (inRange(p.outer)) { flatPolygon(water, p, 0.11); stat.water++; } }
    else if (['park', 'garden', 'pitch', 'playground', 'golf_course', 'track', 'sports_centre'].includes(t.leisure) && !t.building || ['grass', 'recreation_ground', 'meadow', 'village_green', 'cemetery', 'allotments', 'forest'].includes(t.landuse) || t.natural === 'wood' || t.natural === 'scrub') {
      if (t.leisure === 'sports_centre' || t.leisure === 'track') continue;
      for (const p of featurePolygons(e)) if (inRange(p.outer)) { flatPolygon(green, p, 0.10); stat.green++; }
    }
  } else if (e.type === 'relation' && t.type === 'multipolygon' && !t.building) {
    if (t.natural === 'water') for (const p of featurePolygons(e)) if (inRange(p.outer)) { flatPolygon(water, p, 0.11); stat.water++; }
    else if (['park', 'garden'].includes(t.leisure) || ['grass', 'recreation_ground'].includes(t.landuse)) for (const p of featurePolygons(e)) if (inRange(p.outer)) { flatPolygon(green, p, 0.10); stat.green++; }
  }
}
Object.assign(stats, { features: stat });

const mat = (name, rgb, rough = 1, extra = {}) => ({ name, pbrMetallicRoughness: { baseColorFactor: [...rgb, 1], metallicFactor: 0, roughnessFactor: rough }, doubleSided: true, ...extra });
const materials = [
  mat('Context building walls', [0.80, 0.78, 0.75]), mat('Context building roofs', [0.50, 0.47, 0.45]), mat('Context road', [0.22, 0.23, 0.25]),
  mat('Context rail', [0.10, 0.10, 0.11]), mat('Context platform', [0.58, 0.58, 0.57]), mat('Context green', [0.40, 0.55, 0.30]), mat('Context water', [0.33, 0.50, 0.66], 0.4),
  mat('Context north and south walls', [0.80, 0.78, 0.75]), mat('Context north and south roofs', [0.50, 0.47, 0.45]),
];
const origin = fromEN(te, tn);
const extras = { frame: 'Stadium model frame: metres, Y up, origin at the model footprint centre, ground at y = 0. +Z has compass bearing bearingOfPlusZ.', bearingOfPlusZ: fit.bearingOfPlusZ, originLatLon: origin, source: 'OpenStreetMap contributors, ODbL', radiusMetres: RADIUS };
const nodes = [
  { name: 'context_buildings', primitives: [walls.prim(0), roofs.prim(1)] }, { name: 'context_buildings_ns', primitives: [wallsNS.prim(7), roofsNS.prim(8)] }, { name: 'context_roads', primitives: [roads.prim(2)] }, { name: 'context_rail', primitives: [rails.prim(3), platforms.prim(4)] },
  { name: 'context_green', primitives: [green.prim(5)] }, { name: 'context_water', primitives: [water.prim(6)] },
];
fs.mkdirSync(path.join(HERE, '../../viewer/public/twin'), { recursive: true });
const out = writeGLB(path.join(HERE, '../../viewer/public/twin/context.glb'), { materials, nodes, extras });
const georef = {
  description: 'Georeferencing of aviva_stadium.glb in the viewer frame (metres, Y up, footprint centre at the origin).',
  referencePoint: REF, bearingOfPlusZ: fit.bearingOfPlusZ, bearingUncertaintyDegrees: 2, originOffsetFromReferenceMetres: { east: te, north: tn }, originLatLon: origin,
  transform: 'east = -x*cos(b) + z*sin(b) + te ; north = x*sin(b) + z*cos(b) + tn   (b = bearingOfPlusZ in radians)',
  northInModelXZ: [Math.sin(beta), Math.cos(beta)], eastInModelXZ: [-Math.cos(beta), Math.sin(beta)],
  fit: { outerRmsMetres: fit.outer.rms, innerRmsMetres: fit.inner.rms, iouOuter: fit.iouOuter },
};
fs.writeFileSync(path.join(HERE, '../../viewer/public/twin/georef.json'), JSON.stringify(georef, null, 1));
fs.writeFileSync(path.join(HERE, '../data/context_stats.json'), JSON.stringify({ ...stats, glb: out }, null, 1));
fs.writeFileSync(path.join(HERE, '../data/context_buildings.json'), JSON.stringify(heightLog));
console.log(JSON.stringify({ ...stats, glb: out }, null, 1));
