/* Bakshi Labs: agent architecture as one guided 3D story.
   The eight tools from AGENT_DECK stand in one world, on a ladder from no AI
   to nine agents. Each step of the story is a camera pose, a highlight state
   and a caption. Cards are real 3D slabs (RoundedBoxGeometry with
   MeshPhysicalMaterial, lit by RoomEnvironment) whose faces are HTML placed
   with CSS3DRenderer, so the text stays sharp. Without WebGL, the same steps
   run as a 2D version with SVG connectors, and phones get a stacked list. */

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
const AGENT_KINDS = { agent: 1, build: 1, sub: 1 };
const LADDER = ["materialscan", "rbe", "southwark", "modelchat", "spd", "worknodescanvas", "growthsignal", "prospecht"];
const BW = 1472, BH = 600; // board size, in world units (one unit is one CSS pixel of the flat deck)
const T = 16; // slab thickness
const TILT = 8; // boards lean back, and the camera looks down, by this many degrees
const SVGNS = "http://www.w3.org/2000/svg";

const slideById = {};
DECK.slides.forEach(function (s) {
  slideById[s.id] = s;
});

/* ---------- The story ---------- */

const CHAPTERS = [
  { id: "agent", t: "What an agent is", s: "Agent" },
  { id: "map", t: "Eight tools", s: "Tools" },
  { id: "noai", t: "No AI while it runs", s: "No AI" },
  { id: "one", t: "One agent with tools", s: "One agent" },
  { id: "shared", t: "Agents around shared data", s: "Shared data" },
  { id: "record", t: "One record through Prospecht", s: "Prospecht" },
  { id: "finding", t: "The finding", s: "Finding" },
  { id: "explore", t: "Explore", s: "Explore" }
];

const SW_BUILD = ["lbsm", "epc", "ons", "session", "pack", "files"];
const SW_RUN = ["controls", "recompute", "decode", "package", "mees", "score", "map", "views"];
const RECORD_PATH = ["feeds", "sorter", "verify", "dedupe", "db", "score", "views", "tasks"];

const STEPS = [
  {
    id: "agent", ch: 0, view: "intro", kicker: DECK.cover.kicker, title: DECK.cover.title,
    cap: "An agent is an AI model, such as Claude, given a task and tools. This story follows how the agents in eight tools share work with code, data and people."
  },
  {
    id: "map", ch: 1, view: "map", title: "Eight tools",
    cap: "The eight tools are lined up from one with no AI to one with nine agents. Each cluster is the real map of how that tool works, and you can select one to fly to it."
  },
  {
    id: "materialscan", ch: 2, tool: "materialscan", title: "MaterialScan", flow: "all",
    cap: "MaterialScan has no agents. Verdicts were written by hand and published by scripts, and no AI runs while the site is used."
  },
  {
    id: "rbe", ch: 2, tool: "rbe", title: "Reference Buildings Explorer",
    focus: ["doe", "main", "spec", "shell", "subs", "data", "va", "vb", "vc", "bundle"],
    seq: [["doe>main"], ["main>spec", "main>shell"], ["spec>subs", "shell>subs"], ["subs>bundle"]],
    cap: "One Claude Code agent wrote a build plan and started four subagents in parallel to build the parts."
  },
  {
    id: "rbe-2", ch: 2, tool: "rbe", title: "Reference Buildings Explorer", yaw: -20,
    ghost: ["main", "spec", "shell", "subs", "data", "va", "vb", "vc"], ghostDrop: { y: -40, z: -420 },
    focus: ["bundle", "dash"], flow: ["bundle>dash"],
    cap: "The finished dashboard runs from one 1.9 MB file that opens straight from disk. The five build agents have no part in running it."
  },
  {
    id: "southwark", ch: 2, tool: "southwark", title: "Southwark Retrofit Atlas",
    focus: SW_BUILD, flow: ["lbsm>pack", "epc>pack", "ons>pack", "session>pack", "pack>files"],
    cap: "One Claude Code session wrote and ran the data scripts. They shrink the raw data on 149,062 homes into three compact files."
  },
  {
    id: "southwark-2", ch: 2, tool: "southwark", title: "Southwark Retrofit Atlas", yaw: -24,
    ghost: SW_BUILD, ghostDrop: { y: 0, z: -560 }, hideDividers: true, focus: SW_RUN.concat(["files"]),
    flow: ["files>decode", "controls>recompute", "recompute>package", "recompute>score", "decode>package", "decode>mees", "package>score", "score>map", "score>views", "mees>views"],
    cap: "In the browser, the ranking runs with no AI. Each change to budget, weights, strategy or prices reruns only what it needs."
  },
  {
    id: "modelchat", ch: 3, tool: "modelchat", title: "ModelChat",
    focus: ["chat", "helper", "agent"], seq: [["chat>helper"], ["helper>agent"], ["agent>helper"], ["helper>chat"]],
    cap: "One Claude agent answers questions about a 3D building model. Each message goes from the chat panel through a local helper to Claude and back."
  },
  {
    id: "modelchat-2", ch: 3, tool: "modelchat", title: "ModelChat", orbit: 12,
    focus: ["agent", "mcp", "router", "index", "viewer"],
    seq: [["agent>mcp"], ["mcp>router"], ["router>index"], ["index>router"], ["router>viewer"], ["viewer>router"], ["router>mcp"], ["mcp>agent"]],
    cap: "The assistant checks every number with a tool. Six of its tools read the model, and eight move the 3D view in the browser."
  },
  {
    id: "spd", ch: 3, tool: "spd", title: "Strategic Project Discovery", orbit: 8,
    seq: [["sector>fetch", "region>fetch", "sources>fetch"], ["fetch>gemini"], ["gemini>search"], ["search>gemini"], ["gemini>parse"], ["parse>results"], ["results>list", "results>map", "results>files"]],
    cap: "One agent on Google's Gemini runs each sector scan. It searches the web and returns 8 to 20 current leads, each scored for fit."
  },
  {
    id: "growthsignal", ch: 4, tool: "growthsignal", title: "GrowthSignal", flow: "all",
    cap: "GrowthSignal gathers public tenders and news into one database. Seven Claude agents read and write it."
  },
  {
    id: "growthsignal-2", ch: 4, tool: "growthsignal", title: "GrowthSignal",
    ring: { store: "db", members: ["enrich", "briefing", "chat", "campus", "sec", "news", "deal"] },
    flow: ["enrich>db", "db>enrich", "briefing>db", "db>briefing", "db>deal", "deal>db", "db>news", "news>db", "sec>db", "db>campus", "campus>db", "db>chat", "chat>db"],
    cap: "Here the seven agents sit around the shared database. Each one reads its inputs from it and writes its results back, and none of them calls another."
  },
  {
    id: "worknodescanvas", ch: 4, tool: "worknodescanvas", title: "WorkNodesCanvas",
    ring: { store: "state", members: ["chat", "builder", "checks", "agent", "salvage"] },
    flow: ["chat>checks", "checks>state", "agent>state", "salvage>state", "builder>state", "agent>salvage"],
    cap: "Four Claude agents run from cards on a canvas and keep their results in one state file. When an analysis hits its 10-minute limit, the rescue planner takes over and the app joins the parts."
  },
  {
    id: "prospecht", ch: 5, tool: "prospecht", title: "Prospecht", focus: RECORD_PATH, hotPath: true,
    seq: [["feeds>sorter"], ["sorter>verify"], ["verify>dedupe"], ["dedupe>db"], ["db>score"], ["score>views"], ["views>tasks"], ["tasks>db"]],
    cap: "Prospecht finds projects worth bidding for. The next steps follow one record through its pipeline, starting as an official tender notice that arrives with no AI."
  },
  {
    id: "prospecht-2", ch: 5, tool: "prospecht", title: "Feed sorter", near: ["feeds", "sorter", "verify"], focus: ["feeds", "sorter"], seq: [["feeds>sorter"]], yaw: 9,
    cap: "The feed sorter, a Claude agent, reads notices in batches of 40. It sets aside non-design work and scores the rest, citing each notice."
  },
  {
    id: "prospecht-3", ch: 5, tool: "prospecht", title: "Source check", near: ["sorter", "verify", "dedupe"], focus: ["sorter", "verify"], seq: [["sorter>verify"]], yaw: -8,
    cap: "A code step then finds each cited passage on its page. Each record gets a status and a count of the websites behind it."
  },
  {
    id: "prospecht-4", ch: 5, tool: "prospecht", title: "Merge and log", near: ["verify", "dedupe", "wsjson", "db"], focus: ["verify", "dedupe"], seq: [["verify>dedupe"], ["dedupe>db"]], yaw: 8,
    cap: "Merge and log joins duplicates, matched by link, title, client and place, and logs what changed."
  },
  {
    id: "prospecht-5", ch: 5, tool: "prospecht", title: "Verdict calculator", near: ["db", "profile", "score", "views"], focus: ["db", "profile", "score"], seq: [["dedupe>db"], ["db>score", "profile>score"]], yaw: -8,
    cap: "The verdict calculator adds Claude's two scores to its own for scale, location and timing. The firm profile's weights and thresholds turn the scores into a verdict."
  },
  {
    id: "prospecht-6", ch: 5, tool: "prospecht", title: "App views", near: ["score", "views", "deploy"], focus: ["score", "views"], seq: [["score>views"]], yaw: 9,
    cap: "The record appears in the app views, which hold 13 screens from Today to the map."
  },
  {
    id: "prospecht-7", ch: 5, tool: "prospecht", title: "Agents on buttons", near: ["views", "assess", "ask", "db"], focus: ["views", "tasks", "assess", "recheck", "brief", "weekly", "drafter", "calib", "ask", "db"],
    seq: [["views>tasks"], ["tasks>db"]], pitch: 14,
    cap: "Buttons on these screens start seven more agents, such as the pursuit brief writer and the ask analyst. Their results go back to the browser database."
  },
  {
    id: "finding", ch: 6, view: "map", finding: true, title: "The finding",
    cap: "In all eight tools, no agent in a running tool hands work straight to another agent. Code, shared data and people do the joining."
  },
  {
    id: "explore", ch: 7, view: "map", explore: true, title: "Explore the map",
    cap: "Choose a tool to open its full map. Hover over a card to flip it, and click it for details."
  }
];
const stepIndex = {};
STEPS.forEach(function (s, i) {
  stepIndex[s.id] = i;
});
function exploreStep(toolId) {
  const sl = slideById[toolId];
  return { id: "explore-" + toolId, ch: 7, tool: toolId, title: sl.title, flow: "all", explore: true, cap: sl.lede };
}

/* ---------- Helpers ---------- */

