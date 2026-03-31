import { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export function login(_req: Request, res: Response) {
  const { SMAREGI_CLIENT_ID, SMAREGI_REDIRECT_URI, SMAREGI_AUTH_URL } = process.env;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SMAREGI_CLIENT_ID!,
    redirect_uri: SMAREGI_REDIRECT_URI!,
    scope: 'openid email profile',
  });
  res.json({ url: `${SMAREGI_AUTH_URL}?${params}` });
}

export async function callback(req: Request, res: Response) {
  const { SMAREGI_CLIENT_ID, SMAREGI_CLIENT_SECRET, SMAREGI_REDIRECT_URI, SMAREGI_TOKEN_URL, SMAREGI_API_BASE, FRONTEND_URL = 'http://localhost:3000' } = process.env;
  const { code } = req.query;
  try {

    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: SMAREGI_REDIRECT_URI!,
      client_id: SMAREGI_CLIENT_ID!,
      client_secret: SMAREGI_CLIENT_SECRET!,
    });

    const tokenRes = await axios.post(SMAREGI_TOKEN_URL!, params.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token } = tokenRes.data;

    const userRes = await axios.get(`${SMAREGI_API_BASE}/userinfo`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    (req.session as any).user = {
      ...userRes.data,
      accessToken: access_token,
      role: userRes.data.role ?? 'worker',
    };

    res.redirect(FRONTEND_URL);
  } catch {
    res.status(500).json({ error: 'Auth failed' });
  }
}

export function me(req: Request, res: Response) {
  const user = (req.session as any).user;
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
}

export function logout(req: Request, res: Response) {
  req.session.destroy(() => res.json({ ok: true }));
}
