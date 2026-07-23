/**
 * In-app help copy for the SEO & AI Insights dashboard.
 *
 * Two layers, kept together so copy edits happen in one file:
 *  - TAB_HELP: short explainers surfaced in the contextual help strip and its tooltip.
 *  - GUIDE_SECTIONS: the full user guide rendered in the slide-over guide panel.
 *
 * Content is plain data (no JSX) so it can later be sourced from a CMS —
 * for instance a Uniform entry, without touching components.
 */

export type GuideTabId = "overview" | "opportunities" | "ai" | "prompts" | "keywords" | "suggestions" | "decaying"

export interface TabHelp {
  /** One short line shown inline in the help strip. */
  short: string
  /** Two-sentence explainer shown in the info tooltip. */
  tooltip: string
}

export const TAB_HELP: Record<GuideTabId, TabHelp> = {
  overview: {
    short: "Your weekly starting point: what changed since the last snapshot.",
    tooltip:
      "A one-screen health check of your search presence and what changed since the last snapshot. Green arrows mean improvement, and the Attention needed card is your to-do list.",
  },
  opportunities: {
    short: "Your ranked to-do list: the keyword and AI wins the data says to chase first.",
    tooltip:
      "Every opportunity is derived from data already collected, striking-distance keywords, topics competitors dominate, prompts you're invisible for. Each names the action (create, expand, refresh) and links the page to model it on.",
  },
  ai: {
    short: "Whether AI assistants mention your brand and cite your pages.",
    tooltip:
      "Shows whether AI assistants like ChatGPT, Gemini, and Perplexity mention your brand and cite your pages when answering questions. Citations are the strongest signal, the AI links to your content as a source.",
  },
  prompts: {
    short: "Your prompts, asked live to four AI assistants, and who wins each answer.",
    tooltip:
      "Runs the prompts configured in settings through ChatGPT, Claude, Gemini, and Perplexity, then shows whether you're mentioned, how you rank against competitors, and which sources the answers cite. Each prompt ends with a concrete next step.",
  },
  keywords: {
    short: "Every keyword you rank for, filtered down to the ones worth acting on.",
    tooltip:
      "All the keywords your site ranks for in Google, with filters to surface the ones worth acting on. Try the striking distance toggle to find pages that are close to the top and just need a nudge.",
  },
  suggestions: {
    short: "Discover what people actually search for around a topic.",
    tooltip:
      "Give it one seed keyword and discover what people actually search for, in Google and in AI assistants. Add promising keywords to tracking so they appear in your snapshots from next week on.",
  },
  decaying: {
    short: "Pages losing traffic or AI citations, caught early.",
    tooltip:
      "Finds pages that are slowly losing traffic, rankings, or AI citations, before the traffic is gone. Refreshing an aging page is usually faster than writing a new one.",
  },
}

/** A block of guide content: a paragraph or a bulleted list with an optional lead-in. */
export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; lead?: string; items: string[] }

