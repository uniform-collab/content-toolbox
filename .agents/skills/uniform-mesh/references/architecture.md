# Architecture

## Core architecture

### Integration structure
- **Web Application**: Provides UI incorporated into Uniform dashboard and implements external system interaction logic
- **Manifest**: JSON configuration that tells Uniform how to incorporate the integration (mesh-manifest.json)
- **Locations**: Specific areas in the Uniform UI where custom interfaces are rendered

### How locations work

Each location receives two types of data:

**Value** — The main data object that your location can view and modify
- Contains the primary information your location is responsible for editing
- Example: For a Data Source location, the value contains the Data Source definition (name, configuration, settings)
- Your location can request changes to this data through the Mesh SDK

**Metadata** — Supporting information provided for context (read-only)
- Contains related data to help your location function properly
- Example: For a Data Type editor, metadata includes the current project ID and a copy of the parent Data Source
- This data cannot be modified by your location

### Technology stack requirements
- **Framework**: Next.js with page router (recommended)
- **SDK**: `@uniformdev/mesh-sdk-react` (required for React-based integrations)
- **Design System**: `@uniformdev/design-system` (required for consistent UI)
- **Uniform CLI**: `@uniformdev/cli` (required — register within a team, install within a project)
- **Language**: TypeScript (strongly recommended)

## Routing in Mesh locations

Since Mesh locations are rendered inside iframes, standard browser navigation doesn't work. The Mesh SDK provides routing helpers:

```tsx
import { useMeshLocation } from '@uniformdev/mesh-sdk-react';

const { router } = useMeshLocation<'projectTool'>();

// Navigate within current project
router.navigatePlatform(path);

// Open in a new tab
router.navigatePlatform(path, { target: '_blank' });

// Navigate to a different project
router.navigatePlatform(path, { projectId: 'target-project-id', target: '_blank' });
```

## File structure template

```
your-mesh-integration/
├── pages/
│   ├── _app.tsx
│   ├── settings.tsx
│   ├── data-source-editor.tsx
│   ├── data-type-editor.tsx
│   ├── data-resource-editor.tsx
│   └── parameter-editor.tsx
├── components/
│   └── [custom-components].tsx
├── lib/
│   ├── types.ts
│   ├── utils.ts
│   └── api-client.ts
├── edgehancer/ (optional)
│   ├── preRequest.ts
│   ├── request.ts
│   └── *.test.ts
├── mesh-manifest.json
├── package.json
└── tsconfig.json
```

## Required dependencies

```json
{
  "dependencies": {
    "@uniformdev/mesh-sdk-react": "latest",
    "@uniformdev/design-system": "latest",
    "next": "latest",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

## Design system resources

- [Uniform Design System Storybook](https://design.uniform.app/)
- [React Mesh SDK Storybook](https://storybook.mesh.uniform.app/)
- [React Mesh SDK component reference](https://sdk.uniform.app/design-system)

## Starter kit

Complete examples: [Mesh integration starter kit](https://github.com/uniformdev/examples/tree/main/mesh/mesh-integration)
