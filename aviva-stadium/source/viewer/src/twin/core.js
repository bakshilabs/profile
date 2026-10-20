// Shared scene for the digital twin: stadium model, OpenStreetMap context, imagery ground, sun and shadows.
// Everything lives in the stadium model frame: metres, Y up, origin at the model footprint centre, ground at y = 0.
// Georeferencing (bearing of +Z, origin offset) comes from twin/georef.json, written by twin/scripts/build_context.mjs.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const BASE = import.meta.env?.BASE_URL ?? '/';

export const LAT = 53.3352, LON = -6.2284;

// NOAA solar position. Time is UTC (Dublin is on UTC in winter). Returns degrees, azimuth clockwise from true north.
export function solarPosition(dayOfYear, hourUTC, lat = LAT, lon = LON) {
  const rad = Math.PI / 180;
  const g = ((2 * Math.PI) / 365) * (dayOfYear - 1 + (hourUTC - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const tst = hourUTC * 60 + eqtime + 4 * lon; // true solar time in minutes
  const ha = (tst / 4 - 180) * rad;
  const cosZen = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha);
  const altitude = 90 - Math.acos(Math.min(1, Math.max(-1, cosZen))) / rad;
  const az = (Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat * rad) - Math.tan(decl) * Math.cos(lat * rad)) / rad + 180 + 360) % 360;
  return { altitude, azimuth: az };
}

function loadGLB(url, onProgress) {
  return new Promise((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, resolve, (e) => e.lengthComputable && onProgress?.(e.loaded / e.total), reject));
}

