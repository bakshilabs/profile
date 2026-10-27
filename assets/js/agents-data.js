/* Bakshi Labs: content for the agent workflow slides.
   Each tool slide places its cards on a 1472 × 600 canvas. Edges are
   [from, to, options]; options can set a label (l), both directions (bi),
   the exit and entry sides (fs, ts: l r t b), the fraction along those
   sides (fo, tf) and the position of the middle run (mid). */

window.AGENT_DECK = {
  cover: {
    kicker: "Bakshi Labs · Seven tools",
    title: "Agent Workflows",
    lede: "Each slide maps how the agents in one tool hand work to each other. Hover over a card to flip it, and click it to read the full description.",
    stats: [
      ["13", "agents run inside four of the tools"],
      ["6", "build agents made two of the others"],
      ["0", "agents call another agent directly"]
    ]
  },

  slides: [
    {
      id: "modelchat",
      app: "ModelChat",
      kicker: "01 · Design · BIM model queries",
      title: "ModelChat",
      lede: "One Claude agent answers questions about an IFC model. Its 14 tools either read the model index in the helper or drive the 3D viewer in the browser.",
      tag: "1 agent · 14 tools",
      cw: 320,
      ch: 128,
      lanes: [
        { x: 0, y: -4, t: "Browser" },
        { x: 576, y: -4, t: "Helper on port 8787" },
        { x: 1112, y: -4, t: "Claude Code process" }
      ],
      nodes: [
        {
          id: "chat", k: "ui", x: 40, y: 20, n: "Chat panel",
          s: "Sends each message and streams the reply.",
          b: "The panel posts each message to /chat. The reply, the tool chips and the end of the turn arrive as server-sent events.",
          f: [["Runs in", "The browser"], ["Sends", "POST /chat"], ["Receives", "SSE events on /events"], ["Source", "src/components/ChatPanel.tsx, src/chat/useChat.ts"]]
        },
        {
          id: "helper", k: "code", x: 576, y: 20, n: "Express helper",
          s: "Relays between the browser and Claude.",
          b: "It passes each message to the claude CLI on stdin and forwards the CLI's stream-json output to the browser as SSE.",
          f: [["Runs in", "Node on 127.0.0.1:8787"], ["Modes", "One persistent CLI process, or one process per turn on Windows"], ["Source", "helper/index.ts, helper/claudeBridge.ts"]]
        },
        {
          id: "agent", k: "agent", x: 1112, y: 20, n: "BIM assistant",
          s: "Answers model questions with 14 tools.",
          b: "The only model in ModelChat. It backs every number with a tool call and asks one short question when a reference is ambiguous.",
          a: [
            "ModelChat's only agent answers plain-English questions about the loaded IFC model and drives the 3D viewer to show its answer.",
            "Its system prompt tells it to back every numeric or counting answer with a tool call. A request to show something runs query_index, then isolate and focus_camera. A whole-model quantity comes from compute_quantity, with the unit and method reported.",
            "When a reference such as \"the meeting room\" is ambiguous, it asks one short clarifying question. Replies stay short, and it does not narrate each tool call."
          ],
          f: [["Model", "Claude, through the local Claude Code login"], ["Runtime", "claude CLI with --append-system-prompt, --allowedTools and --mcp-config"], ["Memory", "The session id is saved and passed back with --resume"], ["Tools", "6 index tools and 8 viewer tools"], ["Source", "helper/index.ts (SYSTEM_PROMPT, ALLOWED_TOOLS)"]]
        },
        {
          id: "mcp", k: "tool", x: 1112, y: 235, n: "modelchat MCP server",
          s: "Forwards each tool call to the helper.",
          b: "The CLI starts this stdio server as a child process. Each handler posts the call to /tool/<name> and returns the JSON result.",
          f: [["Transport", "MCP JSON-RPC over stdio, then HTTP to the helper"], ["Tools", "14"], ["Source", "helper/mcpStdio.ts"]]
        },
        {
          id: "router", k: "code", x: 576, y: 235, n: "Tool router",
          s: "Answers index tools and passes viewer tools on.",
          b: "The six index tools run here. The eight viewer tools are sent to the browser, and the router waits for each result.",
          f: [["Index tools", "list_storeys, list_categories, list_spaces, query_index, compute_quantity, get_properties"], ["Viewer tools", "isolate, show_all, focus_camera, highlight, clear_highlight, set_section_plane, select, screenshot"], ["Source", "helper/index.ts"]]
        },
        {
          id: "viewer", k: "ui", x: 40, y: 235, n: "3D viewer",
          s: "Isolates, highlights, cuts and frames elements.",
          b: "It runs each viewer tool it receives and posts the result to /tool-result. The helper waits up to 30 seconds.",
          f: [["Built with", "Three.js and web-ifc"], ["Returns", "POST /tool-result"], ["Screenshot", "A PNG data URL up to 1280 px wide"], ["Source", "src/viewer/toolExecutor.ts"]]
        },
        {
          id: "load", k: "code", x: 40, y: 450, n: "Model loading",
          s: "Prepares the model before the first question.",
          b: "A dropped IFC file is hashed and looked up in the caches. On a miss the helper preprocesses it, and the browser posts the index.",
          f: [["Trigger", "An IFC file dropped or opened"], ["Caches", "Browser OPFS first, then the helper's disk cache"], ["Source", "src/.../loadModel.ts, helper/preprocess.ts"]]
        },
        {
          id: "index", k: "data", x: 576, y: 450, n: "Model index",
          s: "Storeys, categories, spaces and quantities.",
          b: "The helper keeps one index in memory. If it is empty, it reloads the last model from the disk cache before answering.",
          f: [["Held in", "Helper memory (indexStore)"], ["Fallback", ".cache/preprocess/<sha>/index.json"], ["Source", "helper/indexStore.ts, helper/preprocessCache.ts"]]
        }
      ],
      edges: [
        ["chat", "helper", { l: "message · reply", bi: true }],
        ["helper", "agent", { l: "stdin · stream-json", bi: true }],
        ["agent", "mcp", { l: "tool calls", bi: true }],
        ["mcp", "router", { l: "HTTP", bi: true }],
        ["router", "viewer", { l: "SSE · result", bi: true }],
        ["router", "index", { l: "reads", bi: true }],
        ["load", "viewer", { l: "geometry" }],
        ["load", "index", { l: "index" }]
      ]
    },

    {
      id: "growthsignal",
      app: "GrowthSignal",
      kicker: "02 · Win work · Bid intelligence database",
      title: "GrowthSignal",
      lede: "Seven Claude agents read and write one SQLite database. None of them calls another, and none of them can use tools.",
      tag: "7 agents · 1 database",
      cw: 222,
      ch: 136,
      small: true,
      lanes: [
        { x: 0, y: 0, t: "Nightly at 03:00, in order" },
        { x: 0, y: 372, t: "Run by hand" },
        { x: 1250, y: 372, t: "On demand" }
      ],
      nodes: [
        {
          id: "ingest", k: "code", x: 0, y: 28, n: "Connectors ingest",
          s: "Pulls records from 270+ public sources.",
          b: "All connectors run in parallel and upsert tenders, projects, deals, news items and raw documents.",
          f: [["Sources", "UK, European and US portals, development banks, open-contracting feeds and news"], ["Trigger", "Nightly at 03:00, or the /ops page"], ["Source", "scripts/ingest.ts, web/src/lib/sources/"]]
        },
        {
          id: "embed", k: "code", x: 250, y: 28, n: "Embed chunks",
          s: "Builds search vectors on the machine.",
          b: "It chunks the five source tables and embeds them with a local bge-small model. Enrichment output is not embedded.",
          f: [["Model", "Xenova/bge-small-en-v1.5, run locally"], ["Writes", "chunks, vec_chunks"], ["Source", "web/src/lib/embeddings/index.ts"]]
        },
        {
          id: "enrich", k: "agent", x: 500, y: 28, n: "Enrichment analyst",
          s: "Turns raw records into fields and fit scores.",
          b: "It reads each unenriched tender or project and returns one JSON object of fields, fit scores and a verdict.",
          a: [
            "The enrichment analyst reads raw tender and project records, with their incumbent awards, and returns a single JSON object of structured fields.",
            "The fields cover stage, sub-sector, owner, design team, contractor, storeys, floor area, value in USD, start and end quarters, funding mode, city and a one-sentence narrative. It also scores fit for the practice from 0 to 100 on sector, scale, geography and win probability, and writes a one-sentence verdict.",
            "Every call is logged with a hash of its prompt. When the prompt changes, a run with --stale re-enriches the records it affects."
          ],
          f: [["Model", "claude-haiku-4-5"], ["Tools", "None (--tools \"\")"], ["Reads", "tenders, projects, awards"], ["Writes", "enrichments, verdict_audit"], ["Trigger", "Nightly, or Enrich now on the /ops page"], ["Source", "web/src/lib/claude/enrichment.ts"]]
        },
        {
          id: "themes", k: "code", x: 750, y: 28, n: "Themes and alerts",
          s: "Re-runs saved searches with no model call.",
          b: "Both steps run hybrid retrieval over the corpus and record how many records each saved search now matches.",
          f: [["Writes", "alerts hit counts"], ["Source", "scripts/themes.ts, scripts/alerts.ts"]]
        },
        {
          id: "briefing", k: "agent", x: 1000, y: 28, n: "Briefing writer",
          s: "Writes the daily briefing from the last 36 hours.",
          b: "It summarises new tenders, approved projects, news and deals in five sections and cites each source ID.",
          a: [
            "The briefing writer turns the last 36 hours of records into a daily construction-intelligence briefing for a senior architect or engineer.",
            "It writes 250 to 400 words in five sections: Top deals, Tenders to watch, Project approvals, Sector signals and Watch-list. Each bullet leads with the buyer, country or firm, bolds values and dates, and cites source IDs such as [t1234].",
            "Its prompt asks it to be opinionated about what is unusual or large, and to leave out any value it was not given."
          ],
          f: [["Model", "claude-sonnet-4-6"], ["Tools", "None"], ["Reads", "tenders, projects, news_items, deals from the last 36 hours"], ["Writes", "briefings, one row per date"], ["Shown on", "The home page"], ["Source", "web/src/lib/claude/briefing.ts"]]
        },
        {
          id: "digest", k: "out", x: 1250, y: 28, n: "Daily digest",
          s: "Saves the day's digest as Markdown.",
          b: "The last nightly step writes the day's digest to a Markdown file in the digests folder.",
          f: [["Writes", "digests/*.md"], ["Source", "scripts/digest.ts"]]
        },
        {
          id: "db", k: "data", x: 0, y: 222, w: 1472, h: 112, n: "SQLite database",
          s: "tenders · projects · deals · news_items · chunks · enrichments · verdict_audit · briefings · chat_messages · record_ask_cache",
          b: "Every agent reads its inputs from these tables and writes its results back. Rows the scripts add are enriched the next night.",
          a: [
            "The database is the only thing the seven agents share. Each one reads its inputs from these tables and writes its results back to them.",
            "Rows that the news and SEC scripts add have no enrichment yet, so the next nightly enrichment run selects them. The next embedding run chunks them too."
          ],
          f: [["Engine", "SQLite with sqlite-vec and full-text search"], ["Tables", "raw_documents, tenders, projects, deals, news_items, companies, awards, chunks, vec_chunks, chunks_fts, enrichments, verdict_audit, briefings, alerts, chat_conversations, chat_messages, record_ask_cache, news_extractions, sec_filing_extractions"]]
        },
        {
          id: "deal", k: "agent", x: 0, y: 400, n: "Deal analyst",
          s: "Reads deals for construction signals.",
          b: "It extracts deal facts and judges which construction pipeline a deal signals. It runs only with --tables deals.",
          a: [
            "The deal analyst reads M&A and investment records and extracts the acquirer, target, value, deal type, status and strategic rationale.",
            "It then decides what built-environment pipeline the deal signals, such as data centres or ports, and scores sector, scale and geography fit and win probability from 0 to 100. Its verdict opens with \"Pursue actively\", \"Monitor\" or \"Deprioritise\".",
            "The nightly run enriches tenders and projects only, so this agent runs when enrichment is started with --tables deals."
          ],
          f: [["Model", "claude-haiku-4-5"], ["Tools", "None"], ["Reads", "deals"], ["Writes", "deals (missing fields only), enrichments, verdict_audit"], ["Trigger", "Enrichment run with --tables deals"], ["Source", "web/src/lib/claude/enrichment.ts (DEAL_SYSTEM)"]]
        },
        {
          id: "news", k: "agent", x: 250, y: 400, n: "News-to-project extractor",
          s: "Turns announcements into project records.",
          b: "It scans each unseen news item. A specific new building or programme becomes a project row with the source news:<id>.",
          a: [
            "This agent scans news items for announcements of a specific new building, infrastructure programme or development.",
            "It skips corporate transactions, opinion pieces, completed buildings, awards, appointments and vague mentions. A confident match becomes a new project record, with its stage and opportunity score."
          ],
          f: [["Model", "claude-haiku-4-5"], ["Reads", "news_items not yet in news_extractions"], ["Writes", "projects, raw_documents, news_extractions"], ["Trigger", "Run by hand"], ["Source", "scripts/news-to-project.ts"]]
        },
        {
          id: "sec", k: "agent", x: 500, y: 400, n: "SEC capex extractor",
          s: "Finds named projects in 10-K and 10-Q filings.",
          b: "It reads capital-expenditure paragraphs from EDGAR filings and lists projects tied to a specific building or site.",
          a: [
            "The script pulls the latest 10-K and four 10-Q filings from EDGAR for a list of large corporate occupiers and keeps the capital-expenditure paragraphs that carry a number.",
            "The agent lists named projects tied to a specific building, site, campus or facility, with at least a location, value, floor area, year or developer. Generic capex totals, buybacks and M&A are left out."
          ],
          f: [["Model", "claude-haiku-4-5"], ["Reads", "SEC EDGAR filings"], ["Writes", "projects under sec:capex, sec_filing_extractions"], ["Trigger", "Run by hand"], ["Source", "scripts/sec-10k-capex.ts"]]
        },
        {
          id: "campus", k: "agent", x: 750, y: 400, n: "Campus re-enrichment",
          s: "Re-scores campus-type records.",
          b: "Two scripts give headquarters, healthcare and education records a second pass under a looser campuses definition.",
          a: [
            "Two scripts select records that look like campuses, headquarters, healthcare or education buildings and enrich them again.",
            "The second pass uses a looser definition of the campuses sector that accepts single flagship buildings, so the sector fills faster."
          ],
          f: [["Model", "claude-haiku-4-5 at low effort"], ["Reads", "projects, tenders"], ["Writes", "enrichments"], ["Trigger", "Run by hand"], ["Source", "scripts/enrich-campuses-candidates.ts, scripts/reenrich-anchor-class.ts"]]
        },
        {
          id: "chat", k: "agent", x: 1250, y: 400, n: "Intelligence analyst",
          s: "Answers questions with cited sources.",
          b: "It answers from the 8 most relevant chunks and cites each one. Repeat questions replay a cached answer.",
          a: [
            "The intelligence analyst answers questions in the chat dock, on the /ask page and from the Ask Claude button on each record.",
            "Retrieval fuses vector and keyword search and passes the 8 most relevant chunks in a context block. The agent treats them as ground truth, cites them inline as [1] and [2], labels inferences and never invents figures.",
            "A question already asked about a record replays its cached answer with no model call."
          ],
          f: [["Model", "claude-sonnet-4-6, streamed"], ["Retrieval", "Local embeddings and BM25, fused, top 8 chunks"], ["Writes", "chat_messages, record_ask_cache"], ["Source", "web/src/lib/claude/chat.ts, web/src/lib/claude/rag.ts"]]
        }
      ],
      edges: [
        ["ingest", "embed"],
        ["embed", "enrich"],
        ["enrich", "themes"],
        ["themes", "briefing"],
        ["briefing", "digest"],
        ["ingest", "db", { l: "writes" }],
        ["embed", "db", { bi: true }],
        ["enrich", "db", { bi: true }],
        ["themes", "db", { bi: true }],
        ["briefing", "db", { bi: true }],
        ["db", "digest", { l: "reads" }],
        ["db", "deal", { bi: true }],
        ["db", "news", { bi: true }],
        ["sec", "db", { l: "writes" }],
        ["db", "campus", { bi: true }],
        ["db", "chat", { bi: true }]
      ]
    },

    {
      id: "spd",
      app: "Strategic Project Discovery",
      kicker: "03 · Win work · Live project search",
      title: "Strategic Project Discovery",
      lede: "One Gemini agent runs for each sector scan. It searches the web through Google Search and returns scored opportunities as JSON.",
      tag: "1 agent · 1 search tool",
      cw: 220,
      ch: 128,
      small: true,
      nodes: [
        {
          id: "sector", k: "ui", x: 0, y: 0, n: "Sector",
          s: "A sidebar click or Scan All.",
          b: "Seven fixed sectors sit in the sidebar. Scan All runs them one after another, pausing 4 seconds between live calls.",
          f: [["Sectors", "7"], ["Scan All", "A sequential loop with a 4,000 ms pause in live mode"], ["Source", "strategic-project-discovery.html"]]
        },
        {
          id: "region", k: "ui", x: 0, y: 236, n: "Region",
          s: "Six regions, including Global.",
          b: "The chosen region is written into the prompt. Demo mode filters its sample data by the same region.",
          f: [["Options", "6, including Global"]]
        },
        {
          id: "sources", k: "ui", x: 0, y: 472, n: "Sources",
          s: "676 toggles in 36 categories.",
          b: "Every source starts switched on. The prompt names only the first 60 enabled sources.",
          f: [["Sources", "676 in 36 categories"], ["In the prompt", "The first 60 enabled names"]]
        },
        {
          id: "fetch", k: "code", x: 250, y: 236, n: "fetchOpportunities",
          s: "Builds the prompt and calls the model.",
          b: "It checks for a saved Gemini key. With a key it calls Gemini, and without one it returns demo data.",
          f: [["Key", "Saved in localStorage as gia_gemini_key"], ["Source", "strategic-project-discovery.html"]]
        },
        {
          id: "search", k: "ext", x: 500, y: 0, n: "Google Search",
          s: "The grounding tool built into Gemini.",
          b: "Gemini runs the searches itself. The app never reads the grounding metadata that comes back.",
          f: [["Tool", "google_search"], ["Runs in", "Google's servers, inside the Gemini call"]]
        },
        {
          id: "gemini", k: "agent", x: 500, y: 236, n: "Discovery engine",
          s: "Finds and scores live opportunities.",
          b: "Gemini 2.5 Flash searches for 8 to 20 current opportunities and scores each one for sector, scale, geography and win probability.",
          a: [
            "The app's only agent is a business development intelligence engine. For the chosen sector and region it finds 8 to 20 real, current infrastructure procurement opportunities.",
            "It returns them as a JSON array. Each result carries a title, client, location with latitude and longitude, stage, urgency, relevance, value, deadline, contract type, source, overview and context.",
            "Each result also holds a fit assessment: sector fit, scale fit, geographic fit and win probability from 0 to 100, with a one-line verdict."
          ],
          f: [["Model", "gemini-2.5-flash"], ["Tools", "Google Search grounding"], ["Settings", "Temperature 0.7, up to 8,192 output tokens"], ["Key", "The user's own Gemini API key, sent from the browser"], ["Source", "strategic-project-discovery.html"]]
        },
        {
          id: "demo", k: "data", x: 500, y: 472, n: "Demo data",
          s: "Sample results used without a key.",
          b: "It waits about a second, then filters the fictional opportunities in demo-data.js by region.",
          f: [["Source", "demo-data.js"]]
        },
        {
          id: "parse", k: "code", x: 750, y: 236, n: "JSON recovery",
          s: "Three attempts to read the reply.",
          b: "It tries a plain parse, then a trimmed array, then each object on its own. A failure shows an error banner.",
          f: [["Retries", "None"], ["Validation", "No field or schema checks"]]
        },
        {
          id: "results", k: "data", x: 1000, y: 236, n: "Results by sector",
          s: "Each new scan replaces the last.",
          b: "Results are stored per sector with no deduplication. The views combine the results of every sector.",
          f: [["Held in", "React state, keyed by sector"]]
        },
        {
          id: "list", k: "out", x: 1250, y: 0, n: "Result list",
          s: "Cards with the fit assessment.",
          b: "Each card expands to show sector fit, scale fit, geographic fit, win probability and the verdict."
        },
        {
          id: "map", k: "out", x: 1250, y: 236, n: "World map",
          s: "Leaflet markers coloured by urgency.",
          b: "Every result with a latitude and longitude is plotted. Results without a location are skipped."
        },
        {
          id: "files", k: "out", x: 1250, y: 472, n: "JSON files",
          s: "Downloads and saved searches.",
          b: "Live scans download one JSON file per sector. Save keeps the last 10 searches in the browser."
        }
      ],
      edges: [
        ["sector", "fetch", { fs: "r", ts: "t" }],
        ["region", "fetch"],
        ["sources", "fetch", { fs: "r", ts: "b", tf: 0.3 }],
        ["fetch", "gemini"],
        ["fetch", "demo", { fs: "b", fo: 0.7, ts: "l", l: "no key" }],
        ["gemini", "search", { bi: true, l: "grounding" }],
        ["gemini", "parse"],
        ["parse", "results"],
        ["demo", "results", { fs: "r", ts: "b", tf: 0.3 }],
        ["results", "list", { fs: "t", ts: "l" }],
        ["results", "map"],
        ["results", "files", { fs: "b", fo: 0.7, ts: "l" }]
      ]
    },

    {
      id: "worknodescanvas",
      app: "WorkNodesCanvas",
      kicker: "04 · Deliver · Document workbench",
      title: "WorkNodesCanvas",
      lede: "Four Claude agents run from the canvas. They hand work to each other only through the results saved on each node.",
      tag: "4 agents · 1 canvas",
      cw: 300,
      ch: 128,
      nodes: [
        {
          id: "user", k: "ui", x: 0, y: 0, n: "User",
          s: "Wires nodes, runs them and chats.",
          b: "The user wires references into analyses and presentations, clicks Run on each node and types requests in the side chat."
        },
        {
          id: "anodes", k: "ui", x: 586, y: 0, n: "Analysis nodes",
          s: "An objective plus wired inputs.",
          b: "Each analysis uses the references and analyses wired into it. Nodes run one at a time, when the user clicks Run."
        },
        {
          id: "pnodes", k: "ui", x: 1172, y: 0, n: "Presentation nodes",
          s: "A brief plus wired analyses.",
          b: "A presentation reads the results its wired analyses already hold. The helper never runs upstream nodes first."
        },
        {
          id: "chat", k: "agent", x: 0, y: 170, n: "Canvas chat assistant",
          s: "Changes the canvas through JSON actions.",
          b: "It sees a summary of every node and ends a reply with a block of actions when the canvas should change.",
          a: [
            "The chat assistant holds a conversation in the side panel and can change the canvas on request.",
            "Its prompt carries a summary of up to 80 nodes, with each one's id, type, name, key fields, position, size and whether it has a result. When the canvas should change, it ends the reply with a JSON block of actions.",
            "The 11 actions create references, notes, analyses and presentations, update, connect, disconnect and delete nodes, and set position, size and collapsed state. Chat has no action that starts a run."
          ],
          f: [["Model", "Claude, through the local claude CLI"], ["Call", "--print --output-format json, 180-second limit"], ["Reply", "One JSON request and reply, not streamed"], ["Source", "worknodescanvas.py (CHAT_SYSTEM_PROMPT)"]]
        },
        {
          id: "agent", k: "agent", x: 586, y: 170, n: "Analysis agent",
          s: "Works through a node's objective.",
          b: "It reads the wired references and upstream results, then answers the objective. A run stops after 10 minutes.",
          a: [
            "The analysis agent runs when the user clicks Run on an Analysis node. It works through the node's objective using the wired reference files and the results of directly wired analyses.",
            "Text files up to 100 KB are placed in the prompt. Larger files such as PDFs and Office documents are passed as paths for the agent to open with the Read tool. URLs are passed as text.",
            "It answers with no preamble and uses Markdown tables when asked for a table. JSON with a known type, such as a compliance matrix, is rendered as a formatted table. Progress streams back to the canvas as NDJSON."
          ],
          f: [["Model", "Claude, through the local claude CLI"], ["Call", "--print --output-format stream-json --verbose --dangerously-skip-permissions"], ["Limit", "600 seconds"], ["Source", "worknodescanvas.py (run_claude, assemble_analysis_prompt)"]]
        },
        {
          id: "builder", k: "agent", x: 1172, y: 170, n: "Document builder",
          s: "Writes the deck, report or page.",
          b: "It turns wired references and analyses into a PPTX, DOCX or HTML file that follows the node's brief.",
          a: [
            "The document builder runs when the user clicks Run on a Presentation node. It turns the wired references and analyses into a file that follows the node's brief.",
            "A deck is built with the pptx skill, a Word report with python-docx and an HTML report with the Write tool. It writes the file to a fixed path and replies with one line.",
            "If no file is written, the run fails. A run that times out still succeeds when the file exists."
          ],
          f: [["Model", "Claude, through the local claude CLI"], ["Formats", "PPTX, DOCX, HTML"], ["Source", "worknodescanvas.py (assemble_presentation_prompt)"]]
        },
        {
          id: "checks", k: "code", x: 0, y: 340, n: "Action checks",
          s: "Validates every chat action.",
          b: "Ids must exist, wires must follow the allowed directions and positions snap to the grid. Each action passes or fails alone.",
          f: [["Wires", "Reference to Analysis or Presentation, Analysis to Analysis or Presentation"], ["Source", "worknodescanvas.py (apply_chat_actions)"]]
        },
        {
          id: "salvage", k: "agent", x: 586, y: 340, n: "Chunked salvage planner",
          s: "Splits an answer that timed out.",
          b: "One plan call splits the answer into items. The helper then calls Claude per chunk, up to 40 times, and joins the parts.",
          a: [
            "The salvage planner takes over when an analysis run hits its 10-minute limit.",
            "In a plan call it returns JSON with a header, a footer, the list of items, a chunk size of 1 to 10 and a row template. The helper then sends one process call per chunk, up to 40, and joins the header, fragments and footer.",
            "Counts that depend on the finished cells, such as verdict totals, are written as tokens like {{P}} and filled in after assembly. Salvage covers analyses only."
          ],
          f: [["Model", "Claude, through the local claude CLI"], ["Mode", "WNC_SALVAGE_MODE: chunked (default), script or off"], ["Limit", "40 process calls"], ["Source", "worknodescanvas.py"]]
        },
        {
          id: "file", k: "out", x: 1172, y: 340, n: "Output file",
          s: "PPTX, DOCX or HTML.",
          b: "The builder writes the file to the outputs folder, and the helper renders thumbnails of each slide."
        },
        {
          id: "state", k: "data", x: 0, y: 505, w: 1472, h: 95, n: "Canvas state file",
          s: "Every node keeps its latest result and the five before it. Wired nodes read their inputs from here.",
          b: "The canvas JSON holds every node, wire and result. Downstream nodes read whatever result their wired nodes hold now.",
          f: [["History", "The last 5 results per node, for display only"], ["Race guard", "The helper keeps its newer result if the browser saves an older copy"]]
        }
      ],
      edges: [
        ["user", "anodes", { l: "Run" }],
        ["anodes", "pnodes", { l: "wired results" }],
        ["user", "chat", { l: "message" }],
        ["anodes", "agent"],
        ["pnodes", "builder"],
        ["chat", "checks", { l: "actions" }],
        ["agent", "salvage", { l: "on timeout" }],
        ["builder", "file"],
        ["checks", "state"],
        ["salvage", "state", { l: "result" }],
        ["agent", "state", { fs: "l", ts: "t", tf: 0.3 }]
      ]
    },

    {
      id: "rbe",
      app: "Reference Buildings Explorer",
      kicker: "05 · Design · Energy modelling",
      title: "Reference Buildings Explorer",
      lede: "The explorer runs no model. A main Claude Code agent wrote a shared contract, then four subagents built the data and the views in parallel.",
      tag: "1 main agent · 4 subagents",
      cw: 260,
      ch: 128,
      groups: [{ x: 582, y: 0, w: 308, h: 600, t: "Four subagents in parallel" }],
      nodes: [
        {
          id: "doe", k: "ext", x: 0, y: 0, n: "DOE reference page",
          s: "Its model links return 404.",
          b: "The Department of Energy page no longer links to its files. The main agent found them at their old location on energy.gov."
        },
        {
          id: "main", k: "build", x: 0, y: 240, n: "Main build agent",
          s: "Recovers the data and leads the build.",
          b: "It downloaded and sorted the models, wrote the contract, built the frame and bundler, then tested the whole dashboard.",
          a: [
            "The main agent did the research and recovery. It checked 64 download addresses, downloaded all 64 ZIPs, compared checksums to remove duplicates and sorted 864 files by building type.",
            "It wrote SPEC.md so the four subagents could work on their own, and built the dashboard frame, side panels and the bundler.",
            "After the subagents finished, it bundled their work and tested every tab in a headless browser at desktop and phone widths, fixing the layout problems it found."
          ],
          f: [["Tool", "Claude Code"], ["Record", "What-Claude-Code-Built.md"]]
        },
        {
          id: "library", k: "data", x: 0, y: 480, n: "Model library",
          s: "864 files sorted by building type.",
          b: "Models in two EnergyPlus versions, results workbooks and reports, 16 weather files and the original 64 ZIPs."
        },
        {
          id: "spec", k: "doc", x: 303, y: 120, n: "SPEC.md",
          s: "Owners, schema and view interface.",
          b: "It assigns each file to one agent, defines the window.RB data schema and requires every view to export mount(el, ctx).",
          f: [["Owners", "index.html: main agent; data.js: data agent; building3d.js: A; landscape.js: B; monthly.js: C"], ["Rules", "Views may import only three.js and must work from file://"], ["Source", "Dashboard/_build/SPEC.md"]]
        },
        {
          id: "shell", k: "code", x: 303, y: 360, n: "Shell and bundler",
          s: "The frame, side panels and bundle.py.",
          b: "The main agent wrote shell.html, with the top bar and side panels, and the bundler that joins every part into one page."
        },
        {
          id: "data", k: "sub", x: 606, y: 36, h: 128, n: "Data subagent",
          s: "Python pipeline for 256 combinations.",
          b: "It parsed reports, workbooks, EnergyPlus inputs and weather files into data.js, and validated the totals.",
          a: [
            "The data subagent wrote the Python pipeline that turns the model library into one dataset covering all 256 combinations of building type and climate.",
            "It reads the HTML simulation reports, the summary workbooks, the EnergyPlus input files for 3D geometry and the hourly weather files.",
            "Its validation found no missing values. Monthly totals match the annual figures within 0.01% for electricity and 0.13% for gas."
          ],
          f: [["Writes", "Dashboard/data.js"], ["Source", "build_data.py, htm_tables.py, idf_geom.py"]]
        },
        {
          id: "va", k: "sub", x: 606, y: 176, h: 128, n: "View agent A",
          s: "Building Explorer.",
          b: "It built the 3D building view with section cuts and exploded floors, working from mock data and checking screenshots.",
          a: ["View agent A built the Building Explorer: the EnergyPlus geometry in 3D, with a cutting plane, floor-by-floor slicing, exploded floors and rooms coloured by load or hours out of comfort.", "It built against mock data made from the real geometry and checked its work with automated browser screenshots."],
          f: [["Writes", "views/building3d.js"]]
        },
        {
          id: "vb", k: "sub", x: 606, y: 316, h: 128, n: "View agent B",
          s: "Types × Climates and End-Use Stacks.",
          b: "It built the energy city of 16 × 16 bars and the stacked end-use columns, checking each with screenshots.",
          a: ["View agent B built two views: Compare Types × Climates, an energy city of 16 × 16 bars with a moving cutting plane, and End-Use Stacks, 3D columns stacked by end use.", "It used a mock dataset when the real data was missing and checked its work with browser screenshots."],
          f: [["Writes", "views/landscape.js"]]
        },
        {
          id: "vc", k: "sub", x: 606, y: 456, h: 128, n: "View agent C",
          s: "Monthly, Climate Carpet and Schedules.",
          b: "It built the monthly surfaces, the hourly climate carpet and the operating schedules, each checked with screenshots.",
          a: ["View agent C built three views: Monthly Surfaces, Climate Carpet with 365 × 24 hours of weather as terrain, and Operating Schedules that morph between weekday and weekend.", "It added synthetic fields to the mock data while it worked and checked each view with screenshots."],
          f: [["Writes", "views/monthly.js"]]
        },
        {
          id: "bundle", k: "code", x: 922, y: 240, n: "bundle.py",
          s: "Joins the parts into one page.",
          b: "It replaces the placeholders in shell.html with data.js and the three view modules, and writes Dashboard/index.html."
        },
        {
          id: "dash", k: "out", x: 1212, y: 60, n: "Dashboard",
          s: "One 1.9 MB file with no model calls.",
          b: "The finished explorer opens straight from disk. Its only outside request loads three.js."
        },
        {
          id: "qa", k: "build", x: 1212, y: 420, n: "Browser check",
          s: "Every tab, at desktop and phone widths.",
          b: "The main agent tested every tab in a headless browser at 1400 and 520 px and fixed the layout problems it found.",
          f: [["Widths", "1400 px and 520 px"], ["Tool", "Headless Playwright browser"]]
        }
      ],
      edges: [
        ["doe", "main", { l: "64 ZIPs" }],
        ["main", "library"],
        ["main", "spec", { fs: "r", ts: "b" }],
        ["main", "shell", { fs: "r", fo: 0.8, ts: "t" }],
        ["spec", "data", { fs: "r", ts: "l", mid: 572 }],
        ["spec", "va", { fs: "r", ts: "l", mid: 572 }],
        ["spec", "vb", { fs: "r", ts: "l", mid: 572 }],
        ["spec", "vc", { fs: "r", ts: "l", mid: 572 }],
        ["data", "bundle", { fs: "r", ts: "l", tf: 0.2, mid: 904 }],
        ["va", "bundle", { fs: "r", ts: "l", tf: 0.4, mid: 904 }],
        ["vb", "bundle", { fs: "r", ts: "l", tf: 0.6, mid: 904 }],
        ["vc", "bundle", { fs: "r", ts: "l", tf: 0.8, mid: 904 }],
        ["bundle", "dash", { fs: "r", fo: 0.25, ts: "b" }],
        ["bundle", "qa", { fs: "b", ts: "l" }],
        ["qa", "bundle", { fs: "t", ts: "r", tf: 0.75, l: "fix layout" }]
      ]
    },

    {
      id: "materialscan",
      app: "MaterialScan",
      kicker: "06 · Design · Material compliance",
      title: "MaterialScan",
      lede: "MaterialScan runs no agent. Its verdicts are written by hand before the build, and a Python site generator turns them into static pages.",
      tag: "No agents",
      cw: 260,
      ch: 136,
      nodes: [
        {
          id: "docs", k: "ext", x: 0, y: 0, n: "Product documents",
          s: "EPDs, HPDs and Declare labels.",
          b: "Manufacturer evidence lives on the web. The notes say it was gathered by web search, fetch and extraction."
        },
        {
          id: "author", k: "maybe", x: 303, y: 0, n: "Research and authoring",
          s: "Done outside the repository.",
          b: "Each product was researched and its verdicts written. The notes mention a memory index, but no record confirms an assistant.",
          a: [
            "Someone researched each product's evidence and wrote a verdict for every standard. This happened outside the repository.",
            "The criteria notes say \"per memory\" and mention a memory index, which suggests an assistant session with memory. No transcript or prompt in the repository confirms it.",
            "The repository's only commit comes from a Claude Code branch that added a light theme."
          ],
          f: [["Evidence", "Compliance/Compliance_Criteria.md"]]
        },
        {
          id: "hand", k: "data", x: 606, y: 0, n: "Hand-written inputs",
          s: "Verdicts per sample, evidence files.",
          b: "Each palette sample carries lines such as \"LBC Core Compliance: PARTIAL\" with a reason and a source URL.",
          f: [["Files", "Palette/Materials_List_Compliance.txt, Compliance/"]]
        },
        {
          id: "standards", k: "data", x: 303, y: 232, n: "Standards text",
          s: "LBC 4.1, WELL v2 and the client brief.",
          b: "Plain-text extracts of each standard are parsed into the imperatives and features the site scores against."
        },
        {
          id: "parsers", k: "code", x: 606, y: 232, n: "Parsers and loaders",
          s: "build_html.py reads every input.",
          b: "A regular expression reads each verdict line. A missing or unreadable verdict becomes an evidence gap."
        },
        {
          id: "graph", k: "code", x: 909, y: 232, n: "Graph and scorecard",
          s: "Worst verdict per standard.",
          b: "build_graph keeps the worst verdict per standard. The scorecard counts evidence fields against fixed targets."
        },
        {
          id: "fetcher", k: "code", x: 909, y: 464, n: "Cover fetcher",
          s: "Saves each document's first page.",
          b: "It downloads every evidence URL on six threads, finds the PDF behind HTML pages and renders page one as a PNG."
        },
        {
          id: "render", k: "code", x: 1212, y: 232, n: "Renderers",
          s: "Section, material and gap pages.",
          b: "They write the HTML pages, the JSON data and the report, and a link check runs over the result."
        },
        {
          id: "site", k: "out", x: 1212, y: 0, n: "site/ folder",
          s: "Static HTML with no model calls.",
          b: "The published compliance dashboard. Its scripts make no network calls."
        }
      ],
      edges: [
        ["docs", "author"],
        ["author", "hand"],
        ["hand", "parsers"],
        ["standards", "parsers"],
        ["parsers", "graph"],
        ["graph", "render"],
        ["render", "site"],
        ["graph", "fetcher", { l: "document URLs" }],
        ["docs", "fetcher", { fs: "b", ts: "l" }],
        ["fetcher", "render", { fs: "r", ts: "b", l: "covers" }]
      ]
    },

    {
      id: "southwark",
      app: "Southwark Retrofit Atlas",
      kicker: "07 · Portfolio · Housing retrofit",
      title: "Southwark Retrofit Atlas",
      lede: "One Claude Code session built the atlas's data files. In the browser, plain code ranks all 149,062 homes with no model calls.",
      tag: "1 build agent",
      cw: 260,
      ch: 136,
      dividers: [{ x: 584, a: "Build time", b: "In the browser" }],
      nodes: [
        {
          id: "lbsm", k: "ext", x: 0, y: 0, n: "GLA LBSM 2",
          s: "149,062 homes, 63 columns.",
          b: "The Greater London Authority's building stock model gives each home's attributes as a raw CSV."
        },
        {
          id: "epc", k: "ext", x: 0, y: 232, n: "Non-domestic EPCs",
          s: "The national register, 1.9 GB.",
          b: "Non-domestic certificates supply the 7,045 commercial buildings that the atlas checks against MEES."
        },
        {
          id: "ons", k: "ext", x: 0, y: 464, n: "ONS and OS data",
          s: "Wards, postcodes and boundaries.",
          b: "Ward outlines and postcode lookups place each home and give the area views their boundaries."
        },
        {
          id: "session", k: "build", x: 303, y: 0, n: "Claude Code session",
          s: "Took the raw CSV to the finished app.",
          b: "The app's Method tab says one working session in Claude Code went from the raw CSV to the application.",
          a: [
            "The Method tab's \"How this was built\" card says one working session in Claude Code went from a raw CSV to the finished application, and lists its eight steps.",
            "The repository's only commit comes from a Claude Code branch. The packing scripts and test harness the timeline names are not in the repository, so they are known only from that text."
          ],
          f: [["Evidence", "app/index.html, Method tab"], ["Model calls at run time", "None"]]
        },
        {
          id: "pack", k: "code", x: 303, y: 232, n: "Filter, geocode, pack",
          s: "Typed, gzipped columns.",
          b: "Rows are filtered, geocoded and packed into typed columns, then gzipped. The scripts are not in the repository."
        },
        {
          id: "files", k: "data", x: 303, y: 464, n: "Three data files",
          s: "meta.json, homes.txt, commercial.txt.",
          b: "meta.json holds the column layout, lookups, wards and postcodes. The text files hold the packed homes and buildings."
        },
        {
          id: "controls", k: "ui", x: 606, y: 0, n: "User controls",
          s: "Budget, weights, strategy and prices.",
          b: "Budget, five weights, strategy, scope, rank mode, energy prices, heat pump SCOP, grid carbon and the grant toggle."
        },
        {
          id: "recompute", k: "code", x: 606, y: 232, n: "recompute",
          s: "Reruns only what a change needs.",
          b: "A 90 ms debounce groups changes. Weights rerun scoring, budget reruns allocation and prices rerun everything."
        },
        {
          id: "decode", k: "code", x: 606, y: 464, n: "Load and decode",
          s: "Runs once on page load.",
          b: "It fetches the three files, unzips and decodes the columns, then starts the first full run."
        },
        {
          id: "package", k: "code", x: 909, y: 232, n: "Package and cost",
          s: "A retrofit package for every home.",
          b: "It picks each home's package and works out its cost, CO2e saving, bill change and SAP score."
        },
        {
          id: "mees", k: "code", x: 909, y: 464, n: "MEES check",
          s: "7,045 commercial buildings.",
          b: "It flags each building's minimum energy efficiency risk and estimates the cost of reaching band B."
        },
        {
          id: "score", k: "code", x: 1212, y: 232, n: "Score and allocate",
          s: "Ranks homes and fills the budget.",
          b: "Carbon, gap, need, deliverability and confidence become weighted percentiles. The budget is then filled greedily."
        },
        {
          id: "map", k: "out", x: 1212, y: 0, n: "Canvas map",
          s: "Homes drawn on a canvas.",
          b: "The map is marked for redrawing after each run and redrawn from the new ranking."
        },
        {
          id: "views", k: "out", x: 1212, y: 464, n: "Views and tables",
          s: "Prioritise, Portfolio, Areas, Commercial.",
          b: "The Prioritise KPIs, charts and tables come from the run's totals. The other views redraw from the same results."
        }
      ],
      edges: [
        ["lbsm", "pack", { fs: "r", ts: "l", tf: 0.25, mid: 281 }],
        ["epc", "pack"],
        ["ons", "pack", { fs: "r", ts: "l", tf: 0.75, mid: 281 }],
        ["session", "pack", { l: "wrote and ran" }],
        ["pack", "files"],
        ["files", "decode"],
        ["controls", "recompute"],
        ["recompute", "package"],
        ["recompute", "score", { fs: "t", fo: 0.8, ts: "t", tf: 0.3, mid: 184, l: "weights or budget" }],
        ["decode", "package", { fs: "t", fo: 0.9, ts: "b", tf: 0.35, mid: 416 }],
        ["decode", "mees"],
        ["package", "score"],
        ["score", "map"],
        ["score", "views"],
        ["mees", "views"]
      ]
    }
  ]
};
