/**
 * Server-side client for the Uniform Platform API.
 * The API key stays on the server — never expose it to the browser.
 *
 * The project ID is passed per request (the Mesh project tool sends the
 * current project's ID from its location metadata), with an optional
 * UNIFORM_PROJECT_ID environment variable fallback for local testing.
 */

const BASE_URL = "https://uniform.app"

function getApiKey(): string {
  const apiKey = process.env.UNIFORM_API_KEY
  if (!apiKey) {
    throw new Error("Missing UNIFORM_API_KEY environment variable.")
  }
  return apiKey
}

export function resolveProjectId(candidate: unknown): string {
  const projectId =
    (typeof candidate === "string" && candidate.trim()) ||
    process.env.UNIFORM_PROJECT_ID
  if (!projectId) {
    throw new Error(
      "Missing project ID. Pass ?projectId= (or set UNIFORM_PROJECT_ID).",
    )
  }
  return projectId
}

async function uniformFetch<T>(
  projectId: string,
  path: string,
  init?: RequestInit & {
    searchParams?: Record<string, string>
    /** Some write endpoints reject projectId as a query param (it belongs in the body). */
    omitProjectIdParam?: boolean
  },
): Promise<T> {
  const url = new URL(path, BASE_URL)
  if (!init?.omitProjectIdParam) {
    url.searchParams.set("projectId", projectId)
  }
  for (const [k, v] of Object.entries(init?.searchParams ?? {})) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method: init?.method ?? "GET",
    headers: {
      "x-api-key": getApiKey(),
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body,
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Uniform API ${init?.method ?? "GET"} ${path} failed (${res.status}): ${text.slice(0, 300)}`,
    )
  }
  return (await res.json().catch(() => ({}))) as T
}

// ---------- Project map ----------

export interface ProjectMapInfo {
  id: string
  name: string
  default?: boolean
}

export interface ProjectMapNode {
  id: string
  name: string
  order?: number
  path: string
  parentPath?: string
  type: "composition" | "placeholder"
  description?: string
  compositionId?: string
  compositionData?: {
    id: string
    name: string
    type: string
    typeName?: string
    modified?: string
  }
}

export async function getProjectMaps(
  projectId: string,
): Promise<ProjectMapInfo[]> {
  const data = await uniformFetch<{ projectMaps: ProjectMapInfo[] }>(
    projectId,
    "/api/v1/project-map",
  )
  return data.projectMaps ?? []
}

export async function getProjectMapNodes(
  projectId: string,
  projectMapId: string,
): Promise<ProjectMapNode[]> {
  const data = await uniformFetch<{ nodes: ProjectMapNode[] }>(
    projectId,
    "/api/v1/project-map-nodes",
    {
      searchParams: {
        projectMapId,
        expanded: "true",
        withCompositionData: "true",
      },
    },
  )
  return data.nodes ?? []
}

export interface NodeUpsert {
  id?: string
  name: string
  path: string
  type: "composition" | "placeholder"
  order?: number
  description?: string
  compositionId?: string
}

/** The API accepts at most 5 nodes per PUT — batch sequentially. */
export async function upsertProjectMapNodes(
  projectId: string,
  projectMapId: string,
  nodes: NodeUpsert[],
): Promise<{ succeeded: number; errors: { path: string; message: string }[] }> {
  let succeeded = 0
  const errors: { path: string; message: string }[] = []
  const BATCH = 5
  for (let i = 0; i < nodes.length; i += BATCH) {
    const batch = nodes.slice(i, i + BATCH)
    try {
      await uniformFetch(projectId, "/api/v1/project-map-nodes", {
        method: "PUT",
        omitProjectIdParam: true,
        body: JSON.stringify({
          projectId,
          projectMapId,
          nodes: batch.map((node) => ({ node })),
        }),
      })
      succeeded += batch.length
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      for (const node of batch) errors.push({ path: node.path, message })
    }
  }
  return { succeeded, errors }
}

// ---------- Canvas (compositions) ----------

export interface CanvasItem {
  composition: {
    _id: string
    _name: string
    type: string
    parameters?: Record<string, { type: string; value: unknown }>
  }
  state: number
  modified: string
  pattern: boolean
}

/** Fetch all compositions for a given state (0 = draft/latest, 64 = published). */
export async function getAllCompositions(
  projectId: string,
  state: 0 | 64,
): Promise<CanvasItem[]> {
  const all: CanvasItem[] = []
  const LIMIT = 100
  let offset = 0
  for (;;) {
    const data = await uniformFetch<{ compositions: CanvasItem[] }>(
      projectId,
      "/api/v1/canvas",
      {
        searchParams: {
          state: String(state),
          limit: String(LIMIT),
          offset: String(offset),
        },
      },
    )
    const page = data.compositions ?? []
    all.push(...page)
    if (page.length < LIMIT) break
    offset += LIMIT
  }
  return all
}

// ---------- Redirects ----------

export interface Redirect {
  id?: string
  sourceUrl: string
  targetUrl: string
  targetStatusCode: number
  sourceRetainQuerystring?: boolean
  sourceMustMatchDomain?: boolean
  targetPreserveIncomingProtocol?: boolean
  targetPreserveIncomingDomain?: boolean
  targetMergeQuerystring?: boolean
}

export async function getAllRedirects(projectId: string): Promise<Redirect[]> {
  const all: Redirect[] = []
  const LIMIT = 100
  let offset = 0
  for (;;) {
    const data = await uniformFetch<{ redirects: Redirect[] }>(
      projectId,
      "/api/v1/redirect",
      {
        searchParams: { limit: String(LIMIT), offset: String(offset) },
      },
    )
    const page = data.redirects ?? []
    all.push(...page)
    if (page.length < LIMIT) break
    offset += LIMIT
  }
  return all
}

export async function upsertRedirects(
  projectId: string,
  redirects: Redirect[],
): Promise<{
  succeeded: number
  errors: { sourceUrl: string; message: string }[]
}> {
  let succeeded = 0
  const errors: { sourceUrl: string; message: string }[] = []
  // Modest concurrency to be gentle on the API
  const CONCURRENCY = 4
  for (let i = 0; i < redirects.length; i += CONCURRENCY) {
    const batch = redirects.slice(i, i + CONCURRENCY)
    await Promise.all(
      batch.map(async (redirect) => {
        try {
          await uniformFetch(projectId, "/api/v1/redirect", {
            method: "PUT",
            omitProjectIdParam: true,
            body: JSON.stringify({ projectId, redirect }),
          })
          succeeded++
        } catch (err) {
          errors.push({
            sourceUrl: redirect.sourceUrl,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }),
    )
  }
  return { succeeded, errors }
}
