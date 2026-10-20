import './style.css';
import { TOKENS, SLOT, CLASSES, UTCI_ANCHORS, sequential, diverging, utciHex, mixHex, sample } from './theme.js';
import {
  loadData, instantValues, selectionMask, aggregate, periodPerPoint, monthlyClasses, meanOver,
  dayLabel, clockLabel, MONTH_START, MONTH_DAYS, MONTHS, SECTORS, SECTOR_NAMES, HOURS,
} from './data.js';
import { Scene3D } from './scene.js';
import { h, card, legend, DayChart, Heatmap, MonthlyClasses, HBars, table, state as chartState, tip } from './charts.js';

const $ = (id) => document.getElementById(id);
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage can be unavailable */ } } };

// ---------- state ----------
const theme0 = store.get('aviva-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
const S = {
  theme: theme0, metric: 'utci', compare: false, active: 0,
  moments: [{ day: 170, time: 13 }, { day: 361, time: 12 }],
  period: { from: 0, to: 364 }, hours: [8, 20], group: 'both', sector: -1,
  playing: false, speed: 1, point: -1, showSun: true, showRoof: true, heatMetric: 'sun', secMetric: 'comfort',
};
document.documentElement.dataset.theme = S.theme;
chartState.theme = S.theme;

const METRICS = {
  utci: { kind: 'now', label: 'Thermal stress', title: 'Thermal stress (UTCI)' },
  sun: { kind: 'now', label: 'Sun and shade', title: 'Sun and shade' },
  energy: { kind: 'now', label: 'Energy so far', title: 'Solar energy so far today', hint: 'Solar energy since midnight on the chosen date' },
  radiant: { kind: 'now', label: 'Sun effect', title: 'UTCI minus air temperature', hint: 'How many degrees the sun, sky and surroundings add to or take from the air temperature' },
  sunhours: { kind: 'period', label: 'Sun hours', title: 'Direct sun hours', hint: 'Hours in direct sun over the chosen period' },
  energyPeriod: { kind: 'period', label: 'Solar energy', title: 'Solar energy over the period' },
  comfort: { kind: 'period', label: 'No-stress share', title: 'Share of hours with no thermal stress', hint: 'Share of the chosen hours with no thermal stress' },
};
const GROUPS = { both: 'Seats and pitch', seats: 'Seats', pitch: 'Pitch' };
const tk = () => TOKENS[S.theme];

// ---------- loading ----------
let D, scene, aggSeatsCache = new Map(), aggPitch, periodCache = new Map();
const loadBar = $('loadBar'), loadText = $('loadText');
const setLoad = (frac, text) => { loadBar.style.width = `${Math.round(frac * 100)}%`; if (text) loadText.textContent = text; };

async function boot() {
  setLoad(0.02, 'Loading the hourly results');
  D = await loadData((f) => setLoad(f * 0.4));
  setLoad(0.42, 'Summarising the year');
  await new Promise((r) => setTimeout(r, 20));
  aggPitch = aggregate(D, selectionMask(D, 'pitch', -1));
  getAggSeats(-1);
  buildUI();
  scene = new Scene3D($('stage'), D, S.theme);
  setLoad(0.5, 'Loading the stadium model');
  await scene.load((f) => setLoad(0.5 + f * 0.45));
  setLoad(0.97, 'Preparing the view');
  scene.setRoofVisible(S.showRoof);
  bindScene();
  refreshAll();
  $('loading').hidden = true;
  $('app').hidden = false;
  scene.resize();
  scene.requestRender();
  window.__analysis = { S, D, scene, refreshAll };
  setTimeout(() => scene.ensureBVH(), 300);
}

// ---------- selections and caches ----------
function getAggSeats(sector) {
  if (!aggSeatsCache.has(sector)) aggSeatsCache.set(sector, aggregate(D, selectionMask(D, 'seats', sector)));
  return aggSeatsCache.get(sector);
}
const seatsAgg = () => getAggSeats(S.sector);
function combinedAgg() {
  const parts = [];
  if (S.group !== 'pitch') parts.push(seatsAgg());
  if (S.group !== 'seats') parts.push(aggPitch);
  const m = parts.reduce((a, p) => a + p.m, 0);
  if (parts.length === 1) return parts[0];
  const out = { m, meanUtci: new Float32Array(HOURS), sunPct: new Float32Array(HOURS), cls: new Float32Array(HOURS * 7) };
  for (let i = 0; i < HOURS; i++) {
    for (const p of parts) { out.meanUtci[i] += (p.meanUtci[i] * p.m) / m; out.sunPct[i] += (p.sunPct[i] * p.m) / m; }
  }
  for (let i = 0; i < HOURS * 7; i++) for (const p of parts) out.cls[i] += p.cls[i];
  return out;
}
const mask = () => selectionMask(D, S.group, S.sector);
function periodDays() {
  const { from, to } = S.period, days = [];
  if (from <= to) for (let d = from; d <= to; d++) days.push(d);
  else { for (let d = from; d < 365; d++) days.push(d); for (let d = 0; d <= to; d++) days.push(d); }
  return days;
}
function getPeriod() {
  const key = `${S.period.from}-${S.period.to}-${S.hours[0]}-${S.hours[1]}`;
  if (!periodCache.has(key)) {
    if (periodCache.size > 6) periodCache.delete(periodCache.keys().next().value);
    periodCache.set(key, periodPerPoint(D, periodDays(), S.hours[0], S.hours[1]));
  }
  return periodCache.get(key);
}
const monthActive = () => { const days = new Set(periodDays()); return Array.from({ length: 12 }, (_, m) => { for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) if (days.has(d)) return true; return false; }); };
const periodLabel = () => (S.period.from === 0 && S.period.to === 364 ? 'the whole year' : `${dayLabel(S.period.from)} to ${dayLabel(S.period.to)}`);
const hoursLabel = () => `${String(S.hours[0]).padStart(2, '0')}:00 to ${String(S.hours[1]).padStart(2, '0')}:00`;

// ---------- sun position at a moment ----------
function sunAt(day, time) {
  const pos = Math.min(HOURS - 1, Math.max(0, day * 24 + time - 0.5)), a = Math.floor(pos), b = Math.min(HOURS - 1, a + 1), f = pos - a;
  const alt = D.w.alt[a] + (D.w.alt[b] - D.w.alt[a]) * f;
  let da = D.w.az[b] - D.w.az[a];
  if (da > 180) da -= 360; if (da < -180) da += 360;
  const path = [];
  for (let hh = 0; hh < 24; hh++) if (D.w.alt[day * 24 + hh] > 0) path.push([D.w.alt[day * 24 + hh], D.w.az[day * 24 + hh]]);
  return { alt, az: (D.w.az[a] + da * f + 360) % 360, path, pathKey: `${day}` };
}
const weatherAt = (day, time) => {
  const pos = Math.min(HOURS - 1, Math.max(0, day * 24 + time - 0.5)), a = Math.floor(pos), b = Math.min(HOURS - 1, a + 1), f = pos - a;
  const L = (arr) => arr[a] + (arr[b] - arr[a]) * f;
  return { db: L(D.w.db), rh: L(D.w.rh), wind: L(D.w.wind), dni: L(D.w.dni), dhi: L(D.w.dhi) };
};
const compass = (az) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(az / 22.5) % 16];

