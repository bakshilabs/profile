// Shared by the annual and per-frame exposure scripts: loads the stadium, builds a ray-casting structure over
// every sun-blocking triangle, picks sample points on the pitch and in the seating bowl, and computes the sky
// view factor of each point.
import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import { loadStadium } from './model.mjs';

const POINT_HEIGHT = 1.2;  // metres above the surface: head height of a seated or standing person
const OPAQUE_FROM = 0.5;   // materials at least this opaque block the sun (the faint glass does not)
const GROUND = 'New_material_016';
const GRASS = 'New_material_014';
const SEATS = 'New_material_018';

export const DOWN = new THREE.Vector3(0, -1, 0);
export const UP = new THREE.Vector3(0, 1, 0);

function buildBVH(meshes) {
  let nv = 0, ni = 0;
  for (const m of meshes) { nv += m.geometry.attributes.position.count; ni += m.geometry.index.count; }
  const pos = new Float32Array(nv * 3);
  const idx = new Uint32Array(ni);
  const v = new THREE.Vector3();
  let vo = 0, io = 0;
  for (const m of meshes) {
    const p = m.geometry.attributes.position, ix = m.geometry.index;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld);
      pos.set([v.x, v.y, v.z], (vo + i) * 3);
    }
    for (let i = 0; i < ix.count; i++) idx[io + i] = ix.getX(i) + vo;
    vo += p.count; io += ix.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return { bvh: new MeshBVH(g), tris: ni / 3 };
}

// Tregenza dome: 145 patches, with solid angle x sin(altitude) as the weight for a horizontal plane.
function tregenzaDome() {
  const patches = [];
  const bands = [[6, 30], [18, 30], [30, 24], [42, 24], [54, 18], [66, 12], [78, 6], [90, 1]];
  const edges = [0, 12, 24, 36, 48, 60, 72, 84, 90];
  bands.forEach(([alt, count], b) => {
    const solid = (2 * Math.PI * (Math.sin(THREE.MathUtils.degToRad(edges[b + 1])) - Math.sin(THREE.MathUtils.degToRad(edges[b])))) / count;
    for (let i = 0; i < count; i++) {
      const az = THREE.MathUtils.degToRad((i * 360) / count);
      const al = THREE.MathUtils.degToRad(alt);
      patches.push({
        dir: new THREE.Vector3(Math.cos(al) * Math.sin(az), Math.sin(al), Math.cos(al) * Math.cos(az)),
        weight: solid * Math.sin(al),
      });
    }
  });
  return patches;
}

export async function prepareSamples(glbPath, { pitchCell, standCell, log = () => {} }) {
  const model = await loadStadium(glbPath);
  log('model loaded');

  const blockers = [];
  const seatMeshes = [];
  let grassMesh = null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.material.name;
    if (n === GRASS) grassMesh = o;
    if (n === SEATS) seatMeshes.push(o);
    if (n !== GROUND && n !== GRASS && o.material.opacity >= OPAQUE_FROM) blockers.push(o);
  });
  const blockerBVH = buildBVH(blockers);
  const grassBVH = buildBVH([grassMesh]).bvh;
  log(`BVH built over ${(blockerBVH.tris / 1e6).toFixed(2)}M triangles from ${blockers.length} meshes`);

  const ray = new THREE.Ray();
  const hit = (bvh, ox, oy, oz, dir, far) => {
    ray.origin.set(ox, oy, oz);
    ray.direction.copy(dir);
    return bvh.raycastFirst(ray, THREE.DoubleSide, 0, far);
  };
  const blocked = (p, dir, far = 3000) => !!hit(blockerBVH.bvh, p.x, p.y, p.z, dir, far);

  // Pitch points: a regular grid snapped to the grass surface.
  const pts = [];
  const gb = new THREE.Box3().setFromObject(grassMesh);
  for (let x = Math.ceil(gb.min.x / pitchCell) * pitchCell; x <= gb.max.x; x += pitchCell) {
    for (let z = Math.ceil(gb.min.z / pitchCell) * pitchCell; z <= gb.max.z; z += pitchCell) {
      const h = hit(grassBVH, x, 20, z, DOWN, 40);
      if (h) pts.push({ x, y: h.point.y + POINT_HEIGHT, z, kind: 0 });
    }
  }
  const nPitch = pts.length;

  // Stand points: up-facing seat triangles binned in plan, one point per height band in each cell.
  const cells = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (const m of seatMeshes) {
    const p = m.geometry.attributes.position, ix = m.geometry.index;
    for (let i = 0; i < ix.count; i += 3) {
      a.fromBufferAttribute(p, ix.getX(i)).applyMatrix4(m.matrixWorld);
      b.fromBufferAttribute(p, ix.getX(i + 1)).applyMatrix4(m.matrixWorld);
      c.fromBufferAttribute(p, ix.getX(i + 2)).applyMatrix4(m.matrixWorld);
      n.copy(b).sub(a).cross(c.clone().sub(a));
      if (n.y <= 0 || n.y / n.length() < 0.7) continue;
      const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
      const key = `${Math.floor(cx / standCell)},${Math.floor(cz / standCell)}`;
      let list = cells.get(key);
      if (!list) cells.set(key, (list = []));
      list.push([cx, cy, cz]);
    }
  }
  let droppedPitch = 0, droppedCovered = 0;
  for (const list of cells.values()) {
    list.sort((p, q) => p[1] - q[1]);
    let group = [list[0]];
    const flush = () => {
      const mx = group.reduce((s, p) => s + p[0], 0) / group.length;
      const my = group.reduce((s, p) => s + p[1], 0) / group.length;
      const mz = group.reduce((s, p) => s + p[2], 0) / group.length;
      const onPitch = hit(grassBVH, mx, 100, mz, DOWN, 200);
      if (onPitch && my < 3) droppedPitch++;
      else if (hit(blockerBVH.bvh, mx, my + 0.5, mz, UP, 2.0)) droppedCovered++; // under a slab, not a seat with sky above
      else pts.push({ x: mx, y: my + POINT_HEIGHT, z: mz, kind: 1 });
    };
    for (let i = 1; i < list.length; i++) {
      if (list[i][1] - list[i - 1][1] > 2.5) { flush(); group = []; }
      group.push(list[i]);
    }
    flush();
  }
  log(`${nPitch} pitch points, ${pts.length - nPitch} stand points (dropped ${droppedPitch} on pitch, ${droppedCovered} under slabs)`);

  // Sky view factor, cosine-weighted.
  const dome = tregenzaDome();
  const totalWeight = dome.reduce((s, t) => s + t.weight, 0);
  for (const p of pts) {
    let open = 0;
    for (const t of dome) if (!blocked(p, t.dir)) open += t.weight;
    p.svf = open / totalWeight;
  }
  log('sky view factors done');

  return { pts, nPitch, blocked, pitchCell, standCell, pointHeight: POINT_HEIGHT };
}

export function pointsJson(samples, extra = {}) {
  const { pts, pitchCell, standCell, pointHeight } = samples;
  return {
    pitchCell, standCell, pointHeight,
    kind: pts.map((p) => p.kind),
    x: pts.map((p) => +p.x.toFixed(2)),
    y: pts.map((p) => +p.y.toFixed(2)),
    z: pts.map((p) => +p.z.toFixed(2)),
    svf: pts.map((p) => +p.svf.toFixed(4)),
    ...extra,
  };
}
