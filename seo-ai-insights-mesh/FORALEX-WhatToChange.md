# SEO & AI Insights Mesh integration — production readiness plan

## Context
The Mesh app (Next.js 16, `@uniformdev/mesh-sdk-react` 20.68.0) works well; goal is go-live hardening. Reviewed the full codebase against Uniform's Mesh docs (manifest/locations/deployment/edgehancers). User decisions: deploy on **Vercel**; **keep current LLM models** (fidelity over cost — savings come from caps/TTLs instead); **defer full API auth** but document the proper approach.

Answered along the way: folder is 2.2GB because of `node_modules` (1.3GB — mostly `@react-icons` 591MB + Next.js binaries, pulled in by the Uniform design system; dev-only, doesn't deploy). LLM calls already go through DataForSEO's `ai_optimization/*/llm_responses/live` (no direct provider keys); models stay as-is per user choice.

## Key findings driving the plan
- Cache + refresh-gate stamps are in-memory + local JSON files ([cache.ts](app/lib/server/cache.ts)) — **ephemeral on Vercel**, so TTLs/gates/caps don't hold across cold starts.
- No per-project metering on `/api/suggestions`; no fetch timeouts in [dataforseo.ts](app/lib/server/dataforseo.ts).
- Hardcoded fallback refresh password `"Unis3arc4"` at [refresh/route.ts:26](app/api/refresh/route.ts).
- [mesh-manifest.json](mesh-manifest.json) points at `localhost:9000` (baseLocationUrl + 3 icon URLs); Uniform requires HTTPS in production and recommends separate dev/prod manifests.
- `projectId` comes from mesh `metadata` in [tool.tsx](app/seo-dashboard/tool.tsx) and is forwarded in POST bodies but never verified server-side (auth deferred — documented instead).
- Server trusts some client arrays without clamping; `suggestions` route accepts a client `refresh: true` cache-bypass flag.
- Stale doc comments in [prompt-insights.ts](app/lib/server/prompt-insights.ts) (old model ids) and ai-visibility coverage notes.

## Changes

### 1. Durable store for Vercel (Upstash Redis) — `app/lib/server/cache.ts`
- Add `@upstash/redis`; when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, use Redis for cache entries, refresh stamps, and the new weekly counter (native TTL via `EX`). Keep the existing memory+file layers as the dev/local fallback behind the same `cached()` / `readRefreshStamp()` / `writeRefreshStamp()` interface — no caller changes.
- Update `.env.local.example` and README with the two env vars (provisioned via Vercel Marketplace → Upstash).

### 2. Weekly cap: 100 keyword-suggestion searches per project per week
- New helper in cache.ts (or `usage.ts`): `incrementWeeklyUsage(scope, key, limit)` → atomic Redis `INCR` on `usage:suggestions:{projectId}:{isoWeek}` with expiry; file/memory fallback locally. ISO-week key (e.g. `2026-W30`) so the window resets Mondays.
- `/api/suggestions`: require `projectId` in body (client already has it in tool.tsx — thread it through [keyword-suggestions-tab.tsx](app/components/dashboard/tabs/keyword-suggestions-tab.tsx) and the fetch call). Count **only cache-miss searches** (a cached repeat shouldn't burn quota). Over limit → `429 { error: "weekly_cap", remaining: 0, resetsAt }`.
- Response always includes `{ remaining, limit }`; UI shows "N of 100 weekly searches left" near the search button and a friendly Callout at 0 with the reset date. Cap constant `WEEKLY_SUGGESTIONS_LIMIT = 100` in settings.ts, overridable via `SUGGESTIONS_WEEKLY_LIMIT` env.
- Fallback when `projectId` missing: key by normalized domain. (Note in code: cap is a cost harness, not a security boundary, until projectId verification lands — see §5 doc.)

### 3. API hardening quick wins
- **Remove the hardcoded password fallback** in refresh/route.ts: if `REFRESH_PASSWORD` is unset, in-interval force refresh is simply unavailable (403 with explanatory message) — fail closed, no secret in source.
- **Fetch timeout** in `dfsPost` (dataforseo.ts): `AbortSignal.timeout()` — 60s default, 150s for `llm_responses` paths; map aborts to a clear `DataForSeoError`.
- **Server-side input clamps** shared by report/refresh/prompt-insights routes: reuse the `MAX_*` constants from [settings.ts](app/lib/settings.ts) (competitors 5, trackedKeywords 200, aiTopics 25, prompts 10, ignoredTerms 50) + per-string length caps; clamp silently rather than 400.
- **Ignore client `refresh` flag** in `/api/suggestions` (cache-bypass shouldn't be caller-controlled; the gated `/api/refresh` is the only bypass path).

### 4. Production manifest + deployment
- Add `mesh-manifest.prod.json`: same as dev but `baseLocationUrl` + `logoIconUrl`/`badgeIconUrl`/`projectTools[].iconUrl` pointing at the deployed HTTPS URL (placeholder `https://YOUR-APP.vercel.app`, noted in README). Add `register-to-team:prod` script.
- `vercel.json` (or route-level check): confirm `maxDuration = 300` on prompt-insights/refresh is within the Vercel plan's limit; document that Pro plan is needed for 300s, otherwise lower to 60s and note the constraint.
- README deployment section: Vercel steps, env vars (`DATAFORSEO_LOGIN/PASSWORD`, `REFRESH_PASSWORD`, `UPSTASH_*`, optional `DATAFORSEO_CACHE_TTL_HOURS`, `SUGGESTIONS_WEEKLY_LIMIT`, `NEXT_PUBLIC_LOGO_DEV_TOKEN`), register/install commands.

### 5. Security follow-up doc (implementation deferred by user)
- `docs/production-security.md` describing the proper design: server-side verification of `projectId` using a Uniform API key (check integration installed + requested domain matches that project's saved integration settings, cached ~5 min), layered with Origin/Referer checks and per-IP rate limiting; why client-shipped secrets can't authenticate an iframe; where the middleware would live. Explicitly list current exposure (open routes can spend DataForSEO credits) so go-live risk is a conscious decision.

### 6. Cleanups
- Fix stale model-id comment block in prompt-insights.ts (lines ~6–9 vs actual models at 59–104) and the contradictory AI-visibility coverage comments in [ai-visibility.ts](app/lib/server/ai-visibility.ts).
- Load mock data only in the preview page (dynamic import or moving the `mock-data.ts` import out of `dashboard.tsx`) so it's tree-shaken from the production bundle; drop the `console.log` in settings/preview.
- README: refresh the AI-visibility platform coverage table to match code.

## Files touched (main)
`app/lib/server/cache.ts` (+ maybe new `usage.ts`), `app/api/suggestions/route.ts`, `app/api/refresh/route.ts`, `app/api/report/route.ts`, `app/api/prompt-insights/route.ts`, `app/lib/server/dataforseo.ts`, `app/components/dashboard/tabs/keyword-suggestions-tab.tsx`, `app/seo-dashboard/tool.tsx` (thread projectId), `app/lib/settings.ts` (cap constant), `mesh-manifest.prod.json` (new), `docs/production-security.md` (new), `.env.local.example`, `README.md`, `package.json` (dep + script).

## Verification
1. `npm run build` clean; `npm run dev` and open `/seo-dashboard/preview` + `/settings/preview` in the browser pane — dashboards render, no console errors.
2. Cap: temporarily set `SUGGESTIONS_WEEKLY_LIMIT=3` locally, hit `/api/suggestions` with curl 4× with distinct seeds → 4th returns 429 with reset date; repeat an identical seed → served from cache, counter unchanged; UI shows remaining count.
3. Refresh gate: with `REFRESH_PASSWORD` unset, in-interval refresh returns the fail-closed 403; with it set, password path works.
4. Timeout: unit-style check that `dfsPost` aborts (point at a black-hole URL with a 2s test timeout).
5. Redis path: if the user provisions Upstash before testing, verify counter/cache keys appear; otherwise verified via the file fallback with the interface swap covered by reading both code paths.
6. Manifest: `npx uniform integration definition register ./mesh-manifest.prod.json --dry-run`-style sanity (or JSON diff review) — actual registration left to the user at deploy time.