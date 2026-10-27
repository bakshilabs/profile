/* Bakshi Labs: sustainable design workflow slides.
   Builds a 1600 × 900 stage from WORKFLOW_DECK, scales it to the window,
   lays out each featured workflow map on its grid, and handles the detail
   window, keyboard, swipe and full-screen navigation. The deck controls
   follow the agent workflow slides (agents.js). */

(function () {
  "use strict";

  var DECK = window.WORKFLOW_DECK;
  if (!DECK) return;

  var SVGNS = "http://www.w3.org/2000/svg";
  var touch = window.matchMedia("(hover: none)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Step kinds, in legend order. Names follow the source deck. */
  var KIND = {
    trigger: { name: "Trigger", tag: "Trigger", about: "This event starts the workflow." },
    source: { name: "Input", tag: "Input", about: "Claude draws on this input." },
    claude: { name: "Claude", tag: "Claude", about: "Claude does this step." },
    review: { name: "Person", tag: "Person", about: "A named person does this step or signs it off." },
    artifact: { name: "Work product", tag: "Work product", about: "This is a piece of work the workflow produces." },
    system: { name: "System", tag: "System", about: "This step runs in an outside system or with an outside body." },
    branch: { name: "Exception", tag: "Exception", about: "Work that does not pass the check goes down this path." },
    output: { name: "Outcome", tag: "Outcome", about: "This is where the workflow ends." }
  };
  var LEGEND = ["trigger", "source", "claude", "review", "artifact", "system", "branch", "output"];

  /* Line icons, 24 × 24, from the source deck's icon set. */
  var ICON = {
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>',
    inbox: '<path d="M3.5 13.5 6 5h12l2.5 8.5V19a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1z"/><path d="M3.5 13.5H8l1.4 2.5h5.2L18 13.5h2.5"/>',
    book: '<path d="M5 5.5A1.5 1.5 0 0 1 6.5 4H18v14.5H6.5A1.5 1.5 0 0 0 5 20z"/><path d="M5 18.5A1.5 1.5 0 0 1 6.5 17H18"/><path d="M8.5 8h6M8.5 11h6"/>',
    receipt: '<path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3L6 20.5z"/><path d="M9 8h6M9 11.5h6M9 15h4"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 16v-3M12 16v-7M16 16v-5"/>',
    gauge: '<path d="M4 16a8 8 0 0 1 16 0"/><path d="M12 16l4.5-3.5"/><circle cx="12" cy="16" r="1"/>',
    doc: '<path d="M6 3.5h7l5 5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M13 3.5V8.5h5"/><path d="M8.5 12.5h7M8.5 15.5h7M8.5 18h4"/>',
    docs: '<path d="M9 7.5h5l3.5 3.5V20a.5.5 0 0 1-.5.5H9a.5.5 0 0 1-.5-.5V8a.5.5 0 0 1 .5-.5z"/><path d="M14 7.5V11h3.5"/><path d="M6.5 5.5h5l3.5 3.5"/><path d="M11 14.5h4M11 17h4"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14 0 17M12 3.5c-2.6 2.6-2.6 14 0 17"/>',
    shield: '<path d="M12 3.5 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6z"/><path d="M9 12l2 2 4-4"/>',
    scale: '<path d="M12 4v16M6.5 20h11"/><path d="M12 6 5 8M12 6l7 2"/><path d="M5 8 2.6 13a2.4 2.4 0 0 0 4.8 0zM19 8l-2.4 5a2.4 2.4 0 0 0 4.8 0z"/>',
    person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c0-3.6 3-6 6.5-6s6.5 2.4 6.5 6"/>',
    people: '<circle cx="9" cy="8.5" r="2.7"/><path d="M3.6 19c0-3 2.4-5 5.4-5s5.4 2 5.4 5"/><path d="M15.5 6.6a2.7 2.7 0 0 1 0 5.3M17 19c0-2.4-.8-4.2-2.2-5.4"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.6 2.6L16 9.5"/>',
    flag: '<path d="M6 3.5v17"/><path d="M6 5h11l-2.4 3.4L17 12H6z"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12v6c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-6"/>',
    spark: '<path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    signoff: '<circle cx="10" cy="8" r="3.2"/><path d="M3.5 20c0-3.6 3-6 6.5-6 1.6 0 3 .5 4.1 1.3"/><path d="M15 18.5l2 2 4-4.5"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || ICON.doc) + "</svg>";
  }

  var deckEl = document.querySelector("[data-deck]");
  var frame = document.querySelector("[data-frame]");
  var stage = document.querySelector("[data-stage]");
  var dotsEl = document.querySelector("[data-dots]");
  var countEl = document.querySelector("[data-count]");
  var progress = document.querySelector("[data-progress]");
  var modal = document.querySelector("[data-modal]");
  var slides = [];
  var ids = [];
  var current = -1;
  var drawTimer = 0;
  var TOTAL = DECK.areas.length + 2;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function arrowSvg() {
    return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function slideShell(cls, n, label) {
    var s = el("section", "slide " + cls);
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", n + " of " + TOTAL + ": " + label);
    s.appendChild(el("div", "slide__grid"));
    return s;
  }
  function signers(area) {
    var seen = {}, out = [];
    area.map.nodes.forEach(function (n) {
      if (n.kind === "review" && n.tag && !seen[n.tag]) {
        seen[n.tag] = true;
        out.push(n.tag);
      }
    });
    return out;
  }

  /* ---------- Map layout (after the source deck's graph renderer) ---------- */

  var CANVAS = { W: 1472, H: 340 };
  var Z = {
    sourceW: 196, artifactW: 216, claudeW: 236, nodeW: 220, chipInset: 26, nodeInset: 28,
    sourceH: 44, artifactH: 56, artifactBareH: 42, claudeH: 90, nodeH: 88, rowInset: 14,
    portInset: 14, portStepY: 14, portStepX: 22, arrowGap: 3, loopRadius: 14,
    labelCharW: 7.4, labelPad: 20, labelH: 22, labelClear: 3
  };
  var NORMAL = { r: [1, 0], l: [-1, 0], t: [0, -1], b: [0, 1] };
  function clampY(y) {
    return Math.max(4, Math.min(CANVAS.H - 4, y));
  }
  function fx(n) {
    return +n.toFixed(1);
  }

  function layout(m) {
    var cols = m.grid.cols, rows = m.grid.rows;
    var colW = CANVAS.W / cols, rowH = CANVAS.H / rows;
    var L = {
      colW: colW,
      rowH: rowH,
      gx: function (c) { return (c + 0.5) * colW; },
      gy: function (r) { return (r + 0.5) * rowH; },
      nodes: {}
    };
    m.nodes.forEach(function (n) {
      var k = n.kind, w, h;
      if (k === "source") w = Math.min(Z.sourceW, colW - Z.chipInset);
      else if (k === "artifact") w = Math.min(Z.artifactW, colW - Z.chipInset);
      else if (k === "claude") w = Math.min(Z.claudeW, colW - Z.nodeInset);
      else w = Math.min(Z.nodeW, colW - Z.nodeInset);
      if (k === "source") h = Z.sourceH;
      else if (k === "artifact") h = n.sub ? Z.artifactH : Z.artifactBareH;
      else h = Math.min(k === "claude" ? Z.claudeH : Z.nodeH, rowH - Z.rowInset);
      var cx = L.gx(n.col), cy = L.gy(n.row);
      L.nodes[n.id] = { n: n, w: w, h: h, cx: cx, cy: cy, l: cx - w / 2, t: cy - h / 2 };
    });
    return L;
  }
  function anchor(N, side, off) {
    off = off || 0;
    if (side === "r") return [N.l + N.w, N.cy + off];
    if (side === "l") return [N.l, N.cy + off];
    if (side === "t") return [N.cx + off, N.t];
    return [N.cx + off, N.t + N.h];
  }
  function edgeSides(e, L) {
    var A = L.nodes[e.from], B = L.nodes[e.to];
    var dx = B.cx - A.cx, dy = B.cy - A.cy;
    var vertical = Math.abs(dx) < L.colW * 0.5;
    return {
      out: e.out || (vertical ? (dy > 0 ? "b" : "t") : dx > 0 ? "r" : "l"),
      inn: e["in"] || (vertical ? (dy > 0 ? "t" : "b") : dx > 0 ? "l" : "r")
    };
  }
  /* Spread the ports when several edges share one side of a node. */
  function assignPorts(list, L) {
    var groups = {};
    list.forEach(function (x) {
      [[x.e.from, x.e.to, x.out, "o0"], [x.e.to, x.e.from, x.inn, "o1"]].forEach(function (g) {
        var key = g[0] + "|" + g[2];
        (groups[key] = groups[key] || []).push({ x: x, other: g[1], end: g[3] });
      });
    });
    Object.keys(groups).forEach(function (key) {
      var g = groups[key];
      if (g.length < 2) return;
      var parts = key.split("|"), N = L.nodes[parts[0]], side = parts[1];
      var alongY = side === "l" || side === "r";
      g.sort(function (a, b) {
        return alongY ? L.nodes[a.other].cy - L.nodes[b.other].cy : L.nodes[a.other].cx - L.nodes[b.other].cx;
      });
      var lim = (alongY ? N.h : N.w) / 2 - Z.portInset;
      var step = Math.min(alongY ? Z.portStepY : Z.portStepX, (2 * lim) / (g.length - 1));
      var pos = g.map(function (m) {
        var o = L.nodes[m.other];
        return Math.max(-lim, Math.min(lim, 0.15 * (alongY ? o.cy - N.cy : o.cx - N.cx)));
      });
      for (var i = 1; i < pos.length; i++) pos[i] = Math.max(pos[i], pos[i - 1] + step);
      pos[pos.length - 1] = Math.min(pos[pos.length - 1], lim);
      for (var j = pos.length - 2; j >= 0; j--) pos[j] = Math.min(pos[j], pos[j + 1] - step);
      g.forEach(function (m, k) {
        m.x[m.end] = pos[k];
      });
    });
  }
  function rounded(pts, r) {
    var d = "M" + fx(pts[0][0]) + "," + fx(pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      var p = pts[i - 1], c = pts[i], n = pts[i + 1];
      var l1 = Math.hypot(c[0] - p[0], c[1] - p[1]), l2 = Math.hypot(n[0] - c[0], n[1] - c[1]);
      var rr = Math.min(r, l1 / 2, l2 / 2);
      var a = [c[0] + ((p[0] - c[0]) * rr) / l1, c[1] + ((p[1] - c[1]) * rr) / l1];
      var b = [c[0] + ((n[0] - c[0]) * rr) / l2, c[1] + ((n[1] - c[1]) * rr) / l2];
      d += " L" + fx(a[0]) + "," + fx(a[1]) + " Q" + fx(c[0]) + "," + fx(c[1]) + " " + fx(b[0]) + "," + fx(b[1]);
    }
    var last = pts[pts.length - 1];
    return d + " L" + fx(last[0]) + "," + fx(last[1]);
  }
  function edgePath(x, L) {
    var e = x.e, A = L.nodes[e.from], B = L.nodes[e.to];
    var p0 = anchor(A, x.out, x.o0);
    var q = anchor(B, x.inn, x.o1), nIn = NORMAL[x.inn];
    var p1 = [q[0] + nIn[0] * Z.arrowGap, q[1] + nIn[1] * Z.arrowGap];
    if (e.via !== undefined) {
      // Loop lanes stay a little inside the canvas, clear of the text above and the legend below.
      var y = Math.max(16, Math.min(CANVAS.H - 16, L.gy(e.via)));
      // A lane along the bottom carries its label nearer its end, clear of the compact controls.
      var f = y > CANVAS.H / 2 ? 0.6 : 0.5;
      return { d: rounded([p0, [p0[0], y], [p1[0], y], p1], Z.loopRadius), mid: [p0[0] + (p1[0] - p0[0]) * f, y] };
    }
    var nOut = NORMAL[x.out];
    var dist = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    var k = Math.max(26, dist * 0.42);
    // Keep the control points inside the canvas so no curve swings over the text above.
    var c1 = [p0[0] + nOut[0] * k, clampY(p0[1] + nOut[1] * k)];
    var c2 = [p1[0] + nIn[0] * k, clampY(p1[1] + nIn[1] * k)];
    var at = function (t) {
      return [0, 1].map(function (i) {
        return Math.pow(1 - t, 3) * p0[i] + 3 * Math.pow(1 - t, 2) * t * c1[i] + 3 * (1 - t) * t * t * c2[i] + Math.pow(t, 3) * p1[i];
      });
    };
    return {
      d: "M" + fx(p0[0]) + "," + fx(p0[1]) + " C" + fx(c1[0]) + "," + fx(c1[1]) + " " + fx(c2[0]) + "," + fx(c2[1]) + " " + fx(p1[0]) + "," + fx(p1[1]),
      mid: at(0.5),
      at: at
    };
  }
  /* Put an edge label at the first point along its curve that clears every node. */
  function placeLabel(x, L) {
    var w = x.e.label.length * Z.labelCharW + Z.labelPad, h = Z.labelH, c = Z.labelClear;
    function clear(p) {
      return Object.keys(L.nodes).every(function (id) {
        var N = L.nodes[id];
        return p[0] + w / 2 + c < N.l || p[0] - w / 2 - c > N.l + N.w || p[1] + h / 2 + c < N.t || p[1] - h / 2 - c > N.t + N.h;
      });
    }
    if (!x.at) return x.mid;
    var ts = [0.5, 0.42, 0.58, 0.34, 0.66, 0.26, 0.74, 0.18, 0.82];
    for (var i = 0; i < ts.length; i++) {
      var p = x.at(ts[i]);
      if (clear(p)) return p;
    }
    return x.mid;
  }
  function edgeStyle(e, L) {
    if (e.style) return e.style;
    if (e.via !== undefined) return "loop";
    if (L.nodes[e.from].n.kind === "source") return "feed";
    if (L.nodes[e.to].n.kind === "branch") return "exception";
    return "flow";
  }

  /* ---------- Slide builders ---------- */

  function buildCover() {
    var c = DECK.cover;
    var s = slideShell("slide--cover", 1, c.title);
    var left = el("div", "cover__copy");
    left.appendChild(el("p", "kicker rise", c.kicker));
    left.appendChild(el("h1", "cover__title rise", c.title));
    left.appendChild(el("p", "cover__lede rise", c.lede));
    var stats = el("div", "cover__stats rise");
    c.stats.forEach(function (st) {
      var d = el("div", "cover__stat");
      d.appendChild(el("b", null, st[0]));
      d.appendChild(el("span", null, st[1]));
      stats.appendChild(d);
    });
    left.appendChild(stats);
    var hint = el("p", "cover__hint rise");
    hint.innerHTML = "<kbd>←</kbd> <kbd>→</kbd> to move between slides · <kbd>F</kbd> for full screen";
    left.appendChild(hint);
    s.appendChild(left);

    var tiles = el("div", "cover__tiles");
    DECK.areas.forEach(function (a, i) {
      var t = el("button", "tile");
      t.type = "button";
      t.style.setProperty("--i", i);
      t.setAttribute("aria-label", "Go to " + a.name);
      t.appendChild(el("span", "tile__num", pad(i + 1)));
      t.appendChild(el("span", "tile__name", a.name));
      t.appendChild(el("span", "tile__tag", a.flows.length + " workflows"));
      var go1 = el("span", "tile__go");
      go1.innerHTML = arrowSvg();
      t.appendChild(go1);
      t.addEventListener("click", function () {
        go(i + 1);
      });
      tiles.appendChild(t);
    });
    s.appendChild(tiles);
    return s;
  }

  function buildArea(a, ai) {
    var s = slideShell("slide--area", ai + 2, a.name);
    var head = el("header", "slide__head");
    var hl = el("div", "slide__headl");
    hl.appendChild(el("p", "kicker rise", pad(ai + 1) + " · Practice area · " + a.flows.length + " workflows"));
    hl.appendChild(el("h2", "slide__title rise", a.name));
    head.appendChild(hl);
    var hr = el("div", "slide__headr");
    hr.appendChild(el("p", "slide__lede rise", a.lede));
    head.appendChild(hr);
    s.appendChild(head);

    /* Four workflows, each as a card sequence: today, pain point, with Claude, sign-off. */
    var flows = el("div", "flows");
    a.flows.forEach(function (f, i) {
      var b = el("button", "flow");
      b.type = "button";
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", "Workflow " + (i + 1) + ": " + f.before + ". Today: " + f.pain + ". With Claude: " + f.after + ". Sign-off: " + f.note + ". Open details.");
      var card = el("span", "flow__card");
      var today = el("span", "flow__today");
      var top = el("span", "flow__top");
      top.appendChild(el("span", "flow__num", pad(i + 1)));
      top.appendChild(el("span", "flow__lab", "Today"));
      today.appendChild(top);
      today.appendChild(el("span", "flow__before", f.before));
      var pain = el("span", "flow__pain");
      pain.innerHTML = icon("clock", "flow__ic");
      pain.appendChild(el("span", null, f.pain));
      today.appendChild(pain);
      card.appendChild(today);
      var arrow = el("span", "flow__arrow");
      arrow.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      card.appendChild(arrow);
      var withC = el("span", "flow__claude");
      var top2 = el("span", "flow__top");
      top2.appendChild(el("span", "flow__lab flow__lab--claude", "With Claude"));
      withC.appendChild(top2);
      withC.appendChild(el("span", "flow__after", f.after));
      var sign = el("span", "flow__sign");
      sign.innerHTML = icon("signoff", "flow__ic");
      sign.appendChild(el("span", null, f.note));
      withC.appendChild(sign);
      withC.appendChild(el("span", "flow__hint", touch.matches ? "Tap again for details" : "Click for details"));
      card.appendChild(withC);
      b.appendChild(card);
      b.addEventListener("click", function () {
        if (touch.matches && !b.classList.contains("is-picked")) {
          flows.querySelectorAll(".flow.is-picked").forEach(function (o) {
            o.classList.remove("is-picked");
          });
          b.classList.add("is-picked");
          return;
        }
        openFlow(a, i, b);
      });
      flows.appendChild(b);
    });
    s.appendChild(flows);

    /* The featured workflow, drawn as a map. */
    var m = a.map;
    var mh = el("div", "map__head rise");
    var mhl = el("div", "map__headl");
    mhl.appendChild(el("p", "map__eyebrow", "Featured workflow"));
    mhl.appendChild(el("h3", "map__title", m.title));
    mh.appendChild(mhl);
    mh.appendChild(el("p", "map__desc", m.desc + " " + m.note));
    s.appendChild(mh);

    var L = layout(m);
    var canvas = el("div", "canvas");
    var wires = svg("svg", { class: "wires", viewBox: "0 0 " + CANVAS.W + " " + CANVAS.H, width: CANVAS.W, height: CANVAS.H, "aria-hidden": "true" });
    canvas.appendChild(wires);

    var used = {};
    m.nodes.forEach(function (n, i) {
      used[n.kind] = true;
      canvas.appendChild(buildNode(a, L.nodes[n.id], i, canvas));
    });

    var list = m.edges.map(function (e) {
      var sd = edgeSides(e, L);
      return { e: e, s: edgeStyle(e, L), out: sd.out, inn: sd.inn };
    });
    assignPorts(list, L);
    var hasLoop = false;
    list.forEach(function (x, j) {
      var r = edgePath(x, L);
      if (x.s === "loop") hasLoop = true;
      var p = svg("path", { d: r.d, class: "wire wire--" + x.s, "data-a": x.e.from, "data-b": x.e.to });
      if (x.s === "flow" || x.s === "feed") p.setAttribute("pathLength", "1");
      p.style.setProperty("--j", j);
      wires.appendChild(p);
      addPulse(wires, r.d, x.e);
      if (x.e.label) {
        var at = placeLabel({ e: x.e, at: r.at, mid: r.mid }, L);
        var lab = el("span", "wire-label wire-label--" + x.s, x.e.label);
        lab.style.cssText = "left:" + fx(at[0]) + "px;top:" + fx(at[1]) + "px";
        lab.dataset.a = x.e.from;
        lab.dataset.b = x.e.to;
        canvas.appendChild(lab);
      }
    });
    s.appendChild(canvas);

    var foot = el("footer", "slide__foot");
    var legend = el("ul", "legend");
    LEGEND.forEach(function (k) {
      if (!used[k]) return;
      var li = el("li", "legend__item legend__item--" + k);
      li.appendChild(el("i"));
      li.appendChild(document.createTextNode(KIND[k].name));
      legend.appendChild(li);
    });
    if (hasLoop) {
      var lp = el("li", "legend__item legend__item--loop");
      lp.appendChild(el("i"));
      lp.appendChild(document.createTextNode("Loops back"));
      legend.appendChild(lp);
    }
    foot.appendChild(legend);
    foot.appendChild(el("p", "slide__help", touch.matches ? "Tap a card for more · Tap again for details" : "Hover over a card for more · Click for details"));
    s.appendChild(foot);
    return s;
  }

  function buildNode(a, N, i, canvas) {
    var n = N.n, kind = KIND[n.kind];
    var flip = n.kind !== "source" && n.kind !== "artifact";
    var b = el("button", "node node--" + n.kind + (flip ? " node--flip" : " node--chip") + (flip && N.h < 78 ? " node--short" : ""));
    b.type = "button";
    b.dataset.node = n.id;
    b.style.cssText = "left:" + fx(N.l) + "px;top:" + fx(N.t) + "px;width:" + fx(N.w) + "px;height:" + fx(N.h) + "px;--i:" + i;
    b.setAttribute("aria-label", n.label + ", " + (n.tag || kind.name) + (n.sub ? ". " + n.sub : "") + ". Open details.");
    if (flip) {
      var inner = el("span", "node__inner");
      var front = el("span", "node__face node__front");
      var top = el("span", "node__top");
      top.innerHTML = '<span class="node__badge">' + icon(n.kind === "claude" ? "spark" : n.icon || "person") + "</span>";
      top.appendChild(el("span", "node__kind", n.tag || kind.tag));
      front.appendChild(top);
      front.appendChild(el("span", "node__label", n.label));
      var back = el("span", "node__face node__back");
      back.appendChild(el("span", "node__btext", n.sub || kind.about));
      back.appendChild(el("span", "node__hint", touch.matches ? "Tap again for details" : "Click for details"));
      inner.appendChild(front);
      inner.appendChild(back);
      b.appendChild(inner);
    } else {
      var face = el("span", "node__face node__chipface");
      face.innerHTML = '<span class="node__badge">' + icon(n.icon || "doc") + "</span>";
      var txt = el("span", "node__txt");
      txt.appendChild(el("span", "node__label", n.label));
      if (n.sub) txt.appendChild(el("span", "node__sub", n.sub));
      face.appendChild(txt);
      b.appendChild(face);
    }
    b.addEventListener("click", function () {
      // On touch screens the first tap flips the card and the second opens it.
      if (touch.matches && !b.classList.contains("is-flipped")) {
        canvas.querySelectorAll(".node.is-flipped").forEach(function (o) {
          o.classList.remove("is-flipped");
        });
        b.classList.add("is-flipped");
        focusNode(canvas, n.id, true);
        return;
      }
      openNode(a, n, b);
    });
    b.addEventListener("mouseenter", function () {
      focusNode(canvas, n.id, true);
    });
    b.addEventListener("mouseleave", function () {
      focusNode(canvas, n.id, false);
    });
    b.addEventListener("focus", function () {
      focusNode(canvas, n.id, true);
    });
    b.addEventListener("blur", function () {
      focusNode(canvas, n.id, false);
    });
    return b;
  }

  /* One dot per wire, shown only while a linked card is in focus. */
  function addPulse(wires, d, e) {
    if (reduce) return;
    var c = svg("circle", { r: "4", class: "pulse", "data-a": e.from, "data-b": e.to });
    var m = svg("animateMotion", { dur: "1.6s", repeatCount: "indefinite", path: d });
    c.appendChild(m);
    wires.appendChild(c);
  }

  function focusNode(canvas, id, on) {
    canvas.classList.toggle("is-focus", on);
    var linked = {};
    linked[id] = true;
    canvas.querySelectorAll(".wire, .pulse, .wire-label").forEach(function (w) {
      var a = w.getAttribute("data-a"), b = w.getAttribute("data-b");
      var hot = on && (a === id || b === id);
      w.classList.toggle("is-hot", hot);
      if (hot) {
        linked[a] = true;
        linked[b] = true;
      }
    });
    canvas.querySelectorAll(".node").forEach(function (n) {
      n.classList.toggle("is-linked", on && !!linked[n.dataset.node]);
    });
  }

  function buildClose() {
    var c = DECK.close;
    var s = slideShell("slide--close", TOTAL, c.title);
    var head = el("header", "slide__head");
    var hl = el("div", "slide__headl");
    hl.appendChild(el("p", "kicker rise", c.kicker));
    hl.appendChild(el("h2", "slide__title rise", c.title));
    head.appendChild(hl);
    var hr = el("div", "slide__headr");
    hr.appendChild(el("p", "slide__lede rise", c.lede));
    head.appendChild(hr);
    s.appendChild(head);

    var grid = el("div", "signs");
    DECK.areas.forEach(function (a, i) {
      var t = el("button", "sign");
      t.type = "button";
      t.style.setProperty("--i", i);
      t.setAttribute("aria-label", a.name + ". " + a.map.note + " Go to the slide.");
      var top = el("span", "sign__top");
      top.appendChild(el("span", "sign__num", pad(i + 1)));
      var go1 = el("span", "sign__go");
      go1.innerHTML = arrowSvg();
      top.appendChild(go1);
      t.appendChild(top);
      t.appendChild(el("span", "sign__name", a.name));
      var who = el("span", "sign__who");
      signers(a).forEach(function (p) {
        var chip = el("span", "sign__chip");
        chip.innerHTML = icon("signoff", "flow__ic");
        chip.appendChild(document.createTextNode(p));
        who.appendChild(chip);
      });
      t.appendChild(who);
      t.appendChild(el("span", "sign__note", a.map.note));
      t.appendChild(el("span", "sign__hint", "See the " + a.flows.length + " workflows"));
      t.addEventListener("click", function () {
        go(i + 1);
      });
      grid.appendChild(t);
    });
    s.appendChild(grid);
    return s;
  }

  /* ---------- Detail window ---------- */

  var lastFocus = null;
  var mKicker = modal.querySelector("[data-m-kicker]");
  var mTitle = modal.querySelector("[data-m-title]");
  var mBody = modal.querySelector("[data-m-body]");
  var mFacts = modal.querySelector("[data-m-facts]");
  var mLinks = modal.querySelector("[data-m-links]");
  var mLinksLabel = modal.querySelector("[data-m-links-label]");
  var mPanel = modal.querySelector(".modal__panel");

  function chip(cls, dir, text, via, onClick) {
    var li = el("li");
    var btn = el("button", "link-chip " + cls);
    btn.type = "button";
    if (dir) btn.appendChild(el("span", "link-chip__dir", dir));
    btn.appendChild(document.createTextNode(text));
    if (via) btn.appendChild(el("span", "link-chip__via", via));
    btn.addEventListener("click", onClick);
    li.appendChild(btn);
    return li;
  }

  function showModal(from) {
    if (modal.hidden) lastFocus = from || document.activeElement;
    mLinks.parentElement.hidden = !mLinks.children.length;
    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
    mPanel.scrollTop = 0;
    modal.querySelector("[data-close-btn]").focus();
  }

  function openFlow(a, i, from) {
    var f = a.flows[i];
    modal.className = "modal modal--flow";
    mKicker.textContent = a.name + " · Workflow " + pad(i + 1) + " of " + pad(a.flows.length);
    mTitle.textContent = f.before;
    mBody.textContent = "";
    var ol = el("ol", "msteps");
    [
      ["today", "Today", f.today],
      ["pain", "Pain point", f.painText],
      ["claude", "With Claude", f.withText],
      ["sign", "Human sign-off", f.signText]
    ].forEach(function (st) {
      var li = el("li", "mstep mstep--" + st[0]);
      li.appendChild(el("span", "mstep__lab", st[1]));
      li.appendChild(el("p", "mstep__text", st[2]));
      ol.appendChild(li);
    });
    mBody.appendChild(ol);
    mFacts.textContent = "";
    mFacts.hidden = true;
    mLinksLabel.textContent = "Other workflows in " + a.name;
    mLinks.textContent = "";
    a.flows.forEach(function (o, k) {
      if (k === i) return;
      mLinks.appendChild(chip("", pad(k + 1), o.before, null, function () {
        openFlow(a, k);
      }));
    });
    showModal(from);
  }

  function openNode(a, n, from) {
    var kind = KIND[n.kind];
    var m = a.map;
    modal.className = "modal modal--" + n.kind;
    mKicker.textContent = m.title + " · " + kind.name;
    mTitle.textContent = n.label;
    mBody.textContent = "";
    mBody.appendChild(el("p", null, kind.about));
    mFacts.textContent = "";
    var facts = [];
    if (n.sub) facts.push(["Detail", n.sub]);
    if (n.tag) facts.push([n.kind === "review" ? "Who" : "Where", n.tag]);
    facts.push(["Workflow", m.title + ", part of " + a.name]);
    facts.forEach(function (f) {
      var row = el("div", "facts__row");
      row.appendChild(el("dt", null, f[0]));
      row.appendChild(el("dd", null, f[1]));
      mFacts.appendChild(row);
    });
    mFacts.hidden = false;
    mLinksLabel.textContent = "Connected to";
    mLinks.textContent = "";
    var seen = {};
    m.edges.forEach(function (e) {
      var other = null, dir = "";
      if (e.from === n.id) {
        other = e.to;
        dir = "→";
      } else if (e.to === n.id) {
        other = e.from;
        dir = "←";
      }
      if (!other || seen[other + dir]) return;
      seen[other + dir] = true;
      var on = m.nodes.filter(function (x) {
        return x.id === other;
      })[0];
      mLinks.appendChild(chip("link-chip--" + on.kind, dir, on.label, e.label, function () {
        openNode(a, on);
      }));
    });
    showModal(from);
  }

  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove("is-open");
    setTimeout(function () {
      modal.hidden = true;
    }, reduce ? 0 : 220);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) closeModal();
  });
  modal.addEventListener("keydown", function (e) {
    if (e.key !== "Tab") return;
    var f = modal.querySelectorAll("button, [href]");
    var first = f[0], last = f[f.length - 1];
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
    slides.forEach(function (s, k) {
      s.classList.toggle("is-active", k === i);
      s.classList.toggle("is-before", k < i);
      s.classList.remove("is-drawn");
      s.setAttribute("aria-hidden", k === i ? "false" : "true");
      s.inert = k !== i;
      s.querySelectorAll(".is-flipped, .is-picked").forEach(function (o) {
        o.classList.remove("is-flipped", "is-picked");
      });
    });
    current = i;
    clearTimeout(drawTimer);
    drawTimer = setTimeout(function () {
      slides[i].classList.add("is-drawn");
    }, reduce ? 0 : 560);
    dotsEl.querySelectorAll("button").forEach(function (d, k) {
      d.classList.toggle("is-current", k === i);
      if (k === i) d.setAttribute("aria-current", "step");
      else d.removeAttribute("aria-current");
    });
    countEl.textContent = pad(i + 1) + " / " + pad(slides.length);
    progress.style.transform = "scaleX(" + (i + 1) / slides.length + ")";
    document.querySelector("[data-prev]").disabled = i === 0;
    document.querySelector("[data-next]").disabled = i === slides.length - 1;
    var hash = i === 0 ? "" : "#" + ids[i];
    if (!fromHash && location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  }

  /* Shrink a text a little, when needed, so the card shows it whole. */
  function fitText() {
    stage.querySelectorAll(".node--flip .node__face, .node__chipface, .flow__today, .flow__claude").forEach(function (face) {
      var texts = face.querySelectorAll(".node__label, .node__btext, .node__sub, .flow__before, .flow__after, .flow__pain span, .flow__sign span");
      texts.forEach(function (t) {
        t.style.fontSize = "";
      });
      var guard = 0;
      while (face.scrollHeight > face.clientHeight + 1 && guard++ < 12) {
        texts.forEach(function (t) {
          var size = parseFloat(getComputedStyle(t).fontSize);
          if (size > 12.5) t.style.fontSize = size - 0.5 + "px";
        });
      }
    });
  }

  function fit() {
    var bar = document.querySelector(".deck__bar");
    var full = deckEl.classList.contains("is-full");
    // On laptop-height screens the controls sit over the slide's corner.
    // Short landscape screens (phones on their side) stack the controls beside the slide.
    var side = window.innerHeight < 500 && window.innerWidth > window.innerHeight;
    var compact = !side && window.innerWidth >= 900 && (full || window.innerHeight < 940);
    deckEl.classList.toggle("is-compact", compact);
    deckEl.classList.toggle("is-side", side);
    var navEl = document.querySelector(".nav");
    var navH = full || getComputedStyle(navEl).display === "none" ? 0 : navEl.offsetHeight;
    var gutter = window.innerWidth < 700 ? 12 : compact ? 16 : 32;
    var availW = window.innerWidth - gutter * 2 - (side ? bar.offsetWidth + 10 : 0);
    var availH = window.innerHeight - navH - (compact || side ? 0 : bar.offsetHeight) - gutter * (compact || side ? 1 : 1.5);
    var scale = Math.max(0.1, Math.min(availW / 1600, availH / 900));
    frame.style.width = 1600 * scale + "px";
    frame.style.height = 900 * scale + "px";
    stage.style.transform = "scale(" + scale + ")";
  }

  function fromHash() {
    var id = location.hash.slice(1);
    if (/^\d+$/.test(id)) return Math.max(0, Math.min(slides.length - 1, parseInt(id, 10) - 1));
    var k = ids.indexOf(id);
    return k > 0 ? k : 0;
  }

  /* ---------- Build ---------- */

  slides.push(buildCover());
  ids.push("");
  DECK.areas.forEach(function (a, i) {
    slides.push(buildArea(a, i));
    ids.push(a.id);
  });
  slides.push(buildClose());
  ids.push(DECK.close.id);
  slides.forEach(function (s) {
    stage.appendChild(s);
  });

  var names = ["Overview"].concat(DECK.areas.map(function (a) {
    return a.short;
  }), [DECK.close.short]);
  names.forEach(function (name, i) {
    var d = el("button", "dot");
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

  var fullBtn = document.querySelector("[data-full]");
  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (deckEl.requestFullscreen) deckEl.requestFullscreen().catch(function () {});
  }
  if (!document.fullscreenEnabled) fullBtn.hidden = true;
  fullBtn.addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", function () {
    var on = document.fullscreenElement === deckEl;
    deckEl.classList.toggle("is-full", on);
    fullBtn.setAttribute("aria-pressed", on ? "true" : "false");
    fit();
  });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (!modal.hidden) {
      if (e.key === "Escape") closeModal();
      return;
    }
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "ArrowRight" || e.key === "PageDown") {
      e.preventDefault();
      go(current + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      go(current - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(slides.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFull();
    } else if (/^[0-9]$/.test(e.key)) {
      // 1 to 9 open those slides, and 0 opens the tenth.
      go(e.key === "0" ? 9 : parseInt(e.key, 10) - 1);
    }
  });

  var sx = null, sy = null;
  frame.addEventListener("pointerdown", function (e) {
    if (e.pointerType === "mouse") return;
    sx = e.clientX;
    sy = e.clientY;
  });
  frame.addEventListener("pointerup", function (e) {
    if (sx == null) return;
    var dx = e.clientX - sx, dy = e.clientY - sy;
    sx = sy = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(current + (dx < 0 ? 1 : -1));
  });

  window.addEventListener("resize", fit);
  window.addEventListener("hashchange", function () {
    go(fromHash(), true);
  });

  /* Navigation toggle on narrow screens, as on the main page. */
  var nav = document.querySelector("[data-nav]");
  var toggle = document.querySelector("[data-nav-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.documentElement.classList.add("js");
  fit();
  go(fromHash(), true);
  fitText();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      fit();
      fitText();
    });
  }
})();
