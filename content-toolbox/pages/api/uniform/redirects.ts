import type { NextApiRequest, NextApiResponse } from 'next';

import { requireMeshCsrf } from '../../../lib/csrf';
import { loadMeshDelegationSession } from '../../../lib/delegationSession';
import {
  getAllRedirects,
  upsertRedirects,
  type Redirect,
  type UniformAuth,
} from '../../../lib/uniform';

export const config = {
  maxDuration: 300,
};

async function handleGet(req: NextApiRequest, res: NextApiResponse, auth: UniformAuth) {
  const redirects = await getAllRedirects(auth);
  res.status(200).json({ redirects });
}

interface ImportBody {
  projectId?: string;
  redirects: Redirect[];
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, auth: UniformAuth) {
  const body = req.body as ImportBody;
  if (!Array.isArray(body?.redirects)) {
    res.status(400).json({ error: 'Expected { redirects } in request body.' });
    return;
  }

  const invalid = body.redirects.filter(
    (r) => !r.sourceUrl?.trim() || !r.targetUrl?.trim() || !Number.isInteger(r.targetStatusCode)
  );
  if (invalid.length > 0) {
    res.status(400).json({
      error: `${invalid.length} row(s) are missing a valid source URL, target URL, or status code.`,
    });
    return;
  }

  const redirects: Redirect[] = body.redirects.map((r) => ({
    ...(r.id ? { id: r.id } : {}),
    sourceUrl: r.sourceUrl.trim(),
    targetUrl: r.targetUrl.trim(),
    targetStatusCode: r.targetStatusCode,
    ...(r.sourceRetainQuerystring !== undefined
      ? { sourceRetainQuerystring: r.sourceRetainQuerystring }
      : {}),
    ...(r.sourceMustMatchDomain !== undefined
      ? { sourceMustMatchDomain: r.sourceMustMatchDomain }
      : {}),
    ...(r.targetPreserveIncomingProtocol !== undefined
      ? { targetPreserveIncomingProtocol: r.targetPreserveIncomingProtocol }
      : {}),
    ...(r.targetPreserveIncomingDomain !== undefined
      ? { targetPreserveIncomingDomain: r.targetPreserveIncomingDomain }
      : {}),
    ...(r.targetMergeQuerystring !== undefined
      ? { targetMergeQuerystring: r.targetMergeQuerystring }
      : {}),
  }));

  const result = await upsertRedirects(auth, redirects);
  res.status(200).json(result);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // User-scoped data must never be cached by a CDN or shared proxy.
    res.setHeader('Cache-Control', 'no-store, private');

    if (req.method !== 'GET' && req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: `Method ${req.method} not allowed.` });
      return;
    }

    // Writes need CSRF protection because the delegation cookie is SameSite=None.
    if (req.method === 'POST' && !requireMeshCsrf(req, res)) {
      return;
    }

    const session = await loadMeshDelegationSession(req, res);
    if (!session) {
      res.status(401).json({ error: 'No active delegation session.' });
      return;
    }

    const projectId =
      req.method === 'GET' ? req.query.projectId : (req.body as ImportBody | undefined)?.projectId;
    if (!projectId || typeof projectId !== 'string') {
      res.status(400).json({ error: 'projectId is required.' });
      return;
    }

    const auth: UniformAuth = { projectId, bearerToken: session.accessToken };
    if (req.method === 'GET') {
      await handleGet(req, res, auth);
    } else {
      await handlePost(req, res, auth);
    }
  } catch (err) {
    // Upstream error bodies can contain internal detail — log them, return a generic message.
    // eslint-disable-next-line no-console
    console.error('Redirects route failed', err);
    res.status(500).json({ error: 'The request failed. Check the server log for details.' });
  }
}
