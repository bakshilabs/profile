import { TOKENS, SLOT, CLASSES } from './theme.js';

const NS = 'http://www.w3.org/2000/svg';
export const state = { theme: 'dark' };
const tk = () => TOKENS[state.theme];

export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}
export function s(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
}
const text = (parent, x, y, str, attrs = {}) => { const t = s('text', { x, y, ...attrs }, parent); t.textContent = str; return t; };

// ---- tooltip ----
const tipEl = h('div', { class: 'tip', role: 'status' });
document.body.appendChild(tipEl);
export const tip = {
  show(evt, title, rows) {
    tipEl.replaceChildren(h('div', { class: 'tip-title' }, title), ...rows.map((r) => h('div', { class: 'tip-row' },
      h('i', { class: r.box ? 'key box' : 'key', style: `background:${r.color}` }),
      h('b', {}, r.value), h('span', {}, r.label))));
    tipEl.style.display = 'block';
    const pad = 14, w = tipEl.offsetWidth, hgt = tipEl.offsetHeight;
    let x = evt.clientX + pad, y = evt.clientY + pad;
    if (x + w > innerWidth - 8) x = evt.clientX - w - pad;
    if (y + hgt > innerHeight - 8) y = evt.clientY - hgt - pad;
    tipEl.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  },
  hide() { tipEl.style.display = 'none'; },
};

export function niceTicks(lo, hi, count = 4) {
  if (hi <= lo) hi = lo + 1;
  const raw = (hi - lo) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((v) => v >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

export function table(columns, rows) {
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, columns.map((c) => h('th', {}, c)))),
    h('tbody', {}, rows.map((r) => h('tr', {}, r.map((c, i) => h(i === 0 ? 'th' : 'td', { scope: i === 0 ? 'row' : null }, c)))))));
}

// A card with a title, an optional subtitle, the chart and its table twin.
export function card(title, subtitle, { tabs, className = '' } = {}) {
  const body = h('div', { class: 'card-body' });
  const tableBody = h('div', { class: 'card-body', hidden: true });
  let showTable = false;
  const toggle = h('button', { class: 'ghost', type: 'button', 'aria-pressed': 'false', onclick: () => {
    showTable = !showTable;
    toggle.textContent = showTable ? 'Chart' : 'Table';
    toggle.setAttribute('aria-pressed', String(showTable));
    body.hidden = showTable; tableBody.hidden = !showTable;
  } }, 'Table');
  const head = h('div', { class: 'card-head' }, h('div', {}, h('h3', {}, title), subtitle ? h('p', { class: 'sub' }, subtitle) : null), h('div', { class: 'card-tools' }, tabs ?? null, toggle));
  const root = h('section', { class: `card ${className}` }, head, body, tableBody);
  return { root, body, tableBody, head, setSubtitle: (t) => { const p = head.querySelector('.sub'); if (p) p.textContent = t; } };
}

export function legend(items) {
  return h('div', { class: 'legend' }, items.map((i) => h('span', { class: 'legend-item' }, h('i', { class: i.box ? 'key box' : 'key', style: `background:${i.color}` }), i.label)));
}

