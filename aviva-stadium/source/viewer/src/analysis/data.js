import { CLASS_OF_BYTE } from './theme.js';

export const HOURS = 8760;
export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_START = MONTH_DAYS.reduce((acc, d, i) => (acc.push(i ? acc[i - 1] + MONTH_DAYS[i - 1] : 0), acc), []);
export const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
export const SECTOR_NAMES = ['North', 'North-east', 'East', 'South-east', 'South', 'South-west', 'West', 'North-west'];

// Byte limits for the no thermal stress band (9 to 26 degrees): a byte stores (UTCI + 50) x 2.
const NO_STRESS_LO = (9 + 50) * 2, NO_STRESS_HI = (26 + 50) * 2;

export function dayLabel(day) {
  let d = day;
  for (let m = 0; m < 12; m++) {
    if (d < MONTH_DAYS[m]) return `${d + 1} ${MONTHS[m]}`;
    d -= MONTH_DAYS[m];
  }
  return '';
}
export const clockLabel = (t) => {
  const m = Math.round(t * 60);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

const BASE = import.meta.env?.BASE_URL ?? '/';

async function fetchBytes(url, onBytes) {
  const res = await fetch(url);
  onBytes?.(0, Number(res.headers.get('content-length')) || 0);
  const reader = res.body.getReader();
  const parts = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onBytes?.(value.length, 0);
  }
  const out = new Uint8Array(got);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Reads a data file, using a gzip copy beside it when there is one.
async function fetchData(url, onBytes) {
  try {
    const res = await fetch(`${url}.gz`);
    const type = res.headers.get('content-type') ?? '';
    if (res.ok && !type.includes('text/html') && typeof DecompressionStream !== 'undefined') {
      onBytes?.(0, Number(res.headers.get('content-length')) || 0);
      const counted = res.body.pipeThrough(new TransformStream({ transform(chunk, ctl) { onBytes?.(chunk.length, 0); ctl.enqueue(chunk); } }));
      const alreadyDecoded = (res.headers.get('content-encoding') ?? '').includes('gzip');
      const stream = alreadyDecoded ? counted : counted.pipeThrough(new DecompressionStream('gzip'));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
  } catch { /* fall back to the plain file */ }
  return fetchBytes(url, onBytes);
}

export async function loadData(onProgress) {
  const base = `${BASE}data/dash/`;
  let loaded = 0, expected = 0;
  const tick = (n, total) => { loaded += n; expected += total; onProgress?.(expected ? Math.min(1, loaded / expected) : 0); };
  const [points, weather, bits, utci] = await Promise.all([
    fetchData(`${base}points.json`, tick).then((b) => JSON.parse(new TextDecoder().decode(b))),
    fetchData(`${base}weather.json`, tick).then((b) => JSON.parse(new TextDecoder().decode(b))),
    fetchData(`${base}sunlit.bits`, tick),
    fetchData(`${base}utci.u8`, tick),
  ]);
  const n = points.n;
  const w = {};
  for (const k of ['alt', 'az', 'db', 'rh', 'wind', 'dni', 'dhi', 'ghi', 'hir']) w[k] = Float32Array.from(weather[k]);
  w.sinAlt = Float32Array.from(w.alt, (a) => (a > 0 ? Math.sin((a * Math.PI) / 180) : 0));
  // Sunrise and sunset by day, from the hours with the sun above the horizon.
  const sunrise = new Float32Array(365), sunset = new Float32Array(365);
  for (let d = 0; d < 365; d++) {
    let first = -1, last = -1;
    for (let h = 0; h < 24; h++) if (w.alt[d * 24 + h] > 0) { if (first < 0) first = h; last = h; }
    sunrise[d] = first < 0 ? 12 : first;
    sunset[d] = last < 0 ? 12 : last + 1;
  }
  return {
    n, nPitch: points.nPitch, bph: points.bytesPerHour, bits, utci, w, sunrise, sunset,
    kind: Uint8Array.from(points.kind), sector: Int8Array.from(points.sector),
    x: Float32Array.from(points.x), y: Float32Array.from(points.y), z: Float32Array.from(points.z),
    svf: Float32Array.from(points.svf), pointHeight: points.pointHeight, cell: points.pitchCell,
    north: points.northBearingOfPlusZ, pitchCentre: points.pitchCentre, station: weather.station,
  };
}

const lit = (D, hour, i) => (D.bits[hour * D.bph + (i >> 3)] >> (i & 7)) & 1;

// Per-point values at a moment (day 0 to 364, time in hours), interpolated between the hours either side.
export function instantValues(D, metric, day, time, out) {
  const pos = Math.min(HOURS - 1, Math.max(0, day * 24 + time - 0.5));
  const h0 = Math.floor(pos), h1 = Math.min(HOURS - 1, h0 + 1), f = pos - h0;
  const { n, utci, w } = D;
  if (metric === 'utci' || metric === 'radiant') {
    const air = w.db[h0] + (w.db[h1] - w.db[h0]) * f;
    for (let i = 0; i < n; i++) {
      const a = utci[h0 * n + i] / 2 - 50, b = utci[h1 * n + i] / 2 - 50;
      const u = a + (b - a) * f;
      out[i] = metric === 'utci' ? u : u - air;
    }
  } else if (metric === 'sun') {
    for (let i = 0; i < n; i++) {
      const a = lit(D, h0, i), b = lit(D, h1, i);
      out[i] = a + (b - a) * f;
    }
  } else if (metric === 'energy') {
    // Accumulated since midnight of that day, in kWh per square metre: whole hours so far plus part of this one.
    out.fill(0);
    const hNow = Math.floor(time), part = time - hNow;
    for (let hh = 0; hh <= Math.min(hNow, 23); hh++) {
      const hour = day * 24 + hh;
      if (w.alt[hour] <= 0) continue;
      const share = hh < hNow ? 1 : part;
      if (share <= 0) continue;
      const beam = w.dni[hour] * w.sinAlt[hour], sky = w.dhi[hour];
      for (let i = 0; i < n; i++) out[i] += (beam * lit(D, hour, i) + sky * D.svf[i]) * share / 1000;
    }
  }
  return out;
}

// Selection of points: seats and pitch groups, and one stand section for the seats.
export function selectionMask(D, group, sector) {
  const mask = new Uint8Array(D.n);
  for (let i = 0; i < D.n; i++) {
    const seat = D.kind[i] === 1;
    mask[i] = (seat && group !== 'pitch' && (sector < 0 || D.sector[i] === sector)) || (!seat && group !== 'seats') ? 1 : 0;
  }
  return mask;
}

// Hourly aggregates over a set of points: mean UTCI, share in sun, and the count in each of the 7 UTCI classes.
export function aggregate(D, mask) {
  const idx = [];
  for (let i = 0; i < D.n; i++) if (mask[i]) idx.push(i);
  const m = idx.length;
  const meanUtci = new Float32Array(HOURS), sunPct = new Float32Array(HOURS), cls = new Float32Array(HOURS * 7);
  if (!m) return { m, meanUtci, sunPct, cls };
  const { utci, bits, bph, n } = D;
  const counts = new Uint32Array(7);
  for (let h = 0; h < HOURS; h++) {
    counts.fill(0);
    let sum = 0, sun = 0;
    const base = h * n, bb = h * bph;
    for (let k = 0; k < m; k++) {
      const i = idx[k], b = utci[base + i];
      sum += b;
      counts[CLASS_OF_BYTE[b]]++;
      sun += (bits[bb + (i >> 3)] >> (i & 7)) & 1;
    }
    meanUtci[h] = sum / m / 2 - 50;
    sunPct[h] = (100 * sun) / m;
    for (let c = 0; c < 7; c++) cls[h * 7 + c] = counts[c];
  }
  return { m, meanUtci, sunPct, cls };
}

// Per-point totals over a list of days and a window of hours of the day.
export function periodPerPoint(D, days, hFrom, hTo) {
  const { n, utci, w } = D;
  const sunHours = new Float32Array(n), energy = new Float32Array(n);
  const cold = new Float32Array(n), ok = new Float32Array(n), heat = new Float32Array(n);
  let hoursCounted = 0;
  for (const d of days) {
    for (let hh = hFrom; hh < hTo; hh++) {
      const hour = d * 24 + hh;
      hoursCounted++;
      const base = hour * n;
      const daylight = w.alt[hour] > 0;
      const beam = w.dni[hour] * w.sinAlt[hour], sky = w.dhi[hour];
      for (let i = 0; i < n; i++) {
        const b = utci[base + i];
        if (b < NO_STRESS_LO) cold[i]++; else if (b < NO_STRESS_HI) ok[i]++; else heat[i]++;
        if (daylight) {
          const l = lit(D, hour, i);
          sunHours[i] += l;
          energy[i] += (beam * l + sky * D.svf[i]) / 1000;
        }
      }
    }
  }
  const pct = (a) => { for (let i = 0; i < n; i++) a[i] = hoursCounted ? (100 * a[i]) / hoursCounted : 0; return a; };
  return { sunHours, energy, cold: pct(cold), ok: pct(ok), heat: pct(heat), hoursCounted };
}

// Monthly class shares (percent) over the hour window, for the given aggregate.
export function monthlyClasses(agg, hFrom, hTo) {
  const out = new Float32Array(12 * 7);
  for (let m = 0; m < 12; m++) {
    const counts = new Float64Array(7);
    for (let d = MONTH_START[m]; d < MONTH_START[m] + MONTH_DAYS[m]; d++) {
      for (let hh = hFrom; hh < hTo; hh++) for (let c = 0; c < 7; c++) counts[c] += agg.cls[(d * 24 + hh) * 7 + c];
    }
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    for (let c = 0; c < 7; c++) out[m * 7 + c] = (100 * counts[c]) / total;
  }
  return out;
}

// Mean of a per-point array over the points in the mask.
export function meanOver(values, mask) {
  let s = 0, c = 0;
  for (let i = 0; i < values.length; i++) if (mask[i]) { s += values[i]; c++; }
  return c ? s / c : 0;
}
