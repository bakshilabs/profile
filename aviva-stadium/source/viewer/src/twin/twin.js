import './twin.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createTwin } from './core.js';

const $ = (id) => document.getElementById(id);

// Theme: the same stored choice as the analysis page, otherwise the system setting.
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage can be unavailable */ } } };
let theme = store.get('aviva-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = theme;

const twin = await createTwin({
  container: $('app'),
  onProgress: (f, text) => { $('fill').style.width = `${Math.round(f * 100)}%`; if (text) $('status').textContent = text; },
});
const { camera, renderer, georef, north } = twin;
twin.setTheme(theme);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 40; controls.maxDistance = 3000;

const views = {
  overview: { pos: [-260, 210, 420], target: [0, 10, 0] },
  plan: { pos: [-north.x * 4, 900, -north.z * 4], target: [0, 0, 0] }, // north is up the screen
  south: { pos: [north.x * -330, 70, north.z * -330], target: [0, 15, 0] },
  pitch: { pos: [30, 3.5, 40], target: [0, 14, 10] },
};
// Narrow windows need the camera further back to keep the stadium in frame. The pitch view stays where it is.
function setView(name) {
  const v = views[name], target = new THREE.Vector3(...v.target);
  const k = name === 'pitch' ? 1 : Math.max(1, 1.15 / camera.aspect);
  camera.position.copy(new THREE.Vector3(...v.pos).sub(target).multiplyScalar(k).add(target));
  controls.target.copy(target); controls.update();
}
setView('overview');

for (const el of document.querySelectorAll('[data-layer]')) el.addEventListener('change', () => twin.setVisible(el.dataset.layer, el.checked));
for (const el of document.querySelectorAll('[data-view]')) el.addEventListener('click', () => setView(el.dataset.view));
const MONTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function dateText(doy) { let d = doy, m = 0; while (d > MONTHS[m]) { d -= MONTHS[m]; m++; } return `${d} ${NAMES[m]}`; }
function updateSun() {
  const doy = Number($('day').value), hr = Number($('hour').value);
  const s = twin.setSun(doy, hr); const hh = Math.floor(hr), mm = Math.round((hr - hh) * 60);
  $('sunText').textContent = `${dateText(doy)}, ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} UTC. Sun height ${s.altitude.toFixed(1)} degrees, direction ${s.azimuth.toFixed(0)} degrees.`;
}
$('day').addEventListener('input', updateSun); $('hour').addEventListener('input', updateSun);
$('shadows').addEventListener('change', () => twin.setShadows($('shadows').checked));
updateSun();
$('info').innerHTML = `<b>Position.</b> The model's +Z axis points to compass bearing ${georef.bearingOfPlusZ.toFixed(1)} degrees, accurate to about ${georef.bearingUncertaintyDegrees} degrees. The footprint centre is at ${georef.originLatLon.lat.toFixed(5)}, ${georef.originLatLon.lon.toFixed(5)}. It was fitted to the mapped stadium outline, with an outline error of about ${georef.fit.outerRmsMetres.toFixed(0)} m.`;

$('themeBtn').addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme; store.set('aviva-theme', theme); twin.setTheme(theme);
});
$('controls').open = matchMedia('(min-width: 761px)').matches;

addEventListener('resize', () => twin.resize(innerWidth, innerHeight));
const compass = $('compass').getContext('2d');
const fwd = new THREE.Vector3();
function drawCompass() {
  const g = compass, W = 184, c = W / 2; g.clearRect(0, 0, W, W);
  camera.getWorldDirection(fwd); fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
  const rx = -fwd.z, rz = fwd.x; // right-hand vector on the ground
  const sx = north.x * rx + north.z * rz, sy = north.x * fwd.x + north.z * fwd.z; // north in screen terms: right, forward (up)
  const a = Math.atan2(sx, sy); // 0 means north is straight up the screen
  g.save(); g.translate(c, c); g.rotate(a);
  g.strokeStyle = getComputedStyle(document.body).color; g.fillStyle = '#d62b2b'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, -62); g.lineTo(13, 8); g.lineTo(0, -2); g.lineTo(-13, 8); g.closePath(); g.fill();
  g.fillStyle = g.strokeStyle; g.beginPath(); g.moveTo(0, 62); g.lineTo(9, 14); g.lineTo(0, 6); g.lineTo(-9, 14); g.closePath(); g.globalAlpha = .45; g.fill(); g.globalAlpha = 1;
  g.font = 'bold 22px Inter, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#d62b2b'; g.fillText('N', 0, -68 + 4); g.restore();
}
renderer.setAnimationLoop(() => { controls.update(); twin.render(); drawCompass(); });
$('loading').style.opacity = '0'; setTimeout(() => $('loading').remove(), 500);
window.twin = twin; window.twinControls = controls; window.twinSetView = setView;
document.body.dataset.ready = '1';
