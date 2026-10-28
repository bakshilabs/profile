// Builds the two Workflow Discovery videos from one design.
// node social/workflow-discovery/build.mjs  →  square/index.html and reel/index.html
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const FORMATS = {
  // content box is 1000 wide and bh tall; cap is the top of the caption band
  square: { w: 1080, h: 1080, cx: 40, cy: 70, bh: 760, cap: 850, capSize: 42, brandTop: 0 },
  reel: { w: 1080, h: 1920, cx: 40, cy: 300, bh: 1040, cap: 1420, capSize: 52, brandTop: 120 },
};

const DURATION = 28;

const CAPTIONS = [
  [0.4, 3.4, "Which parts of consulting work can Claude take on?"],
  [3.8, 4.2, "We mapped 32 workflows across eight areas of sustainability consulting."],
  [8.4, 4.2, "Today, every LEED credit narrative takes hours to write."],
  [13.0, 2.8, "Claude drafts each one from the team's own documents."],
  [15.9, 2.6, "The LEED AP edits and approves every narrative."],
  [18.8, 5.2, "Every workflow ends with a named professional's sign-off."],
  [24.4, 3.6, "See all 32 workflows at bakshilabs.github.io/profile"],
];

const AREAS = [
  "LEED certification",
  "Energy modelling",
  "ESG reporting",
  "Embodied carbon",
  "Measurement and verification",
  "Building performance standards",
  "Healthy materials",
  "Climate risk",
];

// LEED map. Square: row 1 left to right, row 2 right to left.
// Reel: a two-column zigzag down the frame.
const NODE_TEXT = {
  t: { kind: "trigger", label: "Project registered", sub: "Target: LEED Gold" },
  c1: { kind: "claude", label: "Builds the credit tracker", sub: "Owners, due dates, points" },
  c2: { kind: "claude", label: "Drafts credit narratives", sub: "Checks every form" },
  h: { kind: "review", label: "Reviews every credit", sub: "Signs the submission", tag: "LEED AP" },
  g: { kind: "system", label: "Preliminary review", sub: "Comments by credit", tag: "GBCI" },
  o: { kind: "output", label: "Certified", sub: "Gold, on the plaque" },
};
const ORDER = ["t", "c1", "c2", "h", "g", "o"];
const MAPS = {
  square: { nw: 300, nh: 186, pos: { t: [0, 70], c1: [350, 70], c2: [700, 70], h: [700, 430], g: [350, 430], o: [0, 430] } },
  reel: { nw: 460, nh: 200, pos: { t: [0, 40], c1: [540, 40], c2: [540, 340], h: [0, 340], g: [0, 640], o: [540, 640] } },
};

const REEL_CSS = `
.brand { font-size: 26px; }
#s1 .kicker { top: 300px; font-size: 26px; }
#s1 h1 { top: 370px; font-size: 168px; }
#s1 .rule { top: 750px; left: 300px; width: 400px; }
#s2 .kicker { top: 0; font-size: 26px; }
.areas { top: 60px; grid-template-columns: 1fr; gap: 14px; }
.area { height: 108px; grid-template-columns: 60px 1fr auto; grid-template-rows: 1fr; align-items: center; padding: 0 30px; }
.area__name { font-size: 38px; }
#s3 .card { top: 60px; }
.card h2 { font-size: 76px; }
.pain { font-size: 32px; }
.hours { top: 640px; flex-wrap: wrap; }
.hour { flex: 1 1 calc(50% - 8px); height: 170px; }
.hour b { font-size: 60px; }
#s4 .card h2 { font-size: 68px; }
.docs { top: 470px; flex-direction: column; gap: 14px; }
.doc { font-size: 34px; padding: 28px 30px; }
.sign { top: 520px; padding: 34px 36px; }
.sign span { font-size: 44px; }
.sign b { font-size: 20px; }
#s5 .kicker { font-size: 26px; }
.node { padding: 28px 30px; gap: 10px; }
.node__l { font-size: 38px; }
.node__k { font-size: 19px; }
.node__s { font-size: 24px; }
.ring { border-radius: 26px; }
#s6 .kicker { top: 220px; font-size: 26px; }
#s6 h1 { top: 290px; font-size: 150px; line-height: .98; }
.stats { top: 640px; left: 60px; right: 60px; }
.stats b { font-size: 110px; }
.url { top: 880px; }
.url span { font-size: 36px; padding: 22px 40px; }
`;

