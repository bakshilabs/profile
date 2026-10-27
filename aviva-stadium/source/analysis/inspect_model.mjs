import * as THREE from 'three';
import { loadStadium } from './lib/model.mjs';

const model = await loadStadium(process.argv[2]);
const stats = new Map();
const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
model.traverse((o) => {
  if (!o.isMesh) return;
  const name = o.material.name;
  let s = stats.get(name);
  if (!s) { s = { meshes: 0, tris: 0, area: 0, upArea: 0, alpha: o.material.opacity, transparent: o.material.transparent, box: new THREE.Box3(), color: o.material.color.getHexString() }; stats.set(name, s); }
  s.meshes++;
  const p = o.geometry.attributes.position, idx = o.geometry.index;
  s.tris += idx.count / 3;
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(p, idx.getX(i)).applyMatrix4(o.matrixWorld);
    b.fromBufferAttribute(p, idx.getX(i + 1)).applyMatrix4(o.matrixWorld);
    c.fromBufferAttribute(p, idx.getX(i + 2)).applyMatrix4(o.matrixWorld);
    s.box.expandByPoint(a); s.box.expandByPoint(b); s.box.expandByPoint(c);
    const n = v.copy(b).sub(a).cross(c.clone().sub(a));
    const ar = n.length() / 2;
    s.area += ar;
    if (n.y > 0 && n.y / n.length() > 0.3) s.upArea += ar;
  }
});
for (const [name, s] of stats) {
  const r = (x) => x.toFixed(1);
  console.log(`${name.padEnd(18)} meshes ${String(s.meshes).padStart(3)} tris ${String(s.tris).padStart(8)} area ${r(s.area).padStart(9)} up ${r(s.upArea).padStart(9)} alpha ${s.alpha.toFixed(2)} col #${s.color}`,
    `x[${r(s.box.min.x)},${r(s.box.max.x)}] y[${r(s.box.min.y)},${r(s.box.max.y)}] z[${r(s.box.min.z)},${r(s.box.max.z)}]`);
}
