/**
 * POST /api/session
 *
 * Server-side half of the identity delegation handshake:
 * the browser POSTs the short-lived Mesh session token here, and this route
 * exchanges it (using the integration secret, which never leaves the server)
 * for a delegation token pair. The pair is sealed into an encrypted HttpOnly
 * cookie — the browser never sees the raw tokens.
 *
 * Body: { sessionToken: string }
 * Response: 200 { status: 'ok' } + Set-Cookie with sealed delegation session
 */
import {
  DELEGATION_COOKIE_NAME,
  DelegationTokenClient,
  sealDelegationSession,
  serializeSessionCookie,
} from '@uniformdev/mesh-sdk/server';
import type { NextApiRequest, NextApiResponse } from 'next';

import { requireMeshCsrf } from '../../lib/csrf';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  if (!requireMeshCsrf(req, res)) {
    return;
  }

  const { sessionToken } = req.body as { sessionToken?: string };
  if (!sessionToken || typeof sessionToken !== 'string') {
    res.status(400).json({ error: 'sessionToken is required' });
    return;
  }

  const client = new DelegationTokenClient({
    apiHost: process.env.UNIFORM_API_HOST!,
    integrationId: process.env.UNIFORM_INTEGRATION_ID!,
    integrationSecret: process.env.UNIFORM_INTEGRATION_SECRET!,
  });

  try {
    const token = await client.exchangeSessionToken(sessionToken);

    const session = {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: Date.now() + token.expiresIn * 1000,
    };
    const sealed = await sealDelegationSession(session, process.env.MESH_SESSION_SECRET!);
    res.setHeader('Set-Cookie', serializeSessionCookie(DELEGATION_COOKIE_NAME, sealed));
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Error exchanging session token', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
}
