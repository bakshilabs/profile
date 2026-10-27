/* Bakshi Labs: content for the small business AI training slides.
   Taken from the "AI Training for Small Businesses" training page, with
   British spelling and plain wording. The page shows no prices, packages
   beyond the two levels, or questions and answers, so none appear here.
   Every slide has an id (used for its link), a short name (used for its dot)
   and the content its builder in training.js expects. */

window.TRAINING_DECK = {
  slides: [
    {
      id: "",
      type: "cover",
      short: "Overview",
      kicker: "Bakshi Labs · Training",
      title: "AI training for small businesses",
      lede: "Small business owners take part in hands-on training and build working AI systems on their own business. We then track the impact with each business for 60 days.",
      stats: [
        ["250+", "executives and SME founders trained in AI"],
        ["4", "working assets built by each business"],
        ["4", "impact checkpoints across 60 days"]
      ],
      tools: "Sessions use Claude, Gemini and ChatGPT."
    },
    {
      id: "adoption-gap",
      type: "gap",
      short: "Adoption gap",
      kicker: "01 · The adoption gap",
      title: "The adoption gap",
      lede: "Small businesses already have the tools. They need a way to connect them, so that activity spread across separate tools is joined up through one AI layer.",
      tools: ["Email", "CRM", "LinkedIn", "Website", "Marketing", "Spreadsheets", "Documents", "Sales calls"],
      costs: ["Manual work", "Information silos", "Missed follow-up", "Duplicate data", "Poor visibility"],
      hub: ["Business AI layer", "AI, automation and data"],
      note: "Human judgement and relationships stay with people."
    },
    {
      id: "method",
      type: "method",
      short: "Method",
      kicker: "02 · Our methodology",
      title: "The five-stage method",
      lede: "Every programme runs through the same five stages. The content is designed for the people in the room.",
      stages: [
        { name: "Understand", text: "Identify high-value opportunities.", output: "An AI opportunity map", icon: "search" },
        { name: "Build", text: "Create practical workflows.", output: "A working workflow", icon: "build" },
        { name: "Automate", text: "Remove repetitive work.", output: "Fewer manual steps", icon: "bolt" },
        { name: "Measure", text: "Track business impact.", output: "A baseline and results", icon: "chart" },
        { name: "Improve", text: "Refine the system using results and feedback.", output: "The next improvement", icon: "loop" }
      ],
      loop: "Then the cycle starts again"
    },
    {
      id: "example",
      type: "example",
      short: "Example",
      kicker: "03 · Illustrative example",
      title: "Sales before and after Level 1",
      lede: "This example follows a fictional local services business through Level 1. Each card shows one part of its sales work before the training and after it.",
      rows: [
        ["Enquiries sit in the inbox.", "Every enquiry lands in one pipeline."],
        ["Leads live in heads and spreadsheets.", "Each lead has a stage and a next step."],
        ["Research before a call takes hours.", "Claude researches a prospect in minutes."],
        ["Follow-up depends on memory.", "Follow-ups are drafted in the owner’s voice."],
        ["Past enquiries go cold.", "A nurture sequence keeps past leads warm."],
        ["Nobody knows how many leads came in.", "A weekly review shows who to chase."]
      ],
      note: "The business and its results are illustrative."
    },
    {
      id: "programmes",
      type: "levels",
      short: "Programmes",
      kicker: "04 · Programmes",
      title: "Two programme levels",
      lede: "Each business starts at the level that matches where it is today. Owners work on their own business throughout.",
      levels: [
        {
          tag: "Level 1",
          name: "Build your AI sales system",
          rows: [
            ["For", "Owners who use AI without a system around it."],
            ["Format", "A full day, or three two-hour sessions."],
            ["Leaves with", "A working pipeline, outreach in their own voice and a live lead nurture."]
          ],
          tools: ["Claude", "HubSpot free or Google Sheets", "Make", "Brevo", "Gmail or Outlook"],
          action: "See the six steps",
          goto: "level-1"
        },
        {
          tag: "Level 2",
          name: "From automating a task to automating a process",
          rows: [
            ["For", "Digitally confident owners and teams."],
            ["Format", "A four-week cohort with one two-hour session a week, plus one-to-one build time."],
            ["Leaves with", "A complex process automated end to end, with human checkpoints and a before-and-after measure."]
          ],
          tools: [],
          action: "Ask about Level 2",
          href: "index.html#contact"
        }
      ],
      note: "Formats, durations and cohort sizes can be shaped around your team."
    },
    {
      id: "level-1",
      type: "steps",
      short: "Level 1",
      kicker: "05 · Inside Level 1",
      title: "The six steps of Level 1",
      lede: "Each step is built on the owner’s own business, and the pipeline is loaded with the owner’s real leads. The steps run in order, from setting up the assistant to the weekly review.",
      steps: [
        { name: "Set up your sales assistant", text: "A Claude Project that knows your business, offer and tone.", tools: ["Claude"] },
        { name: "Track every lead", text: "A simple pipeline with stages, loaded with your real leads.", tools: ["HubSpot free or Google Sheets"] },
        { name: "Research before you reach out", text: "A reusable prompt that researches a prospect in minutes.", tools: ["Claude"] },
        { name: "Write outreach that sounds like you", text: "Emails and follow-ups in your voice, within UK email rules.", tools: ["Claude", "Gmail or Outlook"] },
        { name: "Start a lead nurture", text: "New leads get a nurture sequence written with Claude and sent through Brevo.", tools: ["Make Free", "Claude", "Brevo Free"] },
        { name: "Review the pipeline weekly", text: "Claude summarises who to chase and what has stalled.", tools: ["Claude", "Your CRM"] }
      ],
      leaves: ["A working pipeline with your real leads", "A research prompt you can reuse", "An outreach sequence in your own voice", "A live lead nurture"],
      note: "Outreach is taught within UK email marketing rules (PECR and UK GDPR). The tools use free tiers where they exist."
    },
    {
      id: "impact",
      type: "impact",
      short: "Impact",
      kicker: "06 · Measuring impact",
      title: "Impact measurement",
      lede: "We track four kinds of value with each business, against a baseline taken at the start, so the value of AI is visible.",
      areas: [
        { name: "Time", icon: "clock", items: ["Hours saved", "Manual tasks removed", "Faster research"] },
        { name: "Revenue", icon: "pound", items: ["Leads captured", "Follow-ups sent", "Enquiries converted"] },
        { name: "Customer", icon: "heart", items: ["Response time", "Service quality", "Retention"] },
        { name: "Adoption", icon: "people", items: ["Active users", "Workflows in use", "Frequency of use"] }
      ],
      checks: [
        ["End of day", "Confidence check"],
        ["Day 7", "Baseline survey"],
        ["Day 30", "Adoption check"],
        ["Day 60", "Workflow check"]
      ]
    },
    {
      id: "results",
      type: "results",
      short: "Results",
      kicker: "07 · Results",
      title: "Results for clients",
      lede: "The trainers run AI and automation work for clients, so every session uses real examples from that work.",
      results: [
        { big: "250+", text: "executives and SME founders trained in AI." },
        { big: "100+ hrs", text: "of weekly work automated for a LinkedIn content agency." },
        { big: "10 hrs", text: "of manual work automated every week for a market research agency." }
      ],
      note: "Client names are available on request."
    },
    {
      id: "funders",
      type: "partners",
      short: "Funders",
      kicker: "08 · For funders and support organisations",
      title: "Funded programme partnerships",
      lede: "For organisations that run funded programmes for local businesses, we bring the content, the trainers and the measurement. The partnership improves with every cohort.",
      you: ["A funded programme", "Reach into local businesses", "Venues and scheduling", "Programme requirements"],
      we: ["Content built for your audience", "Trainers who build these systems", "Templates and worked examples", "Measurement and reporting"],
      cycle: [
        ["Reach", "You invite businesses through your network."],
        ["Deliver", "We run the sessions and the build time."],
        ["Check in", "We check in with each business on days 7, 30 and 60."],
        ["Report", "The outcomes come back to you."],
        ["Improve", "The next cohort starts from what worked."]
      ],
      loop: "Then the next cohort begins",
      receive: ["Number of businesses supported", "Working assets built per business", "Adoption at days 7, 30 and 60", "A day-60 outcomes report"],
      note: "We can shape a pilot cohort around your programme’s requirements."
    },
    {
      id: "next-steps",
      type: "close",
      short: "Next steps",
      kicker: "09 · Get started",
      title: "Next steps",
      lede: "We want every business we train to finish with a workflow it uses each week.",
      principles: [
        ["Practical", "The training is built around real business workflows."],
        ["Implementable", "Participants leave with something they can use."],
        ["Measurable", "The impact is tracked over time."]
      ],
      steps: ["Book a scoping call.", "Agree the format that fits your team.", "Build on your own business, then track the impact for 60 days."],
      offer: "Tell us a date and we will bring a draft programme shaped around your requirements.",
      cta: ["Start a conversation", "index.html#contact"]
    }
  ]
};
