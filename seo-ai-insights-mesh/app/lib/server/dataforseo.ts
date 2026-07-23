/**
 * Minimal server-side DataForSEO v3 client (https://docs.dataforseo.com/v3/).
 *
 * Credentials come from server env vars and NEVER reach the client bundle:
 *   DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD  (HTTP Basic auth)
 *
 * Today the credentials belong to whoever deploys this app (set them in
 * `.env.local`). Long term this module is the seam to swap in Uniform's
 * centrally-operated account: only this file talks to DataForSEO.
 */

const BASE_URL = "https://api.dataforseo.com"

export class DataForSeoError extends Error {
  constructor(
    message: string,
    /** "not_configured" | "auth" | "upstream" | "network" */
    public kind: "not_configured" | "auth" | "upstream" | "network",
    public statusCode?: number,
  ) {
    super(message)
    this.name = "DataForSeoError"
  }
}

export function hasCredentials(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) {
    throw new DataForSeoError(
      "The data provider credentials are not configured. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env.local (see .env.local.example).",
      "not_configured",
    )
  }
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`
}

/**
 * POST a single task to a DataForSEO live endpoint and return the first task's
 * `result` array. DataForSEO wraps everything in {tasks:[{status_code,result}]};
 * 20000 means OK at both levels.
 */
export async function dfsPost<T = unknown>(path: string, task: Record<string, unknown>): Promise<T[]> {
  const auth = authHeader()
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify([task]),
      // Never let Next cache upstream calls; we do our own caching with TTLs.
      cache: "no-store",
    })
  } catch (e) {
    throw new DataForSeoError(`Network error calling the data provider (${path}): ${String(e)}`, "network")
  }

  if (res.status === 401 || res.status === 403) {
    throw new DataForSeoError("The data provider rejected the credentials (401). Check DATAFORSEO_LOGIN/PASSWORD.", "auth", res.status)
  }
  if (!res.ok) {
    throw new DataForSeoError(`The data provider returned HTTP ${res.status} for ${path}.`, "upstream", res.status)
  }

  const json = (await res.json()) as {
    status_code?: number
    status_message?: string
    tasks?: { status_code?: number; status_message?: string; result?: T[] | null }[]
  }
  if (json.status_code !== 20000) {
    throw new DataForSeoError(`Data provider error ${json.status_code}: ${json.status_message}`, "upstream")
  }
  const t = json.tasks?.[0]
  if (!t || (t.status_code && t.status_code !== 20000)) {
    throw new DataForSeoError(`Data provider task error ${t?.status_code}: ${t?.status_message}`, "upstream")
  }
  return t.result ?? []
}