// ---------- building the page ----------
const els = {};
let charts = {};

function chip(label, pressed, onclick, extra = {}) { return h('button', { class: 'chip', type: 'button', 'aria-pressed': String(pressed), onclick, ...extra }, label); }

function makeDual({ min, max, value, step = 1, onInput, allowWrap = false }) {
  const a = h('input', { type: 'range', min, max, step, value: value[0], 'aria-label': 'From' });
  const b = h('input', { type: 'range', min, max, step, value: value[1], 'aria-label': 'To' });
  const fill1 = h('div', { class: 'fill' }), fill2 = h('div', { class: 'fill' });
  const root = h('div', { class: 'dual' }, h('div', { class: 'track' }), fill1, fill2, a, b);
  const paint = () => {
    const lo = Number(a.value), hi = Number(b.value), span = max - min, pc = (v) => ((v - min) / span) * 100;
    if (lo <= hi) { fill1.style.left = `${pc(lo)}%`; fill1.style.width = `${pc(hi) - pc(lo)}%`; fill2.style.width = '0'; }
    else { fill1.style.left = `${pc(lo)}%`; fill1.style.width = `${100 - pc(lo)}%`; fill2.style.left = '0'; fill2.style.width = `${pc(hi)}%`; }
  };
  const fire = (src) => {
    if (!allowWrap) { if (src === a && Number(a.value) >= Number(b.value)) a.value = Number(b.value) - step; if (src === b && Number(b.value) <= Number(a.value)) b.value = Number(a.value) + step; }
    paint(); onInput([Number(a.value), Number(b.value)]);
  };
  a.addEventListener('input', () => fire(a)); b.addEventListener('input', () => fire(b));
  paint();
  return { root, set(v) { a.value = v[0]; b.value = v[1]; paint(); } };
}

function buildFilters() {
  const f = document.querySelector('.filters');
  const SEASONS = [['Whole year', 0, 364], ['Spring', 59, 150], ['Summer', 151, 242], ['Autumn', 243, 333], ['Winter', 334, 58]];
  const periodChips = SEASONS.map(([label, from, to]) => chip(label, false, () => { S.period = { from, to }; dualDays.set([from, to]); onPeriodChange(); }, { 'data-season': label }));
  const dualDays = makeDual({ min: 0, max: 364, value: [0, 364], allowWrap: true, onInput: ([from, to]) => { S.period = { from, to }; onPeriodChange(); } });
  els.dualDays = dualDays; els.periodChips = periodChips; els.periodLabel = h('span', { class: 'frange num' });
  const HOUR_SETS = [['08:00 to 20:00', 8, 20], ['All day', 0, 24], ['Evening', 17, 23]];
  const hourChips = HOUR_SETS.map(([label, a, b]) => chip(label, false, () => { S.hours = [a, b]; dualHours.set([a, b]); onPeriodChange(); }, { 'data-hours': label }));
  const dualHours = makeDual({ min: 0, max: 24, value: [8, 20], onInput: (v) => { S.hours = v; onPeriodChange(); } });
  els.dualHours = dualHours; els.hourChips = hourChips; els.hoursLabel = h('span', { class: 'frange num' });
  const groupSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Surfaces' }, Object.entries(GROUPS).map(([k, label]) => h('button', { type: 'button', 'aria-pressed': String(S.group === k), 'data-group': k, onclick: () => { S.group = k; onSelectionChange(); } }, label)));
  const secSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Stand section' }, [h('button', { type: 'button', 'data-sector': -1, 'aria-pressed': 'true', onclick: () => { S.sector = -1; onSelectionChange(); } }, 'All'),
    ...SECTORS.map((sec, i) => h('button', { type: 'button', title: SECTOR_NAMES[i] + ' stand', 'data-sector': i, 'aria-pressed': 'false', onclick: () => { S.sector = S.sector === i ? -1 : i; onSelectionChange(); } }, sec))]);
  els.groupSeg = groupSeg; els.secSeg = secSeg;
  f.replaceChildren(
    h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Period'), h('div', { class: 'frow' }, ...periodChips, dualDays.root, els.periodLabel)),
    h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Hours of the day'), h('div', { class: 'frow' }, ...hourChips, dualHours.root, els.hoursLabel)),
    h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Surfaces'), groupSeg),
    h('div', { class: 'fgroup' }, h('span', { class: 'flabel' }, 'Stand section'), secSeg),
  );
}

function buildViewTools() {
  const tools = $('viewTools');
  const nowSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Show for the time chosen below' }, Object.entries(METRICS).filter(([, m]) => m.kind === 'now').map(([k, m]) => h('button', { type: 'button', 'data-metric': k, title: m.hint ?? m.title, 'aria-pressed': String(S.metric === k), onclick: () => setMetric(k) }, m.label)));
  const perSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Show for the period chosen above' }, Object.entries(METRICS).filter(([, m]) => m.kind === 'period').map(([k, m]) => h('button', { type: 'button', 'data-metric': k, title: m.hint ?? m.title, 'aria-pressed': String(S.metric === k), onclick: () => setMetric(k) }, m.label)));
  const camSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Camera' }, [['aerial', 'Aerial'], ['plan', 'Plan'], ['south', 'South end'], ['west', 'West side']].map(([k, label]) => h('button', { type: 'button', onclick: () => scene.setPreset(k) }, label)));
  els.compareBtn = chip('Compare', false, () => { S.compare = !S.compare; applyCompare(); });
  els.sunBtn = chip('Sun', true, () => { S.showSun = !S.showSun; els.sunBtn.setAttribute('aria-pressed', String(S.showSun)); scene.setSunVisible(S.showSun); });
  els.roofBtn = chip('Roof', true, () => { S.showRoof = !S.showRoof; els.roofBtn.setAttribute('aria-pressed', String(S.showRoof)); scene.setRoofVisible(S.showRoof); });
  els.nowSeg = nowSeg; els.perSeg = perSeg;
  const group = (t, node) => h('div', { class: 'tgroup' }, h('span', { class: 'tlabel' }, t), node);
  tools.replaceChildren(h('div', { class: 'trow' },
    group('At the time', nowSeg), group('Over the period', perSeg), group('Camera', camSeg),
    group('Show', h('div', { class: 'seg' }, els.compareBtn, els.sunBtn, els.roofBtn))));
}

