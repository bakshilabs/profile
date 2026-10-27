/* Bakshi Labs: agent workflow slides, 3D edition.
   The same AGENT_DECK content as agents.js, staged in a dark ink world.
   Cards stay as HTML glass panels so text is sharp and accessible. Three.js
   draws the backdrop (aurora shader and depth particles) and the connectors
   (glowing tubes with travelling light pulses). The WebGL camera is set up
   so that the plane z = 0 matches the CSS pixels of the window, and the CSS
   perspective on the world layer matches the camera, so the tubes stay
   attached to the cards while the whole scene tilts with the pointer.
   When WebGL or the CDN is unavailable, SVG connectors and a CSS gradient
   take over and every interaction still works. */

const DECK = window.AGENT_DECK;

const KINDS = {
  agent: { label: "Agent", cls: "agent" },
  build: { label: "Build agent", cls: "agent" },
  sub: { label: "Subagent", cls: "agent" },
  maybe: { label: "Possible agent", cls: "maybe" },
  code: { label: "Code step", cls: "code" },
  tool: { label: "Connector", cls: "code" },
  data: { label: "Data", cls: "data" },
  doc: { label: "Document", cls: "data" },
  ui: { label: "Interface", cls: "ui" },
  person: { label: "Person", cls: "ui" },
  ext: { label: "External source", cls: "ext" },
  out: { label: "Output", cls: "out" }
};
const LEGEND_ORDER = ["agent", "build", "sub", "maybe", "code", "tool", "data", "doc", "ui", "person", "ext", "out"];
const SVGNS = "http://www.w3.org/2000/svg";
const STAGE_W = 1600;
const STAGE_H = 900;
const CANVAS_LEFT = 64;
const CANVAS_TOP = 226;
const PERSPECTIVE = 2000; // CSS perspective and WebGL camera distance, in px
const TILT_X = 1.4; // degrees
const TILT_Y = 2.2;

const touch = window.matchMedia("(hover: none)");
const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduce = reduceQuery.matches;

const root = document.documentElement;
const body = document.body;
const deckEl = document.querySelector("[data-deck]");
const world = document.querySelector("[data-world]");
const frame = document.querySelector("[data-frame]");
const stage = document.querySelector("[data-stage]");
const dotsEl = document.querySelector("[data-dots]");
const countEl = document.querySelector("[data-count]");
const progress = document.querySelector("[data-progress]");
const bar = document.querySelector("[data-bar]");
const nav = document.querySelector("[data-nav]");
const modal = document.querySelector("[data-modal]");
const listEl = document.querySelector("[data-list]");
const altLink = document.querySelector("[data-alt]");

