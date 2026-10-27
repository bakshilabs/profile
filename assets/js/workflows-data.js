/* Bakshi Labs: content for the sustainable design workflow slides.
   Taken from the Sustainable Design Workflows deck in the pain-points repo
   (deck-workflows/sustainability.json), with British spelling.
   Each practice area has four workflows (before, pain point, with Claude and
   sign-off, plus a sentence for each in the detail window) and one featured
   workflow map. Map nodes sit on a cols × rows grid; edges can set the exit
   and entry sides (out, in: l r t b), a loop lane (via, in rows), a label and
   a style. */

window.WORKFLOW_DECK = {
  "cover": {
    "kicker": "Bakshi Labs · Sustainability practice",
    "title": "Sustainable Design Workflows",
    "lede": "Each slide shows how one area of sustainability consulting runs today, and how it runs with Claude. The areas include LEED, energy modelling and ESG reporting. A named professional signs off every workflow.",
    "stats": [
      [
        "8",
        "practice areas, from LEED to climate risk"
      ],
      [
        "32",
        "common workflows, each shown before and after"
      ],
      [
        "8",
        "featured workflows, mapped step by step"
      ]
    ]
  },
  "close": {
    "id": "sign-off",
    "short": "Sign-off",
    "kicker": "All practice areas · Human sign-off",
    "title": "Professional sign-off",
    "lede": "In every workflow, Claude handles the document chasing, data wrangling and first drafts. The LEED AP, the engineer, the sustainability lead and the board review the work, decide the exceptions and sign."
  },
  "areas": [
    {
      "id": "leed",
      "name": "LEED certification",
      "short": "LEED",
      "lede": "Today, LEED documentation means months of chasing credit forms across the whole project team.",
      "flows": [
        {
          "before": "Track every LEED credit",
          "pain": "Spreadsheets out of date weekly",
          "after": "Claude keeps the credit tracker current",
          "note": "LEED AP owns the scorecard",
          "today": "The team tracks every LEED credit across the project.",
          "painText": "The spreadsheets go out of date every week.",
          "withText": "Claude keeps the credit tracker up to date.",
          "signText": "The LEED AP owns the scorecard."
        },
        {
          "before": "Chase credit documentation",
          "pain": "Emails to every consultant",
          "after": "Claude drafts requests to each credit owner",
          "note": "Project manager sends them",
          "today": "The team chases the documentation for each credit.",
          "painText": "That means emails to every consultant on the project.",
          "withText": "Claude drafts a request to each credit owner.",
          "signText": "The project manager sends the requests."
        },
        {
          "before": "Write credit narratives",
          "pain": "Hours per credit, per project",
          "after": "Claude drafts narratives from the team's documents",
          "note": "LEED AP edits and approves",
          "today": "Someone writes a narrative for each credit.",
          "painText": "Each one takes hours, on every project.",
          "withText": "Claude drafts the narratives from the team's own documents.",
          "signText": "The LEED AP edits and approves each narrative."
        },
        {
          "before": "Answer GBCI review comments",
          "pain": "Weeks lost at every review",
          "after": "Claude drafts responses by credit",
          "note": "LEED AP signs the resubmission",
          "today": "The team answers the comments from each GBCI review.",
          "painText": "Weeks are lost at every review.",
          "withText": "Claude drafts a response for each credit.",
          "signText": "The LEED AP signs the resubmission."
        }
      ],
      "map": {
        "title": "LEED documentation",
        "desc": "Claude builds the credit tracker, drafts narratives from the team's documents, and turns GBCI review comments into draft responses.",
        "note": "The LEED AP signs every submission.",
        "grid": {
          "cols": 6,
          "rows": 3
        },
        "nodes": [
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Project registered",
            "sub": "Target: LEED Gold",
            "icon": "flag"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Builds the credit tracker",
            "sub": "Owners, due dates, points"
          },
          {
            "id": "s1",
            "kind": "source",
            "col": 1,
            "row": 2,
            "label": "Drawings and specs",
            "icon": "doc"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 2,
            "row": 2,
            "label": "Energy and MEP reports",
            "icon": "gauge"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 2,
            "row": 1,
            "label": "Drafts credit narratives",
            "sub": "Checks every form"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 3,
            "row": 2,
            "label": "Missing documents",
            "sub": "Chased with the owner named",
            "icon": "flag"
          },
          {
            "id": "h",
            "kind": "review",
            "col": 3,
            "row": 1,
            "label": "Reviews every credit",
            "sub": "Signs the submission",
            "tag": "LEED AP",
            "icon": "person"
          },
          {
            "id": "g",
            "kind": "system",
            "col": 4,
            "row": 1,
            "label": "Preliminary review",
            "sub": "Comments by credit",
            "tag": "GBCI",
            "icon": "shield"
          },
          {
            "id": "o",
            "kind": "output",
            "col": 5,
            "row": 1,
            "label": "Certified",
            "sub": "Gold, on the plaque",
            "icon": "check"
          }
        ],
        "edges": [
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "c2"
          },
          {
            "from": "s1",
            "to": "c2"
          },
          {
            "from": "s2",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "h"
          },
          {
            "from": "c2",
            "to": "b"
          },
          {
            "from": "h",
            "to": "g"
          },
          {
            "from": "g",
            "to": "c2",
            "label": "review comments",
            "out": "t",
            "in": "t",
            "via": -0.4
          },
          {
            "from": "g",
            "to": "o"
          }
        ]
      }
    },
    {
      "id": "energy",
      "name": "Energy modelling",
      "short": "Energy modelling",
      "lede": "Today, every simulation run waits on days of manual input checks.",
      "flows": [
        {
          "before": "Check model inputs",
          "pain": "Days of cross-checking drawings",
          "after": "Claude checks inputs against drawings and schedules",
          "note": "Modeller fixes what's flagged",
          "today": "The modeller checks every model input.",
          "painText": "It takes days of cross-checking against the drawings.",
          "withText": "Claude checks the inputs against the drawings and schedules.",
          "signText": "The modeller fixes anything Claude flags."
        },
        {
          "before": "Set up the Appendix G baseline",
          "pain": "Rules re-read on every project",
          "after": "Claude drafts the baseline system map",
          "note": "Modeller confirms each rule",
          "today": "The modeller sets up the Appendix G baseline.",
          "painText": "The rules are re-read on every project.",
          "withText": "Claude drafts the baseline system map.",
          "signText": "The modeller confirms each rule."
        },
        {
          "before": "Quality-check simulation results",
          "pain": "Unmet hours found at the end",
          "after": "Claude checks every run as it lands",
          "note": "Modeller reruns what fails",
          "today": "The modeller quality-checks the simulation results.",
          "painText": "Unmet hours are only found at the end.",
          "withText": "Claude checks every run as soon as it finishes.",
          "signText": "The modeller reruns anything that fails."
        },
        {
          "before": "Write the energy report",
          "pain": "A week per design phase",
          "after": "Claude drafts the savings report",
          "note": "Engineer signs the results",
          "today": "The team writes the energy report.",
          "painText": "It takes a week for each design phase.",
          "withText": "Claude drafts the savings report.",
          "signText": "The engineer signs the results."
        }
      ],
      "map": {
        "title": "Energy model runs",
        "desc": "Claude checks model inputs against the drawings, runs a quality check on every simulation, and drafts the savings report the engineer signs.",
        "note": "The modeller owns the model, and the engineer signs the results.",
        "grid": {
          "cols": 6,
          "rows": 3
        },
        "nodes": [
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Drawings issued",
            "sub": "New design package",
            "icon": "doc"
          },
          {
            "id": "s1",
            "kind": "source",
            "col": 1,
            "row": 0,
            "label": "Drawings and schedules",
            "icon": "docs"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 1,
            "row": 2,
            "label": "Appendix G rules",
            "icon": "book"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Checks model inputs",
            "sub": "Against drawings and rules"
          },
          {
            "id": "h1",
            "kind": "review",
            "col": 2,
            "row": 1,
            "label": "Builds the model",
            "sub": "Geometry, systems, loads",
            "tag": "Energy modeller",
            "icon": "person"
          },
          {
            "id": "r1",
            "kind": "system",
            "col": 3,
            "row": 0,
            "label": "Baseline runs",
            "sub": "Four orientations",
            "tag": "Simulation",
            "icon": "gauge"
          },
          {
            "id": "r2",
            "kind": "system",
            "col": 3,
            "row": 1,
            "label": "Proposed run",
            "sub": "Same weather file",
            "tag": "Simulation",
            "icon": "gauge"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 4,
            "row": 0.5,
            "label": "Checks every run",
            "sub": "Unmet hours, end uses"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 4,
            "row": 2,
            "label": "Unmet hours too high",
            "sub": "Back to the modeller",
            "icon": "flag"
          },
          {
            "id": "c3",
            "kind": "claude",
            "col": 5,
            "row": 0.5,
            "label": "Drafts the savings report",
            "sub": "Measures against baseline"
          },
          {
            "id": "e",
            "kind": "review",
            "col": 5,
            "row": 2,
            "label": "Signs the results",
            "sub": "Credit documented",
            "tag": "Engineer",
            "icon": "check"
          }
        ],
        "edges": [
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "s1",
            "to": "c1"
          },
          {
            "from": "s2",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "h1"
          },
          {
            "from": "h1",
            "to": "r1"
          },
          {
            "from": "h1",
            "to": "r2"
          },
          {
            "from": "r1",
            "to": "c2"
          },
          {
            "from": "r2",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "b"
          },
          {
            "from": "b",
            "to": "h1",
            "label": "rerun",
            "style": "loop",
            "out": "l",
            "in": "b"
          },
          {
            "from": "c2",
            "to": "c3"
          },
          {
            "from": "c3",
            "to": "e"
          }
        ]
      }
    },
    {
      "id": "esg",
      "name": "ESG reporting",
      "short": "ESG reporting",
      "lede": "Today, every reporting deadline brings weeks of spreadsheet chasing.",
      "flows": [
        {
          "before": "Collect portfolio data",
          "pain": "Utility bills across hundreds of sites",
          "after": "Claude builds one normalised dataset",
          "note": "Asset teams fill the gaps",
          "today": "The team collects data from across the portfolio.",
          "painText": "The utility bills come from hundreds of sites.",
          "withText": "Claude builds one normalised dataset.",
          "signText": "The asset teams fill any gaps."
        },
        {
          "before": "Answer the GRESB assessment",
          "pain": "Weeks of copy and paste",
          "after": "Claude drafts responses from the dataset",
          "note": "Sustainability lead reviews",
          "today": "The team answers the GRESB assessment.",
          "painText": "It takes weeks of copying and pasting.",
          "withText": "Claude drafts the responses from the dataset.",
          "signText": "The sustainability lead reviews them."
        },
        {
          "before": "Map metrics to CSRD and ISSB",
          "pain": "Each framework mapped by hand",
          "after": "Claude maps every metric to each framework",
          "note": "Lead signs off the mapping",
          "today": "The team maps its metrics to CSRD and ISSB.",
          "painText": "Each framework is mapped by hand.",
          "withText": "Claude maps every metric to each framework.",
          "signText": "The sustainability lead signs off the mapping."
        },
        {
          "before": "Prepare for assurance",
          "pain": "Evidence hunted per request",
          "after": "Claude assembles the evidence pack",
          "note": "Lead responds to the assurer",
          "today": "The team prepares for assurance.",
          "painText": "Evidence is hunted down for each request.",
          "withText": "Claude assembles the evidence pack.",
          "signText": "The sustainability lead responds to the assurer."
        }
      ],
      "map": {
        "title": "ESG disclosure",
        "desc": "Claude pulls portfolio data into one dataset, flags the gaps, and maps every metric to each framework the client reports against.",
        "note": "Assurance and sign-off stay with people.",
        "grid": {
          "cols": 6,
          "rows": 4
        },
        "nodes": [
          {
            "id": "s1",
            "kind": "source",
            "col": 0,
            "row": 0,
            "label": "Utility bills",
            "icon": "receipt"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 0,
            "row": 1,
            "label": "Portfolio Manager",
            "icon": "gauge"
          },
          {
            "id": "s3",
            "kind": "source",
            "col": 0,
            "row": 2,
            "label": "Waste and water data",
            "icon": "chart"
          },
          {
            "id": "s4",
            "kind": "source",
            "col": 0,
            "row": 3,
            "label": "Supplier surveys",
            "icon": "people"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Builds one dataset",
            "sub": "Units, periods, coverage"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 1,
            "row": 2.65,
            "label": "Coverage gaps",
            "sub": "Asset teams fill them",
            "icon": "flag"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 2,
            "row": 1,
            "label": "Maps each metric",
            "sub": "To every framework"
          },
          {
            "id": "a1",
            "kind": "artifact",
            "col": 3,
            "row": 0.2,
            "label": "GRESB response",
            "icon": "doc"
          },
          {
            "id": "a2",
            "kind": "artifact",
            "col": 3,
            "row": 1,
            "label": "CSRD / ESRS",
            "icon": "doc"
          },
          {
            "id": "a3",
            "kind": "artifact",
            "col": 3,
            "row": 1.8,
            "label": "ISSB S2",
            "icon": "doc"
          },
          {
            "id": "h",
            "kind": "review",
            "col": 4,
            "row": 1,
            "label": "Reviews every metric",
            "sub": "Owns the narrative",
            "tag": "ESG lead",
            "icon": "person"
          },
          {
            "id": "z",
            "kind": "system",
            "col": 5,
            "row": 1,
            "label": "Limited assurance",
            "sub": "Tests the evidence",
            "tag": "Assurance",
            "icon": "shield"
          },
          {
            "id": "o",
            "kind": "output",
            "col": 5,
            "row": 2.7,
            "label": "Reports published",
            "sub": "On the deadline",
            "icon": "check"
          }
        ],
        "edges": [
          {
            "from": "s1",
            "to": "c1"
          },
          {
            "from": "s2",
            "to": "c1"
          },
          {
            "from": "s3",
            "to": "c1"
          },
          {
            "from": "s4",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "b"
          },
          {
            "from": "b",
            "to": "c1",
            "label": "filled",
            "style": "loop",
            "out": "r",
            "in": "r"
          },
          {
            "from": "c1",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "a1"
          },
          {
            "from": "c2",
            "to": "a2"
          },
          {
            "from": "c2",
            "to": "a3"
          },
          {
            "from": "a1",
            "to": "h"
          },
          {
            "from": "a2",
            "to": "h"
          },
          {
            "from": "a3",
            "to": "h"
          },
          {
            "from": "h",
            "to": "z"
          },
          {
            "from": "z",
            "to": "h",
            "label": "evidence requests",
            "out": "t",
            "in": "t",
            "via": -0.5
          },
          {
            "from": "z",
            "to": "o"
          }
        ]
      }
    },
    {
      "id": "carbon",
      "name": "Embodied carbon",
      "short": "Embodied carbon",
      "lede": "Today, material takeoffs are matched to EPDs by hand, one line at a time.",
      "flows": [
        {
          "before": "Run a whole-building LCA",
          "pain": "Takeoffs matched to EPDs by hand",
          "after": "Claude matches every material to an EPD",
          "note": "LCA lead checks the matches",
          "today": "The team runs a whole-building life cycle assessment (LCA).",
          "painText": "Material takeoffs are matched to EPDs by hand.",
          "withText": "Claude matches every material to an EPD.",
          "signText": "The LCA lead checks the matches."
        },
        {
          "before": "Collect product EPDs",
          "pain": "Requests scattered across suppliers",
          "after": "Claude drafts EPD requests by package",
          "note": "Contractor sends them",
          "today": "The team collects an EPD for each product.",
          "painText": "The requests are scattered across suppliers.",
          "withText": "Claude drafts the EPD requests for each package.",
          "signText": "The contractor sends them."
        },
        {
          "before": "Compare design options",
          "pain": "One option costed per week",
          "after": "Claude compares options side by side",
          "note": "Design team chooses",
          "today": "The team compares design options.",
          "painText": "Only one option is costed each week.",
          "withText": "Claude compares the options side by side.",
          "signText": "The design team chooses."
        },
        {
          "before": "Document the LEED credit",
          "pain": "Report rebuilt for every submission",
          "after": "Claude drafts the LCA report",
          "note": "LCA lead signs it",
          "today": "The team documents the LEED credit.",
          "painText": "The report is rebuilt for every submission.",
          "withText": "Claude drafts the LCA report.",
          "signText": "The LCA lead signs it."
        }
      ],
      "map": {
        "title": "Whole-building LCA",
        "desc": "Claude matches every material in the model to an environmental product declaration (EPD), runs the comparison, and finds the hotspots worth redesigning.",
        "note": "Design swaps are the team's call.",
        "grid": {
          "cols": 6,
          "rows": 3
        },
        "nodes": [
          {
            "id": "s1",
            "kind": "source",
            "col": 0,
            "row": 0,
            "label": "BIM quantities",
            "icon": "database"
          },
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Design milestone",
            "sub": "SD, DD or CD set",
            "icon": "calendar"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 0,
            "row": 2,
            "label": "EPD library",
            "icon": "book"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Matches materials to EPDs",
            "sub": "Product-specific first"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 2,
            "row": 2,
            "label": "No EPD match",
            "sub": "Generic data, flagged",
            "icon": "flag"
          },
          {
            "id": "r",
            "kind": "system",
            "col": 2,
            "row": 1,
            "label": "Runs the LCA",
            "sub": "Baseline against proposed",
            "tag": "LCA tool",
            "icon": "gauge"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 3,
            "row": 1,
            "label": "Finds the hotspots",
            "sub": "Concrete, steel, facade"
          },
          {
            "id": "h",
            "kind": "review",
            "col": 4,
            "row": 1,
            "label": "Chooses the swaps",
            "sub": "Mixes, spans, cladding",
            "tag": "Design team",
            "icon": "people"
          },
          {
            "id": "e",
            "kind": "review",
            "col": 5,
            "row": 1,
            "label": "Signs the report",
            "sub": "Reduction documented",
            "tag": "LCA lead",
            "icon": "check"
          }
        ],
        "edges": [
          {
            "from": "s1",
            "to": "c1"
          },
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "s2",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "r"
          },
          {
            "from": "c1",
            "to": "b"
          },
          {
            "from": "b",
            "to": "r"
          },
          {
            "from": "r",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "h"
          },
          {
            "from": "h",
            "to": "r",
            "label": "rerun",
            "out": "t",
            "in": "t",
            "via": -0.4
          },
          {
            "from": "h",
            "to": "e"
          }
        ]
      }
    },
    {
      "id": "mv",
      "name": "Measurement and verification",
      "short": "M&V",
      "lede": "Today, savings are reconciled by hand, months after the meters moved.",
      "flows": [
        {
          "before": "Adjust the baseline each month",
          "pain": "Weather normalisation in spreadsheets",
          "after": "Claude adjusts the baseline automatically",
          "note": "M&V engineer checks the model",
          "today": "The team adjusts the baseline each month.",
          "painText": "Weather normalisation is done in spreadsheets.",
          "withText": "Claude adjusts the baseline automatically.",
          "signText": "The M&V engineer checks the model."
        },
        {
          "before": "Report verified savings",
          "pain": "Reports months behind the meters",
          "after": "Claude drafts the monthly savings report",
          "note": "Engineer approves it",
          "today": "The team reports the verified savings.",
          "painText": "The reports run months behind the meters.",
          "withText": "Claude drafts the monthly savings report.",
          "signText": "The engineer approves it."
        },
        {
          "before": "Spot savings drift",
          "pain": "Found at the annual true-up",
          "after": "Claude flags drift the month it starts",
          "note": "Engineer investigates",
          "today": "The team watches for savings drift.",
          "painText": "Drift is only found at the annual true-up.",
          "withText": "Claude flags drift in the month it starts.",
          "signText": "The engineer investigates."
        },
        {
          "before": "Run an energy audit",
          "pain": "Site notes typed up for days",
          "after": "Claude drafts the audit from site notes",
          "note": "Engineer validates each measure",
          "today": "The team runs an energy audit.",
          "painText": "Site notes take days to type up.",
          "withText": "Claude drafts the audit from the site notes.",
          "signText": "The engineer validates each measure."
        }
      ],
      "map": {
        "title": "Measurement and verification",
        "desc": "Each month Claude compares metered use with the adjusted baseline, reports what's on track, and routes drift to an engineer.",
        "note": "Engineers investigate every drift.",
        "grid": {
          "cols": 5,
          "rows": 3
        },
        "nodes": [
          {
            "id": "s1",
            "kind": "source",
            "col": 0,
            "row": 0,
            "label": "Interval meters",
            "icon": "gauge"
          },
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Month closes",
            "sub": "Meter data in",
            "icon": "calendar"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 0,
            "row": 2,
            "label": "Weather data",
            "icon": "globe"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Adjusts the baseline",
            "sub": "Weather and occupancy"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 2,
            "row": 1,
            "label": "Compares actual and expected",
            "sub": "Per meter, per measure"
          },
          {
            "id": "a",
            "kind": "artifact",
            "col": 3,
            "row": 0,
            "label": "Savings report",
            "sub": "On track, this month",
            "icon": "chart"
          },
          {
            "id": "h1",
            "kind": "review",
            "col": 4,
            "row": 0,
            "label": "Approves the report",
            "sub": "Sent to the client",
            "tag": "M&V engineer",
            "icon": "check"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 3,
            "row": 1.9,
            "label": "Drift over tolerance",
            "sub": "Flagged with the trend",
            "icon": "flag"
          },
          {
            "id": "h2",
            "kind": "review",
            "col": 4,
            "row": 1.9,
            "label": "Investigates",
            "sub": "Fault, schedule or scope?",
            "tag": "Engineer",
            "icon": "person"
          }
        ],
        "edges": [
          {
            "from": "s1",
            "to": "c1"
          },
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "s2",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "a",
            "label": "on track"
          },
          {
            "from": "a",
            "to": "h1"
          },
          {
            "from": "c2",
            "to": "b"
          },
          {
            "from": "b",
            "to": "h2"
          },
          {
            "from": "h2",
            "to": "c1",
            "label": "baseline adjusted",
            "out": "b",
            "in": "b",
            "via": 2.43
          }
        ]
      }
    },
    {
      "id": "bps",
      "name": "Building performance standards",
      "short": "Performance standards",
      "lede": "Today, each building's exposure is worked out in a separate spreadsheet.",
      "flows": [
        {
          "before": "Calculate emissions per building",
          "pain": "A spreadsheet per property",
          "after": "Claude calculates every building against its limit",
          "note": "Engineer checks the inputs",
          "today": "The team calculates the emissions for each building.",
          "painText": "Each property has its own spreadsheet.",
          "withText": "Claude calculates every building against its limit.",
          "signText": "The engineer checks the inputs."
        },
        {
          "before": "Size penalty exposure",
          "pain": "Estimated once a year",
          "after": "Claude sizes exposure for each period",
          "note": "Owner sees it in the plan",
          "today": "The team sizes the penalty exposure.",
          "painText": "It is estimated once a year.",
          "withText": "Claude sizes the exposure for each period.",
          "signText": "The owner sees it in the plan."
        },
        {
          "before": "Build measure packages",
          "pain": "Consultants start from scratch",
          "after": "Claude drafts packages with cost and savings",
          "note": "Engineer validates each one",
          "today": "Consultants build packages of measures.",
          "painText": "They start from scratch.",
          "withText": "Claude drafts packages with cost and savings.",
          "signText": "The engineer validates each one."
        },
        {
          "before": "File the annual report",
          "pain": "Deadline scramble every year",
          "after": "Claude drafts each filing",
          "note": "A registered professional signs",
          "today": "The team files the annual report.",
          "painText": "Every year there is a scramble to meet the deadline.",
          "withText": "Claude drafts each filing.",
          "signText": "A registered professional signs it."
        }
      ],
      "map": {
        "title": "Emissions limit compliance",
        "desc": "Claude calculates each building's emissions against its limit, sorts the portfolio by risk, and drafts measure packages for the buildings over the limit.",
        "note": "A registered professional signs every filing.",
        "grid": {
          "cols": 6,
          "rows": 3
        },
        "nodes": [
          {
            "id": "s1",
            "kind": "source",
            "col": 0,
            "row": 0,
            "label": "Utility data",
            "icon": "receipt"
          },
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Compliance year",
            "sub": "Local law deadline",
            "icon": "calendar"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 0,
            "row": 2,
            "label": "Emissions factors",
            "icon": "book"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Calculates each building",
            "sub": "Emissions against its limit"
          },
          {
            "id": "g",
            "kind": "artifact",
            "col": 2,
            "row": 0,
            "label": "Compliant",
            "sub": "Filing drafted",
            "icon": "check"
          },
          {
            "id": "a",
            "kind": "artifact",
            "col": 2,
            "row": 1,
            "label": "At risk next period",
            "sub": "Watch list",
            "icon": "gauge"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 2,
            "row": 2,
            "label": "Over the limit",
            "sub": "Penalty exposure sized",
            "icon": "flag"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 3,
            "row": 2,
            "label": "Drafts measure packages",
            "sub": "Cost, savings, timing"
          },
          {
            "id": "h",
            "kind": "review",
            "col": 4,
            "row": 2,
            "label": "Validates the measures",
            "sub": "Engineering review",
            "tag": "Engineer",
            "icon": "person"
          },
          {
            "id": "d",
            "kind": "review",
            "col": 4,
            "row": 1,
            "label": "Funds the plan",
            "sub": "Capital plan updated",
            "tag": "Owner",
            "icon": "scale"
          },
          {
            "id": "o",
            "kind": "output",
            "col": 5,
            "row": 1,
            "label": "Annual report filed",
            "sub": "Professionally certified",
            "icon": "check"
          }
        ],
        "edges": [
          {
            "from": "s1",
            "to": "c1"
          },
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "s2",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "g"
          },
          {
            "from": "c1",
            "to": "a"
          },
          {
            "from": "c1",
            "to": "b"
          },
          {
            "from": "b",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "h"
          },
          {
            "from": "h",
            "to": "d"
          },
          {
            "from": "a",
            "to": "d"
          },
          {
            "from": "d",
            "to": "o"
          },
          {
            "from": "g",
            "to": "o",
            "out": "r",
            "in": "t"
          }
        ]
      }
    },
    {
      "id": "materials",
      "name": "Healthy materials",
      "short": "Healthy materials",
      "lede": "Today, every product data sheet is checked against green specs by hand.",
      "flows": [
        {
          "before": "Review product submittals",
          "pain": "Every data sheet read by hand",
          "after": "Claude checks each product against the spec",
          "note": "LEED AP reviews exceptions",
          "today": "The team reviews product submittals.",
          "painText": "Every data sheet is read by hand.",
          "withText": "Claude checks each product against the spec.",
          "signText": "The LEED AP reviews the exceptions."
        },
        {
          "before": "Track low-emitting materials",
          "pain": "Credit calculators kept manually",
          "after": "Claude logs compliant products to the tracker",
          "note": "LEED AP confirms the credit",
          "today": "The team tracks low-emitting materials.",
          "painText": "The credit calculators are kept up by hand.",
          "withText": "Claude logs compliant products in the tracker.",
          "signText": "The LEED AP confirms the credit."
        },
        {
          "before": "Chase missing documentation",
          "pain": "Back-and-forth with contractors",
          "after": "Claude drafts each request",
          "note": "Contractor resubmits",
          "today": "The team chases missing documentation.",
          "painText": "It means a lot of back and forth with contractors.",
          "withText": "Claude drafts each request.",
          "signText": "The contractor resubmits."
        },
        {
          "before": "Evaluate substitutions",
          "pain": "Decisions buried in email",
          "after": "Claude summarises each substitution",
          "note": "Architect approves",
          "today": "The team evaluates substitutions.",
          "painText": "The decisions are buried in email.",
          "withText": "Claude summarises each substitution.",
          "signText": "The architect approves."
        }
      ],
      "map": {
        "title": "Submittal review",
        "desc": "Claude checks each submittal against the spec and LEED criteria, logs what complies, and chases what's missing.",
        "note": "The LEED AP decides every substitution.",
        "grid": {
          "cols": 5,
          "rows": 3
        },
        "nodes": [
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Submittal arrives",
            "sub": "From the contractor",
            "icon": "inbox"
          },
          {
            "id": "s",
            "kind": "source",
            "col": 1,
            "row": 0,
            "label": "Spec and LEED criteria",
            "icon": "book"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Checks each product",
            "sub": "VOC, EPDs, certifications"
          },
          {
            "id": "o1",
            "kind": "output",
            "col": 2,
            "row": 0,
            "label": "Logged compliant",
            "sub": "Credit tracker updated",
            "icon": "check"
          },
          {
            "id": "b2",
            "kind": "branch",
            "col": 2,
            "row": 1,
            "label": "Doesn't meet spec",
            "sub": "Substitution needed",
            "icon": "flag"
          },
          {
            "id": "b1",
            "kind": "branch",
            "col": 2,
            "row": 1.9,
            "label": "Missing documents",
            "sub": "Contractor asked",
            "icon": "docs"
          },
          {
            "id": "h",
            "kind": "review",
            "col": 3,
            "row": 1,
            "label": "Decides the substitution",
            "sub": "Against the credit",
            "tag": "LEED AP",
            "icon": "person"
          },
          {
            "id": "a",
            "kind": "review",
            "col": 4,
            "row": 1,
            "label": "Approves the product",
            "sub": "Submittal closed",
            "tag": "Architect",
            "icon": "check"
          }
        ],
        "edges": [
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "s",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "o1"
          },
          {
            "from": "c1",
            "to": "b2"
          },
          {
            "from": "c1",
            "to": "b1"
          },
          {
            "from": "b2",
            "to": "h"
          },
          {
            "from": "h",
            "to": "a"
          },
          {
            "from": "b1",
            "to": "t",
            "label": "resubmitted",
            "out": "b",
            "in": "b",
            "via": 2.43
          }
        ]
      }
    },
    {
      "id": "climate",
      "name": "Climate risk",
      "short": "Climate risk",
      "lede": "Today, hazard maps are checked one asset at a time before each disclosure.",
      "flows": [
        {
          "before": "Screen assets for physical risk",
          "pain": "Hazard maps checked one site at a time",
          "after": "Claude screens every asset per hazard",
          "note": "Resilience lead checks the scores",
          "today": "The team screens assets for physical risk.",
          "painText": "Hazard maps are checked one site at a time.",
          "withText": "Claude screens every asset for each hazard.",
          "signText": "The resilience lead checks the scores."
        },
        {
          "before": "Run warming scenarios",
          "pain": "Scenarios limited by analyst time",
          "after": "Claude runs each scenario across the portfolio",
          "note": "Lead picks the scenarios",
          "today": "The team runs warming scenarios.",
          "painText": "The number of scenarios is limited by analyst time.",
          "withText": "Claude runs each scenario across the portfolio.",
          "signText": "The resilience lead picks the scenarios."
        },
        {
          "before": "Plan adaptation",
          "pain": "Site reviews prioritised by instinct",
          "after": "Claude ranks sites for review",
          "note": "Engineer assesses on site",
          "today": "The team plans adaptation.",
          "painText": "Site reviews are prioritised by instinct.",
          "withText": "Claude ranks the sites for review.",
          "signText": "The engineer makes the assessment on site."
        },
        {
          "before": "Draft the climate disclosure",
          "pain": "Written from scratch each year",
          "after": "Claude drafts risks, metrics and plans",
          "note": "Board approves",
          "today": "The team drafts the climate disclosure.",
          "painText": "It is written from scratch each year.",
          "withText": "Claude drafts the risks, metrics and plans.",
          "signText": "The board approves it."
        }
      ],
      "map": {
        "title": "Climate risk screening",
        "desc": "Claude screens every asset against flood, heat and wind data, scores the portfolio, and drafts the disclosure the board approves.",
        "note": "The board approves what's disclosed.",
        "grid": {
          "cols": 6,
          "rows": 3
        },
        "nodes": [
          {
            "id": "s1",
            "kind": "source",
            "col": 0,
            "row": 0,
            "label": "Flood data",
            "icon": "globe"
          },
          {
            "id": "t",
            "kind": "trigger",
            "col": 0,
            "row": 1,
            "label": "Disclosure cycle",
            "sub": "Annual reporting",
            "icon": "calendar"
          },
          {
            "id": "s2",
            "kind": "source",
            "col": 0,
            "row": 2,
            "label": "Heat and wind projections",
            "icon": "chart"
          },
          {
            "id": "s3",
            "kind": "source",
            "col": 1,
            "row": 0,
            "label": "Asset register",
            "icon": "database"
          },
          {
            "id": "c1",
            "kind": "claude",
            "col": 1,
            "row": 1,
            "label": "Scores every asset",
            "sub": "Per hazard, per scenario"
          },
          {
            "id": "a",
            "kind": "artifact",
            "col": 2,
            "row": 1,
            "label": "Portfolio heat map",
            "sub": "Two warming scenarios",
            "icon": "chart"
          },
          {
            "id": "o1",
            "kind": "artifact",
            "col": 3,
            "row": 0,
            "label": "Lower-risk assets",
            "sub": "Monitored yearly",
            "icon": "check"
          },
          {
            "id": "b",
            "kind": "branch",
            "col": 3,
            "row": 2,
            "label": "High-risk assets",
            "sub": "Sent for site review",
            "icon": "flag"
          },
          {
            "id": "h1",
            "kind": "review",
            "col": 4,
            "row": 2,
            "label": "Assesses on site",
            "sub": "Adaptation options",
            "tag": "Engineer",
            "icon": "person"
          },
          {
            "id": "c2",
            "kind": "claude",
            "col": 4,
            "row": 1,
            "label": "Drafts the disclosure",
            "sub": "Risks, metrics, plans"
          },
          {
            "id": "d",
            "kind": "review",
            "col": 5,
            "row": 1,
            "label": "Approves the disclosure",
            "sub": "Published with the report",
            "tag": "Board",
            "icon": "scale"
          }
        ],
        "edges": [
          {
            "from": "s1",
            "to": "c1"
          },
          {
            "from": "t",
            "to": "c1"
          },
          {
            "from": "s2",
            "to": "c1"
          },
          {
            "from": "s3",
            "to": "c1"
          },
          {
            "from": "c1",
            "to": "a"
          },
          {
            "from": "a",
            "to": "o1"
          },
          {
            "from": "a",
            "to": "b"
          },
          {
            "from": "b",
            "to": "h1"
          },
          {
            "from": "h1",
            "to": "c2"
          },
          {
            "from": "a",
            "to": "c2"
          },
          {
            "from": "c2",
            "to": "d"
          }
        ]
      }
    }
  ]
};