function buildTimeTools() {
  const t = $('timeTools');
  els.dayIn = h('input', { type: 'range', min: 0, max: 364, step: 1, value: S.moments[0].day, 'aria-label': 'Date', oninput: (e) => { activeMoment().day = Number(e.target.value); onMomentChange(true); } });
  els.timeIn = h('input', { type: 'range', min: 0, max: 24, step: 0.05, value: S.moments[0].time, 'aria-label': 'Time of day', oninput: (e) => { activeMoment().time = Number(e.target.value); onMomentChange(false); } });
  els.dayOut = h('span', { class: 'readout num' }); els.timeOut = h('span', { class: 'readout num' });
  els.playBtn = h('button', { class: 'ghost play', type: 'button', onclick: togglePlay }, 'Play');
  els.speedSel = h('select', { 'aria-label': 'Playback speed', onchange: (e) => { S.speed = Number(e.target.value); } }, [1, 2, 4].map((v) => h('option', { value: v }, `${v}x`)));
  els.speedSel.style.cssText = 'background:transparent;color:inherit;border:1px solid var(--border);border-radius:8px;padding:4px 6px;font:inherit';
  els.abSeg = h('div', { class: 'seg', hidden: true, role: 'group', 'aria-label': 'Which moment the sliders change' }, ['A', 'B'].map((l, i) => h('button', { type: 'button', 'data-ab': i, 'aria-pressed': String(i === 0), onclick: () => { S.active = i; syncSliders(); refreshDay(); refreshMomentCard(); updateAB(); } }, l)));
  const presets = h('div', { class: 'presets' }, h('span', {}, 'Clear days'),
    ...[['20 Jun', 170, 13], ['25 Mar', 83, 12.5], ['28 Dec', 361, 12]].map(([label, day, time]) => chip(label, false, () => { Object.assign(activeMoment(), { day, time }); syncSliders(); onMomentChange(true); })),
    els.abSeg);
  t.replaceChildren(
    h('div', { class: 'group' }, els.playBtn, els.speedSel),
    h('div', { class: 'group' }, h('label', {}, 'Date'), els.dayIn, els.dayOut),
    h('div', { class: 'group' }, h('label', {}, 'Time'), els.timeIn, els.timeOut),
    presets);
}

function buildSide() {
  els.momentCard = card('The moment', 'Typical-year weather for this date', {});
  els.momentBody = h('div', {});
  els.momentCard.body.append(els.momentBody);
  els.momentCard.root.querySelector('.card-tools button').remove();
  els.pointCard = card('Selected point', 'Click a seat or the pitch', {});
  els.pointCard.root.hidden = true;
  const clear = h('button', { class: 'ghost', type: 'button', onclick: () => selectPoint(-1) }, 'Clear');
  els.pointCard.head.querySelector('.card-tools').prepend(clear);
  els.pointBody = h('div', {});
  els.pointChartHost = h('div', {});
  els.pointCard.body.append(els.pointBody, els.pointChartHost);
  const tempsCard = card('Temperatures through the day', 'Mean for the chosen surfaces. Drag to change the time.', {});
  const sunCard = card('Direct sun through the day', 'Share of the chosen surfaces in direct sun', {});
  const skyCard = card('Light from the sky and sun', 'From the weather file, on this date', {});
  charts.temps = new DayChart(tempsCard, { unit: '°', band: [9, 26], onScrub: scrubTime });
  charts.sun = new DayChart(sunCard, { unit: '%', height: 150, onScrub: scrubTime });
  charts.sky = new DayChart(skyCard, { unit: '', height: 150, onScrub: scrubTime });
  charts.point = null;
  $('side').replaceChildren(els.pointCard.root, els.momentCard.root, tempsCard.root, sunCard.root, skyCard.root);
  els.pointCardRef = els.pointCard;
}

function buildCharts() {
  const heatTabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Heat map measure' }, [['sun', 'Direct sun'], ['utci', 'UTCI'], ['comfort', 'No thermal stress']].map(([k, label]) => h('button', { type: 'button', 'data-heat': k, 'aria-pressed': String(S.heatMetric === k), onclick: () => { S.heatMetric = k; refreshHeat(); } }, label)));
  const heatCard = card('The year hour by hour', 'Each column is a day and each row an hour. Click to move the moment there.', { tabs: heatTabs });
  charts.heat = new Heatmap(heatCard, { onPick: (day, time) => { Object.assign(activeMoment(), { day, time }); syncSliders(); onMomentChange(true); } });
  const monthCard = card('Thermal stress by month', 'Share of the hours in the window, by UTCI class', {});
  charts.month = new MonthlyClasses(monthCard, {});
  const secTabs = h('div', { class: 'seg', role: 'group', 'aria-label': 'Measure for the sections' }, [['comfort', 'No stress'], ['sunhours', 'Sun hours'], ['energyPeriod', 'Energy']].map(([k, label]) => h('button', { type: 'button', 'data-sec': k, 'aria-pressed': String(S.secMetric === k), onclick: () => { S.secMetric = k; refreshSections(); } }, label)));
  const secCard = card('Stand sections compared', 'Mean of the seats in each section. Click a bar to filter.', { tabs: secTabs });
  charts.sections = new HBars(secCard, { onPick: (id) => { if (id === 'pitch') { S.group = 'pitch'; S.sector = -1; } else { S.group = S.group === 'pitch' ? 'seats' : S.group; S.sector = S.sector === id ? -1 : id; } onSelectionChange(); } });
  const dataCard = card('Numbers behind the charts', 'Means over the period and hours chosen above', {});
  els.dataBody = h('div', {});
  els.dataActions = h('div', { class: 'actions' },
    h('button', { class: 'ghost', type: 'button', onclick: () => downloadCsv('sections.csv', sectionsCsv()) }, 'Download sections (CSV)'),
    h('button', { class: 'ghost', type: 'button', onclick: () => downloadCsv('points.csv', pointsCsv()) }, 'Download every point (CSV)'),
    h('button', { class: 'ghost', type: 'button', onclick: () => downloadCsv('day-hours.csv', dayCsv()) }, 'Download this day by hour (CSV)'));
  dataCard.body.append(els.dataBody, els.dataActions);
  dataCard.root.querySelector('.card-tools button').remove();
  els.secCard = secCard;
  $('paneYear').replaceChildren(heatCard.root, monthCard.root);
  $('paneSections').replaceChildren(secCard.root, dataCard.root);
  els.heatCard = heatCard;
}

function toggleFilters(force) {
  const f = $('filters'), open = force ?? f.hidden;
  f.hidden = !open;
  els.filterBtn.setAttribute('aria-expanded', String(open));
}

const TABS = [['side', 'Moment'], ['paneYear', 'Year'], ['paneSections', 'Sections']];
function buildTabs() {
  const nav = $('tabs');
  nav.replaceChildren(...TABS.map(([id, label], i) => h('button', { class: 'tab', type: 'button', role: 'tab', 'aria-selected': String(i === 0), 'aria-controls': id, 'data-tab': id, onclick: () => showTab(id) }, label)));
}
function showTab(id) {
  for (const [pane] of TABS) $(pane).hidden = pane !== id;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-selected', String(b.dataset.tab === id));
  $('panes').scrollTop = 0;
}

