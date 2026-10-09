/* Bakshi Labs */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initNetwork(document.querySelector("[data-network]"));
    document.querySelectorAll("[data-walk]").forEach(initWalk);
    initPlayer(document.querySelector("[data-player]"));
    initReveal();
  });

  /* Navigation: solid bar after the first scroll, mobile menu, current section */
  function initNav() {
    var nav = document.querySelector("[data-nav]");
    var toggle = document.querySelector("[data-nav-toggle]");
    if (!nav) return;

    function onScroll() {
      nav.classList.toggle("is-solid", window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    function setOpen(open) {
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    }
    toggle.addEventListener("click", function () {
      setOpen(!nav.classList.contains("is-open"));
    });
    nav.querySelectorAll(".nav__links a").forEach(function (a) {
      a.addEventListener("click", function () {
        setOpen(false);
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });

    if (!("IntersectionObserver" in window)) return;
    var links = {};
    nav.querySelectorAll('.nav__links a[href^="#"]').forEach(function (a) {
      links[a.getAttribute("href").slice(1)] = a;
    });
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          Object.keys(links).forEach(function (id) {
            links[id].classList.toggle("is-current", id === entry.target.id);
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    Object.keys(links).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
    // The hero has no link, so reaching it clears the highlight.
    var hero = document.getElementById("top");
    if (hero) io.observe(hero);
  }

  /* Hero network: hubs on a loose ring around a glowing core, slowly turning */
  function initNetwork(canvas) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var seed = 11;
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }

    var nodes = [{ x: 0, y: 0, z: 0, kind: "core", t: 0 }];
    var edges = [];
    var HUBS = 9;
    var hubIdx = [];
    for (var i = 0; i < HUBS; i++) {
      var a = (i / HUBS) * Math.PI * 2 + (rand() - 0.5) * 0.45;
      var r = 0.74 + rand() * 0.26;
      var hub = { x: Math.cos(a) * r, y: (rand() - 0.5) * 0.7, z: Math.sin(a) * r, kind: "hub", t: 0.25 };
      nodes.push(hub);
      var hi = nodes.length - 1;
      hubIdx.push(hi);
      if (i % 4 !== 3) edges.push({ a: 0, b: hi, t0: 0.05 + i * 0.03, core: true });
      var leaves = 3 + Math.floor(rand() * 3);
      for (var j = 0; j < leaves; j++) {
        var la = rand() * Math.PI * 2;
        var lr = 0.1 + rand() * 0.13;
        nodes.push({
          x: hub.x + Math.cos(la) * lr,
          y: hub.y + (rand() - 0.5) * 0.28,
          z: hub.z + Math.sin(la) * lr,
          kind: "leaf",
          t: 0.6,
        });
        edges.push({ a: hi, b: nodes.length - 1, t0: 0.55 + rand() * 0.25 });
      }
    }
    for (var k = 0; k < HUBS; k++) {
      if (k % 3 === 1) continue;
      edges.push({ a: hubIdx[k], b: hubIdx[(k + 1) % HUBS], t0: 0.35 + k * 0.03 });
    }

    var dust = [];
    for (var d = 0; d < 70; d++) {
      dust.push({ x: rand(), y: rand(), s: 0.4 + rand() * 1.2, v: 0.002 + rand() * 0.006, p: rand() * Math.PI * 2 });
    }

    var pulses = [];
    var coreEdges = edges.filter(function (e) {
      return e.core;
    });

    var w = 0,
      h = 0,
      dpr = 1,
      cx = 0,
      cy = 0,
      scale = 1,
      fade = 1;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var proj = nodes.map(function () {
      return { x: 0, y: 0, z: 0 };
    });

    function resize() {
      var rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (w > 860) {
        cx = w * 0.77;
        cy = h * 0.36;
        scale = Math.min(w * 0.2, h * 0.36);
        fade = 1;
      } else {
        var title = document.querySelector(".hero__title");
        var top = title ? title.getBoundingClientRect().top - rect.top : h * 0.3;
        cx = w * 0.6;
        cy = Math.max(120, top * 0.58);
        scale = Math.min(w * 0.36, 150);
        fade = 0.7;
      }
    }

    function ease(x) {
      x = Math.max(0, Math.min(1, x));
      return 1 - Math.pow(1 - x, 3);
    }

    var start = performance.now();
    var running = false;
    var raf = 0;

    function draw(now) {
      var time = (now - start) / 1000;
      var build = reduceMotion ? 10 : time / 2.6;
      var rot = reduceMotion ? 0.6 : 0.6 + time * 0.05;
      pointer.x += (pointer.tx - pointer.x) * 0.04;
      pointer.y += (pointer.ty - pointer.y) * 0.04;
      var tilt = 0.32 + pointer.y * 0.08;
      var cosR = Math.cos(rot + pointer.x * 0.15),
        sinR = Math.sin(rot + pointer.x * 0.15);
      var cosT = Math.cos(tilt),
        sinT = Math.sin(tilt);

      ctx.clearRect(0, 0, w, h);

      for (var q = 0; q < dust.length; q++) {
        var p = dust[q];
        var py = (p.y - (reduceMotion ? 0 : time * p.v)) % 1;
        if (py < 0) py += 1;
        var alpha = 0.08 + 0.1 * Math.sin(p.p + time * 0.6);
        ctx.fillStyle = "rgba(143, 220, 210," + Math.max(0, alpha) * fade + ")";
        ctx.beginPath();
        ctx.arc(p.x * w, py * h, p.s, 0, Math.PI * 2);
        ctx.fill();
      }

      for (var n = 0; n < nodes.length; n++) {
        var nd = nodes[n];
        var x1 = nd.x * cosR - nd.z * sinR;
        var z1 = nd.x * sinR + nd.z * cosR;
        var y1 = nd.y * cosT - z1 * sinT;
        var z2 = nd.y * sinT + z1 * cosT;
        var persp = 2.8 / (2.8 + z2);
        proj[n].x = cx + x1 * scale * persp;
        proj[n].y = cy + y1 * scale * persp;
        proj[n].z = z2;
        proj[n].s = persp;
      }

      ctx.lineCap = "round";
      for (var m = 0; m < edges.length; m++) {
        var e = edges[m];
        var prog = ease((build - e.t0) / 0.35);
        if (prog <= 0) continue;
        var A = proj[e.a],
          B = proj[e.b];
        var depth = 0.55 + 0.45 * (1 - (A.z + B.z + 2) / 4);
        ctx.strokeStyle = "rgba(143, 220, 210," + (e.core ? 0.55 : 0.4) * depth * fade + ")";
        ctx.lineWidth = e.core ? 1.2 : 0.9;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(A.x + (B.x - A.x) * prog, A.y + (B.y - A.y) * prog);
        ctx.stroke();
      }

      if (!reduceMotion && build > 1.2) {
        if (pulses.length < 4 && Math.random() < 0.025) {
          var ce = coreEdges[Math.floor(Math.random() * coreEdges.length)];
          pulses.push({ e: ce, t: 0, out: Math.random() < 0.5 });
        }
        for (var u = pulses.length - 1; u >= 0; u--) {
          var pl = pulses[u];
          pl.t += 0.012;
          if (pl.t >= 1) {
            pulses.splice(u, 1);
            continue;
          }
          var f = pl.out ? pl.t : 1 - pl.t;
          var PA = proj[pl.e.a],
            PB = proj[pl.e.b];
          var px = PA.x + (PB.x - PA.x) * f,
            pyy = PA.y + (PB.y - PA.y) * f;
          var g = ctx.createRadialGradient(px, pyy, 0, px, pyy, 8);
          g.addColorStop(0, "rgba(22, 255, 198," + 0.9 * fade + ")");
          g.addColorStop(1, "rgba(22, 255, 198, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, pyy, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (var v = 0; v < nodes.length; v++) {
        var node = nodes[v];
        var P = proj[v];
        var appear = ease((build - node.t) / 0.4);
        if (appear <= 0) continue;
        var dep = 0.5 + 0.5 * (1 - (P.z + 1) / 2);
        if (node.kind === "core") {
          var pulse = reduceMotion ? 1 : 1 + 0.12 * Math.sin(time * 2);
          var glow = ctx.createRadialGradient(P.x, P.y, 0, P.x, P.y, 46 * pulse);
          glow.addColorStop(0, "rgba(22, 255, 198," + 0.55 * appear * fade + ")");
          glow.addColorStop(1, "rgba(22, 255, 198, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(P.x, P.y, 46 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(22, 255, 198," + appear * fade + ")";
          ctx.beginPath();
          ctx.arc(P.x, P.y, 9 * P.s, 0, Math.PI * 2);
          ctx.fill();
        } else if (node.kind === "hub") {
          ctx.fillStyle = "rgba(255, 255, 255," + 0.92 * dep * appear * fade + ")";
          ctx.beginPath();
          ctx.arc(P.x, P.y, 3.6 * P.s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "rgba(143, 220, 210," + 0.85 * dep * appear * fade + ")";
          ctx.beginPath();
          ctx.arc(P.x, P.y, 2.2 * P.s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function loop(now) {
      draw(now);
      if (running) raf = requestAnimationFrame(loop);
    }
    function play() {
      if (running || reduceMotion) return;
      running = true;
      raf = requestAnimationFrame(loop);
    }
    function pause() {
      running = false;
      cancelAnimationFrame(raf);
    }

    resize();
    draw(performance.now());
    window.addEventListener("resize", function () {
      resize();
      if (!running) draw(performance.now());
    });
    window.addEventListener(
      "pointermove",
      function (e) {
        pointer.tx = e.clientX / window.innerWidth - 0.5;
        pointer.ty = e.clientY / window.innerHeight - 0.5;
      },
      { passive: true }
    );

    if (reduceMotion) return;
    var visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !document.hidden) play();
        else pause();
      }).observe(canvas);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else if (visible) play();
    });
    play();
  }

  /* Walkthroughs: six screenshots per tool, stepped by hand or on a timer */
  function initWalk(walk) {
    var steps = Array.prototype.slice.call(walk.querySelectorAll(".walk__step"));
    var imgs = Array.prototype.slice.call(walk.querySelectorAll(".walk__img"));
    var caption = walk.querySelector(".walk__caption");
    var current = 0;
    var auto = !reduceMotion;

    function show(n, focus) {
      current = (n + steps.length) % steps.length;
      steps.forEach(function (s, k) {
        s.setAttribute("aria-pressed", String(k === current));
      });
      imgs.forEach(function (img, k) {
        img.classList.toggle("is-active", k === current);
      });
      var next = imgs[(current + 1) % imgs.length];
      if (next && next.loading === "lazy") next.loading = "eager";
      caption.textContent = steps[current].getAttribute("data-desc");
      if (focus) steps[current].focus();
    }

    function stopAuto() {
      auto = false;
      walk.classList.remove("is-auto", "is-paused");
    }

    steps.forEach(function (step, k) {
      step.addEventListener("click", function () {
        stopAuto();
        show(k);
      });
      step.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          stopAuto();
          show(current + 1, true);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          stopAuto();
          show(current - 1, true);
        }
      });
    });

    walk.addEventListener("animationend", function (e) {
      if (!auto || e.animationName !== "walk-fill") return;
      show(current + 1);
    });

    if (!auto || !("IntersectionObserver" in window)) return;
    walk.classList.add("is-auto", "is-paused");
    var inView = false,
      hover = false;
    function sync() {
      if (!auto) return;
      walk.classList.toggle("is-paused", !inView || hover || document.hidden);
    }
    new IntersectionObserver(
      function (entries) {
        inView = entries[0].isIntersecting;
        sync();
      },
      { threshold: 0.5 }
    ).observe(walk);
    walk.addEventListener("pointerenter", function () {
      hover = true;
      sync();
    });
    walk.addEventListener("pointerleave", function () {
      hover = false;
      sync();
    });
    document.addEventListener("visibilitychange", sync);
  }

  /* Demo video player */
  function initPlayer(dialog) {
    if (!dialog) return;
    var video = dialog.querySelector("video");
    var title = dialog.querySelector(".player__title");
    var opener = null;

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-video]");
      if (!btn) return;
      var src = btn.getAttribute("data-video");
      var startAt = btn.getAttribute("data-start");
      if (typeof dialog.showModal !== "function") {
        window.open(src, "_blank", "noopener");
        return;
      }
      opener = btn;
      title.textContent = btn.getAttribute("data-title") + " demo";
      video.src = src + (startAt ? "#t=" + startAt : "");
      video.loop = true;
      dialog.showModal();
      var playing = video.play();
      if (playing && playing.catch) playing.catch(function () {});
    });

    dialog.querySelector("[data-player-close]").addEventListener("click", function () {
      dialog.close();
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
    dialog.addEventListener("close", function () {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (opener) opener.focus();
    });
  }

  /* Gentle fade-up as sections enter the viewport */
  function initReveal() {
    var targets = document.querySelectorAll(
      ".section__head, .tiles, .case, .compare, .services, .ladder, .block, .offers, .about__grid, .career, .prompts, .cta"
    );
    if (!("IntersectionObserver" in window) || reduceMotion) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    targets.forEach(function (el) {
      el.classList.add("reveal");
      io.observe(el);
    });
  }
})();
