# SEO & AI Insights — Uniform Mesh integration

A custom Mesh integration that adds an SEO + AI visibility dashboard to Uniform projects,
powered by DataForSEO through Uniform's own metered account (customers never handle API keys).

## What's inside

| Mesh location | Route | Purpose |
|---|---|---|
| `settings` | `/settings` | Per-project targeting config: domain, brand aliases, competitors, tracked keywords, AI topics, market, snapshot cadence. Saved via `useMeshLocation('settings').setValue` into Uniform's integration settings storage. Includes a qualitative usage indicator (no raw prices). |
| `projectTools` | `/seo-dashboard` | The dashboard: Overview, AI Visibility, Keywords, Keyword suggestions, Decaying content. Reads settings from `metadata.settings`; renders nothing until a target domain is configured, then loads live data from the app's own `/api/report` DataForSEO proxy (cached server-side). `/seo-dashboard/preview` and `/settings/preview` render sample data for local UI work. |
| `install` | — | Install dialog copy in `mesh-manifest.json`. |

Built with Next.js (App Router), `@uniformdev/design-system`, and `@uniformdev/mesh-sdk-react`.

## Documentation

The written user guide lives in [`docs/user-guide.md`](docs/user-guide.md). The **in-app** copy
(per-tab tooltips + the slide-over guide panel) is the single place to edit that help text and
lives in [`app/lib/guide.ts`](app/lib/guide.ts) — it's plain data (no JSX), so it can later be
sourced from a Uniform entry instead of code without touching components. Keep `docs/user-guide.md`
in step with it.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # add your DataForSEO login/password
npm run dev                        # serves on http://localhost:9000 (matches manifest baseLocationUrl)
```

## Live data: DataForSEO proxy

The browser never talks to DataForSEO and never sees credentials. The Next.js app exposes
two server routes that hold the credentials (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`
from `.env.local`) and do the mapping:

| Route | Purpose | DataForSEO endpoints |
|---|---|---|
| `POST /api/report` | Full dashboard report for the configured domain | Labs `domain_rank_overview`, `historical_rank_overview`, `ranked_keywords`; `backlinks/summary` (optional); AI Optimization `llm_mentions/target_metrics`, `llm_mentions/historical`, `llm_mentions/top_mentioned_pages`, `llm_mentions/search_mentions`, `ai_keyword_data/keywords_search_volume` |
| `POST /api/suggestions` | Keyword discovery (all four algorithms) | Labs `related_keywords`, `keyword_suggestions`, `keyword_ideas`, `keywords_for_site` |

**AI visibility** uses the LLM Mentions database (platforms: Google AI Overviews and
ChatGPT). All metrics are domain-based — brand-name keyword matching proved too noisy
for generic names (e.g. "Uniform"): a *mention* = an AI answer where your domain appears
(sources or search results); a *citation* = your domain appears among an answer's cited
sources; *share of voice* = your domain's monthly mentions vs the configured competitors.
Brand aliases in settings are reserved for future LLM-response analysis. Two further
cards: **Topic demand in AI search** (AI search volume + 12-month trend for the AI topics
configured in settings, via `ai_keyword_data`) and **Prompts that surface you** (the
actual questions people ask AI assistants where your domain appears, with platform,
AI search volume, and whether one of your pages is cited — via `search_mentions`).

**Caching:** every upstream call is cached server-side (in-memory + JSON files under
`.cache/seo-insights/`, TTL `DATAFORSEO_CACHE_TTL_HOURS`, default 24h) — see
`app/lib/server/cache.ts`. Repeat dashboard visits are served from cache; only the
header's **Refresh data** button bypasses it and spends DataForSEO quota again. On
serverless hosts the file layer is ephemeral — promote it to KV/Redis behind the same
interface for production.

**Honesty policy:** metrics the source can't provide yet are returned as `null`/empty and
listed in `meta.unavailable`; the UI hides those cards and shows a note instead of
inventing numbers. Current gaps and their intended sources:

- **Site health** → DataForSEO OnPage API (requires crawl tasks)
- **Keyword gap** → Labs `domain_intersection` against the configured competitors
- **AI search volume in the keyword tables** → AI Optimization `ai_keyword_data`
- **Sentiment + per-topic AI breakdown** → needs LLM-response analysis beyond the mentions DB
- **Gemini/Perplexity/Claude coverage** → the LLM Mentions DB covers Google AI Overviews +
  ChatGPT; other platforms would use `ai_optimization/*/llm_responses` probing

**Credentials, long term:** `app/lib/server/dataforseo.ts` is the single seam that talks
to DataForSEO. Swapping the env-var credentials for a Uniform-operated central account
(per-project metering, no customer keys) only touches that file.

**Actionable insights:** when the dashboard runs inside a Uniform project, the report is
requested with the `projectId` from Mesh metadata, and each decaying page's
**Refresh in Uniform** button deep-links to that project's Canvas filtered by the page
path. Resolving a page URL to its exact composition/entry (via the project map API) is
the designed next step.

## Register with Uniform (Team admin required)

```bash
npm run register-to-team      # registers ./mesh-manifest.json at the team level
npm run install-to-project    # installs it into a project (CLI prompts / env-driven)
```

Or via the dashboard: `Settings > Custom integrations > Add integration`, paste `mesh-manifest.json`.

After installing in a project:
1. Open the integration's **settings**, set the target domain and lists, save.
2. Find **SEO & AI Insights** in the project's **Tools** menu.

## Deploying

The app now includes server API routes (`/api/report`, `/api/suggestions`), so deploy to a
host that runs Next.js server-side (Vercel, Netlify, Node) — a static export is no longer
enough. Set `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` in the host's environment, then update
`baseLocationUrl` and the icon URLs in `mesh-manifest.json` to the deployed origin and
re-register. Keeping separate manifest files per environment (dev/prod) is recommended.

## Testing on a Uniform team

1. `cp .env.local.example .env.local` and fill in the DataForSEO credentials, then `npm run dev`.
2. Authenticate the Uniform CLI (`npx uniform login`, or set `UNIFORM_API_KEY` — team admin).
3. `npm run register-to-team` to register `mesh-manifest.json` at the team level
   (or paste the manifest under **Settings → Custom integrations → Add integration**).
4. `npm run install-to-project` (or install from the project's Integrations page).
5. Open the integration's **settings** in the project, set the target domain, and save.
6. Open **SEO & AI Insights** under the project's **Tools** menu — the first load fetches
   from DataForSEO (a few seconds), subsequent loads come from the cache.

Note: `baseLocationUrl` is `http://localhost:9000`, so the dashboard loads from your machine —
fine for your own testing; deploy over HTTPS before sharing with teammates.

## Next steps

1. **Exact composition/entry links**: resolve a decaying page's URL to its composition or
   entry via Uniform's project map API (server-side, `UNIFORM_API_KEY`), replacing the
   Canvas-search deep link.
2. **AI visibility depth**: per-topic breakdown and sentiment (LLM-response analysis), plus
   Gemini/Perplexity/Claude coverage via `ai_optimization/*/llm_responses`.
3. **Snapshots**: a scheduled job (cadence from settings) that persists reports as
   time-series snapshots, so deltas span real history instead of DataForSEO's monthly data.
4. **Central credentials**: move the DataForSEO account behind a Uniform-operated service and
   verify project identity server-side (don't trust a projectId from the iframe payload alone).

## Notes

- Price hints in the UI are intentionally subdued: the settings screen shows a qualitative
  usage indicator, not inline dollar amounts.