function buildAbout() {
  const d = $('about');
  const close = h('button', { class: 'ghost close', type: 'button', onclick: () => d.close() }, 'Close');
  d.replaceChildren(close, h('h2', { id: 'aboutTitle' }, 'About this analysis'),
    h('p', {}, 'This page shows modelled sun exposure and outdoor thermal comfort for the pitch and seating bowl of the Aviva Stadium in Dublin, for every hour of a typical year. The results come from a model and were not measured on site.'),
    h('h3', {}, 'What the colours mean'),
    h('ul', {}, h('li', {}, 'Thermal stress uses the Universal Thermal Climate Index (UTCI). It is the air temperature that would feel the same to a person, once sun, sky, wind and humidity are taken into account. Between 9 and 26 °C there is no thermal stress. Below 9 °C is cold stress and above 26 °C is heat stress.'),
      h('li', {}, 'Sun and shade shows whether each point can see the sun in that hour.'),
      h('li', {}, 'Solar energy is the direct sun plus light from the sky that reaches a horizontal surface at head height, in kilowatt hours per square metre.')),
    h('h3', {}, 'How it was calculated'),
    h('ul', {}, h('li', {}, `${D.n.toLocaleString('en-GB')} sample points sit 1.2 m above the pitch and the seats, about 2.5 m apart. Seats are treated as seated people and the pitch as standing people.`),
      h('li', {}, 'Sun and shade come from tracing rays from each point to the sun through the 3D model, once an hour for the whole year, using the sun position at the middle of each hour.'),
      h('li', {}, 'Radiant temperature uses the SolarCal model, with the sky view factor of each point and the share of the body in direct sun. UTCI is then calculated from air temperature, radiant temperature, wind speed and humidity.'),
      h('li', {}, `Weather is the ${D.station.name} typical year for 2011 to 2025. Times are Greenwich Mean Time, so Irish summer time is one hour ahead.`)),
    h('h3', {}, 'What it leaves out'),
    h('ul', {}, h('li', {}, 'Roof panels are treated as opaque, although the real roof lets some light through.'),
      h('li', {}, 'Nearby buildings and trees are not in the model, so low winter sun is shaded by the stadium only.'),
      h('li', {}, 'Wind is the weather-station value and is not reduced for shelter inside the bowl.'),
      h('li', {}, 'A typical year has ordinary days, including cloudy ones. The clear-day buttons jump to the clearest day within a week of the solstices and the March equinox.'),
      h('li', {}, 'The compass direction of the model was found from satellite imagery and is accurate to about 2 degrees.')),
    h('h3', {}, 'Credits'),
    h('p', {}, 'Stadium model by S.Gandini, licensed under ', h('a', { href: 'https://creativecommons.org/licenses/by/4.0/', rel: 'noopener' }, 'CC BY 4.0'), '. ',
      h('a', { href: 'https://sketchfab.com/3d-models/aviva-stadium-d62b3a640ccb421487a650e9074609be', rel: 'noopener' }, 'Original model'),
      '. The model was compressed for the web, and its colours and transparency were changed for this page.'),
    h('p', {}, 'Weather: the Dublin Airport typical year for 2011 to 2025 (TMYx) from ', h('a', { href: 'https://climate.onebuilding.org/', rel: 'noopener' }, 'Climate.OneBuilding'),
      ', which builds its files from public weather observations and reanalysis data. Lawrie and Crawley, Development of Global Typical Meteorological Years (TMYx).'));
}

function buildUI() {
  $('subtitle').textContent = `Hourly results for a typical year in Dublin, for ${(D.n - D.nPitch).toLocaleString('en-GB')} seat points and ${D.nPitch.toLocaleString('en-GB')} pitch points.`;
  buildFilters(); buildViewTools(); buildTimeTools(); buildSide(); buildCharts(); buildTabs(); buildAbout();
  els.filterBtn = $('filterBtn');
  els.filterBtn.addEventListener('click', () => toggleFilters());
  document.addEventListener('pointerdown', (e) => { const f = $('filters'); if (!f.hidden && !f.contains(e.target) && !els.filterBtn.contains(e.target)) toggleFilters(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleFilters(false); });
  $('toolbar').open = matchMedia('(min-width: 980px)').matches;
  $('aboutBtn').addEventListener('click', () => $('about').showModal());
  $('themeBtn').addEventListener('click', () => setTheme(S.theme === 'dark' ? 'light' : 'dark'));
  $('foot').replaceChildren('Stadium model by S.Gandini, ', h('a', { href: 'https://creativecommons.org/licenses/by/4.0/', rel: 'noopener' }, 'CC BY 4.0'), ' (compressed for the web, colours changed). Weather: Dublin Airport typical year 2011 to 2025, TMYx from ', h('a', { href: 'https://climate.onebuilding.org/', rel: 'noopener' }, 'Climate.OneBuilding'), '. Times are Greenwich Mean Time. The results come from a model.');
  window.addEventListener('keydown', (e) => { if (e.code === 'Space' && !/INPUT|SELECT|BUTTON|TEXTAREA/.test(document.activeElement?.tagName ?? '')) { e.preventDefault(); togglePlay(); } });
}

function bindScene() {
  const canvas = scene.canvas;
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    scene.ensureBVH().then(() => selectPoint(scene.pick(e.clientX, e.clientY)));
  });
}

