# Content Toolbox — Uniform Mesh integration

A [Uniform Mesh](https://docs.uniform.app/docs/integrations/mesh-integrations) integration that adds a **Content Ops Toolkit** to the Tools section of your Uniform project. It lets editors export and import the **project map** and **redirects** as CSV — with every API call made **as the signed-in dashboard user** via [identity delegation](https://docs.uniform.app/docs/integrations/mesh-integrations/identity-delegation), so changes are attributed to real people and run with their permissions. No static service-account API keys anywhere.

Built with Next.js (pages router), the Uniform design system, and `@uniformdev/mesh-sdk` 20.72+.

## Features

**Project map**

- Export every node to CSV: name, type, path, description, order, node ID, composition ID/name/type, and live **publish status** (Published / Modified / Draft), computed by comparing draft and published composition timestamps.
- Optionally include any **composition parameters** as extra CSV columns — searchable multi-select with removable chips and an **SEO set / All / Clear** preset row.
- **Export preview**: a collapsible, paginated table filterable by name/path, node type, and publish status. The table mirrors the CSV — all 10 base columns plus selected parameter columns with their live values — and every column header has a checkbox to exclude that column from the export (with a hint when a column required for re-import is unchecked).
- Import a modified export back through a drop zone: rows are matched by Node ID (or by path), diffed field-by-field against the live project map, and classified as **update / create / error / unchanged** with a human-readable change description per row. Only actual changes are written (batched to respect the API's 5-nodes-per-PUT limit); error rows are skipped with their reasons shown.

**Redirects**

- Export all redirects with source, target, status code, and all boolean flags — filterable and paginated.
- Import from CSV through the same drop-zone → diff preview → apply flow: rows with an ID are diffed against the existing redirect and shown as updates ("Status code: 302 → 301"), rows without an ID as creates. Missing URLs block a row; unusual status codes only warn. A success/error report follows the import.

**Identity delegation (no shared API keys)**

- The dashboard hands the iframe a ~10-second session token; the server exchanges it (using the integration secret, which never reaches the browser) for a user-scoped bearer token.
- The token pair lives in an encrypted `HttpOnly; Secure; SameSite=None; Partitioned` cookie and is proactively refreshed near expiry.
- History logs show the actual editor as the actor, and authorization runs against their Uniform role.



## Quick start



### Prerequisites

- Node.js 20+ and pnpm
- A Uniform team + project, and a **team admin API key** (only for CLI registration)
- **Identity delegation enabled** on the integration definition (Team → Settings → Custom Integrations) — the integration app secret is issued there once delegation is enabled



### 1. Install and configure

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`:


| Variable                                                     | Purpose                                                                                                                                       |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `UNIFORM_API_KEY` / `UNIFORM_TEAM_ID` / `UNIFORM_PROJECT_ID` | Uniform CLI auth for the register/install scripts only — not used at runtime                                                                  |
| `UNIFORM_API_HOST`                                           | `https://uniform.app` (US) or `https://eu.uniform.app` (EU)                                                                                   |
| `UNIFORM_INTEGRATION_ID`                                     | Integration definition ID (UUID) from the dashboard                                                                                           |
| `UNIFORM_INTEGRATION_SECRET`                                 | Integration app secret — server only, never shipped to the browser                                                                            |
| `MESH_SESSION_SECRET`                                        | ≥32-byte random string that encrypts the session cookie. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MESH_ALLOWED_ORIGINS`                                       | Comma-separated origins allowed to call state-changing routes, e.g. `https://localhost:9000`                                                  |




### 2. Register the integration

```bash
pnpm register-to-team      # deploys mesh-manifest.json to your team
pnpm install-to-project    # enables it on your project
```

Or paste `mesh-manifest.json` into Team → Settings → Custom Integrations manually. The manifest must keep `"identityDelegation": true` — the app secret is only issued for delegation-enabled integrations.

### 3. Run over HTTPS

Delegation cookies are `Secure; SameSite=None`, and browsers refuse `Secure` cookies on plain `http://` — **including localhost**. The dev script therefore runs with TLS:

```bash
pnpm dev        # next dev --webpack --experimental-https on https://localhost:9000
```

Open `https://localhost:9000` once in your browser and accept the self-signed certificate (otherwise the dashboard iframe fails silently), then open your project → **Tools → Content Ops Toolkit**.

## Deploy to production (AWS or similar)

This is **not** a static site. Identity delegation runs on the server (`/api/session`, `/api/status`, `/api/uniform/*`): the browser never sees the integration secret or the user token. You need a **Node.js 20+ process** behind **HTTPS**, not S3 / CloudFront static hosting.

Any host that can run `next start` works — AWS App Runner, ECS/Fargate + ALB, Elastic Beanstalk, EC2, Amplify Hosting (SSR), or a VM at another cloud. The Uniform dashboard loads the app in an iframe, so the browser must be able to reach both `https://uniform.app` (or `https://eu.uniform.app`) and your public app URL.

Work from `content-toolbox/`.

### 1. What the host must do

1. Install and build: `pnpm install --frozen-lockfile && pnpm build`
2. Start the server: `pnpm start` (binds to **port 9000** — map your load balancer / container port to `9000`, or run `pnpm exec next start -p $PORT` if the platform injects `PORT`)
3. Terminate TLS in front of it (ALB, CloudFront, App Runner custom domain, nginx, etc.). Delegation cookies are `Secure; SameSite=None; Partitioned` — browsers will not send them on `http://`.
4. If you put CloudFront / a WAF / extra response headers in front of the app, do **not** send `X-Frame-Options: DENY` or a CSP that blocks framing. The dashboard embeds this app; allow `frame-ancestors https://uniform.app https://*.uniform.app`. Do not strip `Cookie` / `Set-Cookie`.
5. If you run more than one instance behind a load balancer, give **every instance the same** `MESH_SESSION_SECRET`. The session cookie is encrypted on the server; a different secret on another replica looks like "no session". Sticky sessions are not required.

### 2. Environment variables on the host

Set these as **runtime** secrets on the service (ECS task definition, App Runner, Elastic Beanstalk, etc.). Do not bake them into the image. `UNIFORM_API_KEY` / `UNIFORM_TEAM_ID` / `UNIFORM_PROJECT_ID` are **CLI-only** (register/install on your laptop) — they are not used at runtime and should not be on the server.

| Variable | Required on the host | Purpose |
| --- | --- | --- |
| `UNIFORM_API_HOST` | yes | `https://uniform.app` (US) or `https://eu.uniform.app` (EU). Must match the team's region. |
| `UNIFORM_INTEGRATION_ID` | yes | Integration definition UUID from Team → Settings → Custom Integrations → Credentials. |
| `UNIFORM_INTEGRATION_SECRET` | yes | Integration app secret. Server only. Shown **once** when you generate/rotate it in the dashboard. |
| `MESH_SESSION_SECRET` | yes | ≥32-byte random string that encrypts the session cookie. Generate once and keep it stable: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `MESH_ALLOWED_ORIGINS` | yes | Comma-separated **public HTTPS origin(s) of this app** (scheme + host, no path). Example: `https://content-ops.example.com`. If users can hit both a custom domain and the AWS default hostname, list both. A mismatch here is a `403` on every POST. |

Example production values (replace the host):

```
UNIFORM_API_HOST=https://uniform.app
UNIFORM_INTEGRATION_ID=<uuid-from-dashboard>
UNIFORM_INTEGRATION_SECRET=<shown-once-on-generate>
MESH_SESSION_SECRET=<64-hex-chars>
MESH_ALLOWED_ORIGINS=https://content-ops.example.com
```

`MESH_ALLOWED_ORIGINS` is the origin of **this** Mesh app (the iframe), not `https://uniform.app`. The browser POSTs from the iframe to `/api/session` on the same host.

### 3. Point Uniform at the deployed URLs (`mesh-manifest.prod.json`)

Uniform does not discover your host. The integration definition stores the URLs. This repo keeps two manifests:

| File | When to register |
| --- | --- |
| `mesh-manifest.json` | Local HTTPS (`https://localhost:9000`) |
| `mesh-manifest.prod.json` | Deployed host |

Edit `mesh-manifest.prod.json` and replace every occurrence of the old host with your public origin (no trailing slash). The fields that must be absolute URLs:

| Field | Example after deploy |
| --- | --- |
| `baseLocationUrl` | `https://content-ops.example.com` |
| `logoIconUrl` | `https://content-ops.example.com/tools-badge.png` |
| `badgeIconUrl` | `https://content-ops.example.com/tools-badge.png` |
| `locations.projectTools[].iconUrl` | `https://content-ops.example.com/tools-badge.png` |

Leave these as-is unless you change the app routes:

- `locations.settings.url` → `/`
- `locations.projectTools[].url` → `/content-ops` (resolved against `baseLocationUrl`)
- `"type": "content-toolbox"` (this is the integration type id used by `pnpm install-to-project`)
- `"identityDelegation": true` (required; the app secret is only issued when this is on)

Then **re-register** the same integration definition so Uniform starts loading the iframe from the new host. From `content-toolbox/`, with `UNIFORM_API_KEY` and `UNIFORM_TEAM_ID` in your local `.env`:

```bash
pnpm exec uniform integration definition register ./mesh-manifest.prod.json
```

Or paste the updated JSON into Team → Settings → Custom Integrations. Re-registering updates the existing `content-toolbox` definition in place — you do **not** need to uninstall/reinstall the project if it is already installed.

After that: open the public app URL once in the browser (confirm the cert is trusted), then open the project → **Tools → Content Ops Toolkit**. If the iframe is blank or stuck on "Connecting…", see [Troubleshooting](#troubleshooting).

## CSV formats



### Project map export/import


| Column                                  | Import behavior                                                      |
| --------------------------------------- | -------------------------------------------------------------------- |
| Node Name                               | required                                                             |
| Node Type                               | required — `composition` or `placeholder`                            |
| Path                                    | required — must start with `/`                                       |
| Description, Order                      | optional                                                             |
| Node ID                                 | optional — rows with an ID update that node; without, upsert by path |
| Composition ID                          | optional — binds the node to a composition                           |
| Composition Name / Type, Publish Status | export-only, ignored on import                                       |
| `Param: <key>` columns                  | export-only, ignored on import                                       |




### Redirects export/import


| Column                                                                                                           | Import behavior                                                        |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Source URL, Target URL                                                                                           | required                                                               |
| Status Code                                                                                                      | defaults to `301`; values outside 301/302/307/308 warn but don't block |
| ID                                                                                                               | optional — update existing vs. create new                              |
| Retain Query String, Must Match Domain, Preserve Incoming Protocol, Preserve Incoming Domain, Merge Query String | optional booleans (`true`/`false`, `1`/`0`, `yes`/`no`)                |


Header matching is tolerant (case- and punctuation-insensitive), so a re-uploaded export always round-trips.

## Project structure

```
pages/
  content-ops.tsx            # projectTool location: DelegationProvider + gate + toolkit
  dev-preview.tsx            # dev-only: toolkit with mocked data, outside the dashboard iframe
  api/
    session.ts               # exchanges the Mesh session token, sets the sealed cookie
    status.ts                # active | expired | none (cookie is HttpOnly, so JS asks here)
    uniform/
      project-map.ts         # GET export payload / POST upsert nodes (delegated)
      redirects.ts           # GET all redirects / POST upsert redirects (delegated)
components/
  content-ops-toolkit.tsx    # tabbed shell (design-system Tabs + node/redirect counters)
  project-map-panel.tsx      # export/import UI for the project map
  redirects-panel.tsx        # export/import UI for redirects
  tool-shared.tsx, ui.tsx    # CSV drop zone, diff preview, pagination, layout primitives
lib/
  uniform.ts                 # server-side Platform API client (bearer auth, paging, batching)
  delegationSession.ts       # cookie read/unseal/refresh helpers
  delegationSessionCallbacks.ts  # browser-side checkActive / onSessionToken
  csrf.ts                    # x-mesh-csrf + origin allow-list guard
  csv.ts                     # dependency-free RFC 4180-ish CSV parse/serialize
mesh-manifest.json           # local integration manifest (https://localhost:9000)
mesh-manifest.prod.json      # production manifest — update URLs to the deployed host, then re-register
```

## Security notes

- The integration secret and delegation tokens exist **only on the server**; the browser holds an encrypted, unreadable cookie.
- The delegation token carries the **user's full authority** — the routes here call only the project-map, canvas, and redirect APIs the toolkit needs.
- All state-changing routes verify the `x-mesh-csrf` header **and** an `Origin`/`Referer` allow-list (`MESH_ALLOWED_ORIGINS`), because `SameSite=None` removes the browser's default CSRF protection.
- Do not weaken the cookie flags for local development — run HTTPS locally instead.

## Scripts


| Script                                                      | What it does                                                                                                                                              |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                                  | HTTPS dev server on port 9000 (webpack mode)                                                                                                              |
| `pnpm dev:http`                                             | Plain HTTP dev server — delegation will **not** work; useful for UI-only work. Open `/dev-preview` for the toolkit with mocked data (no dashboard needed) |
| `pnpm build` / `pnpm start`                                 | Production build / serve (`next start` on port 9000)                                                                                                      |
| `pnpm register-to-team` / `pnpm install-to-project`         | Register the **local** manifest (`mesh-manifest.json`) / enable on a project. For production URLs: `pnpm exec uniform integration definition register ./mesh-manifest.prod.json` |
| `pnpm unregister-from-team` / `pnpm uninstall-from-project` | Tear down                                                                                                                                                 |




## Troubleshooting


| Symptom                              | Likely cause                                                                                                                                   |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Stuck on "Connecting to Uniform…"    | Cookie set but not sent back — you're on `http://`, or the self-signed cert isn't trusted yet. Serve HTTPS and open the app URL once directly. |
| "Identity delegation is not enabled" | `sdk.getSessionToken()` returned nothing — enable delegation on the integration definition and re-register the manifest.                       |
| `POST /api/session` → 500            | Wrong `UNIFORM_INTEGRATION_ID`/`SECRET`, or `UNIFORM_API_HOST` doesn't match your team's region.                                               |
| API routes → 403                     | Request origin isn't in `MESH_ALLOWED_ORIGINS` (after deploy, this must be the public HTTPS origin, not `https://localhost:9000`), or the `x-mesh-csrf` header is missing. |
| API routes → 401                     | No active delegation session — reload the tool so the provider re-runs the exchange. If this happens only on one replica, `MESH_SESSION_SECRET` is not shared across instances. |
| Iframe blank / refused to connect    | Manifest still points at localhost or the old host, TLS is broken, or a proxy sent `X-Frame-Options: DENY` / a CSP that blocks `uniform.app`. |
| Toolkit still loads localhost        | You rebuilt the app but did not re-register `mesh-manifest.prod.json` (or paste it in the dashboard). Uniform caches the URLs on the integration definition, not in this repo. |


