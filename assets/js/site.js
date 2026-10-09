/* Bakshi Labs */
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initCases();
    initFeatureVideo();
    initReveal();
  });

  /* Navigation: solid after the first scroll, light or dark to match the section beneath it */
  function initNav() {
    var nav = document.querySelector("[data-nav]");
    var toggle = document.querySelector("[data-nav-toggle]");
    if (!nav) return;
    var toned = Array.prototype.slice.call(document.querySelectorAll("[data-tone]"));

    function update() {
      nav.classList.toggle("is-solid", window.scrollY > 8);
      var probe = nav.offsetHeight / 2;
      var dark = false;
      for (var i = 0; i < toned.length; i++) {
        var r = toned[i].getBoundingClientRect();
        if (r.top <= probe && r.bottom > probe) {
          dark = toned[i].getAttribute("data-tone") === "dark";
          break;
        }
      }
      nav.classList.toggle("is-dark", dark);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

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
    ["top", "work", "method", "services", "about", "contact"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* Case study sheets: open from any [data-case] link, deep-linkable by hash */
  function initCases() {
    var dialogs = {};
    document.querySelectorAll("[data-case-dialog]").forEach(function (d) {
      dialogs[d.id] = d;
      initWalk(d.querySelector("[data-walk]"));
      d.querySelector("[data-close]").addEventListener("click", function () {
        d.close();
      });
      d.addEventListener("click", function (e) {
        if (e.target === d) d.close();
      });
      d.addEventListener("close", function () {
        resetWalk(d.querySelector("[data-walk]"));
        if (!d.dataset.switching) {
          document.body.classList.remove("is-locked");
          if (location.hash === "#" + d.id) history.replaceState(null, "", "#work");
          if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        }
      });
    });
    if (typeof HTMLDialogElement === "undefined") return;

    var opener = null;
    function open(id, from) {
      var d = dialogs[id];
      if (!d) return false;
      var current = document.querySelector("[data-case-dialog][open]");
      if (current && current !== d) {
        current.dataset.switching = "1";
        current.close();
        delete current.dataset.switching;
      } else if (!current) {
        opener = from || null;
      }
      d.querySelectorAll("img[loading=lazy]").forEach(function (img) {
        img.loading = "eager";
      });
      d.showModal();
      d.scrollTop = 0;
      document.body.classList.add("is-locked");
      if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
      return true;
    }

    document.addEventListener("click", function (e) {
      var link = e.target.closest("[data-case]");
      if (!link) return;
      if (open(link.getAttribute("data-case"), link)) e.preventDefault();
    });

    function fromHash() {
      var id = location.hash.slice(1);
      if (dialogs[id] && !dialogs[id].open) open(id, null);
    }
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }

  /* Walkthrough: six screenshots per tool, plus the demo video on request */
  function initWalk(walk) {
    if (!walk) return;
    var steps = Array.prototype.slice.call(walk.querySelectorAll(".walk__step"));
    var imgs = Array.prototype.slice.call(walk.querySelectorAll(".walk__img"));
    var caption = walk.querySelector(".walk__caption");
    var video = walk.querySelector(".walk__video");
    var toggle = walk.querySelector("[data-video-toggle]");
    walk._current = 0;

    function show(n, focus) {
      setVideo(false);
      var cur = (n + steps.length) % steps.length;
      walk._current = cur;
      steps.forEach(function (s, k) {
        s.setAttribute("aria-pressed", String(k === cur));
      });
      imgs.forEach(function (img, k) {
        img.classList.toggle("is-active", k === cur);
      });
      caption.textContent = steps[cur].getAttribute("data-desc");
      if (focus) steps[cur].focus();
    }
    walk._show = show;

    function setVideo(on) {
      walk.classList.toggle("is-video", on);
      toggle.setAttribute("aria-pressed", String(on));
      if (on) {
        if (!video.getAttribute("src")) {
          var start = video.getAttribute("data-start");
          video.src = video.getAttribute("data-src") + (start ? "#t=" + start : "");
        }
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
      } else if (!video.paused) {
        video.pause();
      }
    }
    walk._setVideo = setVideo;

    steps.forEach(function (step, k) {
      step.addEventListener("click", function () {
        show(k);
      });
      step.addEventListener("keydown", function (e) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          show(walk._current + 1, true);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          show(walk._current - 1, true);
        }
      });
    });
    toggle.addEventListener("click", function () {
      setVideo(!walk.classList.contains("is-video"));
    });
  }

  function resetWalk(walk) {
    if (!walk || !walk._show) return;
    walk._setVideo(false);
    walk._show(0);
  }

  /* Featured tool: a short muted loop that loads and plays only while on screen */
  function initFeatureVideo() {
    var video = document.querySelector("[data-autoplay]");
    if (!video) return;
    var saveData = navigator.connection && navigator.connection.saveData;
    if (reduceMotion || saveData || !("IntersectionObserver" in window)) return;
    new IntersectionObserver(
      function (entries) {
        if (entries[0].isIntersecting) {
          if (!video.getAttribute("src")) {
            var webm = video.getAttribute("data-src-webm");
            var h264 = video.canPlayType('video/mp4; codecs="avc1.640028"');
            video.src = webm && !h264 ? webm : video.getAttribute("data-src");
          }
          var p = video.play();
          if (p && p.catch) p.catch(function () {});
        } else if (!video.paused) {
          video.pause();
        }
      },
      { threshold: 0.35 }
    ).observe(video);
  }

  /* Gentle fade-up as blocks enter the viewport */
  function initReveal() {
    if (!("IntersectionObserver" in window) || reduceMotion) return;
    var targets = document.querySelectorAll(".head, .feature, .card, .move, .offer, .about__side, .about__bio, .prompts, .reach");
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -2% 0px", threshold: 0.01 }
    );
    targets.forEach(function (el) {
      el.classList.add("reveal");
      io.observe(el);
    });
  }
})();
