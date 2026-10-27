import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SITE, compassToModel, sunDirection } from './site.js';

// A film page for the three day-sweep shots. Time comes from performance.now(), so the recorder's virtual
// clock drives it frame by frame. Each shot plays one frame per simulated minute at 60 frames a second.
// The left view colours the surfaces by thermal stress and the right view by accumulated solar energy.

const W = 1600, H = 900;
const PANEL_Y = 74, PANEL_H = 676;
const FPS = 60;
const FADE_FRAMES = 24;
const ORBIT_START_BEARING = 160;  // degrees: the camera starts south-south-east of the stadium
const ORBIT_RATE = 3.2;           // degrees of orbit per second of film
const MODEL_URL = '/aviva_stadium.glb';
const HEAD_HEIGHT = 1.2;          // metres above the surface, as used for the sample points
const DATA = '/data/film/';

// UTCI colour ramp in degrees C, piecewise linear between anchors. The stress category boundaries are
// 0, 9 and 26 degrees (and -13, -27, 32, 38, 46), and the surfaces draw contour lines on the first three.
const UTCI_ANCHORS = [
  [-30, '#3b2a8f'], [-15, '#2f55d6'], [0, '#3b93e6'], [9, '#7fd6e8'], [12, '#5fcf9f'],
  [20, '#4cc38a'], [26, '#c5d94d'], [32, '#f2d14b'], [38, '#ee8a2e'],
];
const UTCI_CONTOURS = [0, 9, 26];
const LEGEND_RANGE = [-20, 32];
// Display classes for the charts, with a UTCI value inside each class to take its colour from.
const CLASS_OF_CATEGORY = [0, 0, 1, 2, 3, 4, 5, 6, 6, 6];
const CLASSES = [
  { name: 'Very strong cold', range: '< −27', from: -40, to: -27, at: -33 },
  { name: 'Strong cold', range: '−27 to −13', from: -27, to: -13, at: -20 },
  { name: 'Moderate cold', range: '−13 to 0', from: -13, to: 0, at: -6.5 },
  { name: 'Slight cold', range: '0 to 9', from: 0, to: 9, at: 4.5 },
  { name: 'No thermal stress', range: '9 to 26', from: 9, to: 26, at: 17.5 },
  { name: 'Moderate heat', range: '26 to 32', from: 26, to: 32, at: 29 },
  { name: 'Strong heat or worse', range: '> 32', from: 32, to: 46, at: 36 },
];
const RAMP = ['#14182b', '#4b2a7b', '#a3306b', '#e0553d', '#f7a63a', '#fbf0a0'];
const BLURBS = {
  summer: 'The clearest day in the week of the summer solstice. The sun is up for almost 17 hours.',
  equinox: 'The clearest day in the week of the spring equinox. Day and night are close to equal.',
  winter: 'The clearest day in the week of the winter solstice. The sun is up for under 8 hours.',
};

const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const $ = (id) => document.getElementById(id);
const toHex = (rgb) => `#${rgb.map((c) => Math.round(c * 255).toString(16).padStart(2, '0')).join('')}`;
const utciRgb = (u) => {
  const a = UTCI_ANCHORS;
  if (u <= a[0][0]) return hexToRgb(a[0][1]);
  for (let i = 0; i < a.length - 1; i++) {
    if (u <= a[i + 1][0]) {
      const t = (u - a[i][0]) / (a[i + 1][0] - a[i][0]);
      const c0 = hexToRgb(a[i][1]), c1 = hexToRgb(a[i + 1][1]);
      return c0.map((v, k) => v + (c1[k] - v) * t);
    }
  }
  return hexToRgb(a[a.length - 1][1]);
};
for (const c of CLASSES) c.hex = toHex(utciRgb(c.at));
const fetchJson = async (url) => (await fetch(url)).json();
const fetchBuffer = async (url) => (await fetch(url)).arrayBuffer();

// ---------- renderer and scene ----------
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(W, H, false);
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
renderer.autoClear = false;
renderer.setScissorTest(true);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xdfe8f2, 0x2a313b, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(-0.3, 1, 0.5).multiplyScalar(300);
scene.add(key);

const camera = new THREE.PerspectiveCamera(30, W / 2 / PANEL_H, 10, 3000);
const TARGET = new THREE.Vector3(0, 7, 0);

