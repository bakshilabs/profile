import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { MeshBVH } from 'three-mesh-bvh';
import { compassToModel, sunDirection } from '../site.js';
import { UTCI_ANCHORS, hexToRgb, TOKENS } from './theme.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
const MODEL_URL = `${BASE}aviva_stadium.glb`;
const HEAD = 1.2;
const TARGET = new THREE.Vector3(0, 7, 0);
const V3 = (hex) => new THREE.Vector3(...hexToRgb(hex));

const COMMON = /* glsl */ `
  uniform float uAU[9];
  uniform vec3 uAC[9];
  uniform vec3 uSeq[7];
  uniform vec3 uDiv[9];
  uniform vec3 uEmpty;
  uniform float uMode;   // 0 UTCI, 1 sequential, 2 diverging
  uniform float uMin;
  uniform float uMax;
  uniform float uSqrt;
  vec3 utciColour(float u) {
    vec3 c = uAC[0];
    for (int i = 0; i < 8; i++) c = mix(c, uAC[i + 1], clamp((u - uAU[i]) / (uAU[i + 1] - uAU[i]), 0.0, 1.0));
    float w = max(fwidth(u) * 1.1, 0.0001);
    float line = 0.0;
    line = max(line, 1.0 - smoothstep(0.0, w, abs(u - 0.0)));
    line = max(line, 1.0 - smoothstep(0.0, w, abs(u - 9.0)));
    line = max(line, 1.0 - smoothstep(0.0, w, abs(u - 26.0)));
    return mix(c, vec3(1.0), line * 0.38);
  }
  vec3 seq(float t) {
    float x = clamp(t, 0.0, 1.0) * 6.0;
    int i = int(min(floor(x), 5.0));
    return mix(uSeq[i], uSeq[i + 1], x - float(i));
  }
  vec3 div(float v) {
    float x = (clamp(v / uMax, -1.0, 1.0) * 0.5 + 0.5) * 8.0;
    int i = int(min(floor(x), 7.0));
    return mix(uDiv[i], uDiv[i + 1], x - float(i));
  }
  vec3 surfaceColour(float v) {
    if (uMode < 0.5) return utciColour(v);
    if (uMode < 1.5) {
      float t = (v - uMin) / max(uMax - uMin, 0.0001);
      return seq(uSqrt > 0.5 ? sqrt(max(t, 0.0)) : t);
    }
    return div(v);
  }
  float shade(vec3 n) { return 0.62 + 0.38 * clamp(dot(normalize(n), normalize(vec3(-0.3, 1.0, 0.5))), 0.0, 1.0); }
  vec3 finish(float v, float mask, vec3 n) {
    vec3 c = surfaceColour(v) * shade(n);
    return mix(uEmpty, c, mix(0.14, 1.0, mask));
  }
`;

function commonUniforms() {
  return {
    uAU: { value: UTCI_ANCHORS.map((a) => a[0]) },
    uAC: { value: UTCI_ANCHORS.map((a) => V3(a[1])) },
    uSeq: { value: Array.from({ length: 7 }, () => new THREE.Vector3()) },
    uDiv: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) },
    uEmpty: { value: new THREE.Vector3() },
    uMode: { value: 0 }, uMin: { value: 0 }, uMax: { value: 1 }, uSqrt: { value: 0 },
  };
}

// Camera angles. The distance is worked out so the whole stadium fits the view; the factor trims it.
const PRESETS = {
  aerial: { bearing: 160, elevation: 36, factor: 1.0 },
  plan: { bearing: 180, elevation: 88, factor: 1.0 },
  south: { bearing: 180, elevation: 17, factor: 1.0 },
  west: { bearing: 270, elevation: 20, factor: 1.0 },
};
const FIT_POINTS = (() => {
  const pts = [];
  for (const x of [-100, 100]) for (const z of [-100, 100]) for (const y of [0, 40]) pts.push(new THREE.Vector3(x, y, z));
  for (let b = 0; b < 360; b += 15) pts.push(compassToModel(b).multiplyScalar(112).setY(0.4));
  pts.push(compassToModel(0).multiplyScalar(128).setY(9));
  return pts;
})();