const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduce = reduceQuery.matches;
const touch = window.matchMedia("(hover: none)");
const root = document.documentElement;
const body = document.body;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function svgEl(tag, attrs) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}
function pad(n) {
  return (n < 10 ? "0" : "") + n;
}
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
const easeInOut = function (t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeOut = function (t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
};
const easeOutCubic = function (t) {
  return 1 - Math.pow(1 - t, 3);
};
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

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
  return cleanPts(pts);
}
function cleanPts(pts) {
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
function pathD(p) {
  let d = "M" + p[0][0] + " " + p[0][1];
  for (let i = 1; i < p.length - 1; i++) {
    const x0 = p[i - 1][0], y0 = p[i - 1][1], x1 = p[i][0], y1 = p[i][1], x2 = p[i + 1][0], y2 = p[i + 1][1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const r = Math.min(12, l1 / 2, l2 / 2);
    const ax = x1 + ((x0 - x1) / l1) * r, ay = y1 + ((y0 - y1) / l1) * r;
    const bx = x1 + ((x2 - x1) / l2) * r, by = y1 + ((y2 - y1) / l2) * r;
    d += " L" + ax + " " + ay + " Q" + x1 + " " + y1 + " " + bx + " " + by;
  }
  const last = p[p.length - 1];
  return d + " L" + last[0] + " " + last[1];
}
function densify(p) {
  const out = [p[0].slice()];
  for (let i = 1; i < p.length - 1; i++) {
    const x0 = p[i - 1][0], y0 = p[i - 1][1], x1 = p[i][0], y1 = p[i][1], x2 = p[i + 1][0], y2 = p[i + 1][1];
    const l1 = Math.hypot(x1 - x0, y1 - y0), l2 = Math.hypot(x2 - x1, y2 - y1);
    const r = Math.min(12, l1 / 2, l2 / 2);
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

/* Every tool's graph, prepared once for both the 3D and the 2D views. */
const GRAPHS = {};
LADDER.forEach(function (id) {
  const sl = slideById[id];
  const items = {};
  (sl.groups || []).forEach(function (g, gi) {
    const gid = g.id || "group" + gi;
    items[gid] = { id: gid, group: g, x: g.x, y: g.y, w: g.w, h: g.h };
  });
  sl.nodes.forEach(function (n) {
    const r = rect(sl, n);
    items[n.id] = { id: n.id, n: n, x: r.x, y: r.y, w: r.w, h: r.h };
    (sl.groups || []).forEach(function (g) {
      if (g.id && r.x >= g.x && r.y >= g.y && r.x + r.w <= g.x + g.w && r.y + r.h <= g.y + g.h) items[n.id].inGroup = g.id;
    });
  });
  const wires = sl.edges.map(function (e, j) {
    const a = items[e[0]], b = items[e[1]], o = e[2] || {};
    const pts = route(a, b, o);
    return { a: e[0], b: e[1], o: o, j: j, pts: pts, len: pathLength(pts) };
  });
  GRAPHS[id] = { sl: sl, items: items, wires: wires };
});
function findWire(g, ref) {
  const parts = ref.split(">");
  for (let i = 0; i < g.wires.length; i++) {
    const w = g.wires[i];
    if (w.a === parts[0] && w.b === parts[1]) return { w: w, rev: false };
    if (w.a === parts[1] && w.b === parts[0]) return { w: w, rev: true };
  }
  return null;
}

/* ---------- Page elements ---------- */

const deckEl = document.querySelector("[data-deck]");
const nav = document.querySelector("[data-nav]");
const modal = document.querySelector("[data-modal]");
const railEl = document.querySelector("[data-rail]");
const capEl = document.querySelector("[data-caption]");
const capKicker = document.querySelector("[data-cap-kicker]");
const capTitle = document.querySelector("[data-cap-title]");
const capText = document.querySelector("[data-cap-text]");
const statsEl = document.querySelector("[data-stats]");
const countEl = document.querySelector("[data-count]");
const prevBtn = document.querySelector("[data-prev]");
const nextBtn = document.querySelector("[data-next]");
const backBtn = document.querySelector("[data-back]");
const ctaEl = document.querySelector("[data-cta]");
const exploreBtn = document.querySelector("[data-explore]");
const altLink = document.querySelector("[data-alt]");
const flatEl = document.querySelector("[data-flat]");
const listEl = document.querySelector("[data-list]");
const tipEl = document.querySelector("[data-tip]");
const glHost = document.querySelector("[data-gl-host]");

let cur = -1; // index in STEPS, or -1 for an explore tool view
let curStep = null;
let listMode = false;
let GLW = null; // the 3D world, once it loads
let mode = "pending"; // "gl" or "flat"

/* ---------- Count-up numbers ---------- */

function countSpan(text) {
  const wrap = el("span", "x-num");
  const m = /^([\d,]+)(.*)$/.exec(text);
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
    const t0 = performance.now() + 500 + k * 160;
    n.textContent = fmt(0);
    const step = function (now) {
      const t = clamp((now - t0) / 1400, 0, 1);
      n.textContent = fmt(to * easeOut(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ---------- Card faces (shared by 3D, 2D and list) ---------- */

function frontFace(n, small) {
  const kind = KINDS[n.k];
  const f = el("div", "c-face c-front c--" + kind.cls + " ck-" + n.k + (small ? " c--sm" : ""));
  const k = el("span", "c-kind");
  k.appendChild(el("i"));
  k.appendChild(document.createTextNode(kind.label));
  f.appendChild(k);
  f.appendChild(el("span", "c-name", n.n));
  f.appendChild(el("span", "c-short", n.s));
  return f;
}
function backFace(n, small) {
  const kind = KINDS[n.k];
  const f = el("div", "c-face c-back c--" + kind.cls + (small ? " c--sm" : ""));
  const h = el("span", "c-hint");
  h.appendChild(el("span", "c-hname", n.n));
  const a = el("span", "c-harrow");
  a.innerHTML = ARROW;
  h.appendChild(a);
  f.appendChild(h);
  f.appendChild(el("span", "c-btext", n.b));
  return f;
}
function isWide(it) {
  return it.w > 600;
}

/* Shrink a face's text a little, when needed, so it fits whole. */
function fitFaceText(face) {
  face.querySelectorAll(".c-short, .c-btext").forEach(function (t) {
    t.style.fontSize = "";
    const limit = face.clientHeight - parseFloat(getComputedStyle(face).paddingBottom) - t.offsetTop;
    if (limit <= 0) return;
    let size = parseFloat(getComputedStyle(t).fontSize);
    while (t.scrollHeight > limit + 1 && size > 12.5) {
      size -= 0.5;
      t.style.fontSize = size + "px";
    }
    t.toggleAttribute("data-clamped", t.scrollHeight > limit + 1);
  });
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
  } else modal.classList.add("is-open");
  mPanel.scrollTop = 0;
  modal.querySelector("[data-close-btn]").focus();
  if (GLW) GLW.unhover();
  body.classList.add("has-modal");
}
function closeModal() {
  if (modal.hidden) return;
  modal.classList.remove("is-open");
  body.classList.remove("has-modal");
  setTimeout(function () {
    if (!modal.classList.contains("is-open")) modal.hidden = true;
  }, reduce ? 0 : 220);
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

/* ---------- Story navigation ---------- */

function buildRail() {
  CHAPTERS.forEach(function (c, i) {
    const b = el("button", "x-rail__ch");
    b.type = "button";
    b.dataset.ch = i;
    b.appendChild(el("span", "x-rail__bar"));
    b.appendChild(el("span", "x-rail__label", c.s));
    b.setAttribute("aria-label", "Chapter " + (i + 1) + ": " + c.t);
    b.addEventListener("click", function () {
      for (let k = 0; k < STEPS.length; k++) if (STEPS[k].ch === i) return go(k);
    });
    railEl.appendChild(b);
  });
}
function chapterSteps(ch) {
  return STEPS.filter(function (s) {
    return s.ch === ch;
  });
}
function updateRail(step) {
  railEl.querySelectorAll(".x-rail__ch").forEach(function (b, i) {
    const steps = chapterSteps(i);
    let fill = 0;
    if (i < step.ch) fill = 1;
    else if (i === step.ch) {
      const k = steps.indexOf(step);
      fill = k < 0 ? 1 : (k + 1) / steps.length;
    }
    b.style.setProperty("--fill", fill);
    b.classList.toggle("is-current", i === step.ch);
    if (i === step.ch) b.setAttribute("aria-current", "step");
    else b.removeAttribute("aria-current");
  });
}

function stepFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  if (!id) return { i: 0 };
  if (stepIndex[id] != null) return { i: stepIndex[id] };
  if (/^explore-/.test(id) && GRAPHS[id.slice(8)]) return { i: -1, tool: id.slice(8) };
  // Links from the flat deck: a slide number or a tool id.
  if (/^\d+$/.test(id)) {
    const s = DECK.slides[parseInt(id, 10) - 2];
    if (s && stepIndex[s.id] != null) return { i: stepIndex[s.id] };
    return { i: 0 };
  }
  return { i: 0 };
}

function go(i, opts) {
  opts = opts || {};
  i = clamp(i, 0, STEPS.length - 1);
  if (i === cur && !opts.force) return;
  cur = i;
  show(STEPS[i], opts);
}
function goExplore(toolId, opts) {
  cur = -1;
  show(exploreStep(toolId), opts || {});
}
function next() {
  if (cur < 0) return go(stepIndex.explore);
  go(cur + 1);
}
function prev() {
  if (cur < 0) return go(stepIndex.explore);
  go(cur - 1);
}

function show(step, opts) {
  closeModal();
  const first = !curStep;
  curStep = step;
  body.dataset.step = step.id;
  const ch = CHAPTERS[step.ch];
  // Caption
  capEl.classList.remove("is-in");
  void capEl.offsetWidth;
  capKicker.textContent = step.kicker || ch.t;
  capTitle.textContent = step.title;
  capText.textContent = step.cap;
  capEl.classList.add("is-in");
  statsEl.hidden = !step.finding;
  if (step.finding) runCountUps(statsEl);
  ctaEl.hidden = !step.explore;
  backBtn.hidden = !(step.explore && step.tool);
  const total = STEPS.length;
  countEl.textContent = cur >= 0 ? pad(cur + 1) + " / " + pad(total) : "Explore";
  prevBtn.disabled = cur === 0;
  nextBtn.disabled = cur === total - 1;
  exploreBtn.classList.toggle("is-current", !!step.explore);
  updateRail(step);
  const hash = "#" + step.id;
  if (!opts.fromHash && location.hash !== hash) history.replaceState(null, "", step.id === "agent" ? location.pathname : hash);
  if (altLink) altLink.href = "agents.html" + (step.tool ? "#" + step.tool : "");
  if (mode === "gl" && GLW) GLW.show(step, first || opts.cut);
  else if (mode === "flat") renderFlat(step);
  if (step.tool && !first) showTip();
}

/* A one-time hint once the first tool view opens. */
let tipShown = false;
function showTip() {
  if (tipShown || listMode) return;
  tipShown = true;
  tipEl.textContent = touch.matches ? "Tap a card to flip it, and tap again for details." : "Hover over a card to flip it, and click it for details. Drag to look around.";
  tipEl.hidden = false;
  requestAnimationFrame(function () {
    tipEl.classList.add("is-on");
  });
  setTimeout(function () {
    tipEl.classList.remove("is-on");
    setTimeout(function () {
      tipEl.hidden = true;
    }, 300);
  }, 5600);
}

/* ---------- 2D version of the journey, used without WebGL ---------- */

let flatHover = null;
function renderFlat(step) {
  flatEl.textContent = "";
  flatEl.className = "x-flat x-flat--" + (step.tool ? "tool" : step.view);
  if (step.view === "intro") {
    const w = el("div", "x-flat__intro");
    ["Model", "Task", "Tools"].forEach(function (t) {
      const p = el("div", "x-part");
      p.appendChild(el("span", "c-kind", "Part"));
      p.appendChild(el("span", "c-name", t));
      w.appendChild(p);
    });
    const a = el("div", "x-part x-part--agent");
    a.appendChild(el("span", "c-kind", "Agent"));
    a.appendChild(el("span", "c-name", "Model, task and tools"));
    w.appendChild(a);
    flatEl.appendChild(w);
    return;
  }
  if (!step.tool) {
    const ladder = el("ol", "x-flat__ladder");
    LADDER.forEach(function (id, k) {
      const sl = slideById[id];
      const li = el("li");
      const b = el("button", "x-rung" + (sl.featured ? " x-rung--featured" : ""));
      b.type = "button";
      b.style.setProperty("--k", k);
      b.appendChild(el("span", "x-rung__num", pad(k + 1)));
      b.appendChild(el("span", "x-rung__name", sl.app));
      b.appendChild(el("span", "x-rung__tag", sl.tag));
      const agents = sl.nodes.filter(function (n) {
        return n.k === "agent";
      }).length;
      const dots = el("span", "x-rung__dots");
      for (let d = 0; d < agents; d++) dots.appendChild(el("i"));
      b.appendChild(dots);
      b.addEventListener("click", function () {
        if (step.explore) goExplore(id);
        else go(stepIndex[id]);
      });
      li.appendChild(b);
      ladder.appendChild(li);
    });
    const axis = el("div", "x-flat__axis");
    axis.appendChild(el("span", null, "No AI"));
    axis.appendChild(el("span", null, "Many agents"));
    flatEl.appendChild(axis);
    flatEl.appendChild(ladder);
    if (step.finding) flatEl.classList.add("is-finding");
    return;
  }
  const g = GRAPHS[step.tool];
  const stage = el("div", "x-flat__board");
  const wires = svgEl("svg", { class: "x-flat__wires", viewBox: "0 0 1472 600", "aria-hidden": "true" });
  stage.appendChild(wires);
  const focus = step.focus ? new Set(step.focus) : null;
  const ghost = step.ghost ? new Set(step.ghost) : new Set();
  const live = activeRefs(step);
  Object.keys(g.items).forEach(function (id) {
    const it = g.items[id];
    if (it.group) {
      const gr = el("div", "x-group" + (it.group.align ? " x-group--" + it.group.align : ""));
      gr.style.cssText = "left:" + it.x + "px;top:" + it.y + "px;width:" + it.w + "px;height:" + it.h + "px";
      gr.appendChild(el("span", "x-group__label", it.group.t));
      if (ghost.has(id)) gr.classList.add("is-ghost");
      stage.appendChild(gr);
    }
  });
  Object.keys(g.items).forEach(function (id) {
    const it = g.items[id];
    if (!it.n) return;
    const b = el("button", "x-fnode" + (isWide(it) ? " is-wide" : ""));
    b.type = "button";
    b.style.cssText = "left:" + it.x + "px;top:" + it.y + "px;width:" + it.w + "px;height:" + it.h + "px";
    b.setAttribute("aria-label", it.n.n + ", " + KINDS[it.n.k].label + ". " + it.n.s + " Open details.");
    const small = it.w < 240 || it.h < 125;
    b.appendChild(frontFace(it.n, small));
    b.appendChild(backFace(it.n, small));
    if (ghost.has(id) || (it.inGroup && ghost.has(it.inGroup))) b.classList.add("is-ghost");
    else if (focus && !focus.has(id) && !(it.inGroup && focus.has(it.inGroup))) b.classList.add("is-dim");
    b.addEventListener("click", function () {
      if (touch.matches && !b.classList.contains("is-flipped")) {
        stage.querySelectorAll(".is-flipped").forEach(function (o) {
          o.classList.remove("is-flipped");
        });
        b.classList.add("is-flipped");
        return;
      }
      openModal(g.sl, it.n, b);
    });
    b.addEventListener("mouseenter", function () {
      flatHover = id;
      stage.classList.add("is-hover");
      stage.querySelectorAll("[data-a]").forEach(function (w) {
        w.classList.toggle("is-hot", w.dataset.a === id || w.dataset.b === id || (it.inGroup && (w.dataset.a === it.inGroup || w.dataset.b === it.inGroup)));
      });
    });
    b.addEventListener("mouseleave", function () {
      flatHover = null;
      stage.classList.remove("is-hover");
      stage.querySelectorAll(".is-hot").forEach(function (w) {
        w.classList.remove("is-hot");
      });
    });
    stage.appendChild(b);
  });
  g.wires.forEach(function (w) {
    const d = pathD(w.pts);
    const hidden = ghost.has(w.a) || ghost.has(w.b);
    const p = svgEl("path", { d: d, class: "x-fwire" + (hidden ? " is-ghost" : "") + (live.has(w) ? " is-live" : ""), "data-a": w.a, "data-b": w.b });
    wires.appendChild(p);
    if (!hidden) {
      const ah = arrowHead(w.pts);
      wires.appendChild(svgEl("path", { d: ah, class: "x-fhead" + (live.has(w) ? " is-live" : ""), "data-a": w.a, "data-b": w.b }));
    }
    if (live.has(w) && !reduce && w.len >= 40) {
      const c = svgEl("circle", { r: "4.5", class: "x-fpulse" });
      const dirs = live.get(w);
      const m = svgEl("animateMotion", { dur: Math.max(1.6, w.len / 110).toFixed(2) + "s", repeatCount: "indefinite", path: d });
      if (dirs === "rev") {
        m.setAttribute("keyPoints", "1;0");
        m.setAttribute("keyTimes", "0;1");
        m.setAttribute("calcMode", "linear");
      }
      c.appendChild(m);
      wires.appendChild(c);
    }
    if (w.o.l && !hidden) {
      const at = labelPoint(w.pts);
      const lab = el("span", "x-wlabel", w.o.l);
      lab.style.cssText = "left:" + at[0] + "px;top:" + at[1] + "px";
      stage.appendChild(lab);
    }
  });
  flatEl.appendChild(stage);
  requestAnimationFrame(function () {
    fitFlat();
    stage.querySelectorAll(".c-face").forEach(fitFaceText);
  });
}
function arrowHead(pts) {
  const a = pts[pts.length - 2], b = pts[pts.length - 1];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const s = 8, w = 4.5;
  const bx = b[0] - Math.cos(ang) * s, by = b[1] - Math.sin(ang) * s;
  return "M" + b[0] + " " + b[1] + " L" + (bx - Math.sin(ang) * w) + " " + (by + Math.cos(ang) * w) + " L" + (bx + Math.sin(ang) * w) + " " + (by - Math.cos(ang) * w) + "Z";
}
/* Which connectors carry packets in a step, and in which direction. */
function activeRefs(step) {
  const out = new Map();
  if (!step.tool) return out;
  const g = GRAPHS[step.tool];
  let refs = [];
  if (step.flow === "all") {
    g.wires.forEach(function (w) {
      if (!w.o.quiet) out.set(w, "fwd");
    });
    return out;
  }
  if (step.flow) refs = step.flow;
  if (step.seq) step.seq.forEach(function (h) {
    refs = refs.concat(h);
  });
  refs.forEach(function (r) {
    const f = findWire(g, r);
    if (f && !out.has(f.w)) out.set(f.w, f.rev ? "rev" : "fwd");
  });
  return out;
}
function fitFlat() {
  const board = flatEl.querySelector(".x-flat__board");
  if (!board) return;
  const r = region();
  const s = Math.min((r.w - 16) / BW, (r.h - 8) / BH);
  board.style.transform = "translate(" + (r.x + (r.w - BW * s) / 2) + "px," + (r.y + (r.h - BH * s) / 2) + "px) scale(" + s + ")";
}

/* ---------- Phone list: every step, stacked ---------- */

function buildList() {
  listEl.textContent = "";
  STEPS.forEach(function (step, i) {
    const sec = el("section", "x-lstep");
    sec.id = "step-" + step.id;
    const ch = CHAPTERS[step.ch];
    sec.appendChild(el("p", "x-kicker", pad(i + 1) + " · " + (step.kicker || ch.t)));
    sec.appendChild(el(i === 0 ? "h1" : "h2", "x-lstep__title", step.title));
    sec.appendChild(el("p", "x-lstep__cap", step.cap));
    if (step.finding) {
      const st = el("dl", "x-lstats");
      DECK.cover.stats.forEach(function (x) {
        const d = el("div");
        const dt = el("dt");
        dt.appendChild(countSpan(x[0]));
        d.appendChild(dt);
        d.appendChild(el("dd", null, x[1]));
        st.appendChild(d);
      });
      sec.appendChild(st);
    }
    const ul = el("ul", "x-litems");
    if (step.tool) {
      const g = GRAPHS[step.tool];
      const ids = step.focus || g.sl.nodes.map(function (n) {
        return n.id;
      });
      const nodes = [];
      ids.forEach(function (id) {
        const it = g.items[id];
        if (!it) return;
        if (it.n) nodes.push(it.n);
        else g.sl.nodes.forEach(function (n) {
          if (g.items[n.id].inGroup === id) nodes.push(n);
        });
      });
      nodes.forEach(function (n) {
        const li = el("li");
        const btn = el("button", "x-litem x-litem--" + KINDS[n.k].cls);
        btn.type = "button";
        const kk = el("span", "c-kind");
        kk.appendChild(el("i"));
        kk.appendChild(document.createTextNode(KINDS[n.k].label));
        btn.appendChild(kk);
        btn.appendChild(el("span", "x-litem__name", n.n));
        btn.appendChild(el("span", "x-litem__text", n.s));
        btn.addEventListener("click", function () {
          openModal(g.sl, n, btn);
        });
        li.appendChild(btn);
        ul.appendChild(li);
      });
    } else if (step.view === "map") {
      LADDER.forEach(function (id, k) {
        const sl = slideById[id];
        const li = el("li");
        const a = el("a", "x-litem" + (sl.featured ? " x-litem--agent" : ""));
        a.href = "#step-" + id;
        a.appendChild(el("span", "c-kind", pad(k + 1)));
        a.appendChild(el("span", "x-litem__name", sl.app));
        a.appendChild(el("span", "x-litem__text", sl.tag));
        li.appendChild(a);
        ul.appendChild(li);
      });
    }
    if (ul.children.length) sec.appendChild(ul);
    if (step.explore) {
      const cta = el("a", "x-cta", "Start a conversation");
      cta.href = "index.html#contact";
      sec.appendChild(cta);
    }
    listEl.appendChild(sec);
  });
  runCountUps(listEl);
}

/* ---------- Layout ---------- */

function region() {
  const W = window.innerWidth, H = window.innerHeight;
  const full = body.classList.contains("is-full");
  const navH = full ? 0 : nav.offsetHeight;
  const railH = railEl.offsetHeight || 44;
  const capH = capEl.offsetHeight || 170;
  const top = navH + railH + 12;
  const bottom = H - capH - 8;
  return { x: 24, y: top, w: W - 48, h: Math.max(160, bottom - top), W: W, H: H };
}
function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  const was = listMode;
  listMode = W < 760 || (H > W && W < 900);
  body.classList.toggle("is-list", listMode);
  listEl.hidden = !listMode;
  root.style.setProperty("--nav-real", (body.classList.contains("is-full") ? 0 : nav.offsetHeight) + "px");
  if (listMode && !listEl.children.length) buildList();
  if (!listMode && mode === "pending") startWorld();
  if (mode === "gl" && GLW) GLW.resize();
  if (mode === "flat") fitFlat();
  if (was !== listMode && !listMode && curStep && mode === "flat") renderFlat(curStep);
}

/* ---------- The 3D world ---------- */

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) {
    return false;
  }
}
async function loadThree() {
  const timeout = new Promise(function (_, rej) {
    setTimeout(function () {
      rej(new Error("Three.js took too long to load"));
    }, 12000);
  });
  const mods = await Promise.race([
    Promise.all([
      import("three"),
      import("three/addons/renderers/CSS3DRenderer.js"),
      import("three/addons/geometries/RoundedBoxGeometry.js"),
      import("three/addons/environments/RoomEnvironment.js")
    ]),
    timeout
  ]);
  return { THREE: mods[0], CSS3D: mods[1], RBG: mods[2].RoundedBoxGeometry, Room: mods[3].RoomEnvironment };
}

function startWorld() {
  mode = "loading";
  if (!webglAvailable()) return startFlat("WebGL is not available");
  loadThree().then(function (m) {
    GLW = makeWorld(m);
    if (/debug/.test(location.search)) window.__x = GLW;
    if (!GLW) return startFlat("WebGL could not start");
    mode = "gl";
    body.classList.add("has-gl");
    GLW.resize();
    if (curStep) GLW.show(curStep, true);
  }).catch(function (err) {
    startFlat(err && err.message);
  });
}
function startFlat(reason) {
  mode = "flat";
  body.classList.add("no-gl");
  if (window.console && console.info) console.info("3D layer unavailable, using the 2D version:", reason);
  if (curStep) renderFlat(curStep);
}

const FLOOR_FS = `
uniform vec3 uColor;
uniform vec3 uCam;
varying vec3 vW;
float line(float v, float w) {
  float d = abs(fract(v - 0.5) - 0.5) / fwidth(v);
  return 1.0 - clamp(d - w, 0.0, 1.0);
}
void main() {
  float minor = max(line(vW.x / 100.0, 0.0), line(vW.z / 100.0, 0.0));
  float major = max(line(vW.x / 500.0, 0.25), line(vW.z / 500.0, 0.25));
  float dist = length(vW.xz - uCam.xz);
  float fade = exp(-dist / 5200.0);
  float a = (minor * 0.07 + major * 0.13) * fade;
  gl_FragColor = vec4(uColor, a);
}`;

/* One clock for the world, so a debug hook can slow time to inspect a flight. */
const CLOCK = { rate: 1, base: 0, real: 0 };
function clock() {
  const r = performance.now();
  return CLOCK.base + (r - CLOCK.real) * CLOCK.rate;
}
function setClockRate(rate) {
  CLOCK.base = clock();
  CLOCK.real = performance.now();
  CLOCK.rate = rate;
}

function makeWorld(M) {
  const THREE = M.THREE;
  const host = glHost;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) {
    return null;
  }
  let PR = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.className = "x-gl";
  host.appendChild(renderer.domElement);
  const css = new M.CSS3D.CSS3DRenderer();
  css.domElement.className = "x-css3d";
  host.appendChild(css.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new M.Room(), 0.04).texture;
  if ("environmentIntensity" in scene) scene.environmentIntensity = 0.45;
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-0.5, 1.2, 0.9);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(28, 1, 10, 80000);

  /* Floor grid that fades into the dark. */
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color("#c9d6da") }, uCam: { value: new THREE.Vector3() } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: FLOOR_FS,
    transparent: true,
    depthWrite: false
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60000, 40000), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -5;
  scene.add(floor);

  /* Soft shadows as blurred textures, cheap and crisp at the edges of the cards. */
  function shadowTexture(w, h) {
    const c = document.createElement("canvas");
    const S = 4; // texture pixels per unit, scaled down for big cards
    const pad = 46;
    const k = Math.min(0.25, 512 / (w + pad * 2));
    c.width = Math.ceil((w + pad * 2) * k);
    c.height = Math.ceil((h + pad * 2) * k);
    const g = c.getContext("2d");
    g.filter = "blur(" + Math.max(2, 18 * k) + "px)";
    g.fillStyle = "rgba(0,0,0,1)";
    const r = 10 * k;
    const x = pad * k, y = pad * k, ww = w * k, hh = h * k;
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + ww, y, x + ww, y + hh, r);
    g.arcTo(x + ww, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r);
    g.arcTo(x, y, x + ww, y, r);
    g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    void S;
    return { tex: t, pad: pad };
  }
  const shadowCache = {};
  function shadowFor(w, h) {
    const key2 = w + "x" + h;
    if (!shadowCache[key2]) shadowCache[key2] = shadowTexture(w, h);
    return shadowCache[key2];
  }
  const geoCache = {};
  function slabGeo(w, h) {
    const key2 = w + "x" + h;
    if (!geoCache[key2]) geoCache[key2] = new M.RBG(w, h, T, 3, 7);
    return geoCache[key2];
  }

  /* Smoked glass by kind; agents are the brightest. */
  const GLASS = {
    agent: { color: "#1d3936", emissive: "#081c1a", ei: 1 },
    maybe: { color: "#151c1f", emissive: "#000000", ei: 0 },
    code: { color: "#161d22", emissive: "#000000", ei: 0 },
    data: { color: "#151f1e", emissive: "#000000", ei: 0 },
    ui: { color: "#181c28", emissive: "#000000", ei: 0 },
    ext: { color: "#131619", emissive: "#000000", ei: 0 },
    out: { color: "#20272b", emissive: "#000000", ei: 0 }
  };
  function glassMat(cls) {
    const g = GLASS[cls];
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(g.color),
      emissive: new THREE.Color(g.emissive),
      metalness: 0.05,
      roughness: 0.46,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.5
    });
    m.userData.base = m.color.clone();
    m.userData.baseE = m.emissive.clone();
    return m;
  }
  const TEAL = new THREE.Color("#0e9c8e");
  const DIMC = new THREE.Color("#0b0e10");

  const WIRE_BASE = new THREE.Color("#66737a");
  const WIRE_HOT = new THREE.Color("#8fdcd2");
  const WIRE_DIM = new THREE.Color("#1f262a");
  const packetGeo = new THREE.SphereGeometry(3.6, 16, 12);
  const packetMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#f4fffd") });
  const coneGeo = new THREE.ConeGeometry(4.2, 11, 16, 1);
  coneGeo.translate(0, -5.5, 0);

  class Poly extends THREE.Curve {
    constructor(pts) {
      super();
      this.p = pts;
      this.c = [0];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        this.c.push(this.c[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], (b[2] || 0) - (a[2] || 0)));
      }
      this.L = this.c[this.c.length - 1];
    }
    at(d, out) {
      const c = this.c;
      d = clamp(d, 0, this.L);
      let lo = 0, hi = c.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (c[mid] <= d) lo = mid;
        else hi = mid;
      }
      const f = (d - c[lo]) / (c[hi] - c[lo] || 1);
      const a = this.p[lo], b = this.p[hi];
      return out.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * f);
    }
    getPoint(t, out) {
      return this.at(t * this.L, out || new THREE.Vector3());
    }
    getPointAt(u, out) {
      return this.getPoint(u, out);
    }
    getUtoTmapping(u) {
      return u;
    }
  }
  // Data coordinates (x right, y down, origin top left) to board coordinates.
  function bx(x) {
    return x - BW / 2;
  }
  function by(y) {
    return BH / 2 - y;
  }

  /* ---- Build the world ---- */

  const tools = {};
  const allCards = [];
  const cssToolObjects = {};
  const tmpV = new THREE.Vector3();

  function makeTube(pts3, mat, radius) {
    const curve = new Poly(pts3);
    const segs = Math.max(6, Math.ceil(curve.L / 6));
    const geo = new THREE.TubeGeometry(curve, segs, radius, 8, false);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.full = geo.index.count;
    mesh.userData.segs = segs;
    return { mesh: mesh, curve: curve };
  }
  function addCone(parent, tip, prev, mat) {
    const m = new THREE.Mesh(coneGeo, mat);
    m.position.set(tip[0], tip[1], tip[2] || 0);
    const dir = new THREE.Vector3(tip[0] - prev[0], tip[1] - prev[1], (tip[2] || 0) - (prev[2] || 0)).normalize();
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    parent.add(m);
    return m;
  }

  function cssObject(elm) {
    const o = new M.CSS3D.CSS3DObject(elm);
    return o;
  }

  function makeCard(tool, it, parent) {
    const n = it.n;
    const kind = KINDS[n.k];
    const small = it.w < 240 || it.h < 125;
    const card = {
      id: it.id, it: it, n: n, tool: tool, w: it.w, h: it.h,
      base: new THREE.Vector3(bx(it.x + it.w / 2), by(it.y + it.h / 2), 0),
      off: new THREE.Vector3(), offFrom: new THREE.Vector3(), offTo: new THREE.Vector3(),
      q: new THREE.Quaternion(), qFrom: new THREE.Quaternion(), qTo: new THREE.Quaternion(),
      lift: { x: 0, v: 0, t: 0 }, flipS: { x: 0, v: 0, t: 0 }, dim: { x: 0, v: 0, t: 0 },
      asm: 1, asmT0: 0, asmDelay: 0, hover: false, accent: 0
    };
    const anchor = new THREE.Group();
    anchor.position.copy(card.base);
    parent.add(anchor);
    const flip = new THREE.Group();
    anchor.add(flip);
    const mat = glassMat(kind.cls);
    const slab = new THREE.Mesh(slabGeo(it.w, it.h), mat);
    flip.add(slab);
    const fEl = frontFace(n, small);
    const bEl = backFace(n, small);
    if (isWide(it)) {
      fEl.classList.add("c--wide");
      bEl.classList.add("c--wide");
    }
    fEl.style.width = bEl.style.width = it.w + "px";
    fEl.style.height = bEl.style.height = it.h + "px";
    const fObj = cssObject(fEl);
    fObj.position.z = T / 2 + 0.6;
    flip.add(fObj);
    const bObj = cssObject(bEl);
    bObj.position.z = -T / 2 - 0.6;
    bObj.rotation.y = Math.PI;
    flip.add(bObj);
    const hit = el("button", "c-hit");
    hit.type = "button";
    hit.style.width = it.w + "px";
    hit.style.height = it.h + "px";
    hit.setAttribute("aria-label", n.n + ", " + kind.label + ". " + n.s + " Open details.");
    const hObj = cssObject(hit);
    hObj.position.z = T / 2 + 3;
    anchor.add(hObj);
    const sh = shadowFor(it.w, it.h);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(it.w + sh.pad * 2, it.h + sh.pad * 2),
      new THREE.MeshBasicMaterial({ map: sh.tex, transparent: true, opacity: 0.5, depthWrite: false })
    );
    shadow.position.set(card.base.x + 6, card.base.y - 10, -T / 2 - 18);
    shadow.renderOrder = -1;
    parent.add(shadow);
    Object.assign(card, { anchor: anchor, flip: flip, slab: slab, mat: mat, fObj: fObj, bObj: bObj, hObj: hObj, fEl: fEl, bEl: bEl, hit: hit, shadow: shadow });
    hit.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") hoverCard(card, true);
    });
    hit.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse") hoverCard(card, false);
    });
    hit.addEventListener("focus", function () {
      if (!touch.matches) hoverCard(card, true);
    });
    hit.addEventListener("blur", function () {
      if (!touch.matches) hoverCard(card, false);
    });
    hit.addEventListener("click", function (e) {
      if (dragMoved) {
        e.preventDefault();
        return;
      }
      if (touch.matches && !card.flipped) {
        tool.cards.forEach(function (c) {
          if (c !== card) hoverCard(c, false);
        });
        hoverCard(card, true);
        return;
      }
      openModal(tool.sl, n, hit);
    });
    allCards.push(card);
    return card;
  }

  function buildTool(id, k) {
    const g = GRAPHS[id];
    const sl = g.sl;
    const board = new THREE.Group();
    const S = sl.featured ? 1.3 : 1;
    board.scale.setScalar(S);
    board.position.set(-5600 + k * 1600 + (sl.featured ? 230 : 0), 430 + k * 250 + (sl.featured ? 120 : 0), -k * 180);
    board.rotation.x = (-TILT * Math.PI) / 180;
    scene.add(board);
    const tool = { id: id, k: k, sl: sl, g: g, board: board, cards: [], byId: {}, wires: [], overlays: [], bridges: [], packets: null, S: S };
    const css = [];
    // Groups, lanes and dividers as hairline overlays behind the cards.
    Object.keys(g.items).forEach(function (iid) {
      const it = g.items[iid];
      if (!it.group) return;
      const d = el("div", "x-group" + (it.group.bracket ? " x-group--bracket" : "") + (it.group.align ? " x-group--" + it.group.align : ""));
      d.style.width = it.w + "px";
      d.style.height = it.h + "px";
      d.appendChild(el("span", "x-group__label", it.group.t));
      const o = cssObject(d);
      o.position.set(bx(it.x + it.w / 2), by(it.y + it.h / 2), -T / 2 - 2);
      board.add(o);
      tool.overlays.push({ id: iid, obj: o, el: d, base: o.position.clone(), group: true });
      css.push(o);
    });
    (sl.lanes || []).forEach(function (ln) {
      const d = el("div", "x-lane", ln.t);
      const o = cssObject(d);
      o.position.set(bx(ln.x) + 90, by(ln.y) + 6, 0);
      d.style.width = "180px";
      board.add(o);
      tool.overlays.push({ obj: o, el: d, base: o.position.clone(), lane: true });
      css.push(o);
    });
    (sl.dividers || []).forEach(function (dv) {
      const d = el("div", "x-divider");
      d.style.height = BH + 20 + "px";
      d.appendChild(el("span", "x-divider__a", dv.a));
      d.appendChild(el("span", "x-divider__b", dv.b));
      const o = cssObject(d);
      o.position.set(bx(dv.x), 0, -T / 2 - 2);
      board.add(o);
      tool.overlays.push({ obj: o, el: d, base: o.position.clone(), divider: true });
      css.push(o);
    });
    sl.nodes.forEach(function (n, i) {
      const c = makeCard(tool, g.items[n.id], board);
      c.order = (g.items[n.id].x / BW) * 0.55 + (g.items[n.id].y / BH) * 0.18 + i * 0.004;
      tool.cards.push(c);
      tool.byId[n.id] = c;
      css.push(c.fObj, c.bObj, c.hObj);
    });
    g.wires.forEach(function (w) {
      const mat = new THREE.MeshStandardMaterial({ color: WIRE_BASE.clone(), roughness: 0.55, metalness: 0 });
      const pts = densify(w.pts).map(function (p) {
        return [bx(p[0]), by(p[1]), 0];
      });
      const tube = makeTube(pts, mat, 1.25);
      const holder = new THREE.Group();
      holder.add(tube.mesh);
      const cones = [addCone(holder, pts[pts.length - 1], pts[pts.length - 2], mat)];
      if (w.o.bi) cones.push(addCone(holder, pts[0], pts[1], mat));
      board.add(holder);
      const rec = { w: w, key: w.a + ">" + w.b, holder: holder, mesh: tube.mesh, curve: tube.curve, cones: cones, mat: mat, draw: 1, drawT0: 0, show: true, hot: 0, hotT: 0, vis: 1, label: null };
      if (w.o.l) {
        const at = labelPoint(w.pts);
        const d = el("span", "x-wlabel", w.o.l);
        const o = cssObject(d);
        o.position.set(bx(at[0]), by(at[1]), 2);
        holder.add(o);
        rec.label = { obj: o, el: d };
        css.push(o);
      }
      tool.wires.push(rec);
    });
    // Packets, drawn as one instanced mesh per tool.
    const inst = new THREE.InstancedMesh(packetGeo, packetMat, 96);
    inst.count = 0;
    inst.frustumCulled = false;
    board.add(inst);
    tool.packets = inst;
    // Name plate under the board, readable from the map.
    const plate = el("div", "x-plate" + (sl.featured ? " x-plate--featured" : ""));
    plate.appendChild(el("span", "x-plate__num", pad(k + 1)));
    plate.appendChild(el("span", "x-plate__name", sl.app));
    plate.appendChild(el("span", "x-plate__tag", sl.tag));
    const pObj = cssObject(plate);
    pObj.position.set(0, -BH / 2 - 150, 0);
    board.add(pObj);
    tool.plate = { obj: pObj, el: plate };
    css.push(pObj);
    // A board-sized button that selects the tool from the map.
    const bh = el("button", "x-boardhit");
    bh.type = "button";
    bh.style.width = BW + 80 + "px";
    bh.style.height = BH + 340 + "px";
    bh.setAttribute("aria-label", "Open " + sl.app + ", " + sl.tag);
    bh.addEventListener("click", function (e) {
      if (dragMoved) return e.preventDefault();
      if (curStep && curStep.explore) goExplore(id);
      else go(stepIndex[id]);
    });
    bh.addEventListener("pointerenter", function () {
      tool.boardHover = 1;
    });
    bh.addEventListener("pointerleave", function () {
      tool.boardHover = 0;
    });
    const bhObj = cssObject(bh);
    bhObj.position.set(0, -80, 40);
    board.add(bhObj);
    tool.boardHit = { obj: bhObj, el: bh };
    css.push(bhObj);
    // A contact shadow on the floor below the board.
    const fs = shadowFor(BW, 220);
    const fsh = new THREE.Mesh(new THREE.PlaneGeometry(BW + fs.pad * 2, 220 + fs.pad * 2), new THREE.MeshBasicMaterial({ map: fs.tex, transparent: true, opacity: 0.55, depthWrite: false }));
    fsh.rotation.x = -Math.PI / 2;
    fsh.position.set(board.position.x, 1, board.position.z + 40);
    fsh.scale.setScalar(S);
    scene.add(fsh);
    tool.floorShadow = fsh;
    tool.boardHover = 0;
    tool.lift = { x: 0, v: 0, t: 0 };
    cssToolObjects[id] = css;
    tools[id] = tool;
    return tool;
  }
  LADDER.forEach(buildTool);

  /* The ladder axis on the floor. */
  const first = tools[LADDER[0]].board.position, last = tools[LADDER[7]].board.position;
  const axisZ = 520;
  const axisGroup = new THREE.Group();
  scene.add(axisGroup);
  const axisMat = new THREE.MeshStandardMaterial({ color: new THREE.Color("#3a454b"), roughness: 0.6 });
  const axis = makeTube([[first.x - 900, 2, axisZ], [last.x + 1200, 2, axisZ]], axisMat, 3);
  axisGroup.add(axis.mesh);
  addCone(axisGroup, [last.x + 1240, 2, axisZ], [last.x + 1000, 2, axisZ], axisMat).scale.setScalar(3);
  function floorLabel(text, x, cls) {
    const d = el("div", "x-axislabel " + (cls || ""), text);
    const o = cssObject(d);
    o.position.set(x, 3, axisZ + 170);
    o.rotation.x = -Math.PI / 2;
    axisGroup.add(o);
    return o;
  }
  const axisLabels = [floorLabel("No AI", first.x - 760, "is-start"), floorLabel("Many agents", last.x + 300, "is-end")];
  LADDER.forEach(function (id) {
    const p = tools[id].board.position;
    const tick = makeTube([[p.x, 2, axisZ - 50], [p.x, 2, axisZ + 50]], axisMat, 2.5);
    axisGroup.add(tick.mesh);
  });

  /* The opening scene: three parts that lock into one agent. */
  const intro = { group: new THREE.Group(), parts: [], agent: null, t0: 0 };
  intro.group.position.set(-9400, 520, 900);
  intro.group.rotation.x = (-TILT * Math.PI) / 180;
  scene.add(intro.group);
  const PARTS = [
    { n: "Model", s: "An AI model, such as Claude." },
    { n: "Task", s: "The work it is given." },
    { n: "Tools", s: "What it can use to do the work." }
  ];
  PARTS.forEach(function (p, i) {
    const n = { id: "part" + i, k: i === 2 ? "tool" : i === 1 ? "doc" : "agent", n: p.n, s: p.s, b: p.s };
    const it = { id: n.id, n: n, x: 0, y: 0, w: 250, h: 120 };
    const fake = { cards: [], wires: [], sl: null };
    const c = makeCard(fake, it, intro.group);
    c.fEl.querySelector(".c-kind").lastChild.textContent = "Part " + (i + 1);
    c.hit.tabIndex = -1;
    c.hit.style.pointerEvents = "none";
    c.home = new THREE.Vector3((i - 1) * 330, 0, 0);
    c.from = new THREE.Vector3((i - 1) * 900, (i - 1) * -260 + 120, -1400 + i * 300);
    intro.parts.push(c);
  });
  {
    const n = { id: "agentcard", k: "agent", n: "Agent", s: "A model given a task and tools.", b: "" };
    const it = { id: n.id, n: n, x: 0, y: 0, w: 340, h: 150 };
    const c = makeCard({ cards: [], wires: [], sl: null }, it, intro.group);
    c.hit.tabIndex = -1;
    c.hit.style.pointerEvents = "none";
    const chips = el("span", "c-chips");
    ["Model", "Task", "Tools"].forEach(function (t) {
      chips.appendChild(el("span", null, t));
    });
    c.fEl.appendChild(chips);
    intro.agent = c;
  }
  [intro.agent].concat(intro.parts).forEach(function (c) {
    c.base.set(0, 0, 0);
    c.anchor.position.set(0, 0, 0);
    c.shadow.visible = false;
  });

  /* ---- State ---- */

  const cam = { pos: new THREE.Vector3(0, 800, 9000), target: new THREE.Vector3(0, 400, 0) };
  let flight = null;
  let restPose = null;
  let activeTool = null;
  let flightFromTool = null;
  let stepT0 = 0;
  let step = null;
  let interactive = false;
  const orbit = { yaw: 0, pitch: 0, vy: 0, vp: 0, ty: 0, tp: 0 };
  let lastInput = clock();
  let quality = 2;
  const frameTimes = [];

  function viewRegion() {
    return region();
  }
  function applyViewOffset() {
    const r = viewRegion();
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    camera.setViewOffset(r.W, r.H, -(cx - r.W / 2), -(cy - r.H / 2), r.W, r.H);
  }
  /* Camera pose that fits a w × h rectangle around a centre, seen along a direction. */
  function fitPose(center, w, h, dir, yawDeg, pitchDeg, margin) {
    const r = viewRegion();
    const tan = Math.tan((camera.fov * Math.PI) / 360);
    const aspect = r.W / r.H;
    const m = margin || 1.08;
    const dH = (h * m) / (2 * tan * (r.h / r.H));
    const dW = (w * m) / (2 * tan * aspect * (r.w / r.W));
    const d = Math.max(dH, dW);
    const v = dir.clone().normalize();
    const up = new THREE.Vector3(0, 1, 0);
    v.applyAxisAngle(up, ((yawDeg || 0) * Math.PI) / 180);
    const right = new THREE.Vector3().crossVectors(up, v).normalize();
    v.applyAxisAngle(right, (-(pitchDeg || 0) * Math.PI) / 180);
    return { pos: center.clone().addScaledVector(v, d), target: center.clone(), d: d };
  }
  const BOARD_DIR = new THREE.Vector3(0, Math.sin((TILT * Math.PI) / 180), Math.cos((TILT * Math.PI) / 180));

  function boardRectPose(tool, ids, yaw, pitch, margin) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ids.forEach(function (id) {
      const it = tool.g.items[id];
      if (!it) return;
      x0 = Math.min(x0, it.x);
      y0 = Math.min(y0, it.y);
      x1 = Math.max(x1, it.x + it.w);
      y1 = Math.max(y1, it.y + it.h);
    });
    let w = x1 - x0, h = y1 - y0;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    w = Math.max(w, 1040);
    h = Math.max(h, 430);
    const c = tool.board.localToWorld(new THREE.Vector3(bx(cx), by(cy), 0));
    return fitPose(c, w * tool.S, h * tool.S, BOARD_DIR, yaw, pitch, margin || 1.12);
  }
  function fullBoardPose(tool, yaw, pitch) {
    const c = tool.board.localToWorld(new THREE.Vector3(0, 0, 0));
    return fitPose(c, (BW + 40) * tool.S, (BH + 40) * tool.S, BOARD_DIR, yaw, pitch, 1.04);
  }
  function mapPose() {
    const a = tools[LADDER[0]].board.position, b = tools[LADDER[7]].board.position;
    const c = new THREE.Vector3((a.x + b.x) / 2 - 120, (a.y + b.y) / 2 - 90, (a.z + b.z) / 2 + 160);
    return fitPose(c, b.x - a.x + 2900, b.y - a.y + 1250, BOARD_DIR, -8, 12, 1.0);
  }
  function introPose() {
    const c = intro.group.position.clone();
    return fitPose(c, 1180, 420, BOARD_DIR, 0, 0, 1.1);
  }
  function ringPose(tool) {
    const c = tool.board.localToWorld(new THREE.Vector3(tool.ringCenter.x, tool.ringCenter.y, 0));
    const rs = tool.ringSize || { w: 1300, h: 560 };
    return fitPose(c, (rs.w + 60) * tool.S, (rs.h + 60) * tool.S, BOARD_DIR, 0, 15, 1.0);
  }

  function poseFor(st) {
    if (st.view === "intro") return introPose();
    if (st.view === "map") return mapPose();
    const tool = tools[st.tool];
    if (st.ring) return ringPose(tool);
    if (st.near) return boardRectPose(tool, st.near, st.yaw || 0, st.pitch || 0, 1.12);
    return fullBoardPose(tool, st.yaw || 0, st.pitch || 0);
  }

  /* ---- Layout of each tool for the current step ---- */

  function resetToolLayout(tool) {
    tool.cards.forEach(function (c) {
      c.offTo.set(0, 0, 0);
      c.qTo.identity();
      c.dim.t = 0;
      c.ghost = 0;
      c.hideAt = c.ringOnly ? 1 : 0;
    });
    tool.alias = {};
    tool.wires.forEach(function (w) {
      w.show = true;
      w.hotT = 0;
      w.dimT = 0;
    });
    tool.overlays.forEach(function (o) {
      o.offTo = new THREE.Vector3();
      o.hide = false;
    });
    clearBridges(tool);
    tool.ringCenter = null;
  }
  function clearBridges(tool) {
    tool.bridges.forEach(function (b) {
      tool.board.remove(b.holder);
      b.mesh.geometry.dispose();
    });
    tool.bridges = [];
  }
  function cardOf(tool, id) {
    return (tool.alias && tool.alias[id]) || tool.byId[id];
  }
  function itemCenter(tool, id) {
    const c = cardOf(tool, id);
    if (c) return c.base.clone().add(c.offTo);
    const o = tool.overlays.filter(function (x) {
      return x.id === id;
    })[0];
    return o ? o.base.clone().add(o.offTo || new THREE.Vector3()) : new THREE.Vector3();
  }
  function itemOff(tool, id) {
    const c = cardOf(tool, id);
    if (c) return c.offTo;
    const o = tool.overlays.filter(function (x) {
      return x.id === id;
    })[0];
    return (o && o.offTo) || new THREE.Vector3();
  }
  /* A curved 3D connector between two cards that no longer share a plane. */
  function addBridge(tool, aId, bId, key) {
    const A = itemCenter(tool, aId), B = itemCenter(tool, bId);
    const ca = cardOf(tool, aId), cb = cardOf(tool, bId);
    const ha = ca ? ca.h / 2 : 0, hb = cb ? cb.h / 2 : 0;
    const wa = ca ? ca.w / 2 : 0, wb = cb ? cb.w / 2 : 0;
    // Leave from the edge that faces the other card.
    const edge = function (P, Q, hw, hh, isStore) {
      const d = new THREE.Vector3().subVectors(Q, P);
      if (isStore) return new THREE.Vector3(clamp(Q.x, P.x - hw + 30, P.x + hw - 30), P.y + (Q.y > P.y ? hh : -hh), P.z + (Q.z > P.z ? T / 2 : -T / 2) * 0);
      if (Math.abs(d.x) / hw > Math.abs(d.y) / hh) return new THREE.Vector3(P.x + Math.sign(d.x) * hw, P.y, P.z);
      return new THREE.Vector3(P.x, P.y + Math.sign(d.y) * hh, P.z);
    };
    const storeA = ca && ca.w > 600, storeB = cb && cb.w > 600;
    const S0 = edge(A, B, wa, ha, storeA), E0 = edge(B, A, wb, hb, storeB);
    const mid = S0.clone().lerp(E0, 0.5);
    mid.y += 40;
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      pts.push([u * u * S0.x + 2 * u * t * mid.x + t * t * E0.x, u * u * S0.y + 2 * u * t * mid.y + t * t * E0.y, u * u * S0.z + 2 * u * t * mid.z + t * t * E0.z]);
    }
    const mat = new THREE.MeshStandardMaterial({ color: WIRE_BASE.clone(), roughness: 0.55 });
    const tube = makeTube(pts, mat, 1.25);
    const holder = new THREE.Group();
    holder.add(tube.mesh);
    const cones = [addCone(holder, pts[pts.length - 1], pts[pts.length - 2], mat)];
    tool.board.add(holder);
    const rec = { key: key, holder: holder, mesh: tube.mesh, curve: tube.curve, cones: cones, mat: mat, draw: 0, drawT0: 0, show: true, hot: 0, hotT: 0, vis: 1, bridge: true };
    tool.bridges.push(rec);
    return rec;
  }

  function compactStore(tool, big) {
    if (tool.compact) return tool.compact;
    const it = { id: big.id, n: big.n, x: big.it.x + big.w / 2 - 280, y: big.it.y + big.h / 2 - 80, w: 560, h: 160 };
    const c = makeCard(tool, it, tool.board);
    c.ringOnly = true;
    c.order = 0;
    c.hideAt = 1;
    tool.cards.push(c);
    cssToolObjects[tool.id].push(c.fObj, c.bObj, c.hObj);
    tool.compact = c;
    setTimeout(function () {
      fitFaceText(c.fEl);
      fitFaceText(c.bEl);
    }, 120);
    return c;
  }
  function applyLayout(tool, st, now) {
    resetToolLayout(tool);
    const focus = st.focus ? new Set(st.focus) : null;
    const ghost = new Set(st.ghost || []);
    tool.cards.forEach(function (c) {
      const inG = c.it.inGroup;
      if (ghost.has(c.id) || (inG && ghost.has(inG))) {
        c.ghost = 1;
        c.dim.t = 1;
        if (st.ghostDrop) c.offTo.set(0, st.ghostDrop.y, st.ghostDrop.z);
      } else if (focus && !focus.has(c.id) && !(inG && focus.has(inG))) c.dim.t = 1;
    });
    tool.overlays.forEach(function (o) {
      if (o.id && ghost.has(o.id) && st.ghostDrop) o.offTo = new THREE.Vector3(0, st.ghostDrop.y, st.ghostDrop.z);
      if (o.divider && st.hideDividers) o.hide = true;
      if (st.ring && (o.group || o.lane || o.divider)) o.hide = true;
    });
    if (st.ring) {
      // A compact copy of the shared store sits in the centre; the agents ring it, all parallel to the screen.
      const big = tool.byId[st.ring.store];
      const store = compactStore(tool, big);
      const center = big.base.clone();
      tool.ringCenter = center;
      tool.alias[st.ring.store] = store;
      big.ghost = 1;
      big.dim.t = 1;
      big.hideAt = now + (reduce ? 0 : 1000);
      store.hideAt = 0;
      if (!store.shownOnce || store.asm >= 1) {
        store.asm = 0;
        store.asmT0 = now + (reduce ? -1e6 : 450);
        store.asmDelay = 0;
        store.shownOnce = true;
      }
      const members = st.ring.members;
      const camPose = ringPose(tool);
      const camLocal = tool.board.worldToLocal(camPose.pos.clone());
      const tarLocal = tool.board.worldToLocal(camPose.target.clone());
      const face = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camLocal, tarLocal, new THREE.Vector3(0, 1, 0)));
      store.qTo.copy(face);
      // Slots in a plane parallel to the screen: one card each side of the store, the rest in a row above and a row below.
      // Gaps come from the real card sizes, so no two cards touch; depth bends the rows gently.
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(face);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(face);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(face);
      const cw = tool.byId[members[0]].w, chh = tool.byId[members[0]].h;
      const G = 84;
      const sideX = store.w / 2 + G + cw / 2;
      const rowY = store.h / 2 + G * 0.75 + chh / 2;
      const rest = members.length - 2;
      const nTop = Math.floor(rest / 2), nBot = rest - nTop;
      const slots = [[-sideX, 0, -150], [sideX, 0, -150]];
      const row = function (n, y, z) {
        for (let i = 0; i < n; i++) slots.push([(i - (n - 1) / 2) * (cw + G), y, z - Math.abs(i - (n - 1) / 2) * 50]);
      };
      row(nTop, rowY, -60);
      row(nBot, -rowY, 70);
      members.forEach(function (id, i) {
        const c = tool.byId[id];
        const sl = slots[i];
        const p = center.clone().addScaledVector(right, sl[0]).addScaledVector(up, sl[1]).addScaledVector(fwd, sl[2]);
        c.offTo.copy(p).sub(c.base);
        c.qTo.copy(face);
      });
      tool.ringSize = { w: sideX * 2 + cw, h: rowY * 2 + chh };
      tool.cards.forEach(function (c) {
        if (c === big || c === store || members.indexOf(c.id) >= 0) return;
        c.ghost = 1;
        c.dim.t = 1;
        c.offTo.set(0, -60, -500);
        c.hideAt = now + (reduce ? 0 : 1000);
      });
    }
    // Connectors: those whose ends moved apart become curved 3D bridges.
    const wanted = new Set();
    activeList(st).forEach(function (r) {
      wanted.add(r);
    });
    tool.wires.forEach(function (w) {
      const oa = itemOff(tool, w.w.a), ob = itemOff(tool, w.w.b);
      const same = oa.distanceTo(ob) < 0.5;
      const ga = ghostOf(tool, w.w.a), gb = ghostOf(tool, w.w.b);
      w.show = same && !st.ring;
      w.offTo = oa.clone();
      w.dimT = ga || gb ? 1 : focus && !(focusHas(tool, focus, w.w.a) && focusHas(tool, focus, w.w.b)) ? 0.7 : 0;
    });
    if (st.ring || st.ghost) {
      const refs = st.flow || [];
      const done = {};
      refs.forEach(function (r) {
        const f = findWire(tool.g, r);
        if (!f) return;
        const w = tool.wires[f.w.j];
        if (w.show || done[w.key]) return;
        done[w.key] = true;
        const b = addBridge(tool, w.w.a, w.w.b, w.key);
        b.drawT0 = now + (reduce ? -1e6 : 1300);
      });
    }
    void wanted;
    // Hot path for the record walk.
    if (st.hotPath) {
      (st.seq || []).forEach(function (h) {
        h.forEach(function (r) {
          const f = findWire(tool.g, r);
          if (f) tool.wires[f.w.j].hotT = 1;
        });
      });
    }
    if (st.seq) {
      st.seq.forEach(function (h) {
        h.forEach(function (r) {
          const f = findWire(tool.g, r);
          if (f) {
            tool.wires[f.w.j].hotT = 1;
            tool.wires[f.w.j].dimT = 0;
          }
        });
      });
    }
    tool.layoutT0 = now;
    tool.cards.forEach(function (c) {
      c.offFrom.copy(c.off);
      c.qFrom.copy(c.q);
    });
    tool.wires.forEach(function (w) {
      w.offFrom = w.holder.position.clone();
    });
    tool.overlays.forEach(function (o) {
      o.offFrom = o.obj.position.clone().sub(o.base);
    });
  }
  function ghostOf(tool, id) {
    const c = tool.byId[id];
    if (c) return c.ghost;
    return 0;
  }
  function focusHas(tool, focus, id) {
    if (focus.has(id)) return true;
    const it = tool.g.items[id];
    return !!(it && it.inGroup && focus.has(it.inGroup));
  }
  function activeList(st) {
    let refs = [];
    if (st.flow && st.flow !== "all") refs = refs.concat(st.flow);
    (st.seq || []).forEach(function (h) {
      refs = refs.concat(h);
    });
    return refs;
  }

  /* Cards assemble: they rise from the floor and fly in from depth, in flow order. */
  function assemble(tool, at) {
    tool.cards.forEach(function (c) {
      c.asmT0 = at;
      c.asmDelay = c.order * 900;
      c.asm = 0;
    });
    tool.wires.forEach(function (w) {
      w.drawT0 = at + 900 + w.w.j * 45;
      w.draw = 0;
    });
  }

  /* ---- Show a step ---- */

  function showStep(st, cut) {
    const now = clock();
    const prevStep = step;
    step = st;
    stepT0 = now;
    const prevTool = activeTool;
    flightFromTool = prevTool;
    activeTool = st.tool ? tools[st.tool] : null;
    // Layouts
    LADDER.forEach(function (id) {
      const tool = tools[id];
      if (activeTool === tool) applyLayout(tool, st, now);
      else applyLayout(tool, { flow: null }, now);
    });
    LADDER.forEach(function (id) {
      const tool = tools[id];
      tool.away = !!st.tool && tool !== activeTool;
      if (tool.away) {
        tool.cards.forEach(function (c) {
          c.dim.t = 1;
          c.ghost = 1;
        });
        tool.wires.forEach(function (w) {
          w.dimT = 1;
        });
      } else {
        tool.board.visible = true;
        tool.floorShadow.visible = true;
      }
    });
    const toPose = poseFor(st);
    // Finding: every agent lights up, and the links around them turn teal in a sweep.
    LADDER.forEach(function (id, k) {
      const tool = tools[id];
      tool.cards.forEach(function (c) {
        c.accentT = st.finding && c.n.k === "agent" ? 1 : 0;
        if (st.finding && c.n.k !== "agent") c.dim.t = 1;
      });
      tool.wires.forEach(function (w) {
        const ka = tool.g.items[w.w.a].n, kb = tool.g.items[w.w.b].n;
        const touchesAgent = (ka && AGENT_KINDS[ka.k] && ka.k === "agent") || (kb && AGENT_KINDS[kb.k] && kb.k === "agent");
        w.scanAt = st.finding && touchesAgent ? now + 900 + k * 260 : 0;
      });
    });
    // Assembly when arriving from somewhere else
    const firstEver = !prevStep;
    if (st.view === "map" && (firstEver || (prevStep && prevStep.view === "intro"))) {
      LADDER.forEach(function (id, k) {
        assemble(tools[id], now + (reduce ? -1e6 : 500 + k * 140));
      });
    } else if (activeTool && activeTool !== prevTool) {
      assemble(activeTool, now + (reduce || cut ? (firstEver ? 300 : -1e6) : 520));
    }
    if (firstEver && st.view !== "map" && st.view !== "intro") {
      LADDER.forEach(function (id) {
        if (tools[id] !== activeTool) assemble(tools[id], now - 1e6);
      });
    }
    if (st.view === "intro") {
      intro.t0 = now + (reduce ? -1e6 : 0);
      if (firstEver) LADDER.forEach(function (id) {
        tools[id].cards.forEach(function (c) {
          c.asm = 0;
          c.asmT0 = Infinity;
        });
        tools[id].wires.forEach(function (w) {
          w.drawT0 = Infinity;
          w.draw = 0;
        });
      });
    }
    // Interaction
    interactive = !!st.tool;
    LADDER.forEach(function (id) {
      const tool = tools[id];
      const on = tool === activeTool;
      tool.cards.forEach(function (c) {
        c.hit.style.pointerEvents = on ? "auto" : "none";
        c.hit.tabIndex = on && !c.ghost ? 0 : -1;
        hoverCard(c, false);
      });
      tool.boardHit.el.style.pointerEvents = st.view === "map" ? "auto" : "none";
      tool.boardHit.el.tabIndex = st.view === "map" ? 0 : -1;
      tool.plate.el.classList.toggle("is-on", st.view === "map");
    });
    axisLabels.forEach(function (o) {
      o.element.classList.toggle("is-on", st.view === "map");
    });
    // Camera
    restPose = toPose;
    orbit.ty = orbit.tp = 0;
    applyViewOffset();
    if (cut || reduce || !prevStep) {
      flight = null;
      if (!prevStep && !reduce) {
        // The first view glides in from a low, oblique angle.
        const from = fitPose(toPose.target, 10, 10, BOARD_DIR, 0, 0, 1);
        void from;
        const off = toPose.pos.clone().sub(toPose.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (35 * Math.PI) / 180).multiplyScalar(1.35);
        off.y *= 0.3;
        flight = makeFlight({ pos: toPose.target.clone().add(off), target: toPose.target.clone() }, toPose, now, 1700, 0);
      } else {
        cam.pos.copy(toPose.pos);
        cam.target.copy(toPose.target);
      }
    } else {
      const sameTool = prevStep && prevStep.tool && prevStep.tool === st.tool;
      flight = makeFlight({ pos: currentCamPos(), target: cam.target.clone() }, toPose, now, sameTool ? 1050 : 1350, sameTool ? 0 : 1);
    }
    updateCssVisibility();
  }
  function currentCamPos() {
    return camera.position.clone();
  }
  /* A camera flight: dolly back, swing round and settle, with no roll. */
  function makeFlight(from, to, now, dur, swing) {
    const dist = from.pos.distanceTo(to.pos);
    const backA = from.pos.clone().sub(from.target).normalize();
    const backB = to.pos.clone().sub(to.target).normalize();
    const pull = Math.min(dist * 0.35, 4200);
    const c1 = from.pos.clone().addScaledVector(backA, pull * 0.6);
    c1.y += pull * 0.15;
    const offB = to.pos.clone().sub(to.target);
    if (swing) {
      offB.applyAxisAngle(new THREE.Vector3(0, 1, 0), (24 * Math.PI) / 180 * (to.target.x >= from.target.x ? 1 : -1));
      offB.y -= offB.length() * 0.12;
    }
    const c2 = to.target.clone().add(offB.multiplyScalar(1 + (swing ? 0.25 : 0.08))).addScaledVector(backB, pull * 0.2);
    return { t0: now, dur: dur, p0: from.pos.clone(), c1: c1, c2: c2, p1: to.pos.clone(), t0v: from.target.clone(), t1v: to.target.clone() };
  }
  function bez(a, b, c, d, t, out) {
    const u = 1 - t;
    return out.set(
      u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
      u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
      u * u * u * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t * t * t * d.z
    );
  }

  /* Only the tools near the camera keep their HTML faces in the page. */
  function updateCssVisibility() {
    const map = step && step.view === "map";
    LADDER.forEach(function (id, k) {
      const tool = tools[id];
      const near = !!(map || tool === activeTool || (flight && tool === flightFromTool));
      tool.cssNear = near;
    });
  }

  /* ---- Hover: lift, then flip in 3D ---- */

  let hoverTimer = 0;
  function hoverCard(card, on) {
    if (on && (dragMoved || !modal.hidden)) return;
    if (card.hover === on) return;
    card.hover = on;
    clearTimeout(card.flipTimer);
    card.lift.t = on ? 1 : 0;
    if (on) {
      card.flipTimer = setTimeout(function () {
        card.flipS.t = 1;
        card.flipped = true;
      }, reduce ? 0 : 130);
    } else {
      card.flipS.t = 0;
      card.flipped = false;
    }
    if (card.tool && card.tool.cards) focusHover(card.tool, on ? card : null);
    lastInput = clock();
    kick(900);
    void hoverTimer;
  }
  function focusHover(tool, card) {
    tool.hoverCard = card;
    const linked = {};
    if (card) {
      linked[card.id] = 1;
      const grp = card.it.inGroup;
      tool.wires.forEach(function (w) {
        const hot = w.w.a === card.id || w.w.b === card.id || (grp && (w.w.a === grp || w.w.b === grp));
        w.hoverHot = hot ? 1 : 0;
        if (hot) {
          linked[w.w.a] = 1;
          linked[w.w.b] = 1;
        }
      });
      tool.cards.forEach(function (c) {
        c.hoverDim = linked[c.id] || (c.it.inGroup && linked[c.it.inGroup]) ? 0 : 1;
      });
    } else {
      tool.wires.forEach(function (w) {
        w.hoverHot = 0;
      });
      tool.cards.forEach(function (c) {
        c.hoverDim = 0;
      });
    }
  }

  function springTo(s, k, c, dt) {
    const steps = Math.ceil(dt / 0.008);
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      s.v += (k * (s.t - s.x) - c * s.v) * h;
      s.x += s.v * h;
    }
  }

  /* ---- Packets ---- */

  const pv = new THREE.Vector3();
  const pm = new THREE.Matrix4();
  const ps = new THREE.Vector3();
  const pq = new THREE.Quaternion();
  function wireFor(tool, ref) {
    const f = findWire(tool.g, ref);
    if (!f) return null;
    const w = tool.wires[f.w.j];
    const b = tool.bridges.filter(function (x) {
      return x.key === w.key;
    })[0];
    return { rec: b || w, rev: f.rev, len: (b || w).curve.L };
  }
  function putPacket(tool, rec, d, scale) {
    const inst = tool.packets;
    if (inst.count >= 96) return;
    rec.curve.at(d, pv);
    pv.add(rec.holder.position);
    pv.z += 1.5;
    ps.setScalar(scale);
    pm.compose(pv, pq, ps);
    inst.setMatrixAt(inst.count++, pm);
  }
  function updatePackets(tool, now) {
    const inst = tool.packets;
    inst.count = 0;
    if (reduce || !step || tool !== activeTool) {
      inst.instanceMatrix.needsUpdate = true;
      return;
    }
    const st = step;
    const t = now / 1000;
    const drawn = function (rec) {
      return rec.draw >= 1 && rec.vis > 0.5;
    };
    if (st.flow) {
      const list = st.flow === "all" ? tool.wires.filter(function (w) {
        return !w.w.o.quiet && w.w.len >= 60;
      }).map(function (w) {
        return { rec: w, rev: false, len: w.curve.L, j: w.w.j };
      }) : st.flow.map(function (r, j) {
        const f = wireFor(tool, r);
        if (f) f.j = j;
        return f;
      }).filter(Boolean);
      list.forEach(function (f) {
        if (!drawn(f.rec)) return;
        const dur = Math.max(1.6, f.len / 110);
        const trim = Math.min(0.3, 18 / f.len);
        const frac = (t / dur + f.j * 0.37) % 1;
        const fade = Math.min(1, frac / 0.08, (1 - frac) / 0.08);
        const u = trim + frac * (1 - 2 * trim);
        putPacket(tool, f.rec, (f.rev ? 1 - u : u) * f.len, fade);
      });
    }
    if (st.seq) {
      const hops = st.seq.map(function (h) {
        return h.map(function (r) {
          return wireFor(tool, r);
        }).filter(Boolean);
      });
      const durs = hops.map(function (h) {
        return Math.max(0.75, Math.max.apply(null, h.map(function (f) {
          return f.len;
        }).concat([0])) / 170);
      });
      const total = durs.reduce(function (a, b) {
        return a + b;
      }, 0) + 1.1;
      const startAt = (stepT0 + (step.near ? 1150 : 1500)) / 1000;
      if (t < startAt) {
        inst.instanceMatrix.needsUpdate = true;
        return;
      }
      let tt = (t - startAt) % total;
      for (let i = 0; i < hops.length; i++) {
        if (tt < durs[i]) {
          const p = easeInOut(tt / durs[i]);
          hops[i].forEach(function (f) {
            const fade = Math.min(1, p / 0.06, (1 - p) / 0.06 + 0.4);
            putPacket(tool, f.rec, (f.rev ? 1 - p : p) * f.len, Math.min(1.15, 0.5 + fade));
          });
          break;
        }
        tt -= durs[i];
      }
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  /* ---- Per-frame update ---- */

  const tmpQ = new THREE.Quaternion();
  const camPosV = new THREE.Vector3();
  const camTarV = new THREE.Vector3();
  let lastT = 0;

  function update(now) {
    const dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    // Camera
    if (flight) {
      const p = clamp((now - flight.t0) / flight.dur, 0, 1);
      const e = easeInOut(p);
      bez(flight.p0, flight.c1, flight.c2, flight.p1, e, camPosV);
      camTarV.copy(flight.t0v).lerp(flight.t1v, easeInOut(clamp(p * 1.1, 0, 1)));
      cam.pos.copy(camPosV);
      cam.target.copy(camTarV);
      if (p >= 1) {
        flight = null;
        updateCssVisibility();
      }
    } else if (restPose) {
      cam.pos.copy(restPose.pos);
      cam.target.copy(restPose.target);
    }
    // Drag orbit springs back; idle drift and the step's own slow orbit sit on top.
    const k = 1 - Math.pow(0.002, dt);
    orbit.yaw += (orbit.ty - orbit.yaw) * k;
    orbit.pitch += (orbit.tp - orbit.pitch) * k;
    let yaw = orbit.yaw, pitch = orbit.pitch;
    if (!reduce) {
      const idle = clamp((now - lastInput - 2500) / 2000, 0, 1) * (dragging ? 0 : 1);
      yaw += Math.sin(now / 5200) * 1.6 * idle;
      pitch += Math.sin(now / 7300) * 0.7 * idle;
      if (step && step.orbit && !flight) yaw += Math.sin((now - stepT0) / 4200) * step.orbit * clamp((now - stepT0 - 1300) / 1500, 0, 1);
    }
    const off = cam.pos.clone().sub(cam.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), (yaw * Math.PI) / 180);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), off).normalize();
    off.applyAxisAngle(right, (-pitch * Math.PI) / 180);
    camera.position.copy(cam.target).add(off);
    camera.lookAt(cam.target);
    floorMat.uniforms.uCam.value.copy(cam.target);
    if ("environmentIntensity" in scene) {
      const envT = step && step.ring ? 0.1 : 0.45;
      scene.environmentIntensity += (envT - scene.environmentIntensity) * (reduce ? 1 : 1 - Math.pow(0.02, dt));
    }
    axisGroup.visible = !(step && step.tool && !flight);

    // Intro
    if (step) {
      const showIntro = step.view === "intro" || (flight && intro.group.position.distanceTo(camera.position) < 9000);
      intro.group.visible = showIntro || step.view === "intro";
      const it = (now - intro.t0) / 1000;
      intro.parts.forEach(function (c, i) {
        const pin = easeOutCubic(clamp((it - i * 0.18) / 1.2, 0, 1));
        const merge = easeInOut(clamp((it - 2.3) / 0.8, 0, 1));
        const pos = c.from.clone().lerp(c.home, pin).lerp(new THREE.Vector3(0, 0, 0), merge);
        c.anchor.position.copy(pos);
        c.anchor.rotation.set((1 - pin) * 0.5, (1 - pin) * (i - 1) * 0.6, 0);
        const s = Math.max(0.001, (1 - merge * 0.6));
        c.anchor.scale.setScalar(s);
        const op = pin * (1 - clamp((it - 2.6) / 0.4, 0, 1));
        setOpacity(c, op);
        c.anchor.visible = op > 0.01;
      });
      const ap = easeOutCubic(clamp((it - 2.7) / 0.9, 0, 1));
      intro.agent.anchor.scale.setScalar(Math.max(0.001, 0.7 + 0.3 * ap));
      intro.agent.anchor.position.set(0, 0, (1 - ap) * -120);
      setOpacity(intro.agent, ap);
      intro.agent.anchor.visible = ap > 0.01;
      intro.agent.mat.emissiveIntensity = 0.6 + 0.6 * ap;
    }

    // Tools
    LADDER.forEach(function (id) {
      const tool = tools[id];
      const lp = reduce ? 1 : easeInOut(clamp((now - tool.layoutT0) / 1150, 0, 1));
      // Board hover lift in the map
      tool.lift.t = tool.boardHover && step && step.view === "map" ? 1 : 0;
      springTo(tool.lift, 160, 24, dt);
      tool.plate.el.classList.toggle("is-hover", !!tool.boardHover);
      tool.cards.forEach(function (c) {
        // Assembly
        let a = 1;
        if (c.asmT0 === Infinity) a = 0;
        else if (c.asm < 1) {
          a = reduce ? 1 : clamp((now - c.asmT0 - c.asmDelay) / 850, 0, 1);
          c.asm = a;
        }
        const ae = easeOut(a);
        c.off.copy(c.offFrom).lerp(c.offTo, lp);
        c.q.copy(c.qFrom).slerp(c.qTo, lp);
        springTo(c.lift, 190, 22, dt);
        springTo(c.flipS, 120, 19, dt);
        const dimTarget = Math.max(c.dim.t, c.hoverDim ? 0.7 : 0);
        c.dim.x += (dimTarget - c.dim.x) * (reduce ? 1 : 1 - Math.pow(0.001, dt));
        c.accent = c.accent || 0;
        c.accent += ((c.accentT || 0) - c.accent) * (reduce ? 1 : 1 - Math.pow(0.02, dt));
        c.anchor.position.copy(c.base).add(c.off);
        c.anchor.position.z += c.lift.x * 46 + (1 - ae) * -520;
        c.anchor.position.y += (1 - ae) * -260;
        c.anchor.quaternion.copy(c.q);
        if (ae < 1) {
          tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), (1 - ae) * 0.7);
          c.anchor.quaternion.multiply(tmpQ);
        }
        c.anchor.scale.setScalar(Math.max(0.001, a <= 0 ? 0.001 : 0.82 + 0.18 * ae));
        const hidden = c.hideAt && now > c.hideAt;
        c.anchor.visible = a > 0 && !hidden;
        c.flip.rotation.y = c.flipS.x * Math.PI;
        // Glass dims towards the background and agents light up for the finding.
        const dimK = c.dim.x * (c.ghost ? 0.92 : 0.75);
        c.mat.color.copy(c.mat.userData.base).lerp(DIMC, dimK).lerp(TEAL, c.accent * 0.8);
        c.mat.emissive.copy(c.mat.userData.baseE).lerp(TEAL, c.accent * 0.55);
        c.mat.envMapIntensity = 0.5 - dimK * 0.35;
        setOpacity(c, ae);
        const lvl = c.dim.x > 0.5 ? (c.ghost ? 2 : 1) : 0;
        if (c._lvl !== lvl) {
          c._lvl = lvl;
          c.fEl.dataset.dim = lvl;
          c.bEl.dataset.dim = lvl;
        }
        // Shadow spreads and softens as the card lifts.
        const L = c.lift.x;
        c.shadow.visible = quality > 1 && a > 0 && !hidden;
        c.shadow.position.set(c.anchor.position.x + 6 + L * 14, c.anchor.position.y - 10 - L * 26, -T / 2 - 18 + c.off.z);
        c.shadow.scale.setScalar(1 + L * 0.12);
        c.shadow.material.opacity = (0.5 - L * 0.22) * ae * (1 - c.dim.x * 0.6);
      });
      tool.overlays.forEach(function (o) {
        const of = (o.offFrom || new THREE.Vector3()).clone().lerp(o.offTo || new THREE.Vector3(), lp);
        o.obj.position.copy(o.base).add(of);
        const asm = tool.cards.length ? tool.cards[0].asm : 1;
        const vis = (o.hide ? 0 : 1) * asm;
        if (o.vis !== vis) {
          o.vis = vis;
          o.el.style.opacity = vis;
        }
      });
      tool.wires.forEach(function (w) {
        if (w.drawT0 === Infinity) w.draw = 0;
        else if (w.draw < 1) w.draw = reduce ? 1 : easeOutCubic(clamp((now - w.drawT0) / 650, 0, 1));
        const show = w.show ? 1 : 0;
        w.vis += (show - w.vis) * (reduce ? 1 : 1 - Math.pow(0.0005, dt));
        if (w.offTo) w.holder.position.copy(w.offFrom || w.offTo).lerp(w.offTo, lp);
        w.holder.visible = w.vis > 0.02 && w.draw > 0;
        const segs = w.mesh.userData.segs;
        w.mesh.geometry.setDrawRange(0, Math.ceil(segs * w.draw * (w.show || w.vis > 0.5 ? 1 : w.vis)) * 8 * 6);
        w.cones.forEach(function (c) {
          c.visible = w.draw > 0.97;
        });
        const scan = w.scanAt && now > w.scanAt ? 1 : 0;
        const hot = Math.max(w.hotT || 0, w.hoverHot || 0, scan);
        w.hot += (hot - w.hot) * (reduce ? 1 : 1 - Math.pow(0.003, dt));
        const dimW = Math.max(w.dimT || 0, tool.hoverCard && !w.hoverHot ? 0.75 : 0);
        w.dimV = w.dimV == null ? dimW : w.dimV + (dimW - w.dimV) * (reduce ? 1 : 1 - Math.pow(0.002, dt));
        w.mat.color.copy(WIRE_BASE).lerp(WIRE_DIM, w.dimV).lerp(WIRE_HOT, w.hot * (1 - w.dimV * 0.6));
        w.mat.emissive.copy(WIRE_HOT).multiplyScalar(w.hot * 0.25);
        if (w.label) {
          const op = w.holder.visible && w.draw > 0.9 ? (1 - w.dimV * 0.7) : 0;
          if (w.label.op !== op) {
            w.label.op = op;
            w.label.el.style.opacity = op;
          }
          w.label.el.classList.toggle("is-hot", w.hot > 0.5);
        }
      });
      tool.bridges.forEach(function (b) {
        b.draw = reduce ? 1 : easeOutCubic(clamp((now - b.drawT0) / 700, 0, 1));
        b.mesh.geometry.setDrawRange(0, Math.ceil(b.mesh.userData.segs * b.draw) * 8 * 6);
        b.holder.visible = b.draw > 0;
        b.cones.forEach(function (c) {
          c.visible = b.draw > 0.97;
        });
        b.mat.color.copy(WIRE_HOT);
        b.mat.emissive.copy(WIRE_HOT).multiplyScalar(0.22);
      });
      if (tool.away && !flight) {
        tool.board.visible = false;
        tool.floorShadow.visible = false;
      }
      tool.board.position.z = tool.baseZ == null ? (tool.baseZ = tool.board.position.z) : tool.baseZ + tool.lift.x * 60;
      updatePackets(tool, now);
      // HTML faces only for tools near the camera
      const near = tool.cssNear;
      if (tool.cssShown !== near) {
        tool.cssShown = near;
        cssToolObjects[id].forEach(function (o) {
          o.visible = near;
        });
        if (near && !tool.fitted) {
          tool.fitted = true;
          setTimeout(function () {
            tool.cards.forEach(function (c) {
              fitFaceText(c.fEl);
              fitFaceText(c.bEl);
            });
          }, 60);
        }
      }
    });
  }

  function setOpacity(c, op) {
    op = Math.round(op * 100) / 100;
    if (c._op === op) return;
    c._op = op;
    c.fEl.style.opacity = op;
    c.bEl.style.opacity = op;
  }

  /* ---- Render loop ---- */

  let raf = 0;
  function frame() {
    raf = 0;
    const now = clock();
    update(now);
    renderer.render(scene, camera);
    css.render(scene, camera);
    sampleQuality(now);
    schedule();
  }
  function schedule() {
    if (raf || document.hidden) return;
    if (reduce) {
      // Render only while something is still settling.
      if (clock() - settleUntil > 0) return;
    }
    raf = requestAnimationFrame(frame);
  }
  let settleUntil = 0;
  function kick(ms) {
    settleUntil = Math.max(settleUntil, clock() + (ms || 600));
    schedule();
  }
  function sampleQuality(now) {
    if (reduce || quality < 2 || flight) return;
    if (now - stepT0 < 2500) return;
    frameTimes.push(now);
    if (frameTimes.length > 90) {
      const span = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / (frameTimes.length - 1);
      frameTimes.length = 0;
      if (span > 30) {
        // Too slow: drop the soft shadows, the clearcoat and the pixel ratio.
        quality = 1;
        PR = 1;
        renderer.setPixelRatio(1);
        allCards.forEach(function (c) {
          c.mat.clearcoat = 0;
        });
        resize();
        body.classList.add("is-lite");
      }
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      lastT = 0;
    } else kick(800);
  });

  function resize() {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.setSize(W, H);
    css.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    applyViewOffset();
    if (step) {
      restPose = poseFor(step);
      if (step.ring) {
        const tool = tools[step.tool];
        applyLayout(tool, step, clock() - 5000);
      }
    }
    kick(400);
  }

  /* ---- Pointer: drag to orbit within limits, spring back on release ---- */

  let dragging = false, dragMoved = false, dsx = 0, dsy = 0, dyaw0 = 0, dpitch0 = 0;
  window.addEventListener("pointerdown", function (e) {
    if (listMode || mode !== "gl") return;
    if (e.target.closest(".x-ui, .x-modal, .nav, a, .x-rail, .x-bar, .x-caption")) return;
    dragging = true;
    dragMoved = false;
    dsx = e.clientX;
    dsy = e.clientY;
    dyaw0 = orbit.ty;
    dpitch0 = orbit.tp;
    lastInput = clock();
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    const dx = e.clientX - dsx, dy = e.clientY - dsy;
    if (!dragMoved && Math.hypot(dx, dy) > 5) {
      dragMoved = true;
      body.classList.add("is-dragging");
    }
    if (dragMoved && !reduce) {
      orbit.ty = clamp(dyaw0 - dx * 0.12, -25, 25);
      orbit.tp = clamp(dpitch0 + dy * 0.08, -12, 12);
      lastInput = clock();
      kick(800);
    }
  });
  window.addEventListener("pointerup", function () {
    if (!dragging) return;
    dragging = false;
    body.classList.remove("is-dragging");
    orbit.ty = 0;
    orbit.tp = 0;
    setTimeout(function () {
      dragMoved = false;
    }, 0);
    kick(1500);
  });

  reduceQuery.addEventListener("change", function () {
    if (step) showStep(step, true);
  });

  return {
    show: function (st, cut) {
      showStep(st, cut);
      kick(reduce ? 400 : 4000);
    },
    resize: resize,
    poke: function () {
      lastInput = clock();
    },
    setRate: setClockRate,
    unhover: function () {
      allCards.forEach(function (c) {
        hoverCard(c, false);
      });
    },
    info: function () {
      return { quality: quality, pr: PR, flight: !!flight, step: step && step.id };
    },
    debug: { tools: tools, camera: camera }
  };
}

