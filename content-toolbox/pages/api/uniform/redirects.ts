import type { NextApiRequest, NextApiResponse } from 'next';

import {
  getAllRedirects,
  resolveProjectId,
  upsertRedirects,
  type Redirect,
} from '../../../lib/uniform';

export const config = {
  maxDuration: 300,
};

async function handleGet(req: NextApiRequest, res: NextApiResponse) {
  const projectId = resolveProjectId(req.query.projectId);
  const redirects = await getAllRedirects(projectId);
  res.status(200).json({ redirects });
}

interface ImportBody {
  projectId?: string;
  redirects: Redirect[];
}

async function handlePost(req: NextApiRequest, res: NextApiResponse) {
  const body = req.body as ImportBody;
  if (!Array.isArray(body?.redirects)) {
    res.status(400).json({ error: 'Expected { redirects } in request body.' });
    return;
  }
  const projectId = resolveProjectId(body.projectId);

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

  const result = await upsertRedirects(projectId, redirects);
  res.status(200).json(result);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      await handleGet(req, res);
    } else if (req.method === 'POST') {
      await handlePost(req, res);
    } else {
      res.setHeader('Allow', 'GET, POST');
      res.status(405).json({ error: `Method ${req.method} not allowed.` });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
}