// ---------- actions ----------
const activeMoment = () => S.moments[S.active];
function setTheme(theme) {
  S.theme = theme; chartState.theme = theme;
  document.documentElement.dataset.theme = theme;
  store.set('aviva-theme', theme);
  scene.applyTheme(theme);
  refreshAll();
}
function setMetric(k) {
  S.metric = k;
  const period = METRICS[k].kind === 'period';
  if (period && S.compare) { S.compare = false; applyCompare(); }
  els.compareBtn.disabled = period;
  els.compareBtn.title = period ? 'Comparing works with the metrics that follow the time chosen below.' : '';
  for (const b of document.querySelectorAll('[data-metric]')) b.setAttribute('aria-pressed', String(b.dataset.metric === k));
  refreshScene(); refreshLegend(); refreshLabels();
}
function applyCompare() {
  els.compareBtn.setAttribute('aria-pressed', String(S.compare));
  els.abSeg.hidden = !S.compare;
  $('labelB').hidden = !S.compare; $('divider').hidden = !S.compare;
  if (!S.compare) { S.active = 0; updateAB(); syncSliders(); }
  scene.setCompare(S.compare);
  refreshScene(); refreshLabels(); refreshDay(); refreshMomentCard();
}
function updateAB() { for (const b of els.abSeg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(Number(b.dataset.ab) === S.active)); }
function onPeriodChange() { periodDebounce(); refreshFilterLabels(); }
let periodTimer = 0;
function periodDebounce() {
  $('panes').style.opacity = '0.6'; $('kpis').style.opacity = '0.6';
  clearTimeout(periodTimer);
  periodTimer = setTimeout(() => { refreshPeriodDependent(); $('panes').style.opacity = ''; $('kpis').style.opacity = ''; }, 60);
}
function onSelectionChange() {
  for (const b of els.groupSeg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.group === S.group));
  for (const b of els.secSeg.querySelectorAll('button')) { b.setAttribute('aria-pressed', String(Number(b.dataset.sector) === S.sector)); b.disabled = S.group === 'pitch'; }
  $('panes').style.opacity = '0.6';
  setTimeout(() => { getAggSeats(S.sector); refreshAll(); $('panes').style.opacity = ''; }, 20);
}
function onMomentChange(dayChanged) {
  syncSliders(false);
  refreshScene(); refreshMomentCard(); refreshCursors();
  if (dayChanged) refreshDay();
  if (S.point >= 0) refreshPoint();
}
function scrubTime(t) { activeMoment().time = Math.min(24, Math.max(0, Math.round(t * 20) / 20)); onMomentChange(false); }
function syncSliders() {
  const m = activeMoment();
  els.dayIn.value = m.day; els.timeIn.value = m.time;
  els.dayOut.textContent = dayLabel(m.day); els.timeOut.textContent = clockLabel(m.time);
}
function togglePlay() {
  S.playing = !S.playing;
  els.playBtn.textContent = S.playing ? 'Pause' : 'Play';
  if (!S.playing) return;
  let last = performance.now();
  const step = (now) => {
    if (!S.playing) return;
    const m = activeMoment();
    m.time += ((now - last) / 1000) * 1.5 * S.speed; last = now;
    if (m.time >= 24) m.time = 0;
    onMomentChange(false);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function selectPoint(i) {
  S.point = i;
  scene.setSelected(i);
  els.pointCard.root.hidden = i < 0;
  if (i >= 0) refreshPoint();
}

// ---------- refreshing ----------
function refreshAll() {
  refreshFilterLabels(); syncSliders(); refreshScene(); refreshLegend(); refreshLabels();
  refreshMomentCard(); refreshDay(); refreshPeriodDependent(); refreshHeat();
  if (S.point >= 0) refreshPoint();
}

function refreshFilterLabels() {
  const sec = S.sector >= 0 && S.group !== 'pitch' ? `, ${SECTOR_NAMES[S.sector].toLowerCase()} stand` : '';
  if (els.filterBtn) els.filterBtn.textContent = `Filters: ${periodLabel()}, ${hoursLabel()}, ${GROUPS[S.group].toLowerCase()}${sec}`;
  els.periodLabel.textContent = S.period.from > S.period.to ? `${dayLabel(S.period.from)} to ${dayLabel(S.period.to)}, across the new year` : `${dayLabel(S.period.from)} to ${dayLabel(S.period.to)}`;
  els.hoursLabel.textContent = `${String(S.hours[0]).padStart(2, '0')}:00 to ${String(S.hours[1]).padStart(2, '0')}:00`;
  const seasons = { 'Whole year': [0, 364], Spring: [59, 150], Summer: [151, 242], Autumn: [243, 333], Winter: [334, 58] };
  for (const b of els.periodChips) { const r = seasons[b.dataset.season]; b.setAttribute('aria-pressed', String(r[0] === S.period.from && r[1] === S.period.to)); }
  const hs = { '08:00 to 20:00': [8, 20], 'All day': [0, 24], Evening: [17, 23] };
  for (const b of els.hourChips) { const r = hs[b.dataset.hours]; b.setAttribute('aria-pressed', String(r[0] === S.hours[0] && r[1] === S.hours[1])); }
}

function viewSpec(i) {
  const k = S.metric, m = S.moments[i], tkn = tk();
  const mk = mask(), maskF = Float32Array.from(mk);
  const sunInfo = sunAt(m.day, m.time);
  const base = { mask: maskF, sun: sunInfo };
  const values = new Float32Array(D.n);
  if (METRICS[k].kind === 'now') {
    instantValues(D, k, m.day, m.time, values);
    if (k === 'utci') return { ...base, mode: 0, values };
    if (k === 'sun') return { ...base, mode: 1, values, min: 0, max: 1, ramp: sequential('orange', S.theme) };
    if (k === 'energy') return { ...base, mode: 1, values, min: 0, max: energyScale(), sqrt: 1, ramp: sequential('orange', S.theme) };
    return { ...base, mode: 2, values, max: 12, ramp: diverging(S.theme) };
  }
  const p = getPeriod();
  if (k === 'sunhours') { const max = niceMax(maxOf(p.sunHours)); return { ...base, mode: 1, values: p.sunHours, min: 0, max, ramp: sequential('orange', S.theme) }; }
  if (k === 'energyPeriod') { const max = niceMax(maxOf(p.energy)); return { ...base, mode: 1, values: p.energy, min: 0, max, ramp: sequential('orange', S.theme) }; }
  return { ...base, mode: 1, values: p.ok, min: 0, max: 100, ramp: sequential('blue', S.theme) };
}
const maxOf = (a) => { let m = 0; for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; };
const niceMax = (v) => { if (v <= 0) return 1; const mag = 10 ** Math.floor(Math.log10(v)); return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((x) => x * mag).find((x) => x >= v * 0.999) ?? v; };
const energyScale = () => (S.compare ? Math.max(dayEnergyMax(S.moments[0].day), dayEnergyMax(S.moments[1].day)) : dayEnergyMax(S.moments[0].day));
const dayMaxCache = new Map();
function dayEnergyMax(day) {
  if (!dayMaxCache.has(day)) { const v = instantValues(D, 'energy', day, 24, new Float32Array(D.n)); dayMaxCache.set(day, Math.max(0.05, maxOf(v))); }
  return dayMaxCache.get(day);
}

function refreshScene() {
  if (!scene) return;
  const count = S.compare ? 2 : 1;
  for (let i = 0; i < count; i++) scene.setView(i, viewSpec(i));
  scene.setSunVisible(S.showSun);
}

function refreshLabels() {
  const label = (i) => {
    const m = S.moments[i], k = S.metric;
    const prefix = S.compare ? `${'AB'[i]}: ` : '';
    return METRICS[k].kind === 'now' ? [h('b', {}, `${prefix}${METRICS[k].title}`), `  ${dayLabel(m.day)}, ${clockLabel(m.time)}`]
      : [h('b', {}, METRICS[k].title), `  ${periodLabel()}, ${hoursLabel()}`];
  };
  $('labelA').replaceChildren(...label(0));
  $('labelB').replaceChildren(...label(1));
}

function refreshLegend() {
  const k = S.metric, v = viewSpec(0), t = tk();
  const bar = (stops) => h('div', { class: 'bar', style: `background:linear-gradient(90deg, ${stops.join(',')})` });
  const ticks = (items, cls = '') => h('div', { class: `ticks ${cls}` }, items.map(([p, label], i) => h('span', { class: i === 0 ? 'first' : i === items.length - 1 ? 'last' : '', style: `left:${p}%` }, label)));
  let nodes;
  if (k === 'utci') {
    const [lo, hi] = [-20, 32], pos = (u) => ((u - lo) / (hi - lo)) * 100, stops = [];
    for (let u = lo; u <= hi; u += 1) stops.push(`${utciHex(u)} ${pos(u)}%`);
    const edges = [lo, -13, 0, 9, 26, hi], names = ['Strong cold', 'Moderate cold', 'Slight cold', 'No thermal stress', 'Moderate heat'];
    nodes = [bar(stops), ticks(edges.map((e) => [pos(e), `${e}`.replace('-', '−')])),
      ticks(names.map((n, i) => [pos((edges[i] + edges[i + 1]) / 2), n]), 'names'),
      h('div', { class: 'cap' }, 'UTCI in °C at head height. White lines mark 0, 9 and 26 °C.')];
  } else if (v.mode === 2) {
    const stops = v.ramp.map((c, i) => `${c} ${(i / 8) * 100}%`);
    nodes = [bar(stops), ticks([[0, `−${v.max} °C`], [50, '0'], [100, `+${v.max} °C`]]), h('div', { class: 'cap' }, 'Degrees the sun, sky and surroundings add to the air temperature (positive) or take from it (negative).')];
  } else {
    const stops = v.ramp.map((c, i) => `${c} ${(i / 6) * 100}%`);
    const unit = k === 'sun' ? '' : k === 'sunhours' ? ' h' : k === 'comfort' ? '%' : ' kWh/m²';
    const frac = (x) => (v.sqrt ? Math.sqrt(x) : x) * 100;
    let marks;
    if (k === 'sun') marks = [[0, 'Shade'], [100, 'Direct sun']];
    else {
      const want = v.sqrt ? [0, 0.05, 0.25, 0.5, 1].map((f) => f * v.max) : [0, 0.25, 0.5, 0.75, 1].map((f) => f * v.max);
      marks = want.map((x) => [frac(x / v.max), `${k === 'energy' || k === 'energyPeriod' ? (x < 1 && x > 0 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : x.toFixed(0)) : x.toFixed(0)}${unit}`]);
    }
    const cap = { sun: 'Whether the point can see the sun in that hour. Between hours the colours blend.', energy: `Energy since midnight on this date, on a square-root scale so low values stay visible. Most is ${v.max.toFixed(1)} kWh/m².`, sunhours: 'Hours with the point in direct sun, over the period and hours chosen above.', energyPeriod: 'Direct sun plus sky light on a horizontal surface at head height, over the period.', comfort: 'Share of the hours chosen above with UTCI between 9 and 26 °C.' }[k];
    nodes = [bar(stops), ticks(marks), h('div', { class: 'cap' }, cap)];
  }
  $('legendRow').replaceChildren(h('div', { class: 'scale' }, ...nodes));
}

function refreshMomentCard() {
  const m = activeMoment(), w = weatherAt(m.day, m.time), sun = sunAt(m.day, m.time);
  const hour = Math.min(HOURS - 1, m.day * 24 + Math.min(23, Math.floor(m.time)));
  const agg = combinedAgg();
  els.momentCard.setSubtitle(`${S.compare ? `Moment ${'AB'[S.active]}: ` : ''}${dayLabel(m.day)}, ${clockLabel(m.time)}. Typical-year weather.`);
  const pair = (a, b) => h('div', { class: 'pair' }, h('span', {}, a), h('b', { class: 'num' }, b));
  const classes = CLASSES.map((c, i) => ({ c, v: agg.m ? (100 * agg.cls[hour * 7 + i]) / agg.m : 0 })).filter((x) => x.v > 0.05);
  const top = [...classes].sort((a, b) => b.v - a.v).slice(0, 3).map((x) => `${x.v.toFixed(0)}% ${x.c.name.toLowerCase()}`).join(', ');
  els.momentBody.replaceChildren(
    h('div', { class: 'pairs' },
      pair('Air temperature', `${w.db.toFixed(1)} °C`), pair('Humidity', `${w.rh.toFixed(0)}%`),
      pair('Wind at 10 m', `${w.wind.toFixed(1)} m/s`), pair('Direct sun', `${w.dni.toFixed(0)} W/m²`),
      pair('Sky light', `${w.dhi.toFixed(0)} W/m²`), pair('Sun height', sun.alt > 0 ? `${sun.alt.toFixed(0)}°` : 'Below the horizon'),
      pair('Sun direction', sun.alt > 0 ? `${sun.az.toFixed(0)}° ${compass(sun.az)}` : 'None'), pair('Daylight', `${clockLabel(D.sunrise[m.day])} to ${clockLabel(D.sunset[m.day])}`),
      pair(`Mean UTCI, ${GROUPS[S.group].toLowerCase()}`, `${agg.meanUtci[hour].toFixed(1)} °C`), pair('In direct sun', `${agg.sunPct[hour].toFixed(0)}%`)),
    h('div', { class: 'classbar', role: 'img', 'aria-label': `Thermal stress classes: ${top}` }, classes.map((x) => h('i', { style: `flex:${x.v};background:${x.c.hex}`, title: `${x.c.name}: ${x.v.toFixed(1)}%` }))),
    h('p', { class: 'classnote' }, top || 'No points selected.'));
}

function dayHourly(arr, day) { return Float32Array.from({ length: 24 }, (_, hh) => arr[day * 24 + hh]); }
function refreshDay() {
  const m = activeMoment(), t = tk(), day = m.day;
  const seats = seatsAgg(), pitch = aggPitch;
  const showSeats = S.group !== 'pitch', showPitch = S.group !== 'seats';
  const sunrise = D.sunrise[day], sunset = D.sunset[day];
  const temp = (v) => `${v.toFixed(1)} °C`, pct = (v) => `${v.toFixed(0)}%`, wm = (v) => `${v.toFixed(0)} W/m²`;
  const seatName = S.sector >= 0 ? `${SECTOR_NAMES[S.sector]} stand seats` : 'Seats';
  charts.temps.update({ label: 'Temperatures through the day', sunrise, sunset, series: [
    { label: 'Air temperature', color: t.series[SLOT.air], values: dayHourly(D.w.db, day), format: temp, dash: '5 4' },
    ...(showSeats ? [{ label: `${seatName}, UTCI`, color: t.series[SLOT.seats], values: dayHourly(seats.meanUtci, day), format: temp }] : []),
    ...(showPitch ? [{ label: 'Pitch, UTCI', color: t.series[SLOT.pitch], values: dayHourly(pitch.meanUtci, day), format: temp }] : []),
  ] }, m.time);
  charts.sun.update({ label: 'Share in direct sun', sunrise, sunset, yDomain: [0, 100], series: [
    ...(showSeats ? [{ label: seatName, color: t.series[SLOT.seats], values: dayHourly(seats.sunPct, day), format: pct, area: true }] : []),
    ...(showPitch ? [{ label: 'Pitch', color: t.series[SLOT.pitch], values: dayHourly(pitch.sunPct, day), format: pct }] : []),
  ] }, m.time);
  charts.sky.update({ label: 'Direct and sky light', sunrise, sunset, yDomain: [0, Math.max(100, Math.ceil(Math.max(...dayHourly(D.w.dni, day), ...dayHourly(D.w.dhi, day)) / 100) * 100)], series: [
    { label: 'Direct sun (normal to the rays)', color: t.series[SLOT.dni], values: dayHourly(D.w.dni, day), format: wm },
    { label: 'Light from the sky (horizontal)', color: t.series[SLOT.dhi], values: dayHourly(D.w.dhi, day), format: wm },
  ] }, m.time);
}
function refreshCursors() { const tm = activeMoment().time; for (const c of [charts.temps, charts.sun, charts.sky]) c.setCursor(tm); charts.heat.setCursor({ day: activeMoment().day, time: activeMoment().time }); }

function rampLookup(ramp, n = 96) { const arr = Array.from({ length: n }, (_, i) => sample(ramp, i / (n - 1))); return (t) => arr[Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))))]; }
function refreshHeat() {
  for (const b of document.querySelectorAll('[data-heat]')) b.setAttribute('aria-pressed', String(b.dataset.heat === S.heatMetric));
  const agg = combinedAgg(), k = S.heatMetric;
  const dateLabel = (d) => dayLabel(d);
  let spec;
  const sunSteps = (ramp) => h('div', { class: 'scale' }, h('div', { class: 'bar', style: `background:linear-gradient(90deg, ${ramp.map((c, i) => `${c} ${(i / (ramp.length - 1)) * 100}%`).join(',')})` }));
  if (k === 'sun') {
    const ramp = sequential('orange', S.theme), look = rampLookup(ramp);
    spec = { values: (d, hr) => agg.sunPct[d * 24 + hr], colour: (v) => look(v / 100), format: (v) => `${v.toFixed(0)}%`, label: `${GROUPS[S.group]} in direct sun`, legend: h('div', { class: 'scale' }, sunSteps(ramp), h('div', { class: 'ticks' }, [[0, '0%'], [100, '100% in direct sun']].map(([p, l], i) => h('span', { class: i ? 'last' : 'first', style: `left:${p}%` }, l)))) };
  } else if (k === 'utci') {
    spec = { values: (d, hr) => agg.meanUtci[d * 24 + hr], colour: (v) => utciHex(v), format: (v) => `${v.toFixed(1)} °C`, label: `Mean UTCI, ${GROUPS[S.group].toLowerCase()}`, legend: h('div', { class: 'scale' }, h('div', { class: 'bar', style: `background:linear-gradient(90deg, ${Array.from({ length: 53 }, (_, i) => `${utciHex(-20 + i)} ${(i / 52) * 100}%`).join(',')})` }), h('div', { class: 'ticks' }, [[0, '−20 °C'], [(29 / 52) * 100, '9'], [(46 / 52) * 100, '26'], [100, '32 °C']].map(([p, l], i, a) => h('span', { class: i === 0 ? 'first' : i === a.length - 1 ? 'last' : '', style: `left:${p}%` }, l)))) };
  } else {
    const ramp = sequential('blue', S.theme), look = rampLookup(ramp);
    spec = { values: (d, hr) => (agg.m ? (100 * agg.cls[(d * 24 + hr) * 7 + 4]) / agg.m : 0), colour: (v) => look(v / 100), format: (v) => `${v.toFixed(0)}%`, label: 'Share with no thermal stress', legend: h('div', { class: 'scale' }, sunSteps(ramp), h('div', { class: 'ticks' }, [[0, '0%'], [100, '100% with no thermal stress']].map(([p, l], i) => h('span', { class: i ? 'last' : 'first', style: `left:${p}%` }, l)))) };
  }
  charts.heat.update({ ...spec, dateLabel, sunrise: D.sunrise, sunset: D.sunset });
  charts.heat.setCursor({ day: activeMoment().day, time: activeMoment().time });
}