/* ---------- Input ---------- */

let wheelAcc = 0, wheelLock = 0;
window.addEventListener("wheel", function (e) {
  if (listMode || !modal.hidden) return;
  if (e.target.closest(".x-modal")) return;
  e.preventDefault();
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += e.deltaY + e.deltaX;
  if (Math.abs(wheelAcc) > 60) {
    if (wheelAcc > 0) next();
    else prev();
    wheelAcc = 0;
    wheelLock = now + 1100;
  }
}, { passive: false });

let tsx = null, tsy = null;
window.addEventListener("touchstart", function (e) {
  if (listMode || e.touches.length !== 1) return;
  tsx = e.touches[0].clientX;
  tsy = e.touches[0].clientY;
}, { passive: true });
window.addEventListener("touchend", function (e) {
  if (tsx == null) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tsx, dy = t.clientY - tsy;
  tsx = tsy = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 60) return;
  const d = Math.abs(dx) > Math.abs(dy) ? dx : dy;
  if (d < 0) next();
  else prev();
});

document.addEventListener("keydown", function (e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (!modal.hidden) {
    if (e.key === "Escape") closeModal();
    return;
  }
  if (listMode) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea") return;
  if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
    e.preventDefault();
    next();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
    e.preventDefault();
    prev();
  } else if (e.key === " " && tag !== "button" && tag !== "a") {
    e.preventDefault();
    if (e.shiftKey) prev();
    else next();
  } else if (e.key === "Home") {
    go(0);
  } else if (e.key === "End") {
    go(STEPS.length - 1);
  } else if (e.key === "Escape" && cur < 0) {
    go(stepIndex.explore);
  } else if (e.key === "f" || e.key === "F") {
    toggleFull();
  }
  if (GLW) GLW.poke();
});

