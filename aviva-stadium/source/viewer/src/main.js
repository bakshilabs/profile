import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { compassToModel } from './site.js';
import { initSun } from './sun.js';

const MODEL_URL = '/aviva_stadium.glb';
// The GLB is authored in millimetres. The Sketchfab root node already converts Z-up to Y-up.
const MM_TO_M = 0.001;

const container = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdfe6ec);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f94, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-200, 300, 150);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.3;
scene.add(sun, sun.target);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1500, 64),
  new THREE.MeshStandardMaterial({ color: 0xc9d1d8, roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

// Analysis code will rotate this group to apply the true north angle.
const site = new THREE.Group();
site.name = 'site';
scene.add(site);

// Red arrow on the pitch pointing at true north. It draws over the model so it stays visible.
const northArrow = new THREE.ArrowHelper(compassToModel(0), new THREE.Vector3(0, 1, 10), 60, 0xe02020, 14, 8);
for (const part of [northArrow.line, northArrow.cone]) {
  part.material.depthTest = false;
  part.material.transparent = true; // draws in the transparent pass, after the model
  part.renderOrder = 10;
}
site.add(northArrow);

const setProgress =(fraction, text) => {
  document.getElementById('fill').style.width = `${Math.round(fraction * 100)}%`;
  if (text) document.getElementById('status').textContent = text;
};

new GLTFLoader().load(
  MODEL_URL,
  (gltf) => {
    const model = gltf.scene;
    model.scale.setScalar(MM_TO_M);
    site.add(model);

    let meshes = 0;
    let triangles = 0;
    model.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      triangles += o.geometry.index.count / 3;
      const m = o.material;
      if (m.transparent) m.depthWrite = false;
      // Surfaces that are at least half opaque block the sun. The faint glass does not.
      o.castShadow = m.opacity >= 0.5;
      o.receiveShadow = true;
    });

    // Centre the footprint on the origin and sit the lowest point on y = 0.
    site.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    site.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());

    const r = Math.max(size.x, size.z);
    camera.position.set(r * 0.9, r * 0.7, r * 0.9);
    controls.target.set(0, size.y * 0.3, 0);
    controls.update();
    // Wide enough for the long winter shadows, which reach well beyond the stadium footprint.
    sun.shadow.camera.left = -r * 1.1;
    sun.shadow.camera.right = r * 1.1;
    sun.shadow.camera.top = r * 1.1;
    sun.shadow.camera.bottom = -r * 1.1;
    sun.shadow.camera.far = 1500;
    sun.shadow.camera.updateProjectionMatrix();
    initSun({ scene, sun, hemi, shadowsOn: () => document.getElementById('shadows').checked }).catch(console.error);

    document.getElementById('stats').textContent =
      `${meshes} meshes, ${(triangles / 1e6).toFixed(2)}M triangles, ` +
      `${size.x.toFixed(0)} x ${size.z.toFixed(0)} m, ${size.y.toFixed(1)} m high`;
    document.getElementById('loading').style.opacity = '0';
    setTimeout(() => document.getElementById('loading').remove(), 500);
    window.__viewer = { THREE, scene, camera, controls, renderer, sun, site, model, size };
  },
  (e) => {
    if (e.lengthComputable) setProgress(e.loaded / e.total, `Loading model ${(e.loaded / 1e6).toFixed(0)} of ${(e.total / 1e6).toFixed(0)} MB`);
  },
  (err) => {
    console.error(err);
    setProgress(0, 'Failed to load the model. See the console.');
  },
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
