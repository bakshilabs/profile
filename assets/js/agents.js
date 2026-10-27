/* Bakshi Labs: agent workflow slides.
   Builds a 1600 × 900 stage from AGENT_DECK, scales it to the window, routes
   the connectors between cards and handles flipping, the detail window,
   keyboard, swipe and full-screen navigation. */

(function () {
  "use strict";

  var DECK = window.AGENT_DECK;
  if (!DECK) return;

  var KINDS = {
    agent: { label: "Agent", cls: "agent" },
    build: { label: "Build agent", cls: "agent" },
    sub: { label: "Subagent", cls: "agent" },
    maybe: { label: "Possible agent", cls: "maybe" },
    code: { label: "Code step", cls: "code" },
    tool: { label: "Tool server", cls: "code" },
    data: { label: "Data", cls: "data" },
    doc: { label: "Contract", cls: "data" },
    ui: { label: "Interface", cls: "ui" },
    ext: { label: "External source", cls: "ext" },
    out: { label: "Output", cls: "out" }
  };
  var LEGEND = [
    ["agent", "Agent"],
    ["maybe", "Possible agent"],
    ["code", "Code step"],
    ["data", "Data"],
    ["ui", "Interface"],
    ["ext", "External source"],
    ["out", "Output"]
  ];
  var SVGNS = "http://www.w3.org/2000/svg";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var deckEl = document.querySelector("[data-deck]");
  var frame = document.querySelector("[data-frame]");
  var stage = document.querySelector("[data-stage]");
  var dotsEl = document.querySelector("[data-dots]");
  var countEl = document.querySelector("[data-count]");
  var progress = document.querySelector("[data-progress]");
  var modal = document.querySelector("[data-modal]");
  var slides = [];
  var current = -1;
  var drawTimer = 0;

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

  /* ---------- Connector routing ---------- */

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
    var sides = autoSides(a, b);
    var fs = o.fs || sides[0];
    var ts = o.ts || sides[1];
    var S = sidePoint(a, fs, o.fo != null ? o.fo : 0.5);
    var E = sidePoint(b, ts, o.tf != null ? o.tf : 0.5);
    var pts;
    if (o.fo == null && o.tf == null) {
      // Run straight across when the two cards overlap on that axis.
      if (!isH(fs) && !isH(ts)) {
        if (S[0] > b.x + 14 && S[0] < b.x + b.w - 14) E[0] = S[0];
        else if (E[0] > a.x + 14 && E[0] < a.x + a.w - 14) S[0] = E[0];
      } else if (isH(fs) && isH(ts)) {
        if (S[1] > b.y + 14 && S[1] < b.y + b.h - 14) E[1] = S[1];
        else if (E[1] > a.y + 14 && E[1] < a.y + a.h - 14) S[1] = E[1];
      }
    }
    if (isH(fs) && isH(ts)) {
      var mx = o.mid != null ? o.mid : (S[0] + E[0]) / 2;
      pts = [S, [mx, S[1]], [mx, E[1]], E];
    } else if (!isH(fs) && !isH(ts)) {
      var my = o.mid != null ? o.mid : (S[1] + E[1]) / 2;
      pts = [S, [S[0], my], [E[0], my], E];
    } else if (isH(fs)) {
      pts = [S, [E[0], S[1]], E];
    } else {
      pts = [S, [S[0], E[1]], E];
    }
    return clean(pts);
  }
  function clean(pts) {
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var p = pts[i], q = out[out.length - 1];
      if (Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5) continue;
      out.push(p);
    }
    var res = [out[0]];
    for (var j = 1; j < out.length - 1; j++) {
      var a = res[res.length - 1], b = out[j], c = out[j + 1];
      var colinear = (Math.abs(a[0] - b[0]) < 0.5 && Math.abs(b[0] - c[0]) < 0.5) || (Math.abs(a[1] - b[1]) < 0.5 && Math.abs(b[1] - c[1]) < 0.5);
      if (!colinear) res.push(b);
    }
    res.push(out[out.length - 1]);
    return res;
  }
  function pathD(p) {
    var d = "M" + p[0][0] + " " + p[0][1];
    for (var i = 1; i < p.length - 1; i++) {
      var x0 = p[i - 1][0], y0 = p[i - 1][1], x1 = p[i][0], y1 = p[i][1], x2 = p[i + 1][0], y2 = p[i + 1][1];
      var l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
      var r = Math.min(12, l1 / 2, l2 / 2);
      var ax = x1 + ((x0 - x1) / l1) * r, ay = y1 + ((y0 - y1) / l1) * r;
      var bx = x1 + ((x2 - x1) / l2) * r, by = y1 + ((y2 - y1) / l2) * r;
      d += " L" + ax + " " + ay + " Q" + x1 + " " + y1 + " " + bx + " " + by;
    }
    var last = p[p.length - 1];
    return d + " L" + last[0] + " " + last[1];
  }
  function labelPoint(p) {
    var best = 0, at = [p[0][0], p[0][1]];
    for (var i = 1; i < p.length; i++) {
      var len = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (len > best) {
        best = len;
        at = [(p[i][0] + p[i - 1][0]) / 2, (p[i][1] + p[i - 1][1]) / 2];
      }
    }
    return at;
  }
  function pathLength(p) {
    var t = 0;
    for (var i = 1; i < p.length; i++) t += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    return t;
  }

  /* ---------- Slide builders ---------- */

  function buildCover(index) {
    var c = DECK.cover;
    var s = el("section", "slide slide--cover");
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", "1 of " + (DECK.slides.length + 1) + ": " + c.title);
    s.appendChild(el("div", "slide__grid"));

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
    DECK.slides.forEach(function (sl, i) {
      var t = el("button", "tile");
      t.type = "button";
      t.style.setProperty("--i", i);
      t.appendChild(el("span", "tile__num", pad(i + 1)));
      t.appendChild(el("span", "tile__name", sl.app));
      t.appendChild(el("span", "tile__tag", sl.tag));
      var arrow = el("span", "tile__go");
      arrow.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      t.appendChild(arrow);
      t.addEventListener("click", function () {
        go(i + 1);
      });
      tiles.appendChild(t);
    });
    s.appendChild(tiles);
    return s;
  }

  function buildSlide(sl, index) {
    var s = el("section", "slide");
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", index + 1 + " of " + (DECK.slides.length + 1) + ": " + sl.title);
    s.appendChild(el("div", "slide__grid"));

    var head = el("header", "slide__head");
    var hl = el("div", "slide__headl");
    hl.appendChild(el("p", "kicker rise", sl.kicker));
    hl.appendChild(el("h2", "slide__title rise", sl.title));
    head.appendChild(hl);
    var hr = el("div", "slide__headr");
    hr.appendChild(el("p", "slide__lede rise", sl.lede));
    hr.appendChild(el("p", "slide__tag rise", sl.tag));
    head.appendChild(hr);
    s.appendChild(head);

    var canvas = el("div", "canvas");
    var wires = svg("svg", { class: "wires", viewBox: "0 0 1472 600", width: "1472", height: "600", "aria-hidden": "true" });
    canvas.appendChild(wires);

    (sl.groups || []).forEach(function (g) {
      var gr = el("div", "group");
      gr.style.cssText = "left:" + g.x + "px;top:" + g.y + "px;width:" + g.w + "px;height:" + g.h + "px";
      gr.appendChild(el("span", "group__label", g.t));
      canvas.appendChild(gr);
    });
    (sl.dividers || []).forEach(function (dv) {
      var d = el("div", "divider");
      d.style.left = dv.x + "px";
      d.appendChild(el("span", "divider__a", dv.a));
      d.appendChild(el("span", "divider__b", dv.b));
      canvas.appendChild(d);
    });
    (sl.lanes || []).forEach(function (ln) {
      var l = el("span", "lane", ln.t);
      l.style.left = ln.x + "px";
      l.style.top = ln.y + "px";
      canvas.appendChild(l);
    });

    var byId = {};
    var kindsUsed = {};
    sl.nodes.forEach(function (n, i) {
      byId[n.id] = n;
      var r = rect(sl, n);
      var kind = KINDS[n.k];
      kindsUsed[kind.cls] = true;
      var wide = r.w > 600;
      var b = el("button", "node node--" + kind.cls + (wide ? " node--wide" : "") + (sl.small ? " node--sm" : ""));
      b.type = "button";
      b.dataset.node = n.id;
      b.style.cssText = "left:" + r.x + "px;top:" + r.y + "px;width:" + r.w + "px;height:" + r.h + "px;--i:" + i;
      b.setAttribute("aria-label", n.n + ", " + kind.label + ". " + n.s + " Open details.");
      var inner = el("span", "node__inner");
      var front = el("span", "node__face node__front");
      var k = el("span", "node__kind");
      k.appendChild(el("i"));
      k.appendChild(document.createTextNode(kind.label));
      front.appendChild(k);
      front.appendChild(el("span", "node__name", n.n));
      front.appendChild(el("span", "node__short", n.s));
      var back = el("span", "node__face node__back");
      back.appendChild(el("span", "node__btext", n.b));
      back.appendChild(el("span", "node__hint", "Click for details"));
      inner.appendChild(front);
      inner.appendChild(back);
      b.appendChild(inner);
      b.addEventListener("click", function () {
        openModal(sl, n, b);
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
      canvas.appendChild(b);
    });

    sl.edges.forEach(function (e, j) {
      var a = byId[e[0]], b = byId[e[1]], o = e[2] || {};
      var pts = route(rect(sl, a), rect(sl, b), o);
      var d = pathD(pts);
      var p = svg("path", { d: d, class: "wire" + (o.bi ? " wire--bi" : ""), pathLength: "1", "data-a": e[0], "data-b": e[1] });
      p.style.setProperty("--j", j);
      wires.appendChild(p);
      var dur = Math.max(1.6, pathLength(pts) / 110).toFixed(2);
      addPulse(wires, d, dur, j, false, e);
      if (o.bi) addPulse(wires, d, dur, j, true, e);
      if (o.l) {
        var at = labelPoint(pts);
        var lab = el("span", "wire-label", o.l);
        lab.style.cssText = "left:" + at[0] + "px;top:" + at[1] + "px;--j:" + j;
        lab.dataset.a = e[0];
        lab.dataset.b = e[1];
        canvas.appendChild(lab);
      }
    });
    sl._edgesById = byId;
    s.appendChild(canvas);

    var foot = el("footer", "slide__foot");
    var legend = el("ul", "legend");
    LEGEND.forEach(function (lg) {
      if (!kindsUsed[lg[0]]) return;
      var li = el("li", "legend__item legend__item--" + lg[0]);
      li.appendChild(el("i"));
      li.appendChild(document.createTextNode(lg[1]));
      legend.appendChild(li);
    });
    foot.appendChild(legend);
    foot.appendChild(el("p", "slide__help", "Hover to flip a card · Click for details"));
    s.appendChild(foot);
    return s;
  }

  function addPulse(wires, d, dur, j, reverse, e) {
    if (reduce) return;
    var c = svg("circle", { r: "4.5", class: "pulse", "data-a": e[0], "data-b": e[1] });
    var m = svg("animateMotion", {
      dur: dur + "s",
      repeatCount: "indefinite",
      path: d,
      begin: -((j * 0.53 + (reverse ? parseFloat(dur) / 2 : 0)) % parseFloat(dur)).toFixed(2) + "s"
    });
    if (reverse) {
      m.setAttribute("keyPoints", "1;0");
      m.setAttribute("keyTimes", "0;1");
      m.setAttribute("calcMode", "linear");
    }
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

  /* ---------- Detail window ---------- */

  var lastFocus = null;
  var mKicker = modal.querySelector("[data-m-kicker]");
  var mTitle = modal.querySelector("[data-m-title]");
  var mBody = modal.querySelector("[data-m-body]");
  var mFacts = modal.querySelector("[data-m-facts]");
  var mLinks = modal.querySelector("[data-m-links]");
  var mPanel = modal.querySelector(".modal__panel");

  function openModal(sl, n, from) {
    var kind = KINDS[n.k];
    lastFocus = from || document.activeElement;
    modal.className = "modal modal--" + kind.cls;
    mKicker.textContent = sl.app + " · " + kind.label;
    mTitle.textContent = n.n;
    mBody.textContent = "";
    (n.a || [n.b]).forEach(function (para) {
      mBody.appendChild(el("p", null, para));
    });
    mFacts.textContent = "";
    (n.f || []).forEach(function (f) {
      var row = el("div", "facts__row");
      row.appendChild(el("dt", null, f[0]));
      row.appendChild(el("dd", null, f[1]));
      mFacts.appendChild(row);
    });
    mFacts.hidden = !(n.f && n.f.length);

    mLinks.textContent = "";
    var seen = {};
    sl.edges.forEach(function (e) {
      var o = e[2] || {};
      var other = null, dir = "";
      if (e[0] === n.id) {
        other = e[1];
        dir = o.bi ? "↔" : "→";
      } else if (e[1] === n.id) {
        other = e[0];
        dir = o.bi ? "↔" : "←";
      }
      if (!other || seen[other + dir]) return;
      seen[other + dir] = true;
      var on = sl.nodes.filter(function (x) {
        return x.id === other;
      })[0];
      var li = el("li");
      var btn = el("button", "link-chip link-chip--" + KINDS[on.k].cls);
      btn.type = "button";
      btn.appendChild(el("span", "link-chip__dir", dir));
      btn.appendChild(document.createTextNode(on.n));
      if (o.l) btn.appendChild(el("span", "link-chip__via", o.l));
      btn.addEventListener("click", function () {
        var target = stage.querySelector('.slide.is-active [data-node="' + on.id + '"]');
        openModal(sl, on, target || lastFocus);
      });
      li.appendChild(btn);
      mLinks.appendChild(li);
    });
    mLinks.parentElement.hidden = !mLinks.children.length;

    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add("is-open");
    });
    mPanel.scrollTop = 0;
    modal.querySelector("[data-close-btn]").focus();
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
    });
    current = i;
    clearTimeout(drawTimer);
    drawTimer = setTimeout(function () {
      slides[i].classList.add("is-drawn");
    }, reduce ? 0 : 1100);
    dotsEl.querySelectorAll("button").forEach(function (d, k) {
      d.classList.toggle("is-current", k === i);
      if (k === i) d.setAttribute("aria-current", "step");
      else d.removeAttribute("aria-current");
    });
    countEl.textContent = pad(i + 1) + " / " + pad(slides.length);
    progress.style.transform = "scaleX(" + (i + 1) / slides.length + ")";
    document.querySelector("[data-prev]").disabled = i === 0;
    document.querySelector("[data-next]").disabled = i === slides.length - 1;
    var hash = i === 0 ? "" : "#" + DECK.slides[i - 1].id;
    if (!fromHash && location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  }

  /* Fit each card's text to the lines its face has room for. */
  function clampText() {
    stage.querySelectorAll(".node:not(.node--wide) .node__short, .node__btext").forEach(function (t) {
      var face = t.parentElement;
      var limit = face.clientHeight - parseFloat(getComputedStyle(face).paddingBottom);
      if (t.classList.contains("node__btext")) limit -= t.nextSibling.offsetHeight + 6;
      var lh = parseFloat(getComputedStyle(t).lineHeight) || 20;
      t.style.webkitLineClamp = String(Math.max(1, Math.floor((limit - t.offsetTop) / lh)));
    });
  }

  function fit() {
    var bar = document.querySelector(".deck__bar");
    var navH = deckEl.classList.contains("is-full") ? 0 : document.querySelector(".nav").offsetHeight;
    var gutter = window.innerWidth < 700 ? 12 : 32;
    var availW = window.innerWidth - gutter * 2;
    var availH = window.innerHeight - navH - bar.offsetHeight - gutter * 1.5;
    var scale = Math.max(0.1, Math.min(availW / 1600, availH / 900));
    frame.style.width = 1600 * scale + "px";
    frame.style.height = 900 * scale + "px";
    stage.style.transform = "scale(" + scale + ")";
  }

  function fromHash() {
    var id = location.hash.slice(1);
    for (var i = 0; i < DECK.slides.length; i++) if (DECK.slides[i].id === id) return i + 1;
    return 0;
  }

  /* ---------- Build ---------- */

  slides.push(buildCover(0));
  DECK.slides.forEach(function (sl, i) {
    slides.push(buildSlide(sl, i + 1));
  });
  slides.forEach(function (s) {
    stage.appendChild(s);
  });

  var names = ["Overview"].concat(DECK.slides.map(function (s) {
    return s.app;
  }));
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
      go(0);
    } else if (e.key === "End") {
      go(slides.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      toggleFull();
    } else if (/^[1-8]$/.test(e.key)) {
      go(parseInt(e.key, 10) - 1);
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
  clampText();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      fit();
      clampText();
    });
  }
})();
