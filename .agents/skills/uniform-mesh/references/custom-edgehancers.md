# Custom edgehancers

> Custom edgehancers must be specifically enabled for a Uniform team; contact Uniform to request access.

Custom edgehancers let you run fully managed JavaScript at the edge whenever a data connector fetches data. The code executes inside Uniform's infrastructure, so you don't need to deploy or maintain any servers.

Use them to enrich responses, enforce business rules, or optimize performance in ways that static HTTP requests can't.

Typical scenarios:

- Real-time data shaping or transformation
- OAuth token exchange or renewal
- Request batching
- Dynamic caching operations

Since the logic executes on Uniform's edge platform, it adds only minimal latency (typically 1–2 ms).

## Hook points

Custom edgehancers expose two hooks:

| Hook | When it runs |
| :--- | :--- |
| `preRequest` | **Before** Uniform makes the HTTP request for a data resource. Modify URL, headers, inject auth tokens, or cancel the call. Uniform still performs the fetch afterward. |
| `request` | **Replaces** the default fetch logic for a data resource. Your hook performs the request, returns data, and optionally writes to Uniform's edge cache. |

## Pre-request hook

Pre-request hooks receive a batch of data-resource definitions and must return the same number of resources in the same order.

**Key characteristics**:

- Runs every time, even when the data resource is fresh in cache.
- Must not perform HTTP requests itself.
- Variable placeholders (e.g. `foo.com/${path}`) are already resolved before the hook runs.
- Ideal for computing dynamic cache keys or adding authentication data.

**Typical use cases**:

- Dynamically calculate URL parameters (using values stored in the `custom` field from the integration's UI).
- Display different content when editing versus publishing (draft vs. live data).

```typescript
import { PreRequestContext } from '@uniformdev/mesh-sdk';

export default function preRequest(context: PreRequestContext) {
  const { requests } = context;
  return requests.map(request => ({
    ...request,
    headers: { ...request.headers, 'Custom-Header': 'value' }
  }));
}
```

## Request hook

Request hooks receive a batch of data-resource definitions and must return the fetched results in the same order.

**Key characteristics**:

- Runs on cache miss only — valid cache entries bypass this hook.
- The cache key is fixed before this hook runs. For dynamic keys, adjust the request in a pre-request hook instead.
- Your hook is responsible for performing the HTTP request(s) and returning data, optionally writing to Uniform's edge cache.

**Typical use cases**:

- Batch multiple requests into a single API call (e.g. `/entities?ids=1,2,3`).
- Exchange OAuth access tokens before calling a protected API.
- Apply custom business logic such as data enrichment, filtering, or re-formatting non-JSON responses.

```typescript
import { RequestContext } from '@uniformdev/mesh-sdk';

export default async function request(context: RequestContext) {
  const { requests } = context;
  return Promise.all(
    requests.map(async (req) => {
      const response = await fetch(req.url, {
        headers: req.headers,
        method: req.method,
        body: req.body,
      });
      const data = await response.json();
      return { ...data, processedAt: new Date().toISOString() };
    })
  );
}
```

## When edgehancers execute

Custom edgehancers run in the following scenarios:

- A data type being tested in the Uniform UI
- Data resources being fetched in the composition or entry editor UI
- Data resources being fetched as part of the composition, entry, or route APIs
- Ephemeral data resources being fetched by an integration UI using the Mesh SDK's `getDataResource` function

## Deploying edgehancers

**Prerequisites**: Team Admin API key required.

Each hook is deployed and removed independently via the CLI. Add scripts like these to your `package.json`, replacing `<connectorType>` and `<dataArchetype>` with your integration's values:

```json
{
  "deploy-edgehancer:preRequest": "uniform integration definition edgehancer deploy --connectorType <connectorType> --archetype <dataArchetype> --hook preRequest ./edgehancer/dist/preRequest.mjs",
  "remove-edgehancer:preRequest": "uniform integration definition edgehancer remove --connectorType <connectorType> --archetype <dataArchetype> --hook preRequest --compatibilityDate 2025-07-15",
  "deploy-edgehancer:request": "uniform integration definition edgehancer deploy --connectorType <connectorType> --archetype <dataArchetype> --hook request ./edgehancer/dist/request.mjs",
  "remove-edgehancer:request": "uniform integration definition edgehancer remove --connectorType <connectorType> --archetype <dataArchetype> --hook request --compatibilityDate 2025-07-15"
}
```

## Testing edgehancers

```typescript
import { describe, it, expect } from 'vitest';
import request from './request';

describe('request edgehancer', () => {
  it('should transform response data', async () => {
    const mockContext = {
      requests: [{ url: 'https://api.example.com/data' }],
    };
    const result = await request(mockContext);
    expect(result[0]).toHaveProperty('processedAt');
  });
});
```

## Further reading

- [Custom edgehancers documentation](https://docs.uniform.app/docs/integrations/mesh-integrations/custom-edgehancers)
- [Example integration with edgehancers](https://github.com/uniformdev/examples/blob/main/mesh/mesh-integration/README.md#custom-edgehancers)
