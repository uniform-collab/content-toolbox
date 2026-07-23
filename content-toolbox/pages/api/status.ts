/**
 * GET /api/status
 *
 * The delegation cookie is HttpOnly — the browser cannot read it, so the
 * DelegationProvider calls this endpoint to check whether a valid session
 * already exists before requesting a new session token from the dashboard.
 *
 * Response: { status: 'active' | 'expired' | 'none' }
 */
import type { NextApiRequest, NextApiResponse } from 'next';

import { requireMeshCsrf } from '../../lib/csrf';
import {
  readMeshDelegationCookieFromRequest,
  unsealMeshDelegationSession,
} from '../../lib/delegationSession';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store, private');

  if (!requireMeshCsrf(req, res)) {
    return;
  }

  const jwe = readMeshDelegationCookieFromRequest(req);
  if (!jwe) {
    res.json({ status: 'none' });
    return;
  }

  const session = await unsealMeshDelegationSession(jwe);
  if (!session) {
    res.json({ status: 'none' });
    return;
  }

  if (session.expiresAt < Date.now()) {
    res.json({ status: 'expired' });
    return;
  }

  res.json({ status: 'active' });
}