// ---- line chart over the hours of one day, with a cursor that can be dragged ----
export class DayChart {
  constructor(card, { height = 190, unit = '', yPad = true, band = null, onScrub }) {
    Object.assign(this, { card, height, unit, yPad, band, onScrub });
    this.data = null; this.cursor = 12;
    this.root = card.body;
    this.legendEl = h('div', {});
    this.svg = s('svg', { class: 'chart', role: 'img' });
    this.root.append(this.svg, this.legendEl);
    new ResizeObserver(() => this.draw()).observe(this.root);
  }
  update(data, cursor) { this.data = data; if (cursor != null) this.cursor = cursor; this.draw(); }
  setCursor(t) { this.cursor = t; this.drawCursor(); }
  draw() {
    const d = this.data;
    if (!d) return;
    const w = this.root.clientWidth || 400, H = this.height;
    const m = { l: 40, r: 12, t: 10, b: 24 };
    const svg = this.svg;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.setAttribute('width', w); svg.setAttribute('height', H);
    svg.setAttribute('aria-label', d.label ?? 'Day profile');
    const all = d.series.flatMap((x) => Array.from(x.values));
    if (this.band) all.push(...this.band);
    let lo = Math.min(...all), hi = Math.max(...all);
    if (d.yDomain) [lo, hi] = d.yDomain; else { const p = (hi - lo) * 0.08 || 1; lo -= p; hi += p; }
    const ticks = niceTicks(lo, hi, 4);
    lo = Math.min(lo, ticks[0]); hi = Math.max(hi, ticks[ticks.length - 1]);
    const X = (hr) => m.l + (hr / 24) * (w - m.l - m.r), Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);
    this.X = X; this.Y = Y; this.m = m; this.w = w; this.lo = lo; this.hi = hi;
    const t = tk();
    for (const v of ticks) {
      s('line', { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v), stroke: t.grid, 'stroke-width': 1 }, svg);
      text(svg, m.l - 6, Y(v) + 3.5, this.fmtTick(v), { fill: t.muted, 'font-size': 10.5, 'text-anchor': 'end', class: 'num' });
    }
    if (this.band) {
      s('rect', { x: m.l, y: Y(this.band[1]), width: w - m.l - m.r, height: Math.max(0, Y(this.band[0]) - Y(this.band[1])), fill: t.series[SLOT.pitch], opacity: 0.1 }, svg);
      text(svg, w - m.r - 4, Y(this.band[1]) + 12, 'No thermal stress', { fill: t.muted, 'font-size': 10.5, 'text-anchor': 'end' });
    }
    for (let hr = 0; hr <= 24; hr += 3) {
      text(svg, X(hr), H - 7, `${String(hr % 24).padStart(2, '0')}:00`, { fill: t.muted, 'font-size': 10.5, 'text-anchor': hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle', class: 'num' });
    }
    s('line', { x1: m.l, x2: w - m.r, y1: H - m.b, y2: H - m.b, stroke: t.axis, 'stroke-width': 1 }, svg);
    // Night shading from the sunrise and sunset of this day.
    if (d.sunrise != null) {
      s('rect', { x: m.l, y: m.t, width: Math.max(0, X(d.sunrise) - m.l), height: H - m.t - m.b, fill: t.ink, opacity: 0.045 }, svg);
      s('rect', { x: X(d.sunset), y: m.t, width: Math.max(0, w - m.r - X(d.sunset)), height: H - m.t - m.b, fill: t.ink, opacity: 0.045 }, svg);
    }
    for (const ser of d.series) {
      if (ser.area) {
        const pts = Array.from(ser.values, (v, i) => `${X(i + 0.5)},${Y(v)}`);
        s('path', { d: `M${X(0.5)},${Y(lo)} L${pts.join(' L')} L${X(23.5)},${Y(lo)} Z`, fill: ser.color, opacity: 0.1 }, svg);
      }
      s('path', { d: 'M' + Array.from(ser.values, (v, i) => `${X(i + 0.5)},${Y(v)}`).join(' L'), fill: 'none', stroke: ser.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': ser.dash ?? '' }, svg);
    }
    this.cursorGroup = s('g', {}, svg);
    this.hoverGroup = s('g', { 'pointer-events': 'none' }, svg);
    const hit = s('rect', { x: m.l, y: m.t, width: w - m.l - m.r, height: H - m.t - m.b, fill: 'transparent', style: 'cursor: ew-resize; touch-action: none' }, svg);
    const hourAt = (e) => { const r = svg.getBoundingClientRect(); return Math.min(24, Math.max(0, ((e.clientX - r.left - m.l) / (w - m.l - m.r)) * 24)); };
    let dragging = false;
    hit.addEventListener('pointerdown', (e) => { dragging = true; hit.setPointerCapture(e.pointerId); this.onScrub?.(hourAt(e)); });
    hit.addEventListener('pointerup', () => { dragging = false; });
    hit.addEventListener('pointermove', (e) => {
      const hr = hourAt(e);
      if (dragging) this.onScrub?.(hr);
      this.hover(hr, e);
    });
    hit.addEventListener('pointerleave', () => { this.hoverGroup.replaceChildren(); tip.hide(); });
    this.legendEl.replaceWith((this.legendEl = legend(d.series.map((x) => ({ color: x.color, label: x.label })))));
    this.drawCursor();
    this.fillTable();
  }
  fmtTick(v) { return `${v}${this.unit}`; }
  hover(hr, evt) {
    const d = this.data, i = Math.min(23, Math.max(0, Math.floor(hr)));
    this.hoverGroup.replaceChildren();
    const t = tk(), x = this.X(i + 0.5);
    s('line', { x1: x, x2: x, y1: this.m.t, y2: this.height - this.m.b, stroke: t.axis, 'stroke-width': 1 }, this.hoverGroup);
    for (const ser of d.series) { s('circle', { cx: x, cy: this.Y(ser.values[i]), r: 4, fill: ser.color, stroke: t.surface, 'stroke-width': 2 }, this.hoverGroup); }
    const hh = String(i).padStart(2, '0'), h2 = String((i + 1) % 24).padStart(2, '0');
    tip.show(evt, `${hh}:00 to ${h2}:00`, d.series.map((ser) => ({ color: ser.color, label: ser.label, value: ser.format(ser.values[i]) })));
  }
  drawCursor() {
    if (!this.cursorGroup) return;
    const t = tk(), x = this.X(this.cursor);
    this.cursorGroup.replaceChildren();
    s('line', { x1: x, x2: x, y1: this.m.t, y2: this.height - this.m.b, stroke: t.ink, 'stroke-width': 1.25 }, this.cursorGroup);
    const d = this.data, i = Math.min(23, Math.max(0, Math.floor(this.cursor)));
    for (const ser of d.series) s('circle', { cx: x, cy: this.Y(ser.values[i]), r: 4, fill: ser.color, stroke: t.surface, 'stroke-width': 2 }, this.cursorGroup);
  }
  fillTable() {
    const d = this.data;
    this.card.tableBody.replaceChildren(table(['Hour', ...d.series.map((x) => x.label)], Array.from({ length: 24 }, (_, i) => [`${String(i).padStart(2, '0')}:00`, ...d.series.map((x) => x.format(x.values[i]))])));
  }
}

// ---- year by hour heat map ----
export class Heatmap {
  constructor(card, { height = 230, onPick }) {
    Object.assign(this, { card, height, onPick });
    this.root = card.body;
    this.wrap = h('div', { class: 'heat-wrap' });
    this.canvas = h('canvas', { class: 'heat-canvas' });
    this.svg = s('svg', { class: 'heat-svg' });
    this.wrap.append(this.canvas, this.svg);
    this.legendEl = h('div', { class: 'ramp-legend' });
    this.root.append(this.wrap, this.legendEl);
    this.cursor = { day: 0, time: 12 };
    new ResizeObserver(() => this.draw()).observe(this.root);
  }
  // spec: { values(day, hour) -> number, colour(value) -> hex, format, label, sunrise[], sunset[], legend: DOM }
  update(spec) { this.spec = spec; this.draw(); }
  setCursor(c) { this.cursor = c; this.drawOverlay(); }
  draw() {
    const sp = this.spec;
    if (!sp) return;
    const w = this.root.clientWidth || 600, H = this.height, m = { l: 34, r: 8, t: 6, b: 22 };
    this.w = w; this.m = m;
    const pw = w - m.l - m.r, ph = H - m.t - m.b;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const c = this.canvas;
    c.width = Math.round(pw * dpr); c.height = Math.round(ph * dpr);
    Object.assign(c.style, { left: `${m.l}px`, top: `${m.t}px`, width: `${pw}px`, height: `${ph}px` });
    const g = c.getContext('2d');
    const cw = c.width / 365, ch = c.height / 24;
    for (let d = 0; d < 365; d++) for (let hr = 0; hr < 24; hr++) {
      g.fillStyle = sp.colour(sp.values(d, hr));
      g.fillRect(Math.floor(d * cw), Math.floor((23 - hr) * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1);
    }
    this.svg.replaceChildren();
    this.svg.setAttribute('width', w); this.svg.setAttribute('height', H);
    this.svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
    const t = tk();
    const X = (d) => m.l + (d / 365) * pw, Y = (hr) => m.t + (1 - hr / 24) * ph;
    this.X = X; this.Y = Y;
    for (let hr = 0; hr <= 24; hr += 6) text(this.svg, m.l - 6, Y(hr) + 3.5, String(hr).padStart(2, '0'), { fill: t.muted, 'font-size': 10.5, 'text-anchor': 'end', class: 'num' });
    let day = 0;
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach((mo, i) => {
      text(this.svg, X(day + [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i] / 2), H - 6, mo, { fill: t.muted, 'font-size': 10.5, 'text-anchor': 'middle' });
      day += [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i];
    });
    if (sp.sunrise) {
      for (const arr of [sp.sunrise, sp.sunset]) s('path', { d: 'M' + Array.from(arr, (v, d) => `${X(d + 0.5)},${Y(v)}`).join(' L'), fill: 'none', stroke: t.surface, 'stroke-width': 1.25, opacity: 0.85 }, this.svg);
    }
    this.overlay = s('g', { 'pointer-events': 'none' }, this.svg);
    const hit = s('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent', style: 'cursor: crosshair' }, this.svg);
    const cell = (e) => { const r = this.svg.getBoundingClientRect(); return [Math.min(364, Math.max(0, Math.floor(((e.clientX - r.left - m.l) / pw) * 365))), Math.min(23, Math.max(0, 23 - Math.floor(((e.clientY - r.top - m.t) / ph) * 24)))]; };
    hit.addEventListener('pointermove', (e) => {
      const [d, hr] = cell(e);
      this.hoverCell = [d, hr]; this.drawOverlay();
      tip.show(e, `${sp.dateLabel(d)}, ${String(hr).padStart(2, '0')}:00`, [{ color: sp.colour(sp.values(d, hr)), box: true, label: sp.label, value: sp.format(sp.values(d, hr)) }]);
    });
    hit.addEventListener('pointerleave', () => { this.hoverCell = null; this.drawOverlay(); tip.hide(); });
    hit.addEventListener('click', (e) => { const [d, hr] = cell(e); this.onPick?.(d, hr + 0.5); });
    this.legendEl.replaceChildren(sp.legend);
    this.drawOverlay();
    this.fillTable();
  }
  drawOverlay() {
    if (!this.overlay) return;
    const t = tk(), { m } = this;
    this.overlay.replaceChildren();
    const pw = this.w - m.l - m.r, ph = this.height - m.t - m.b;
    const cx = this.X(this.cursor.day + 0.5), cy = this.Y(this.cursor.time);
    s('line', { x1: cx, x2: cx, y1: m.t, y2: m.t + ph, stroke: t.ink, 'stroke-width': 1, opacity: 0.7 }, this.overlay);
    s('line', { x1: m.l, x2: m.l + pw, y1: cy, y2: cy, stroke: t.ink, 'stroke-width': 1, opacity: 0.7 }, this.overlay);
    s('circle', { cx, cy, r: 4, fill: 'none', stroke: t.ink, 'stroke-width': 2 }, this.overlay);
    if (this.hoverCell) {
      const [d, hr] = this.hoverCell;
      s('rect', { x: this.X(d), y: this.Y(hr + 1), width: pw / 365 + 1, height: ph / 24, fill: 'none', stroke: t.ink, 'stroke-width': 1.5 }, this.overlay);
    }
  }
  fillTable() {
    const sp = this.spec, rows = [];
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31], names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let day = 0;
    for (let mo = 0; mo < 12; mo++) {
      const row = [names[mo]];
      for (const [a, b] of [[0, 6], [6, 12], [12, 18], [18, 24]]) {
        let sum = 0, cnt = 0;
        for (let d = day; d < day + days[mo]; d++) for (let hr = a; hr < b; hr++) { sum += sp.values(d, hr); cnt++; }
        row.push(sp.format(sum / cnt));
      }
      rows.push(row); day += days[mo];
    }
    this.card.tableBody.replaceChildren(table(['Month (mean)', '00:00 to 06:00', '06:00 to 12:00', '12:00 to 18:00', '18:00 to 24:00'], rows));
  }
}

// ---- stacked columns by month ----
export class MonthlyClasses {
  constructor(card, { height = 230 }) {
    Object.assign(this, { card, height });
    this.root = card.body;
    this.svg = s('svg', { class: 'chart', role: 'img' });
    this.legendEl = legend([...CLASSES].reverse().map((c) => ({ color: c.hex, label: c.name, box: true })));
    this.root.append(this.svg, this.legendEl);
    new ResizeObserver(() => this.draw()).observe(this.root);
  }
  update(values, active, names) { this.values = values; this.active = active; this.names = names; this.draw(); }
  draw() {
    if (!this.values) return;
    const w = this.root.clientWidth || 500, H = this.height, m = { l: 38, r: 8, t: 8, b: 24 };
    const svg = this.svg, t = tk();
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.setAttribute('width', w); svg.setAttribute('height', H);
    svg.setAttribute('aria-label', 'Share of hours in each thermal stress class, by month');
    const Y = (v) => m.t + (1 - v / 100) * (H - m.t - m.b);
    for (const v of [0, 25, 50, 75, 100]) {
      s('line', { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v), stroke: t.grid }, svg);
      text(svg, m.l - 6, Y(v) + 3.5, `${v}%`, { fill: t.muted, 'font-size': 10.5, 'text-anchor': 'end', class: 'num' });
    }
    const slot = (w - m.l - m.r) / 12, bw = Math.min(24, slot - 8);
    for (let mo = 0; mo < 12; mo++) {
      const x = m.l + slot * mo + (slot - bw) / 2;
      const on = this.active[mo];
      const g = s('g', { opacity: on ? 1 : 0.3, tabindex: 0 }, svg);
      let acc = 0, topClass = -1;
      for (let c = 0; c < 7; c++) if (this.values[mo * 7 + c] > 0.05) topClass = c;
      for (let c = 0; c < 7; c++) {
        const v = this.values[mo * 7 + c];
        if (v <= 0.05) continue;
        const y1 = Y(acc + v), y0 = Y(acc), gap = 2;
        const top = c === topClass, hgt = Math.max(0.5, y0 - y1 - (acc > 0 ? gap : 0));
        const yTop = y1, yBot = y0 - (acc > 0 ? gap : 0);
        if (top && hgt > 5) {
          s('path', { d: `M${x},${yBot} V${yTop + 4} Q${x},${yTop} ${x + 4},${yTop} H${x + bw - 4} Q${x + bw},${yTop} ${x + bw},${yTop + 4} V${yBot} Z`, fill: CLASSES[c].hex }, g);
        } else s('rect', { x, y: yTop, width: bw, height: Math.max(0.5, yBot - yTop), fill: CLASSES[c].hex }, g);
        acc += v;
      }
      text(svg, x + bw / 2, H - 7, this.names[mo], { fill: t.muted, 'font-size': 10.5, 'text-anchor': 'middle' });
      const hit = s('rect', { x: m.l + slot * mo, y: m.t, width: slot, height: H - m.t - m.b, fill: 'transparent' }, svg);
      const show = (e) => tip.show(e, `${this.names[mo]}${on ? '' : ' (outside the period)'}`, [...CLASSES].map((c, k) => ({ c, k })).reverse()
        .filter(({ k }) => this.values[mo * 7 + k] > 0.05).map(({ c, k }) => ({ color: c.hex, box: true, label: c.name, value: `${this.values[mo * 7 + k].toFixed(1)}%` })));
      hit.addEventListener('pointermove', show); hit.addEventListener('pointerleave', () => tip.hide());
      g.addEventListener('focus', () => { const r = g.getBoundingClientRect(); show({ clientX: r.right, clientY: r.top }); });
      g.addEventListener('blur', () => tip.hide());
    }
    s('line', { x1: m.l, x2: w - m.r, y1: Y(0), y2: Y(0), stroke: t.axis }, svg);
    this.fillTable();
  }
  fillTable() {
    this.card.tableBody.replaceChildren(table(['Month', ...CLASSES.map((c) => c.name)],
      Array.from({ length: 12 }, (_, mo) => [this.names[mo], ...CLASSES.map((_, c) => `${this.values[mo * 7 + c].toFixed(1)}%`)])));
  }
}