function words(text, cls) {
  return text
    .split(" ")
    .map((w) => `<span class="${cls}">${w}</span>`)
    .join(" ");
}

function chars(text) {
  return text
    .split(" ")
    .map((w) => `<span class="word">${[...w].map((c) => `<span class="ch">${c}</span>`).join("")}</span>`)
    .join(" ");
}

function page(name, f) {
  const capHtml = CAPTIONS.map(
    ([s, d, t], i) =>
      `<div class="clip cap" id="cap${i}" data-start="${s}" data-duration="${d}" data-track-index="20"><p>${words(t, "cw")}</p></div>`
  ).join("\n    ");

  const areaHtml = AREAS.map(
    (a, i) =>
      `<div class="area" id="area${i}"><span class="area__n">0${i + 1}</span><span class="area__name">${a}</span><span class="area__k">4 workflows</span></div>`
  ).join("\n          ");

  const M = MAPS[name], NW = M.nw, NH = M.nh;
  const NODES = ORDER.map((id) => ({ id, ...NODE_TEXT[id], x: M.pos[id][0], y: M.pos[id][1] }));
  const nodeHtml = NODES.map(
    (n) =>
      `<div class="node node--${n.kind}" id="n-${n.id}" style="left:${n.x}px;top:${n.y}px">
            <span class="node__k">${{ trigger: "Trigger", claude: "Claude", review: "Sign-off", system: "Review", output: "Result" }[n.kind]}${n.tag ? ` · ${n.tag}` : ""}</span>
            <span class="node__l">${n.label}</span>
            <span class="node__s">${n.sub}</span>
          </div>`
  ).join("\n          ");

  // connectors run edge to edge between consecutive nodes
  const segs = NODES.slice(0, -1).map((a, i) => {
    const b = NODES[i + 1];
    const ac = [a.x + NW / 2, a.y + NH / 2], bc = [b.x + NW / 2, b.y + NH / 2];
    if (a.y === b.y) {
      const dir = Math.sign(bc[0] - ac[0]);
      return `M${ac[0] + (dir * NW) / 2} ${ac[1]} L${bc[0] - (dir * NW) / 2} ${bc[1]}`;
    }
    const dir = Math.sign(bc[1] - ac[1]);
    return `M${ac[0]} ${ac[1] + (dir * NH) / 2} L${bc[0]} ${bc[1] - (dir * NH) / 2}`;
  });
  const review = NODES.find((n) => n.id === "h");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Workflow Discovery · ${name}</title>
<style>
@font-face { font-family: "Schibsted Grotesk"; font-weight: 400 800; src: url("fonts/schibsted-grotesk-var.woff2") format("woff2"); }
@font-face { font-family: "Inter"; font-weight: 100 900; src: url("fonts/inter-var.woff2") format("woff2"); }
@font-face { font-family: "IBM Plex Mono"; font-weight: 500; src: url("fonts/plex-mono-500.woff2") format("woff2"); }
:root {
  --ink: #0c1b24; --ink-2: #122630; --ink-3: #18323d; --line: rgba(143,166,176,.22);
  --text: #ffffff; --dim: #93a7b0; --teal: #0e9c8e; --mint: #8fdcd2; --cyan: #59c7fc; --green: #16ffc6;
  --pain: #ff8a73;
}
* { box-sizing: border-box; margin: 0; }
html, body { background: var(--ink); }
#stage { position: relative; width: ${f.w}px; height: ${f.h}px; overflow: hidden; background: var(--ink); color: var(--text); font-family: "Inter", sans-serif; }
.grid { position: absolute; inset: -80px; background-image: linear-gradient(rgba(143,166,176,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(143,166,176,.07) 1px, transparent 1px); background-size: 60px 60px; }
.light { position: absolute; width: 1400px; height: 1400px; left: -160px; top: ${f.h / 2 - 900}px; border-radius: 50%; background: radial-gradient(circle, rgba(14,156,142,.22), rgba(14,156,142,0) 62%); }
.brand { position: absolute; left: 0; right: 0; top: ${f.brandTop + 52}px; text-align: center; font-family: "IBM Plex Mono", monospace; font-size: 22px; letter-spacing: .22em; text-transform: uppercase; color: var(--mint); opacity: ${f.brandTop ? 1 : 0}; }
.box { position: absolute; left: ${f.cx}px; top: ${f.cy}px; width: 1000px; height: ${f.bh}px; }
.scene { position: absolute; inset: 0; }
.kicker { font-family: "IBM Plex Mono", monospace; font-size: 24px; font-weight: 500; letter-spacing: .2em; text-transform: uppercase; color: var(--mint); }
.word { display: inline-block; white-space: nowrap; }
.ch { display: inline-block; }

/* captions */
.capband { position: absolute; left: 0; right: 0; top: ${f.cap - 60}px; bottom: 0; background: linear-gradient(rgba(12,27,36,0), rgba(7,17,23,.85) 40%); }
.cap { position: absolute; left: 70px; right: 70px; top: ${f.cap}px; }
.cap p { font-family: "Inter", sans-serif; font-weight: 600; font-size: ${f.capSize}px; line-height: 1.28; letter-spacing: -.01em; color: #fff; text-align: center; }
.cw { display: inline-block; opacity: 0; }

/* scene 1: title */
#s1 .kicker { position: absolute; left: 0; right: 0; top: 200px; text-align: center; opacity: 0; }
#s1 h1 { position: absolute; left: 0; right: 0; top: 260px; text-align: center; font-family: "Schibsted Grotesk", sans-serif; font-weight: 500; font-size: 132px; line-height: 1; letter-spacing: -.035em; }
#s1 .rule { position: absolute; left: 330px; width: 340px; top: 560px; height: 4px; border-radius: 2px; background: linear-gradient(90deg, var(--cyan), var(--green)); }

/* scene 2: practice areas */
#s2 .kicker { position: absolute; left: 0; top: 30px; opacity: 0; }
.areas { position: absolute; left: 0; top: 90px; width: 1000px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px 20px; }
.area { height: 130px; padding: 24px 26px; border-radius: 18px; background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); display: grid; grid-template-rows: auto 1fr auto; opacity: 0; }
.area__n { font-family: "IBM Plex Mono", monospace; font-size: 20px; color: var(--dim); letter-spacing: .1em; }
.area__name { white-space: nowrap; font-family: "Schibsted Grotesk", sans-serif; font-size: 29px; font-weight: 500; letter-spacing: -.015em; align-self: center; line-height: 1.1; }
.area__k { font-family: "IBM Plex Mono", monospace; font-size: 18px; letter-spacing: .14em; text-transform: uppercase; color: var(--mint); }

/* scenes 3 and 4: before and after */
.card { position: absolute; left: 60px; right: 60px; border-radius: 26px; padding: 40px 46px; background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line), 0 30px 60px -30px rgba(0,0,0,.6); opacity: 0; }
#s3 .card { top: 90px; }
.card .kicker { font-size: 22px; }
.card h2 { margin-top: 22px; font-family: "Schibsted Grotesk", sans-serif; font-weight: 500; font-size: 64px; line-height: 1.05; letter-spacing: -.03em; }
.pain { margin-top: 34px; display: inline-flex; align-items: center; gap: 14px; padding: 14px 22px; border-radius: 999px; background: rgba(255,138,115,.12); box-shadow: inset 0 0 0 1px rgba(255,138,115,.45); font-size: 28px; font-weight: 500; color: var(--pain); opacity: 0; }
.pain i { width: 12px; height: 12px; border-radius: 50%; background: var(--pain); }
.hours { position: absolute; left: 60px; right: 60px; top: 530px; display: flex; gap: 16px; }
.hour { flex: 1; height: 120px; border-radius: 18px; background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px; opacity: 0; }
.hour b { font-family: "Schibsted Grotesk", sans-serif; font-size: 44px; font-weight: 500; }
.hour span { font-family: "IBM Plex Mono", monospace; font-size: 18px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
#s4 .card { top: 40px; background: linear-gradient(160deg, #0f3a3c, #102a33); box-shadow: inset 0 0 0 1px rgba(143,220,210,.4), 0 30px 60px -30px rgba(0,0,0,.6); }
#s4 .card h2 { font-size: 56px; }
.docs { position: absolute; left: 60px; right: 60px; top: 380px; display: flex; gap: 16px; }
.doc { flex: 1; padding: 26px 24px; border-radius: 16px; background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); font-size: 28px; font-weight: 500; opacity: 0; }
.doc span { display: block; margin-bottom: 8px; font-family: "IBM Plex Mono", monospace; font-size: 18px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
.sign { position: absolute; left: 60px; right: 60px; top: 380px; display: flex; align-items: center; gap: 22px; padding: 26px 32px; border-radius: 22px; background: #ffffff; color: var(--ink); opacity: 0; }
.sign i { flex: none; width: 58px; height: 58px; border-radius: 50%; background: var(--teal); display: grid; place-items: center; }
.sign i svg { width: 30px; height: 30px; }
.sign b { display: block; font-family: "IBM Plex Mono", monospace; font-size: 16px; letter-spacing: .16em; text-transform: uppercase; color: var(--teal); font-weight: 500; }
.sign span { font-family: "Schibsted Grotesk", sans-serif; font-size: 36px; font-weight: 500; letter-spacing: -.02em; }

/* scene 5: map */
#s5 .kicker { position: absolute; left: 0; top: 0; opacity: 0; }
.map { position: absolute; left: 0; top: 40px; width: 1000px; height: ${f.bh - 40}px; }
.map svg { position: absolute; inset: 0; overflow: visible; }
.map path { fill: none; stroke: var(--mint); stroke-width: 3; stroke-linecap: round; opacity: 0; }
.node { position: absolute; width: ${NW}px; height: ${NH}px; padding: 22px 24px; border-radius: 18px; background: var(--ink-2); box-shadow: inset 0 0 0 1px var(--line); display: flex; flex-direction: column; gap: 8px; opacity: 0; }
.node__k { font-family: "IBM Plex Mono", monospace; font-size: 17px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
.node__l { font-family: "Schibsted Grotesk", sans-serif; font-size: 30px; font-weight: 500; line-height: 1.08; letter-spacing: -.015em; }
.node__s { font-size: 21px; color: var(--dim); }
.node--claude { background: linear-gradient(160deg, #0f3a3c, #102a33); box-shadow: inset 0 0 0 1px rgba(143,220,210,.4); }
.node--claude .node__k { color: var(--mint); }
.node--review { background: #fff; color: var(--ink); box-shadow: none; }
.node--review .node__k { color: var(--teal); }
.node--review .node__s { color: #46585f; }
.node--output .node__k { color: var(--green); }
.ring { position: absolute; left: ${review.x - 10}px; top: ${review.y - 10}px; width: ${NW + 20}px; height: ${NH + 20}px; border-radius: 24px; box-shadow: 0 0 0 3px var(--green); opacity: 0; }

/* scene 6: end card */
#s6 .kicker { position: absolute; left: 0; right: 0; top: 170px; text-align: center; opacity: 0; }
#s6 h1 { position: absolute; left: 0; right: 0; top: 230px; text-align: center; font-family: "Schibsted Grotesk", sans-serif; font-weight: 500; font-size: 100px; line-height: 1; letter-spacing: -.035em; opacity: 0; }
.stats { position: absolute; left: 140px; right: 140px; top: 390px; display: flex; justify-content: space-between; opacity: 0; }
.stats div { text-align: center; }
.stats b { display: block; font-family: "Schibsted Grotesk", sans-serif; font-size: 84px; font-weight: 500; letter-spacing: -.03em; background: linear-gradient(90deg, var(--cyan), var(--green)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.stats span { font-family: "IBM Plex Mono", monospace; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; color: var(--dim); }
.url { position: absolute; left: 0; right: 0; top: 600px; text-align: center; opacity: 0; }
.url span { display: inline-block; padding: 18px 34px; border-radius: 999px; background: #fff; color: var(--ink); font-size: 30px; font-weight: 600; }
${name === "reel" ? REEL_CSS : ""}
</style>
</head>
<body>
<div id="stage" data-composition-id="root" data-start="0" data-width="${f.w}" data-height="${f.h}" data-duration="${DURATION}" data-fps="30">
  <div class="clip" id="bg" data-start="0" data-duration="${DURATION}" data-track-index="0">
    <div class="grid" id="grid"></div>
    <div class="light" id="light"></div>
    <div class="brand" id="brand">Bakshi Labs</div>
  </div>
  <div class="box">
    <div class="clip scene" id="s1" data-start="0" data-duration="3.8" data-track-index="2">
      <p class="kicker" id="s1k">Bakshi Labs · Consulting example</p>
      <h1 id="s1h">${chars("Workflow")}<br />${chars("Discovery")}</h1>
      <div class="rule" id="s1r"></div>
    </div>
    <div class="clip scene" id="s2" data-start="3.8" data-duration="4.5" data-track-index="2">
      <p class="kicker" id="s2k">8 practice areas · 32 workflows</p>
      <div class="areas">
          ${areaHtml}
      </div>
    </div>
    <div class="clip scene" id="s3" data-start="8.3" data-duration="4.6" data-track-index="2">
      <div class="card" id="s3c">
        <p class="kicker">LEED certification · Today</p>
        <h2>Write a narrative for every credit</h2>
        <p class="pain" id="s3p"><i></i>Hours per credit, on every project</p>
      </div>
      <div class="hours">
        <div class="hour" id="h1"><b>1 h</b><span>Credit 1</span></div>
        <div class="hour" id="h2"><b>3 h</b><span>Credit 2</span></div>
        <div class="hour" id="h3"><b>5 h</b><span>Credit 3</span></div>
        <div class="hour" id="h4"><b>8 h</b><span>Credit 4</span></div>
      </div>
    </div>
    <div class="clip scene" id="s4" data-start="12.9" data-duration="5.8" data-track-index="2">
      <div class="card" id="s4c">
        <p class="kicker">With Claude</p>
        <h2>Claude drafts each narrative from the team's documents</h2>
      </div>
      <div class="docs">
        <div class="doc" id="d1"><span>Source</span>Drawings and specs</div>
        <div class="doc" id="d2"><span>Source</span>Energy reports</div>
        <div class="doc" id="d3"><span>Source</span>Credit forms</div>
      </div>
      <div class="sign" id="s4s">
        <i><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></i>
        <div><b>Sign-off · LEED AP</b><span>Edits and approves each one</span></div>
      </div>
    </div>
    <div class="clip scene" id="s5" data-start="18.7" data-duration="5.7" data-track-index="2">
      <p class="kicker" id="s5k">LEED documentation · Workflow map</p>
      <div class="map">
        <svg viewBox="0 0 1000 ${f.bh - 40}">${segs.map((d, i) => `<path id="p${i}" d="${d}" />`).join("")}</svg>
        <div class="ring" id="ring"></div>
          ${nodeHtml}
      </div>
    </div>
    <div class="clip scene" id="s6" data-start="24.4" data-duration="3.6" data-track-index="2">
      <p class="kicker" id="s6k">Consulting example</p>
      <h1 id="s6h">${name === "reel" ? "Workflow<br />Discovery" : "Workflow Discovery"}</h1>
      <div class="stats" id="s6s">
        <div><b>8</b><span>Practice areas</span></div>
        <div><b>32</b><span>Workflows</span></div>
        <div><b>8</b><span>Maps</span></div>
      </div>
      <p class="url" id="s6u"><span>bakshilabs.github.io/profile</span></p>
    </div>
  </div>
  <div class="clip capband" id="capband" data-start="0" data-duration="${DURATION}" data-track-index="19"></div>
    ${capHtml}
</div>
<script src="gsap.min.js"></script>
<script>
var tl = gsap.timeline({ paused: true });
var E = "power3.out";

// background drift, written as explicit segments
for (var i = 0; i < 7; i++) {
  tl.to("#light", { x: i % 2 ? -60 : 60, y: i % 2 ? 40 : -40, duration: 4, ease: "sine.inOut" }, i * 4);
}
tl.fromTo("#grid", { y: 0 }, { y: -60, duration: ${DURATION}, ease: "none" }, 0);

// captions: words rise in, then the line fades out
${JSON.stringify(CAPTIONS)}.forEach(function (c, i) {
  var ws = document.querySelectorAll("#cap" + i + " .cw");
  tl.fromTo(ws, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.35, ease: E, stagger: 0.05 }, c[0] + 0.05);
  if (i < ${CAPTIONS.length - 1}) tl.to(ws, { opacity: 0, duration: 0.25 }, c[0] + c[1] - 0.3);
});

// scene 1
tl.fromTo("#s1k", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: E }, 0.1);
tl.fromTo("#s1h", { scale: 1.06 }, { scale: 1, duration: 3.4, ease: "power2.out" }, 0);
tl.fromTo("#s1r", { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: "expo.out" }, 1.1);
tl.to("#s1", { opacity: 0, y: -30, duration: 0.4, ease: "power2.in" }, 3.4);

// scene 2
tl.fromTo("#s2k", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, 3.9);
tl.fromTo(".area", { opacity: 0, y: 40, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: E, stagger: 0.12 }, 4.0);
tl.to(".area", { opacity: 0.35, duration: 0.4 }, 7.3);
tl.to("#area0", { opacity: 1, scale: 1.04, duration: 0.4, ease: E }, 7.3);
tl.to("#s2", { opacity: 0, duration: 0.35 }, 7.95);

// scene 3
tl.fromTo("#s3c", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.7, ease: E }, 8.4);
tl.fromTo("#s3p", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.5, ease: E }, 9.3);
tl.fromTo(".hour", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: E, stagger: 0.45 }, 9.9);
tl.to("#s3", { opacity: 0, y: -30, duration: 0.4, ease: "power2.in" }, 12.5);

// scene 4
tl.fromTo("#s4c", { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.7, ease: E }, 13.0);
tl.fromTo(".doc", { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.55, ease: E, stagger: 0.18 }, 13.7);
tl.to(".doc", { y: -40, opacity: 0, scale: 0.9, duration: 0.5, ease: "power2.in", stagger: 0.1 }, 15.2);
tl.fromTo("#s4s", { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.6)" }, 15.9);
tl.to("#s4", { opacity: 0, duration: 0.35 }, 18.3);

// scene 5: pen draws through the map, the sign-off node lands with a ring
tl.fromTo("#s5k", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, 18.8);
var order = ["t", "c1", "c2", "h", "g", "o"];
var t0 = 19.0;
order.forEach(function (id, k) {
  var at = t0 + k * 0.62;
  tl.fromTo("#n-" + id, { opacity: 0, scale: 0.9, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "back.out(1.7)" }, at);
  if (k < order.length - 1) {
    var p = document.getElementById("p" + k), L = p.getTotalLength();
    tl.set(p, { strokeDasharray: L, strokeDashoffset: L }, 0);
    tl.set(p, { opacity: 1 }, at + 0.3);
    tl.to(p, { strokeDashoffset: 0, duration: 0.32, ease: "power1.inOut" }, at + 0.3);
  }
});
tl.fromTo("#ring", { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 0.5, ease: E }, t0 + 3 * 0.62 + 0.3);
for (var r = 0; r < 2; r++) {
  tl.to("#ring", { opacity: 0.35, duration: 0.45, ease: "sine.inOut" }, 22.0 + r * 0.9);
  tl.to("#ring", { opacity: 1, duration: 0.45, ease: "sine.inOut" }, 22.45 + r * 0.9);
}
tl.to("#s5", { opacity: 0, duration: 0.35 }, 24.05);

// scene 6
tl.fromTo("#s6k", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5, ease: E }, 24.5);
tl.fromTo("#s6h", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out" }, 24.6);
tl.fromTo("#s6s", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, ease: E }, 25.1);
tl.fromTo("#s6u", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: E }, 25.6);

window.__timelines = window.__timelines || {};
window.__timelines["root"] = tl;
</script>
</body>
</html>
`;
}

for (const [name, f] of Object.entries(FORMATS)) {
  const dir = join(here, name);
  mkdirSync(join(dir, "fonts"), { recursive: true });
  writeFileSync(join(dir, "index.html"), page(name, f));
  for (const font of ["schibsted-grotesk-var.woff2", "inter-var.woff2", "plex-mono-500.woff2"]) {
    copyFileSync(join(root, "assets", "fonts", font), join(dir, "fonts", font));
  }
  const gsapSrc = process.env.GSAP || join(root, "node_modules", "gsap", "dist", "gsap.min.js");
  if (existsSync(gsapSrc)) copyFileSync(gsapSrc, join(dir, "gsap.min.js"));
}
console.log("built", Object.keys(FORMATS).join(", "));