// ---------- data ----------
const [index, pts] = await Promise.all([fetchJson(`${DATA}index.json`), fetchJson(`${DATA}points.json`)]);
const shots = await Promise.all(index.shots.map(async (s) => {
  const [meta, utci, irr] = await Promise.all([
    fetchJson(`${DATA}${s.name}.json`),
    fetchBuffer(`${DATA}${s.name}.utci.u8`),
    fetchBuffer(`${DATA}${s.name}.irr.u16`),
  ]);
  return { ...meta, utci: new Uint8Array(utci), irr: new Uint16Array(irr) };
}));
const N = pts.n, N_PITCH = pts.nPitch, N_STAND = N - N_PITCH;
let orbitOffsetFrames = 0;
for (const s of shots) {
  s.orbitStart = orbitOffsetFrames;
  orbitOffsetFrames += s.frames;
  // Chart series: seats by display class.
  s.classPct = s.series.categoryPct.stands.map((cats) => {
    const out = new Array(7).fill(0);
    cats.forEach((v, c) => { out[CLASS_OF_CATEGORY[c]] += v; });
    return out;
  });
}

// ---------- surface shading ----------
const rampRgb = RAMP.map(hexToRgb);
const SHADER_COMMON = /* glsl */ `
  uniform float uAU[9];
  uniform vec3 uAC[9];
  uniform vec3 uRamp[6];
  uniform float uMode;
  uniform float uMax;
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
  vec3 ramp(float t) {
    float x = clamp(t, 0.0, 1.0) * 5.0;
    int i = int(min(floor(x), 4.0));
    return mix(uRamp[i], uRamp[i + 1], x - float(i));
  }
  vec3 surfaceColour(float v) { return uMode < 0.5 ? utciColour(v) : ramp(sqrt(max(v, 0.0) / uMax)); }
  float shade(vec3 n) { return 0.58 + 0.42 * clamp(dot(normalize(n), normalize(vec3(-0.3, 1.0, 0.5))), 0.0, 1.0); }
`;
const commonUniforms = () => ({
  uAU: { value: UTCI_ANCHORS.map((a) => a[0]) },
  uAC: { value: UTCI_ANCHORS.map((a) => new THREE.Vector3(...hexToRgb(a[1]))) },
  uRamp: { value: rampRgb.map((c) => new THREE.Vector3(...c)) },
  uMode: { value: 0 },
  uMax: { value: 1000 },
});

const floatTex = (data, w, h, type = THREE.FloatType) => {
  const t = new THREE.DataTexture(data, w, h, THREE.RedFormat, type);
  t.minFilter = t.magFilter = type === THREE.FloatType ? THREE.NearestFilter : THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
};

// Seats: each vertex blends the values of its three nearest sample points.
const seatDataU = new Float32Array(N_STAND), seatDataE = new Float32Array(N_STAND);
const seatTexU = floatTex(seatDataU, N_STAND, 1), seatTexE = floatTex(seatDataE, N_STAND, 1);
const seatMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { ...commonUniforms(), uSeatData: { value: seatTexU } },
  vertexShader: /* glsl */ `
    uniform sampler2D uSeatData;
    attribute vec3 aIdx;
    attribute vec3 aW;
    varying float vValue;
    varying float vValid;
    varying vec3 vN;
    void main() {
      float s = aW.x + aW.y + aW.z;
      float v = 0.0;
      if (s > 0.0) {
        v = (texelFetch(uSeatData, ivec2(int(aIdx.x), 0), 0).r * aW.x
           + texelFetch(uSeatData, ivec2(int(aIdx.y), 0), 0).r * aW.y
           + texelFetch(uSeatData, ivec2(int(aIdx.z), 0), 0).r * aW.z) / s;
      }
      vValid = s > 0.0 ? 1.0 : 0.0;
      vValue = v;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    ${SHADER_COMMON}
    varying float vValue;
    varying float vValid;
    varying vec3 vN;
    void main() {
      vec3 col = vValid > 0.5 ? surfaceColour(vValue) : vec3(0.15, 0.18, 0.22);
      gl_FragColor = vec4(col * shade(vN), 1.0);
    }`,
});

