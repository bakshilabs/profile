/* Bakshi Labs */
(function () {
  "use strict";

  document.documentElement.classList.add("js");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Some embedded frames refuse history changes; the page works without them.
  function setHash(hash) {
    try {
      history.replaceState(null, "", hash);
    } catch (err) {}
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initCases();
    initCopy();
    initZoom();
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
        if (d.dataset.switching) {
          // another sheet is opening in its place, so the page stays locked
          delete d.dataset.switching;
          return;
        }
        if (d.dataset.closingTo) {
          // a link inside the sheet has already chosen where the page goes
          delete d.dataset.closingTo;
          document.body.classList.remove("is-locked");
          return;
        }
        document.body.classList.remove("is-locked");
        if (location.hash === "#" + d.id) setHash("#work");
        if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
        else {
          // opened from a shared link: land on that tool's card
          var card = document.querySelector('.card__link[data-case="' + d.id + '"], .feature__body[data-case="' + d.id + '"]');
          if (card) {
            card.scrollIntoView({ block: window.matchMedia("(max-width: 760px)").matches ? "start" : "center" });
            card.focus({ preventScroll: true });
          }
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
        // the close event fires later; its handler clears this flag
        current.dataset.switching = "1";
        current.close();
      } else if (!current) {
        opener = from || null;
      }
      d.querySelectorAll("img[loading=lazy]").forEach(function (img) {
        img.loading = "eager";
      });
      d.showModal();
      d.scrollTop = 0;
      document.body.classList.add("is-locked");
      if (location.hash !== "#" + id) setHash("#" + id);
      return true;
    }

    document.addEventListener("click", function (e) {
      var to = e.target.closest("[data-close-to]");
      if (to) {
        e.preventDefault();
        var openSheet = document.querySelector("[data-case-dialog][open]");
        opener = null;
        if (openSheet) {
          openSheet.dataset.closingTo = "1";
          openSheet.close();
        }
        var target = document.getElementById(to.getAttribute("data-close-to"));
        setHash("#" + to.getAttribute("data-close-to"));
        if (target) target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
        return;
      }
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
    var count = walk.querySelector(".walk__count");
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
      if (count) count.textContent = cur + 1 + " / " + steps.length;
      if (focus) steps[cur].focus();
      if (!focus && steps[cur].scrollIntoView && window.matchMedia("(max-width: 760px)").matches) {
        var strip = steps[cur].closest(".walk__steps");
        if (strip) strip.scrollTo({ left: steps[cur].parentNode.offsetLeft - 16, behavior: "smooth" });
      }
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

  /* Copy the email address, falling back to selecting it */
  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      var label = btn.textContent;
      btn.addEventListener("click", function () {
        var value = btn.getAttribute("data-copy");
        function done(text) {
          btn.textContent = text;
          setTimeout(function () {
            btn.textContent = label;
          }, 2000);
        }
        function select() {
          var target = document.querySelector(".mail__address");
          if (!target || !window.getSelection) return;
          var range = document.createRange();
          range.selectNodeContents(target);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          done("Address selected");
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(function () {
            done("Copied");
          }, select);
        } else select();
      });
    });
  }

  /* Phones: tap a walkthrough screenshot to see it at full size */
  function initZoom() {
    var dialog = document.querySelector("[data-zoom]");
    if (!dialog || typeof dialog.showModal !== "function") return;
    var img = dialog.querySelector("img");
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-zoom-open]");
      var stage = btn ? btn.closest(".walk").querySelector("[data-zoomable]") : e.target.closest("[data-zoomable]");
      if (!stage || !window.matchMedia("(max-width: 760px)").matches) return;
      if (stage.closest(".walk").classList.contains("is-video")) return;
      var active = stage.querySelector(".walk__img.is-active");
      if (!active) return;
      img.src = active.currentSrc || active.src;
      img.alt = active.alt;
      dialog.showModal();
      dialog.querySelector(".zoom__scroll").scrollLeft = 0;
    });
    dialog.querySelector("[data-zoom-close]").addEventListener("click", function () {
      dialog.close();
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
