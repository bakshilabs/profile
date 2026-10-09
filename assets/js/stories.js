/* Bakshi Labs: animated stories for the seven tools.
   Each scene builds its drawing once, then render(t) sets every element for time t,
   so a scene can loop, pause off screen, or show one still frame. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var C = {
    bg: "#0f222b",
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
  };

  /* Timing helpers */
  function clamp(v, a, b) {
    return Math.min(b, Math.max(a, v));
  }
  var E = {
    out: function (p) {
      return 1 - Math.pow(1 - p, 3);
    },
    inOut: function (p) {
      return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    },
    lin: function (p) {
      return p;
    },
    back: function (p) {
      var c1 = 1.5,
        c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    },
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
  function move(el, x, y, s) {
    set(el, "transform", "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")" + (s !== undefined ? " scale(" + s.toFixed(3) + ")" : ""));
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
  function gradient(defs, id, stops, vertical) {
    var g = h("linearGradient", { id: id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 0 }, defs);
    stops.forEach(function (s) {
      h("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] === undefined ? 1 : s[2] }, g);
    });
    return g;
  }

  /* Canvas helper: logical size w x h, sharp on any screen */
  function canvasStage(stage, w, hgt) {
    var c = document.createElement("canvas");
    c.setAttribute("aria-hidden", "true");
    stage.appendChild(c);
    var ctx = c.getContext("2d");
    var bg = document.createElement("canvas");
    var api = { ctx: ctx, w: w, h: hgt, scale: 1, dirty: true, redraw: null };
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
      api.dirty = true;
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
    // letter-spaced text for mono labels on canvas
    for (var i = 0; i < s.length; i++) {
      ctx.fillText(s[i], x, y);
      x += ctx.measureText(s[i]).width + track;
    }
    return x;
  }

  var SCENES = {};

  /* 01 Strategic Project Discovery: scan, collect, score */
  SCENES["strategic-project-discovery"] = {
    dur: 10.6,
    still: 8.4,
    beats: [[0, 0], [3.0, 1], [4.8, 2]],
    init: function (stage) {
      var st = svgStage(stage, 600, 375, "spd");
      var svg = st.svg;
      gradient(st.defs, "beam-spd", [[0, C.mint, 0], [0.5, C.mint, 0.28], [1, C.mint, 0]]);
      tx(svg, 24, 30, "676 PROCUREMENT SOURCES", "s-mono");
      var status = tx(svg, 24, 340, "", "s-mono s-dim");
      var N = 26, cell = 8, gap = 2, x0 = 24, y0 = 44;
      var r = rng(11), hits = [];
      while (hits.length < 5) {
        var k = Math.floor(r() * 676);
        if (hits.indexOf(k) < 0 && k % N > 2 && k % N < 23) hits.push(k);
      }
      var g = h("g", null, svg), sq = [];
      for (var i = 0; i < 676; i++) {
        var cx = i % N, cy = Math.floor(i / N);
        var x = x0 + cx * (cell + gap), y = y0 + cy * (cell + gap);
        sq.push({ el: h("rect", { x: x, y: y, width: cell, height: cell, rx: 1.6, fill: C.mist, opacity: 0.16 }, g), x: x + cell / 2, y: y + cell / 2, hit: hits.indexOf(i) >= 0 });
      }
      var gridW = N * (cell + gap);
      var glow = h("rect", { x: 0, y: y0 - 8, width: 44, height: gridW + 12, fill: "url(#beam-spd)" }, svg);
      var beam = h("rect", { x: 0, y: y0 - 8, width: 1.5, height: gridW + 12, fill: C.mint }, svg);

      h("rect", { x: 316, y: 20, width: 264, height: 335, rx: 12, fill: C.panel, stroke: C.line }, svg);
      tx(svg, 332, 44, "RESULTS · SAMPLE DATA", "s-mono");
      var data = [
        ["Northern Arc Metro Extension", "MANCHESTER · £1.8BN", 92],
        ["Iberian High Speed Link", "VALENCIA · €640M", 78],
        ["Gulf Coast Light Rail", "DOHA · QAR 4.2BN", 88],
        ["Eastern Suburbs Metro", "SYDNEY · A$2.1BN", 81],
        ["Pacific Corridor Rail", "PORTLAND · US$380M", 64],
      ];
      var sorted = data.map(function (d, i) { return i; }).sort(function (a, b) { return data[b][2] - data[a][2]; });
      var hitPts = hits.map(function (k) { return sq[k]; }).sort(function (a, b) { return a.x - b.x; });
      var cards = data.map(function (d, i) {
        var cg = h("g", { opacity: 0 }, svg);
        var bg = h("rect", { x: 328, y: 0, width: 240, height: 52, rx: 8, fill: C.panel2, stroke: C.line }, cg);
        h("circle", { cx: 352, cy: 26, r: 14, fill: "none", stroke: "rgba(143,166,176,0.25)", "stroke-width": 3 }, cg);
        var arc = h("circle", { cx: 352, cy: 26, r: 14, fill: "none", stroke: C.mint, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(-90 352 26)", "stroke-dasharray": "0 88" }, cg);
        var num = tx(cg, 352, 30, "", "s-num-xs", { "text-anchor": "middle" });
        tx(cg, 376, 23, d[0], "s-ui");
        tx(cg, 376, 40, d[1], "s-mono s-dim");
        var chip = h("g", { opacity: 0 }, cg);
        h("rect", { x: 496, y: -7, width: 60, height: 15, rx: 7.5, fill: C.mint }, chip);
        tx(chip, 526, 3.5, "HIGH FIT", "s-chip s-ink", { "text-anchor": "middle" });
        var fly = h("circle", { r: 3.2, fill: C.mint, opacity: 0 }, svg);
        return { g: cg, bg: bg, arc: arc, num: num, chip: chip, fly: fly, score: d[2], slot: i, rank: sorted.indexOf(i), from: hitPts[i] };
      });

      return function (t) {
        var fade = 1 - P(t, 9.6, 10.3, E.inOut);
        var sweep = P(t, 0.3, 2.8, E.inOut);
        var bx = lerp(x0 - 6, x0 + gridW + 4, sweep);
        var scanning = t > 0.3 && t < 2.95;
        set(beam, "x", bx.toFixed(1));
        set(glow, "x", (bx - 22).toFixed(1));
        op(beam, scanning ? 1 : 0);
        op(glow, scanning ? 1 : 0);
        for (var i = 0; i < sq.length; i++) {
          var s = sq[i], o = 0.16, fill = C.mist;
          if (t > 0.3 && bx > s.x) {
            var d = bx - s.x;
            o = 0.24 + 0.6 * Math.exp((-d * d) / 260) * (1 - P(t, 2.8, 3.3));
            if (s.hit) {
              o = 1;
              fill = C.mint;
            }
          }
          set(s.el, "fill", fill);
          op(s.el, o * fade + (1 - fade) * 0.16);
        }
        text(status, t < 0.3 ? "READY TO SCAN" : t < 2.9 ? "SCANNING " + Math.round(676 * sweep) + " / 676" : "5 OPPORTUNITIES FOUND");
        cards.forEach(function (c, i) {
          var t0 = 3.0 + i * 0.24;
          var fp = P(t, t0, t0 + 0.7, E.inOut);
          var slotY = 60 + c.slot * 58, rankY = 60 + c.rank * 58;
          var y = lerp(slotY, rankY, P(t, 6.5, 7.4, E.inOut));
          var tx0 = c.from.x, ty0 = c.from.y, tx1 = 352, ty1 = y + 26;
          var mx = (tx0 + tx1) / 2, my = Math.min(ty0, ty1) - 40;
          var fx = (1 - fp) * (1 - fp) * tx0 + 2 * (1 - fp) * fp * mx + fp * fp * tx1;
          var fy = (1 - fp) * (1 - fp) * ty0 + 2 * (1 - fp) * fp * my + fp * fp * ty1;
          set(c.fly, "cx", fx.toFixed(1));
          set(c.fly, "cy", fy.toFixed(1));
          op(c.fly, t > t0 && fp < 1 ? 1 : 0);
          var appear = P(t, t0 + 0.55, t0 + 0.95);
          move(c.g, lerp(14, 0, appear), y);
          op(c.g, appear * fade);
          var ring = P(t, 4.8 + i * 0.14, 5.9 + i * 0.14, E.inOut);
          set(c.arc, "stroke-dasharray", ((88 * c.score) / 100) * ring + " 88");
          text(c.num, ring > 0 ? String(Math.round(c.score * ring)) : "");
          var top = c.rank === 0 ? P(t, 7.4, 7.8) : 0;
          set(c.bg, "stroke", top > 0.5 ? C.mint : C.line);
          op(c.chip, top);
        });
      };
    },
  };

  /* 02 GrowthSignal: collect, tag, rank */
  SCENES.growthsignal = {
    dur: 11,
    still: 8.8,
    beats: [[0, 0], [3.9, 1], [6.9, 2]],
    init: function (stage) {
      var st = svgStage(stage, 600, 375, "gs");
      var svg = st.svg;
      tx(svg, 24, 30, "270+ PUBLIC SOURCES", "s-mono");
      var sources = ["UK PORTALS", "EU PORTALS", "US PORTALS", "DEVELOPMENT BANKS", "OCDS PUBLISHERS", "PERMITS", "SEC FILINGS", "INDUSTRY NEWS"];
      var srcEls = sources.map(function (s, i) {
        var y = 62 + i * 34;
        var dot = h("circle", { cx: 28, cy: y - 3.5, r: 3, fill: C.soft, opacity: 0.4 }, svg);
        tx(svg, 38, y, s, "s-mono s-dim");
        return { dot: dot, y: y - 3.5 };
      });
      // database
      var db = h("g", null, svg);
      var dbx = 246, dby = 128;
      h("path", { d: "M" + (dbx - 38) + " " + dby + " v86 a38 11 0 0 0 76 0 v-86", fill: C.panel2, stroke: C.line }, db);
      h("ellipse", { cx: dbx, cy: dby, rx: 38, ry: 11, fill: C.panel, stroke: C.line }, db);
      h("path", { d: "M" + (dbx - 38) + " " + (dby + 30) + " a38 11 0 0 0 76 0 M" + (dbx - 38) + " " + (dby + 58) + " a38 11 0 0 0 76 0", fill: "none", stroke: C.line }, db);
      var fillLevel = h("rect", { x: dbx - 37, y: dby + 97, width: 74, height: 0, fill: "rgba(22,255,198,0.10)" }, db);
      var count = tx(svg, dbx, 262, "0", "s-num", { "text-anchor": "middle" });
      tx(svg, dbx, 280, "RECORDS", "s-mono s-dim", { "text-anchor": "middle" });
      var claude = h("g", { opacity: 0 }, svg);
      h("rect", { x: dbx - 34, y: 300, width: 68, height: 20, rx: 10, fill: "none", stroke: C.mint }, claude);
      tx(claude, dbx, 314, "CLAUDE", "s-mono", { "text-anchor": "middle", fill: C.mint });

      var r = rng(5);
      var parts = [];
      for (var i = 0; i < 46; i++) {
        var s = srcEls[Math.floor(r() * srcEls.length)];
        parts.push({ el: h("rect", { width: 7, height: 4, rx: 1.5, fill: C.soft, opacity: 0 }, svg), y0: s.y, t0: 0.3 + i * 0.07 + r() * 0.12, s: s });
      }

      h("rect", { x: 330, y: 20, width: 250, height: 335, rx: 12, fill: C.panel, stroke: C.line }, svg);
      tx(svg, 346, 44, "PIPELINE · RANKED", "s-mono");
      var rows = [
        ["INFRASTRUCTURE", "TENDER", "UK", 71],
        ["ENERGY", "PROGRAMME", "EU", 44],
        ["RESIDENTIAL", "PIPELINE", "UK", 63],
        ["INSTITUTIONAL", "TENDER", "US", 86],
        ["COMMERCIAL", "AWARD", "EU", 92],
        ["INDUSTRIAL", "PROGRAMME", "US", 55],
      ];
      var order = rows.map(function (d, i) { return i; }).sort(function (a, b) { return rows[b][3] - rows[a][3]; });
      var rowEls = rows.map(function (d, i) {
        var rg = h("g", { opacity: 0 }, svg);
        var bg = h("rect", { x: 342, y: 0, width: 226, height: 42, rx: 7, fill: C.panel2, stroke: C.line }, rg);
        h("rect", { x: 354, y: 10, width: 70 + ((i * 37) % 60), height: 5, rx: 2.5, fill: "rgba(230,238,240,0.55)" }, rg);
        var chips = [];
        var cx = 354;
        [d[0], d[1], d[2]].forEach(function (c, j) {
          var w = c.length * 5.6 + 12;
          var cg = h("g", { opacity: 0 }, rg);
          h("rect", { x: cx, y: 21, width: w, height: 14, rx: 7, fill: j === 0 ? "rgba(22,255,198,0.14)" : "rgba(143,166,176,0.16)" }, cg);
          tx(cg, cx + w / 2, 31, c, "s-chip", { "text-anchor": "middle", fill: j === 0 ? C.mint : C.text });
          chips.push(cg);
          cx += w + 5;
        });
        var score = tx(rg, 556, 26, "", "s-num-xs", { "text-anchor": "end" });
        return { g: rg, bg: bg, chips: chips, score: score, val: d[3], slot: i, rank: order.indexOf(i) };
      });

      return function (t) {
        var fade = 1 - P(t, 10.1, 10.8, E.inOut);
        srcEls.forEach(function (s, i) {
          op(s.dot, 0.35 + 0.65 * Math.max(0, Math.sin((t * 4 + i) * 1.3)) * (t > 0.3 && t < 3.8 ? 1 : 0));
        });
        parts.forEach(function (p) {
          var q = P(t, p.t0, p.t0 + 0.9, E.inOut);
          var x0 = 160, x1 = dbx, y1 = dby + 4;
          var mx = (x0 + x1) / 2, my = Math.min(p.y0, y1) - 10;
          var x = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * mx + q * q * x1;
          var y = (1 - q) * (1 - q) * p.y0 + 2 * (1 - q) * q * my + q * q * y1;
          set(p.el, "x", (x - 3.5).toFixed(1));
          set(p.el, "y", (y - 2).toFixed(1));
          op(p.el, t > p.t0 && q < 1 ? 0.9 : 0);
        });
        var c = P(t, 0.5, 3.9, E.inOut);
        text(count, fmt(57848 * c * fade + (fade < 1 ? 0 : 0)));
        set(fillLevel, "height", (86 * c * fade).toFixed(1));
        set(fillLevel, "y", (dby + 97 - 86 * c * fade).toFixed(1));
        op(claude, (t > 3.9 && t < 7 ? 0.55 + 0.45 * Math.sin(t * 6) : P(t, 3.9, 4.2) * (t < 7 ? 1 : 1 - P(t, 7, 7.4))) * fade);
        rowEls.forEach(function (row, i) {
          var t0 = 3.9 + i * 0.3;
          var a = P(t, t0, t0 + 0.5);
          var y = lerp(58 + row.slot * 48, 58 + row.rank * 48, P(t, 6.9, 7.8, E.inOut));
          move(row.g, lerp(-16, 0, a), y);
          op(row.g, a * fade);
          row.chips.forEach(function (cg, j) {
            op(cg, P(t, t0 + 0.35 + j * 0.16, t0 + 0.6 + j * 0.16));
          });
          var sp = P(t, 6.7, 7.2);
          text(row.score, sp > 0 ? String(Math.round(row.val * sp)) : "");
          set(row.bg, "stroke", row.rank === 0 && t > 7.8 ? C.mint : C.line);
        });
      };
    },
  };

  /* 04 Reference Buildings Explorer: rise, slice, read (canvas) */
  SCENES["reference-buildings-explorer"] = {
    dur: 11,
    still: 8.6,
    beats: [[0, 0], [3.6, 1], [6.6, 2]],
    init: function (stage) {
      var cv = canvasStage(stage, 600, 375);
      var ctx = cv.ctx;
      var N = 16, s = 10.6, ox = 304, oy = 136, maxH = 104;
      var r = rng(21);
      var typeBase = [];
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
        var c = vir[i0].map(function (cc, j) { return Math.round((cc + (vir[i1][j] - cc) * f) * k); });
        return c;
      }
      function X(i, j) { return ox + (i - j) * s * 0.866; }
      function Y(i, j) { return oy + (i + j) * s * 0.5; }
      function poly(pts, fill, stroke) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
        ctx.closePath();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
        if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
      }
      function bar(i, j, hh, val, alpha) {
        var i0 = i + 0.14, i1 = i + 0.86, j0 = j + 0.14, j1 = j + 0.86;
        var A = [X(i0, j0), Y(i0, j0)], B = [X(i1, j0), Y(i1, j0)], Cc = [X(i1, j1), Y(i1, j1)], D = [X(i0, j1), Y(i0, j1)];
        function up(p) { return [p[0], p[1] - hh]; }
        var top = color(val, 1), left = color(val, 0.62), right = color(val, 0.8);
        ctx.globalAlpha = alpha;
        poly([D, Cc, up(Cc), up(D)], "rgb(" + left + ")");
        poly([B, Cc, up(Cc), up(B)], "rgb(" + right + ")");
        poly([up(A), up(B), up(Cc), up(D)], "rgb(" + top + ")");
        ctx.globalAlpha = 1;
      }
      var cells = [];
      for (var ii = 0; ii < N; ii++) for (var jj = 0; jj < N; jj++) cells.push([ii, jj]);
      cells.sort(function (p, q) { return p[0] + p[1] - (q[0] + q[1]) || p[1] - q[1]; });

      return function (t) {
        cv.begin();
        var fade = 1 - P(t, 10.2, 10.8, E.inOut);
        // floor grid
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = "rgba(143,166,176,0.18)";
        for (var k = 0; k <= N; k++) {
          ctx.beginPath(); ctx.moveTo(X(k, 0), Y(k, 0)); ctx.lineTo(X(k, N), Y(k, N)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(X(0, k), Y(0, k)); ctx.lineTo(X(N, k), Y(N, k)); ctx.stroke();
        }
        // axis labels
        ctx.fillStyle = C.mist;
        ctx.font = font(9.5, "mono", 500);
        ctx.save(); ctx.translate(X(0, N) + 4, Y(0, N) + 26); ctx.rotate(Math.atan2(0.5, 0.866)); spaced(ctx, "16 BUILDING TYPES", 0, 0, 1.2); ctx.restore();
        ctx.save(); ctx.translate(X(N, N) + 22, Y(N, N) + 14); ctx.rotate(-Math.atan2(0.5, 0.866)); spaced(ctx, "16 CLIMATE ZONES", 0, 0, 1.2); ctx.restore();

        var plane = t < 3.6 ? -1 : lerp(0, SEL_J + 0.5, P(t, 3.6, 5.6, E.inOut));
        var slice = P(t, 5.4, 5.9);
        var pick = P(t, 6.6, 7.1);
        var drawnPlane = false;
        for (var c = 0; c < cells.length; c++) {
          var i = cells[c][0], j = cells[c][1];
          if (plane >= 0 && !drawnPlane && j + 0.5 > plane) {
            drawPlane(plane, P(t, 3.6, 3.9) * (1 - P(t, 6.6, 7.2)) * fade);
            drawnPlane = true;
          }
          var t0 = 0.2 + (i + j) * 0.045;
          var hh = v[i][j] * maxH * E.out(clamp((t - t0) / 0.9, 0, 1)) * (0.15 + 0.85 * fade);
          if (hh < 0.5) continue;
          var alpha = 1;
          if (j !== SEL_J) alpha -= 0.72 * slice;
          if (!(i === SEL_I && j === SEL_J)) alpha -= (j === SEL_J ? 0.5 : 0.1) * pick;
          bar(i, j, hh, v[i][j], clamp(alpha, 0.12, 1) * fade + (1 - fade) * 0.2);
          if (pick > 0 && i === SEL_I && j === SEL_J) {
            var i0 = i + 0.14, i1 = i + 0.86, j0 = j + 0.14, j1 = j + 0.86;
            ctx.globalAlpha = pick * fade;
            ctx.lineWidth = 1.4;
            poly([[X(i0, j0), Y(i0, j0) - hh], [X(i1, j0), Y(i1, j0) - hh], [X(i1, j1), Y(i1, j1) - hh], [X(i1, j1), Y(i1, j1)], [X(i0, j1), Y(i0, j1)], [X(i0, j1), Y(i0, j1) - hh]], null, C.mint);
            ctx.globalAlpha = 1;
          }
        }
        if (plane >= 0 && !drawnPlane) drawPlane(plane, P(t, 3.6, 3.9) * (1 - P(t, 6.6, 7.2)) * fade);

        // header
        ctx.fillStyle = C.soft;
        ctx.font = font(10, "mono", 500);
        spaced(ctx, "256 BUILDING AND CLIMATE MODELS", 24, 30, 1.1);
        if (t >= 3.6 && t < 6.6) {
          ctx.globalAlpha = P(t, 5.4, 5.9) * fade;
          ctx.fillStyle = C.mint;
          spaced(ctx, "SECTION · CLIMATE 5A CHICAGO", 24, 48, 1.1);
          ctx.globalAlpha = 1;
        }
        // callout
        var call = P(t, 6.9, 7.5) * fade;
        if (call > 0) {
          var bx = X(SEL_I + 0.5, SEL_J + 0.5), by = Y(SEL_I + 0.5, SEL_J + 0.5) - v[SEL_I][SEL_J] * maxH;
          ctx.globalAlpha = call;
          ctx.strokeStyle = C.mint;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, 120); ctx.lineTo(172, 120); ctx.stroke();
          ctx.fillStyle = C.mint;
          ctx.beginPath(); ctx.arc(bx, by - 4, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "rgba(19,42,52,0.92)";
          ctx.strokeStyle = C.line;
          roundRect(ctx, 24, 58, 148, 92, 9);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = C.soft;
          ctx.font = font(9.5, "mono", 500);
          spaced(ctx, "LARGE OFFICE · 5A", 38, 80, 1);
          ctx.fillStyle = "#ffffff";
          ctx.font = font(34, "serif", 400);
          ctx.fillText(String(Math.round(575 * P(t, 6.9, 7.9))), 38, 118);
          ctx.fillStyle = C.mist;
          ctx.font = font(9.5, "mono", 500);
          spaced(ctx, "MJ/M² SITE EUI", 38, 138, 1);
          ctx.globalAlpha = 1;
        }
      };
      function drawPlane(jp, a) {
        if (a <= 0) return;
        var H = 128;
        ctx.globalAlpha = a;
        poly([[X(-0.4, jp), Y(-0.4, jp)], [X(N + 0.4, jp), Y(N + 0.4, jp)], [X(N + 0.4, jp), Y(N + 0.4, jp) - H], [X(-0.4, jp), Y(-0.4, jp) - H]], "rgba(22,255,198,0.08)", "rgba(22,255,198,0.7)");
        ctx.globalAlpha = 1;
      }
    },
  };

  function roundRect(ctx, x, y, w, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + hh, r);
    ctx.arcTo(x + w, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 05 MaterialScan: evidence, verdicts, gaps */
  SCENES.materialscan = {
    dur: 10.6,
    still: 8.6,
    beats: [[0, 0], [1.9, 1], [5.6, 2]],
    init: function (stage) {
      var st = svgStage(stage, 600, 375, "ms");
      var svg = st.svg;
      tx(svg, 24, 30, "LAB AND WORKPLACE PALETTE", "s-mono");
      var cols = ["LBC", "WELL", "BRIEF"];
      cols.forEach(function (c, i) {
        tx(svg, 236 + i * 52, 58, c, "s-mono s-dim", { "text-anchor": "middle" });
      });
      var sections = ["Spandrels", "MEP enclosures", "Bird safety", "Blades", "Facade profiles", "Expressed frame", "Column cladding"];
      var V = [["a", "p", "g"], ["a", "p", "p"], ["p", "p", "g"], ["a", "g", "p"], ["p", "p", "p"], ["a", "p", "g"], ["p", "f", "p"]];
      var col = { p: C.teal, a: C.amber, g: C.grey, f: C.red };
      var scan = h("rect", { x: 18, y: 0, width: 352, height: 34, rx: 7, fill: "rgba(22,255,198,0.07)", stroke: "rgba(22,255,198,0.4)", opacity: 0 }, svg);
      var rows = sections.map(function (name, i) {
        var y = 68 + i * 38;
        var rg = h("g", { opacity: 0 }, svg);
        h("line", { x1: 24, x2: 364, y1: y + 36, y2: y + 36, stroke: "rgba(143,166,176,0.14)" }, rg);
        tx(rg, 24, y + 21, name, "s-ui");
        var ev = h("g", { opacity: 0 }, rg);
        ["EPD", "HPD"].forEach(function (lbl, k) {
          h("rect", { x: 132 + k * 34, y: y + 10, width: 30, height: 14, rx: 3, fill: "none", stroke: "rgba(143,220,210,0.5)" }, ev);
          tx(ev, 147 + k * 34, y + 20.5, lbl, "s-chip", { "text-anchor": "middle", fill: C.soft });
        });
        var cells = V[i].map(function (code, c) {
          var cx = 216 + c * 52;
          var cg = h("g", null, rg);
          var box = h("rect", { x: cx, y: y + 7, width: 40, height: 22, rx: 6, fill: "none", stroke: "rgba(143,166,176,0.3)" }, cg);
          var mark = h("g", { opacity: 0 }, cg);
          var mx = cx + 20, my = y + 18;
          if (code === "p") h("path", { d: "M" + (mx - 5) + " " + my + " l3.5 3.5 6.5-7", fill: "none", stroke: "#fff", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round" }, mark);
          if (code === "a") h("path", { d: "M" + (mx - 5) + " " + my + " h10", stroke: "#1b1b1b", "stroke-width": 2, "stroke-linecap": "round" }, mark);
          if (code === "g") tx(mark, mx, my + 4, "?", "s-ui", { "text-anchor": "middle", fill: "#fff" });
          if (code === "f") h("path", { d: "M" + (mx - 4) + " " + (my - 4) + " l8 8 M" + (mx + 4) + " " + (my - 4) + " l-8 8", stroke: "#fff", "stroke-width": 1.8, "stroke-linecap": "round" }, mark);
          return { box: box, mark: mark, code: code };
        });
        return { g: rg, ev: ev, cells: cells, y: y };
      });
      // gaps panel
      h("rect", { x: 392, y: 20, width: 188, height: 335, rx: 12, fill: C.panel, stroke: C.line }, svg);
      tx(svg, 408, 44, "VERDICTS", "s-mono");
      var totals = { p: 0, a: 0, g: 0, f: 0 };
      V.forEach(function (r) { r.forEach(function (c) { totals[c]++; }); });
      var segs = [];
      var sx = 408;
      ["p", "a", "g", "f"].forEach(function (k) {
        var w = (totals[k] / 21) * 156;
        segs.push({ el: h("rect", { x: sx, y: 56, width: 0, height: 10, fill: col[k] }, svg), w: w, x: sx });
        sx += w;
      });
      var legend = h("g", { opacity: 0 }, svg);
      [["p", "PASS"], ["a", "PARTIAL"], ["g", "GAP"], ["f", "FAIL"]].forEach(function (l, i) {
        var lx = 408 + (i % 2) * 80, ly = 86 + Math.floor(i / 2) * 18;
        h("rect", { x: lx, y: ly - 7, width: 8, height: 8, rx: 2, fill: col[l[0]] }, legend);
        tx(legend, lx + 14, ly, l[1] + " " + totals[l[0]], "s-chip", { fill: C.text });
      });
      tx(svg, 408, 142, "OPEN GAPS · RANKED", "s-mono");
      var gaps = [["Spandrels", "Client brief"], ["Blades", "WELL v2"], ["Bird safety", "Client brief"], ["Expressed frame", "Client brief"]].map(function (g, i) {
        var gg = h("g", { opacity: 0 }, svg);
        var y = 156 + i * 46;
        h("rect", { x: 404, y: y, width: 164, height: 38, rx: 7, fill: C.panel2, stroke: C.line }, gg);
        tx(gg, 416, y + 16, "0" + (i + 1), "s-mono");
        tx(gg, 440, y + 16, g[0], "s-ui");
        tx(gg, 440, y + 30, g[1].toUpperCase(), "s-chip", { fill: C.mist });
        return gg;
      });
      return function (t) {
        var fade = 1 - P(t, 9.8, 10.4, E.inOut);
        rows.forEach(function (r, i) {
          op(r.g, P(t, 0.1 + i * 0.1, 0.5 + i * 0.1) * fade);
          op(r.ev, P(t, 0.8 + i * 0.12, 1.1 + i * 0.12) * (1 - P(t, 5.6, 6.0) * 0.6));
          r.cells.forEach(function (c, k) {
            var t0 = 1.9 + i * 0.48 + k * 0.12;
            var p = P(t, t0, t0 + 0.25);
            set(c.box, "fill", p > 0.5 ? col[c.code] : "none");
            set(c.box, "stroke", p > 0.5 ? col[c.code] : "rgba(143,166,176,0.3)");
            op(c.mark, p);
          });
        });
        var sy = 1.9 + Math.min(6, Math.floor(clamp((t - 1.9) / 0.48, 0, 6.99))) * 0.48;
        var row = Math.floor(clamp((t - 1.9) / 0.48, 0, 6.99));
        set(scan, "y", rows[row].y + 1);
        op(scan, t > 1.9 && t < 5.4 ? 1 : 0);
        var b = P(t, 5.6, 6.6, E.inOut);
        segs.forEach(function (s) {
          set(s.el, "width", (s.w * b * fade).toFixed(1));
        });
        op(legend, P(t, 6.2, 6.6) * fade);
        gaps.forEach(function (g, i) {
          var a = P(t, 6.8 + i * 0.3, 7.2 + i * 0.3);
          move(g, lerp(12, 0, a), 0);
          op(g, a * fade);
        });
        return sy;
      };
    },
  };

  /* 06 WorkNodesCanvas: references, analyses, deck */
  SCENES.worknodescanvas = {
    dur: 10.8,
    still: 8.8,
    beats: [[0, 0], [3.0, 1], [5.8, 2]],
    init: function (stage) {
      var st = svgStage(stage, 600, 375, "wn");
      var svg = st.svg;
      var wires = h("g", null, svg);
      function node(x, y, w, hh, title, kind) {
        var g = h("g", { opacity: 0 }, svg);
        h("rect", { x: x, y: y, width: w, height: hh, rx: 9, fill: C.panel, stroke: C.line }, g);
        h("rect", { x: x, y: y, width: w, height: 3, rx: 1.5, fill: kind === "a" ? C.mint : kind === "p" ? C.sky : C.soft }, g);
        tx(g, x + 12, y + 22, title, "s-ui");
        return g;
      }
      // references
      var refs = [
        { x: 20, y: 34, title: "Building survey" },
        { x: 20, y: 146, title: "Workshop notes" },
        { x: 20, y: 258, title: "Energy use 2023–25" },
      ].map(function (r, i) {
        var g = node(r.x, r.y, 136, 84, r.title, "r");
        if (i === 0) { h("rect", { x: r.x + 12, y: r.y + 32, width: 30, height: 40, rx: 2, fill: "none", stroke: "rgba(143,166,176,0.45)" }, g); for (var k = 0; k < 4; k++) h("rect", { x: r.x + 50, y: r.y + 36 + k * 9, width: 70 - k * 9, height: 3.5, rx: 1.7, fill: "rgba(143,166,176,0.35)" }, g); }
        if (i === 1) for (var m = 0; m < 5; m++) h("rect", { x: r.x + 12, y: r.y + 34 + m * 8, width: 108 - (m % 3) * 18, height: 3.5, rx: 1.7, fill: "rgba(143,166,176,0.35)" }, g);
        if (i === 2) for (var n = 0; n < 9; n++) { var bh = 8 + ((n * 7) % 26); h("rect", { x: r.x + 14 + n * 12, y: r.y + 74 - bh, width: 7, height: bh, rx: 1.5, fill: "rgba(143,220,210,0.55)" }, g); }
        return { g: g, out: [r.x + 136, r.y + 42] };
      });
      // analyses
      var an = [
        { x: 214, y: 56, title: "Retrofit opportunities" },
        { x: 214, y: 212, title: "Stakeholder priorities" },
      ].map(function (a) {
        var g = node(a.x, a.y, 160, 112, a.title, "a");
        var run = h("rect", { x: a.x + 12, y: a.y + 32, width: 40, height: 18, rx: 5, fill: "none", stroke: C.mint }, g);
        var runT = tx(g, a.x + 32, a.y + 45, "Run", "s-chip", { "text-anchor": "middle", fill: C.mint });
        var spin = h("circle", { cx: a.x + 64, cy: a.y + 41, r: 5, fill: "none", stroke: C.mint, "stroke-width": 1.6, "stroke-dasharray": "18 40", opacity: 0 }, g);
        var lines = [0, 1, 2, 3].map(function (k) {
          return h("rect", { x: a.x + 12, y: a.y + 62 + k * 10, width: 0, height: 4, rx: 2, fill: k === 0 ? "rgba(230,238,240,0.8)" : "rgba(143,166,176,0.45)" }, g);
        });
        return { g: g, run: run, runT: runT, spin: spin, lines: lines, in: [a.x, a.y + 56], out: [a.x + 160, a.y + 56], cx: a.x + 64, cy: a.y + 41 };
      });
      // presentation
      var pres = node(432, 74, 150, 228, "Client update deck", "p");
      var tabs = ["PPTX", "DOCX", "HTML"].map(function (f, i) {
        var g = h("g", null, pres);
        var r = h("rect", { x: 444 + i * 44, y: 34 + 74, width: 40, height: 16, rx: 4, fill: "none", stroke: "rgba(143,166,176,0.35)" }, g);
        var tt = tx(g, 464 + i * 44, 34 + 74 + 11.5, f, "s-chip", { "text-anchor": "middle", fill: C.mist });
        return { r: r, t: tt };
      });
      var slides = [];
      for (var k = 0; k < 6; k++) {
        var sx = 444 + (k % 2) * 66, sy = 74 + 62 + Math.floor(k / 2) * 46;
        var sg = h("g", { opacity: 0 }, pres);
        h("rect", { x: sx, y: sy, width: 60, height: 38, rx: 3, fill: k === 0 ? "#0c1b24" : "#eef2f1", stroke: C.line }, sg);
        if (k === 0) h("rect", { x: sx + 6, y: sy + 24, width: 34, height: 4, rx: 2, fill: C.mint }, sg);
        else { h("rect", { x: sx + 6, y: sy + 7, width: 30, height: 3.5, rx: 1.7, fill: "#0c1b24" }, sg); h("rect", { x: sx + 6, y: sy + 15, width: 44 - k * 3, height: 12, rx: 2, fill: k % 2 ? "#9fdcd3" : "#c9d4d6" }, sg); }
        tx(sg, sx + 56, sy + 35, String(k + 1), "s-chip", { "text-anchor": "end", fill: k === 0 ? C.mist : "#4f626b" });
        slides.push(sg);
      }
      var dl = h("g", { opacity: 0 }, pres);
      h("rect", { x: 444, y: 74 + 200, width: 126, height: 18, rx: 9, fill: C.sky }, dl);
      tx(dl, 507, 74 + 212.5, "DOWNLOAD", "s-chip", { "text-anchor": "middle", fill: "#0c1b24" });

      function wire(a, b) {
        var dx = (b[0] - a[0]) * 0.5;
        var p = h("path", { d: "M" + a[0] + " " + a[1] + " C" + (a[0] + dx) + " " + a[1] + " " + (b[0] - dx) + " " + b[1] + " " + b[0] + " " + b[1], fill: "none", stroke: "rgba(143,220,210,0.55)", "stroke-width": 1.4 }, wires);
        var len = p.getTotalLength();
        set(p, "stroke-dasharray", len + " " + len);
        var pulse = h("circle", { r: 3, fill: C.mint, opacity: 0 }, svg);
        return { p: p, len: len, pulse: pulse };
      }
      var w1 = [wire(refs[0].out, an[0].in), wire(refs[2].out, an[0].in), wire(refs[1].out, an[1].in), wire(refs[0].out, an[1].in)];
      var w2 = [wire(an[0].out, [432, 150]), wire(an[1].out, [432, 220])];

      function runWires(ws, t, t0) {
        ws.forEach(function (w, i) {
          var d = P(t, t0 + i * 0.12, t0 + 0.7 + i * 0.12, E.inOut);
          set(w.p, "stroke-dashoffset", (w.len * (1 - d)).toFixed(1));
          var q = ((t - (t0 + 0.8 + i * 0.1)) / 0.9);
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
          set(r.g, "transform", "translate(" + (88 * (1 - a)).toFixed(1) * 0 + " " + (8 * (1 - a)).toFixed(1) + ")");
        });
        an.forEach(function (a, i) {
          op(a.g, P(t, 1.3 + i * 0.2, 1.7 + i * 0.2) * fade);
          var pressed = t > 3.9 + i * 0.25;
          set(a.run, "fill", pressed ? C.mint : "none");
          set(a.runT, "fill", pressed ? "#0c1b24" : C.mint);
          var spinning = t > 3.9 + i * 0.25 && t < 4.6 + i * 0.25;
          op(a.spin, spinning ? 1 : 0);
          set(a.spin, "transform", "rotate(" + ((t * 540) % 360).toFixed(0) + " " + a.cx + " " + a.cy + ")");
          a.lines.forEach(function (l, k) {
            var w = [128, 112, 120, 84][k];
            set(l, "width", (w * P(t, 4.6 + i * 0.25 + k * 0.16, 5.0 + i * 0.25 + k * 0.16)).toFixed(1));
          });
        });
        runWires(w1, t, 2.3);
        op(pres, P(t, 1.7, 2.1) * fade);
        runWires(w2, t, 5.6);
        slides.forEach(function (s, k) {
          var a = P(t, 6.8 + k * 0.2, 7.1 + k * 0.2, E.back);
          op(s, P(t, 6.8 + k * 0.2, 7.0 + k * 0.2));
          set(s, "transform", "translate(0 " + (6 * (1 - a)).toFixed(1) + ")");
        });
        var active = t < 7.6 ? -1 : t < 8.3 ? 0 : t < 9.0 ? 1 : 2;
        tabs.forEach(function (tb, i) {
          set(tb.r, "fill", i === active ? C.sky : "none");
          set(tb.r, "stroke", i === active ? C.sky : "rgba(143,166,176,0.35)");
          set(tb.t, "fill", i === active ? "#0c1b24" : C.mist);
        });
        op(dl, P(t, 8.0, 8.4));
      };
    },
  };

  /* 07 Southwark Retrofit Atlas: map, cost, fund (canvas) */
  SCENES["southwark-retrofit-atlas"] = {
    dur: 11.6,
    still: 9.6,
    beats: [[0, 0], [3.2, 1], [6.3, 2]],
    init: function (stage) {
      var cv = canvasStage(stage, 600, 375);
      var ctx = cv.ctx;
      // a simplified outline of the borough, river to the north
      var shape = [[54, 52], [96, 34], [150, 40], [204, 30], [250, 50], [268, 92], [258, 136], [246, 180], [238, 222], [222, 262], [204, 300], [182, 336], [160, 356], [142, 338], [130, 300], [116, 258], [96, 216], [78, 176], [60, 134], [48, 92]];
      function inside(x, y) {
        var c = false;
        for (var i = 0, j = shape.length - 1; i < shape.length; j = i++) {
          var xi = shape[i][0], yi = shape[i][1], xj = shape[j][0], yj = shape[j][1];
          if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
        }
        return c;
      }
      var r = rng(42);
      var pts = [];
      for (var y = 30; y < 360; y += 6.6) {
        for (var x = 40; x < 275; x += 6.6) {
          var jx = x + (r() - 0.5) * 3.4, jy = y + (r() - 0.5) * 3.4;
          if (!inside(jx, jy)) continue;
          var u = r();
          var band = u < 0.16 ? 0 : u < 0.62 ? 1 : u < 0.93 ? 2 : u < 0.98 ? 3 : 4;
          pts.push({ x: jx, y: jy, band: band, pr: r() });
        }
      }
      var below = pts.filter(function (p) { return p.band >= 2; });
      below.sort(function (a, b) { return b.band - a.band || a.pr - b.pr; });
      var funded = below.slice(0, 30);
      funded.sort(function (a, b) { return a.pr - b.pr; });
      funded.forEach(function (p, i) { p.fund = (i + 1) / funded.length; });
      var BAND = ["#1f9d68", "#7fbf4a", "#e5c23a", "#f0a35e", "#e2623f"];
      var LBL = ["A–B", "C", "D", "E", "F–G"];

      return function (t) {
        cv.begin();
        var fade = 1 - P(t, 10.8, 11.4, E.inOut);
        var b2 = P(t, 3.2, 3.8);
        var slider = P(t, 6.7, 8.9, E.inOut);
        // river edge
        ctx.strokeStyle = "rgba(89,199,252,0.35)";
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(30, 44); ctx.bezierCurveTo(80, 18, 150, 30, 204, 18); ctx.bezierCurveTo(240, 10, 270, 30, 292, 26); ctx.stroke();
        ctx.lineCap = "butt";
        for (var i = 0; i < pts.length; i++) {
          var p = pts[i];
          var a = P(t, 0.2 + (p.y / 360) * 1.8, 0.6 + (p.y / 360) * 1.8);
          if (a <= 0) continue;
          var alpha = a * fade;
          var rad = 2.1;
          if (p.band < 2) alpha *= 1 - 0.55 * b2;
          else rad = 2.1 + 0.6 * b2 * (t < 6.3 ? 0.5 + 0.5 * Math.sin(t * 5 + p.pr * 6) : 0.4);
          var isFunded = p.fund !== undefined && slider >= p.fund;
          ctx.globalAlpha = alpha;
          ctx.fillStyle = isFunded ? C.mint : BAND[p.band];
          ctx.beginPath(); ctx.arc(p.x, p.y, isFunded ? 2.8 : rad, 0, Math.PI * 2); ctx.fill();
          if (isFunded) {
            var ring = clamp((slider - p.fund) * 8, 0, 1);
            ctx.globalAlpha = (1 - ring) * fade;
            ctx.strokeStyle = C.mint;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3 + ring * 9, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.9 * fade;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4.6, 0, Math.PI * 2); ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;

        // panel
        var px = 312;
        ctx.fillStyle = C.panel;
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 1;
        roundRect(ctx, px, 20, 268, 335, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.soft;
        ctx.font = font(9.5, "mono", 500);
        spaced(ctx, "LONDON BOROUGH OF SOUTHWARK", px + 16, 44, 1.1);
        ctx.globalAlpha = fade;
        ctx.fillStyle = "#fff";
        ctx.font = font(36, "serif", 400);
        ctx.fillText(fmt(149062 * P(t, 0.3, 2.2, E.inOut)), px + 16, 92);
        ctx.fillStyle = C.mist;
        ctx.font = font(9.5, "mono", 500);
        spaced(ctx, "HOMES BY EPC BAND TODAY", px + 16, 110, 1.1);
        for (var k = 0; k < 5; k++) {
          var lx = px + 16 + k * 48;
          ctx.globalAlpha = P(t, 1.2 + k * 0.1, 1.5 + k * 0.1) * fade * (k < 2 ? 1 - 0.5 * b2 : 1);
          ctx.fillStyle = BAND[k];
          roundRect(ctx, lx, 124, 10, 10, 2.5); ctx.fill();
          ctx.fillStyle = C.text;
          ctx.font = font(10, "mono", 500);
          ctx.fillText(LBL[k], lx + 15, 133);
        }
        // beat 2 and 3 share the lower half of the panel
        var b3 = P(t, 6.3, 6.8);
        ctx.globalAlpha = b2 * (1 - b3) * fade;
        ctx.fillStyle = "rgba(143,166,176,0.2)";
        ctx.fillRect(px + 16, 156, 236, 1);
        ctx.fillStyle = "#fff";
        ctx.font = font(30, "serif", 400);
        ctx.fillText(fmt(56873 * P(t, 3.3, 4.6, E.inOut)), px + 16, 200);
        ctx.fillStyle = C.mist;
        ctx.font = font(9.5, "mono", 500);
        spaced(ctx, "HOMES BELOW EPC C", px + 16, 218, 1.1);
        ctx.globalAlpha = P(t, 4.4, 4.9) * (1 - b3) * fade;
        ctx.fillStyle = "#fff";
        ctx.font = font(30, "serif", 400);
        ctx.fillText("£570m", px + 16, 266);
        ctx.fillStyle = C.mist;
        ctx.font = font(9.5, "mono", 500);
        spaced(ctx, "TO LIFT EACH HOME TO ITS", px + 16, 284, 1.1);
        spaced(ctx, "REACHABLE BAND", px + 16, 298, 1.1);

        ctx.globalAlpha = b3 * fade;
        ctx.fillStyle = "rgba(143,166,176,0.2)";
        ctx.fillRect(px + 16, 156, 236, 1);
        ctx.fillStyle = C.mist;
        ctx.font = font(9.5, "mono", 500);
        spaced(ctx, "BUDGET, NET OF GRANT", px + 16, 180, 1.1);
        ctx.fillStyle = "#fff";
        ctx.font = font(32, "serif", 400);
        ctx.fillText("£" + (47 * slider).toFixed(1) + "m", px + 16, 216);
        ctx.fillStyle = "rgba(143,166,176,0.3)";
        roundRect(ctx, px + 16, 230, 236, 4, 2); ctx.fill();
        ctx.fillStyle = C.mint;
        roundRect(ctx, px + 16, 230, Math.max(4, 236 * slider), 4, 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 16 + 236 * slider, 232, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
        ctx.strokeStyle = C.mint; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = font(26, "serif", 400);
        ctx.fillText(fmt(4079 * slider), px + 16, 280);
        ctx.fillText((6.6 * slider).toFixed(1) + " kt", px + 140, 280);
        ctx.fillStyle = C.mist;
        ctx.font = font(9.5, "mono", 500);
        spaced(ctx, "HOMES FUNDED", px + 16, 298, 1.1);
        spaced(ctx, "CO2E SAVED A YEAR", px + 140, 298, 1.1);
        ctx.globalAlpha = 1;
      };
    },
  };

  /* 03 ModelChat: the featured story, an isometric model beside a live chat */
  SCENES.modelchat = {
    dur: 16.4,
    still: 6.4,
    beats: [[0, 0], [2.7, 1], [3.6, 2], [8.3, 0], [10.3, 1], [10.9, 2]],
    init: function (stage) {
      var viewer = stage.querySelector(".mc__viewer");
      var chat = stage.querySelector(".mc__log");
      var st = svgStage(viewer, 560, 420, "mc");
      var svg = st.svg;
      var cam = h("g", null, svg);
      var L = 260, W = 90, FH = 13, FLOORS = 10, OX = 206, OY = 184;
      function iso(x, y, z) {
        return [OX + (x - y) * 0.866, OY + (x + y) * 0.5 - z];
      }
      function pts(arr) {
        return arr.map(function (p) { var q = iso(p[0], p[1], p[2]); return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
      }
      // ground grid
      var grid = h("g", { stroke: "rgba(143,166,176,0.13)", "stroke-width": 0.8 }, cam);
      for (var gx = -78; gx <= 338; gx += 52) h("polyline", { points: pts([[gx, -45, 0], [gx, 135, 0]]), fill: "none" }, grid);
      for (var gy = -45; gy <= 135; gy += 45) h("polyline", { points: pts([[-78, gy, 0], [338, gy, 0]]), fill: "none" }, grid);
      var floors = [];
      for (var k = 0; k < FLOORS; k++) {
        var z0 = k * FH, z1 = z0 + FH - 3;
        var g = h("g", null, cam);
        var left = h("polygon", { points: pts([[0, W, z0], [L, W, z0], [L, W, z1], [0, W, z1]]), fill: "rgba(89,199,252,0.14)", stroke: "rgba(143,220,210,0.45)", "stroke-width": 0.8 }, g);
        var right = h("polygon", { points: pts([[L, 0, z0], [L, W, z0], [L, W, z1], [L, 0, z1]]), fill: "rgba(89,199,252,0.08)", stroke: "rgba(143,220,210,0.45)", "stroke-width": 0.8 }, g);
        var mull = h("g", { stroke: "rgba(143,220,210,0.22)", "stroke-width": 0.6 }, g);
        for (var mx = 26; mx < L; mx += 26) h("polyline", { points: pts([[mx, W, z0], [mx, W, z1]]), fill: "none" }, mull);
        for (var my = 22.5; my < W; my += 22.5) h("polyline", { points: pts([[L, my, z0], [L, my, z1]]), fill: "none" }, mull);
        var top = h("polygon", { points: pts([[0, 0, z1], [L, 0, z1], [L, W, z1], [0, W, z1]]), fill: k === FLOORS - 1 ? "rgba(143,220,210,0.18)" : "rgba(143,220,210,0.0)", stroke: "rgba(143,220,210,0.5)", "stroke-width": 0.8 }, g);
        var slab = h("polyline", { points: pts([[0, W, z0], [L, W, z0], [L, 0, z0]]), fill: "none", stroke: "rgba(230,238,240,0.5)", "stroke-width": 1 }, g);
        floors.push({ g: g, left: left, right: right, top: top, mull: mull, slab: slab, k: k });
      }
      var cols = h("g", { stroke: C.mint, "stroke-width": 1.4, "stroke-linecap": "round", opacity: 0 }, cam);
      var colLines = [];
      for (var f = 0; f < FLOORS; f++) {
        for (var cx = 0; cx <= L; cx += 52) {
          for (var cy = 0; cy <= W; cy += 45) {
            colLines.push({ el: h("polyline", { points: pts([[cx, cy, f * FH], [cx, cy, f * FH + FH - 3]]), fill: "none" }, cols), f: f });
          }
        }
      }
      var label = h("g", { opacity: 0 }, svg);
      var lp = iso(L, W, 3 * FH + 5);
      h("circle", { cx: 0, cy: 0, r: 2.5, fill: C.mint }, label);
      h("polyline", { points: "0,0 26,24 118,24", fill: "none", stroke: C.mint }, label);
      var area = tx(label, 30, 18, "", "s-num-sm");
      tx(label, 30, 40, "LEVEL 03 · GFA", "s-mono");
      var colLabel = h("g", { opacity: 0 }, svg);
      var colCount = tx(colLabel, 24, 52, "", "s-num");
      tx(colLabel, 24, 72, "COLUMNS · 10 STOREYS", "s-mono");
      tx(svg, 24, 404, "TIMBER OFFICE · IFC4 · 10,600 ELEMENTS", "s-mono s-dim");

      // chat messages
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
      var a1 = msg("mc__answer", 'Level 03 has a gross floor area of about <b data-n="3621">0</b> m². The floor is isolated and the camera is fitted to it.');
      var u2 = msg("mc__user"), t2 = tools(["query_index", "isolate", "focus_camera"]);
      var a2 = msg("mc__answer", 'The viewer now shows only the columns, all <b data-n="340">0</b> of them across the building.');
      var n1 = a1.querySelector("b"), n2 = a2.querySelector("b");
      function show(el, v, dy) {
        el.style.opacity = v.toFixed(3);
        el.style.transform = "translateY(" + ((1 - v) * (dy || 8)).toFixed(1) + "px)";
        el.style.display = v > 0.001 ? "" : "none";
      }
      function typing(el, s, p) {
        var n = Math.round(s.length * p);
        var v = s.slice(0, n) + (p > 0 && p < 1 ? "▍" : "");
        if (el.__t !== v) { el.__t = v; el.textContent = v; }
      }
      function toolState(rows, t0) {
        var box = rows[rows.length - 1];
        show(box, P(t0.t, t0.a, t0.a + 0.3));
        rows.slice(0, -1).forEach(function (row, i) {
          var a = t0.a + 0.15 + i * 0.32;
          row.style.opacity = P(t0.t, a, a + 0.2).toFixed(3);
          row.classList.toggle("is-done", t0.t > a + 0.28);
        });
      }
      var cxs = iso(L / 2, W / 2, 3 * FH + 5);

      return function (t) {
        var e1 = t < 8.0 ? 1 : 1 - P(t, 8.0, 8.3);
        var e2 = P(t, 8.3, 8.4) * (1 - P(t, 15.4, 15.9));
        // chat, exchange one
        show(u1, P(t, 0.2, 0.5) * e1);
        typing(u1, q1, P(t, 0.4, 2.4, E.lin));
        toolState(t1, { t: t, a: 2.7 });
        if (e1 < 1 || t < 2.7) show(t1[t1.length - 1], (t < 2.7 ? 0 : 1) * e1);
        show(a1, P(t, 4.9, 5.3) * e1);
        n1.textContent = fmt(3621 * P(t, 5.0, 6.0));
        // chat, exchange two
        show(u2, e2 * P(t, 8.3, 8.6));
        typing(u2, q2, P(t, 8.5, 10.1, E.lin));
        toolState(t2, { t: t, a: 10.3 });
        if (t < 10.3 || e2 < 1) show(t2[t2.length - 1], (t < 10.3 ? 0 : 1) * e2);
        show(a2, P(t, 12.0, 12.4) * e2);
        n2.textContent = fmt(340 * P(t, 12.1, 13.0));

        // viewer
        var iso1 = P(t, 3.6, 4.6, E.inOut) * (1 - P(t, 10.9, 11.6, E.inOut));
        var colsOn = P(t, 11.2, 12.2, E.inOut) * (1 - P(t, 15.3, 16.0, E.inOut));
        var zoom = 1 + 0.32 * iso1;
        set(cam, "transform", "translate(" + cxs[0].toFixed(1) + " " + cxs[1].toFixed(1) + ") scale(" + zoom.toFixed(3) + ") translate(" + (-cxs[0]).toFixed(1) + " " + (-cxs[1]).toFixed(1) + ")");
        floors.forEach(function (fl) {
          var isSel = fl.k === 3;
          var o = isSel ? 1 : 1 - 0.86 * iso1;
          o *= 1 - 0.9 * colsOn;
          op(fl.g, o);
          set(fl.left, "fill", isSel && iso1 > 0.5 ? "rgba(22,255,198,0.30)" : "rgba(89,199,252,0.14)");
          set(fl.right, "fill", isSel && iso1 > 0.5 ? "rgba(22,255,198,0.20)" : "rgba(89,199,252,0.08)");
          set(fl.top, "fill", isSel && iso1 > 0.5 ? "rgba(22,255,198,0.38)" : fl.k === FLOORS - 1 ? "rgba(143,220,210,0.18)" : "rgba(143,220,210,0)");
          set(fl.g, "transform", isSel ? "translate(0 " + (-6 * iso1).toFixed(2) + ")" : "");
        });
        op(cols, colsOn);
        colLines.forEach(function (c) {
          op(c.el, P(t, 11.2 + c.f * 0.08, 11.6 + c.f * 0.08));
        });
        var lx = cxs[0] + (lp[0] - cxs[0]) * zoom, ly = cxs[1] + (lp[1] - cxs[1] - 6 * iso1) * zoom;
        move(label, lx, ly);
        op(label, P(t, 4.6, 5.0) * (1 - P(t, 7.8, 8.2)));
        text(area, fmt(3621 * P(t, 4.7, 5.8)) + " m²");
        op(colLabel, P(t, 12.0, 12.4) * (1 - P(t, 15.3, 15.8)));
        text(colCount, fmt(340 * P(t, 12.1, 13.0)));
      };
    },
  };

  /* Engine: run each story only while it is on screen */
  function initStories() {
    var hosts = Array.prototype.slice.call(document.querySelectorAll("[data-story]"));
    if (!hosts.length) return;
    var live = [];
    hosts.forEach(function (host) {
      var def = SCENES[host.getAttribute("data-story")];
      if (!def) return;
      var stage = host.querySelector(".story__stage") || host;
      var beats = Array.prototype.slice.call((host.closest(".story-card") || host.parentNode).querySelectorAll(".beats > *"));
      var s = { host: host, def: def, render: null, stage: stage, beats: beats, visible: false, start: 0, t: 0, built: false };
      live.push(s);
      host.classList.add("is-live");
    });

    function build(s) {
      if (s.built) return;
      s.render = s.def.init(s.stage);
      s.built = true;
      // a resized canvas is cleared, so draw the current frame again
      if (s.stage.__canvasApi) s.stage.__canvasApi.redraw = function () { s.render(s.t); };
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
    function still(s) {
      build(s);
      s.t = s.def.still;
      s.render(s.t);
      beat(s, s.t);
    }

    if (reduce || !("IntersectionObserver" in window)) {
      live.forEach(still);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { live.forEach(still); });
      return;
    }

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
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    }
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          var s = live.filter(function (x) { return x.host === en.target; })[0];
          if (!s) return;
          if (en.isIntersecting) {
            build(s);
            if (!s.visible) s.start = performance.now() - s.t * 1000;
            s.visible = true;
          } else {
            s.visible = false;
          }
        });
        kick();
      },
      { threshold: 0.2 }
    );
    live.forEach(function (s) { io.observe(s.host); });
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        var now = performance.now();
        live.forEach(function (s) { s.start = now - s.t * 1000; });
        kick();
      }
    });

    // Lets a still frame be inspected: BakshiStories.at("modelchat", 5)
    window.BakshiStories = {
      at: function (slug, t) {
        live.forEach(function (s) {
          if (s.host.getAttribute("data-story") !== slug) return;
          build(s);
          s.visible = false;
          s.t = t;
          s.render(t);
          beat(s, t);
        });
      },
    };
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStories);
  else initStories();
})();
