import * as THREE from 'three';
import { sunDirection } from './site.js';

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const SUN_DISTANCE = 600;
const PATH_RADIUS = 450;
// Day of year (1 to 365) for each preset button.
const PRESETS = { summer: 172, equinox: 80, winter: 355 };

export function dayLabel(day) {
  let d = day;
  for (let m = 0; m < 12; m++) {
    if (d <= MONTH_DAYS[m]) return `${d} ${MONTHS[m]}`;
    d -= MONTH_DAYS[m];
  }
  return '';
}

const timeLabel = (minute) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
const smoothstep = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

// Drives the sun light, sun marker and sun path from the Ladybug positions in /data/sun.json.
export async function initSun({ scene, sun, hemi, shadowsOn }) {
  const data = await (await fetch('/data/sun.json')).json();
  const perDay = 1440 / data.stepMinutes;
  const altAt = (dayIdx, slot) => data.altitude[dayIdx * perDay + slot] / 10;
  const azAt = (dayIdx, slot) => data.azimuth[dayIdx * perDay + slot] / 10;

  const el = (id) => document.getElementById(id);
  const dayInput = el('day'), minuteInput = el('minute');
  const state = { day: Number(dayInput.value), minute: Number(minuteInput.value), playing: false };

  const marker = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.MeshBasicMaterial({ color: 0xffc400 }));
  scene.add(marker);

  const pathGroup = new THREE.Group();
  for (const [day, colour] of [[PRESETS.summer, 0xf08a00], [PRESETS.equinox, 0xd6b800], [PRESETS.winter, 0x2f6fed]]) {
    const pts = [];
    for (let slot = 0; slot < perDay; slot++) {
      const alt = altAt(day - 1, slot);
      if (alt > 0) pts.push(sunDirection(alt, azAt(day - 1, slot)).multiplyScalar(PATH_RADIUS));
    }
    pathGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: colour })));
  }
  scene.add(pathGroup);

  function apply() {
    const slot = Math.round(state.minute / data.stepMinutes) % perDay;
    const alt = altAt(state.day - 1, slot);
    const az = azAt(state.day - 1, slot);
    const dir = sunDirection(alt, az);
    sun.position.copy(dir).multiplyScalar(SUN_DISTANCE);
    sun.intensity = 2.2 * smoothstep(0, 8, alt);
    sun.castShadow = shadowsOn() && alt > 0;
    hemi.intensity = 0.25 + 0.85 * smoothstep(-4, 12, alt);
    marker.visible = alt > 0;
    marker.position.copy(dir).multiplyScalar(PATH_RADIUS);
    el('dayLabel').textContent = dayLabel(state.day);
    el('timeLabel').textContent = timeLabel(state.minute);
    el('sunInfo').textContent = alt > 0
      ? `Sun altitude ${alt.toFixed(1)}°, azimuth ${az.toFixed(1)}° (${COMPASS[Math.round(az / 22.5) % 16]})`
      : 'Sun is below the horizon';
    dayInput.value = state.day;
    minuteInput.value = state.minute;
  }

  dayInput.addEventListener('input', () => { state.day = Number(dayInput.value); apply(); });
  minuteInput.addEventListener('input', () => { state.minute = Number(minuteInput.value); apply(); });
  el('shadows').addEventListener('change', apply);
  el('path').addEventListener('change', () => { pathGroup.visible = el('path').checked; });
  for (const b of document.querySelectorAll('[data-preset]')) {
    b.addEventListener('click', () => { state.day = PRESETS[b.dataset.preset]; state.minute = 750; apply(); });
  }
  el('play').addEventListener('click', () => {
    state.playing = !state.playing;
    el('play').textContent = state.playing ? 'Pause' : 'Play';
  });

  let last = performance.now();
  let acc = 0;
  (function tick(now) {
    if (state.playing) {
      acc += (now - last) * 0.06; // one second of real time is one hour of sun time
      if (acc >= data.stepMinutes) {
        const steps = Math.floor(acc / data.stepMinutes);
        acc -= steps * data.stepMinutes;
        state.minute = (state.minute + steps * data.stepMinutes) % 1440;
        apply();
      }
    }
    last = now;
    requestAnimationFrame(tick);
  })(last);

  apply();
}
