// Reads a window of a public Sentinel-2 L2A true-colour COG (UTM 29N) by HTTP range requests, then resamples it onto a
// true-north-aligned local grid centred on the reference point (x = east, y = north, metres).
// Output: twin/downloads/sentinel2/window.json + ground_s2.png written to viewer/public/twin/.
// Usage: node fetch_sentinel.mjs URL [halfExtentMetres=800] [outPixels=2048]
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utmForward, fromEN } from './geo.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2];
const HALF = Number(process.argv[3] ?? 800), OUTPX = Number(process.argv[4] ?? 2048);
let bytesDownloaded = 0;
async function range(start, len) {
  const r = await fetch(url, { headers: { Range: `bytes=${start}-${start + len - 1}` } });
  if (r.status !== 206 && r.status !== 200) throw new Error(`HTTP ${r.status}`);
  const b = Buffer.from(await r.arrayBuffer());
  bytesDownloaded += b.length;
  return b;
}
// First IFD
let head = await range(0, 131072);
const le = head.toString('ascii', 0, 2) === 'II';
if (!le || head.readUInt16LE(2) !== 42) throw new Error('expected little-endian classic TIFF');
const ifdOff = head.readUInt32LE(4);
const getBuf = async (off, len) => (off + len <= head.length ? head.subarray(off, off + len) : range(off, len));
const nEntries = (await getBuf(ifdOff, 2)).readUInt16LE(0);
const ifd = await getBuf(ifdOff + 2, nEntries * 12);
const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
const tags = {};
for (let i = 0; i < nEntries; i++) {
  const o = i * 12, tag = ifd.readUInt16LE(o), type = ifd.readUInt16LE(o + 2), count = ifd.readUInt32LE(o + 4);
  const size = TYPE_SIZE[type] * count;
  const raw = size <= 4 ? ifd.subarray(o + 8, o + 8 + size) : await getBuf(ifd.readUInt32LE(o + 8), size);
  let vals = [];
  for (let k = 0; k < count; k++) {
    if (type === 3) vals.push(raw.readUInt16LE(k * 2));
    else if (type === 4) vals.push(raw.readUInt32LE(k * 4));
    else if (type === 12) vals.push(raw.readDoubleLE(k * 8));
    else if (type === 1 || type === 7) vals.push(raw[k]);
    else if (type === 16) vals.push(Number(raw.readBigUInt64LE(k * 8)));
  }
  tags[tag] = type === 2 ? raw.toString('ascii') : vals;
}
const W = tags[256][0], H = tags[257][0], spp = tags[277][0], comp = tags[259][0], pred = tags[317]?.[0] ?? 1;
const tw = tags[322][0], th = tags[323][0], offs = tags[324], cnts = tags[325], planar = tags[284]?.[0] ?? 1;
const [sx, sy] = tags[33550], tie = tags[33922];
console.log({ W, H, spp, comp, pred, tw, th, planar, sx, sy, tie: tie.slice(0, 6), tiles: offs.length, bits: tags[258] });
if (planar !== 1 || ![8, 32946].includes(comp)) throw new Error('unsupported TIFF layout');
const x0 = tie[3], y0 = tie[4]; // UTM of the top-left corner of pixel (0, 0)