export class Scene3D {
  constructor(container, D, theme) {
    this.D = D; this.container = container; this.theme = theme;
    this.dirty = true; this.compare = false;
    this.views = [this.blankView(), this.blankView()];
    this.tween = null; this.selected = -1; this.sunVisible = true;
    this.preset = 'aerial'; this.autoFit = true;

    const canvas = document.createElement('canvas');
    canvas.className = 'gl';
    container.appendChild(canvas);
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.autoClear = false;
    this.renderer.setScissorTest(true);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x2a313b, 1.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-120, 300, 200);
    this.scene.add(key);
    this.camera = new THREE.PerspectiveCamera(30, 1.5, 10, 3000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.minDistance = 60; this.controls.maxDistance = 900;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener('change', () => { this.dirty = true; });
    this.controls.addEventListener('start', () => { this.autoFit = false; this.tween = null; });
    this.w = container.clientWidth || 800; this.h = container.clientHeight || 500;
    this.setPreset('aerial', false);
    new ResizeObserver(() => this.resize()).observe(container);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  blankView() { return { mode: 0, min: 0, max: 1, sqrt: 0, ramp: null, sun: null, seatData: null, pitchData: null }; }

  async load(onProgress) {
    const D = this.D;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.loadAsync(MODEL_URL, (e) => e.lengthComputable && onProgress?.(e.loaded / e.total));
    const model = gltf.scene;
    model.scale.setScalar(0.001);
    this.scene.add(model);
    this.scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    model.position.set(-centre.x, -box.min.y, -centre.z);
    this.scene.updateMatrixWorld(true);
    this.model = model;

    const nStand = D.n - D.nPitch;
    this.nStand = nStand;
    // Data textures for the two views: (value, mask) per seat sample, and per cell of the pitch grid.
    const seatRaw = [new Float32Array(nStand * 2), new Float32Array(nStand * 2)];
    this.seatTex = seatRaw.map((a) => { const t = new THREE.DataTexture(a, nStand, 1, THREE.RGFormat, THREE.FloatType); t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t; });
    this.seatRaw = seatRaw;
    this.initPitchGrid();
    this.buildMaterials();
    await this.buildSeatWeights(model);
    await this.buildTerrace();
    this.buildOverlay();
    this.applyTheme(this.theme);
    this.resize();
    return this;
  }

  initPitchGrid() {
    const D = this.D, N = D.nPitch, cell = D.cell;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < N; i++) { x0 = Math.min(x0, D.x[i]); x1 = Math.max(x1, D.x[i]); z0 = Math.min(z0, D.z[i]); z1 = Math.max(z1, D.z[i]); }
    const nx = Math.round((x1 - x0) / cell) + 1, nz = Math.round((z1 - z0) / cell) + 1;
    const source = new Int32Array(nx * nz);
    for (let cz = 0; cz < nz; cz++) for (let cx = 0; cx < nx; cx++) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < N; i++) { const d = (D.x[i] - (x0 + cx * cell)) ** 2 + (D.z[i] - (z0 + cz * cell)) ** 2; if (d < bestD) { bestD = d; best = i; } }
      source[cz * nx + cx] = best;
    }
    this.grid = { x0, z0, cell, nx, nz, source };
    this.pitchRaw = [new Uint16Array(nx * nz * 2), new Uint16Array(nx * nz * 2)];
    this.pitchTex = this.pitchRaw.map((a) => { const t = new THREE.DataTexture(a, nx, nz, THREE.RGFormat, THREE.HalfFloatType); t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t; });
  }

  buildMaterials() {
    const g = this.grid;
    this.seatMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { ...commonUniforms(), uSeatData: { value: this.seatTex[0] } },
      vertexShader: /* glsl */ `
        uniform sampler2D uSeatData;
        attribute vec3 aIdx;
        attribute vec3 aW;
        varying float vValue;
        varying float vMask;
        varying vec3 vN;
        void main() {
          float s = aW.x + aW.y + aW.z;
          vec2 v = vec2(0.0);
          if (s > 0.0) {
            v = (texelFetch(uSeatData, ivec2(int(aIdx.x), 0), 0).rg * aW.x
               + texelFetch(uSeatData, ivec2(int(aIdx.y), 0), 0).rg * aW.y
               + texelFetch(uSeatData, ivec2(int(aIdx.z), 0), 0).rg * aW.z) / s;
          }
          vValue = v.x; vMask = s > 0.0 ? v.y : 0.0;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${COMMON}
        varying float vValue; varying float vMask; varying vec3 vN;
        void main() { gl_FragColor = vec4(finish(vValue, vMask, vN), 1.0); }`,
    });
    this.pitchMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: {
        ...commonUniforms(),
        uPitchData: { value: this.pitchTex[0] },
        uGrid: { value: new THREE.Vector4(g.x0, g.z0, g.cell, 0) },
        uGridSize: { value: new THREE.Vector2(g.nx, g.nz) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vXZ; varying vec3 vN;
        void main() {
          vXZ = (modelMatrix * vec4(position, 1.0)).xz;
          vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${COMMON}
        uniform sampler2D uPitchData; uniform vec4 uGrid; uniform vec2 uGridSize;
        varying vec2 vXZ; varying vec3 vN;
        void main() {
          vec2 uv = ((vXZ - uGrid.xy) / uGrid.z + 0.5) / uGridSize;
          vec2 v = texture2D(uPitchData, clamp(uv, vec2(0.0), vec2(1.0))).rg;
          gl_FragColor = vec4(finish(v.x, v.y, vN), 1.0);
        }`,
    });
    const ghost = () => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.neutral = {
      ground: new THREE.MeshBasicMaterial(),
      roof: ghost(), cladding: ghost(), steelGhost: ghost(),
      structure: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
      concrete: new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }),
    };
    const byName = {
      New_material_016: this.neutral.ground, New_material_012: this.neutral.roof, New_material_004: this.neutral.cladding,
      New_material_006: this.neutral.structure, New_material_002: this.neutral.concrete, Default: this.neutral.steelGhost,
    };
    this.seatMeshes = []; this.roofMeshes = []; this.blockers = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      const name = o.material.name;
      if (!['New_material_016', 'New_material_014', 'New_material_012', 'New_material_004', 'Default'].includes(o.material.name) && o.material.opacity >= 0.5) this.blockers.push(o);
      if (name === 'New_material_010') o.visible = false;
      else if (name === 'New_material_014') o.material = this.pitchMaterial;
      else if (name === 'New_material_018') { o.material = this.seatMaterial; this.seatMeshes.push(o); }
      else if (byName[name]) { o.material = byName[name]; if (['New_material_012', 'New_material_004', 'Default'].includes(name)) this.roofMeshes.push(o); }
      o.renderOrder = o.material.transparent ? 2 : 0;
    });
  }

  // Each seat vertex blends the three nearest stand sample points within 7 m.
  async buildSeatWeights(model) {
    const D = this.D, N0 = D.nPitch, nStand = this.nStand, CELL = 6, R2 = 49;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = N0; i < D.n; i++) {
      minX = Math.min(minX, D.x[i]); maxX = Math.max(maxX, D.x[i]); minY = Math.min(minY, D.y[i]); maxY = Math.max(maxY, D.y[i]);
      minZ = Math.min(minZ, D.z[i]); maxZ = Math.max(maxZ, D.z[i]);
    }
    const gx = Math.floor((maxX - minX) / CELL) + 1, gy = Math.floor((maxY - minY) / CELL) + 1, gz = Math.floor((maxZ - minZ) / CELL) + 1;
    const cellIndex = (cx, cy, cz) => (cx * gy + cy) * gz + cz;
    const counts = new Uint32Array(gx * gy * gz + 1);
    const cellOf = (x, y, z) => [Math.floor((x - minX) / CELL), Math.floor((y - minY) / CELL), Math.floor((z - minZ) / CELL)];
    for (let s = 0; s < nStand; s++) { const i = N0 + s; const [a, b, c] = cellOf(D.x[i], D.y[i], D.z[i]); counts[cellIndex(a, b, c) + 1]++; }
    for (let c = 1; c < counts.length; c++) counts[c] += counts[c - 1];
    const fill = counts.slice(), list = new Uint32Array(nStand);
    for (let s = 0; s < nStand; s++) { const i = N0 + s; const [a, b, c] = cellOf(D.x[i], D.y[i], D.z[i]); list[fill[cellIndex(a, b, c)]++] = s; }
    const v = new THREE.Vector3();
    for (const mesh of this.seatMeshes) {
      const pos = mesh.geometry.attributes.position;
      const aIdx = new Float32Array(pos.count * 3), aW = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld);
        const x = v.x, y = v.y + HEAD, z = v.z;
        const [cx, cy, cz] = cellOf(x, y, z);
        const bd = [Infinity, Infinity, Infinity], bi = [0, 0, 0];
        for (let ix = Math.max(0, cx - 1); ix <= Math.min(gx - 1, cx + 1); ix++) for (let iy = Math.max(0, cy - 1); iy <= Math.min(gy - 1, cy + 1); iy++) for (let iz = Math.max(0, cz - 1); iz <= Math.min(gz - 1, cz + 1); iz++) {
          const ci = cellIndex(ix, iy, iz);
          for (let q = counts[ci]; q < counts[ci + 1]; q++) {
            const s = list[q], i = N0 + s;
            const d = (D.x[i] - x) ** 2 + (D.y[i] - y) ** 2 + (D.z[i] - z) ** 2;
            if (d < bd[2]) {
              if (d < bd[0]) { bd[2] = bd[1]; bi[2] = bi[1]; bd[1] = bd[0]; bi[1] = bi[0]; bd[0] = d; bi[0] = s; }
              else if (d < bd[1]) { bd[2] = bd[1]; bi[2] = bi[1]; bd[1] = d; bi[1] = s; }
              else { bd[2] = d; bi[2] = s; }
            }
          }
        }
        for (let j = 0; j < 3; j++) if (bd[j] < R2) { aIdx[k * 3 + j] = bi[j]; aW[k * 3 + j] = 1 / (bd[j] + 1); }
      }
      mesh.geometry.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 3));
      mesh.geometry.setAttribute('aW', new THREE.BufferAttribute(aW, 3));
    }
  }

  // A continuous surface under the seat rows, so each tier reads as a filled area.
  async buildTerrace() {
    const D = this.D, nStand = this.nStand;
    const terrace = await (await fetch(`${BASE}data/terrace.json`)).json();
    const pos = new Float32Array(nStand * 3), aIdx = new Float32Array(nStand * 3), aW = new Float32Array(nStand * 3);
    for (let k = 0; k < nStand; k++) {
      const i = D.nPitch + k;
      pos.set([D.x[i], D.y[i] - HEAD - 0.12, D.z[i]], k * 3);
      aIdx.set([k, k, k], k * 3); aW.set([1, 0, 0], k * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 3));
    g.setAttribute('aW', new THREE.BufferAttribute(aW, 3));
    g.setIndex(terrace.triangles.map((i) => i - terrace.offset));
    g.computeVertexNormals();
    this.terrace = new THREE.Mesh(g, this.seatMaterial);
    this.scene.add(this.terrace);
  }

  buildOverlay() {
    const o = (this.overlay = new THREE.Group());
    this.scene.add(o);
    const R = 112, ringPts = [];
    for (let b = 0; b <= 360; b += 2) ringPts.push(compassToModel(b).multiplyScalar(R).setY(0.4));
    this.ring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 180, 0.3, 5, true), new THREE.MeshBasicMaterial());
    o.add(this.ring);
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    this.northCanvas = c;
    this.northTex = new THREE.CanvasTexture(c);
    const north = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.northTex, transparent: true, depthTest: false }));
    north.scale.set(14, 14, 1);
    north.position.copy(compassToModel(0).multiplyScalar(R + 14)).setY(6);
    north.renderOrder = 5;
    o.add(north);
    this.sunMarker = new THREE.Mesh(new THREE.SphereGeometry(5, 20, 10), new THREE.MeshBasicMaterial({ color: 0xffc400 }));
    this.sunPath = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffc400, transparent: true, opacity: 0.22 }));
    o.add(this.sunMarker, this.sunPath);
    // Marker for the selected sample point.
    this.pointMarker = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10), new THREE.MeshBasicMaterial({ depthTest: false }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 6), new THREE.MeshBasicMaterial({ depthTest: false }));
    stem.position.y = 7; dot.renderOrder = stem.renderOrder = 9;
    this.pointMarker.add(dot, stem);
    this.pointMarker.visible = false;
    o.add(this.pointMarker);
  }

  applyTheme(theme) {
    this.theme = theme;
    const tk = TOKENS[theme], sc = tk.scene;
    this.neutral.ground.color.setHex(sc.ground);
    this.neutral.structure.color.setHex(sc.structure);
    this.neutral.concrete.color.setHex(sc.structure);
    for (const m of [this.neutral.roof, this.neutral.cladding, this.neutral.steelGhost]) { m.color.setHex(sc.ghost); m.opacity = sc.ghostOpacity; }
    this.neutral.cladding.opacity = sc.ghostOpacity * 0.7;
    this.ring.material.color.set(tk.axis);
    this.pointMarker.children.forEach((m) => m.material.color.set(tk.ink));
    const g = this.northCanvas.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = tk.series[7]; g.font = '700 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', 64, 68);
    this.northTex.needsUpdate = true;
    this.renderer.setClearColor(new THREE.Color(tk.surface), 1);
    for (const m of [this.seatMaterial, this.pitchMaterial]) m.uniforms.uEmpty.value.set(...hexToRgb(tk.surface === '#1a1a19' ? '#2a2a28' : '#e4e3dc'));
    this.dirty = true;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.w = w; this.h = h;
    if (this.autoFit) this.setPreset(this.preset, false);
    this.dirty = true;
  }

  setCompare(on) { this.compare = on; if (this.autoFit) this.setPreset(this.preset, false); this.dirty = true; }
  setRoofVisible(on) { for (const m of this.roofMeshes) m.visible = on; this.dirty = true; }
  setSunVisible(on) { this.sunVisible = on; this.dirty = true; }
  requestRender() { this.dirty = true; }

  // Set what one view shows. values and mask have one entry per sample point.
  setView(i, { mode, values, mask, min = 0, max = 1, sqrt = 0, ramp = null, sun = null }) {
    const D = this.D, v = this.views[i];
    Object.assign(v, { mode, min, max, sqrt, ramp, sun });
    const seat = this.seatRaw[i], half = THREE.DataUtils.toHalfFloat;
    for (let s = 0; s < this.nStand; s++) { seat[2 * s] = values[D.nPitch + s]; seat[2 * s + 1] = mask[D.nPitch + s]; }
    this.seatTex[i].needsUpdate = true;
    const g = this.grid, pitch = this.pitchRaw[i];
    for (let c = 0; c < g.source.length; c++) { const p = g.source[c]; pitch[2 * c] = half(values[p]); pitch[2 * c + 1] = half(mask[p]); }
    this.pitchTex[i].needsUpdate = true;
    this.dirty = true;
  }

  setSelected(index) {
    this.selected = index;
    if (index < 0) this.pointMarker.visible = false;
    else { this.pointMarker.position.set(this.D.x[index], this.D.y[index] - HEAD, this.D.z[index]); this.pointMarker.visible = true; }
    this.dirty = true;
  }

  // --- camera ---
  // Smallest distance at which the stadium outline (corners of its box and the compass ring) sits inside the
  // view with a small margin, for a camera looking at the target from the given bearing and elevation.
  fitDistanceFor(bearing, elevation) {
    const dir = compassToModel(bearing), el = THREE.MathUtils.degToRad(elevation);
    const unit = new THREE.Vector3(dir.x * Math.cos(el), Math.sin(el), dir.z * Math.cos(el));
    const aspect = (this.w / (this.compare ? 2 : 1)) / Math.max(1, this.h);
    const cam = new THREE.PerspectiveCamera(this.camera.fov, aspect, 1, 6000), v = new THREE.Vector3();
    let lo = 60, hi = 2500;
    for (let i = 0; i < 28; i++) {
      const d = (lo + hi) / 2;
      cam.position.copy(unit).multiplyScalar(d).add(TARGET);
      cam.lookAt(TARGET); cam.updateMatrixWorld(true);
      let m = 0;
      for (const p of FIT_POINTS) { v.copy(p).project(cam); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); }
      if (m > 0.92) lo = d; else hi = d;
    }
    return hi;
  }
  presetPose({ bearing, elevation, factor }) {
    const dir = compassToModel(bearing), el = THREE.MathUtils.degToRad(elevation), distance = this.fitDistanceFor(bearing, elevation) * factor;
    return new THREE.Vector3(dir.x * Math.cos(el) * distance, Math.sin(el) * distance + TARGET.y, dir.z * Math.cos(el) * distance);
  }
  setPreset(name, animate = true) {
    this.preset = name; this.autoFit = true;
    this.controls.maxDistance = this.fitDistanceFor(PRESETS.aerial.bearing, PRESETS.aerial.elevation) * 2.4;
    this.controls.minDistance = 50;
    const to = this.presetPose(PRESETS[name]);
    if (!animate) { this.camera.position.copy(to); this.controls.target.copy(TARGET); this.controls.update(); this.dirty = true; return; }
    this.tween = { from: this.camera.position.clone(), to, t: 0, start: performance.now() };
  }

  loop(now) {
    requestAnimationFrame(this.loop);
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.start) / 800), e = k * k * (3 - 2 * k);
      // Interpolate on a sphere about the target so the camera swings round the stadium.
      const a = this.tween.from.clone().sub(TARGET), b = this.tween.to.clone().sub(TARGET);
      const len = a.length() + (b.length() - a.length()) * e;
      const dir = a.normalize().lerp(b.normalize(), e).normalize();
      this.camera.position.copy(TARGET).addScaledVector(dir, len);
      this.controls.target.copy(TARGET);
      if (k >= 1) this.tween = null;
      this.dirty = true;
    }
    const moved = this.controls.update();
    if (!this.dirty && !moved) return;
    this.dirty = false;
    this.draw();
  }

  draw() {
    const { renderer, camera, w, h } = this;
    if (!w || !this.model) return;
    renderer.setScissor(0, 0, w, h); renderer.setViewport(0, 0, w, h);
    renderer.clear();
    const count = this.compare ? 2 : 1;
    camera.aspect = (w / count) / h;
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    for (let i = 0; i < count; i++) {
      const v = this.views[i], x = (i * w) / count, vw = w / count;
      renderer.setViewport(x, 0, vw, h); renderer.setScissor(x, 0, vw, h);
      for (const m of [this.seatMaterial, this.pitchMaterial]) {
        const u = m.uniforms;
        u.uMode.value = v.mode; u.uMin.value = v.min; u.uMax.value = v.max; u.uSqrt.value = v.sqrt;
        if (v.ramp) {
          const arr = v.mode === 1 ? u.uSeq.value : u.uDiv.value;
          v.ramp.forEach((hex, k) => arr[k].set(...hexToRgb(hex)));
        }
      }
      this.seatMaterial.uniforms.uSeatData.value = this.seatTex[i];
      this.pitchMaterial.uniforms.uPitchData.value = this.pitchTex[i];
      const sun = v.sun;
      this.sunMarker.visible = this.sunPath.visible = !!sun && this.sunVisible && sun.alt > 0;
      if (sun) {
        this.sunMarker.position.copy(sunDirection(sun.alt, sun.az)).multiplyScalar(190);
        if (sun.pathKey !== this.pathKey) { this.setPath(sun.path); this.pathKey = sun.pathKey; }
      }
      renderer.render(this.scene, camera);
    }
  }

  setPath(path) {
    this.sunPath.geometry.dispose();
    const pts = path.map(([alt, az]) => sunDirection(alt, az).multiplyScalar(190));
    this.sunPath.geometry = pts.length > 2 ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.35, 5, false) : new THREE.BufferGeometry();
  }

  // --- picking ---
  async ensureBVH() {
    if (this.bvh) return this.bvh;
    let nv = 0, ni = 0;
    for (const m of this.blockers) { nv += m.geometry.attributes.position.count; ni += m.geometry.index.count; }
    const pos = new Float32Array(nv * 3), idx = new Uint32Array(ni), v = new THREE.Vector3();
    let vo = 0, io = 0;
    for (const m of this.blockers) {
      const p = m.geometry.attributes.position, ix = m.geometry.index;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pos.set([v.x, v.y, v.z], (vo + i) * 3); }
      for (let i = 0; i < ix.count; i++) idx[io + i] = ix.getX(i) + vo;
      vo += p.count; io += ix.count;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.bvh = new MeshBVH(g);
    return this.bvh;
  }

  // The nearest visible sample point to the pointer, within 16 pixels, or -1.
  pick(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const count = this.compare ? 2 : 1, vw = rect.width / count;
    const local = px % vw;
    this.camera.aspect = vw / rect.height;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld(true);
    const D = this.D, v = new THREE.Vector3(), cand = [];
    for (let i = 0; i < D.n; i++) {
      v.set(D.x[i], D.y[i] - HEAD, D.z[i]).project(this.camera);
      if (v.z > 1) continue;
      const sx = (v.x * 0.5 + 0.5) * vw, sy = (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - local, sy - py);
      if (d < 16) cand.push([d, i]);
    }
    cand.sort((a, b) => a[0] - b[0]);
    const ray = new THREE.Ray(), o = this.camera.position;
    for (const [, i] of cand.slice(0, 12)) {
      const target = new THREE.Vector3(D.x[i], D.y[i] - HEAD + 0.3, D.z[i]);
      const dist = o.distanceTo(target);
      if (this.bvh) {
        ray.origin.copy(o); ray.direction.copy(target).sub(o).normalize();
        if (this.bvh.raycastFirst(ray, THREE.DoubleSide, 0, dist - 6)) continue;
      }
      return i;
    }
    return -1;
  }
}
