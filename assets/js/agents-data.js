/* Bakshi Labs: content for the agent workflow slides.
   Each tool slide places its cards on a 1472 × 600 canvas. Edges are
   [from, to, options]; options can set a label (l), both directions (bi),
   the exit and entry sides (fs, ts: l r t b), the fraction along those
   sides (fo, tf) and the position of the middle run (mid). */

window.AGENT_DECK = {
  "cover": {
    "kicker": "Bakshi Labs · Eight tools",
    "title": "Agent Architecture",
    "lede": "An agent is an AI model, such as Claude, given a task and tools. Each slide maps how the agents in one tool share work with code, data and people.",
    "stats": [
      [
        "22",
        "agents run inside five of the tools"
      ],
      [
        "6",
        "build agents wrote two of the other tools"
      ],
      [
        "0",
        "agents in a running tool hand work straight to another agent"
      ]
    ]
  },
  "slides": [
    {
      "id": "prospecht",
      "app": "Prospecht",
      "featured": true,
      "kicker": "01 · Win work · Opportunity intelligence",
      "title": "Prospecht",
      "lede": "Prospecht finds projects worth bidding for. Claude reads notices and web pages, the app checks each source, and a formula picks what to pursue.",
      "tag": "9 agents · 8,972 records",
      "stats": [
        [
          "8,972",
          "published records"
        ],
        [
          "8,871",
          "records verified"
        ],
        [
          "178",
          "countries"
        ],
        [
          "9",
          "agents"
        ]
      ],
      "cw": 210,
      "ch": 120,
      "small": true,
      "groups": [
        {
          "id": "tasks",
          "x": 0,
          "y": 440,
          "w": 1472,
          "h": 150,
          "t": "Seven agents run from buttons in the app"
        }
      ],
      "nodes": [
        {
          "id": "feeds",
          "k": "ext",
          "x": 0,
          "y": 0,
          "n": "Official feeds",
          "s": "Supplies official tender notices.",
          "b": "Notices from official portals and development banks arrive with no AI.",
          "f": [
            [
              "Feeds",
              "TED, Find a Tender, BOAMP, PLACSP, UK portals, SAM.gov, CanadaBuys, GETS, development banks and GrowthSignal's database"
            ],
            [
              "Source",
              "scripts/import-feeds.ts, scripts/feeds*.ts"
            ]
          ],
          "a": [
            "A script downloads notices from national tender portals and development bank project lists, and adds records already held in GrowthSignal's database. No AI is involved at this step."
          ]
        },
        {
          "id": "sorter",
          "k": "agent",
          "x": 252,
          "y": 0,
          "n": "Feed sorter",
          "s": "Sorts notices in batches of 40.",
          "b": "It sets aside non-design work and scores the rest, citing each notice.",
          "a": [
            "The feed sorter reads official notices in batches of 40. It first sets aside anything that is not architecture, engineering or design work.",
            "For each notice it keeps, it gives a sector, a sector fit score, a win probability, a stage, an English title and an exact passage copied from the notice. It uses the same judgement rules as the scan analyst, so imported and scanned records are scored the same way.",
            "The last run sorted 116 batches. It added 2,075 records and set aside 746 notices."
          ],
          "f": [
            [
              "Model",
              "claude-sonnet-5-5, through Claude Code"
            ],
            [
              "Tools",
              "None. Output must match a JSON schema"
            ],
            [
              "Trigger",
              "npm run import:feeds"
            ],
            [
              "Writes",
              "public/workspace.json, scripts/import-set-aside.json"
            ],
            [
              "Source",
              "scripts/import-feeds.ts"
            ]
          ]
        },
        {
          "id": "web",
          "k": "ext",
          "x": 0,
          "y": 150,
          "n": "Live web",
          "s": "Supplies search results and whole pages.",
          "b": "Scans search the web and open public pages to read them in full.",
          "f": [
            [
              "Tools",
              "web_search and web_fetch with an API key, or WebSearch and fetch_page on a subscription"
            ],
            [
              "Source",
              "src/lib/claude/scan.ts, scripts/claude-code-mcp.ts"
            ]
          ]
        },
        {
          "id": "scan",
          "k": "agent",
          "x": 252,
          "y": 150,
          "n": "Scan analyst",
          "s": "Finds live opportunities on the web.",
          "b": "It records each opportunity and its source. The app sets the verdict.",
          "a": [
            "The scan analyst searches the web for one sector and region at a time. It can look for live tenders, early signals such as funding, land or planning, or recent awards.",
            "It reads the most promising pages and records each opportunity on a fixed form, with a passage copied from its source. It gives two judgements, sector fit and win probability.",
            "Its instructions say \"Do not decide Pursue, Monitor or Deprioritise.\" The app calculates the verdict instead. Records the team dismissed are passed to later scans so the agent skips them."
          ],
          "f": [
            [
              "Model",
              "claude-opus-5-5. OpenAI and Gemini are optional"
            ],
            [
              "Tools",
              "Web search, page reading, record_opportunities"
            ],
            [
              "Trigger",
              "The Scan view, npm run scan, or the weekly scheduled scan"
            ],
            [
              "Cost",
              "About $0.45 to $1.00 a scan at the default settings"
            ],
            [
              "Published",
              "101 scans found 343 records"
            ],
            [
              "Source",
              "src/lib/claude/scan.ts"
            ],
            [
              "Subscription",
              "Scans can also run on a Claude subscription through Claude Code, with a local page reader that returns whole pages"
            ]
          ]
        },
        {
          "id": "verify",
          "k": "code",
          "x": 505,
          "y": 75,
          "n": "Source check",
          "s": "Finds each cited passage on its page.",
          "b": "Each record gets a status and a count of the websites behind it.",
          "f": [
            [
              "Published result",
              "8,871 Verified, 100 Sourced, 1 Unconfirmed"
            ],
            [
              "Source",
              "src/lib/verify.ts"
            ]
          ],
          "a": [
            "The app looks for the passage Claude copied into each record, in the pages it read and in its search results. A record is Verified when a passage is found, Sourced when only the page is found, and Unconfirmed when nothing was retrieved."
          ]
        },
        {
          "id": "dedupe",
          "k": "code",
          "x": 757,
          "y": 75,
          "n": "Merge and log",
          "s": "Joins duplicates and logs what changed.",
          "b": "Duplicates are matched by link, title, client and place.",
          "f": [
            [
              "Source",
              "src/lib/dedupe.ts"
            ]
          ],
          "a": [
            "Two records count as the same project when they share a link, have similar titles, name the same client or sit close together on the map. When a later scan finds new facts, the changes to stage, value, deadline or appointments are added to the record's change log."
          ]
        },
        {
          "id": "wsjson",
          "k": "data",
          "x": 1010,
          "y": 0,
          "n": "Published records",
          "s": "Holds the records every visitor sees.",
          "b": "It also holds the 101 scans and the default firm profile.",
          "f": [
            [
              "Records",
              "8,972"
            ],
            [
              "Scans",
              "101 (51 procurement, 50 signals)"
            ],
            [
              "Source",
              "public/workspace.json"
            ]
          ]
        },
        {
          "id": "deploy",
          "k": "out",
          "x": 1262,
          "y": 0,
          "n": "Tests and publishing",
          "s": "Tests the app, then publishes it.",
          "b": "121 unit tests and 15 browser tests run before each release.",
          "f": [
            [
              "Workflows",
              "ci.yml, pages.yml, and scan.yml every Monday at 06:17"
            ],
            [
              "Tests",
              "121 Vitest and 15 Playwright cases, including a WCAG 2.2 AA contrast check"
            ]
          ],
          "a": [
            "Every change runs through 121 unit tests, 15 browser tests and a colour contrast check before the site is published at prospecht.com. A scheduled scan also runs every Monday morning."
          ]
        },
        {
          "id": "db",
          "k": "data",
          "x": 1010,
          "y": 150,
          "n": "Browser database",
          "s": "Keeps each visitor's own copy.",
          "b": "Notes, pipeline moves and dismissals stay in each visitor's browser.",
          "f": [
            [
              "Server",
              "None, and no account"
            ],
            [
              "Source",
              "src/lib/published.ts"
            ]
          ],
          "a": [
            "The app loads the latest published records each time it opens. A visitor's notes, pipeline moves and dismissals stay in their browser, with no server or account."
          ]
        },
        {
          "id": "profile",
          "k": "data",
          "x": 772,
          "y": 300,
          "n": "Firm profile",
          "s": "Sets sectors, scale, regions and thresholds.",
          "b": "Its weights and thresholds turn scores into verdicts.",
          "f": [
            [
              "Default Pursue thresholds",
              "Score 75, sector 60, win 35"
            ],
            [
              "Source",
              "src/data/profiles.ts"
            ]
          ],
          "a": [
            "The verdict calculator weights sector at 35, scale and win probability at 20 each, location at 15 and timing at 10. The firm's thresholds then set each verdict."
          ]
        },
        {
          "id": "score",
          "k": "code",
          "x": 1010,
          "y": 300,
          "n": "Verdict calculator",
          "s": "Decides the verdict for each record.",
          "b": "It adds Claude's two scores to its own for scale, location and timing.",
          "f": [
            [
              "Verdicts",
              "Pursue, Monitor or Deprioritise"
            ],
            [
              "Source",
              "src/lib/scoring.ts"
            ]
          ],
          "a": [
            "It works out scale, location and timing itself, adds Claude's two scores and applies the firm's weights. The formula is shown beside every verdict."
          ]
        },
        {
          "id": "views",
          "k": "ui",
          "x": 1262,
          "y": 300,
          "n": "App views",
          "s": "Holds 13 screens, from Today to the map.",
          "b": "Buttons on these screens start the seven agents below.",
          "f": [
            [
              "Source",
              "src/views/"
            ]
          ],
          "a": [
            "The 13 screens include Today, Scan, Opportunities, Pipeline, Map, Network, Ask, Briefings and Profile. Their buttons start the seven agents in the tray below."
          ]
        },
        {
          "id": "assess",
          "k": "agent",
          "x": 16,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Assessor",
          "s": "Scores records for a different firm.",
          "b": "It uses that firm's profile, 20 records at a time.",
          "f": [
            [
              "Tool",
              "record_assessments"
            ],
            [
              "Trigger",
              "The Profile view"
            ],
            [
              "Source",
              "src/lib/claude/tasks.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The assessor rescores published records against another firm's profile, 20 at a time, so a visitor can see how the list looks for that firm. It gives sector fit, win probability, any caveats and a one-sentence reason, and the app still sets the verdict."
          ]
        },
        {
          "id": "recheck",
          "k": "agent",
          "x": 222,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Re-checker",
          "s": "Refreshes one record.",
          "b": "It runs up to 5 searches, then logs what changed.",
          "f": [
            [
              "Trigger",
              "The Opportunity view"
            ],
            [
              "Source",
              "src/lib/claude/tasks.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The re-checker refreshes a single record. It runs up to 5 web searches and reads up to 4 pages, then records what changed, and the changes join the record's change log."
          ]
        },
        {
          "id": "brief",
          "k": "agent",
          "x": 428,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Pursuit brief writer",
          "s": "Writes a cited bid strategy.",
          "b": "It covers the client, how to bid, rivals, risks and next steps.",
          "f": [
            [
              "Stored in",
              "The record's brief"
            ],
            [
              "Source",
              "src/lib/claude/tasks.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The pursuit brief writer prepares a bid strategy for one record. It runs up to 8 searches and reads up to 6 pages, then covers the client and decision makers, how to bid, competition, risks, win themes and next steps, with sources."
          ]
        },
        {
          "id": "weekly",
          "k": "agent",
          "x": 634,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Briefing writer",
          "s": "Writes the weekly team briefing.",
          "b": "It writes 250 to 450 words to export as slides or a PDF.",
          "f": [
            [
              "Trigger",
              "The Briefings view"
            ],
            [
              "Source",
              "src/lib/claude/tasks.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The briefing writer turns the pipeline into a weekly briefing for the team. It works in one turn with no tools and writes 250 to 450 words, which the team can export as a PowerPoint deck, a PDF or a CSV."
          ]
        },
        {
          "id": "drafter",
          "k": "agent",
          "x": 840,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Profile drafter",
          "s": "Drafts a firm's profile.",
          "b": "It reads the firm's website and saves its sectors and regions.",
          "f": [
            [
              "Tool",
              "save_firm_profile"
            ],
            [
              "Related",
              "A second task drafts a single sector"
            ],
            [
              "Source",
              "src/lib/claude/tasks.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The profile drafter sets up a new firm. It reads up to 8 pages of the firm's website and runs up to 4 searches, then saves the firm's sectors, scale, regions and competitors. A related task drafts a single sector."
          ]
        },
        {
          "id": "calib",
          "k": "agent",
          "x": 1046,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Calibrator",
          "s": "Suggests rule changes from feedback.",
          "b": "It weighs team votes against verdicts and proposes thresholds.",
          "f": [
            [
              "Tool",
              "propose_calibration"
            ],
            [
              "Source",
              "src/lib/claude/tasks.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The calibrator compares the team's agree and disagree votes with the app's verdicts. Where they differ, it proposes new thresholds and sector rules, and the team decides whether to accept them."
          ]
        },
        {
          "id": "ask",
          "k": "agent",
          "x": 1252,
          "y": 472,
          "w": 194,
          "h": 112,
          "n": "Ask analyst",
          "s": "Answers questions about the pipeline.",
          "b": "It answers from the records and links each one it cites.",
          "f": [
            [
              "Source",
              "src/lib/claude/ask.ts"
            ]
          ],
          "tray": true,
          "a": [
            "The ask analyst answers questions about the whole pipeline. It answers from the records, links each record it cites and can run up to 4 web searches for anything the records do not cover."
          ]
        }
      ],
      "edges": [
        [
          "feeds",
          "sorter"
        ],
        [
          "web",
          "scan",
          {
            "bi": true
          }
        ],
        [
          "sorter",
          "verify",
          {
            "fs": "r",
            "ts": "l",
            "tf": 0.3,
            "mid": 483
          }
        ],
        [
          "scan",
          "verify",
          {
            "fs": "r",
            "ts": "l",
            "tf": 0.7,
            "mid": 483
          }
        ],
        [
          "verify",
          "dedupe"
        ],
        [
          "dedupe",
          "wsjson",
          {
            "fs": "r",
            "ts": "l",
            "mid": 988
          }
        ],
        [
          "dedupe",
          "db",
          {
            "fs": "r",
            "ts": "l",
            "tf": 0.3,
            "mid": 988
          }
        ],
        [
          "wsjson",
          "deploy"
        ],
        [
          "deploy",
          "db",
          {
            "fs": "b",
            "ts": "r",
            "l": "merged on load"
          }
        ],
        [
          "db",
          "score"
        ],
        [
          "profile",
          "score"
        ],
        [
          "score",
          "views"
        ],
        [
          "views",
          "tasks",
          {
            "l": "buttons"
          }
        ],
        [
          "tasks",
          "db",
          {
            "fs": "t",
            "fo": 0.4959,
            "ts": "l",
            "tf": 0.75,
            "l": "results from all seven"
          }
        ]
      ],
      "canvasTop": 232
    },
    {
      "id": "modelchat",
      "app": "ModelChat",
      "kicker": "02 · Design · Building model questions",
      "title": "ModelChat",
      "lede": "One Claude agent answers questions about a 3D building model. Its 14 tools either look up the model's contents or move the view in the browser.",
      "tag": "1 agent · 14 tools",
      "cw": 320,
      "ch": 128,
      "lanes": [
        {
          "x": 0,
          "y": -4,
          "t": "Browser"
        },
        {
          "x": 576,
          "y": -4,
          "t": "Local helper"
        },
        {
          "x": 1112,
          "y": -4,
          "t": "Claude"
        }
      ],
      "nodes": [
        {
          "id": "chat",
          "k": "ui",
          "x": 40,
          "y": 20,
          "n": "Chat panel",
          "s": "Sends each message and shows the reply.",
          "b": "The reply appears as it is written, with a label for each tool Claude uses.",
          "f": [
            [
              "Runs in",
              "The browser"
            ],
            [
              "Sends",
              "POST /chat"
            ],
            [
              "Receives",
              "SSE events on /events"
            ],
            [
              "Source",
              "src/components/ChatPanel.tsx, src/chat/useChat.ts"
            ]
          ]
        },
        {
          "id": "helper",
          "k": "code",
          "x": 576,
          "y": 20,
          "n": "Local helper",
          "s": "Relays between the browser and Claude.",
          "b": "It runs on the user's computer and carries messages and replies to and from Claude.",
          "f": [
            [
              "Runs in",
              "Node on 127.0.0.1:8787"
            ],
            [
              "Modes",
              "One persistent CLI process, or one process per turn on Windows"
            ],
            [
              "Source",
              "helper/index.ts, helper/claudeBridge.ts"
            ]
          ]
        },
        {
          "id": "agent",
          "k": "agent",
          "x": 1112,
          "y": 20,
          "n": "Model assistant",
          "s": "Answers questions with 14 tools.",
          "b": "It checks every number with a tool and asks a short question when a request is unclear.",
          "a": [
            "ModelChat's assistant answers plain-English questions about the loaded building model and moves the 3D view to show its answer.",
            "Its instructions tell it to check every number or count with a tool. To show something, it looks up the matching parts, isolates them and frames the camera on them. For a quantity across the whole model, it reports the unit and how it was measured.",
            "When a request such as \"show the meeting room\" could mean more than one thing, it asks one short question. Its replies stay short, and it does not describe each tool it uses."
          ],
          "f": [
            [
              "Model",
              "Claude, through the local Claude Code login"
            ],
            [
              "Runtime",
              "claude CLI with --append-system-prompt, --allowedTools and --mcp-config"
            ],
            [
              "Memory",
              "The session id is saved and passed back with --resume"
            ],
            [
              "Tools",
              "6 index tools and 8 viewer tools"
            ],
            [
              "Source",
              "helper/index.ts (SYSTEM_PROMPT, ALLOWED_TOOLS)"
            ]
          ]
        },
        {
          "id": "mcp",
          "k": "tool",
          "x": 1112,
          "y": 235,
          "n": "Tool connector",
          "s": "Passes each tool call to the helper.",
          "b": "Claude starts this small program itself. It is Claude's only route to the helper.",
          "f": [
            [
              "Transport",
              "MCP JSON-RPC over stdio, then HTTP to the helper"
            ],
            [
              "Tools",
              "14"
            ],
            [
              "Source",
              "helper/mcpStdio.ts"
            ]
          ]
        },
        {
          "id": "router",
          "k": "code",
          "x": 576,
          "y": 235,
          "n": "Tool router",
          "s": "Answers lookups and passes on view moves.",
          "b": "It answers the six tools that read the model and sends the eight view tools to the browser.",
          "f": [
            [
              "Index tools",
              "list_storeys, list_categories, list_spaces, query_index, compute_quantity, get_properties"
            ],
            [
              "Viewer tools",
              "isolate, show_all, focus_camera, highlight, clear_highlight, set_section_plane, select, screenshot"
            ],
            [
              "Source",
              "helper/index.ts"
            ]
          ]
        },
        {
          "id": "viewer",
          "k": "ui",
          "x": 40,
          "y": 235,
          "n": "3D viewer",
          "s": "Isolates, highlights, cuts and frames parts.",
          "b": "It carries out each view command and returns the result within 30 seconds.",
          "f": [
            [
              "Built with",
              "Three.js and web-ifc"
            ],
            [
              "Returns",
              "POST /tool-result"
            ],
            [
              "Screenshot",
              "A PNG data URL up to 1280 px wide"
            ],
            [
              "Source",
              "src/viewer/toolExecutor.ts"
            ]
          ]
        },
        {
          "id": "load",
          "k": "code",
          "x": 40,
          "y": 450,
          "n": "Model loading",
          "s": "Prepares the model before the first question.",
          "b": "A model opened before loads from a saved copy. A new one is read once and indexed.",
          "f": [
            [
              "Trigger",
              "An IFC file dropped or opened"
            ],
            [
              "Caches",
              "Browser OPFS first, then the helper's disk cache"
            ],
            [
              "Source",
              "src/.../loadModel.ts, helper/preprocess.ts"
            ]
          ]
        },
        {
          "id": "index",
          "k": "data",
          "x": 1112,
          "y": 450,
          "n": "Model index",
          "s": "Lists storeys, rooms, parts and quantities.",
          "b": "The helper holds the index in memory and reloads the last one from disk after a restart.",
          "f": [
            [
              "Held in",
              "Helper memory (indexStore)"
            ],
            [
              "Fallback",
              ".cache/preprocess/<sha>/index.json"
            ],
            [
              "Source",
              "helper/indexStore.ts, helper/preprocessCache.ts"
            ]
          ]
        }
      ],
      "edges": [
        [
          "chat",
          "helper",
          {
            "l": "message · reply",
            "bi": true
          }
        ],
        [
          "helper",
          "agent",
          {
            "l": "message · reply",
            "bi": true
          }
        ],
        [
          "agent",
          "mcp",
          {
            "bi": true
          }
        ],
        [
          "mcp",
          "router",
          {
            "l": "tool calls",
            "bi": true
          }
        ],
        [
          "router",
          "viewer",
          {
            "l": "command · result",
            "bi": true
          }
        ],
        [
          "router",
          "index",
          {
            "l": "reads",
            "bi": true,
            "fs": "b",
            "ts": "t",
            "mid": 406
          }
        ],
        [
          "load",
          "viewer",
          {
            "l": "geometry"
          }
        ],
        [
          "load",
          "index",
          {
            "l": "index"
          }
        ]
      ]
    },
    {
      "id": "growthsignal",
      "app": "GrowthSignal",
      "kicker": "03 · Win work · Bid intelligence database",
      "title": "GrowthSignal",
      "lede": "GrowthSignal gathers public tenders and news into one database. Seven Claude agents read and write it, and none of them calls another.",
      "tag": "7 agents · 1 database",
      "cw": 222,
      "ch": 136,
      "small": true,
      "lanes": [
        {
          "x": 0,
          "y": 0,
          "t": "Nightly at 03:00, in order"
        }
      ],
      "nodes": [
        {
          "id": "ingest",
          "k": "code",
          "x": 0,
          "y": 28,
          "n": "Source connectors",
          "s": "Pulls records from 270+ public sources.",
          "b": "All connectors run at once, adding or updating tenders, projects, deals and news.",
          "f": [
            [
              "Sources",
              "UK, European and US portals, development banks, open-contracting feeds and news"
            ],
            [
              "Trigger",
              "Nightly at 03:00, or the /ops page"
            ],
            [
              "Source",
              "scripts/ingest.ts, web/src/lib/sources/"
            ]
          ]
        },
        {
          "id": "embed",
          "k": "code",
          "x": 250,
          "y": 28,
          "n": "Search index",
          "s": "Makes records searchable by meaning.",
          "b": "It cuts records into short passages and tags each by meaning with a small local model.",
          "f": [
            [
              "Model",
              "Xenova/bge-small-en-v1.5, run locally"
            ],
            [
              "Writes",
              "chunks, vec_chunks"
            ],
            [
              "Source",
              "web/src/lib/embeddings/index.ts"
            ]
          ]
        },
        {
          "id": "enrich",
          "k": "agent",
          "x": 500,
          "y": 28,
          "n": "Enrichment analyst",
          "s": "Turns raw records into facts and scores.",
          "b": "It reads each new tender or project and returns its key facts, fit scores and a verdict.",
          "a": [
            "The enrichment analyst fills in the facts a raw record lacks. It reads raw tender and project records, with the firms that won earlier work, and returns one structured record of facts.",
            "The facts cover stage, sub-sector, owner, design team, contractor, storeys, floor area, value in US dollars, start and end dates, funding and city, with a one-sentence summary. It also scores fit for the practice from 0 to 100 on sector, scale, location and win probability, and writes a one-sentence verdict.",
            "Every call is logged with a fingerprint of its instructions. When the instructions change, the records they affect can be enriched again."
          ],
          "f": [
            [
              "Model",
              "claude-haiku-4-5"
            ],
            [
              "Tools",
              "None (--tools \"\")"
            ],
            [
              "Reads",
              "tenders, projects, awards"
            ],
            [
              "Writes",
              "enrichments, verdict_audit"
            ],
            [
              "Trigger",
              "Nightly, or Enrich now on the /ops page"
            ],
            [
              "Source",
              "web/src/lib/claude/enrichment.ts"
            ]
          ]
        },
        {
          "id": "themes",
          "k": "code",
          "x": 750,
          "y": 28,
          "n": "Themes and alerts",
          "s": "Reruns saved searches without AI.",
          "b": "Each saved search gets a fresh count of matching records for its alert.",
          "f": [
            [
              "Writes",
              "alerts hit counts"
            ],
            [
              "Source",
              "scripts/themes.ts, scripts/alerts.ts"
            ]
          ]
        },
        {
          "id": "briefing",
          "k": "agent",
          "x": 1000,
          "y": 28,
          "n": "Briefing writer",
          "s": "Writes a daily briefing of new records.",
          "b": "It covers new tenders, projects, news and deals in five sections and cites every record.",
          "a": [
            "The briefing writer turns the last 36 hours of records into a daily briefing for a senior architect or engineer.",
            "It writes 250 to 400 words in five sections: Top deals, Tenders to watch, Project approvals, Sector signals and Watch-list. Each point leads with the buyer, country or firm, picks out values and dates, and cites the record behind it.",
            "Its instructions ask it to say what is unusual or large, and to leave out any value it was not given."
          ],
          "f": [
            [
              "Model",
              "claude-sonnet-4-6"
            ],
            [
              "Tools",
              "None"
            ],
            [
              "Reads",
              "tenders, projects, news_items, deals from the last 36 hours"
            ],
            [
              "Writes",
              "briefings, one row per date"
            ],
            [
              "Shown on",
              "The home page"
            ],
            [
              "Source",
              "web/src/lib/claude/briefing.ts"
            ]
          ]
        },
        {
          "id": "digest",
          "k": "out",
          "x": 1250,
          "y": 28,
          "n": "Daily digest",
          "s": "Saves the day's digest as a file.",
          "b": "The last nightly step writes the digest to a text file for the team.",
          "f": [
            [
              "Writes",
              "digests/*.md"
            ],
            [
              "Source",
              "scripts/digest.ts"
            ]
          ]
        },
        {
          "id": "db",
          "k": "data",
          "x": 0,
          "y": 222,
          "w": 1472,
          "h": 112,
          "n": "Shared database",
          "s": "Every agent reads from and writes to this one store. It holds tenders, projects, deals, news, search passages, briefings and chat history.",
          "b": "Records added by the hand-run scripts are enriched the next night.",
          "a": [
            "The database is the only thing the seven agents share. Each one reads its inputs from these tables and writes its results back to them.",
            "Records that the news and company filings scripts add have no enrichment yet, so the next nightly enrichment run picks them up. The next search index run adds them too."
          ],
          "f": [
            [
              "Engine",
              "SQLite with sqlite-vec and full-text search"
            ],
            [
              "Tables",
              "raw_documents, tenders, projects, deals, news_items, companies, awards, chunks, vec_chunks, chunks_fts, enrichments, verdict_audit, briefings, alerts, chat_conversations, chat_messages, record_ask_cache, news_extractions, sec_filing_extractions"
            ]
          ]
        },
        {
          "id": "deal",
          "k": "agent",
          "x": 125,
          "y": 400,
          "n": "Deal analyst",
          "s": "Reads deals for construction signals.",
          "b": "It pulls out each deal's facts and judges what kind of construction it could lead to.",
          "a": [
            "The deal analyst reads takeover and investment records and pulls out the buyer, target, value, deal type, status and reason for the deal.",
            "It then decides what kind of construction the deal points to, such as data centres or ports, and scores sector, scale and location fit and win probability from 0 to 100. Its verdict opens with \"Pursue actively\", \"Monitor\" or \"Deprioritise\".",
            "The nightly run enriches tenders and projects, so deals are scored only when someone starts this agent by hand."
          ],
          "f": [
            [
              "Model",
              "claude-haiku-4-5"
            ],
            [
              "Tools",
              "None"
            ],
            [
              "Reads",
              "deals"
            ],
            [
              "Writes",
              "deals (missing fields only), enrichments, verdict_audit"
            ],
            [
              "Trigger",
              "Enrichment run with --tables deals"
            ],
            [
              "Source",
              "web/src/lib/claude/enrichment.ts (DEAL_SYSTEM)"
            ]
          ]
        },
        {
          "id": "news",
          "k": "agent",
          "x": 375,
          "y": 400,
          "n": "News extractor",
          "s": "Turns news into project records.",
          "b": "Each announcement of a specific building becomes a project record linked to its story.",
          "a": [
            "The news extractor scans news items for announcements of a specific new building, infrastructure programme or development.",
            "It skips corporate transactions, opinion pieces, completed buildings, awards, appointments and vague mentions. A confident match becomes a new project record, with its stage and opportunity score."
          ],
          "f": [
            [
              "Model",
              "claude-haiku-4-5"
            ],
            [
              "Reads",
              "news_items not yet in news_extractions"
            ],
            [
              "Writes",
              "projects, raw_documents, news_extractions"
            ],
            [
              "Trigger",
              "Run by hand"
            ],
            [
              "Source",
              "scripts/news-to-project.ts"
            ]
          ]
        },
        {
          "id": "sec",
          "k": "agent",
          "x": 625,
          "y": 400,
          "n": "Filings extractor",
          "s": "Finds projects in US company filings.",
          "b": "It lists named building projects from the spending sections of US company reports.",
          "a": [
            "The script pulls the latest annual report and four quarterly reports that large US companies file with the regulator, and keeps the spending paragraphs that contain a figure.",
            "The agent lists named projects tied to a specific building, site, campus or facility, with at least a location, value, floor area, year or developer. General spending totals, share buybacks and takeovers are left out."
          ],
          "f": [
            [
              "Model",
              "claude-haiku-4-5"
            ],
            [
              "Reads",
              "SEC EDGAR filings"
            ],
            [
              "Writes",
              "projects under sec:capex, sec_filing_extractions"
            ],
            [
              "Trigger",
              "Run by hand"
            ],
            [
              "Source",
              "scripts/sec-10k-capex.ts"
            ]
          ]
        },
        {
          "id": "campus",
          "k": "agent",
          "x": 875,
          "y": 400,
          "n": "Campus rescorer",
          "s": "Rescores campus-type records.",
          "b": "Two scripts rescore headquarters, healthcare and education records under a looser rule.",
          "a": [
            "Two scripts select records that look like campuses, headquarters, healthcare or education buildings and enrich them again.",
            "The second pass uses a looser definition of the campuses sector that accepts single flagship buildings, so more records qualify for it."
          ],
          "f": [
            [
              "Model",
              "claude-haiku-4-5 at low effort"
            ],
            [
              "Reads",
              "projects, tenders"
            ],
            [
              "Writes",
              "enrichments"
            ],
            [
              "Trigger",
              "Run by hand"
            ],
            [
              "Source",
              "scripts/enrich-campuses-candidates.ts, scripts/reenrich-anchor-class.ts"
            ]
          ]
        },
        {
          "id": "chat",
          "k": "agent",
          "x": 1125,
          "y": 400,
          "n": "Intelligence analyst",
          "s": "Answers questions with cited sources.",
          "b": "It answers from the 8 best passages and cites each one. Repeat questions get saved answers.",
          "a": [
            "The intelligence analyst answers questions in the chat panel, on the Ask page and from the Ask Claude button on each record.",
            "It finds the 8 most relevant passages by meaning and by keyword. It cites each one as [1] or [2], marks its guesses and never invents figures.",
            "A question already asked about a record gets the saved answer with no AI call."
          ],
          "f": [
            [
              "Model",
              "claude-sonnet-4-6, streamed"
            ],
            [
              "Retrieval",
              "Local embeddings and BM25, fused, top 8 chunks"
            ],
            [
              "Writes",
              "chat_messages, record_ask_cache"
            ],
            [
              "Source",
              "web/src/lib/claude/chat.ts, web/src/lib/claude/rag.ts"
            ]
          ]
        }
      ],
      "edges": [
        [
          "ingest",
          "embed"
        ],
        [
          "embed",
          "enrich"
        ],
        [
          "enrich",
          "themes"
        ],
        [
          "themes",
          "briefing"
        ],
        [
          "briefing",
          "digest"
        ],
        [
          "ingest",
          "db",
          {}
        ],
        [
          "embed",
          "db",
          {
            "bi": true
          }
        ],
        [
          "enrich",
          "db",
          {
            "bi": true
          }
        ],
        [
          "themes",
          "db",
          {
            "bi": true
          }
        ],
        [
          "briefing",
          "db",
          {
            "bi": true
          }
        ],
        [
          "db",
          "digest",
          {}
        ],
        [
          "db",
          "deal",
          {
            "bi": true
          }
        ],
        [
          "db",
          "news",
          {
            "bi": true
          }
        ],
        [
          "sec",
          "db",
          {}
        ],
        [
          "db",
          "campus",
          {
            "bi": true
          }
        ],
        [
          "db",
          "chat",
          {
            "bi": true
          }
        ]
      ],
      "groups": [
        {
          "x": 109,
          "y": 366,
          "w": 996,
          "h": 186,
          "t": "Run by hand"
        },
        {
          "x": 1113,
          "y": 366,
          "w": 250,
          "h": 186,
          "t": "Asked by users"
        }
      ]
    },
    {
      "id": "spd",
      "app": "Strategic Project Discovery",
      "kicker": "04 · Win work · Live project search",
      "title": "Strategic Project Discovery",
      "lede": "Strategic Project Discovery searches procurement sites live. One agent on Google's Gemini runs each sector scan and returns scored leads.",
      "tag": "1 agent · 1 search tool",
      "cw": 220,
      "ch": 128,
      "small": true,
      "nodes": [
        {
          "id": "sector",
          "k": "ui",
          "x": 0,
          "y": 0,
          "n": "Sector",
          "s": "Picks one sector or all seven.",
          "b": "Scan All runs the seven sectors in turn, 4 seconds apart.",
          "f": [
            [
              "Sectors",
              "7"
            ],
            [
              "Scan All",
              "A sequential loop with a 4,000 ms pause in live mode"
            ],
            [
              "Source",
              "strategic-project-discovery.html"
            ]
          ]
        },
        {
          "id": "region",
          "k": "ui",
          "x": 0,
          "y": 236,
          "n": "Region",
          "s": "Picks one of six regions.",
          "b": "The region goes into Gemini's instructions and filters the demo data.",
          "f": [
            [
              "Options",
              "6, including Global"
            ]
          ]
        },
        {
          "id": "sources",
          "k": "ui",
          "x": 0,
          "y": 472,
          "n": "Sources",
          "s": "Switches 676 sources on or off.",
          "b": "All start switched on. Gemini's instructions name the first 60.",
          "f": [
            [
              "Sources",
              "676 in 36 categories"
            ],
            [
              "In the prompt",
              "The first 60 enabled names"
            ]
          ]
        },
        {
          "id": "fetch",
          "k": "code",
          "x": 250,
          "y": 236,
          "n": "Request builder",
          "s": "Writes the request and calls Gemini.",
          "b": "With a saved Gemini key it calls Gemini. Without one it shows demo data.",
          "f": [
            [
              "Key",
              "Saved in localStorage as gia_gemini_key"
            ],
            [
              "Source",
              "strategic-project-discovery.html"
            ]
          ]
        },
        {
          "id": "search",
          "k": "ext",
          "x": 500,
          "y": 0,
          "n": "Google Search",
          "s": "Lets Gemini search the web.",
          "b": "Gemini runs the searches. The app never reads the sources Google returns.",
          "f": [
            [
              "Tool",
              "google_search"
            ],
            [
              "Runs in",
              "Google's servers, inside the Gemini call"
            ]
          ]
        },
        {
          "id": "gemini",
          "k": "agent",
          "x": 500,
          "y": 236,
          "n": "Discovery engine",
          "s": "Finds and scores live opportunities.",
          "b": "It finds 8 to 20 current leads and scores each one for fit.",
          "a": [
            "The app's only agent looks for business development leads. For the chosen sector and region, its instructions ask for 8 to 20 real, current infrastructure tenders and projects.",
            "It returns them as a structured list. Each result carries a title, client, location with map coordinates, stage, urgency, relevance, value, deadline, contract type, source, overview and background.",
            "Each result also holds a fit assessment: sector fit, scale fit, location fit and win probability from 0 to 100, with a one-line verdict."
          ],
          "f": [
            [
              "Model",
              "gemini-2.5-flash"
            ],
            [
              "Tools",
              "Google Search grounding"
            ],
            [
              "Settings",
              "Temperature 0.7, up to 8,192 output tokens"
            ],
            [
              "Key",
              "The user's own Gemini API key, sent from the browser"
            ],
            [
              "Source",
              "strategic-project-discovery.html"
            ]
          ]
        },
        {
          "id": "demo",
          "k": "data",
          "x": 500,
          "y": 472,
          "n": "Demo data",
          "s": "Stands in when there is no key.",
          "b": "After a short pause, it shows sample results for the chosen region.",
          "f": [
            [
              "Source",
              "demo-data.js"
            ]
          ]
        },
        {
          "id": "parse",
          "k": "code",
          "x": 750,
          "y": 236,
          "n": "Reply reader",
          "s": "Tries three ways to read the reply.",
          "b": "If the reply is untidy, it falls back to reading one result at a time.",
          "f": [
            [
              "Retries",
              "None"
            ],
            [
              "Validation",
              "No field or schema checks"
            ]
          ]
        },
        {
          "id": "results",
          "k": "data",
          "x": 1000,
          "y": 236,
          "n": "Results by sector",
          "s": "Holds the latest results for each sector.",
          "b": "A new scan replaces that sector's results. Duplicates are not merged.",
          "f": [
            [
              "Held in",
              "React state, keyed by sector"
            ]
          ]
        },
        {
          "id": "list",
          "k": "out",
          "x": 1250,
          "y": 0,
          "n": "Result list",
          "s": "Shows each result with its fit scores.",
          "b": "Each card opens to show its four fit scores and the verdict."
        },
        {
          "id": "map",
          "k": "out",
          "x": 1250,
          "y": 236,
          "n": "World map",
          "s": "Plots results, coloured by urgency.",
          "b": "Results with no location are left off the map."
        },
        {
          "id": "files",
          "k": "out",
          "x": 1250,
          "y": 472,
          "n": "Saved files",
          "s": "Saves scans as files.",
          "b": "Each live scan downloads a file. Save keeps the last 10 in the browser."
        }
      ],
      "edges": [
        [
          "sector",
          "fetch",
          {
            "fs": "r",
            "ts": "t"
          }
        ],
        [
          "region",
          "fetch"
        ],
        [
          "sources",
          "fetch",
          {
            "fs": "r",
            "ts": "b",
            "tf": 0.3
          }
        ],
        [
          "fetch",
          "gemini"
        ],
        [
          "fetch",
          "demo",
          {
            "fs": "b",
            "fo": 0.7,
            "ts": "l",
            "l": "no key"
          }
        ],
        [
          "gemini",
          "search",
          {
            "bi": true,
            "l": "searches"
          }
        ],
        [
          "gemini",
          "parse"
        ],
        [
          "parse",
          "results"
        ],
        [
          "demo",
          "results",
          {
            "fs": "r",
            "ts": "b",
            "tf": 0.3
          }
        ],
        [
          "results",
          "list",
          {
            "fs": "t",
            "ts": "l"
          }
        ],
        [
          "results",
          "map"
        ],
        [
          "results",
          "files",
          {
            "fs": "b",
            "fo": 0.7,
            "ts": "l"
          }
        ]
      ]
    },
    {
      "id": "worknodescanvas",
      "app": "WorkNodesCanvas",
      "kicker": "05 · Deliver · Document workbench",
      "title": "WorkNodesCanvas",
      "lede": "WorkNodesCanvas turns project documents into analyses, decks and reports. Four Claude agents run from cards, called nodes, and share saved results.",
      "tag": "4 agents · 1 canvas",
      "cw": 300,
      "ch": 120,
      "nodes": [
        {
          "id": "user",
          "k": "person",
          "x": 0,
          "y": 0,
          "n": "User",
          "s": "Wires nodes, runs them and chats.",
          "b": "The user wires inputs into nodes, clicks Run on each one and asks for changes in the chat."
        },
        {
          "id": "anodes",
          "k": "ui",
          "x": 586,
          "y": 0,
          "n": "Analysis nodes",
          "s": "Holds an objective and its inputs.",
          "b": "Each analysis uses the inputs wired into it, and runs only when the user clicks Run."
        },
        {
          "id": "pnodes",
          "k": "ui",
          "x": 1172,
          "y": 0,
          "n": "Presentation nodes",
          "s": "Holds a brief and its inputs.",
          "b": "Each one uses the saved results of its wired analyses and does not rerun them."
        },
        {
          "id": "chat",
          "k": "agent",
          "x": 0,
          "y": 178,
          "n": "Canvas chat assistant",
          "s": "Edits the canvas when asked in chat.",
          "b": "It sees a summary of every node and adds a list of changes when the canvas should change.",
          "a": [
            "The chat assistant holds a conversation in the side panel and can change the canvas on request.",
            "Its instructions carry a summary of up to 80 nodes, with each one's name, type, main fields, position, size and whether it has a result. When the canvas should change, it ends its reply with a list of changes in a fixed format.",
            "The 11 kinds of change create references, notes, analyses and presentations, edit, wire, unwire and delete nodes, and set position, size and whether a node is folded. Chat cannot start a run."
          ],
          "f": [
            [
              "Model",
              "Claude, through the local claude CLI"
            ],
            [
              "Call",
              "--print --output-format json, 180-second limit"
            ],
            [
              "Reply",
              "One JSON request and reply, not streamed"
            ],
            [
              "Source",
              "worknodescanvas.py (CHAT_SYSTEM_PROMPT)"
            ]
          ]
        },
        {
          "id": "agent",
          "k": "agent",
          "x": 586,
          "y": 178,
          "n": "Analysis agent",
          "s": "Works through a node's objective.",
          "b": "It reads the wired files and results, then answers the objective within 10 minutes.",
          "a": [
            "The analysis agent runs when the user clicks Run on an Analysis node. It works through the node's objective using the wired reference files and the results of directly wired analyses.",
            "Short text files go straight into its instructions. Larger files such as PDFs and Office documents are passed by location, and the agent opens them itself. Web links are passed as text.",
            "It answers without a preamble and uses a table when asked for one. A structured answer, such as a compliance matrix, is shown as a formatted table. Its progress appears on the canvas as it works."
          ],
          "f": [
            [
              "Model",
              "Claude, through the local claude CLI"
            ],
            [
              "Call",
              "--print --output-format stream-json --verbose --dangerously-skip-permissions"
            ],
            [
              "Limit",
              "600 seconds"
            ],
            [
              "Source",
              "worknodescanvas.py (run_claude, assemble_analysis_prompt)"
            ]
          ]
        },
        {
          "id": "builder",
          "k": "agent",
          "x": 1172,
          "y": 178,
          "n": "Document builder",
          "s": "Writes the deck, report or page.",
          "b": "It turns wired inputs into a PowerPoint deck, Word report or web page that follows the brief.",
          "a": [
            "The document builder runs when the user clicks Run on a Presentation node. It turns the wired references and analyses into a file that follows the node's brief.",
            "It builds a deck with Claude's PowerPoint skill, a Word report with a Python library or a web page directly. It saves the file to a set location and replies with one line.",
            "If no file is saved, the run fails. A run that times out still succeeds when the file exists."
          ],
          "f": [
            [
              "Model",
              "Claude, through the local claude CLI"
            ],
            [
              "Formats",
              "PPTX, DOCX, HTML"
            ],
            [
              "Source",
              "worknodescanvas.py (assemble_presentation_prompt)"
            ]
          ]
        },
        {
          "id": "checks",
          "k": "code",
          "x": 0,
          "y": 356,
          "n": "Change checks",
          "s": "Checks every chat change.",
          "b": "Each change must name a real node and follow the wiring rules, and passes or fails alone.",
          "f": [
            [
              "Wires",
              "Reference to Analysis or Presentation, Analysis to Analysis or Presentation"
            ],
            [
              "Source",
              "worknodescanvas.py (apply_chat_actions)"
            ]
          ]
        },
        {
          "id": "salvage",
          "k": "agent",
          "x": 586,
          "y": 356,
          "n": "Timeout rescue planner",
          "s": "Splits an answer that timed out.",
          "b": "It splits a long answer into parts, then the app asks Claude for each and joins them.",
          "a": [
            "The timeout rescue planner takes over when an analysis run hits its 10-minute limit.",
            "It plans the answer as a header, a footer and a list of items in batches of 1 to 10. The app asks Claude for each batch, up to 40 times, and joins them.",
            "Totals that depend on the finished table are left as placeholders and filled in after the parts are joined. Only analyses get this rescue."
          ],
          "f": [
            [
              "Model",
              "Claude, through the local claude CLI"
            ],
            [
              "Mode",
              "WNC_SALVAGE_MODE: chunked (default), script or off"
            ],
            [
              "Limit",
              "40 process calls"
            ],
            [
              "Source",
              "worknodescanvas.py"
            ]
          ]
        },
        {
          "id": "file",
          "k": "out",
          "x": 1172,
          "y": 356,
          "n": "Output file",
          "s": "Saves a deck, report or web page.",
          "b": "The file is saved to the outputs folder. A deck also gets a thumbnail of each slide."
        },
        {
          "id": "state",
          "k": "data",
          "x": 0,
          "y": 522,
          "w": 1472,
          "h": 78,
          "n": "Canvas state file",
          "s": "Every node keeps its latest result and the five before it. Wired nodes read their inputs from here.",
          "b": "It holds every node, wire and result, so the canvas reopens exactly as it was left.",
          "f": [
            [
              "History",
              "The last 5 results per node, for display only"
            ],
            [
              "Race guard",
              "The helper keeps its newer result if the browser saves an older copy"
            ]
          ]
        }
      ],
      "edges": [
        [
          "user",
          "anodes",
          {
            "l": "Run"
          }
        ],
        [
          "anodes",
          "pnodes",
          {
            "l": "wired results"
          }
        ],
        [
          "user",
          "chat",
          {
            "l": "message"
          }
        ],
        [
          "anodes",
          "agent"
        ],
        [
          "pnodes",
          "builder"
        ],
        [
          "chat",
          "checks",
          {
            "l": "changes"
          }
        ],
        [
          "agent",
          "salvage",
          {
            "l": "on timeout"
          }
        ],
        [
          "builder",
          "file"
        ],
        [
          "checks",
          "state"
        ],
        [
          "salvage",
          "state",
          {}
        ],
        [
          "agent",
          "state",
          {
            "fs": "r",
            "ts": "t",
            "tf": 0.632
          }
        ],
        [
          "builder",
          "state",
          {
            "fs": "l",
            "fo": 0.8,
            "ts": "t",
            "tf": 0.699
          }
        ]
      ]
    },
    {
      "id": "rbe",
      "app": "Reference Buildings Explorer",
      "kicker": "06 · Design · Energy modelling",
      "title": "Reference Buildings Explorer",
      "lede": "The explorer shows energy simulations of 16 US building types in 3D. One Claude Code agent wrote a plan and started four more to build the parts.",
      "tag": "5 build agents",
      "cw": 260,
      "ch": 128,
      "groups": [
        {
          "x": 590,
          "y": 0,
          "w": 300,
          "h": 600,
          "t": "Four subagents in parallel",
          "id": "subs",
          "bracket": true
        }
      ],
      "nodes": [
        {
          "id": "doe",
          "k": "ext",
          "x": 0,
          "y": 0,
          "n": "DOE reference page",
          "s": "Supplies the original model files.",
          "b": "The Department of Energy page lost its file links, so the agent found the old addresses."
        },
        {
          "id": "main",
          "k": "build",
          "x": 0,
          "y": 240,
          "n": "Main build agent",
          "s": "Recovered the data and led the build.",
          "b": "It sorted the models, wrote the plan, and built the page frame and the bundler.",
          "a": [
            "The main agent, running in Claude Code, Anthropic's coding tool, did the research and recovery. It checked 64 download addresses, downloaded all 64 archives, compared file fingerprints to remove duplicates and sorted 864 files by building type.",
            "It wrote the build plan so the four subagents could work on their own, and built the page frame, the side panels and the bundler.",
            "After the subagents finished, it bundled their work and tested every tab in an automated browser at desktop and phone widths, fixing the layout problems it found."
          ],
          "f": [
            [
              "Tool",
              "Claude Code"
            ],
            [
              "Record",
              "What-Claude-Code-Built.md"
            ]
          ]
        },
        {
          "id": "library",
          "k": "data",
          "x": 0,
          "y": 480,
          "n": "Model library",
          "s": "Held 864 files by building type.",
          "b": "It holds models for two versions of the simulation software, their results and 16 weather files.",
          "f": [
            [
              "Software",
              "EnergyPlus 5.0 and 7.2"
            ],
            [
              "Files",
              "864"
            ]
          ]
        },
        {
          "id": "spec",
          "k": "doc",
          "x": 303,
          "y": 176,
          "n": "Build plan",
          "s": "Sets file owners, data format and rules.",
          "b": "It gives each file one owner, fixes the data format and sets how each view plugs in.",
          "f": [
            [
              "Owners",
              "index.html: main agent; data.js: data agent; building3d.js: A; landscape.js: B; monthly.js: C"
            ],
            [
              "Rules",
              "Views may import only three.js and must work from file://"
            ],
            [
              "Source",
              "Dashboard/_build/SPEC.md"
            ]
          ]
        },
        {
          "id": "shell",
          "k": "code",
          "x": 303,
          "y": 330,
          "n": "Page frame",
          "s": "Held the tabs, menus and side panels.",
          "b": "The main agent built this page frame first, so each view had a fixed place to plug in."
        },
        {
          "id": "data",
          "k": "sub",
          "x": 606,
          "y": 36,
          "h": 128,
          "n": "Data subagent",
          "s": "Built data for 256 building-climate pairs.",
          "b": "It turned reports, workbooks, models and weather files into one checked data file.",
          "a": [
            "The data subagent wrote the Python program that turns the model library into one dataset covering all 256 combinations of building type and climate.",
            "It reads the simulation reports, the summary workbooks, the EnergyPlus input files for 3D geometry and the hourly weather files.",
            "Its checks found no missing values. Monthly totals match the annual figures within 0.01% for electricity and 0.13% for gas."
          ],
          "f": [
            [
              "Writes",
              "Dashboard/data.js"
            ],
            [
              "Source",
              "build_data.py, htm_tables.py, idf_geom.py"
            ]
          ]
        },
        {
          "id": "va",
          "k": "sub",
          "x": 606,
          "y": 176,
          "h": 128,
          "n": "View agent A",
          "s": "Built the Building Explorer view.",
          "b": "It built the 3D building with section cuts and exploded floors.",
          "a": [
            "View agent A built the Building Explorer: the EnergyPlus geometry in 3D, with a cutting plane, floor-by-floor slicing, exploded floors and rooms coloured by load or hours out of comfort.",
            "It built against sample data made from the real geometry and checked its work with automated browser screenshots."
          ],
          "f": [
            [
              "Writes",
              "views/building3d.js"
            ]
          ]
        },
        {
          "id": "vb",
          "k": "sub",
          "x": 606,
          "y": 316,
          "h": 128,
          "n": "View agent B",
          "s": "Built two comparison views.",
          "b": "It built the 16 × 16 energy city and the stacked end-use columns.",
          "a": [
            "View agent B built two views: Compare Types × Climates, an energy city of 16 × 16 bars with a moving cutting plane, and End-Use Stacks, 3D columns stacked by end use.",
            "It used sample data when the real data was missing and checked its work with browser screenshots."
          ],
          "f": [
            [
              "Writes",
              "views/landscape.js"
            ]
          ]
        },
        {
          "id": "vc",
          "k": "sub",
          "x": 606,
          "y": 456,
          "h": 128,
          "n": "View agent C",
          "s": "Built three time-based views.",
          "b": "It built the monthly surfaces, the climate carpet and the operating schedules.",
          "a": [
            "View agent C built three views: Monthly Surfaces, Climate Carpet with 365 × 24 hours of weather as terrain, and Operating Schedules that morph between weekday and weekend.",
            "It added placeholder fields to the sample data while it worked and checked each view with screenshots."
          ],
          "f": [
            [
              "Writes",
              "views/monthly.js"
            ]
          ]
        },
        {
          "id": "bundle",
          "k": "code",
          "x": 922,
          "y": 240,
          "n": "Bundler",
          "s": "Joined every part into one page.",
          "b": "It drops the data and the three views into the page frame and writes the finished dashboard."
        },
        {
          "id": "dash",
          "k": "out",
          "x": 1212,
          "y": 240,
          "n": "Dashboard",
          "s": "Runs from one 1.9 MB file.",
          "b": "It opens straight from disk. Its only outside download is the 3D library."
        },
        {
          "id": "qa",
          "k": "code",
          "x": 1212,
          "y": 440,
          "n": "Browser check",
          "s": "Tested every tab on desktop and phone.",
          "b": "The main agent ran this check and sent each layout fault back to the bundler.",
          "f": [
            [
              "Widths",
              "1400 px and 520 px"
            ],
            [
              "Tool",
              "Headless Playwright browser"
            ]
          ]
        }
      ],
      "edges": [
        [
          "doe",
          "main",
          {
            "l": "64 downloads"
          }
        ],
        [
          "main",
          "library"
        ],
        [
          "main",
          "spec",
          {
            "fs": "r",
            "fo": 0.3,
            "ts": "l",
            "tf": 0.797
          }
        ],
        [
          "main",
          "shell",
          {
            "fs": "r",
            "fo": 0.85,
            "ts": "l",
            "tf": 0.148
          }
        ],
        [
          "spec",
          "subs",
          {}
        ],
        [
          "subs",
          "bundle",
          {}
        ],
        [
          "bundle",
          "dash",
          {}
        ],
        [
          "bundle",
          "qa",
          {
            "fs": "b",
            "fo": 0.3,
            "ts": "l",
            "tf": 0.75
          }
        ],
        [
          "qa",
          "bundle",
          {
            "fs": "l",
            "fo": 0.25,
            "ts": "b",
            "tf": 0.8,
            "l": "fix layout"
          }
        ],
        [
          "shell",
          "subs",
          {}
        ]
      ]
    },
    {
      "id": "materialscan",
      "app": "MaterialScan",
      "kicker": "07 · Design · Material compliance",
      "title": "MaterialScan",
      "lede": "MaterialScan shows which products have evidence for the Living Building Challenge and WELL. Verdicts were written by hand and published by scripts.",
      "tag": "No agents",
      "cw": 260,
      "ch": 136,
      "nodes": [
        {
          "id": "docs",
          "k": "ext",
          "x": 0,
          "y": 0,
          "n": "Product documents",
          "s": "Supplies manufacturers' product sheets.",
          "b": "Manufacturer evidence was gathered by searching the web and reading each document.",
          "f": [
            [
              "Types",
              "EPDs (environmental product declarations), HPDs (health product declarations) and Declare labels"
            ]
          ]
        },
        {
          "id": "author",
          "k": "maybe",
          "x": 303,
          "y": 0,
          "n": "Evidence research",
          "s": "Researched each product's evidence.",
          "b": "This happened outside the project files. No record shows whether an assistant helped.",
          "a": [
            "Someone researched each product's evidence and wrote a verdict for every standard. This happened outside the project files.",
            "The criteria notes say \"per memory\" and mention a memory index, which suggests an assistant session with memory. No transcript or instructions in the project files confirm it.",
            "The only saved change in the project's history came from a Claude Code session that added a light theme."
          ],
          "f": [
            [
              "Evidence",
              "Compliance/Compliance_Criteria.md"
            ]
          ]
        },
        {
          "id": "hand",
          "k": "data",
          "x": 606,
          "y": 0,
          "n": "Hand-written verdicts",
          "s": "Gives every product a written verdict.",
          "b": "Each product carries a verdict line per standard, with a reason and a source link.",
          "f": [
            [
              "Files",
              "Palette/Materials_List_Compliance.txt, Compliance/"
            ]
          ]
        },
        {
          "id": "standards",
          "k": "data",
          "x": 303,
          "y": 232,
          "n": "Standards text",
          "s": "Holds the two standards and the brief.",
          "b": "Plain-text copies of each standard list the requirements that the site scores against.",
          "f": [
            [
              "Standards",
              "Living Building Challenge (LBC) 4.1, WELL v2"
            ]
          ]
        },
        {
          "id": "parsers",
          "k": "code",
          "x": 606,
          "y": 232,
          "n": "File readers",
          "s": "Reads every input file.",
          "b": "Each verdict line is read by its fixed format. A missing verdict counts as an evidence gap."
        },
        {
          "id": "graph",
          "k": "code",
          "x": 909,
          "y": 232,
          "n": "Verdict summary",
          "s": "Keeps each product's worst verdict.",
          "b": "The scorecard then counts how many products have evidence for each standard."
        },
        {
          "id": "fetcher",
          "k": "code",
          "x": 606,
          "y": 440,
          "n": "Cover fetcher",
          "s": "Saves each document's first page.",
          "b": "It downloads each evidence link and saves the document's first page as an image."
        },
        {
          "id": "render",
          "k": "code",
          "x": 1212,
          "y": 232,
          "n": "Page writers",
          "s": "Writes section, material and gap pages.",
          "b": "They write the web pages, the data file and the report, and a link check runs over the result."
        },
        {
          "id": "site",
          "k": "out",
          "x": 909,
          "y": 0,
          "n": "Published site",
          "s": "Publishes the dashboard as plain web pages.",
          "b": "Its pages contact no outside service, and no AI runs while it is used."
        }
      ],
      "edges": [
        [
          "docs",
          "author"
        ],
        [
          "author",
          "hand"
        ],
        [
          "hand",
          "parsers"
        ],
        [
          "standards",
          "parsers"
        ],
        [
          "parsers",
          "graph"
        ],
        [
          "graph",
          "render"
        ],
        [
          "render",
          "site",
          {
            "fs": "t",
            "ts": "r"
          }
        ],
        [
          "graph",
          "fetcher",
          {
            "l": "document links",
            "fs": "b",
            "ts": "t",
            "mid": 410
          }
        ],
        [
          "docs",
          "fetcher",
          {
            "fs": "b",
            "ts": "l"
          }
        ],
        [
          "fetcher",
          "render",
          {
            "fs": "r",
            "ts": "b",
            "l": "covers"
          }
        ]
      ]
    },
    {
      "id": "southwark",
      "app": "Southwark Retrofit Atlas",
      "kicker": "08 · Portfolio · Housing retrofit",
      "title": "Southwark Retrofit Atlas",
      "lede": "The atlas ranks Southwark's 149,062 homes for retrofit funding. Claude Code built its data files, and the browser does the ranking with no AI.",
      "tag": "1 build agent",
      "cw": 260,
      "ch": 136,
      "dividers": [
        {
          "x": 584,
          "a": "Build time",
          "b": "In the browser"
        }
      ],
      "nodes": [
        {
          "id": "lbsm",
          "k": "ext",
          "x": 0,
          "y": 0,
          "n": "London stock model",
          "s": "Lists 149,062 homes.",
          "b": "The Greater London Authority's model records 63 facts about every home."
        },
        {
          "id": "epc",
          "k": "ext",
          "x": 0,
          "y": 232,
          "n": "Energy certificates",
          "s": "Adds 7,045 commercial buildings.",
          "b": "These certificates are checked against the minimum energy standard for lettings (MEES)."
        },
        {
          "id": "ons",
          "k": "ext",
          "x": 0,
          "y": 464,
          "n": "Official map data",
          "s": "Supplies wards and postcodes.",
          "b": "Ward outlines and postcodes place each home and draw the area views."
        },
        {
          "id": "session",
          "k": "build",
          "x": 303,
          "y": 0,
          "n": "Claude Code session",
          "s": "Wrote and ran the data scripts.",
          "b": "The Method tab credits this one session with building the whole atlas.",
          "a": [
            "The Method tab's \"How this was built\" card says one working session in Claude Code, Anthropic's coding tool, went from a raw spreadsheet to the finished application, and lists its eight steps.",
            "The only saved change in the project's history came from Claude Code. The scripts the card lists are not in the project files, so they are known only from that card."
          ],
          "f": [
            [
              "Evidence",
              "app/index.html, Method tab"
            ],
            [
              "Model calls at run time",
              "None"
            ]
          ]
        },
        {
          "id": "pack",
          "k": "code",
          "x": 303,
          "y": 232,
          "n": "Data preparation",
          "s": "Shrinks the raw data into compact files.",
          "b": "Rows are filtered, matched to an address and packed into small files."
        },
        {
          "id": "files",
          "k": "data",
          "x": 303,
          "y": 464,
          "n": "Three data files",
          "s": "Holds all the prepared data.",
          "b": "One file holds the layout and areas. Two hold the packed homes and buildings."
        },
        {
          "id": "controls",
          "k": "ui",
          "x": 606,
          "y": 0,
          "n": "User controls",
          "s": "Sets budget, weights, strategy and prices.",
          "b": "Scope, heat pump efficiency and grant levels can be changed too."
        },
        {
          "id": "recompute",
          "k": "code",
          "x": 606,
          "y": 232,
          "n": "Recalculation",
          "s": "Reruns only what a change needs.",
          "b": "Weights rerun scoring, budgets rerun allocation and prices rerun everything."
        },
        {
          "id": "decode",
          "k": "code",
          "x": 606,
          "y": 464,
          "n": "Load and decode",
          "s": "Runs once on page load.",
          "b": "It downloads and unpacks the three files, then starts the first full run."
        },
        {
          "id": "package",
          "k": "code",
          "x": 909,
          "y": 232,
          "n": "Package and cost",
          "s": "Costs a retrofit package for every home.",
          "b": "It picks each home's package and works out its cost, carbon saving, bill and energy rating.",
          "f": [
            [
              "Measures",
              "CO2e saving, SAP energy rating"
            ]
          ]
        },
        {
          "id": "mees",
          "k": "code",
          "x": 909,
          "y": 464,
          "n": "Lettings check",
          "s": "Checks 7,045 commercial buildings.",
          "b": "It flags each building's lettings risk and costs the work to reach energy band B."
        },
        {
          "id": "score",
          "k": "code",
          "x": 1212,
          "y": 232,
          "n": "Score and allocate",
          "s": "Ranks homes and spends the budget.",
          "b": "Five factors are ranked and weighted, and homes are funded from the top down."
        },
        {
          "id": "map",
          "k": "out",
          "x": 1212,
          "y": 0,
          "n": "Home map",
          "s": "Draws every home on a map.",
          "b": "The map redraws from the new ranking after each run."
        },
        {
          "id": "views",
          "k": "out",
          "x": 1212,
          "y": 464,
          "n": "Views and tables",
          "s": "Shows the three main views.",
          "b": "Prioritise, Portfolio and Areas all redraw from the latest run's totals."
        }
      ],
      "edges": [
        [
          "lbsm",
          "pack",
          {
            "fs": "r",
            "ts": "l",
            "tf": 0.25,
            "mid": 281
          }
        ],
        [
          "epc",
          "pack"
        ],
        [
          "ons",
          "pack",
          {
            "fs": "r",
            "ts": "l",
            "tf": 0.75,
            "mid": 281
          }
        ],
        [
          "session",
          "pack",
          {
            "l": "wrote and ran"
          }
        ],
        [
          "pack",
          "files"
        ],
        [
          "files",
          "decode"
        ],
        [
          "controls",
          "recompute"
        ],
        [
          "recompute",
          "package"
        ],
        [
          "recompute",
          "score",
          {
            "fs": "t",
            "fo": 0.92,
            "ts": "t",
            "tf": 0.3,
            "mid": 184,
            "l": "weights or budget"
          }
        ],
        [
          "decode",
          "package",
          {
            "fs": "t",
            "fo": 0.9,
            "ts": "b",
            "tf": 0.35,
            "mid": 416
          }
        ],
        [
          "decode",
          "mees"
        ],
        [
          "package",
          "score"
        ],
        [
          "score",
          "map"
        ],
        [
          "score",
          "views"
        ],
        [
          "mees",
          "views"
        ]
      ]
    }
  ]
};