const slides = [];
let current = -1;
let drawTimer = 0;
let leaveTimer = 0;
let listMode = false;
let GL = null;
const L = { W: 0, H: 0, s: 1, left: 0, top: 0 };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function svg(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function pad(n) {
  return (n < 10 ? "0" : "") + n;
}
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* ---------- Connector routing (ported from agents.js) ---------- */

function rect(slide, n) {
  return { x: n.x, y: n.y, w: n.w || slide.cw, h: n.h || slide.ch };
}
function sidePoint(r, side, f) {
  if (side === "l") return [r.x, r.y + r.h * f];
  if (side === "r") return [r.x + r.w, r.y + r.h * f];
  if (side === "t") return [r.x + r.w * f, r.y];
  return [r.x + r.w * f, r.y + r.h];
}
function autoSides(a, b) {
  if (b.x >= a.x + a.w) return ["r", "l"];
  if (a.x >= b.x + b.w) return ["l", "r"];
  if (b.y >= a.y + a.h) return ["b", "t"];
  return ["t", "b"];
}
function isH(s) {
  return s === "l" || s === "r";
}
function route(a, b, o) {
  const sides = autoSides(a, b);
  const fs = o.fs || sides[0];
  const ts = o.ts || sides[1];
  const S = sidePoint(a, fs, o.fo != null ? o.fo : 0.5);
  const E = sidePoint(b, ts, o.tf != null ? o.tf : 0.5);
  let pts;
  if (o.fo == null && o.tf == null) {
    if (!isH(fs) && !isH(ts)) {
      if (S[0] > b.x + 14 && S[0] < b.x + b.w - 14) E[0] = S[0];
      else if (E[0] > a.x + 14 && E[0] < a.x + a.w - 14) S[0] = E[0];
    } else if (isH(fs) && isH(ts)) {
      if (S[1] > b.y + 14 && S[1] < b.y + b.h - 14) E[1] = S[1];
      else if (E[1] > a.y + 14 && E[1] < a.y + a.h - 14) S[1] = E[1];
    }
  }
  if (isH(fs) && isH(ts)) {
    const mx = o.mid != null ? o.mid : (S[0] + E[0]) / 2;
    pts = [S, [mx, S[1]], [mx, E[1]], E];
  } else if (!isH(fs) && !isH(ts)) {
    const my = o.mid != null ? o.mid : (S[1] + E[1]) / 2;
    pts = [S, [S[0], my], [E[0], my], E];
  } else if (isH(fs)) {
    pts = [S, [E[0], S[1]], E];
  } else {
    pts = [S, [S[0], E[1]], E];
  }
  return clean(pts);
}
function clean(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = out[out.length - 1];
    if (Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5) continue;
    out.push(p);
  }
  const res = [out[0]];
  for (let j = 1; j < out.length - 1; j++) {
    const a = res[res.length - 1], b = out[j], c = out[j + 1];
    const colinear = (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5);
    if (!colinear) res.push(b);
  }
  res.push(out[out.length - 1]);
  return res;
}
function cornerRadius(l1, l2) {
  return Math.min(12, l1 / 2, l2 / 2);
}
function pathD(p) {
  let d = "M" + p[0][0] + " " + p[0][1];
  for (let i = 1; i < p.length - 1; i++) {
    const x0 = p[i - 1][0], y0 = p[i - 1][1], x1 = p[i][0], y1 = p[i][1], x2 = p[i + 1][0], y2 = p[i + 1][1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const r = cornerRadius(l1, l2);
    const ax = x1 + ((x0 - x1) / l1) * r, ay = y1 + ((y0 - y1) / l1) * r;
    const bx = x1 + ((x2 - x1) / l2) * r, by = y1 + ((y2 - y1) / l2) * r;
    d += " L" + ax + " " + ay + " Q" + x1 + " " + y1 + " " + bx + " " + by;
  }
  const last = p[p.length - 1];
  return d + " L" + last[0] + " " + last[1];
}
/* The same rounded path as pathD, as a dense polyline for the WebGL tubes. */
function densify(p) {
  const out = [p[0].slice()];
  for (let i = 1; i < p.length - 1; i++) {
    const x0 = p[i - 1][0], y0 = p[i - 1][1], x1 = p[i][0], y1 = p[i][1], x2 = p[i + 1][0], y2 = p[i + 1][1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const r = cornerRadius(l1, l2);
    const ax = x1 + ((x0 - x1) / l1) * r, ay = y1 + ((y0 - y1) / l1) * r;
    const bx = x1 + ((x2 - x1) / l2) * r, by = y1 + ((y2 - y1) / l2) * r;
    out.push([ax, ay]);
    for (let k = 1; k <= 8; k++) {
      const t = k / 8, u = 1 - t;
      out.push([u * u * ax + 2 * u * t * x1 + t * t * bx, u * u * ay + 2 * u * t * y1 + t * t * by]);
    }
  }
  out.push(p[p.length - 1].slice());
  return out;
}
function labelPoint(p) {
  let best = 0, at = [p[0][0], p[0][1]];
  for (let i = 1; i < p.length; i++) {
    const len = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (len > best) {
      best = len;
      at = [(p[i][0] + p[i - 1][0]) / 2, (p[i][1] + p[i - 1][1]) / 2];
    }
  }
  return at;
}
function pathLength(p) {
  let t = 0;
  for (let i = 1; i < p.length; i++) t += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return t;
}

/* ---------- Count-up numbers ---------- */

function countSpan(text) {
  // Numbers count up visually; screen readers get the final value once.
  const wrap = el("span", "x-num");
  const m = /^([\d,]+(?:\.\d+)?)(.*)$/.exec(text);
  if (!m) {
    wrap.textContent = text;
    return wrap;
  }
  const vis = el("span", null, text);
  vis.setAttribute("aria-hidden", "true");
  vis.dataset.countTo = m[1].replace(/,/g, "");
  vis.dataset.countFmt = m[1].indexOf(",") >= 0 ? "comma" : "";
  vis.dataset.countSuffix = m[2];
  wrap.appendChild(vis);
  wrap.appendChild(el("span", "sr-only", text));
  return wrap;
}
function runCountUps(scope) {
  scope.querySelectorAll("[data-count-to]").forEach(function (n, k) {
    const to = parseFloat(n.dataset.countTo);
    const fmt = function (v) {
      const r = Math.round(v);
      return (n.dataset.countFmt ? r.toLocaleString("en-GB") : String(r)) + n.dataset.countSuffix;
    };
    if (reduce || !to) {
      n.textContent = fmt(to);
      return;
    }
    const t0 = performance.now() + 260 + k * 90;
    const dur = 1300;
    n.textContent = fmt(0);
    const step = function (now) {
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      n.textContent = fmt(to * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Slide builders ---------- */

function buildCover() {
  const c = DECK.cover;
  const s = el("section", "x-slide x-slide--cover");
  s.setAttribute("aria-roledescription", "slide");
  s.setAttribute("aria-label", "1 of " + (DECK.slides.length + 1) + ": " + c.title);

  const left = el("div", "x-cover__copy");
  left.appendChild(el("p", "x-kicker x-rise", c.kicker));
  const ct = el("h1", "x-cover__title x-rise");
  const words = c.title.split(" ");
  ct.appendChild(document.createTextNode(words.slice(0, -1).join(" ") + " "));
  ct.appendChild(el("em", null, words[words.length - 1]));
  left.appendChild(ct);
  left.appendChild(el("p", "x-cover__lede x-rise", c.lede));
  const stats = el("div", "x-cover__stats x-rise");
  c.stats.forEach(function (st) {
    const d = el("div", "x-cover__stat");
    const b = el("b");
    b.appendChild(countSpan(st[0]));
    d.appendChild(b);
    d.appendChild(el("span", "x-cover__label", st[1]));
    stats.appendChild(d);
  });
  left.appendChild(stats);
  const hint = el("p", "x-cover__hint x-rise");
  hint.innerHTML = "<kbd>←</kbd> <kbd>→</kbd> to move between slides · <kbd>F</kbd> for full screen";
  left.appendChild(hint);
  s.appendChild(left);

  const tiles = el("div", "x-tiles");
  DECK.slides.forEach(function (sl, i) {
    const t = el("button", "x-tile" + (sl.featured ? " x-tile--featured" : ""));
    t.type = "button";
    t.dataset.light = "";
    t.style.setProperty("--i", i);
    t.appendChild(el("span", "x-tile__num", pad(i + 1)));
    const nm = el("span", "x-tile__name", sl.app);
    if (sl.featured) nm.appendChild(el("span", "x-tile__badge", "Featured"));
    t.appendChild(nm);
    t.appendChild(el("span", "x-tile__tag", sl.tag));
    const arrow = el("span", "x-tile__go");
    arrow.innerHTML = ARROW;
    t.appendChild(arrow);
    t.addEventListener("click", function () {
      go(i + 1);
    });
    tiles.appendChild(t);
  });
  s.appendChild(tiles);
  return s;
}

function buildHead(sl, s) {
  const head = el("header", "x-head");
  const hl = el("div", "x-head__l");
  if (sl.featured) {
    s.classList.add("x-slide--featured");
    const eyebrow = el("div", "x-eyebrow x-rise");
    eyebrow.appendChild(el("span", "x-badge", "Featured case study"));
    eyebrow.appendChild(el("span", "x-kicker", sl.kicker));
    hl.appendChild(eyebrow);
  } else {
    hl.appendChild(el("p", "x-kicker x-rise", sl.kicker));
  }
  hl.appendChild(el("h2", "x-title x-rise", sl.title));
  head.appendChild(hl);
  const hr = el("div", "x-head__r");
  hr.appendChild(el("p", "x-lede x-rise", sl.lede));
  if (sl.stats) {
    const st = el("dl", "x-stats x-rise");
    sl.stats.forEach(function (x) {
      const d = el("div");
      const dt = el("dt");
      dt.appendChild(countSpan(x[0]));
      d.appendChild(dt);
      d.appendChild(el("dd", null, x[1]));
      st.appendChild(d);
    });
    hr.appendChild(st);
  } else {
    hr.appendChild(el("p", "x-tag x-rise", sl.tag));
  }
  head.appendChild(hr);
  return head;
}

function buildSlide(sl, index) {
  const s = el("section", "x-slide");
  s.setAttribute("aria-roledescription", "slide");
  s.setAttribute("aria-label", index + 1 + " of " + (DECK.slides.length + 1) + ": " + sl.title);
  s.appendChild(el("div", "x-slide__grid"));
  s.appendChild(buildHead(sl, s));

  const top = sl.canvasTop || CANVAS_TOP;
  sl._top = top;
  const canvas = el("div", "x-canvas");
  canvas.style.top = top + "px";
  const wires = svg("svg", { class: "x-wires", viewBox: "0 0 1472 600", width: "1472", height: "600", "aria-hidden": "true" });
  canvas.appendChild(wires);

  const byId = {};
  (sl.groups || []).forEach(function (g) {
    if (g.id) byId[g.id] = { x: g.x, y: g.y, w: g.w, h: g.h, _isGroup: true };
    const gr = el("div", "x-group" + (g.bracket ? " x-group--bracket" : "") + (g.align ? " x-group--" + g.align : ""));
    gr.style.cssText = "left:" + g.x + "px;top:" + g.y + "px;width:" + g.w + "px;height:" + g.h + "px";
    gr.appendChild(el("span", "x-group__label", g.t));
    canvas.appendChild(gr);
  });
  (sl.dividers || []).forEach(function (dv) {
    const d = el("div", "x-divider");
    d.style.left = dv.x + "px";
    d.appendChild(el("span", "x-divider__a", dv.a));
    d.appendChild(el("span", "x-divider__b", dv.b));
    canvas.appendChild(d);
  });
  (sl.lanes || []).forEach(function (ln) {
    const l = el("span", "x-lane", ln.t);
    l.style.left = ln.x + "px";
    l.style.top = ln.y + "px";
    canvas.appendChild(l);
  });

  const kindsUsed = {};
  sl.nodes.forEach(function (n, i) {
    byId[n.id] = n;
    const r = rect(sl, n);
    (sl.groups || []).forEach(function (g) {
      if (g.id && r.x >= g.x && r.y >= g.y && r.x + r.w <= g.x + g.w && r.y + r.h <= g.y + g.h) n._group = g.id;
    });
    const kind = KINDS[n.k];
    kindsUsed[n.k] = true;
    const wide = r.w > 600;
    const b = el("button", "x-node x-node--" + kind.cls + " x-k-" + n.k + (wide ? " x-node--wide" : "") + (sl.small || n.tray ? " x-node--sm" : "") + (n.tray ? " x-node--tray" : ""));
    b.type = "button";
    b.dataset.node = n.id;
    b.dataset.light = "";
    if (n._group) b.dataset.group = n._group;
    // Cards rise in from depth in a gentle stagger, ordered left to right.
    const order = (r.x / 1472) * 0.42 + (r.y / 600) * 0.16;
    b.style.cssText = "left:" + r.x + "px;top:" + r.y + "px;width:" + r.w + "px;height:" + r.h + "px;--d:" + (0.16 + order).toFixed(3) + "s;--i:" + i;
    b.setAttribute("aria-label", n.n + ", " + kind.label + ". " + n.s + " Open details.");
    if (kind.cls === "agent") b.appendChild(el("span", "x-node__halo"));
    const front = el("span", "x-node__face x-node__front");
    const k = el("span", "x-node__kind");
    k.appendChild(el("i"));
    k.appendChild(document.createTextNode(kind.label));
    front.appendChild(k);
    front.appendChild(el("span", "x-node__name", n.n));
    front.appendChild(el("span", "x-node__short", n.s));
    const back = el("span", "x-node__face x-node__back");
    const bh = el("span", "x-node__hint");
    bh.appendChild(el("span", "x-node__hname", n.n));
    const arrow = el("span", "x-node__harrow");
    arrow.innerHTML = ARROW;
    bh.appendChild(arrow);
    back.appendChild(bh);
    back.appendChild(el("span", "x-node__btext", n.b));
    b.appendChild(front);
    b.appendChild(back);
    b.addEventListener("click", function () {
      // On touch screens the first tap flips the card and the second opens it.
      if (touch.matches && !b.classList.contains("is-flipped")) {
        canvas.querySelectorAll(".x-node.is-flipped").forEach(function (o) {
          o.classList.remove("is-flipped");
        });
        b.classList.add("is-flipped");
        focusNode(sl, canvas, n.id, true);
        return;
      }
      openModal(sl, n, b);
    });
    const on = function () {
      if (!touch.matches) focusNode(sl, canvas, n.id, true);
    };
    const off = function () {
      if (!touch.matches) focusNode(sl, canvas, n.id, false);
    };
    b.addEventListener("mouseenter", on);
    b.addEventListener("mouseleave", off);
    b.addEventListener("focus", on);
    b.addEventListener("blur", off);
    canvas.appendChild(b);
  });

  sl._wires = [];
  sl.edges.forEach(function (e, j) {
    const a = byId[e[0]], b = byId[e[1]], o = e[2] || {};
    const pts = route(rect(sl, a), rect(sl, b), o);
    const d = pathD(pts);
    const len = pathLength(pts);
    sl._wires.push({ a: e[0], b: e[1], o: o, pts: pts, len: len, j: j });
    const p = svg("path", { d: d, class: "x-wire" + (o.bi ? " x-wire--bi" : ""), pathLength: "1", "data-a": e[0], "data-b": e[1] });
    p.style.setProperty("--j", j);
    wires.appendChild(p);
    const dur = Math.max(1.6, len / 110);
    const trim = Math.min(0.3, 22 / len);
    if (!o.quiet && len >= 60) {
      addPulse(wires, d, dur, j, false, e, trim);
      if (o.bi && len >= 120) addPulse(wires, d, dur, j, true, e, trim);
    }
    if (o.l) {
      const at = labelPoint(pts);
      const lab = el("span", "x-wlabel", o.l);
      lab.style.cssText = "left:" + at[0] + "px;top:" + at[1] + "px;--j:" + j;
      lab.dataset.a = e[0];
      lab.dataset.b = e[1];
      canvas.appendChild(lab);
    }
  });
  s.appendChild(canvas);

  const foot = el("footer", "x-foot");
  const legend = el("ul", "x-legend");
  const byLook = {}, looks = [];
  LEGEND_ORDER.forEach(function (k) {
    if (!kindsUsed[k]) return;
    const cls = KINDS[k].cls;
    if (!byLook[cls]) {
      byLook[cls] = [];
      looks.push(cls);
    }
    byLook[cls].push(KINDS[k].label);
  });
  looks.forEach(function (cls) {
    const li = el("li", "x-legend__item x-legend__item--" + cls);
    li.appendChild(el("i"));
    li.appendChild(document.createTextNode(byLook[cls].join(" · ")));
    legend.appendChild(li);
  });
  foot.appendChild(legend);
  foot.appendChild(el("p", "x-help", touch.matches ? "Tap a card to flip it · Tap again for details" : "Hover to flip a card · Click for details"));
  s.dataset.edges = sl.edges.length;
  s.appendChild(foot);
  return s;
}

function addPulse(wires, d, dur, j, reverse, e, trim) {
  if (reduce) return;
  const c = svg("circle", { r: "4", class: "x-pulse", "data-a": e[0], "data-b": e[1] });
  const m = svg("animateMotion", {
    dur: dur.toFixed(2) + "s",
    repeatCount: "indefinite",
    path: d,
    begin: -((j * 0.53 + (reverse ? dur / 2 : 0)) % dur).toFixed(2) + "s"
  });
  const a = trim.toFixed(3), z = (1 - trim).toFixed(3);
  m.setAttribute("keyPoints", reverse ? z + ";" + a : a + ";" + z);
  m.setAttribute("keyTimes", "0;1");
  m.setAttribute("calcMode", "linear");
  c.appendChild(m);
  wires.appendChild(c);
}

/* Hovering a card brightens its connectors and the cards at their other ends. */
function focusNode(sl, canvas, id, on) {
  canvas.classList.toggle("is-focus", on);
  const linked = {};
  linked[id] = true;
  const card = canvas.querySelector('[data-node="' + id + '"]');
  const group = card && card.dataset.group;
  const isHot = function (a, b) {
    return !!(on && (a === id || b === id || (group && (a === group || b === group))));
  };
  const hot = [];
  sl._wires.forEach(function (w, j) {
    if (isHot(w.a, w.b)) {
      hot.push(j);
      linked[w.a] = true;
      linked[w.b] = true;
    }
  });
  canvas.querySelectorAll(".x-wire, .x-pulse, .x-wlabel").forEach(function (w) {
    const a = w.getAttribute("data-a"), b = w.getAttribute("data-b");
    w.classList.toggle("is-hot", isHot(a, b));
  });
  canvas.querySelectorAll(".x-node").forEach(function (n) {
    n.classList.toggle("is-linked", on && !!linked[n.dataset.node]);
  });
  if (GL) GL.focus(on ? hot : null);
}

/* ---------- Detail window ---------- */

let lastFocus = null;
const mKicker = modal.querySelector("[data-m-kicker]");
const mTitle = modal.querySelector("[data-m-title]");
const mBody = modal.querySelector("[data-m-body]");
const mFacts = modal.querySelector("[data-m-facts]");
const mLinks = modal.querySelector("[data-m-links]");
const mPanel = modal.querySelector(".x-modal__panel");

function openModal(sl, n, from) {
  const kind = KINDS[n.k];
  if (modal.hidden) lastFocus = from || document.activeElement;
  modal.className = "x-modal x-modal--" + kind.cls;
  mKicker.textContent = sl.app + " · " + kind.label;
  mTitle.textContent = n.n;
  mBody.textContent = "";
  (n.a || [n.b]).forEach(function (para) {
    mBody.appendChild(el("p", null, para));
  });
  mFacts.textContent = "";
  (n.f || []).forEach(function (f) {
    const row = el("div", "x-facts__row");
    row.appendChild(el("dt", null, f[0]));
    // Code type only for values made of identifiers, never for plain sentences.
    const code = /[\/]|\.(ts|js|py|json|md|html|txt|yml)\b|\b(claude|gemini)-|--|_/.test(f[1]) && f[1].split(/,\s*/).every(function (part) {
      return !/\s/.test(part.trim());
    });
    row.appendChild(el("dd", code ? "is-code" : null, code ? f[1].replace(/--/g, "‑‑") : f[1]));
    mFacts.appendChild(row);
  });
  mFacts.hidden = !(n.f && n.f.length);

  mLinks.textContent = "";
  const seen = {};
  sl.edges.forEach(function (e) {
    const o = e[2] || {};
    let other = null, dir = "";
    if (e[0] === n.id) {
      other = e[1];
      dir = o.bi ? "↔" : "→";
    } else if (e[1] === n.id) {
      other = e[0];
      dir = o.bi ? "↔" : "←";
    }
    if (!other || seen[other + dir]) return;
    seen[other + dir] = true;
    const on = sl.nodes.filter(function (x) {
      return x.id === other;
    })[0];
    if (!on) return;
    const li = el("li");
    const btn = el("button", "x-chip x-chip--" + KINDS[on.k].cls);
    btn.type = "button";
    btn.appendChild(el("span", "x-chip__dir", dir));
    btn.appendChild(document.createTextNode(on.n));
    if (o.l) btn.appendChild(el("span", "x-chip__via", o.l));
    btn.addEventListener("click", function () {
      openModal(sl, on, null);
    });
    li.appendChild(btn);
    mLinks.appendChild(li);
  });
  mLinks.parentElement.hidden = !mLinks.children.length;

  const wasHidden = modal.hidden;
  modal.hidden = false;
  if (wasHidden) {
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
  } else {
    modal.classList.add("is-open", "is-swap");
    setTimeout(function () {
      modal.classList.remove("is-swap");
    }, 20);
  }
  mPanel.scrollTop = 0;
  requestAnimationFrame(updateFade);
  modal.querySelector("[data-close-btn]").focus();
}
function updateFade() {
  mPanel.classList.toggle("has-more", mPanel.scrollHeight - mPanel.scrollTop - mPanel.clientHeight > 4);
}
mPanel.addEventListener("scroll", updateFade);

function closeModal() {
  if (modal.hidden) return;
  modal.classList.remove("is-open");
  setTimeout(function () {
    if (!modal.classList.contains("is-open")) modal.hidden = true;
  }, reduce ? 0 : 260);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
}
modal.addEventListener("click", function (e) {
  if (e.target.closest("[data-close]")) closeModal();
});
modal.addEventListener("keydown", function (e) {
  if (e.key !== "Tab") return;
  const f = modal.querySelectorAll("button, [href]");
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

/* ---------- Navigation ---------- */

function go(i, fromHash) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i === current) return;
  closeModal();
  const prev = current;
  slides.forEach(function (s, k) {
    s.classList.toggle("is-active", k === i);
    s.classList.remove("is-drawn", "is-leaving");
    s.setAttribute("aria-hidden", k === i ? "false" : "true");
    s.inert = k !== i;
    s.querySelectorAll(".x-node.is-flipped").forEach(function (o) {
      o.classList.remove("is-flipped");
    });
    const c = s.querySelector(".x-canvas");
    if (c && c.classList.contains("is-focus")) {
      c.classList.remove("is-focus");
      c.querySelectorAll(".is-hot, .is-linked").forEach(function (x) {
        x.classList.remove("is-hot", "is-linked");
      });
    }
  });
  // The slide you leave flies past the camera while the next one rises in.
  clearTimeout(leaveTimer);
  if (prev >= 0 && !reduce) {
    slides[prev].classList.add("is-leaving");
    leaveTimer = setTimeout(function () {
      slides[prev].classList.remove("is-leaving");
    }, 520);
  }
  current = i;
  clearTimeout(drawTimer);
  drawTimer = setTimeout(function () {
    slides[i].classList.add("is-drawn");
  }, reduce ? 0 : 1250);
  dotsEl.querySelectorAll("button").forEach(function (d, k) {
    d.classList.toggle("is-current", k === i);
    if (k === i) d.setAttribute("aria-current", "step");
    else d.removeAttribute("aria-current");
  });
  countEl.textContent = pad(i + 1) + " / " + pad(slides.length);
  progress.style.transform = "scaleX(" + (i + 1) / slides.length + ")";
  document.querySelector("[data-prev]").disabled = i === 0;
  document.querySelector("[data-next]").disabled = i === slides.length - 1;
  buildList(i);
  showTip(i);
  if (!listMode) runCountUps(slides[i]);
  if (GL) GL.show(listMode ? -1 : i, prev < 0);
  if (prev >= 0) kickDolly();
  const hash = i === 0 ? "" : "#" + DECK.slides[i - 1].id;
  if (!fromHash && location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  updateAlt();
}

function updateAlt() {
  if (altLink) altLink.href = "agents.html" + location.hash;
}

/* Shrink each card's text a little, when needed, so it fits its face whole. */
function clampText() {
  stage.querySelectorAll(".x-node__short, .x-node__btext").forEach(function (t) {
    const face = t.parentElement;
    const cs = getComputedStyle(face);
    t.style.fontSize = "";
    t.style.webkitLineClamp = "unset";
    const base = parseFloat(getComputedStyle(t).fontSize);
    const limit = face.clientHeight - parseFloat(cs.paddingBottom) - t.offsetTop;
    let size = base;
    while (t.scrollHeight > limit + 1 && size > 13) {
      size -= 0.5;
      t.style.fontSize = size + "px";
    }
    t.toggleAttribute("data-clamped", t.scrollHeight > limit + 1);
    if (t.scrollHeight > limit + 1) {
      const lh = parseFloat(getComputedStyle(t).lineHeight) || 18;
      t.style.webkitLineClamp = String(Math.max(1, Math.floor(limit / lh)));
    }
  });
  // Cards of one size on a slide share one text size, so none looks out of place.
  slides.forEach(function (sl) {
    [".x-node:not(.x-node--tray):not(.x-node--wide) .x-node__short", ".x-node--tray .x-node__short", ".x-node:not(.x-node--tray) .x-node__btext", ".x-node--tray .x-node__btext"].forEach(function (sel) {
      const els = sl.querySelectorAll(sel);
      let min = Infinity;
      els.forEach(function (t) {
        min = Math.min(min, parseFloat(getComputedStyle(t).fontSize));
      });
      if (min < Infinity) els.forEach(function (t) {
        t.style.fontSize = min + "px";
      });
    });
  });
}

/* A one-time tip on the first tool slide you open. */
const tipEl = document.querySelector("[data-tip]");
let tipShown = false;
function showTip(i) {
  if (!tipEl || tipShown || i === 0 || listMode) return;
  tipShown = true;
  tipEl.textContent = touch.matches ? "Tap a card to flip it, and tap again for details." : "Hover over a card to flip it, and click it for details.";
  tipEl.hidden = false;
  requestAnimationFrame(function () {
    tipEl.classList.add("is-on");
  });
  const hide = function () {
    tipEl.classList.remove("is-on");
    setTimeout(function () {
      tipEl.hidden = true;
    }, 300);
  };
  setTimeout(hide, 5200);
  stage.addEventListener("pointerover", function once(e) {
    if (e.target.closest(".x-node")) {
      stage.removeEventListener("pointerover", once);
      hide();
    }
  });
}

/* Narrow and upright phone screens get each slide as a stacked list of glass cards. */
function buildList(i) {
  listEl.textContent = "";
  const sl = DECK.slides[i - 1];
  const head = el("header", "x-lhead");
  if (!sl) {
    const c = DECK.cover;
    head.appendChild(el("p", "x-kicker", c.kicker));
    const t = el("h1", "x-lhead__title");
    const words = c.title.split(" ");
    t.appendChild(document.createTextNode(words.slice(0, -1).join(" ") + " "));
    t.appendChild(el("em", null, words[words.length - 1]));
    head.appendChild(t);
    head.appendChild(el("p", "x-lhead__lede", c.lede));
    const st = el("dl", "x-lstats");
    c.stats.forEach(function (x) {
      const d = el("div");
      const dt = el("dt");
      dt.appendChild(countSpan(x[0]));
      d.appendChild(dt);
      d.appendChild(el("dd", null, x[1]));
      st.appendChild(d);
    });
    head.appendChild(st);
    listEl.appendChild(head);
    const ul = el("ul", "x-litems");
    ul.setAttribute("aria-label", "Tools");
    DECK.slides.forEach(function (t2, k) {
      const li = el("li");
      const btn = el("button", "x-litem" + (t2.featured ? " x-litem--agent" : ""));
      btn.type = "button";
      btn.dataset.light = "";
      btn.appendChild(el("span", "x-litem__kind", pad(k + 1) + (t2.featured ? " · Featured" : "")));
      btn.appendChild(el("span", "x-litem__name", t2.app));
      btn.appendChild(el("span", "x-litem__text", t2.tag));
      btn.addEventListener("click", function () {
        go(k + 1);
        window.scrollTo(0, 0);
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    listEl.appendChild(ul);
  } else {
    head.appendChild(el("p", "x-kicker", sl.kicker));
    head.appendChild(el("h2", "x-lhead__title", sl.title));
    head.appendChild(el("p", "x-lhead__lede", sl.lede));
    if (sl.stats) {
      const st = el("dl", "x-lstats x-lstats--four");
      sl.stats.forEach(function (x) {
        const d = el("div");
        const dt = el("dt");
        dt.appendChild(countSpan(x[0]));
        d.appendChild(dt);
        d.appendChild(el("dd", null, x[1]));
        st.appendChild(d);
      });
      head.appendChild(st);
    } else {
      head.appendChild(el("p", "x-tag", sl.tag));
    }
    listEl.appendChild(head);
    const ul = el("ul", "x-litems");
    ul.setAttribute("aria-label", "Cards on this slide");
    sl.nodes.forEach(function (n) {
      const kind = KINDS[n.k];
      const li = el("li");
      const btn = el("button", "x-litem x-litem--" + kind.cls);
      btn.type = "button";
      btn.dataset.light = "";
      const kk = el("span", "x-litem__kind");
      kk.appendChild(el("i"));
      kk.appendChild(document.createTextNode(kind.label));
      btn.appendChild(kk);
      btn.appendChild(el("span", "x-litem__name", n.n));
      btn.appendChild(el("span", "x-litem__text", n.s));
      btn.addEventListener("click", function () {
        openModal(sl, n, btn);
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    listEl.appendChild(ul);
  }
  if (listMode) runCountUps(listEl);
}

/* ---------- Layout ---------- */

function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  const wasList = listMode;
  listMode = W < 760 || (H > W && W < 900);
  deckEl.classList.toggle("is-list", listMode);
  body.classList.toggle("is-list", listMode);
  listEl.hidden = !listMode;
  world.hidden = listMode;
  const full = body.classList.contains("is-full");
  const navH = full || getComputedStyle(nav).display === "none" ? 0 : nav.offsetHeight;
  const barH = bar.offsetHeight || 52;
  const short = H < 560;
  const gutter = W < 1100 ? 10 : 24;
  const top = navH + (short ? 4 : 10);
  const availW = W - gutter * 2;
  const availH = H - top - barH - (short ? 12 : 26);
  const s = Math.max(0.1, Math.min(availW / STAGE_W, availH / STAGE_H));
  L.W = W;
  L.H = H;
  L.s = s;
  L.left = Math.round((W - STAGE_W * s) / 2);
  L.top = Math.round(top + Math.max(0, (availH - STAGE_H * s) / 2));
  frame.style.left = L.left + "px";
  frame.style.top = L.top + "px";
  frame.style.width = STAGE_W * s + "px";
  frame.style.height = STAGE_H * s + "px";
  stage.style.transform = "scale(" + s + ")";
  root.style.setProperty("--nav-real", navH + "px");
  // Footer help text hides itself when the legend needs the room.
  requestAnimationFrame(function () {
    stage.querySelectorAll(".x-foot").forEach(function (f) {
      const lg = f.querySelector(".x-legend"), hp = f.querySelector(".x-help");
      hp.hidden = false;
      hp.hidden = lg.scrollWidth + hp.scrollWidth + 32 > f.clientWidth;
    });
  });
  if (GL) {
    GL.layout(L);
    if (wasList !== listMode && current >= 0) GL.show(listMode ? -1 : current, true);
  }
  if (wasList !== listMode && current >= 0) {
    if (listMode) runCountUps(listEl);
    else runCountUps(slides[current]);
  }
  invalidate();
}

function fromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (/^\d+$/.test(id)) return Math.max(0, Math.min(DECK.slides.length, parseInt(id, 10) - 1));
  for (let i = 0; i < DECK.slides.length; i++) if (DECK.slides[i].id === id) return i + 1;
  return 0;
}

/* ---------- Motion: tilt, dolly, render loop ---------- */

const tilt = { x: 0, y: 0, tx: 0, ty: 0, mx: 0, my: 0 };
let dolly = 0; // 0 at rest, 1 at the start of a slide change
let dollyT0 = -1;
let raf = 0;
let lastT = 0;
let lastTransform = "";

function kickDolly() {
  if (reduce) return;
  dollyT0 = performance.now();
  if (GL) GL.warp();
  invalidate();
}
function applyFrameTransform() {
  const tz = -dolly * 120;
  const rx = tilt.x, ry = tilt.y;
  let t = "none";
  if (Math.abs(rx) > 0.004 || Math.abs(ry) > 0.004 || Math.abs(tz) > 0.05) {
    t = "translateZ(" + tz.toFixed(2) + "px) rotateX(" + rx.toFixed(3) + "deg) rotateY(" + ry.toFixed(3) + "deg)";
  }
  if (t !== lastTransform) {
    frame.style.transform = t;
    lastTransform = t;
  }
  return { rx: rx, ry: ry, tz: tz };
}
function loop(now) {
  raf = 0;
  const dt = Math.min(0.1, lastT ? (now - lastT) / 1000 : 0.016);
  lastT = now;
  if (!reduce) {
    const k = 1 - Math.pow(0.0025, dt);
    tilt.x += (tilt.tx - tilt.x) * k;
    tilt.y += (tilt.ty - tilt.y) * k;
    if (dollyT0 >= 0) {
      const t = Math.min(1, (now - dollyT0) / 1100);
      // A quick push back, then a long ease forward into place.
      dolly = t < 0.18 ? t / 0.18 : Math.pow(1 - (t - 0.18) / 0.82, 3);
      if (t >= 1) {
        dolly = 0;
        dollyT0 = -1;
      }
    }
  }
  const f = applyFrameTransform();
  if (GL) GL.render(now, dt, f, tilt);
  schedule();
}
function schedule() {
  if (raf || document.hidden) return;
  if (reduce) return;
  raf = requestAnimationFrame(loop);
}
let oneShot = 0;
function invalidate() {
  if (!reduce) return schedule();
  if (oneShot) return;
  oneShot = requestAnimationFrame(function (now) {
    oneShot = 0;
    const f = applyFrameTransform();
    if (GL) GL.render(now, 0, f, tilt);
  });
}
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    lastT = 0;
  } else {
    invalidate();
  }
});
reduceQuery.addEventListener("change", function (e) {
  reduce = e.matches;
  body.classList.toggle("is-reduced", reduce);
  tilt.tx = tilt.ty = 0;
  if (reduce) {
    tilt.x = tilt.y = 0;
    dolly = 0;
  }
  if (GL) GL.setReduced(reduce);
  invalidate();
});

window.addEventListener("pointermove", function (e) {
  if (e.pointerType !== "mouse") return;
  const nx = e.clientX / window.innerWidth - 0.5;
  const ny = e.clientY / window.innerHeight - 0.5;
  tilt.mx = nx;
  tilt.my = ny;
  if (reduce || !modal.hidden || listMode) {
    tilt.tx = tilt.ty = 0;
  } else {
    tilt.tx = -ny * 2 * TILT_X;
    tilt.ty = nx * 2 * TILT_Y;
  }
}, { passive: true });
document.addEventListener("mouseleave", function () {
  tilt.tx = tilt.ty = 0;
});

/* A soft light follows the pointer across glass surfaces. */
document.addEventListener("pointermove", function (e) {
  const t = e.target.closest && e.target.closest("[data-light]");
  if (!t) return;
  const r = t.getBoundingClientRect();
  t.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
  t.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
}, { passive: true });

/* Controls lean toward the pointer a little. */
function magnetic(elm) {
  elm.addEventListener("pointermove", function (e) {
    if (reduce || e.pointerType !== "mouse") return;
    const r = elm.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const max = 6;
    const tx = Math.max(-max, Math.min(max, dx * 0.28)), ty = Math.max(-max, Math.min(max, dy * 0.28));
    elm.style.transform = "translate(" + tx.toFixed(1) + "px," + ty.toFixed(1) + "px)";
    elm.classList.add("is-mag");
  });
  elm.addEventListener("pointerleave", function () {
    elm.style.transform = "";
    elm.classList.remove("is-mag");
  });
}
document.querySelectorAll("[data-mag]").forEach(magnetic);

/* ---------- WebGL layer ---------- */

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}

async function initGL() {
  if (!webglAvailable()) return null;
  const timeout = new Promise(function (_, rej) {
    setTimeout(function () {
      rej(new Error("Three.js took too long to load"));
    }, 12000);
  });
  const load = Promise.all([
    import("three"),
    import("three/addons/postprocessing/EffectComposer.js"),
    import("three/addons/postprocessing/RenderPass.js"),
    import("three/addons/postprocessing/UnrealBloomPass.js"),
    import("three/addons/postprocessing/OutputPass.js")
  ]);
  const mods = await Promise.race([load, timeout]);
  return makeGL(mods[0], mods[1].EffectComposer, mods[2].RenderPass, mods[3].UnrealBloomPass, mods[4].OutputPass);
}

const AURORA_FS = `
precision highp float;
uniform float uTime;
uniform vec2 uRes;
uniform vec2 uMouse;
uniform float uWarp;
uniform vec3 cInk;
uniform vec3 cDeep;
uniform vec3 cTeal;
uniform vec3 cCyan;
uniform vec3 cMint;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.035 + uWarp * 0.25;
  vec2 q = vec2(fbm(p * 1.3 + vec2(t, -t * 0.6)), fbm(p * 1.3 + vec2(-t * 0.8, t) + 4.7));
  float n = fbm(p * 1.05 + q * 1.7 + vec2(t * 0.5, -t * 0.3));

  // Deep ink base with a faint lift towards the upper right.
  vec3 col = mix(cInk, cDeep, smoothstep(-0.9, 0.9, p.y * 0.8 + p.x * 0.35 + (n - 0.5) * 0.5));

  // Two slow aurora curtains: cyan into mint, and a deeper teal one below.
  float w1 = p.y - 0.30 - 0.16 * sin(p.x * 1.7 + t * 2.6) - (n - 0.5) * 0.55;
  float b1 = exp(-w1 * w1 * 14.0);
  float w2 = p.y + 0.36 - 0.12 * sin(p.x * 1.25 - t * 2.0 + 1.3) - (q.x - 0.5) * 0.6;
  float b2 = exp(-w2 * w2 * 11.0);
  vec3 aur = mix(cCyan, cMint, smoothstep(-0.7, 0.8, p.x + (q.y - 0.5) * 1.2));
  float streak = 0.55 + 0.45 * fbm(vec2(p.x * 5.0 + t * 3.0, p.y * 1.2));
  col += aur * b1 * streak * (0.08 + 0.2 * n) * (1.0 + uWarp * 0.6);
  col += mix(cTeal, cCyan, 0.35) * b2 * (0.05 + 0.08 * q.y) * (1.0 + uWarp * 0.4);

  // Keep the middle, where the cards sit, a touch deeper.
  col *= 1.0 - 0.32 * exp(-dot(p * vec2(0.9, 1.4), p * vec2(0.9, 1.4)) * 2.2);

  // A soft light that follows the pointer.
  col += cCyan * 0.022 * exp(-dot(p - uMouse, p - uMouse) * 5.0);

  // Vignette towards the corners.
  float v = smoothstep(1.35, 0.2, length(p * vec2(0.85, 1.05)));
  col *= mix(0.45, 1.0, v);

  // Dither so the dark gradient never bands.
  col += (hash(gl_FragCoord.xy + fract(uTime * 7.0)) - 0.5) * 0.0035;
  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const TUBE_VS = `
varying vec3 vN;
varying float vU;
void main() {
  vN = normalize(normalMatrix * normal);
  vU = uv.x;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const TUBE_FS = `
uniform vec3 uA;
uniform vec3 uB;
uniform float uGlow;
uniform float uDraw;
uniform float uHot;
uniform float uHalo;
uniform float uTime;
varying vec3 vN;
varying float vU;
void main() {
  if (vU > uDraw) discard;
  float rim = clamp(abs(vN.z), 0.0, 1.0);
  vec3 c = mix(uA, uB, vU);
  // A faint shimmer travels along each tube.
  float sh = 0.85 + 0.15 * sin(vU * 40.0 - uTime * 2.2);
  c = mix(c, vec3(1.0), uHot * 0.5 * rim);
  // The freshly drawn tip burns brighter for a moment.
  float tip = smoothstep(uDraw - 0.08, uDraw, vU) * step(uDraw, 0.999);
  if (uHalo > 0.5) {
    float a = pow(rim, 2.4) * (0.085 + 0.1 * uHot) * uGlow * sh;
    gl_FragColor = vec4(c, a + tip * 0.3);
  } else {
    float a = (0.32 + 0.6 * pow(rim, 1.6)) * uGlow * sh;
    gl_FragColor = vec4(c * (1.0 + tip * 2.0), a);
  }
}`;
const POINT_VS = `
attribute float aSize;
attribute float aAlpha;
uniform float uScale;
uniform float uPR;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale * uPR * (${PERSPECTIVE.toFixed(1)} / -mv.z);
  vA = aAlpha;
}`;
const POINT_FS = `
uniform vec3 uColor;
varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = smoothstep(0.5, 0.0, r);
  a *= a;
  float core = smoothstep(0.16, 0.0, r);
  vec3 c = mix(uColor, vec3(1.0), core * 0.8);
  float alpha = a * vA;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(c, alpha);
}`;
const DUST_VS = `
attribute float aSeed;
uniform float uTime;
uniform float uTravel;
uniform float uPR;
varying float vA;
varying float vTint;
void main() {
  vec3 p = position;
  p.z = mod(p.z + uTravel + 5200.0, 7000.0) - 5200.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float size = (0.9 + 2.2 * fract(aSeed * 7.31)) * (1500.0 / max(depth, 60.0));
  gl_PointSize = min(size, 34.0) * uPR;
  float tw = 0.55 + 0.45 * sin(uTime * (0.5 + fract(aSeed * 3.17)) * 1.7 + aSeed * 40.0);
  vA = tw * smoothstep(7200.0, 2600.0, depth) * smoothstep(120.0, 900.0, depth) * (0.35 + 0.65 * fract(aSeed * 11.7));
  vTint = fract(aSeed * 5.13);
}`;
const DUST_FS = `
uniform vec3 cA;
uniform vec3 cB;
varying float vA;
varying float vTint;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  float a = smoothstep(0.5, 0.05, r);
  vec3 c = mix(cA, cB, vTint);
  float alpha = a * a * vA * 0.55;
  if (alpha < 0.002) discard;
  gl_FragColor = vec4(c, alpha);
}`;

function makeGL(THREE, EffectComposer, RenderPass, UnrealBloomPass, OutputPass) {
  const canvas = document.querySelector("[data-gl]");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  let PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x050d12, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 40000);
  const C = function (h) {
    return new THREE.Color(h);
  };
  const col = { ink: C("#03090d"), deep: C("#0c1b24"), teal: C("#0e9c8e"), cyan: C("#59c7fc"), mint: C("#16ffc6"), soft: C("#8fdcd2") };

  /* Backdrop: a full-screen aurora drawn behind everything. */
  const bgMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
      uMouse: { value: new THREE.Vector2(0, 0) },
      uWarp: { value: 0 },
      cInk: { value: col.ink },
      cDeep: { value: col.deep },
      cTeal: { value: col.teal },
      cCyan: { value: col.cyan },
      cMint: { value: col.mint }
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
    fragmentShader: AURORA_FS,
    depthTest: false,
    depthWrite: false
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  /* Depth particles drifting slowly towards the camera. */
  const DUST = 1500;
  const dGeo = new THREE.BufferGeometry();
  const dPos = new Float32Array(DUST * 3);
  const dSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 6200;
    dPos[i * 3 + 1] = (Math.random() - 0.5) * 3600;
    dPos[i * 3 + 2] = Math.random() * 7000 - 5200;
    dSeed[i] = Math.random();
  }
  dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  dGeo.setAttribute("aSeed", new THREE.BufferAttribute(dSeed, 1));
  const dMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uTravel: { value: 0 }, uPR: { value: PR }, cA: { value: col.cyan }, cB: { value: col.mint } },
    vertexShader: DUST_VS,
    fragmentShader: DUST_FS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const dust = new THREE.Points(dGeo, dMat);
  dust.frustumCulled = false;
  const dustRig = new THREE.Group();
  dustRig.add(dust);
  scene.add(dustRig);

  /* The stage: pivot sits at the frame centre and tilts like the CSS frame. */
  const pivot = new THREE.Group();
  const stageG = new THREE.Group();
  pivot.add(stageG);
  scene.add(pivot);

  class Poly extends THREE.Curve {
    constructor(pts) {
      super();
      this.p = pts;
      this.c = [0];
      for (let i = 1; i < pts.length; i++) this.c.push(this.c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      this.L = this.c[this.c.length - 1];
    }
    at(d) {
      const c = this.c;
      d = Math.max(0, Math.min(this.L, d));
      let lo = 0, hi = c.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (c[mid] <= d) lo = mid;
        else hi = mid;
      }
      const seg = c[hi] - c[lo] || 1;
      const f = (d - c[lo]) / seg;
      const a = this.p[lo], b = this.p[hi];
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    }
    getPoint(t, out) {
      out = out || new THREE.Vector3();
      const q = this.at(t * this.L);
      return out.set(q[0], -q[1], 0);
    }
    getPointAt(u, out) {
      return this.getPoint(u, out);
    }
    getUtoTmapping(u) {
      return u;
    }
  }

  const TAIL = 7;
  const coneGeo = new THREE.ConeGeometry(4.6, 12, 18, 1);
  coneGeo.translate(0, -6, 0); // tip at the origin, pointing along +y

  const slideGroups = [null];
  DECK.slides.forEach(function (sl) {
    const g = new THREE.Group();
    g.visible = false;
    const ox = CANVAS_LEFT, oy = sl._top;
    const wires = [];
    const pulses = [];
    sl._wires.forEach(function (w, j) {
      const pts = densify(w.pts).map(function (p) {
        return [p[0] + ox, p[1] + oy];
      });
      const curve = new Poly(pts);
      const U = { uGlow: { value: 0 }, uDraw: { value: 0 }, uHot: { value: 0 }, uTime: { value: 0 }, uA: { value: col.cyan }, uB: { value: col.mint } };
      const segs = Math.max(8, Math.ceil(curve.L / 5));
      const core = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segs, 1.05, 8, false),
        new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, { uHalo: { value: 0 } }), vertexShader: TUBE_VS, fragmentShader: TUBE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      const halo = new THREE.Mesh(
        new THREE.TubeGeometry(curve, segs, 5.5, 8, false),
        new THREE.ShaderMaterial({ uniforms: Object.assign({}, U, { uHalo: { value: 1 } }), vertexShader: TUBE_VS, fragmentShader: TUBE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      core.renderOrder = 2;
      halo.renderOrder = 1;
      g.add(halo);
      g.add(core);
      // Arrowheads at the end, and at the start of two-way connectors.
      const cones = [];
      const addCone = function (tip, prev, color) {
        const m = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        m.position.set(tip[0], -tip[1], 0.5);
        m.rotation.z = Math.atan2(-(tip[1] - prev[1]), tip[0] - prev[0]) - Math.PI / 2;
        m.renderOrder = 3;
        g.add(m);
        cones.push(m);
      };
      addCone(pts[pts.length - 1], pts[pts.length - 2], col.mint);
      if (w.o.bi) addCone(pts[0], pts[1], col.cyan);
      const rec = { U: U, cones: cones, glow: 1, target: 1, start: 0, dur: 700, curve: curve };
      wires.push(rec);
      const dur = Math.max(1.6, w.len / 110);
      const trim = Math.min(0.3, 22 / w.len);
      if (!w.o.quiet && w.len >= 60) {
        pulses.push({ w: rec, dur: dur, trim: trim, rev: false, phase: ((j * 0.53) % dur) / dur });
        if (w.o.bi && w.len >= 120) pulses.push({ w: rec, dur: dur, trim: trim, rev: true, phase: ((j * 0.53 + dur / 2) % dur) / dur });
      }
    });
    const n = pulses.length * TAIL;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(Math.max(1, n) * 3);
    const pSize = new Float32Array(Math.max(1, n));
    const pAlpha = new Float32Array(Math.max(1, n));
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
    pGeo.setAttribute("aAlpha", new THREE.BufferAttribute(pAlpha, 1));
    const pMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 1 }, uPR: { value: PR }, uColor: { value: col.mint } },
      vertexShader: POINT_VS,
      fragmentShader: POINT_FS,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(pGeo, pMat);
    points.frustumCulled = false;
    points.renderOrder = 4;
    g.add(points);
    stageG.add(g);
    slideGroups.push({ g: g, wires: wires, pulses: pulses, geo: pGeo, mat: pMat, fade: 0, fadeTarget: 0 });
  });

  /* Post-processing: bloom for the glowing tubes, with a cheaper path if the device struggles. */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.75, 0.42, 0.34);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  let useBloom = true;
  const samples = [];

  let active = -1;
  let focusSet = null;
  let reduced = reduce;
  let warpT0 = -1;
  let travel = 0;
  let scale = 1;

  function layoutGL(l) {
    renderer.setSize(l.W, l.H, false);
    composer.setPixelRatio(PR);
    composer.setSize(l.W, l.H);
    camera.aspect = l.W / l.H;
    camera.fov = (2 * Math.atan(l.H / 2 / PERSPECTIVE) * 180) / Math.PI;
    camera.position.set(l.W / 2, -l.H / 2, PERSPECTIVE);
    camera.lookAt(l.W / 2, -l.H / 2, 0);
    camera.updateProjectionMatrix();
    pivot.position.set(l.left + (STAGE_W / 2) * l.s, -(l.top + (STAGE_H / 2) * l.s), 0);
    stageG.position.set((-STAGE_W / 2) * l.s, (STAGE_H / 2) * l.s, 0);
    stageG.scale.setScalar(l.s);
    scale = l.s;
    dustRig.position.set(l.W / 2, -l.H / 2, 0);
    bgMat.uniforms.uRes.value.set(l.W, l.H);
    slideGroups.forEach(function (sg) {
      if (sg) sg.mat.uniforms.uScale.value = l.s;
    });
  }

  function show(i, instant) {
    const now = performance.now();
    slideGroups.forEach(function (sg, k) {
      if (!sg) return;
      if (k === i) {
        sg.g.visible = true;
        sg.fade = 1;
        sg.fadeTarget = 1;
        sg.wires.forEach(function (w, j) {
          w.start = now + (reduced || instant ? (reduced ? -1e6 : 380) : 560) + Math.min(j * 45, 520);
          w.dur = 720;
          w.target = 1;
          w.glow = 1;
          w.U.uHot.value = 0;
        });
      } else {
        sg.fadeTarget = 0;
        if (reduced || instant) {
          sg.fade = 0;
          sg.g.visible = false;
        }
      }
    });
    active = i;
    focusSet = null;
  }

  function focus(hot) {
    focusSet = hot ? new Set(hot) : null;
    const sg = slideGroups[active];
    if (!sg) return;
    sg.wires.forEach(function (w, j) {
      w.target = !focusSet ? 1 : focusSet.has(j) ? 1.9 : 0.12;
      w.U.uHot.value = focusSet && focusSet.has(j) ? 1 : 0;
      if (reduced) w.glow = w.target;
    });
  }

  function ease(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function render(now, dt, f, tl) {
    const time = reduced ? 12 : now / 1000;
    bgMat.uniforms.uTime.value = time;
    dMat.uniforms.uTime.value = time;
    let warp = 0;
    if (warpT0 >= 0 && !reduced) {
      const t = (now - warpT0) / 1300;
      if (t >= 1) warpT0 = -1;
      else warp = Math.sin(Math.PI * t) * (1 - t * 0.3);
    }
    bgMat.uniforms.uWarp.value = warp;
    if (!reduced) travel += dt * (14 + warp * 2600);
    dMat.uniforms.uTravel.value = travel;
    bgMat.uniforms.uMouse.value.set(tl.mx * (L.W / L.H), -tl.my);

    // Match the CSS frame: translateZ, then rotateX, then rotateY.
    pivot.position.z = f.tz;
    pivot.rotation.set((-f.rx * Math.PI) / 180, (f.ry * Math.PI) / 180, 0, "XYZ");
    // Particles drift with a deeper parallax than the stage.
    dustRig.rotation.set((-f.rx * Math.PI) / 180 * 2.2, (f.ry * Math.PI) / 180 * 2.2, 0, "XYZ");

    const k = reduced ? 1 : 1 - Math.pow(0.0008, dt);
    slideGroups.forEach(function (sg, idx) {
      if (!sg || !sg.g.visible) return;
      sg.fade += (sg.fadeTarget - sg.fade) * (reduced ? 1 : 1 - Math.pow(0.0004, dt));
      if (sg.fadeTarget === 0 && sg.fade < 0.01) {
        sg.g.visible = false;
        return;
      }
      sg.wires.forEach(function (w) {
        const p = reduced ? 1 : Math.max(0, Math.min(1, (now - w.start) / w.dur));
        w.U.uDraw.value = p >= 1 ? 1.001 : ease(p);
        w.glow += (w.target - w.glow) * k;
        w.U.uGlow.value = w.glow * sg.fade;
        w.U.uTime.value = time;
        const appear = Math.max(0, Math.min(1, (p - 0.9) / 0.1));
        w.cones.forEach(function (c) {
          c.material.opacity = Math.min(1, w.glow * sg.fade) * appear * 0.95;
          const sc = 0.6 + 0.4 * appear;
          c.scale.setScalar(sc);
        });
      });
      // Light pulses with short comet tails.
      const pos = sg.geo.attributes.position.array;
      const size = sg.geo.attributes.aSize.array;
      const alpha = sg.geo.attributes.aAlpha.array;
      sg.pulses.forEach(function (pu, pi) {
        const w = pu.w;
        const drawn = reduced ? 0 : Math.max(0, Math.min(1, (now - w.start - w.dur) / 400));
        const frac = (now / 1000 / pu.dur + pu.phase) % 1;
        const Lc = w.curve.L;
        const a0 = pu.trim * Lc, a1 = (1 - pu.trim) * Lc;
        const head = pu.rev ? a1 - frac * (a1 - a0) : a0 + frac * (a1 - a0);
        const edgeFade = Math.min(1, frac / 0.08, (1 - frac) / 0.08);
        const hotBoost = w.U.uHot.value ? 1.25 : 1;
        for (let t = 0; t < TAIL; t++) {
          const d = head + (pu.rev ? t : -t) * 4.2;
          const q = w.curve.at(d);
          const o = (pi * TAIL + t) * 3;
          pos[o] = q[0];
          pos[o + 1] = -q[1];
          pos[o + 2] = 1;
          const inside = d >= a0 - 0.5 && d <= a1 + 0.5 ? 1 : 0;
          size[pi * TAIL + t] = (t === 0 ? 20 : 13 - t * 1.4) * hotBoost;
          alpha[pi * TAIL + t] = inside * drawn * edgeFade * Math.min(1.4, w.glow * sg.fade) * (t === 0 ? 1 : 0.5 * (1 - t / TAIL));
        }
      });
      sg.geo.attributes.position.needsUpdate = true;
      sg.geo.attributes.aSize.needsUpdate = true;
      sg.geo.attributes.aAlpha.needsUpdate = true;
    });

    if (useBloom) composer.render(dt);
    else renderer.render(scene, camera);

    // If frames run slow early on, drop the bloom pass and the pixel ratio.
    if (!reduced && useBloom && dt > 0) {
      samples.push(dt);
      if (samples.length === 120) {
        const sorted = samples.slice().sort(function (a, b) {
          return a - b;
        });
        if (sorted[60] > 0.026) {
          useBloom = false;
          PR = 1;
          renderer.setPixelRatio(1);
          dMat.uniforms.uPR.value = 1;
          slideGroups.forEach(function (sg) {
            if (sg) sg.mat.uniforms.uPR.value = 1;
          });
          layoutGL(L);
          body.classList.add("is-lite");
        }
      }
    }
  }

  return {
    layout: layoutGL,
    show: show,
    focus: focus,
    render: render,
    warp: function () {
      if (!reduced) warpT0 = performance.now();
    },
    setReduced: function (r) {
      reduced = r;
      if (active >= 0) show(active, true);
    },
    info: function () {
      return { bloom: useBloom, pr: PR, active: active };
    }
  };
}

/* ---------- Build ---------- */

if (DECK) {
  body.classList.toggle("is-reduced", reduce);
  slides.push(buildCover());
  DECK.slides.forEach(function (sl, i) {
    slides.push(buildSlide(sl, i + 1));
  });
  slides.forEach(function (s) {
    stage.appendChild(s);
  });

  const names = ["Overview"].concat(DECK.slides.map(function (s) {
    return s.app;
  }));
  names.forEach(function (name, i) {
    const d = el("button", "x-dot");
    d.type = "button";
    d.setAttribute("aria-label", "Slide " + (i + 1) + ": " + name);
    d.dataset.name = name;
    d.addEventListener("click", function () {
      go(i);
    });
    dotsEl.appendChild(d);
  });

  document.querySelector("[data-prev]").addEventListener("click", function () {
    go(current - 1);
  });
  document.querySelector("[data-next]").addEventListener("click", function () {
    go(current + 1);
  });

  const fullBtn = document.querySelector("[data-full]");
  const toggleFull = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
  };
  if (!document.fullscreenEnabled) fullBtn.hidden = true;
  fullBtn.addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", function () {
    const on = !!document.fullscreenElement;
    body.classList.toggle("is-full", on);
    fullBtn.setAttribute("aria-pressed", on ? "true" : "false");
    layout();
  });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!modal.hidden) {
      if (e.key === "Escape") closeModal();
      return;
    }
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      go(current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(current - 1);
    } else if (e.key === "Home") {
      go(0);
    } else if (e.key === "End") {
      go(slides.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFull();
    } else if (/^[1-9]$/.test(e.key)) {
      go(parseInt(e.key, 10) - 1);
    }
  });

  stage.addEventListener("click", function (e) {
    if (!touch.matches || e.target.closest(".x-node")) return;
    const c = stage.querySelector(".x-slide.is-active .x-canvas");
    if (!c) return;
    c.querySelectorAll(".x-node.is-flipped").forEach(function (o) {
      o.classList.remove("is-flipped");
    });
    focusNode(DECK.slides[current - 1], c, "", false);
  });

  let sx = null, sy = null;
  frame.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    sx = e.clientX;
    sy = e.clientY;
  });
  frame.addEventListener("pointerup", function (e) {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(current + (dx < 0 ? 1 : -1));
  });

  window.addEventListener("resize", layout);
  window.addEventListener("hashchange", function () {
    go(fromHash(), true);
  });

  const toggle = document.querySelector("[data-nav-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  root.classList.add("js");
  layout();
  go(fromHash(), true);
  clampText();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      layout();
      clampText();
    });
  }

  initGL().then(function (gl) {
    if (!gl) throw new Error("WebGL is not available");
    GL = gl;
    GL.layout(L);
    GL.show(listMode ? -1 : current, true);
    body.classList.add("has-gl");
    invalidate();
  }).catch(function (err) {
    // The SVG connectors and the CSS gradient carry on without WebGL.
    body.classList.add("no-gl");
    if (window.console && console.info) console.info("3D layer unavailable, using the flat fallback:", err && err.message);
    invalidate();
  });
}
