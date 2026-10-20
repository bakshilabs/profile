// Colour tokens, ramps and class definitions shared by the charts and the 3D view.
// Categorical hues follow a fixed order and each entity keeps its colour in every chart.

export const TOKENS = {
  light: {
    page: '#f9f9f7', surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
    grid: '#e1e0d9', axis: '#c3c2b7', neutral: '#f0efec', border: 'rgba(11,11,11,0.10)',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
    blue: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
    red: '#e34948',
    scene: { ground: 0xe6e5df, structure: 0xb8bdc4, ghost: 0x7b8794, ghostOpacity: 0.16, empty: 0xdcdbd4 },
  },
  dark: {
    page: '#0d0d0d', surface: '#1a1a19', ink: '#f0efec', ink2: '#c3c2b7', muted: '#898781',
    grid: '#2c2c2a', axis: '#383835', neutral: '#383835', border: 'rgba(255,255,255,0.10)',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
    blue: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
    red: '#e66767',
    scene: { ground: 0x232322, structure: 0x3a3f46, ghost: 0x9fb2c6, ghostOpacity: 0.1, empty: 0x2a2a28 },
  },
};

// Entities keep one slot each: air temperature, seats, pitch, direct sun, diffuse sky.
export const SLOT = { air: 0, seats: 1, pitch: 2, dni: 3, dhi: 4 };

// ---- OKLab helpers ----
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
export const rgbToHex = (rgb) => `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')}`;
function rgbToOklab([r, g, b]) {
  const lr = toLin(r), lg = toLin(g), lb = toLin(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((c) => toSrgb(Math.min(1, Math.max(0, c))));
}
export const mixHex = (a, b, t) => {
  const A = rgbToOklab(hexToRgb(a)), B = rgbToOklab(hexToRgb(b));
  return rgbToHex(oklabToRgb(A.map((v, i) => v + (B[i] - v) * t)));
};

// ---- ramps ----
// Single-hue sequential ramp, low to high. On light surfaces low is pale and high is dark. On dark surfaces
// low sits near the surface and high is bright.
export function sequential(name, theme) {
  const tk = TOKENS[theme];
  if (name === 'blue') {
    const light = [tk.blue[0], tk.blue[2], tk.blue[4], tk.blue[6], tk.blue[8], tk.blue[10], tk.blue[12]];
    return theme === 'light' ? light : [...light].reverse().map((c, i) => (i === 0 ? mixHex(tk.surface, c, 0.55) : c));
  }
  // orange from the second categorical slot: steps toward white and black
  const base = '#eb6834';
  const lightSteps = [mixHex(base, '#ffffff', 0.86), mixHex(base, '#ffffff', 0.7), mixHex(base, '#ffffff', 0.5), mixHex(base, '#ffffff', 0.22), base, mixHex(base, '#000000', 0.28), mixHex(base, '#000000', 0.5)];
  return theme === 'light' ? lightSteps : [...lightSteps].reverse().map((c, i) => (i === 0 ? mixHex(tk.surface, c, 0.5) : c));
}

// Diverging blue to red with a neutral midpoint, equal steps each side.
export function diverging(theme) {
  const tk = TOKENS[theme];
  const blue = theme === 'light' ? '#2a78d6' : '#3987e5';
  const out = [];
  for (let i = 0; i <= 4; i++) out.push(mixHex(blue, tk.neutral, i / 4));
  for (let i = 1; i <= 4; i++) out.push(mixHex(tk.neutral, tk.red, i / 4));
  return out;
}

export function sample(ramp, t) {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.min(Math.floor(x), ramp.length - 2);
  return mixHex(ramp[i], ramp[i + 1], x - i);
}

// ---- UTCI ----
// Field-convention colours for thermal stress: blues for cold, green for no stress, yellow to orange for heat.
export const UTCI_ANCHORS = [
  [-30, '#3b2a8f'], [-15, '#2f55d6'], [0, '#3b93e6'], [9, '#7fd6e8'], [12, '#5fcf9f'],
  [20, '#4cc38a'], [26, '#c5d94d'], [32, '#f2d14b'], [38, '#ee8a2e'],
];
export function utciHex(u) {
  const a = UTCI_ANCHORS;
  if (u <= a[0][0]) return a[0][1];
  for (let i = 0; i < a.length - 1; i++) if (u <= a[i + 1][0]) return mixHex(a[i][1], a[i + 1][1], (u - a[i][0]) / (a[i + 1][0] - a[i][0]));
  return a[a.length - 1][1];
}
// Seven display classes made from the ten UTCI stress categories. The colour comes from a value inside the class.
export const CLASSES = [
  { name: 'Very strong cold', range: 'below −27 °C', at: -33 },
  { name: 'Strong cold', range: '−27 to −13 °C', at: -20 },
  { name: 'Moderate cold', range: '−13 to 0 °C', at: -6.5 },
  { name: 'Slight cold', range: '0 to 9 °C', at: 4.5 },
  { name: 'No thermal stress', range: '9 to 26 °C', at: 17.5 },
  { name: 'Moderate heat', range: '26 to 32 °C', at: 29 },
  { name: 'Strong heat or worse', range: 'above 32 °C', at: 36 },
].map((c) => ({ ...c, hex: utciHex(c.at) }));
export const CLASS_EDGES = [-27, -13, 0, 9, 26, 32];
export const classOf = (u) => { let c = 0; while (c < CLASS_EDGES.length && u >= CLASS_EDGES[c]) c++; return c; };
// Byte to class lookup. A byte stores (UTCI + 50) x 2.
export const CLASS_OF_BYTE = Uint8Array.from({ length: 256 }, (_, b) => classOf(b / 2 - 50));