const ref = fromEN(0, 0);
const c = utmForward(ref.lat, ref.lon);
// UTM window needed (generous): the true-north square rotated by the convergence still fits inside a circle of radius HALF*1.5.
const R = HALF * 1.45;
const px0 = Math.max(0, Math.floor((c.e - R - x0) / sx) - 1), px1 = Math.min(W - 1, Math.ceil((c.e + R - x0) / sx) + 1);
const py0 = Math.max(0, Math.floor((y0 - (c.n + R)) / sy) - 1), py1 = Math.min(H - 1, Math.ceil((y0 - (c.n - R)) / sy) + 1);
const win = { w: px1 - px0 + 1, h: py1 - py0 + 1 };
const rgb = Buffer.alloc(win.w * win.h * 3);
const tilesX = Math.ceil(W / tw);
const tcache = new Map();
for (let ty = Math.floor(py0 / th); ty <= Math.floor(py1 / th); ty++) {
  for (let tx = Math.floor(px0 / tw); tx <= Math.floor(px1 / tw); tx++) {
    const idx = ty * tilesX + tx;
    const comp_ = await range(offs[idx], cnts[idx]);
    let data = zlib.inflateSync(comp_);
    if (pred === 2) for (let r = 0; r < th; r++) for (let x = 1; x < tw; x++) for (let s = 0; s < spp; s++) data[(r * tw + x) * spp + s] = (data[(r * tw + x) * spp + s] + data[(r * tw + x - 1) * spp + s]) & 255;
    for (let r = 0; r < th; r++) {
      const gy = ty * th + r; if (gy < py0 || gy > py1) continue;
      for (let x = 0; x < tw; x++) {
        const gx = tx * tw + x; if (gx < px0 || gx > px1) continue;
        const o = ((gy - py0) * win.w + (gx - px0)) * 3;
        rgb[o] = data[(r * tw + x) * spp]; rgb[o + 1] = data[(r * tw + x) * spp + 1]; rgb[o + 2] = data[(r * tw + x) * spp + 2];
      }
    }
  }
}
console.log('window', win, 'bytes downloaded', bytesDownloaded);
fs.writeFileSync(path.join(HERE, '../downloads/sentinel2/window.rgb'), rgb);
fs.writeFileSync(path.join(HERE, '../downloads/sentinel2/window.json'), JSON.stringify({ url, px0, py0, ...win, sx, sy, x0, y0, bytesDownloaded }));

// Resample (bicubic Catmull-Rom) onto the true-north grid. Output pixel (i, j): east = -HALF + (i + 0.5) * 2 HALF / OUTPX, north = HALF - (j + 0.5) * ...
const out = Buffer.alloc(OUTPX * OUTPX * 3);
const cr = (t) => { const a = Math.abs(t); return a < 1 ? 1.5 * a ** 3 - 2.5 * a * a + 1 : a < 2 ? -0.5 * a ** 3 + 2.5 * a * a - 4 * a + 2 : 0; };
const sample = (fx, fy, ch) => {
  const ix = Math.floor(fx), iy = Math.floor(fy); let acc = 0, ws = 0;
  for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) {
    const gx = Math.min(win.w - 1, Math.max(0, ix + i)), gy = Math.min(win.h - 1, Math.max(0, iy + j));
    const w = cr(fx - (ix + i)) * cr(fy - (iy + j)); acc += w * rgb[(gy * win.w + gx) * 3 + ch]; ws += w;
  }
  return Math.max(0, Math.min(255, Math.round(acc / ws)));
};
const step = (2 * HALF) / OUTPX;
for (let j = 0; j < OUTPX; j++) {
  for (let i = 0; i < OUTPX; i++) {
    const e = -HALF + (i + 0.5) * step, n = HALF - (j + 0.5) * step;
    const ll = fromEN(e, n);
    const u = utmForward(ll.lat, ll.lon);
    const fx = (u.e - x0) / sx - 0.5 - px0, fy = (y0 - u.n) / sy - 0.5 - py0;
    const o = (j * OUTPX + i) * 3;
    for (let ch = 0; ch < 3; ch++) out[o + ch] = sample(fx, fy, ch);
  }
}
// Minimal PNG writer.
function crc32(buf) { let c, crc = ~0; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 255; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return ~crc >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
function png(w, h, rgbBuf) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgbBuf.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
fs.mkdirSync(path.join(HERE, '../../viewer/public/twin'), { recursive: true });
fs.writeFileSync(path.join(HERE, '../../viewer/public/twin/ground_s2.png'), png(OUTPX, OUTPX, out));
console.log('wrote ground_s2.png', OUTPX, 'px,', (2 * HALF) / OUTPX, 'm per output pixel; source pixel 10 m');
