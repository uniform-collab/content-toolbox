# SEO & AI Insights — User Guide

> This written guide mirrors the in-app help. The in-app copy (tab tooltips + the
> slide-over guide panel) is the single source of truth and lives in
> [`app/lib/guide.ts`](../app/lib/guide.ts) as plain data, so it can later be
> sourced from a Uniform entry instead of code. Edit copy there; keep this file
> in step.

## Tabs at a glance

| Tab | What it's for |
| --- | --- |
| **Overview** | Your weekly starting point: what changed since the last snapshot. |
| **AI Visibility** | Whether AI assistants mention your brand and cite your pages. |
| **Keywords** | Every keyword you rank for, filtered down to the ones worth acting on. |
| **Keyword suggestions** | Discover what people actually search for around a topic. |
| **Decaying content** | Pages losing traffic or AI citations — caught early. |

## The basics

A few words you'll see everywhere:

- **Keyword** — something people type into Google (or ask an AI), like "best headless CMS".
- **Position** — where your page appears in Google's results. Position 1 is the top; most clicks go to the first few positions.
- **Search volume** — roughly how many people search for a keyword each month.
- **Snapshot** — data is collected on a schedule (weekly by default), not live. The header shows how fresh it is, and changes are always "since the last snapshot".

## Overview

Your starting point: one screen that answers "how are we doing, and did anything change?" The five big numbers cover traffic, keywords, links, site health, and AI mentions — each with an arrow showing movement since the last snapshot.

From insight to action:

- Check this tab once a week, right after a new snapshot. Look for change, not absolute numbers.
- A big drop in Top losses? Click through to Keywords to see which page lost ground.
- The Attention needed card links straight to problems — treat it as this week's to-do list.
- Ignore small wobbles; positions naturally drift. Act on drops of several places, or trends pointing down for three or more snapshots.

## AI Visibility

People increasingly ask ChatGPT, Gemini, Perplexity, and Google's AI answers instead of scrolling search results. This tab shows whether your brand shows up in those answers. A mention is when an AI names your brand; a citation is stronger — the AI links to one of your pages as a source.

From insight to action:

- Lots of mentions but few citations? AIs know you but don't use your pages as sources. Study the competitor pages under Top cited pages — they show what a citable page looks like: clear, direct, well-structured answers.
- A competitor dominates share of voice on a topic? If you have no strong page on it, that's a content brief. If you do, it likely needs a refresh.
- High AI interest in a topic but few mentions of you? That's demand you're invisible for — a strong candidate for new content.
- Negative sentiment? Read what's actually said first; it often traces to one widely-cited source you can address.

## Keywords

The full list of keywords your site ranks for, with filters to find the ones worth acting on. An AIO badge means Google shows an AI-generated answer for that keyword; a filled badge means your site is cited inside it.

Striking distance, explained: these are keywords where you rank in positions 4–15 — close to the top, but not quite there. Almost all clicks go to the first three results, and a page at position 8 is almost winning: Google already finds it relevant, it just needs a nudge. Moving from position 6 to 3 is often a small edit; moving from 30 to 3 is a project. Striking distance is your best effort-to-reward ratio.

From insight to action:

- Turn on the striking distance toggle and sort by volume — the top rows are your quick wins.
- Improve the ranking page: answer the keyword's question directly near the top, update stale facts, add the section top-ranking pages have and you don't, and link to it from related pages.
- Keyword gap keywords are proven — competitors earn traffic from them today. Add the relevant ones to tracking.
- An important keyword with an unfilled AIO badge means Google's AI answers it without citing you — prioritize that page for a citability pass.

## Keyword suggestions

A discovery tool: give it one seed keyword and it finds related searches people actually make. Four styles: Related (Google's own related searches), Contains phrase (long-tail variations), Same topic (same subject, different words), and From your site (suggestions based on your domain — a good first run). The AI search volume column shows interest coming from AI assistants, which most tools can't see.

From insight to action:

- Select promising rows and click Add to tracked keywords — they'll appear in the Keywords tab from the next snapshot.
- Favor low competition plus decent volume when picking what to write next: those are winnable.
- High AI volume with modest Google volume is an early signal — demand is forming in AI assistants first. Write for it now to become the cited source later.
- Use Contains phrase results as sections or FAQ items within one strong article, not one thin page per variation.

## Decaying content

Content ages: pages that used to bring visitors slip as information gets stale and competitors publish fresher takes. This tab finds those pages before the traffic is gone, computed from snapshots you already have. The pattern to look for: losing traffic and not edited in months.

From insight to action:

- Sort by traffic loss and work top-down — the biggest losses are the biggest recoveries.
- Expand a row before editing: the slipping keywords tell you exactly what to fix.
- A refresh beats a rewrite: update facts and screenshots, answer the main question immediately in the intro, add what's changed since publication, fix broken links.
- Lost AI citations mean the AIs found a fresher source — after refreshing, watch AI Visibility over the following snapshots to see citations return.
- Not every page deserves saving. Content about discontinued products or past events can decay in peace.

## A simple weekly routine

- Open Overview after the new snapshot; scan the deltas and Attention needed.
- Pick one or two striking distance keywords and improve their pages.
- Pick one decaying page and refresh it.
- Once a month, spend 20 minutes in Keyword suggestions and AI Visibility choosing what to create next.

Small, consistent actions compound. The dashboard's job is to make sure the actions you pick are the ones the data says matter most.
