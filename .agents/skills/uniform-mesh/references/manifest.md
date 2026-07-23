# Manifest

An integration is defined by a JSON manifest that declares metadata about the integration and which [locations](locations.md) it implements. See the [reference manifest](https://github.com/uniformdev/examples/blob/main/mesh/mesh-integration/mesh-manifest.reference.json) for the full allowed schema.

## Purpose

The manifest tells Uniform:

- What the integration is (name, icons, category)
- Where the integration is hosted (`baseLocationUrl`)
- Which locations the integration implements and how to reach them (URLs)

## Structure

```json
{
  "type": "your-integration-type",
  "displayName": "Your Integration Name",
  "baseLocationUrl": "http://localhost:9000",
  "logoIconUrl": "https://example.com/logo.png",
  "badgeIconUrl": "https://example.com/badge.png",
  "category": "content|ai|analytics|commerce",
  "scopes": ["user:read"],
  "locations": {}
}
```

## Top-level fields

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Unique identifier for the integration. Must be globally unique across all integrations. |
| `displayName` | Yes | Human-readable name shown in the Uniform UI. |
| `baseLocationUrl` | Yes | Base URL where the integration is hosted. All location URLs are resolved relative to this. |
| `logoIconUrl` | No | Logo displayed in the integrations marketplace. |
| `badgeIconUrl` | No | Smaller icon used as a badge on parameters and data types. |
| `category` | No | Integration category (`content`, `ai`, `analytics`, `commerce`, etc.). |
| `scopes` | No | Required OAuth scopes (e.g., `["user:read"]`). |
| `locations` | Yes | Object defining which integration points the integration provides. |

## Locations

The `locations` object is the core of the manifest. Each key corresponds to an integration point in the Uniform dashboard. For manifest syntax, implementation details, and code examples for each location, see [locations.md](locations.md).

| Location key | Description |
|---|---|
| `install` | Description and docs link shown on the install dialog |
| `settings` | Integration-wide configuration UI |
| `dataConnectors` | Array of data connector definitions (each containing data source, data type, and data resource editors) |
| `canvas.parameterTypes` | Custom parameter type editors for components and entry fields |
| `canvas.editorTools` | Custom tools in the visual editor side rail |
| `canvas.personalization.selectionAlgorithms` | Custom personalization variation selection algorithms |
| `assetLibrary` | Asset browsing and selection from external DAM systems |
| `projectTools` | Full custom pages in the Tools navigation section |
| `dashboardTools` | Custom tabs on the project dashboard |

## URL resolution

All location URLs are resolved relative to `baseLocationUrl`. For example, if `baseLocationUrl` is `http://localhost:9000` and a location URL is `/settings`, the iframe will load `http://localhost:9000/settings`.

Sub-locations (named dialogs opened from a parent location) use `../` relative URLs that resolve relative to the parent location's URL.

## Multiple manifests for different environments

Keep separate manifest files per environment so that development, staging, and production registrations don't collide. Append a postfix to both the `type` and `displayName` to make each environment's integration clearly distinguishable in the Uniform UI.

| Environment | File | `type` | `baseLocationUrl` |
|---|---|---|---|
| Development | `mesh-manifest.dev.json` | `your-integration-type-dev` | `http://localhost:9000` |
| Staging | `mesh-manifest.staging.json` | `your-integration-type-staging` | `https://staging.yourapp.com` |
| Production | `mesh-manifest.json` | `your-integration-type` | `https://yourapp.com` |

Apply the same postfix to `displayName` (e.g. "Your Integration (Dev)", "Your Integration (Staging)") so team members can tell them apart at a glance.

Register each manifest separately:

```bash
uniform integration register --manifest mesh-manifest.dev.json
uniform integration register --manifest mesh-manifest.staging.json
uniform integration register --manifest mesh-manifest.json
```

This lets developers work against `localhost` without affecting the production integration, and lets QA validate on a staging URL before promoting to production.

## Registration and installation

**Team Admin API key required to register an integration.**

These commands require the following environment variables:

```bash
UNIFORM_API_KEY=your_api_key_here
UNIFORM_TEAM_ID=your_team_id_here
UNIFORM_PROJECT_ID=your_project_id_here
```

The API key must be a [team admin API key](https://docs.uniform.app/docs/guides/api-keys#team-admin-api-keys).

### 1. Register to team

```bash
uniform integration register --manifest mesh-manifest.json
```

### 2. Install to project

```bash
uniform integration install your-integration-type
```

### Standard npm scripts

```json
{
  "register-to-team": "uniform integration definition register ./mesh-manifest.json",
  "unregister-from-team": "uniform integration definition remove your-integration-type",
  "install-to-project": "uniform integration install your-integration-type",
  "uninstall-from-project": "uniform integration uninstall your-integration-type"
}
```