function refreshPeriodDependent() {
  const p = getPeriod(), mk = mask(), agg = combinedAgg();
  // KPI tiles
  const okPct = meanOver(p.ok, mk), cold = meanOver(p.cold, mk), heat = meanOver(p.heat, mk), sunH = meanOver(p.sunHours, mk), en = meanOver(p.energy, mk);
  const tile = (cls, label, value, unit, note) => h('div', { class: `tile ${cls}`, title: cls.includes('hero') ? null : note }, h('span', { class: 'label' }, label), h('span', { class: 'value' }, value, unit ? h('small', {}, unit) : null), cls.includes('hero') ? h('span', { class: 'note' }, note) : null);
  const scope = `${GROUPS[S.group]}${S.sector >= 0 && S.group !== 'pitch' ? `, ${SECTOR_NAMES[S.sector].toLowerCase()} stand` : ''}, ${periodLabel()}, ${hoursLabel()}`;
  const range = (arr, unit, digits = 0) => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < arr.length; i++) if (mk[i]) { lo = Math.min(lo, arr[i]); hi = Math.max(hi, arr[i]); } return `Points range from ${lo.toFixed(digits)} to ${hi.toFixed(digits)}${unit}`; };
  $('kpis').replaceChildren(
    tile('hero', 'No thermal stress', okPct.toFixed(0), '%', `Share of hours. ${scope}`),
    tile('', 'Direct sun per point', sunH.toFixed(0), 'h', range(p.sunHours, ' h')),
    tile('', 'Solar energy per point', en.toFixed(0), 'kWh/m²', range(p.energy, '', 0)),
    tile('', 'Cold stress', cold.toFixed(0), '% of hours', 'UTCI below 9 °C'),
    tile(heat < 0.05 ? 'dim' : '', 'Heat stress', heat < 0.05 ? '0' : heat.toFixed(1), '% of hours', 'UTCI above 26 °C'));
  if (METRICS[S.metric].kind === 'period') { refreshScene(); refreshLegend(); refreshLabels(); }
  // Monthly classes, sections and data table
  const active = monthActive();
  charts.month.update(monthlyClasses(agg, S.hours[0], S.hours[1]), active, MONTHS);
  refreshSections();
  refreshDataTable();
}

