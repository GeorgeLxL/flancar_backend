import { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export function login(req: Request, res: Response) {
  const { email } = req.body;
  (req.session as any).loginEmail = email;
  const { SMAREGI_CLIENT_ID, SMAREGI_REDIRECT_URI, SMAREGI_AUTH_URL } = process.env;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SMAREGI_CLIENT_ID!,
    redirect_uri: SMAREGI_REDIRECT_URI!,
    scope: 'openid pos.staffs:read pos.products:read pos.stores:read',
  });
  res.json({ url: `${SMAREGI_AUTH_URL}?${params}` });
}

export async function callback(req: Request, res: Response) {
  const { SMAREGI_CLIENT_ID, SMAREGI_CLIENT_SECRET, SMAREGI_REDIRECT_URI, SMAREGI_TOKEN_URL, SMAREGI_API_BASE, SMAREGI_CONTRACT_ID, FRONTEND_URL = 'http://localhost:3000' } = process.env;
  const { code } = req.query;
  const email = (req.session as any).loginEmail;
  if (!email) {
    return res.redirect(`${FRONTEND_URL}?error=no_email`);
  }
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: SMAREGI_REDIRECT_URI!,
      client_id: SMAREGI_CLIENT_ID!,
      client_secret: SMAREGI_CLIENT_SECRET!,
    });

    const tokenRes = await axios.post(SMAREGI_TOKEN_URL!, params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token } = tokenRes.data;

    const contractId = SMAREGI_CONTRACT_ID!;

    const staffsRes = await axios.get(`${SMAREGI_API_BASE}/${contractId}/pos/staffs`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const staffs = Array.isArray(staffsRes.data) ? staffsRes.data : staffsRes.data?.staffs || [];

    const staff = staffs.find((s: any) => s.email === email);
    if (!staff) {
      delete (req.session as any).loginEmail;
      return res.redirect(`${FRONTEND_URL}?error=user_not_found`);
    }

    (req.session as any).user = {
      ...staff,
      accessToken: access_token,
      role: staff.role ?? 'worker',
    };

    delete (req.session as any).loginEmail;
    res.redirect(FRONTEND_URL);
  } catch (error: any) {
    delete (req.session as any).loginEmail;
    res.redirect(`${FRONTEND_URL}?error=auth_failed`);
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