function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen();
  else if (root.requestFullscreen) root.requestFullscreen().catch(function () {});
}

/* ---------- Boot ---------- */

if (DECK) {
  buildRail();
  const st = DECK.cover.stats;
  st.forEach(function (x) {
    const d = el("div", "x-stat");
    const b = el("b");
    b.appendChild(countSpan(x[0]));
    d.appendChild(b);
    d.appendChild(el("span", null, x[1]));
    statsEl.appendChild(d);
  });
  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", function () {
    go(stepIndex.explore);
  });
  exploreBtn.addEventListener("click", function () {
    go(stepIndex.explore);
  });
  const fullBtn = document.querySelector("[data-full]");
  if (!document.fullscreenEnabled) fullBtn.hidden = true;
  fullBtn.addEventListener("click", toggleFull);
  document.addEventListener("fullscreenchange", function () {
    const on = !!document.fullscreenElement;
    body.classList.toggle("is-full", on);
    fullBtn.setAttribute("aria-pressed", on ? "true" : "false");
    layout();
  });
  const toggle = document.querySelector("[data-nav-toggle]");
  if (toggle) {
    toggle.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }
  window.addEventListener("resize", layout);
  window.addEventListener("hashchange", function () {
    const h = stepFromHash();
    if (h.i < 0) goExplore(h.tool, { fromHash: true });
    else go(h.i, { fromHash: true });
  });
  root.classList.add("js");
  layout();
  const h = stepFromHash();
  if (h.i < 0) goExplore(h.tool, { fromHash: true });
  else go(h.i, { fromHash: true, force: true });
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      document.querySelectorAll(".x-css3d .c-face").forEach(fitFaceText);
    });
  }
  setTimeout(function () {
    document.querySelectorAll(".x-css3d .c-face").forEach(fitFaceText);
  }, 1500);
}
