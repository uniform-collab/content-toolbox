---
name: uniform-mesh
description: Uniform Mesh integration development covering custom data connectors, parameter editors, asset library extensions, and dashboard tools. Use when building a custom Mesh integration that extends the Uniform UI.
license: MIT
metadata:
  author: uniformdev
  version: "0.0.1"
---

# Uniform Mesh integrations

Uniform Mesh is the integration framework for connecting external systems to Uniform. Build a custom Mesh integration when you need to integrate a system Uniform doesn't yet support, or extend the Uniform UI with custom editors, tools, or asset providers.

## When to apply

Reference these guidelines when:
- Building a custom Mesh integration from scratch
- Connecting Uniform to an external data source (CMS, API, database)
- Creating custom parameter editors for Canvas components
- Extending the Asset Library with external providers
- Adding custom tools to the Uniform dashboard or project navigation
- Implementing custom edgehancers for server-side data processing
- Deploying and registering integrations with a Uniform team

## Technology stack

- **Framework**: Next.js with page router (recommended)
- **SDK**: `@uniformdev/mesh-sdk-react`
- **Design System**: `@uniformdev/design-system` (required for consistent UI)
- **CLI**: `@uniformdev/cli` (devDependency, required for registration)
- **Language**: TypeScript (strongly recommended)

## Key principles

### Every integration has three parts

1. **Web application** — UI rendered in iframes within the Uniform dashboard
2. **Manifest** (`mesh-manifest.json`) — JSON configuration describing locations and capabilities
3. **Locations** — Specific areas in the Uniform UI where your custom interfaces render

### Locations receive value and metadata

Each location gets two types of data:
- **Value** — The main data object your location can view and modify
- **Metadata** — Read-only context information (project ID, parent data source, etc.)

### Register before testing

An integration must be registered to a team and installed to a project before it can be tested in the Uniform dashboard. Run `npm run register-to-team` then `npm run install-to-project`.

### Store secrets in data sources, not settings or data types

Data source values (headers, query parameters, variables) are encrypted. Settings and data type values are visible to all project users. Never store API keys or tokens outside of data sources.

### Only generate what was requested

Do not add extra code, locations, or features to an integration beyond what was explicitly asked for. Keep implementations minimal and focused.

## Getting started

```bash
npx @uniformdev/cli@latest new-integration
```

The CLI scaffolds the project, configures API keys, and registers the integration automatically.

## Resources

See `references/` for detailed guidance:
- [Architecture](references/architecture.md) — Core architecture, locations overview, value/metadata model
- [Manifest](references/manifest.md) — Manifest structure, required fields, location configurations
- [Locations](references/locations.md) — All location type implementations with code examples
- [Deployment](references/deployment.md) — Production deployment, hosting requirements, security, testing
- [Custom edgehancers](references/custom-edgehancers.md) — Edge-side JavaScript hooks for data transformation, caching, and auth