function sectionStats() {
  const p = getPeriod();
  const rows = [];
  const add = (id, label, test) => {
    let n = 0, sun = 0, en = 0, ok = 0, cold = 0, heat = 0;
    for (let i = 0; i < D.n; i++) if (test(i)) { n++; sun += p.sunHours[i]; en += p.energy[i]; ok += p.ok[i]; cold += p.cold[i]; heat += p.heat[i]; }
    rows.push({ id, label, n, sunHours: n ? sun / n : 0, energy: n ? en / n : 0, ok: n ? ok / n : 0, cold: n ? cold / n : 0, heat: n ? heat / n : 0 });
  };
  SECTORS.forEach((sec, i) => add(i, `${SECTOR_NAMES[i]} stand`, (j) => D.kind[j] === 1 && D.sector[j] === i));
  add('seats', 'All seats', (j) => D.kind[j] === 1);
  add('pitch', 'Pitch', (j) => D.kind[j] === 0);
  return rows;
}
function refreshSections() {
  for (const b of document.querySelectorAll('[data-sec]')) b.setAttribute('aria-pressed', String(b.dataset.sec === S.secMetric));
  const stats = sectionStats().filter((r) => r.id !== 'seats');
  const key = { comfort: 'ok', sunhours: 'sunHours', energyPeriod: 'energy' }[S.secMetric];
  const fmt = { comfort: (v) => `${v.toFixed(0)}%`, sunhours: (v) => `${v.toFixed(0)} h`, energyPeriod: (v) => `${v.toFixed(0)} kWh/m²` }[S.secMetric];
  const label = { comfort: 'Hours with no thermal stress', sunhours: 'Direct sun hours', energyPeriod: 'Solar energy' }[S.secMetric];
  const max = niceMax(Math.max(...stats.map((r) => r[key])) * 1.02);
  const selected = S.group === 'pitch' ? 'pitch' : S.sector >= 0 ? S.sector : null;
  charts.sections.update(stats.map((r) => ({ id: r.id, label: r.id === 'pitch' ? 'Pitch' : SECTOR_NAMES[r.id], value: r[key], detail: label })),
    { format: fmt, max, selected, title: label, columns: ['Section', label], tableRows: stats.map((r) => [r.label, fmt(r[key])]) });
}
function refreshDataTable() {
  const rows = sectionStats();
  els.dataBody.replaceChildren(table(['Section', 'Points', 'Direct sun (h)', 'Solar energy (kWh/m²)', 'No thermal stress (%)', 'Cold stress (%)', 'Heat stress (%)'],
    rows.map((r) => [r.label, r.n, r.sunHours.toFixed(0), r.energy.toFixed(0), r.ok.toFixed(1), r.cold.toFixed(1), r.heat.toFixed(1)])));
}