// Pitch: a bilinear texture over the regular sample grid.
const pitchXs = pts.x.slice(0, N_PITCH), pitchZs = pts.z.slice(0, N_PITCH);
const PX0 = Math.min(...pitchXs), PZ0 = Math.min(...pitchZs), CELL = pts.pitchCell;
const NX = Math.round((Math.max(...pitchXs) - PX0) / CELL) + 1, NZ = Math.round((Math.max(...pitchZs) - PZ0) / CELL) + 1;
const gridSource = new Int32Array(NX * NZ); // nearest sample point for every grid cell
for (let cz = 0; cz < NZ; cz++) {
  for (let cx = 0; cx < NX; cx++) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < N_PITCH; i++) {
      const d = (pitchXs[i] - (PX0 + cx * CELL)) ** 2 + (pitchZs[i] - (PZ0 + cz * CELL)) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    gridSource[cz * NX + cx] = best;
  }
}
const pitchDataU = new Uint16Array(NX * NZ), pitchDataE = new Uint16Array(NX * NZ);
const pitchTexU = floatTex(pitchDataU, NX, NZ, THREE.HalfFloatType), pitchTexE = floatTex(pitchDataE, NX, NZ, THREE.HalfFloatType);
const pitchMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: {
    ...commonUniforms(),
    uPitchData: { value: pitchTexU },
    uGrid: { value: new THREE.Vector4(PX0, PZ0, CELL, 0) },
    uGridSize: { value: new THREE.Vector2(NX, NZ) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vXZ;
    varying vec3 vN;
    void main() {
      vXZ = (modelMatrix * vec4(position, 1.0)).xz;
      vN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    ${SHADER_COMMON}
    uniform sampler2D uPitchData;
    uniform vec4 uGrid;
    uniform vec2 uGridSize;
    varying vec2 vXZ;
    varying vec3 vN;
    void main() {
      vec2 uv = ((vXZ - uGrid.xy) / uGrid.z + 0.5) / uGridSize;
      float v = texture2D(uPitchData, clamp(uv, vec2(0.0), vec2(1.0))).r;
      gl_FragColor = vec4(surfaceColour(v) * shade(vN), 1.0);
    }`,
});

// ---------- model ----------
const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
const model = gltf.scene;
model.scale.setScalar(0.001);
scene.add(model);
scene.updateMatrixWorld(true);
{
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  scene.updateMatrixWorld(true);
}

const ghost = (opacity, color = 0x9fb2c6) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
const neutral = {
  New_material_016: new THREE.MeshBasicMaterial({ color: 0x151b23 }),                                  // ground
  New_material_012: ghost(0.1),                                                                          // roof panels
  New_material_004: ghost(0.08),                                                                         // translucent cladding
  New_material_006: new THREE.MeshLambertMaterial({ color: 0x3a4452, side: THREE.DoubleSide }),          // structure
  New_material_002: new THREE.MeshLambertMaterial({ color: 0x323b47, side: THREE.DoubleSide }),          // concrete
  Default: ghost(0.18, 0xb9c6d4),                                                                        // roof steel
};
const seatMeshes = [];
model.traverse((o) => {
  if (!o.isMesh) return;
  const name = o.material.name;
  if (name === 'New_material_010') o.visible = false;                // faint glass
  else if (name === 'New_material_014') o.material = pitchMaterial;
  else if (name === 'New_material_018') { o.material = seatMaterial; seatMeshes.push(o); }
  else if (neutral[name]) o.material = neutral[name];
  o.renderOrder = o.material.transparent ? 2 : 0;
});

// Seat vertex weights: the three nearest stand sample points within 7 m, weighted by 1 / (distance squared + 1).
{
  const standIdx = (i) => N_PITCH + i;
  const CELL_H = 6;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let s = 0; s < N_STAND; s++) {
    const i = standIdx(s);
    minX = Math.min(minX, pts.x[i]); maxX = Math.max(maxX, pts.x[i]);
    minY = Math.min(minY, pts.y[i]); maxY = Math.max(maxY, pts.y[i]);
    minZ = Math.min(minZ, pts.z[i]); maxZ = Math.max(maxZ, pts.z[i]);
  }
  const gx = Math.floor((maxX - minX) / CELL_H) + 1, gy = Math.floor((maxY - minY) / CELL_H) + 1, gz = Math.floor((maxZ - minZ) / CELL_H) + 1;
  const cellOf = (x, y, z) => ({ cx: Math.floor((x - minX) / CELL_H), cy: Math.floor((y - minY) / CELL_H), cz: Math.floor((z - minZ) / CELL_H) });
  const counts = new Uint32Array(gx * gy * gz + 1);
  const cellIndex = (cx, cy, cz) => (cx * gy + cy) * gz + cz;
  for (let s = 0; s < N_STAND; s++) { const i = standIdx(s); const c = cellOf(pts.x[i], pts.y[i], pts.z[i]); counts[cellIndex(c.cx, c.cy, c.cz) + 1]++; }
  for (let c = 1; c < counts.length; c++) counts[c] += counts[c - 1];
  const fill = counts.slice();
  const list = new Uint32Array(N_STAND);
  for (let s = 0; s < N_STAND; s++) { const i = standIdx(s); const c = cellOf(pts.x[i], pts.y[i], pts.z[i]); list[fill[cellIndex(c.cx, c.cy, c.cz)]++] = s; }

  const v = new THREE.Vector3();
  const R2 = 49;
  let vertices = 0, matched = 0;
  for (const mesh of seatMeshes) {
    const pos = mesh.geometry.attributes.position;
    const aIdx = new Float32Array(pos.count * 3), aW = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      v.fromBufferAttribute(pos, k).applyMatrix4(mesh.matrixWorld);
      const x = v.x, y = v.y + HEAD_HEIGHT, z = v.z;
      const c = cellOf(x, y, z);
      const bd = [Infinity, Infinity, Infinity], bi = [0, 0, 0];
      for (let ix = Math.max(0, c.cx - 1); ix <= Math.min(gx - 1, c.cx + 1); ix++) {
        for (let iy = Math.max(0, c.cy - 1); iy <= Math.min(gy - 1, c.cy + 1); iy++) {
          for (let iz = Math.max(0, c.cz - 1); iz <= Math.min(gz - 1, c.cz + 1); iz++) {
            const ci = cellIndex(ix, iy, iz);
            for (let q = counts[ci]; q < counts[ci + 1]; q++) {
              const s = list[q], i = standIdx(s);
              const d = (pts.x[i] - x) ** 2 + (pts.y[i] - y) ** 2 + (pts.z[i] - z) ** 2;
              if (d < bd[2]) {
                if (d < bd[0]) { bd[2] = bd[1]; bi[2] = bi[1]; bd[1] = bd[0]; bi[1] = bi[0]; bd[0] = d; bi[0] = s; }
                else if (d < bd[1]) { bd[2] = bd[1]; bi[2] = bi[1]; bd[1] = d; bi[1] = s; }
                else { bd[2] = d; bi[2] = s; }
              }
            }
          }
        }
      }
      let any = false;
      for (let j = 0; j < 3; j++) {
        if (bd[j] < R2) { aIdx[k * 3 + j] = bi[j]; aW[k * 3 + j] = 1 / (bd[j] + 1); any = true; }
      }
      if (any) matched++;
    }
    vertices += pos.count;
    mesh.geometry.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 3));
    mesh.geometry.setAttribute('aW', new THREE.BufferAttribute(aW, 3));
  }
  console.log(`seat vertices ${vertices}, matched to sample points ${matched}`);
}

// Terrace surface under the seat rows, so each tier reads as a filled area. Each vertex takes its own sample value.
{
  const terrace = await fetchJson('/data/terrace.json');
  const pos = new Float32Array(N_STAND * 3), aIdx = new Float32Array(N_STAND * 3), aW = new Float32Array(N_STAND * 3);
  for (let k = 0; k < N_STAND; k++) {
    const i = N_PITCH + k;
    pos.set([pts.x[i], pts.y[i] - HEAD_HEIGHT - 0.12, pts.z[i]], k * 3);
    aIdx.set([k, k, k], k * 3);
    aW.set([1, 0, 0], k * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setAttribute('aIdx', new THREE.BufferAttribute(aIdx, 3));
  geometry.setAttribute('aW', new THREE.BufferAttribute(aW, 3));
  geometry.setIndex(terrace.triangles.map((i) => i - terrace.offset));
  geometry.computeVertexNormals();
  scene.add(new THREE.Mesh(geometry, seatMaterial));
}

// ---------- compass, sun path and sun marker ----------
const overlay = new THREE.Group();
scene.add(overlay);
{
  const R = 112;
  const ringPts = [];
  for (let b = 0; b <= 360; b += 2) ringPts.push(compassToModel(b).multiplyScalar(R).setY(0.4));
  const ring = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ringPts, true), 180, 0.35, 5, true),
    new THREE.MeshBasicMaterial({ color: 0x3d4857 }));
  overlay.add(ring);
  const label = (text, bearing, colour) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = colour; g.font = '700 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 68);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    s.scale.set(13, 13, 1);
    s.position.copy(compassToModel(bearing).multiplyScalar(R + 16)).setY(6);
    s.renderOrder = 5;
    overlay.add(s);
  };
  label('N', 0, '#ff6b5e');
}
const SUN_R = 260;
const sunMarker = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffd45a }));
const sunGlow = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,212,90,0.9)'); grad.addColorStop(0.35, 'rgba(255,190,60,0.35)'); grad.addColorStop(1, 'rgba(255,190,60,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(48, 48, 1);
  s.renderOrder = 6;
  return s;
})();
sunMarker.add(sunGlow);
let pathMesh = null;
overlay.add(sunMarker);

function buildSunPath(shot) {
  if (pathMesh) { overlay.remove(pathMesh); pathMesh.geometry.dispose(); }
  const pathPts = [];
  for (let f = 0; f < shot.frames; f += 8) {
    if (shot.altitude[f] > 0) pathPts.push(sunDirection(shot.altitude[f], shot.azimuth[f]).multiplyScalar(SUN_R));
  }
  pathMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts), 160, 0.7, 5, false),
    new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.45 }));
  overlay.add(pathMesh);
}

// ---------- legends ----------
{
  const [lo, hi] = LEGEND_RANGE;
  const pos = (u) => `${((u - lo) / (hi - lo)) * 100}%`;
  const stops = [];
  for (let u = lo; u <= hi; u += 1) stops.push(`${toHex(utciRgb(u))} ${pos(u)}`);
  $('uBar').style.background = `linear-gradient(90deg, ${stops.join(',')})`;
  const fmt = (u) => String(u).replace('-', '−');
  $('uTicks').innerHTML = [lo, -13, 0, 9, 26, hi].map((u) => `<span style="left:${pos(u)}">${fmt(u)}</span>`).join('') +
    '<span style="left:100%;transform:translateX(-100%);display:none"></span>';
  const names = ['Strong cold', 'Moderate cold', 'Slight cold', 'No thermal stress', 'Moderate heat'];
  const edges = [lo, -13, 0, 9, 26, hi];
  $('uNames').innerHTML = names.map((n, i) => `<span style="left:${pos((edges[i] + edges[i + 1]) / 2)}">${n}</span>`).join('');
}
$('ramp').style.background = `linear-gradient(90deg, ${RAMP.join(',')})`;
function rampTickValues(maxKwh) {
  const nice = [0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 10];
  const out = [0];
  let last = 0;
  for (const v of nice) {
    if (v >= maxKwh * 0.98) break;
    const p = Math.sqrt(v / maxKwh);
    if (p - last >= 0.12 && 1 - p >= 0.1) { out.push(v); last = p; }
  }
  out.push(maxKwh);
  return out;
}

// Sun path dial: azimuth round the circle from north, altitude towards the centre.
const dial = $('sundial');
dial.width = 128 * window.devicePixelRatio; dial.height = 68 * window.devicePixelRatio;
const dctx = dial.getContext('2d');
function drawDial(shot, f) {
  dctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
  dctx.clearRect(0, 0, 128, 68);
  const cx = 64, cy = 35, R = 29;
  const at = (az, alt) => { const r = R * (1 - Math.max(alt, 0) / 90), a = (az * Math.PI) / 180; return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  dctx.strokeStyle = '#2d3744'; dctx.lineWidth = 1;
  for (const r of [R, R * 2 / 3, R / 3]) { dctx.beginPath(); dctx.arc(cx, cy, r, 0, Math.PI * 2); dctx.stroke(); }
  dctx.beginPath(); dctx.moveTo(cx, cy - R); dctx.lineTo(cx, cy + R); dctx.moveTo(cx - R, cy); dctx.lineTo(cx + R, cy); dctx.stroke();
  dctx.fillStyle = '#ff6b5e'; dctx.font = '600 9px Inter, system-ui, sans-serif'; dctx.textAlign = 'center';
  dctx.fillText('N', cx, cy - R - 3);
  dctx.fillStyle = '#93a1b0'; dctx.fillText('S', cx, cy + R + 9);
  dctx.strokeStyle = 'rgba(255,212,90,0.55)'; dctx.lineWidth = 1.5; dctx.beginPath();
  let started = false;
  for (let k = 0; k < shot.frames; k += 4) {
    if (shot.altitude[k] <= 0) continue;
    const [x, y] = at(shot.azimuth[k], shot.altitude[k]);
    started ? dctx.lineTo(x, y) : dctx.moveTo(x, y);
    started = true;
  }
  dctx.stroke();
  if (shot.altitude[f] > 0) {
    const [x, y] = at(shot.azimuth[f], shot.altitude[f]);
    dctx.fillStyle = '#ffd45a'; dctx.beginPath(); dctx.arc(x, y, 3.5, 0, Math.PI * 2); dctx.fill();
  }
}

// ---------- charts ----------
const chartCanvas = $('charts');
const CH_TOP = 752, CH_H = 124;
const dpr = window.devicePixelRatio;
chartCanvas.width = W * dpr; chartCanvas.height = CH_H * dpr;
chartCanvas.style.cssText = `left:0;top:${CH_TOP}px;width:${W}px;height:${CH_H}px`;
const ctx = chartCanvas.getContext('2d');
const BOXES = [0, 1, 2].map((i) => ({ x: 24 + i * 528, w: 496 }));
const PLOT = { top: 22, bottom: 20, left: 34, right: 10 };
const staticLayer = document.createElement('canvas');
staticLayer.width = W * dpr; staticLayer.height = CH_H * dpr;
let chartState = null;

const niceTicks = (lo, hi, count) => {
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
};

function buildCharts(shot) {
  const g = staticLayer.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, CH_H);
  g.font = '500 10px Inter, system-ui, sans-serif';
  const n = shot.frames;
  const px = (box, f) => box.x + PLOT.left + (f / (n - 1)) * (box.w - PLOT.left - PLOT.right);
  const plotH = CH_H - PLOT.top - PLOT.bottom;
  const state = { px, boxes: BOXES, n };

  const frame = (box, title, subtitle) => {
    g.fillStyle = '#e7ecf2'; g.font = '600 11.5px Inter, system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(title, box.x, 13);
    g.fillStyle = '#93a1b0'; g.font = '500 10.5px Inter, system-ui, sans-serif';
    g.fillText(subtitle, box.x + g.measureText(title).width + 14, 13);
    g.font = '500 10px Inter, system-ui, sans-serif';
    g.strokeStyle = '#232b36'; g.lineWidth = 1;
    g.strokeRect(box.x + PLOT.left + 0.5, PLOT.top + 0.5, box.w - PLOT.left - PLOT.right, plotH);
    g.fillStyle = '#93a1b0'; g.textAlign = 'center';
    for (let f = 0; f < n; f++) {
      const m = shot.minutes[f];
      if (m % 120 === 0 && f > 3 && f < n - 3) {
        const x = px(box, f);
        g.beginPath(); g.moveTo(x + 0.5, PLOT.top + plotH); g.lineTo(x + 0.5, PLOT.top + plotH + 4); g.stroke();
        g.fillText(String(m / 60).padStart(2, '0') + ':00', x, CH_H - 5);
      }
    }
  };
  const yAxis = (box, lo, hi, ticks, fmt, grid = true) => {
    const y = (v) => PLOT.top + plotH - ((v - lo) / (hi - lo)) * plotH;
    g.textAlign = 'right'; g.fillStyle = '#93a1b0';
    for (const t of ticks) {
      g.fillText(fmt(t), box.x + PLOT.left - 5, y(t) + 3.5);
      if (grid) { g.strokeStyle = '#1b222c'; g.beginPath(); g.moveTo(box.x + PLOT.left, y(t) + 0.5); g.lineTo(box.x + box.w - PLOT.right, y(t) + 0.5); g.stroke(); }
    }
    return y;
  };

  // A: seats by thermal stress class, stacked.
  {
    const box = BOXES[0];
    frame(box, 'Seats by thermal stress', 'share of seats in each band, colours as the map');
    const y = yAxis(box, 0, 100, [0, 50, 100], (v) => `${v}%`, false);
    const cum = shot.classPct.map((row) => { let s = 0; return row.map((v) => (s += v)); });
    for (let b = 0; b < 7; b++) {
      g.fillStyle = CLASSES[b].hex;
      g.beginPath();
      for (let f = 0; f < n; f += 2) { const x = px(box, f), yy = y(cum[f][b]); f === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      for (let f = n - 1; f >= 0; f -= 2) g.lineTo(px(box, f), y(b === 0 ? 0 : cum[f][b - 1]));
      g.closePath(); g.fill();
    }
  }
  // B: temperatures.
  {
    const box = BOXES[1];
    frame(box, 'Temperatures', 'air, and UTCI at head height');
    const all = [...shot.db, ...shot.series.meanUtci.stands, ...shot.series.meanUtci.pitch];
    const lo = Math.floor(Math.min(...all) / 5) * 5 - 0, hi = Math.ceil(Math.max(...all, 12) / 5) * 5;
    const y = yAxis(box, lo, hi, niceTicks(lo, hi, 4), (v) => `${v}°`);
    // Band with no thermal stress, 9 to 26 °C.
    const top = Math.min(26, hi), bottom = Math.max(9, lo);
    if (top > bottom) {
      g.fillStyle = 'rgba(76,195,138,0.16)';
      g.fillRect(box.x + PLOT.left, y(top), box.w - PLOT.left - PLOT.right, y(bottom) - y(top));
      g.fillStyle = '#4cc38a'; g.textAlign = 'right';
      g.fillText('no thermal stress', box.x + box.w - PLOT.right - 4, y(top) + 11);
    }
    const line = (series, colour, dash = []) => {
      g.strokeStyle = colour; g.lineWidth = 1.6; g.setLineDash(dash); g.beginPath();
      for (let f = 0; f < n; f += 2) { const x = px(box, f), yy = y(series[f]); f === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke(); g.setLineDash([]);
    };
    line(shot.db, '#e7ecf2', [4, 3]);
    line(shot.series.meanUtci.pitch, '#6ec6ff');
    line(shot.series.meanUtci.stands, '#ffb84d');
    state.tempBox = { y };
  }
  // C: sun on surfaces and accumulated energy.
  {
    const box = BOXES[2];
    frame(box, 'Sun and energy', 'share in direct sun, mean energy so far');
    const y = yAxis(box, 0, 100, [0, 50, 100], (v) => `${v}%`);
    const maxKwh = Math.max(...shot.series.meanCumKwh.pitch, ...shot.series.meanCumKwh.stands, 0.05);
    const yk = (v) => PLOT.top + plotH - (v / maxKwh) * plotH;
    g.textAlign = 'left'; g.fillStyle = '#ff9a73';
    for (const t of niceTicks(0, maxKwh, 2)) g.fillText(`${t}`, box.x + box.w - PLOT.right + 2, yk(t) + 3.5);
    const line = (series, scale, colour, width = 1.6) => {
      g.strokeStyle = colour; g.lineWidth = width; g.beginPath();
      for (let f = 0; f < n; f += 2) { const x = px(box, f), yy = scale(series[f]); f === 0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
      g.stroke();
    };
    line(shot.series.sunlitPct.pitch, y, '#6ec6ff');
    line(shot.series.sunlitPct.stands, y, '#ffb84d');
    line(shot.series.meanCumKwh.pitch, yk, '#ff7a59', 1.2);
    line(shot.series.meanCumKwh.stands, yk, '#ff7a59', 2);
    state.sunBox = { y, yk };
  }
  chartState = state;
}

function drawCharts(shot, f) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, CH_H);
  ctx.drawImage(staticLayer, 0, 0, W, CH_H);
  const { px, boxes, n } = chartState;
  const plotH = CH_H - PLOT.top - PLOT.bottom;
  for (const box of boxes) {
    const x = px(box, f);
    ctx.fillStyle = 'rgba(11,14,19,0.74)';
    ctx.fillRect(x, PLOT.top, box.x + box.w - PLOT.right - x + 1, plotH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 0.5, PLOT.top - 3, 1, plotH + 3);
  }
  // Dots on the lines at the cursor.
  const dot = (box, yy, colour) => {
    ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(px(box, f), yy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0b0e13'; ctx.lineWidth = 1; ctx.stroke();
  };
  dot(boxes[1], chartState.tempBox.y(shot.series.meanUtci.stands[f]), '#ffb84d');
  dot(boxes[1], chartState.tempBox.y(shot.series.meanUtci.pitch[f]), '#6ec6ff');
  dot(boxes[2], chartState.sunBox.y(shot.series.sunlitPct.stands[f]), '#ffb84d');
  dot(boxes[2], chartState.sunBox.y(shot.series.sunlitPct.pitch[f]), '#6ec6ff');
  dot(boxes[2], chartState.sunBox.yk(shot.series.meanCumKwh.stands[f]), '#ff7a59');
  // Legend keys, drawn live so the values can sit next to them.
  ctx.font = '500 10px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
  const keyText = (box, items) => {
    let x = box.x + PLOT.left + 6;
    for (const [colour, text] of items) {
      ctx.fillStyle = colour; ctx.fillRect(x, PLOT.top + 5, 9, 3);
      ctx.fillStyle = '#c4cfda'; ctx.fillText(text, x + 13, PLOT.top + 9);
      x += 13 + ctx.measureText(text).width + 12;
    }
  };
  keyText(boxes[1], [['#e7ecf2', `air ${shot.db[f].toFixed(1)}°`], ['#ffb84d', `seats ${shot.series.meanUtci.stands[f].toFixed(1)}°`], ['#6ec6ff', `pitch ${shot.series.meanUtci.pitch[f].toFixed(1)}°`]]);
  keyText(boxes[2], [['#ffb84d', `seats in sun ${shot.series.sunlitPct.stands[f].toFixed(0)}%`], ['#6ec6ff', `pitch ${shot.series.sunlitPct.pitch[f].toFixed(0)}%`], ['#ff7a59', `${shot.series.meanCumKwh.stands[f].toFixed(2)} kWh/m²`]]);
}

// ---------- drawing ----------
const state = { active: false, shot: null, t0: 0 };
const panels = [{ x: 0, mode: 0 }, { x: W / 2, mode: 1 }];
const half = THREE.DataUtils.toHalfFloat;

function setCamera(shot, f) {
  const filmFrames = shot.orbitStart + f;
  const bearing = ORBIT_START_BEARING + (ORBIT_RATE * filmFrames) / FPS;
  const elevation = THREE.MathUtils.degToRad(39);
  const dist = 440;
  const dir = compassToModel(bearing);
  camera.position.set(dir.x * Math.cos(elevation) * dist, Math.sin(elevation) * dist + TARGET.y, dir.z * Math.cos(elevation) * dist);
  camera.lookAt(TARGET);
  camera.updateMatrixWorld(true);
}

function drawFrame(shot, f, fade = 0) {
  const base = f * N;
  for (let s = 0; s < N_STAND; s++) {
    seatDataU[s] = shot.utci[base + N_PITCH + s] / 2 - 50;
    seatDataE[s] = shot.irr[base + N_PITCH + s];
  }
  for (let c = 0; c < NX * NZ; c++) {
    const src = base + gridSource[c];
    pitchDataU[c] = half(shot.utci[src] / 2 - 50);
    pitchDataE[c] = half(shot.irr[src]);
  }
  seatTexU.needsUpdate = seatTexE.needsUpdate = pitchTexU.needsUpdate = pitchTexE.needsUpdate = true;

  setCamera(shot, f);
  const sunDir = sunDirection(shot.altitude[f], shot.azimuth[f]);
  const up = shot.altitude[f] > 0;
  sunMarker.visible = up;
  sunMarker.position.copy(sunDir).multiplyScalar(SUN_R);

  renderer.setScissor(0, 0, W, H); renderer.setViewport(0, 0, W, H);
  renderer.setClearColor(0x0b0e13, 1);
  renderer.clear();
  for (const p of panels) {
    renderer.setViewport(p.x, H - PANEL_Y - PANEL_H, W / 2, PANEL_H);
    renderer.setScissor(p.x, H - PANEL_Y - PANEL_H, W / 2, PANEL_H);
    renderer.setClearColor(0x10151c, 1);
    renderer.clear();
    for (const m of [seatMaterial, pitchMaterial]) {
      m.uniforms.uMode.value = p.mode;
      m.uniforms.uMax.value = shot.maxCumWhM2;
    }
    seatMaterial.uniforms.uSeatData.value = p.mode === 0 ? seatTexU : seatTexE;
    pitchMaterial.uniforms.uPitchData.value = p.mode === 0 ? pitchTexU : pitchTexE;
    renderer.render(scene, camera);
  }

  const blurb = f > shot.frames - Math.min(300, Math.round(shot.frames * 0.4)) ? shot.summary : BLURBS[shot.name] ?? '';
  if (blurb !== state.blurb) { $('shotBlurb').textContent = blurb; state.blurb = blurb; }
  const m = shot.minutes[f];
  $('clockText').textContent = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  $('kSun').textContent = `${Math.round(shot.altitude[f])}°`.replace('-', '−');
  $('kAir').textContent = `${shot.db[f].toFixed(1)} °C`;
  $('kWind').textContent = `${shot.wind[f].toFixed(1)} m/s`;
  $('kDni').textContent = shot.dni[f].toFixed(0);
  $('progress').style.width = `${(100 * f) / (shot.frames - 1)}%`;
  drawCharts(shot, f);
  drawDial(shot, f);
  $('fade').style.opacity = String(fade);
}

const kwh = (v) => (v < 1 ? v.toFixed(2) : v.toFixed(1));
function setShot(shot) {
  state.shot = shot;
  const last = shot.frames - 1;
  shot.summary = `By sunset the seats have received ${kwh(shot.series.meanCumKwh.stands[last])} kWh/m² on average and the pitch ` +
    `${kwh(shot.series.meanCumKwh.pitch[last])} kWh/m². At most ${Math.max(...shot.series.sunlitPct.stands).toFixed(0)}% of seats were in direct sun at once.`;
  state.blurb = null;
  $('shotName').textContent = `${shot.title}, ${shot.dateLabel}`;
  const maxKwh = shot.maxCumWhM2 / 1000;
  $('rampTicks').innerHTML = rampTickValues(maxKwh)
    .map((v) => `<span style="left:${(Math.sqrt(v / maxKwh) * 100).toFixed(1)}%">${v < 1 ? v.toFixed(2) : v.toFixed(1)}</span>`).join('');
  buildCharts(shot);
}

function loop(now) {
  requestAnimationFrame(loop);
  if (!state.active) return;
  const shot = state.shot;
  const f = Math.min(shot.frames - 1, Math.max(0, Math.round((now - state.t0) / (1000 / FPS)) - 1));
  const fade = Math.max(1 - f / FADE_FRAMES, 1 - (shot.frames - 1 - f) / FADE_FRAMES, 0);
  drawFrame(shot, f, fade);
}
requestAnimationFrame(loop);

const byName = (name) => shots.find((s) => s.name === name);
window.film = {
  shots: shots.map((s) => ({ name: s.name, frames: s.frames })),
  // Start playing a shot on the page clock. The caller then advances the clock by frames / 60 seconds.
  startShot(name) {
    setShot(byName(name));
    state.t0 = performance.now();
    state.active = true;
  },
  stop() { state.active = false; $('fade').style.opacity = '1'; },
  // Draw one frame at once, for stills.
  seek(name, f, { fade = 0 } = {}) {
    state.active = false;
    setShot(byName(name));
    drawFrame(byName(name), f, fade);
  },
};
document.body.dataset.ready = '1';