// ---- horizontal bars, one value per row ----
export class HBars {
  constructor(card, { onPick }) {
    Object.assign(this, { card, onPick });
    this.root = card.body;
    this.svg = s('svg', { class: 'chart', role: 'img' });
    this.root.append(this.svg);
    new ResizeObserver(() => this.draw()).observe(this.root);
  }
  // rows: [{ id, label, value, detail }], selected: id or null
  update(rows, { format, max, selected, title, columns, tableRows }) { Object.assign(this, { rows, format, max, selected, title, columns, tableRows }); this.draw(); }
  draw() {
    if (!this.rows) return;
    const w = this.root.clientWidth || 400, rowH = 30, m = { l: 92, r: 64, t: 4, b: 4 };
    const H = m.t + m.b + rowH * this.rows.length;
    const svg = this.svg, t = tk();
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`); svg.setAttribute('width', w); svg.setAttribute('height', H);
    svg.setAttribute('aria-label', this.title);
    const X = (v) => m.l + (v / this.max) * (w - m.l - m.r);
    s('line', { x1: m.l, x2: m.l, y1: m.t, y2: H - m.b, stroke: t.axis }, svg);
    this.rows.forEach((r, i) => {
      const y = m.t + i * rowH + (rowH - 20) / 2;
      const active = this.selected == null || this.selected === r.id;
      const colour = active ? t.series[SLOT.air] : t.axis;
      const len = Math.max(2, X(r.value) - m.l);
      s('path', { d: `M${m.l},${y} H${m.l + len - 4} Q${m.l + len},${y} ${m.l + len},${y + 4} V${y + 16} Q${m.l + len},${y + 20} ${m.l + len - 4},${y + 20} H${m.l} Z`, fill: colour }, svg);
      text(svg, m.l - 8, y + 14, r.label, { fill: this.selected === r.id ? t.ink : t.ink2, 'font-size': 12, 'text-anchor': 'end', 'font-weight': this.selected === r.id ? 650 : 400 });
      text(svg, m.l + len + 6, y + 14, this.format(r.value), { fill: t.ink, 'font-size': 12, class: 'num' });
      const hit = s('rect', { x: 0, y: m.t + i * rowH, width: w, height: rowH, fill: 'transparent', style: 'cursor: pointer', tabindex: 0, role: 'button', 'aria-label': `${r.label}, ${this.format(r.value)}` }, svg);
      hit.addEventListener('pointermove', (e) => tip.show(e, r.label, [{ color: t.series[SLOT.air], box: true, label: r.detail ?? 'Value', value: this.format(r.value) }]));
      hit.addEventListener('pointerleave', () => tip.hide());
      hit.addEventListener('click', () => this.onPick?.(r.id));
      hit.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onPick?.(r.id); } });
    });
    this.card.tableBody.replaceChildren(table(this.columns, this.tableRows));
  }
}
