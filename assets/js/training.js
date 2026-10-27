/* Bakshi Labs: small business AI training slides.
   Builds a 1600 × 900 stage from TRAINING_DECK, scales it to the window and
   handles the detail window, keyboard, swipe and full-screen navigation.
   The deck controls follow the workflow slides (workflows.js). */

(function () {
  "use strict";

  var DECK = window.TRAINING_DECK;
  if (!DECK) return;

  var touch = window.matchMedia("(hover: none)");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Line icons, 24 × 24. */
  var ICON = {
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    build: '<path d="M4 20h16"/><rect x="5" y="11" width="5" height="6" rx="1"/><rect x="14" y="6" width="5" height="11" rx="1"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    chart: '<path d="M4 4v16h16"/><path d="M8 16v-3M12 16v-7M16 16v-5"/>',
    loop: '<path d="M19 8a7.5 7.5 0 0 0-13.4-1.5M5 16a7.5 7.5 0 0 0 13.4 1.5"/><path d="M19 3.5V8h-4.5M5 20.5V16h4.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    pound: '<path d="M16.5 6.5A3.8 3.8 0 0 0 9 7.8V19"/><path d="M6.5 19h11M6.5 12.5h7"/>',
    heart: '<path d="M12 19.5s-7.5-4.4-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.6-7.5 10-7.5 10z"/>',
    people: '<circle cx="9" cy="8.5" r="2.7"/><path d="M3.6 19c0-3 2.4-5 5.4-5s5.4 2 5.4 5"/><path d="M15.5 6.6a2.7 2.7 0 0 1 0 5.3M17 19c0-2.4-.8-4.2-2.2-5.4"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.6 2.6L16 9.5"/>',
    tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    spark: '<path d="M12 2.8v18.4M2.8 12h18.4M5.5 5.5l13 13M18.5 5.5l-13 13"/>',
    flag: '<path d="M6 3.5v17"/><path d="M6 5h11l-2.4 3.4L17 12H6z"/>',
    doc: '<path d="M6 3.5h7l5 5V20a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M13 3.5V8.5h5"/><path d="M8.5 12.5h7M8.5 15.5h7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || "ic") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || ICON.doc) + "</svg>";
  }
  var ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ARROW_DOWN = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M4 9l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var deckEl = document.querySelector("[data-deck]");
  var frame = document.querySelector("[data-frame]");
  var stage = document.querySelector("[data-stage]");
  var dotsEl = document.querySelector("[data-dots]");
  var countEl = document.querySelector("[data-count]");
  var progress = document.querySelector("[data-progress]");
  var modal = document.querySelector("[data-modal]");
  var SLIDES = DECK.slides;
  var TOTAL = SLIDES.length;
  var slides = [];
  var ids = SLIDES.map(function (s) {
    return s.id;
  });
  var current = -1;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }
  function slideIndex(id) {
    return ids.indexOf(id);
  }
  function hintText() {
    return touch.matches ? "Tap again for details" : "Click for details";
  }
  function slideShell(d, n) {
    var s = el("section", "slide slide--" + d.type);
    s.setAttribute("aria-roledescription", "slide");
    s.setAttribute("aria-label", n + " of " + TOTAL + ": " + d.title);
    s.appendChild(el("div", "slide__grid"));
    return s;
  }
  function head(s, d) {
    var h = el("header", "slide__head");
    var hl = el("div", "slide__headl");
    hl.appendChild(el("p", "kicker rise", d.kicker));
    hl.appendChild(el("h2", "slide__title rise", d.title));
    h.appendChild(hl);
    var hr = el("div", "slide__headr");
    hr.appendChild(el("p", "slide__lede rise", d.lede));
    h.appendChild(hr);
    s.appendChild(h);
  }
  function foot(s, note, help) {
    var f = el("footer", "slide__foot");
    f.appendChild(el("p", "slide__note", note || ""));
    if (help) f.appendChild(el("p", "slide__help", touch.matches ? "Tap a card to pick it · Tap again for details" : "Hover over a card for more · Click for details"));
    s.appendChild(f);
  }
  function toolChips(list, cls) {
    var w = el("span", cls || "chips");
    list.forEach(function (t) {
      w.appendChild(el("span", "chip", t));
    });
    return w;
  }
  /* On touch screens the first tap picks a card and the second opens it. */
  function pickable(btn, group, open) {
    btn.addEventListener("click", function () {
      if (touch.matches && !btn.classList.contains("is-picked")) {
        group.querySelectorAll(".is-picked").forEach(function (o) {
          o.classList.remove("is-picked");
        });
        btn.classList.add("is-picked");
        return;
      }
      open(btn);
    });
  }

  /* ---------- Slide builders ---------- */

  function buildCover(d, n) {
    var s = slideShell(d, n);
    var left = el("div", "cover__copy");
    left.appendChild(el("p", "kicker rise", d.kicker));
    left.appendChild(el("h1", "cover__title rise", d.title));
    left.appendChild(el("p", "cover__lede rise", d.lede));
    var stats = el("div", "cover__stats rise");
    d.stats.forEach(function (st) {
      var x = el("div", "cover__stat");
      x.appendChild(el("b", null, st[0]));
      x.appendChild(el("span", null, st[1]));
      stats.appendChild(x);
    });
    left.appendChild(stats);
    var hint = el("p", "cover__hint rise");
    hint.innerHTML = "<kbd>←</kbd> <kbd>→</kbd> to move between slides · <kbd>F</kbd> for full screen";
    left.appendChild(hint);
    s.appendChild(left);

    var tiles = el("div", "cover__tiles");
    tiles.appendChild(el("p", "cover__tiles-label rise", "In this slide show"));
    SLIDES.forEach(function (o, i) {
      if (i === 0) return;
      var t = el("button", "tile");
      t.type = "button";
      t.style.setProperty("--i", i);
      t.setAttribute("aria-label", "Go to " + o.title);
      t.appendChild(el("span", "tile__num", pad(i)));
      t.appendChild(el("span", "tile__name", o.title));
      var g = el("span", "tile__go");
      g.innerHTML = ARROW;
      t.appendChild(g);
      t.addEventListener("click", function () {
        go(i);
      });
      tiles.appendChild(t);
    });
    s.appendChild(tiles);
    return s;
  }

  /* Before: tools scattered. After: the same tools joined through one AI layer. */
  var GAP_BEFORE = [[40, 30], [262, 10], [446, 62], [96, 140], [322, 150], [30, 262], [228, 270], [430, 236]];
  function buildGap(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var wrap = el("div", "gap");

    var before = el("div", "gap__panel gap__panel--before");
    before.appendChild(el("p", "gap__label", "Before · fragmented activity"));
    var scatter = el("div", "gap__scatter");
    d.tools.forEach(function (t, i) {
      var c = el("span", "gtool", t);
      c.dataset.tool = i;
      c.style.cssText = "left:" + GAP_BEFORE[i][0] + "px;top:" + GAP_BEFORE[i][1] + "px;--i:" + i;
      scatter.appendChild(c);
    });
    before.appendChild(scatter);
    var costs = el("div", "gap__costs");
    costs.appendChild(el("p", "gap__sub", "What it costs"));
    var cl = el("ul", "gap__costlist");
    d.costs.forEach(function (c) {
      cl.appendChild(el("li", "cost", c));
    });
    costs.appendChild(cl);
    before.appendChild(costs);
    wrap.appendChild(before);

    var mid = el("div", "gap__mid");
    mid.innerHTML = ARROW;
    wrap.appendChild(mid);

    var after = el("div", "gap__panel gap__panel--after");
    after.appendChild(el("p", "gap__label gap__label--after", "After · connected through an AI layer"));
    var hub = el("div", "hub");
    var W = 620, H = 440, cx = W / 2, cy = H / 2, rx = 238, ry = 172;
    var spokes = '<svg class="hub__spokes" viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">';
    var pts = d.tools.map(function (t, i) {
      var a = -Math.PI / 2 + (i * 2 * Math.PI) / d.tools.length;
      return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
    });
    pts.forEach(function (p, i) {
      spokes += '<line class="spoke" data-tool="' + i + '" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" style="--i:' + i + '"/>';
    });
    spokes += "</svg>";
    hub.innerHTML = spokes;
    var core = el("div", "hub__core");
    core.innerHTML = '<span class="hub__ic">' + icon("spark") + "</span>";
    core.appendChild(el("b", null, d.hub[0]));
    core.appendChild(el("span", null, d.hub[1]));
    hub.appendChild(core);
    d.tools.forEach(function (t, i) {
      var c = el("span", "gtool gtool--on", t);
      c.dataset.tool = i;
      c.style.cssText = "left:" + pts[i][0].toFixed(1) + "px;top:" + pts[i][1].toFixed(1) + "px;--i:" + i;
      hub.appendChild(c);
    });
    after.appendChild(hub);
    var note = el("p", "gap__note");
    note.innerHTML = icon("people", "gap__noteic");
    note.appendChild(document.createTextNode(d.note));
    after.appendChild(note);
    wrap.appendChild(after);
    s.appendChild(wrap);

    /* Pointing at a tool lights it up on both sides, with its link to the AI layer. */
    wrap.querySelectorAll(".gtool").forEach(function (c) {
      c.tabIndex = 0;
      function on(v) {
        wrap.classList.toggle("is-focus", v);
        wrap.querySelectorAll('[data-tool="' + c.dataset.tool + '"]').forEach(function (x) {
          x.classList.toggle("is-hot", v);
        });
      }
      c.addEventListener("mouseenter", function () { on(true); });
      c.addEventListener("mouseleave", function () { on(false); });
      c.addEventListener("focus", function () { on(true); });
      c.addEventListener("blur", function () { on(false); });
      c.addEventListener("click", function () {
        var was = c.classList.contains("is-hot");
        wrap.querySelectorAll(".is-hot").forEach(function (x) { x.classList.remove("is-hot"); });
        on(!was);
      });
    });
    foot(s, touch.matches ? "Tap a tool to see where it connects." : "Point at a tool to see where it connects.");
    return s;
  }

  function buildMethod(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var row = el("div", "method");
    d.stages.forEach(function (st, i) {
      var b = el("button", "stagecard");
      b.type = "button";
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", "Stage " + (i + 1) + ": " + st.name + ". " + st.text + " Output: " + st.output + ". Open details.");
      var top = el("span", "stagecard__top");
      top.appendChild(el("span", "stagecard__num", pad(i + 1)));
      top.insertAdjacentHTML("beforeend", '<span class="stagecard__ic">' + icon(st.icon) + "</span>");
      b.appendChild(top);
      b.appendChild(el("span", "stagecard__name", st.name));
      b.appendChild(el("span", "stagecard__text", st.text));
      var out = el("span", "stagecard__out");
      out.appendChild(el("span", "stagecard__lab", "Output"));
      out.appendChild(el("span", "stagecard__outtext", st.output));
      b.appendChild(out);
      b.appendChild(el("span", "card__hint", hintText()));
      if (i < d.stages.length - 1) {
        var a = el("span", "stagecard__arrow");
        a.innerHTML = ARROW;
        b.appendChild(a);
      }
      pickable(b, row, function (from) {
        openStage(d, i, from);
      });
      row.appendChild(b);
    });
    s.appendChild(row);
    var loop = el("div", "method__loop rise");
    loop.innerHTML = '<svg viewBox="0 0 1472 70" preserveAspectRatio="none" aria-hidden="true"><path d="M1325 2 V34 Q1325 52 1307 52 H165 Q147 52 147 34 V8" fill="none"/><path class="method__head" d="M141 14 L147 4 L153 14" fill="none"/></svg>';
    loop.appendChild(el("span", "method__looplab", d.loop));
    s.appendChild(loop);
    foot(s, null, true);
    return s;
  }

  function buildExample(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var grid = el("div", "example");
    d.rows.forEach(function (r, i) {
      var c = el("div", "excard");
      c.style.setProperty("--i", i);
      c.tabIndex = 0;
      var b = el("div", "excard__before");
      var t = el("span", "excard__top");
      t.appendChild(el("span", "excard__num", pad(i + 1)));
      t.appendChild(el("span", "excard__lab", "Before"));
      b.appendChild(t);
      b.appendChild(el("p", "excard__text", r[0]));
      c.appendChild(b);
      var a = el("span", "excard__arrow");
      a.innerHTML = ARROW_DOWN;
      c.appendChild(a);
      var af = el("div", "excard__after");
      af.appendChild(el("span", "excard__lab excard__lab--after", "After Level 1"));
      af.appendChild(el("p", "excard__text excard__text--after", r[1]));
      c.appendChild(af);
      c.addEventListener("click", function () {
        var was = c.classList.contains("is-picked");
        grid.querySelectorAll(".is-picked").forEach(function (o) { o.classList.remove("is-picked"); });
        if (!was) c.classList.add("is-picked");
      });
      grid.appendChild(c);
    });
    s.appendChild(grid);
    foot(s, d.note);
    return s;
  }

  function buildLevels(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var grid = el("div", "levels");
    d.levels.forEach(function (lv, i) {
      var c = el("article", "level level--" + (i + 1));
      c.style.setProperty("--i", i);
      var top = el("div", "level__top");
      top.appendChild(el("span", "level__tag", lv.tag));
      c.appendChild(top);
      c.appendChild(el("h3", "level__name", lv.name));
      var dl = el("dl", "level__rows");
      lv.rows.forEach(function (r) {
        var row = el("div", "level__row");
        row.appendChild(el("dt", null, r[0]));
        row.appendChild(el("dd", null, r[1]));
        dl.appendChild(row);
      });
      c.appendChild(dl);
      var bottom = el("div", "level__bottom");
      if (lv.tools.length) {
        var tl = el("div", "level__tools");
        tl.appendChild(el("span", "level__toolslab", "Tools"));
        tl.appendChild(toolChips(lv.tools));
        bottom.appendChild(tl);
      }
      var act;
      if (lv.goto) {
        act = el("button", "level__act");
        act.type = "button";
        act.addEventListener("click", function () {
          go(slideIndex(lv.goto));
        });
      } else {
        act = el("a", "level__act level__act--ghost");
        act.href = lv.href;
      }
      act.appendChild(document.createTextNode(lv.action));
      act.insertAdjacentHTML("beforeend", ARROW);
      bottom.appendChild(act);
      c.appendChild(bottom);
      grid.appendChild(c);
    });
    s.appendChild(grid);
    foot(s, d.note);
    return s;
  }

  function buildSteps(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var grid = el("div", "steps");
    d.steps.forEach(function (st, i) {
      var b = el("button", "step");
      b.type = "button";
      b.style.setProperty("--i", i);
      b.setAttribute("aria-label", "Step " + (i + 1) + ": " + st.name + ". " + st.text + " Tools: " + st.tools.join(", ") + ". Open details.");
      var top = el("span", "step__top");
      top.appendChild(el("span", "step__num", pad(i + 1)));
      top.appendChild(el("span", "card__hint card__hint--inline", hintText()));
      b.appendChild(top);
      b.appendChild(el("span", "step__name", st.name));
      b.appendChild(el("span", "step__text", st.text));
      b.appendChild(toolChips(st.tools, "chips step__tools"));
      pickable(b, grid, function (from) {
        openStep(d, i, from);
      });
      grid.appendChild(b);
    });
    s.appendChild(grid);

    var side = el("aside", "leaves rise");
    side.appendChild(el("p", "leaves__label", "What you leave with"));
    var ul = el("ul", "leaves__list");
    d.leaves.forEach(function (t) {
      var li = el("li");
      li.innerHTML = '<span class="leaves__tick">' + icon("tick") + "</span>";
      li.appendChild(el("span", null, t));
      ul.appendChild(li);
    });
    side.appendChild(ul);
    var rule = el("p", "leaves__note");
    rule.innerHTML = icon("check", "leaves__noteic");
    rule.appendChild(document.createTextNode(d.note));
    side.appendChild(rule);
    s.appendChild(side);
    foot(s, null, true);
    return s;
  }

  function buildImpact(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var grid = el("div", "impact");
    d.areas.forEach(function (a, i) {
      var c = el("div", "itile");
      c.style.setProperty("--i", i);
      c.tabIndex = 0;
      var top = el("div", "itile__top");
      top.appendChild(el("span", "itile__num", pad(i + 1)));
      top.insertAdjacentHTML("beforeend", '<span class="itile__ic">' + icon(a.icon) + "</span>");
      c.appendChild(top);
      c.appendChild(el("p", "itile__name", a.name));
      var ul = el("ul", "itile__list");
      a.items.forEach(function (t) {
        ul.appendChild(el("li", null, t));
      });
      c.appendChild(ul);
      grid.appendChild(c);
    });
    s.appendChild(grid);

    var tl = el("div", "checks rise");
    tl.appendChild(el("p", "checks__label", "How we measure · four checkpoints in 60 days"));
    var line = el("div", "checks__line");
    line.appendChild(el("span", "checks__track"));
    line.appendChild(el("span", "checks__fill"));
    var days = [0, 7, 30, 60];
    d.checks.forEach(function (c, i) {
      var p = el("div", "check");
      p.style.cssText = "left:" + (days[i] / 60) * 100 + "%;--i:" + i;
      p.tabIndex = 0;
      p.appendChild(el("span", "check__dot"));
      p.appendChild(el("span", "check__when", c[0]));
      p.appendChild(el("span", "check__what", c[1]));
      line.appendChild(p);
    });
    tl.appendChild(line);
    s.appendChild(tl);
    foot(s, "Each measure is compared with the baseline taken at the start.");
    return s;
  }

  function buildResults(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var grid = el("div", "results");
    d.results.forEach(function (r, i) {
      var c = el("div", "result");
      c.style.setProperty("--i", i);
      c.appendChild(el("span", "result__kind", r.kind));
      c.appendChild(el("b", "result__big", r.big));
      c.appendChild(el("p", "result__text", r.text));
      grid.appendChild(c);
    });
    s.appendChild(grid);
    foot(s, d.note);
    return s;
  }

  function list(label, items, cls, ic) {
    var c = el("div", "plist " + (cls || ""));
    c.appendChild(el("p", "plist__label", label));
    var ul = el("ul");
    items.forEach(function (t) {
      var li = el("li");
      li.innerHTML = '<span class="plist__ic">' + icon(ic) + "</span>";
      li.appendChild(el("span", null, t));
      ul.appendChild(li);
    });
    c.appendChild(ul);
    return c;
  }

  function buildPartners(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var top = el("div", "partners");
    top.appendChild(list("You provide", d.you, "plist--you rise", "flag"));
    var plus = el("span", "partners__plus rise");
    plus.innerHTML = icon("plus");
    top.appendChild(plus);
    top.appendChild(list("We provide", d.we, "plist--we rise", "spark"));
    top.appendChild(list("What you receive", d.receive, "plist--receive rise", "doc"));
    s.appendChild(top);

    var cyc = el("div", "cohort");
    cyc.appendChild(el("p", "cohort__label rise", "Each cohort"));
    var row = el("div", "cohort__row");
    d.cycle.forEach(function (c, i) {
      var b = el("div", "cstep");
      b.style.setProperty("--i", i);
      b.tabIndex = 0;
      var t = el("span", "cstep__top");
      t.appendChild(el("span", "cstep__num", String(i + 1)));
      t.appendChild(el("span", "cstep__name", c[0]));
      b.appendChild(t);
      b.appendChild(el("span", "cstep__text", c[1]));
      if (i < d.cycle.length - 1) {
        var a = el("span", "cstep__arrow");
        a.innerHTML = ARROW;
        b.appendChild(a);
      }
      row.appendChild(b);
    });
    cyc.appendChild(row);
    var loop = el("div", "cohort__loop rise");
    loop.innerHTML = icon("loop", "cohort__loopic");
    loop.appendChild(document.createTextNode(d.loop));
    cyc.appendChild(loop);
    s.appendChild(cyc);
    foot(s, d.note);
    return s;
  }

  function buildClose(d, n) {
    var s = slideShell(d, n);
    head(s, d);
    var grid = el("div", "close");
    var pr = el("div", "close__principles");
    d.principles.forEach(function (p, i) {
      var c = el("div", "principle");
      c.style.setProperty("--i", i);
      c.appendChild(el("p", "principle__name", p[0]));
      c.appendChild(el("p", "principle__text", p[1]));
      pr.appendChild(c);
    });
    grid.appendChild(pr);
    var nx = el("div", "close__next rise");
    nx.appendChild(el("p", "close__label", "Next steps"));
    var ol = el("ol", "close__steps");
    d.steps.forEach(function (t, i) {
      var li = el("li");
      li.appendChild(el("span", "close__num", pad(i + 1)));
      li.appendChild(el("span", "close__step", t));
      ol.appendChild(li);
    });
    nx.appendChild(ol);
    nx.appendChild(el("p", "close__offer", d.offer));
    var cta = el("a", "close__cta", d.cta[0]);
    cta.href = d.cta[1];
    cta.insertAdjacentHTML("beforeend", ARROW);
    nx.appendChild(cta);
    grid.appendChild(nx);
    s.appendChild(grid);
    return s;
  }

  var BUILD = {
    cover: buildCover,
    gap: buildGap,
    method: buildMethod,
    example: buildExample,
    levels: buildLevels,
    steps: buildSteps,
    impact: buildImpact,
    results: buildResults,
    partners: buildPartners,
    close: buildClose
  };

  /* ---------- Detail window ---------- */

  var lastFocus = null;
  var mKicker = modal.querySelector("[data-m-kicker]");
  var mTitle = modal.querySelector("[data-m-title]");
  var mBody = modal.querySelector("[data-m-body]");
  var mFacts = modal.querySelector("[data-m-facts]");
  var mLinks = modal.querySelector("[data-m-links]");
  var mLinksLabel = modal.querySelector("[data-m-links-label]");
  var mPanel = modal.querySelector(".modal__panel");

  function chip(dir, text, onClick) {
    var li = el("li");
    var btn = el("button", "link-chip");
    btn.type = "button";
    btn.appendChild(el("span", "link-chip__dir", dir));
    btn.appendChild(document.createTextNode(text));
    btn.addEventListener("click", onClick);
    li.appendChild(btn);
    return li;
  }
  function setFacts(rows) {
    mFacts.textContent = "";
    rows.forEach(function (f) {
      var row = el("div", "facts__row");
      row.appendChild(el("dt", null, f[0]));
      var dd = el("dd");
      if (f[1].nodeType) dd.appendChild(f[1]);
      else dd.textContent = f[1];
      row.appendChild(dd);
      mFacts.appendChild(row);
    });
    mFacts.hidden = !rows.length;
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

  function openStage(d, i, from) {
    var st = d.stages[i];
    mKicker.textContent = "The five-stage method · Stage " + (i + 1) + " of " + d.stages.length;
    mTitle.textContent = st.name;
    mBody.textContent = "";
    mBody.appendChild(el("p", null, st.text));
    var after = i < d.stages.length - 1 ? "It leads into the " + d.stages[i + 1].name.toLowerCase() + " stage." : "After this stage the cycle starts again with " + d.stages[0].name.toLowerCase() + ".";
    mBody.appendChild(el("p", null, after));
    setFacts([["Output", st.output], ["Applies to", "Every programme, with content designed for the people in the room."]]);
    mLinksLabel.textContent = "Other stages";
    mLinks.textContent = "";
    d.stages.forEach(function (o, k) {
      if (k !== i) mLinks.appendChild(chip(pad(k + 1), o.name, function () { openStage(d, k); }));
    });
    showModal(from);
  }

  function openStep(d, i, from) {
    var st = d.steps[i];
    mKicker.textContent = "Inside Level 1 · Step " + (i + 1) + " of " + d.steps.length;
    mTitle.textContent = st.name;
    mBody.textContent = "";
    mBody.appendChild(el("p", null, st.text));
    if (i === 3 || i === 4) mBody.appendChild(el("p", null, d.note));
    setFacts([["Tools", toolChips(st.tools)], ["Built on", "Your own business, offer and real leads."]]);
    mLinksLabel.textContent = "Other steps";
    mLinks.textContent = "";
    d.steps.forEach(function (o, k) {
      if (k !== i) mLinks.appendChild(chip(pad(k + 1), o.name, function () { openStep(d, k); }));
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
      s.setAttribute("aria-hidden", k === i ? "false" : "true");
      s.inert = k !== i;
      s.querySelectorAll(".is-picked, .is-hot, .is-focus").forEach(function (o) {
        o.classList.remove("is-picked", "is-hot", "is-focus");
      });
    });
    current = i;
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

  SLIDES.forEach(function (d, i) {
    var s = BUILD[d.type](d, i + 1);
    slides.push(s);
    stage.appendChild(s);
  });

  SLIDES.forEach(function (d, i) {
    var b = el("button", "dot");
    b.type = "button";
    b.setAttribute("aria-label", "Slide " + (i + 1) + ": " + d.short);
    b.dataset.name = d.short;
    b.addEventListener("click", function () {
      go(i);
    });
    dotsEl.appendChild(b);
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
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
})();
