// Highest point of the model (any mesh except the ground plane) in four sectors around the pitch, in metres above the model base.
// Sectors are defined in the model frame, where the pitch long axis runs along Z. North end is +Z (bearing about 344 degrees).
import * as THREE from 'three';
import { loadStadium } from '../../analysis/lib/model.mjs';
const model = await loadStadium(new URL('../../aviva_stadium.glb', import.meta.url).pathname);
const v = new THREE.Vector3();
const sectors = { 'north end': (x, z) => z > 70 && Math.abs(x) < 35, 'south end': (x, z) => z < -70 && Math.abs(x) < 35, 'east side': (x, z) => { return false; }, 'west side': () => false };
// east and west sides are +/-X in the model frame once the sign is fixed from the georeference: east = (-cos b, sin b)
const b = (343.5531910800453 * Math.PI) / 180, east = [-Math.cos(b), Math.sin(b)];
sectors['east side'] = (x, z) => x * east[0] + z * east[1] > 70 && Math.abs(-x * east[1] + z * east[0]) < 35 + 0;
sectors['west side'] = (x, z) => x * east[0] + z * east[1] < -70 && Math.abs(-x * east[1] + z * east[0]) < 35;
const out = Object.fromEntries(Object.keys(sectors).map((k) => [k, { top: 0, topSeating: 0 }]));
model.updateMatrixWorld(true);
model.traverse((o) => {
  if (!o.isMesh || o.material.name === 'New_material_016') return;
  const p = o.geometry.attributes.position; const seats = o.material.name === 'New_material_018';
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); for (const [k, f] of Object.entries(sectors)) if (f(v.x, v.z)) { out[k].top = Math.max(out[k].top, v.y); if (seats) out[k].topSeating = Math.max(out[k].topSeating, v.y); } }
});
for (const [k, r] of Object.entries(out)) console.log(k.padEnd(10), 'highest point', r.top.toFixed(1), 'm, highest seat', r.topSeating.toFixed(1), 'm');
