import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Loads the stadium exactly as the viewer places it: millimetres to metres, footprint centred on the origin,
// lowest point on y = 0. Y is up. World matrices are updated before returning.
export async function loadStadium(path) {
  const buf = fs.readFileSync(path);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const gltf = await new GLTFLoader().parseAsync(ab, '');
  const model = gltf.scene;
  model.scale.setScalar(0.001);
  const site = new THREE.Group();
  site.add(model);
  site.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  site.updateMatrixWorld(true);
  return model;
}