export async function createTwin({ container, width = window.innerWidth, height = window.innerHeight, pixelRatio = Math.min(window.devicePixelRatio, 2), stadium = true, onProgress = () => {}, shadowMapSize = 4096 } = {}) {
  const georef = await (await fetch(`${BASE}twin/georef.json`)).json();
  const b = THREE.MathUtils.degToRad(georef.bearingOfPlusZ);
  const north = new THREE.Vector3(Math.sin(b), 0, Math.cos(b));   // true north in the model frame
  const east = new THREE.Vector3(-Math.cos(b), 0, Math.sin(b));   // true east in the model frame
  const te = georef.originOffsetFromReferenceMetres.east, tn = georef.originOffsetFromReferenceMetres.north;
  const enToModel = (e, n) => { const de = e - te, dn = n - tn; return new THREE.Vector3(-de * Math.cos(b) + dn * Math.sin(b), 0, de * Math.sin(b) + dn * Math.cos(b)); };

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const sky = new THREE.Color(0xcfdbe6);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 500, 2800);
  const camera = new THREE.PerspectiveCamera(40, width / height, 3, 12000);

  const hemi = new THREE.HemisphereLight(0xdfe9f5, 0x8a8f86, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3dd, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  const S = 520;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 3000 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  const layers = {};
  const add = (name, obj) => { layers[name] = obj; scene.add(obj); return obj; };

  // ---- imagery ground: true-north aligned square centred on the reference point, placed with the fitted georeference
  const HALF = 800; // must match fetch_sentinel.mjs
  const tex = await new THREE.TextureLoader().loadAsync(`${BASE}twin/ground_web.jpg`);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const alpha = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128); grd.addColorStop(0, '#fff'); grd.addColorStop(0.72, '#fff'); grd.addColorStop(1, '#000'); g.fillStyle = grd; g.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
  const corners = [[-HALF, HALF], [HALF, HALF], [HALF, -HALF], [-HALF, -HALF]].map(([e, n]) => enToModel(e, n));
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(corners.flatMap((v) => [v.x, -0.15, v.z]), 3));
  gg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
  gg.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  gg.setIndex([0, 3, 2, 0, 2, 1]);
  const groundMat = new THREE.MeshLambertMaterial({ map: tex, alphaMap: alpha, transparent: true });
  const ground = new THREE.Mesh(gg, groundMat); ground.receiveShadow = true;
  // The ground continues as a flat colour beyond the imagery so the page never shows a floating square.
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8e978a });
  const base = new THREE.Mesh(new THREE.CircleGeometry(6000, 64).rotateX(-Math.PI / 2), baseMat);
  base.position.y = -0.4; base.receiveShadow = true;
  add('imagery', ground); add('base', base);

  // ---- context from OpenStreetMap
  onProgress(0.05, 'Loading context');
  const ctx = await loadGLB(`${BASE}twin/context.glb`);
  const ctxRoot = ctx.scene;
  for (const name of ['context_buildings', 'context_buildings_ns', 'context_roads', 'context_rail', 'context_green', 'context_water']) {
    const node = ctxRoot.getObjectByName(name); if (!node) continue;
    const isBuilding = name.startsWith('context_buildings');
    node.traverse((o) => { if (o.isMesh) { o.material = new THREE.MeshLambertMaterial({ color: o.material.color }); o.receiveShadow = true; o.castShadow = isBuilding; if (!isBuilding) o.material.polygonOffset = true, o.material.polygonOffsetFactor = -1, o.material.polygonOffsetUnits = -1; } });
    layers[name] = node;
  }
  // "context_buildings" toggles every building, including the north and south houses that the story page highlights.
  const allBuildings = new THREE.Group(); allBuildings.name = 'context_buildings_all';
  for (const n of ['context_buildings', 'context_buildings_ns']) if (layers[n]) allBuildings.add(layers[n]);
  layers.context_buildings_ns_only = layers.context_buildings_ns; layers.context_buildings = allBuildings; scene.add(allBuildings);
  for (const n of ['context_roads', 'context_rail', 'context_green', 'context_water']) if (layers[n]) scene.add(layers[n]);

  // ---- stadium model, normalised as in main.js: millimetres to metres, footprint centred, lowest point at y = 0
  let model = null, size = new THREE.Vector3(200, 40, 200);
  if (stadium) {
    const gltf = await loadGLB(`${BASE}aviva_stadium.glb`, (f) => onProgress(0.1 + 0.85 * f, 'Loading stadium model'));
    model = gltf.scene; model.scale.setScalar(0.001);
    const site = new THREE.Group(); site.add(model); scene.add(site); site.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model), c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z); site.updateMatrixWorld(true);
    size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.traverse((o) => { if (!o.isMesh) return; const m = o.material; if (m.transparent) m.depthWrite = false; o.castShadow = m.opacity >= 0.5; o.receiveShadow = true; });
    layers.stadium = site;
  }

  // ---- north arrow on the ground, drawn over the scene
  const arrow = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xd62b2b, depthTest: false, transparent: true });
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 46), mat); shaft.position.z = -23;
  const head = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 4).rotateX(-Math.PI / 2), mat); head.position.z = -54;
  arrow.add(shaft, head); arrow.renderOrder = 20; arrow.traverse((o) => (o.renderOrder = 20));
  arrow.rotation.y = Math.atan2(-north.x, -north.z); // local -Z points at north
  arrow.position.copy(north).multiplyScalar(150).setY(1);
  add('northArrow', arrow); arrow.visible = false;

  const state = { shadows: true, sun: { altitude: 13, azimuth: 180 } };
  function setSun(dayOfYear, hourUTC) {
    const { altitude, azimuth } = solarPosition(dayOfYear, hourUTC);
    state.sun = { altitude, azimuth };
    const up = Math.max(altitude, 0);
    const h = THREE.MathUtils.degToRad(azimuth);
    const dir = new THREE.Vector3().addScaledVector(north, Math.cos(h)).addScaledVector(east, Math.sin(h)); // horizontal unit vector towards the sun
    const alt = THREE.MathUtils.degToRad(altitude);
    const to = dir.multiplyScalar(Math.cos(alt)).setY(Math.sin(alt));
    sun.position.copy(to).multiplyScalar(1500); sun.target.position.set(0, 0, 0); sun.target.updateMatrixWorld();
    const k = THREE.MathUtils.smoothstep(altitude, -2, 6);
    // Keep the light on a horizontal surface roughly constant at low sun, so winter shadows stay readable, and keep the sky fill modest.
    sun.intensity = 2.3 * k / Math.max(0.42, Math.sin(alt)); sun.visible = altitude > -2;
    hemi.intensity = 0.6 + 0.6 * THREE.MathUtils.smoothstep(altitude, -6, 40);
    sun.castShadow = state.shadows && altitude > 0;
    return state.sun;
  }
  setSun(171, 15);

  const api = {
    THREE, georef, north, east, enToModel, renderer, scene, camera, sun, hemi, layers, size, model, state, setSun,
    // Light and dark themes: the sky, the fog and the ground beyond the imagery follow the page.
    setTheme(theme) {
      sky.set(theme === 'dark' ? 0x10242e : 0xcfdbe6); scene.fog.color.copy(sky); baseMat.color.set(theme === 'dark' ? 0x4a5a58 : 0x8e978a);
    },
    setShadows(on) { state.shadows = on; sun.castShadow = on && state.sun.altitude > 0; },
    setVisible(name, on) { if (layers[name]) layers[name].visible = on; },
    resize(w, h) { renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); },
    render() { renderer.render(scene, camera); },
  };
  onProgress(1, 'Ready');
  return api;
}
