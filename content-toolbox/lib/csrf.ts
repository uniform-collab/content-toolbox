import { verifyCsrf, type CsrfResult } from '@uniformdev/mesh-sdk/server';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Origins permitted to call state-changing BFF routes. Read from
 * `MESH_ALLOWED_ORIGINS` (comma-separated) at module load so a typo or a
 * forgotten env var crashes loudly during the first request rather than
 * silently allowing every origin.
 */
function readAllowedOrigins(): readonly string[] {
  const raw = process.env.MESH_ALLOWED_ORIGINS;
  if (!raw || raw.trim().length === 0) {
    throw new Error('MESH_ALLOWED_ORIGINS env variable must be set (comma-separated origin list)');
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const ALLOWED_ORIGINS = readAllowedOrigins();

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Guards a state-changing BFF route by checking Origin/Referer against the
 * `MESH_ALLOWED_ORIGINS` list AND the custom `x-mesh-csrf` header.
 *
 * Returns `true` when the request passes; on failure writes a `403` and
 * returns `false` so callers can early-return without double-responding.
 *
 * The discriminated `reason` from `verifyCsrf` is logged but NOT returned
 * to the client — exposing it would help an attacker probe for the
 * specific check that failed.
 */
export function requireMeshCsrf(req: NextApiRequest, res: NextApiResponse): boolean {
  const result: CsrfResult = verifyCsrf(
    {
      origin: firstHeader(req.headers.origin),
      referer: firstHeader(req.headers.referer),
      secFetchSite: firstHeader(req.headers['sec-fetch-site']),
      customHeader: firstHeader(req.headers['x-mesh-csrf']),
    },
    { allowedOrigins: ALLOWED_ORIGINS }
  );
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error('CSRF check failed', { reason: result.reason });
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}