function refreshPoint() {
  const i = S.point, m = activeMoment(), p = getPeriod(), t = tk();
  const seat = D.kind[i] === 1;
  els.pointCard.root.querySelector('h3').textContent = seat ? `Seat in the ${SECTOR_NAMES[D.sector[i]].toLowerCase()} stand` : 'Point on the pitch';
  els.pointCard.setSubtitle(`${(D.y[i] - 1.2).toFixed(1)} m above the pitch level, sky view ${(100 * D.svf[i]).toFixed(0)}%`);
  const pair = (a, b) => h('div', { class: 'pair' }, h('span', {}, a), h('b', { class: 'num' }, b));
  els.pointBody.replaceChildren(h('div', { class: 'pairs' }, pair('Direct sun', `${p.sunHours[i].toFixed(0)} h`), pair('Solar energy', `${p.energy[i].toFixed(0)} kWh/m²`),
    pair('No thermal stress', `${p.ok[i].toFixed(0)}% of hours`), pair('Cold stress', `${p.cold[i].toFixed(0)}% of hours`)));
  const day = m.day, utci = Float32Array.from({ length: 24 }, (_, hh) => D.utci[(day * 24 + hh) * D.n + i] / 2 - 50);
  if (!charts.point) {
    const c = card('This point through the day', '', {});
    c.root.style.cssText = 'border:0;padding:0;margin-top:6px';
    c.head.style.display = 'none';
    els.pointChartHost.replaceChildren(c.root);
    charts.point = new DayChart(c, { unit: '°', height: 150, band: [9, 26], onScrub: scrubTime });
  }
  charts.point.update({ label: 'UTCI at the selected point', sunrise: D.sunrise[day], sunset: D.sunset[day], series: [
    { label: 'Air temperature', color: t.series[SLOT.air], values: dayHourly(D.w.db, day), format: (v) => `${v.toFixed(1)} °C`, dash: '5 4' },
    { label: seat ? 'This seat, UTCI' : 'This pitch point, UTCI', color: t.series[seat ? SLOT.seats : SLOT.pitch], values: utci, format: (v) => `${v.toFixed(1)} °C` },
  ] }, m.time);
}

// ---------- CSV ----------
function downloadCsv(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v) => (typeof v === 'string' && /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\n');
function sectionsCsv() {
  return toCsv([['Section', 'Points', 'Direct sun (h)', 'Solar energy (kWh/m2)', 'No thermal stress (%)', 'Cold stress (%)', 'Heat stress (%)', 'Period', 'Hours'],
    ...sectionStats().map((r) => [r.label, r.n, r.sunHours.toFixed(1), r.energy.toFixed(1), r.ok.toFixed(2), r.cold.toFixed(2), r.heat.toFixed(2), periodLabel(), hoursLabel()])]);
}
function pointsCsv() {
  const p = getPeriod(), rows = [['Point', 'Surface', 'Stand section', 'X (m)', 'Y (m)', 'Z (m)', 'Sky view factor', 'Direct sun (h)', 'Solar energy (kWh/m2)', 'No thermal stress (%)', 'Cold stress (%)', 'Heat stress (%)']];
  for (let i = 0; i < D.n; i++) rows.push([i, D.kind[i] === 1 ? 'Seat' : 'Pitch', D.kind[i] === 1 ? SECTOR_NAMES[D.sector[i]] : '', D.x[i].toFixed(2), D.y[i].toFixed(2), D.z[i].toFixed(2), D.svf[i].toFixed(3), p.sunHours[i], p.energy[i].toFixed(1), p.ok[i].toFixed(1), p.cold[i].toFixed(1), p.heat[i].toFixed(1)]);
  return toCsv(rows);
}
function dayCsv() {
  const m = activeMoment(), seats = seatsAgg(), rows = [['Date', 'Hour', 'Air temperature (C)', 'Humidity (%)', 'Wind at 10 m (m/s)', 'Direct normal (W/m2)', 'Diffuse horizontal (W/m2)', 'Sun altitude (deg)', 'Seats mean UTCI (C)', 'Pitch mean UTCI (C)', 'Seats in direct sun (%)', 'Pitch in direct sun (%)']];
  for (let hh = 0; hh < 24; hh++) { const k = m.day * 24 + hh; rows.push([dayLabel(m.day), `${String(hh).padStart(2, '0')}:00`, D.w.db[k].toFixed(1), D.w.rh[k].toFixed(0), D.w.wind[k].toFixed(1), D.w.dni[k].toFixed(0), D.w.dhi[k].toFixed(0), D.w.alt[k].toFixed(1), seats.meanUtci[k].toFixed(1), aggPitch.meanUtci[k].toFixed(1), seats.sunPct[k].toFixed(1), aggPitch.sunPct[k].toFixed(1)]); }
  return toCsv(rows);
}

boot().catch((e) => { console.error(e); loadText.textContent = 'The page could not load. Please check that the data files are present.'; });
