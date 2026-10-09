/* Bakshi Labs: animated stories for the seven tools.
   Each scene builds its drawing once for a wide or a tall (phone) layout, then
   render(t) sets every element for time t. A scene can loop, pause off screen,
   or hold one still frame. Stories open on their finished frame, then replay. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var C = {
    panel: "#132a34",
    panel2: "#183441",
    line: "rgba(143,166,176,0.24)",
    mist: "#93a7b0",
    text: "#e6eef0",
    mint: "#16ffc6",
    teal: "#0e9c8e",
    soft: "#8fdcd2",
    sky: "#59c7fc",
    amber: "#e9b44c",
    red: "#e46b5d",
    grey: "#5d717a",
    ink: "#0c1b24",
  };

  /* Timing helpers */
  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }
  var E = {
    out: function (p) { return 1 - Math.pow(1 - p, 3); },
    inOut: function (p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; },
    lin: function (p) { return p; },
    back: function (p) { var c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
  };
  function P(t, a, b, e) {
    return (e || E.out)(clamp((t - a) / (b - a), 0, 1));
  }
  function lerp(a, b, p) {
    return a + (b - a) * p;
  }
  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmt(n) {
    return Math.round(n).toLocaleString("en-GB");
  }
  function quad(a, m, b, p) {
    return (1 - p) * (1 - p) * a + 2 * (1 - p) * p * m + p * p * b;
  }

  /* SVG helpers */
  function h(tag, attrs, parent) {
    var el = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function tx(parent, x, y, str, cls, extra) {
    var a = { x: x, y: y, class: cls };
    if (extra) for (var k in extra) a[k] = extra[k];
    var el = h("text", a, parent);
    el.textContent = str;
    return el;
  }
  function set(el, name, val) {
    var c = el.__c || (el.__c = {});
    if (c[name] !== val) {
      c[name] = val;
      el.setAttribute(name, val);
    }
  }
  function op(el, v) {
    set(el, "opacity", String(Math.round(clamp(v, 0, 1) * 1000) / 1000));
  }
  function text(el, s) {
    if (el.__t !== s) {
      el.__t = s;
      el.textContent = s;
    }
  }
  function move(el, x, y) {
    set(el, "transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")");
  }
  function svgStage(stage, w, hgt, id) {
    var s = h("svg", { viewBox: "0 0 " + w + " " + hgt, "aria-hidden": "true", focusable: "false" });
    var defs = h("defs", null, s);
    var pat = h("pattern", { id: "dots-" + id, width: 16, height: 16, patternUnits: "userSpaceOnUse" }, defs);
    h("circle", { cx: 1, cy: 1, r: 0.8, fill: "rgba(143,166,176,0.16)" }, pat);
    h("rect", { width: w, height: hgt, fill: "url(#dots-" + id + ")" }, s);
    stage.appendChild(s);
    return { svg: s, defs: defs };
  }
  function gradient(defs, id, stops) {
    var g = h("linearGradient", { id: id, x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    stops.forEach(function (s) {
      h("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? 1 : s[2] }, g);
    });
    return g;
  }
  function chip(parent, x, y, label, kind) {
    var w = label.length * 5.7 + 12;
    var g = h("g", null, parent);
    var fill = kind === "mint" ? "rgba(22,255,198,0.14)" : kind === "value" ? "rgba(230,238,240,0.12)" : "rgba(143,166,176,0.16)";
    h("rect", { x: x, y: y, width: w, height: 15, rx: 7.5, fill: fill }, g);
    tx(g, x + w / 2, y + 10.5, label, "s-chip", { "text-anchor": "middle", fill: kind === "mint" ? C.mint : C.text });
    return { g: g, w: w };
  }

  /* Canvas helper: logical size w x h, sharp on any screen */
  function canvasStage(stage, w, hgt) {
    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    stage.appendChild(c);
    var ctx = c.getContext("2d");
    var bg = document.createElement("canvas");
    var api = { ctx: ctx, w: w, h: hgt, scale: 1, redraw: null };
    stage.__canvasApi = api;
    function fit() {
      var r = stage.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      api.scale = c.width / w;
      bg.width = c.width;
      bg.height = c.height;
      var b = bg.getContext("2d");
      b.setTransform(api.scale, 0, 0, api.scale, 0, 0);
      b.fillStyle = "rgba(143,166,176,0.16)";
      for (var x = 1; x < w; x += 16) for (var y = 1; y < hgt; y += 16) b.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
      if (api.redraw) api.redraw();
    }
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(fit).observe(stage);
    api.begin = function () {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(bg, 0, 0);
      ctx.setTransform(api.scale, 0, 0, api.scale, 0, 0);
    };
    return api;
  }
  function font(size, family, weight) {
    var fam = family === "serif" ? '"Newsreader", Georgia, serif' : family === "mono" ? '"IBM Plex Mono", monospace' : '"Inter", system-ui, sans-serif';
    return (weight || 400) + " " + size + "px " + fam;
  }
  function spaced(ctx, s, x, y, track) {
    for (var i = 0; i < s.length; i++) {
      ctx.fillText(s[i], x, y);
      x += ctx.measureText(s[i]).width + track;
    }
    return x;
  }
  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  var SCENES = {};

  /* Strategic Project Discovery: scan, collect, score */
  SCENES["strategic-project-discovery"] = {
    dur: 10.6,
    still: 8.4,
    beats: [[0, 0], [3.0, 1], [4.8, 2]],
    size: { wide: [600, 375], tall: [340, 650] },
    init: function (stage, mode) {
      var tall = mode === "tall";
      var st = svgStage(stage, tall ? 340 : 600, tall ? 650 : 375, "spd" + mode);
      var svg = st.svg;
      gradient(st.defs, "beam-spd" + mode, [[0, C.mint, 0], [0.5, C.mint, 0.28], [1, C.mint, 0]]);
      var G = tall ? { gx: 40, gy: 44, hx: 40, hy: 28, sy: 328 } : { gx: 24, gy: 44, hx: 24, hy: 30, sy: 340 };
      var PNL = tall ? { x: 16, y: 344, w: 308, h: 296, cx: 28, cw: 284, ch: 46, pitch: 50, y0: 384 } : { x: 316, y: 20, w: 264, h: 335, cx: 328, cw: 240, ch: 52, pitch: 58, y0: 60 };
      tx(svg, G.hx, G.hy, "676 PROCUREMENT SOURCES", "s-mono");
      var status = tx(svg, G.hx, G.sy, "", "s-mono s-dim");
      var N = 26, pitch = 10, cell = 8;
      var r = rng(11), hits = [];
      while (hits.length < 5) {
        var k = Math.floor(r() * 676);
        if (hits.indexOf(k) < 0 && k % N > 2 && k % N < 23) hits.push(k);
      }
      var g = h("g", null, svg), sq = [];
      for (var i = 0; i < 676; i++) {
        var x = G.gx + (i % N) * pitch, y = G.gy + Math.floor(i / N) * pitch;
        sq.push({ el: h("rect", { x: x, y: y, width: cell, height: cell, rx: 1.6, fill: C.mist, opacity: 0.16 }, g), x: x + cell / 2, y: y + cell / 2, hit: hits.indexOf(i) >= 0 });
      }
      var gridW = N * pitch;
      var glow = h("rect", { x: 0, y: G.gy - 8, width: 44, height: gridW + 12, fill: "url(#beam-spd" + mode + ")" }, svg);
      var beam = h("rect", { x: 0, y: G.gy - 8, width: 1.5, height: gridW + 12, fill: C.mint }, svg);

      h("rect", { x: PNL.x, y: PNL.y, width: PNL.w, height: PNL.h, rx: 12, fill: C.panel, stroke: C.line }, svg);
      tx(svg, PNL.x + 16, PNL.y + 24, "RESULTS · SAMPLE DATA", "s-mono");
      var data = [
        ["Northern Arc Metro Extension", "MANCHESTER · £1.8BN", 92],
        ["Iberian High Speed Link", "VALENCIA · €640M", 78],
        ["Gulf Coast Light Rail", "DOHA · QAR 4.2BN", 88],
        ["Eastern Suburbs Metro", "SYDNEY · A$2.1BN", 81],
        ["Pacific Corridor Rail", "PORTLAND · US$380M", 64],
      ];
      var sorted = data.map(function (d, i) { return i; }).sort(function (a, b) { return data[b][2] - data[a][2]; });
      var skel = data.map(function (d, i) {
        var g = h("g", null, svg);
        h("rect", { x: PNL.cx, y: PNL.y0 + i * PNL.pitch, width: PNL.cw, height: PNL.ch, rx: 8, fill: "none", stroke: C.line, "stroke-dasharray": "3 4" }, g);
        h("rect", { x: PNL.cx + 48, y: PNL.y0 + i * PNL.pitch + PNL.ch / 2 - 8, width: PNL.cw * 0.5, height: 5, rx: 2.5, fill: "rgba(143,166,176,0.5)" }, g);
        h("rect", { x: PNL.cx + 48, y: PNL.y0 + i * PNL.pitch + PNL.ch / 2 + 6, width: PNL.cw * 0.3, height: 4, rx: 2, fill: "rgba(143,166,176,0.35)" }, g);
        return g;
      });
      var hitPts = hits.map(function (k) { return sq[k]; }).sort(function (a, b) { return a.x - b.x; });
      var mid = PNL.ch / 2;
      var cards = data.map(function (d, i) {
        var cg = h("g", { opacity: 0 }, svg);
        var bg = h("rect", { x: PNL.cx, y: 0, width: PNL.cw, height: PNL.ch, rx: 8, fill: C.panel2, stroke: C.line }, cg);
        var rx0 = PNL.cx + 24;
        h("circle", { cx: rx0, cy: mid, r: 14, fill: "none", stroke: "rgba(143,166,176,0.25)", "stroke-width": 3 }, cg);
        var arc = h("circle", { cx: rx0, cy: mid, r: 14, fill: "none", stroke: C.mint, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90 " + rx0 + " " + mid + ")", "stroke-dasharray": "0 88" }, cg);
        var num = tx(cg, rx0, mid + 4, "", "s-num-xs", { "text-anchor": "middle" });
        tx(cg, PNL.cx + 48, mid - 3, d[0], "s-ui");
        tx(cg, PNL.cx + 48, mid + 13, d[1], "s-mono s-dim");
        var tag = h("g", { opacity: 0 }, cg);
        h("rect", { x: PNL.cx + PNL.cw - 72, y: -7, width: 60, height: 15, rx: 7.5, fill: C.mint }, tag);
        tx(tag, PNL.cx + PNL.cw - 42, 3.5, "HIGH FIT", "s-chip s-ink", { "text-anchor": "middle" });
        var fly = h("circle", { r: 3.2, fill: C.mint, opacity: 0 }, svg);
        return { g: cg, bg: bg, arc: arc, num: num, tag: tag, fly: fly, score: d[2], slot: i, rank: sorted.indexOf(i), from: hitPts[i], rx: rx0 };
      });

      return function (t) {
        var fade = 1 - P(t, 9.6, 10.3, E.inOut);
        var sweep = P(t, 0.3, 2.8, E.inOut);
        var bx = lerp(G.gx - 6, G.gx + gridW + 4, sweep);
        var scanning = t > 0.3 && t < 2.95;
        set(beam, "x", bx.toFixed(1));
        set(glow, "x", (bx - 22).toFixed(1));
        op(beam, scanning ? 1 : 0);
        op(glow, scanning ? 1 : 0);
        var settle = 1 - P(t, 2.8, 3.3);
        for (var i = 0; i < sq.length; i++) {
          var s = sq[i], o = 0.16, fill = C.mist;
          if (t > 0.3 && bx > s.x) {
            var d = bx - s.x;
            o = 0.24 + 0.6 * Math.exp((-d * d) / 260) * settle;
            if (s.hit) { o = 1; fill = C.mint; }
          }
          set(s.el, "fill", fill);
          op(s.el, o * fade + (1 - fade) * 0.16);
        }
        text(status, t < 0.3 ? "READY TO SCAN" : t < 2.9 ? "SCANNING " + Math.round(676 * sweep) + " / 676" : "5 OPPORTUNITIES FOUND");
        cards.forEach(function (c, i) {
          var t0 = 3.0 + i * 0.24;
          var fp = P(t, t0, t0 + 0.7, E.inOut);
          var y = lerp(PNL.y0 + c.slot * PNL.pitch, PNL.y0 + c.rank * PNL.pitch, P(t, 6.5, 7.4, E.inOut));
          var x0 = c.from.x, y0 = c.from.y, x1 = c.rx, y1 = y + mid;
          var mx = tall ? x0 + 60 : (x0 + x1) / 2, my = tall ? (y0 + y1) / 2 : Math.min(y0, y1) - 40;
          set(c.fly, "cx", quad(x0, mx, x1, fp).toFixed(1));
          set(c.fly, "cy", quad(y0, my, y1, fp).toFixed(1));
          op(c.fly, t > t0 && fp < 1 ? 1 : 0);
          var appear = P(t, t0 + 0.55, t0 + 0.95);
          op(skel[c.slot], 0.5 * (1 - appear) * fade + 0.5 * (1 - fade));
          move(c.g, lerp(14, 0, appear), y);
          op(c.g, appear * fade);
          var ring = P(t, 4.8 + i * 0.14, 5.9 + i * 0.14, E.inOut);
          set(c.arc, "stroke-dasharray", ((88 * c.score) / 100) * ring + " 88");
          text(c.num, ring > 0 ? String(Math.round(c.score * ring)) : "");
          var top = c.rank === 0 ? P(t, 7.4, 7.8) : 0;
          set(c.bg, "stroke", top > 0.5 ? C.mint : C.line);
          op(c.tag, top);
        });
      };
    },
  };

  /* GrowthSignal: collect across update runs, tag, rank */
  SCENES.growthsignal = {
    dur: 11,
    still: 8.8,
    beats: [[0, 0], [3.9, 1], [6.9, 2]],
    size: { wide: [600, 375], tall: [340, 670] },
    init: function (stage, mode) {
      var tall = mode === "tall";
      var st = svgStage(stage, tall ? 340 : 600, tall ? 670 : 375, "gs" + mode);
      var svg = st.svg;
      var L = tall ? { hx: 20, hy: 28, sx: 24, sy: 54, sp: 27, dbx: 268, dby: 64, out: 186 } : { hx: 24, hy: 30, sx: 28, sy: 62, sp: 34, dbx: 250, dby: 92, out: 166 };
      var R = tall ? { x: 16, y: 300, w: 308, h: 360, rx: 28, rw: 284, y0: 340, pitch: 52 } : { x: 330, y: 20, w: 250, h: 335, rx: 342, rw: 226, y0: 58, pitch: 48 };
      tx(svg, L.hx, L.hy, "270+ PUBLIC SOURCES", "s-mono");
      var sources = ["UK PORTALS", "EU PORTALS", "US PORTALS", "DEVELOPMENT BANKS", "OCDS PUBLISHERS", "PERMITS", "SEC FILINGS", "INDUSTRY NEWS"];
      var srcEls = sources.map(function (s, i) {
        var y = L.sy + i * L.sp;
        var dot = h("circle", { cx: L.sx, cy: y - 3.5, r: 3, fill: C.soft, opacity: 0.4 }, svg);
        tx(svg, L.sx + 10, y, s, "s-mono s-dim");
        return { dot: dot, y: y - 3.5 };
      });
      var dbx = L.dbx, dby = L.dby;
      var db = h("g", null, svg);
      h("path", { d: "M" + (dbx - 34) + " " + dby + " v78 a34 10 0 0 0 68 0 v-78", fill: C.panel2, stroke: C.line }, db);
      var fillLevel = h("rect", { x: dbx - 33, y: dby + 88, width: 66, height: 0, fill: "rgba(22,255,198,0.12)" }, db);
      h("ellipse", { cx: dbx, cy: dby, rx: 34, ry: 10, fill: C.panel, stroke: C.line }, db);
      h("path", { d: "M" + (dbx - 34) + " " + (dby + 26) + " a34 10 0 0 0 68 0 M" + (dbx - 34) + " " + (dby + 52) + " a34 10 0 0 0 68 0", fill: "none", stroke: C.line }, db);
      var count = tx(svg, dbx, dby + 130, "0", "s-num", { "text-anchor": "middle" });
      tx(svg, dbx, dby + 147, "RECORDS", "s-mono s-dim", { "text-anchor": "middle" });
      var runs = [], runH = [10, 14, 17, 21, 24, 27, 29, 31];
      for (var k = 0; k < 8; k++) runs.push(h("rect", { x: dbx - 32 + k * 8.4, y: dby + 196, width: 6, height: 0, rx: 1.5, fill: C.soft }, svg));
      tx(svg, dbx, dby + 212, "UPDATE RUNS", "s-mono s-dim", { "text-anchor": "middle" });
      var claude = h("g", { opacity: 0 }, svg);
      h("rect", { x: dbx - 30, y: dby - 40, width: 60, height: 18, rx: 9, fill: "none", stroke: C.mint }, claude);
      tx(claude, dbx, dby - 27.5, "CLAUDE", "s-chip", { "text-anchor": "middle", fill: C.mint });

      var r = rng(5), parts = [];
      for (var i = 0; i < 46; i++) {
        var s = srcEls[Math.floor(r() * srcEls.length)];
        parts.push({ el: h("rect", { width: 7, height: 4, rx: 1.5, fill: C.soft, opacity: 0 }, svg), y0: s.y, t0: 0.3 + i * 0.07 + r() * 0.12 });
      }

      h("rect", { x: R.x, y: R.y, width: R.w, height: R.h, rx: 12, fill: C.panel, stroke: C.line }, svg);
      tx(svg, R.x + 16, R.y + 24, "SAMPLE RECORDS · RANKED", "s-mono");
      var rows = [
        ["Hospital extension, phase 2", "INSTITUTIONAL", "£95M", 63],
        ["Water treatment upgrade", "ENERGY", "€410M", 48],
        ["Office refurbishment", "COMMERCIAL", "£1.2BN", 92],
        ["Housing estate renewal", "RESIDENTIAL", "£240M", 77],
        ["Rail depot design-build", "INFRASTRUCTURE", "US$238M", 86],
        ["Distribution centre", "INDUSTRIAL", "€88M", 41],
      ];
      var order = rows.map(function (d, i) { return i; }).sort(function (a, b) { return rows[b][3] - rows[a][3]; });
      var skel = rows.map(function (d, i) {
        var g = h("g", null, svg);
        h("rect", { x: R.rx, y: R.y0 + i * R.pitch, width: R.rw, height: 42, rx: 7, fill: "none", stroke: C.line, "stroke-dasharray": "3 4" }, g);
        h("rect", { x: R.rx + 12, y: R.y0 + i * R.pitch + 11, width: R.rw * 0.55, height: 5, rx: 2.5, fill: "rgba(143,166,176,0.5)" }, g);
        h("rect", { x: R.rx + 12, y: R.y0 + i * R.pitch + 25, width: 60, height: 10, rx: 5, fill: "rgba(143,166,176,0.3)" }, g);
        return g;
      });
      var rowEls = rows.map(function (d, i) {
        var rg = h("g", { opacity: 0 }, svg);
        var bg = h("rect", { x: R.rx, y: 0, width: R.rw, height: 42, rx: 7, fill: C.panel2, stroke: C.line }, rg);
        tx(rg, R.rx + 12, 17, d[0], "s-ui s-ui-sm");
        var a = chip(rg, R.rx + 12, 23, d[1], "mint");
        var b = chip(rg, R.rx + 16 + a.w, 23, d[2], "value");
        op(a.g, 0);
        op(b.g, 0);
        var score = tx(rg, R.rx + R.rw - 12, 17, "", "s-num-xs", { "text-anchor": "end" });
        return { g: rg, bg: bg, chips: [a.g, b.g], score: score, val: d[3], slot: i, rank: order.indexOf(i) };
      });

      return function (t) {
        var fade = 1 - P(t, 10.1, 10.8, E.inOut);
        srcEls.forEach(function (s, i) {
          op(s.dot, 0.35 + 0.65 * Math.max(0, Math.sin((t * 4 + i) * 1.3)) * (t > 0.3 && t < 3.8 ? 1 : 0));
        });
        parts.forEach(function (p) {
          var q = P(t, p.t0, p.t0 + 0.9, E.inOut);
          var y1 = dby + 4;
          var x = quad(L.out, (L.out + dbx) / 2, dbx, q), y = quad(p.y0, Math.min(p.y0, y1) - 10, y1, q);
          set(p.el, "x", (x - 3.5).toFixed(1));
          set(p.el, "y", (y - 2).toFixed(1));
          op(p.el, t > p.t0 && q < 1 ? 0.9 : 0);
        });
        var c = P(t, 0.5, 3.9, E.inOut) * fade;
        text(count, fmt(57848 * c));
        set(fillLevel, "height", (78 * c).toFixed(1));
        set(fillLevel, "y", (dby + 88 - 78 * c).toFixed(1));
        runs.forEach(function (bar, k) {
          var hh = runH[k] * P(t, 0.5 + k * 0.42, 0.9 + k * 0.42) * fade;
          set(bar, "height", hh.toFixed(1));
          set(bar, "y", (dby + 196 - hh).toFixed(1));
        });
        op(claude, (t > 4.2 && t < 7 ? 0.6 + 0.4 * Math.sin(t * 6) : P(t, 3.9, 4.2) * (1 - P(t, 7, 7.4))) * fade);
        rowEls.forEach(function (row, i) {
          var t0 = 3.9 + i * 0.3;
          var a = P(t, t0, t0 + 0.5);
          op(skel[row.slot], 0.5 * (1 - a) * fade + 0.5 * (1 - fade));
          var y = lerp(R.y0 + row.slot * R.pitch, R.y0 + row.rank * R.pitch, P(t, 6.9, 7.8, E.inOut));
          move(row.g, lerp(-16, 0, a), y);
          op(row.g, a * fade);
          row.chips.forEach(function (cg, j) { op(cg, P(t, t0 + 0.4 + j * 0.2, t0 + 0.65 + j * 0.2)); });
          var sp = P(t, 6.7, 7.2);
          text(row.score, sp > 0 ? String(Math.round(row.val * sp)) : "");
          set(row.bg, "stroke", row.rank === 0 && t > 7.8 ? C.mint : C.line);
        });
      };
    },
  };

  /* Reference Buildings Explorer: rise, slice, read (canvas) */
  SCENES["reference-buildings-explorer"] = {
    dur: 11,
    still: 8.6,
    beats: [[0, 0], [3.6, 1], [6.6, 2]],
    size: { wide: [600, 375], tall: [340, 500] },
    init: function (stage, mode) {
      var tall = mode === "tall";
      var cv = canvasStage(stage, tall ? 340 : 600, tall ? 540 : 375);
      var ctx = cv.ctx;
      var N = 16;
      var G = tall ? { s: 9.4, ox: 170, oy: 238, maxH: 92, hx: 16, hy: 28 } : { s: 10.6, ox: 330, oy: 136, maxH: 104, hx: 24, hy: 30 };
      var CALL = tall ? { x: 16, y: 44, w: 308, h: 80 } : { x: 24, y: 58, w: 196, h: 92 };
      var LEG = tall ? { x: 16, y: 470, w: 180 } : { x: 24, y: 334, w: 150 };
      var r = rng(21), typeBase = [];
      for (var i = 0; i < N; i++) typeBase.push(0.32 + 0.6 * r());
      typeBase[2] = 0.78;
      var v = [];
      for (var a = 0; a < N; a++) {
        v.push([]);
        for (var b = 0; b < N; b++) {
          var climate = 0.82 + 0.5 * Math.pow((b - 5) / 10, 2);
          v[a].push(clamp(typeBase[a] * climate * (0.9 + 0.2 * r()), 0.12, 1));
        }
      }
      var SEL_I = 2, SEL_J = 10;
      v[SEL_I][SEL_J] = 0.86;
      var vir = [[68, 1, 84], [59, 82, 139], [33, 145, 140], [94, 201, 98], [253, 231, 37]];
      function color(x, k) {
        x = clamp(x, 0, 1) * (vir.length - 1);
        var i0 = Math.floor(x), i1 = Math.min(vir.length - 1, i0 + 1), f = x - i0;
        return vir[i0].map(function (cc, j) { return Math.round((cc + (vir[i1][j] - cc) * f) * k); });
      }
      function X(i, j) { return G.ox + (i - j) * G.s * 0.866; }
      function Y(i, j) { return G.oy + (i + j) * G.s * 0.5; }
      function poly(pts, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
      }
      function corners(i, j) {
        var i0 = i + 0.14, i1 = i + 0.86, j0 = j + 0.14, j1 = j + 0.86;
        return [[X(i0, j0), Y(i0, j0)], [X(i1, j0), Y(i1, j0)], [X(i1, j1), Y(i1, j1)], [X(i0, j1), Y(i0, j1)]];
      }
      function up(p, hh) { return [p[0], p[1] - hh]; }
      function bar(i, j, hh, val, alpha, ghost) {
        var c = corners(i, j), A = c[0], B = c[1], Cc = c[2], D = c[3];
        ctx.globalAlpha = alpha;
        if (ghost) {
          ctx.lineWidth = 0.6;
          poly([up(A, hh), up(B, hh), up(Cc, hh), up(D, hh)], null, "rgba(143,166,176,0.9)");
        } else {
          poly([D, Cc, up(Cc, hh), up(D, hh)], "rgb(" + color(val, 0.62) + ")");
          poly([B, Cc, up(Cc, hh), up(B, hh)], "rgb(" + color(val, 0.8) + ")");
          poly([up(A, hh), up(B, hh), up(Cc, hh), up(D, hh)], "rgb(" + color(val, 1) + ")");
        }
        ctx.globalAlpha = 1;
      }
      var cells = [];
      for (var ii = 0; ii < N; ii++) for (var jj = 0; jj < N; jj++) cells.push([ii, jj]);
      cells.sort(function (p, q) { return p[0] + p[1] - (q[0] + q[1]) || p[1] - q[1]; });
      function drawPlane(jp, a) {
        if (a <= 0) return;
        var H = G.maxH + 20;
        ctx.globalAlpha = a;
        ctx.lineWidth = 1;
        poly([[X(-0.4, jp), Y(-0.4, jp)], [X(N + 0.4, jp), Y(N + 0.4, jp)], [X(N + 0.4, jp), Y(N + 0.4, jp) - H], [X(-0.4, jp), Y(-0.4, jp) - H]], "rgba(22,255,198,0.07)", "rgba(22,255,198,0.7)");
        ctx.globalAlpha = 1;
      }

      return function (t) {
        cv.begin();
        var fade = 1 - P(t, 10.2, 10.8, E.inOut);
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = "rgba(143,166,176,0.18)";
        for (var k = 0; k <= N; k++) {
          ctx.beginPath(); ctx.moveTo(X(k, 0), Y(k, 0)); ctx.lineTo(X(k, N), Y(k, N)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X(0, k), Y(0, k)); ctx.lineTo(X(N, k), Y(N, k)); ctx.stroke();
        }
        ctx.fillStyle = C.mist;
        ctx.font = font(tall ? 10 : 9.5, "mono", 500);
        ctx.save(); ctx.translate(X(0, N) + 2, Y(0, N) + 26); ctx.rotate(Math.atan2(0.5, 0.866)); spaced(ctx, "16 BUILDING TYPES", 0, 0, 1.2); ctx.restore();
        ctx.save(); ctx.translate(X(N, N) + 24, Y(N, N) + 14); ctx.rotate(-Math.atan2(0.5, 0.866)); spaced(ctx, "16 CLIMATE ZONES", 0, 0, 1.2); ctx.restore();

        var plane = t < 3.6 ? -1 : lerp(0, SEL_J + 0.5, P(t, 3.6, 5.6, E.inOut));
        var slice = P(t, 5.4, 5.9);
        var pick = P(t, 6.6, 7.1);
        var planeA = P(t, 3.6, 3.9) * (1 - P(t, 6.6, 7.2)) * fade;
        var drawn = false;
        for (var c = 0; c < cells.length; c++) {
          var i = cells[c][0], j = cells[c][1];
          if (plane >= 0 && !drawn && j + 0.5 > plane) { drawPlane(plane, planeA); drawn = true; }
          var t0 = 0.2 + (i + j) * 0.045;
          var hh = v[i][j] * G.maxH * E.out(clamp((t - t0) / 0.9, 0, 1)) * (0.15 + 0.85 * fade);
          if (hh < 0.5) continue;
          var inRow = j === SEL_J, isSel = i === SEL_I && j === SEL_J;
          var ghost = inRow ? 0 : slice;
          if (pick > 0 && !isSel) {
            bar(i, j, hh, v[i][j], lerp(ghost > 0.5 ? 0.22 : 1, 0.2, pick) * fade + (1 - fade) * 0.2, ghost > 0.5 && pick < 0.5);
          } else if (ghost > 0.5) bar(i, j, hh, v[i][j], 0.22 * fade, true);
          else bar(i, j, hh, v[i][j], (1 - ghost * 0.7) * fade + (1 - fade) * 0.2, false);
          if (isSel && pick > 0) {
            var cs = corners(i, j);
            ctx.globalAlpha = pick * fade;
            ctx.lineWidth = 1.4;
            poly([up(cs[0], hh), up(cs[1], hh), up(cs[2], hh), cs[2], cs[3], up(cs[3], hh)], null, C.mint);
            ctx.globalAlpha = 1;
          }
        }
        if (plane >= 0 && !drawn) drawPlane(plane, planeA);

        ctx.fillStyle = C.soft;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "256 BUILDING AND CLIMATE MODELS", G.hx, G.hy, 1.1);
        ctx.globalAlpha = slice * (1 - pick) * fade;
        ctx.fillStyle = C.mint;
        spaced(ctx, "SECTION · CLIMATE 5A CHICAGO", G.hx, tall ? 144 : G.hy + 18, 1.1);
        ctx.globalAlpha = 1;

        var lg = ctx.createLinearGradient(LEG.x, 0, LEG.x + LEG.w, 0);
        vir.forEach(function (cc, k) { lg.addColorStop(k / (vir.length - 1), "rgb(" + cc + ")"); });
        ctx.globalAlpha = P(t, 1.2, 1.8) * fade;
        ctx.fillStyle = C.mist;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "SITE EUI · MJ/M²", LEG.x, LEG.y - 8, 1);
        ctx.fillStyle = lg;
        roundRect(ctx, LEG.x, LEG.y, LEG.w, 5, 2.5); ctx.fill();
        ctx.fillStyle = C.mist;
        spaced(ctx, "LOW", LEG.x, LEG.y + 18, 1);
        ctx.textAlign = "right";
        ctx.fillText("HIGH", LEG.x + LEG.w, LEG.y + 18);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;

        var call = P(t, 6.9, 7.5) * fade;
        if (call > 0) {
          var bx = X(SEL_I + 0.5, SEL_J + 0.5), by = Y(SEL_I + 0.5, SEL_J + 0.5) - v[SEL_I][SEL_J] * G.maxH;
          ctx.globalAlpha = call;
          ctx.strokeStyle = C.mint;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by - 4);
          if (tall) ctx.lineTo(bx, CALL.y + CALL.h);
          else { ctx.lineTo(bx, CALL.y + 62); ctx.lineTo(CALL.x + CALL.w, CALL.y + 62); }
          ctx.stroke();
          ctx.fillStyle = C.mint;
          ctx.beginPath(); ctx.arc(bx, by - 4, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(19,42,52,0.94)";
          ctx.strokeStyle = C.line;
          roundRect(ctx, CALL.x, CALL.y, CALL.w, CALL.h, 9); ctx.fill(); ctx.stroke();
          ctx.fillStyle = C.soft;
          ctx.font = font(10, "mono", 500);
          spaced(ctx, "LARGE OFFICE · 5A CHICAGO", CALL.x + 14, CALL.y + 22, 1);
          ctx.fillStyle = "#ffffff";
          ctx.font = font(34, "serif", 400);
          var val = String(Math.round(575 * P(t, 6.9, 7.6)));
          ctx.fillText(val, CALL.x + 14, CALL.y + (tall ? 58 : 60));
          var vw = ctx.measureText(val).width;
          ctx.fillStyle = C.mist;
          ctx.font = font(10, "mono", 500);
          if (tall) spaced(ctx, "MJ/M² SITE EUI", CALL.x + 26 + vw, CALL.y + 58, 1);
          else spaced(ctx, "MJ/M² SITE EUI", CALL.x + 14, CALL.y + 80, 1);
          ctx.globalAlpha = 1;
        }
      };
    },
  };

  /* MaterialScan: evidence, verdicts, open issues */
  SCENES.materialscan = {
    dur: 10.6,
    still: 8.6,
    beats: [[0, 0], [1.9, 1], [5.6, 2]],
    size: { wide: [600, 375], tall: [340, 690] },
    init: function (stage, mode) {
      var tall = mode === "tall";
      var st = svgStage(stage, tall ? 340 : 600, tall ? 690 : 375, "ms" + mode);
      var svg = st.svg;
      var Lg = h("g", tall ? { transform: "translate(-4 0) scale(0.92)" } : null, svg);
      var Rg = h("g", tall ? { transform: "translate(-238 330) scale(0.98)" } : null, svg);
      tx(Lg, 24, 30, "LAB AND WORKPLACE PALETTE", "s-mono");
      ["LBC", "WELL", "BRIEF"].forEach(function (c, i) {
        tx(Lg, 247 + i * 48, 58, c, "s-mono s-dim", { "text-anchor": "middle" });
      });
      var sections = ["Spandrels", "MEP enclosures", "Bird safety", "Blades", "Facade profiles", "Expressed frame", "Column cladding"];
      var V = [["a", "p", "g"], ["a", "p", "p"], ["p", "p", "g"], ["a", "g", "p"], ["p", "p", "p"], ["a", "p", "g"], ["p", "f", "p"]];
      var col = { p: C.teal, a: C.amber, g: C.grey, f: C.red };
      var scan = h("rect", { x: 18, y: 0, width: 352, height: 34, rx: 7, fill: "rgba(22,255,198,0.07)", stroke: "rgba(22,255,198,0.4)", opacity: 0 }, Lg);
      var rows = sections.map(function (name, i) {
        var y = 68 + i * 38;
        var rg = h("g", { opacity: 0 }, Lg);
        h("line", { x1: 24, x2: 370, y1: y + 36, y2: y + 36, stroke: "rgba(143,166,176,0.14)" }, rg);
        tx(rg, 24, y + 21, name, "s-ui");
        var ev = h("g", { opacity: 0 }, rg);
        var evx = 132;
        (i % 3 === 1 ? ["EPD", "DECLARE"] : i % 3 === 2 ? ["HPD", "DECLARE"] : ["EPD", "HPD"]).forEach(function (lbl) {
          var w = lbl.length * 5.7 + 10;
          h("rect", { x: evx, y: y + 10, width: w, height: 14, rx: 3, fill: "none", stroke: "rgba(143,220,210,0.5)" }, ev);
          tx(ev, evx + w / 2, y + 20.5, lbl, "s-chip", { "text-anchor": "middle", fill: C.soft });
          evx += w + 4;
        });
        var cells = V[i].map(function (code, c) {
          var cx = 228 + c * 48;
          var box = h("rect", { x: cx, y: y + 7, width: 38, height: 22, rx: 6, fill: "none", stroke: "rgba(143,166,176,0.3)" }, rg);
          var mark = h("g", { opacity: 0 }, rg);
          var mx = cx + 19, my = y + 18;
          if (code === "p") h("path", { d: "M" + (mx - 5) + " " + my + " l3.5 3.5 6.5-7", fill: "none", stroke: "#fff", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" }, mark);
          if (code === "a") h("path", { d: "M" + (mx - 5) + " " + my + " h10", stroke: "#1b1b1b", "stroke-width": 2, "stroke-linecap": "round" }, mark);
          if (code === "g") tx(mark, mx, my + 4, "?", "s-ui", { "text-anchor": "middle", fill: "#fff" });
          if (code === "f") h("path", { d: "M" + (mx - 4) + " " + (my - 4) + " l8 8 M" + (mx + 4) + " " + (my - 4) + " l-8 8", stroke: "#fff", "stroke-width": 1.8, "stroke-linecap": "round" }, mark);
          return { box: box, mark: mark, code: code };
        });
        return { g: rg, ev: ev, cells: cells, y: y };
      });
      var RW = tall ? 308 : 188;
      var RX = tall ? 260 : 392;
      h("rect", { x: RX, y: 20, width: RW, height: 335, rx: 12, fill: C.panel, stroke: C.line }, Rg);
      tx(Rg, RX + 16, 44, "VERDICTS", "s-mono");
      var totals = { p: 0, a: 0, g: 0, f: 0 };
      V.forEach(function (row) { row.forEach(function (c) { totals[c]++; }); });
      var segs = [], sx = RX + 16, barW = RW - 32;
      ["p", "a", "g", "f"].forEach(function (k) {
        var w = (totals[k] / 21) * barW;
        segs.push({ el: h("rect", { x: sx, y: 56, width: 0, height: 10, fill: col[k] }, Rg), w: w });
        sx += w;
      });
      var legend = h("g", { opacity: 0 }, Rg);
      [["p", "PASS"], ["a", "PARTIAL"], ["g", "GAP"], ["f", "FAIL"]].forEach(function (l, i) {
        var lx = RX + 16 + (tall ? i * 72 : (i % 2) * 80), ly = tall ? 86 : 86 + Math.floor(i / 2) * 18;
        h("rect", { x: lx, y: ly - 7, width: 8, height: 8, rx: 2, fill: col[l[0]] }, legend);
        tx(legend, lx + 14, ly, l[1] + " " + totals[l[0]], "s-chip", { fill: C.text });
      });
      var gy0 = 128;
      tx(Rg, RX + 16, gy0, "OPEN ISSUES · RANKED", "s-mono");
      var issueList = [["Column cladding", "FAIL · WELL V2", C.red], ["Spandrels", "GAP · CLIENT BRIEF", C.grey], ["Blades", "GAP · WELL V2", C.grey], ["Bird safety", "GAP · CLIENT BRIEF", C.grey], ["Expressed frame", "GAP · CLIENT BRIEF", C.grey]];
      var skelR = issueList.map(function (g, i) {
        return h("rect", { x: RX + 12, y: gy0 + 12 + i * 41, width: RW - 24, height: 35, rx: 7, fill: "none", stroke: C.line, "stroke-dasharray": "3 4" }, Rg);
      });
      var barTrack = h("rect", { x: RX + 16, y: 56, width: RW - 32, height: 10, fill: "rgba(143,166,176,0.18)" }, Rg);
      var gaps = issueList.map(function (g, i) {
        var gg = h("g", { opacity: 0 }, Rg);
        var y = gy0 + 12 + i * 41;
        h("rect", { x: RX + 12, y: y, width: RW - 24, height: 35, rx: 7, fill: C.panel2, stroke: C.line }, gg);
        h("rect", { x: RX + 12, y: y + 7, width: 3, height: 21, rx: 1.5, fill: g[2] }, gg);
        tx(gg, RX + 24, y + 15, "0" + (i + 1), "s-mono");
        tx(gg, RX + 48, y + 15, g[0], "s-ui s-ui-sm");
        tx(gg, RX + 48, y + 28, g[1], "s-chip", { fill: C.mist });
        return gg;
      });
      return function (t) {
        var fade = 1 - P(t, 9.8, 10.4, E.inOut);
        rows.forEach(function (r, i) {
          op(r.g, P(t, 0.1 + i * 0.1, 0.5 + i * 0.1) * fade);
          op(r.ev, P(t, 0.8 + i * 0.12, 1.1 + i * 0.12) * fade);
          r.cells.forEach(function (c, k) {
            var t0 = 1.9 + i * 0.48 + k * 0.12;
            var p = P(t, t0, t0 + 0.25);
            set(c.box, "fill", p > 0.5 ? col[c.code] : "none");
            set(c.box, "stroke", p > 0.5 ? col[c.code] : "rgba(143,166,176,0.3)");
            op(c.mark, p);
          });
        });
        var row = Math.floor(clamp((t - 1.9) / 0.48, 0, 6.99));
        set(scan, "y", rows[row].y + 1);
        op(scan, t > 1.9 && t < 5.4 ? 1 : 0);
        var b = P(t, 5.6, 6.6, E.inOut);
        segs.forEach(function (s) { set(s.el, "width", (s.w * b * fade).toFixed(1)); });
        op(legend, P(t, 6.2, 6.6) * fade);
        gaps.forEach(function (g, i) {
          var a = P(t, 6.8 + i * 0.25, 7.2 + i * 0.25);
          move(g, lerp(12, 0, a), 0);
          op(g, a * fade);
          op(skelR[i], 0.5 * (1 - a) * fade + 0.5 * (1 - fade));
        });
        op(barTrack, 1 - b * fade);
      };
    },
  };

  /* WorkNodesCanvas: references, analyses, deck */
  SCENES.worknodescanvas = {
    dur: 10.8,
    still: 8.8,
    beats: [[0, 0], [3.0, 1], [5.6, 2]],
    size: { wide: [600, 375], tall: [340, 620] },
    init: function (stage, mode) {
      var tall = mode === "tall";
      var st = svgStage(stage, tall ? 340 : 600, tall ? 620 : 375, "wn" + mode);
      var svg = st.svg;
      var wires = h("g", null, svg);
      var LAY = tall
        ? { refs: [[8, 14], [8, 124], [8, 234]], rw: 144, rh: 96, an: [[172, 40], [172, 212]], aw: 150, ah: 122, pres: [8, 360, 324, 248], cols: 3, tw: 94, th: 56 }
        : { refs: [[16, 34], [16, 146], [16, 258]], rw: 152, rh: 84, an: [[218, 56], [218, 212]], aw: 160, ah: 112, pres: [430, 74, 154, 228], cols: 2, tw: 60, th: 38 };
      function node(x, y, w, hh, title, kind) {
        var g = h("g", { opacity: 0 }, svg);
        h("rect", { x: x, y: y, width: w, height: hh, rx: 9, fill: C.panel, stroke: C.line }, g);
        h("rect", { x: x, y: y, width: w, height: 3, rx: 1.5, fill: kind === "a" ? C.mint : kind === "p" ? C.sky : C.soft }, g);
        tx(g, x + 12, y + 22, title, tall ? "s-ui s-ui-sm" : "s-ui");
        return g;
      }
      var refs = ["Building survey", "Workshop notes", "Energy use 2023–25"].map(function (title, i) {
        var x = LAY.refs[i][0], y = LAY.refs[i][1], w = LAY.rw, hh = LAY.rh;
        var g = node(x, y, w, hh, title, "r");
        var inner = w - 24;
        if (i === 0) {
          h("rect", { x: x + 12, y: y + 32, width: 30, height: hh - 44, rx: 2, fill: "none", stroke: "rgba(143,166,176,0.45)" }, g);
          for (var k = 0; k < 4; k++) h("rect", { x: x + 50, y: y + 36 + k * 9, width: (inner - 40) * (1 - k * 0.12), height: 3.5, rx: 1.7, fill: "rgba(143,166,176,0.35)" }, g);
        }
        if (i === 1) for (var m = 0; m < 5; m++) h("rect", { x: x + 12, y: y + 34 + m * 8, width: inner * (1 - (m % 3) * 0.16), height: 3.5, rx: 1.7, fill: "rgba(143,166,176,0.35)" }, g);
        if (i === 2) for (var n = 0; n < 9; n++) { var bh = 8 + ((n * 7) % 26); h("rect", { x: x + 12 + n * (inner / 9), y: y + hh - 10 - bh, width: inner / 9 - 5, height: bh, rx: 1.5, fill: "rgba(143,220,210,0.55)" }, g); }
        return { g: g, out: [x + w, y + hh / 2] };
      });
      var an = ["Retrofit opportunities", "Stakeholder priorities"].map(function (title, i) {
        var x = LAY.an[i][0], y = LAY.an[i][1], w = LAY.aw;
        var g = node(x, y, w, LAY.ah, title, "a");
        var run = h("rect", { x: x + 12, y: y + 32, width: 40, height: 18, rx: 5, fill: "none", stroke: C.mint }, g);
        var runT = tx(g, x + 32, y + 45, "Run", "s-chip", { "text-anchor": "middle", fill: C.mint });
        var spin = h("circle", { cx: x + 64, cy: y + 41, r: 5, fill: "none", stroke: C.mint, "stroke-width": 1.6, "stroke-dasharray": "18 40", opacity: 0 }, g);
        var lines = [0, 1, 2, 3].map(function (k) {
          return h("rect", { x: x + 12, y: y + 62 + k * 10, width: 0, height: 4, rx: 2, fill: k === 0 ? "rgba(230,238,240,0.8)" : "rgba(143,166,176,0.45)" }, g);
        });
        return { g: g, run: run, runT: runT, spin: spin, lines: lines, w: w - 24, in: [x, y + 56], x: x, y: y, cx: x + 64, cy: y + 41 };
      });
      var PX = LAY.pres[0], PY = LAY.pres[1], PW = LAY.pres[2], PH = LAY.pres[3];
      var pres = node(PX, PY, PW, PH, "Client update deck", "p");
      var tabs = ["PPTX", "DOCX", "HTML"].map(function (f, i) {
        var r = h("rect", { x: PX + 12 + i * 44, y: PY + 34, width: 40, height: 16, rx: 4, fill: "none", stroke: "rgba(143,166,176,0.35)" }, pres);
        var tt = tx(pres, PX + 32 + i * 44, PY + 45.5, f, "s-chip", { "text-anchor": "middle", fill: C.mist });
        return { r: r, t: tt };
      });
      var slides = [], skelS = [];
      for (var q = 0; q < 6; q++) {
        skelS.push(h("rect", { x: PX + 12 + (q % LAY.cols) * (LAY.tw + 8), y: PY + 62 + Math.floor(q / LAY.cols) * (LAY.th + 8), width: LAY.tw, height: LAY.th, rx: 3, fill: "none", stroke: C.line, "stroke-dasharray": "3 4" }, pres));
      }
      for (var k = 0; k < 6; k++) {
        var sx = PX + 12 + (k % LAY.cols) * (LAY.tw + 8), sy = PY + 62 + Math.floor(k / LAY.cols) * (LAY.th + 8);
        var sg = h("g", { opacity: 0 }, pres);
        h("rect", { x: sx, y: sy, width: LAY.tw, height: LAY.th, rx: 3, fill: k === 0 ? C.ink : "#eef2f1", stroke: C.line }, sg);
        if (k === 0) h("rect", { x: sx + 6, y: sy + LAY.th - 14, width: LAY.tw * 0.55, height: 4, rx: 2, fill: C.mint }, sg);
        else { h("rect", { x: sx + 6, y: sy + 7, width: LAY.tw * 0.5, height: 3.5, rx: 1.7, fill: C.ink }, sg); h("rect", { x: sx + 6, y: sy + 15, width: LAY.tw * (0.72 - k * 0.04), height: LAY.th - 24, rx: 2, fill: k % 2 ? "#9fdcd3" : "#c9d4d6" }, sg); }
        tx(sg, sx + LAY.tw - 4, sy + LAY.th - 3, String(k + 1), "s-chip", { "text-anchor": "end", fill: k === 0 ? C.mist : "#4f626b" });
        slides.push(sg);
      }
      var dl = h("g", { opacity: 0 }, pres);
      h("rect", { x: PX + 12, y: PY + PH - 28, width: PW - 24, height: 18, rx: 9, fill: C.sky }, dl);
      tx(dl, PX + PW / 2, PY + PH - 15.5, "DOWNLOAD PPTX", "s-chip", { "text-anchor": "middle", fill: C.ink });

      function wire(d) {
        var p = h("path", { d: d, fill: "none", stroke: "rgba(143,220,210,0.55)", "stroke-width": 1.4 }, wires);
        var len = p.getTotalLength();
        set(p, "stroke-dasharray", len + " " + len);
        return { p: p, len: len, pulse: h("circle", { r: 3, fill: C.mint, opacity: 0 }, svg) };
      }
      function across(a, b) {
        var dx = (b[0] - a[0]) * 0.5;
        return "M" + a[0] + " " + a[1] + " C" + (a[0] + dx) + " " + a[1] + " " + (b[0] - dx) + " " + b[1] + " " + b[0] + " " + b[1];
      }
      var w1 = [wire(across(refs[0].out, an[0].in)), wire(across(refs[2].out, an[0].in)), wire(across(refs[1].out, an[1].in)), wire(across(refs[0].out, an[1].in))];
      var w2;
      if (tall) {
        var a0 = an[0], a1 = an[1], ex = a0.x + LAY.aw;
        w2 = [
          wire("M" + ex + " " + (a0.y + 56) + " L" + (ex + 8) + " " + (a0.y + 56) + " L" + (ex + 8) + " " + (PY - 14) + " Q" + (ex + 8) + " " + PY + " " + (PX + PW * 0.86) + " " + PY),
          wire("M" + (a1.x + LAY.aw / 2) + " " + (a1.y + LAY.ah) + " C" + (a1.x + LAY.aw / 2) + " " + (a1.y + LAY.ah + 10) + " " + (PX + PW * 0.55) + " " + (PY - 10) + " " + (PX + PW * 0.55) + " " + PY),
        ];
      } else {
        w2 = [wire(across([an[0].x + LAY.aw, an[0].y + 56], [PX, PY + 76])), wire(across([an[1].x + LAY.aw, an[1].y + 56], [PX, PY + 146]))];
      }
      function runWires(ws, t, t0) {
        ws.forEach(function (w, i) {
          var d = P(t, t0 + i * 0.12, t0 + 0.7 + i * 0.12, E.inOut);
          set(w.p, "stroke-dashoffset", (w.len * (1 - d)).toFixed(1));
          var q = (t - (t0 + 0.8 + i * 0.1)) / 0.9;
          if (q > 0 && q < 1) {
            var pt = w.p.getPointAtLength(w.len * E.inOut(q));
            set(w.pulse, "cx", pt.x.toFixed(1));
            set(w.pulse, "cy", pt.y.toFixed(1));
            op(w.pulse, 1);
          } else op(w.pulse, 0);
        });
      }
      return function (t) {
        var fade = 1 - P(t, 10.0, 10.6, E.inOut);
        op(wires, fade);
        refs.forEach(function (r, i) {
          var a = P(t, 0.2 + i * 0.25, 0.7 + i * 0.25, E.back);
          op(r.g, P(t, 0.2 + i * 0.25, 0.5 + i * 0.25) * fade);
          set(r.g, "transform", "translate(0 " + (8 * (1 - a)).toFixed(1) + ")");
        });
        an.forEach(function (a, i) {
          op(a.g, P(t, 1.3 + i * 0.2, 1.7 + i * 0.2) * fade);
          var pressed = t > 3.9 + i * 0.25;
          set(a.run, "fill", pressed ? C.mint : "none");
          set(a.runT, "fill", pressed ? C.ink : C.mint);
          op(a.spin, t > 3.9 + i * 0.25 && t < 4.6 + i * 0.25 ? 1 : 0);
          set(a.spin, "transform", "rotate(" + ((t * 540) % 360).toFixed(0) + " " + a.cx + " " + a.cy + ")");
          a.lines.forEach(function (l, k) {
            set(l, "width", (a.w * [1, 0.86, 0.94, 0.66][k] * P(t, 4.6 + i * 0.25 + k * 0.16, 5.0 + i * 0.25 + k * 0.16)).toFixed(1));
          });
        });
        runWires(w1, t, 2.3);
        op(pres, P(t, 1.7, 2.1) * fade);
        runWires(w2, t, 5.6);
        slides.forEach(function (s, k) {
          var a = P(t, 6.8 + k * 0.2, 7.1 + k * 0.2, E.back);
          op(skelS[k], 1 - P(t, 6.8 + k * 0.2, 7.0 + k * 0.2));
          op(s, P(t, 6.8 + k * 0.2, 7.0 + k * 0.2));
          set(s, "transform", "translate(0 " + (6 * (1 - a)).toFixed(1) + ")");
        });
        tabs.forEach(function (tb, i) {
          var on = i === 0 && t > 7.6;
          set(tb.r, "fill", on ? C.sky : "none");
          set(tb.r, "stroke", on ? C.sky : "rgba(143,166,176,0.35)");
          set(tb.t, "fill", on ? C.ink : C.mist);
        });
        op(dl, P(t, 8.0, 8.4));
      };
    },
  };

  /* Southwark Retrofit Atlas: real ward outlines and a sample of real homes (canvas) */
  SCENES["southwark-retrofit-atlas"] = {
    dur: 11.6,
    still: 9.6,
    beats: [[0, 0], [3.2, 1], [6.3, 2]],
    size: { wide: [600, 375], tall: [340, 700] },
    init: function (stage, mode) {
      var tall = mode === "tall";
      var cv = canvasStage(stage, tall ? 340 : 600, tall ? 700 : 375);
      var ctx = cv.ctx;
      var data = window.SOUTHWARK;
      var MAP = tall ? { x: 60, y: 14, w: 220, h: 356 } : { x: 40, y: 14, w: 250, h: 348 };
      var bw = data.b[0], bh = data.b[1];
      var sc = Math.min(MAP.w / bw, MAP.h / bh);
      var ox = MAP.x + (MAP.w - bw * sc) / 2, oy = MAP.y + (MAP.h - bh * sc) / 2;
      function px(x) { return ox + x * sc; }
      function py(y) { return oy + (bh - y) * sc; }
      var wards = data.w.map(function (flat) {
        var pts = [];
        for (var i = 0; i < flat.length; i += 2) pts.push([px(flat[i]), py(flat[i + 1])]);
        return pts;
      });
      var r = rng(42), pts = [];
      for (var i = 0; i < data.p.length; i += 3) pts.push({ x: px(data.p[i]), y: py(data.p[i + 1]), band: data.p[i + 2], pr: r() });
      var ymin = MAP.y, ymax = MAP.y + MAP.h;
      var below = pts.filter(function (p) { return p.band >= 2; });
      below.sort(function (a, b) { return b.band - a.band || a.pr - b.pr; });
      var funded = below.slice(0, 34);
      funded.sort(function (a, b) { return a.pr - b.pr; });
      funded.forEach(function (p, i) { p.fund = (i + 1) / funded.length; });
      var BAND = ["#1f9d68", "#7fbf4a", "#e5c23a", "#f0a35e", "#e2623f"];
      var LBL = ["A–B", "C", "D", "E", "F–G"];
      var PN = tall ? { x: 16, y: 384, w: 308, h: 304 } : { x: 312, y: 20, w: 268, h: 335 };
      function wardPath() {
        ctx.beginPath();
        wards.forEach(function (w) {
          ctx.moveTo(w[0][0], w[0][1]);
          for (var k = 1; k < w.length; k++) ctx.lineTo(w[k][0], w[k][1]);
          ctx.closePath();
        });
      }

      return function (t) {
        cv.begin();
        var fade = 1 - P(t, 10.8, 11.4, E.inOut);
        var b2 = P(t, 3.2, 3.8);
        var slider = P(t, 6.7, 8.9, E.inOut);
        ctx.globalAlpha = P(t, 0.1, 0.9) * fade;
        wardPath();
        ctx.fillStyle = "rgba(143,166,176,0.06)";
        ctx.fill();
        ctx.strokeStyle = "rgba(143,220,210,0.28)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.globalAlpha = 1;
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var f = (p.y - ymin) / (ymax - ymin);
          var a = P(t, 0.2 + f * 1.8, 0.6 + f * 1.8);
          if (a <= 0) continue;
          var alpha = a * fade, rad = 1.7;
          if (p.band < 2) alpha *= 1 - 0.6 * b2;
          else rad = 1.7 + 0.5 * b2 * (t < 6.3 ? 0.5 + 0.5 * Math.sin(t * 5 + p.pr * 6) : 0.4);
          var isFunded = p.fund !== undefined && slider >= p.fund;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = isFunded ? C.mint : BAND[p.band];
          ctx.beginPath(); ctx.arc(p.x, p.y, isFunded ? 2.6 : rad, 0, Math.PI * 2); ctx.fill();
          if (isFunded) {
            var ring = clamp((slider - p.fund) * 8, 0, 1);
            ctx.globalAlpha = (1 - ring) * fade;
            ctx.strokeStyle = C.mint;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3 + ring * 7, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.55 * fade;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3.7, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;

        var x0 = PN.x, y0 = PN.y, w = PN.w, L = x0 + 16, sw = w - 32;
        ctx.fillStyle = C.panel;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        roundRect(ctx, x0, y0, w, PN.h, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.soft;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "LONDON BOROUGH OF SOUTHWARK", L, y0 + 24, 1.1);
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#fff";
        ctx.font = font(34, "serif", 400);
        ctx.fillText(fmt(149062 * P(t, 0.3, 0.9, E.inOut)), L, y0 + 68);
        ctx.fillStyle = C.mist;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "HOMES BY EPC BAND TODAY", L, y0 + 86, 1.1);
        var gap = sw / 5;
        for (var k = 0; k < 5; k++) {
          var lx = L + k * gap;
          ctx.globalAlpha = P(t, 1.0 + k * 0.1, 1.3 + k * 0.1) * fade * (k < 2 ? 1 - 0.5 * b2 : 1);
          ctx.fillStyle = BAND[k];
          roundRect(ctx, lx, y0 + 100, 10, 10, 2.5); ctx.fill();
          ctx.fillStyle = C.text;
          ctx.font = font(10, "mono", 500);
          ctx.fillText(LBL[k], lx + 15, y0 + 109);
        }
        var b3 = P(t, 6.3, 6.8);
        var ry = y0 + 132;
        ctx.globalAlpha = (1 - b2) * 0.5 * fade;
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = C.line;
        roundRect(ctx, L, ry + 18, sw, 56, 8); ctx.stroke();
        roundRect(ctx, L, ry + 86, sw, 56, 8); ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = Math.max(b2 * (1 - b3), b3) * fade;
        ctx.fillStyle = "rgba(143,166,176,0.2)";
        ctx.fillRect(L, ry, sw, 1);
        ctx.globalAlpha = b2 * (1 - b3) * fade;
        ctx.fillStyle = "#fff";
        ctx.font = font(30, "serif", 400);
        ctx.fillText(fmt(56873 * P(t, 3.3, 3.9, E.inOut)), L, ry + 44);
        ctx.fillStyle = C.mist;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "HOMES BELOW EPC C", L, ry + 62, 1.1);
        ctx.globalAlpha = P(t, 4.4, 4.9) * (1 - b3) * fade;
        ctx.fillStyle = "#fff";
        ctx.font = font(30, "serif", 400);
        ctx.fillText("£570m", L, ry + 110);
        ctx.fillStyle = C.mist;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "TO LIFT EACH HOME TO ITS", L, ry + 128, 1.1);
        spaced(ctx, "REACHABLE BAND", L, ry + 142, 1.1);
        ctx.globalAlpha = b3 * fade;
        ctx.fillStyle = C.mist;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "BUDGET, NET OF GRANT", L, ry + 24, 1.1);
        ctx.fillStyle = "#fff";
        ctx.font = font(32, "serif", 400);
        ctx.fillText("£" + (47 * slider).toFixed(1) + "m", L, ry + 60);
        ctx.fillStyle = "rgba(143,166,176,0.3)";
        roundRect(ctx, L, ry + 74, sw, 4, 2); ctx.fill();
        ctx.fillStyle = C.mint;
        roundRect(ctx, L, ry + 74, Math.max(4, sw * slider), 4, 2); ctx.fill();
        ctx.beginPath(); ctx.arc(L + sw * slider, ry + 76, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = C.mint; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = font(26, "serif", 400);
        ctx.fillText(fmt(4079 * slider), L, ry + 124);
        ctx.fillText((6.6 * slider).toFixed(1) + " kt", L + sw * 0.52, ry + 124);
        ctx.fillStyle = C.mist;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "HOMES FUNDED", L, ry + 142, 1.1);
        spaced(ctx, "CO₂E SAVED A YEAR", L + sw * 0.52, ry + 142, 1.1);
        ctx.globalAlpha = 1;
      };
    },
  };

  /* ModelChat: the featured story, a long, low timber office beside a live chat */
  SCENES.modelchat = {
    dur: 16.4,
    still: 6.6,
    beats: [[0, 0], [2.7, 1], [3.6, 2], [8.3, 0], [10.3, 1], [10.9, 2]],
    size: { wide: [560, 420], tall: [560, 700] },
    keepStage: true,
    init: function (stage, mode) {
      var tall = mode === "tall";
      var viewer = stage.querySelector(".mc__viewer");
      var chat = stage.querySelector(".mc__log");
      viewer.innerHTML = "";
      chat.innerHTML = "";
      var st = svgStage(viewer, 560, tall ? 700 : 420, "mc" + (mode || "wide"));
      var svg = st.svg;
      var cam = h("g", null, svg);
      // six storeys with columns, from the basement to Level 05
      var L = 300, W = 100, FH = 18, FLOORS = 6, OX = 193, OY = tall ? 176 : 168;
      function iso(x, y, z) { return [OX + (x - y) * 0.866, OY + (x + y) * 0.5 - z]; }
      function pts(arr) {
        return arr.map(function (p) { var q = iso(p[0], p[1], p[2]); return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
      }
      var grid = h("g", { stroke: "rgba(143,166,176,0.13)", "stroke-width": 0.8 }, cam);
      for (var gx = -100; gx <= 400; gx += 50) h("polyline", { points: pts([[gx, -50, 0], [gx, 150, 0]]), fill: "none" }, grid);
      for (var gy = -50; gy <= 150; gy += 50) h("polyline", { points: pts([[-100, gy, 0], [400, gy, 0]]), fill: "none" }, grid);
      var floors = [];
      for (var k = 0; k < FLOORS; k++) {
        var z0 = k * FH, z1 = z0 + FH - 3;
        var g = h("g", null, cam);
        var left = h("polygon", { points: pts([[0, W, z0], [L, W, z0], [L, W, z1], [0, W, z1]]), fill: "rgba(89,199,252,0.14)", stroke: "rgba(143,220,210,0.45)", "stroke-width": 0.8 }, g);
        var right = h("polygon", { points: pts([[L, 0, z0], [L, W, z0], [L, W, z1], [L, 0, z1]]), fill: "rgba(89,199,252,0.08)", stroke: "rgba(143,220,210,0.45)", "stroke-width": 0.8 }, g);
        var mull = h("g", { stroke: "rgba(143,220,210,0.22)", "stroke-width": 0.6 }, g);
        for (var mx = 25; mx < L; mx += 25) h("polyline", { points: pts([[mx, W, z0], [mx, W, z1]]), fill: "none" }, mull);
        for (var my = 25; my < W; my += 25) h("polyline", { points: pts([[L, my, z0], [L, my, z1]]), fill: "none" }, mull);
        var top = h("polygon", { points: pts([[0, 0, z1], [L, 0, z1], [L, W, z1], [0, W, z1]]), fill: k === FLOORS - 1 ? "rgba(143,220,210,0.18)" : "rgba(143,220,210,0)", stroke: "rgba(143,220,210,0.5)", "stroke-width": 0.8 }, g);
        floors.push({ g: g, left: left, right: right, top: top, k: k });
      }
      // a structural grid of 12 x 4 columns on every storey
      var cols = h("g", { stroke: C.mint, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0 }, cam);
      var colLines = [];
      for (var f = 0; f < FLOORS; f++) {
        for (var cy = 0; cy < 4; cy++) {
          for (var cx = 0; cx < 9; cx++) {
            var x = 10 + cx * 35, y = 8 + cy * 28;
            colLines.push({ el: h("polyline", { points: pts([[x, y, f * FH], [x, y, f * FH + FH - 3]]), fill: "none" }, cols), f: f });
          }
        }
      }
      var label = h("g", { opacity: 0 }, svg);
      var lp = iso(L, W, 3 * FH + 7);
      if (!tall) {
        h("circle", { cx: 0, cy: 0, r: 2.5, fill: C.mint }, label);
        h("polyline", { points: "0,0 24,22 120,22", fill: "none", stroke: C.mint }, label);
      }
      var area = tx(label, tall ? 0 : 28, tall ? 0 : 16, "", tall ? "s-num" : "s-num-sm", tall ? { "text-anchor": "end" } : null);
      tx(label, tall ? 0 : 28, tall ? 20 : 38, "LEVEL 03 · GFA", "s-mono", tall ? { "text-anchor": "end" } : null);
      var colLabel = h("g", { opacity: 0 }, svg);
      var colCount = tx(colLabel, 536, 50, "", "s-num", { "text-anchor": "end" });
      tx(colLabel, 536, 70, "COLUMNS · WHOLE BUILDING", "s-mono", { "text-anchor": "end" });
      tx(svg, 24, tall ? 40 : 404, "NORDICLCA TIMBER OFFICE · IFC4", "s-mono s-dim");

      function msg(cls, html) {
        var el = document.createElement("div");
        el.className = "mc__msg " + cls;
        if (html !== undefined) el.innerHTML = html;
        chat.appendChild(el);
        return el;
      }
      function tools(list) {
        var el = msg("mc__tools");
        return list.map(function (name) {
          var row = document.createElement("div");
          row.className = "mc__tool";
          row.innerHTML = '<span class="mc__tick"></span><span>' + name + "</span>";
          el.appendChild(row);
          return row;
        }).concat([el]);
      }
      var q1 = "What is the gross floor area of Level 03? Isolate that floor.";
      var q2 = "Now show only the columns, across the whole building.";
      var u1 = msg("mc__user"), t1 = tools(["query_index", "compute_quantity", "isolate", "focus_camera"]);
      var a1 = msg("mc__answer", "Level 03 has a gross floor area of about <b>0</b>&nbsp;m². The floor is isolated and the camera is fitted to it.");
      var u2 = msg("mc__user"), t2 = tools(["query_index", "isolate", "focus_camera"]);
      var a2 = msg("mc__answer", "The viewer now shows only the columns, all <b>0</b> of them across the building.");
      var n1 = a1.querySelector("b"), n2 = a2.querySelector("b");
      function show(el, v) {
        el.style.opacity = v.toFixed(3);
        el.style.transform = "translateY(" + ((1 - v) * 8).toFixed(1) + "px)";
        el.style.display = v > 0.001 ? "" : "none";
      }
      function typing(el, s, p) {
        var n = Math.round(s.length * p);
        var v = s.slice(0, n) + (p > 0 && p < 1 ? "▍" : "");
        if (el.__t !== v) { el.__t = v; el.textContent = v; }
      }
      function toolState(rows, t, a0, vis) {
        show(rows[rows.length - 1], (t >= a0 ? 1 : 0) * vis);
        rows.slice(0, -1).forEach(function (row, i) {
          var a = a0 + 0.15 + i * 0.32;
          row.style.opacity = P(t, a, a + 0.2).toFixed(3);
          row.classList.toggle("is-done", t > a + 0.28);
        });
      }
      var cxs = iso(L / 2, W / 2, 3 * FH + 7);

      return function (t) {
        var e1 = t < 8.0 ? 1 : 1 - P(t, 8.0, 8.3);
        var e2 = P(t, 8.3, 8.4) * (1 - P(t, 15.4, 15.9));
        show(u1, P(t, 0.2, 0.5) * e1);
        typing(u1, q1, P(t, 0.4, 2.4, E.lin));
        toolState(t1, t, 2.7, e1);
        show(a1, P(t, 4.6, 5.0) * e1);
        // one count drives both the chat answer and the viewer label
        var areaNow = fmt(3621 * P(t, 4.6, 5.2));
        n1.textContent = areaNow;
        show(u2, e2 * P(t, 8.3, 8.6));
        typing(u2, q2, P(t, 8.5, 10.1, E.lin));
        toolState(t2, t, 10.3, e2);
        show(a2, P(t, 12.0, 12.4) * e2);
        var colsNow = fmt(340 * P(t, 12.0, 12.6));
        n2.textContent = colsNow;

        var iso1 = P(t, 3.6, 4.6, E.inOut) * (1 - P(t, 10.9, 11.6, E.inOut));
        var colsOn = P(t, 11.2, 12.0, E.inOut) * (1 - P(t, 15.3, 16.0, E.inOut));
        var zoom = 1 + 0.28 * iso1;
        set(cam, "transform", "translate(" + cxs[0].toFixed(1) + " " + cxs[1].toFixed(1) + ") scale(" + zoom.toFixed(3) + ") translate(" + (-cxs[0]).toFixed(1) + " " + (-cxs[1]).toFixed(1) + ")");
        floors.forEach(function (fl) {
          var sel = fl.k === 3;
          op(fl.g, (sel ? 1 : 1 - 0.86 * iso1) * (1 - 0.78 * colsOn));
          var hot = sel && iso1 > 0.5;
          set(fl.left, "fill", hot ? "rgba(22,255,198,0.30)" : "rgba(89,199,252,0.14)");
          set(fl.right, "fill", hot ? "rgba(22,255,198,0.20)" : "rgba(89,199,252,0.08)");
          set(fl.top, "fill", hot ? "rgba(22,255,198,0.38)" : fl.k === FLOORS - 1 ? "rgba(143,220,210,0.18)" : "rgba(143,220,210,0)");
          set(fl.g, "transform", sel ? "translate(0 " + (-6 * iso1).toFixed(2) + ")" : "");
        });
        op(cols, colsOn);
        colLines.forEach(function (c) { op(c.el, P(t, 11.2 + c.f * 0.1, 11.6 + c.f * 0.1)); });
        var lx = cxs[0] + (lp[0] - cxs[0]) * zoom, ly = cxs[1] + (lp[1] - cxs[1] - 6 * iso1) * zoom;
        if (tall) move(label, 536, 50);
        else move(label, lx, ly);
        op(label, P(t, 4.6, 5.0) * (1 - P(t, 7.8, 8.2)));
        text(area, areaNow + " m²");
        op(colLabel, P(t, 12.0, 12.4) * (1 - P(t, 15.3, 15.8)));
        text(colCount, colsNow);
      };
    },
  };

  /* Engine: build each story for its width, run it only while it is on screen */
  function initStories() {
    var hosts = Array.prototype.slice.call(document.querySelectorAll("[data-story]"));
    if (!hosts.length) return;
    var live = [];
    hosts.forEach(function (host) {
      var def = SCENES[host.getAttribute("data-story")];
      if (!def) return;
      var stage = host.querySelector(".story__stage") || host;
      var card = host.closest(".story-card") || host.parentNode;
      var beats = Array.prototype.slice.call(card.querySelectorAll(".beats > *"));
      live.push({ host: host, def: def, stage: stage, beats: beats, visible: false, start: 0, t: def.still, built: false, mode: null });
      host.classList.add("is-live");
    });

    function modeFor(s) {
      if (!s.def.size) return "wide";
      return s.host.getBoundingClientRect().width < 520 ? "tall" : "wide";
    }
    function beat(s, t) {
      var idx = 0, from = 0, to = s.def.dur;
      for (var i = 0; i < s.def.beats.length; i++) {
        if (t >= s.def.beats[i][0]) {
          idx = s.def.beats[i][1];
          from = s.def.beats[i][0];
          to = i + 1 < s.def.beats.length ? s.def.beats[i + 1][0] : s.def.dur;
        }
      }
      s.beats.forEach(function (b, i) {
        b.classList.toggle("is-on", i === idx);
        b.classList.toggle("is-past", i < idx);
        if (i === idx) b.style.setProperty("--p", clamp((t - from) / (to - from), 0, 1).toFixed(3));
      });
    }
    function build(s) {
      var mode = modeFor(s);
      if (s.built && s.mode === mode) return;
      if (s.def.size) {
        var dims = s.def.size[mode];
        s.host.classList.toggle("is-tall", mode === "tall");
        s.host.style.setProperty("--ar", dims[0] + " / " + dims[1]);
        if (!s.def.keepStage) {
          s.stage.innerHTML = "";
          s.stage.__canvasApi = null;
        }
      }
      s.mode = mode;
      s.render = s.def.init(s.stage, mode);
      s.built = true;
      if (s.stage.__canvasApi) s.stage.__canvasApi.redraw = function () { s.render(s.t); };
      s.render(s.t);
      beat(s, s.t);
    }

    // every story opens on its finished frame
    live.forEach(build);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { live.forEach(function (s) { s.render(s.t); }); });
    var resizeTimer = 0;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { live.forEach(build); }, 150);
    });

    window.BakshiStories = {
      at: function (slug, t) {
        live.forEach(function (s) {
          if (s.host.getAttribute("data-story") !== slug) return;
          s.visible = false;
          s.t = t;
          s.render(t);
          beat(s, t);
        });
      },
    };
    if (reduce || !("IntersectionObserver" in window)) return;

    var running = false;
    function frame(now) {
      var any = false;
      live.forEach(function (s) {
        if (!s.visible) return;
        any = true;
        s.t = ((now - s.start) / 1000) % s.def.dur;
        s.render(s.t);
        beat(s, s.t);
      });
      if (any && !document.hidden) requestAnimationFrame(frame);
      else running = false;
    }
    function kick() {
      if (!running) { running = true; requestAnimationFrame(frame); }
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          var s = live.filter(function (x) { return x.host === en.target; })[0];
          if (!s) return;
          if (en.isIntersecting) {
            if (!s.visible) s.start = performance.now() - s.t * 1000;
            s.visible = true;
          } else s.visible = false;
        });
        kick();
      },
      { threshold: 0.4 }
    );
    live.forEach(function (s) { io.observe(s.host); });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        var now = performance.now();
        live.forEach(function (s) { s.start = now - s.t * 1000; });
        kick();
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStories);
  else initStories();
})();