export interface GuideSection {
  id: GuideTabId | "basics" | "routine"
  title: string
  blocks: GuideBlock[]
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "basics",
    title: "The basics",
    blocks: [
      {
        kind: "list",
        lead: "A few words you'll see everywhere:",
        items: [
          "Keyword, something people type into Google (or ask an AI), like “best headless CMS”.",
          "Position, where your page appears in Google's results. Position 1 is the top; most clicks go to the first few positions.",
          "Search volume, roughly how many people search for a keyword each month.",
          "Snapshot, data is collected on a schedule (weekly by default), not live. The header shows how fresh it is, and changes are always “since the last snapshot”.",
        ],
      },
    ],
  },
  {
    id: "overview",
    title: "Overview",
    blocks: [
      {
        kind: "p",
        text: "Your starting point: one screen that answers “how are we doing, and did anything change?” The five big numbers cover traffic, keywords, links, site health, and AI mentions, each with an arrow showing movement since the last snapshot.",
      },
      {
        kind: "list",
        lead: "From insight to action:",
        items: [
          "Check this tab once a week, right after a new snapshot. Look for change, not absolute numbers.",
          "A big drop in Top losses? Click through to Keywords to see which page lost ground.",
          "The Attention needed card links straight to problems, treat it as this week's to-do list.",
          "Ignore small wobbles; positions naturally drift. Act on drops of several places, or trends pointing down for three or more snapshots.",
        ],
      },
    ],
  },
  {
    id: "opportunities",
    title: "Opportunities",
    blocks: [
      {
        kind: "p",
        text: "The tab that answers “so what do I do?” Two ranked lists, keyword opportunities and AI citation & mention opportunities, computed from the data the other tabs already collected, so acting on them costs nothing. Impact reflects the monthly demand at stake.",
      },
      {
        kind: "list",
        lead: "How to read an opportunity:",
        items: [
          "The chip is the action: Create page (nothing of yours competes yet), Expand page (you have a page that's close), Refresh page (it used to perform), Make citable (AIs mention you but don't link you), Earn mentions (a specific assistant leans elsewhere).",
          "The Model link is the page winning today, usually a competitor page AI assistants cite. That's the bar your content has to beat.",
          "Work top-down: the list is ranked by demand at stake, so item 1 is the best effort-to-reward trade.",
          "Everything here is content work you can do in Uniform Canvas, decaying pages even deep-link straight to the editor.",
        ],
      },
    ],
  },
  {
    id: "ai",
    title: "AI Visibility",
    blocks: [
      {
        kind: "p",
        text: "People increasingly ask ChatGPT, Gemini, Perplexity, and Google's AI answers instead of scrolling search results. This tab shows whether your brand shows up in those answers. A mention is when an AI names your brand; a citation is stronger, the AI links to one of your pages as a source.",
      },
      {
        kind: "list",
        lead: "From insight to action:",
        items: [
          "Lots of mentions but few citations? AIs know you but don't use your pages as sources. Study the competitor pages under Top cited pages, they show what a citable page looks like: clear, direct, well-structured answers.",
          "A competitor dominates share of voice on a topic? If you have no strong page on it, that's a content brief. If you do, it likely needs a refresh.",
          "High AI interest in a topic but few mentions of you? That's demand you're invisible for, a strong candidate for new content.",
          "Negative sentiment? Read what's actually said first; it often traces to one widely-cited source you can address.",
        ],
      },
    ],
  },
  {
    id: "prompts",
    title: "Topics & Prompts",
    blocks: [
      {
        kind: "p",
        text: "This tab asks real questions, your prompts from settings, to ChatGPT, Claude, Gemini, and Perplexity, live. Prompts are generated from your brands, AI topics, and competitors, and you can edit them in settings. Visibility is the share of answers that mention or cite you; the ranking shows who each answer actually recommends.",
      },
      {
        kind: "list",
        lead: "From insight to action:",
        items: [
          "Expand a prompt with low visibility first, the recommendation under it tells you the single next step.",
          "The Top cited sources list is the AI's reading list. If a review site dominates, keep your profile there current; if a competitor's page dominates, build the better page.",
          "A platform logo shown dimmed means that assistant doesn't surface you for the prompt, different assistants trust different sources, so earn mentions where they read.",
          "Topics in the AI answers shows the themes the assistants bring up on their own. High presence with a low You percentage is content demand you're missing.",
          "Answers refresh on the snapshot schedule. After publishing changes, force a refresh from the integration settings to see whether the answers shift.",
        ],
      },
    ],
  },
  {
    id: "keywords",
    title: "Keywords",
    blocks: [
      {
        kind: "p",
        text: "The full list of keywords your site ranks for, with filters to find the ones worth acting on. An AIO badge means Google shows an AI-generated answer for that keyword; a filled badge means your site is cited inside it.",
      },
      {
        kind: "p",
        text: "Striking distance, explained: these are keywords where you rank in positions 4–15, close to the top, but not quite there. Almost all clicks go to the first three results, and a page at position 8 is almost winning: Google already finds it relevant, it just needs a nudge. Moving from position 6 to 3 is often a small edit; moving from 30 to 3 is a project. Striking distance is your best effort-to-reward ratio.",
      },
      {
        kind: "list",
        lead: "From insight to action:",
        items: [
          "Turn on the striking distance toggle and sort by volume, the top rows are your quick wins.",
          "Improve the ranking page: answer the keyword's question directly near the top, update stale facts, add the section top-ranking pages have and you don't, and link to it from related pages.",
          "Keyword gap keywords are proven, competitors earn traffic from them today. Add the relevant ones to tracking.",
          "An important keyword with an unfilled AIO badge means Google's AI answers it without citing you, prioritize that page for a citability pass.",
        ],
      },
    ],
  },
  {
    id: "suggestions",
    title: "Keyword suggestions",
    blocks: [
      {
        kind: "p",
        text: "A discovery tool: give it one seed keyword and it finds related searches people actually make. Four styles: Related (Google's own related searches), Contains phrase (long-tail variations), Same topic (same subject, different words), and From your site (suggestions based on your domain, a good first run). The AI search volume column shows interest coming from AI assistants, which most tools can't see.",
      },
      {
        kind: "list",
        lead: "From insight to action:",
        items: [
          "Select promising rows and click Add to tracked keywords, they'll appear in the Keywords tab from the next snapshot.",
          "Favor low competition plus decent volume when picking what to write next: those are winnable.",
          "High AI volume with modest Google volume is an early signal, demand is forming in AI assistants first. Write for it now to become the cited source later.",
          "Use Contains phrase results as sections or FAQ items within one strong article, not one thin page per variation.",
        ],
      },
    ],
  },
  {
    id: "decaying",
    title: "Decaying content",
    blocks: [
      {
        kind: "p",
        text: "Content ages: pages that used to bring visitors slip as information gets stale and competitors publish fresher takes. This tab finds those pages before the traffic is gone, computed from snapshots you already have. The pattern to look for: losing traffic and not edited in months.",
      },
      {
        kind: "list",
        lead: "From insight to action:",
        items: [
          "Sort by traffic loss and work top-down, the biggest losses are the biggest recoveries.",
          "Expand a row before editing: the slipping keywords tell you exactly what to fix.",
          "A refresh beats a rewrite: update facts and screenshots, answer the main question immediately in the intro, add what's changed since publication, fix broken links.",
          "Lost AI citations mean the AIs found a fresher source, after refreshing, watch AI Visibility over the following snapshots to see citations return.",
          "Not every page deserves saving. Content about discontinued products or past events can decay in peace.",
        ],
      },
    ],
  },
  {
    id: "routine",
    title: "A simple weekly routine",
    blocks: [
      {
        kind: "list",
        items: [
          "Open Overview after the new snapshot; scan the deltas and Attention needed.",
          "Pick one or two striking distance keywords and improve their pages.",
          "Pick one decaying page and refresh it.",
          "Once a month, spend 20 minutes in Keyword suggestions and AI Visibility choosing what to create next.",
        ],
      },
      {
        kind: "p",
        text: "Small, consistent actions compound. The dashboard's job is to make sure the actions you pick are the ones the data says matter most.",
      },
    ],
  },
]
