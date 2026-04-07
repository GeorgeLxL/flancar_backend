import { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../prisma';

dotenv.config();

export function login(req: Request, res: Response) {
  const { email } = req.body;
  const { SMAREGI_CLIENT_ID, SMAREGI_REDIRECT_URI, SMAREGI_AUTH_URL } = process.env;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SMAREGI_CLIENT_ID!,
    redirect_uri: SMAREGI_REDIRECT_URI!,
    scope: 'openid pos.staffs:read pos.products:read pos.stores:read pos.customers:read',
    state: encodeURIComponent(email),
  });
  res.json({ url: `${SMAREGI_AUTH_URL}?${params}` });
}

export async function callback(req: Request, res: Response) {
  const { SMAREGI_CLIENT_ID, SMAREGI_CLIENT_SECRET, SMAREGI_REDIRECT_URI, SMAREGI_TOKEN_URL, SMAREGI_API_BASE, SMAREGI_CONTRACT_ID, FRONTEND_URL = 'http://localhost:3000' } = process.env;
  const { code, state } = req.query;
  const email = decodeURIComponent(state as string);
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

    const tokenRes = await axios.post(
      SMAREGI_TOKEN_URL!,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${SMAREGI_CLIENT_ID}:${SMAREGI_CLIENT_SECRET}`).toString('base64'),
        },
      }
    );

    const { access_token } = tokenRes.data;

    const contractId = SMAREGI_CONTRACT_ID!;

    const staffsRes = await axios.get(`${SMAREGI_API_BASE}/${contractId}/pos/staffs`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const staffs = Array.isArray(staffsRes.data) ? staffsRes.data : staffsRes.data?.staffs || [];

    const staff = staffs.find((s: any) => s.email === email);
    if (!staff) {
      return res.redirect(`${FRONTEND_URL}?error=user_not_found`);
    }

    (req.session as any).user = {
      ...staff,
      accessToken: access_token,
    };

    const user = {
      staffId: staff.staffId,
      staffName: staff.staffName,
      email: staff.email,
      roleId: staff.roleId,
      accessToken: access_token,
    }

    res.redirect(`${FRONTEND_URL}?user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (error: any) {
    res.redirect(`${FRONTEND_URL}?error=auth_failed?error=${encodeURIComponent(error.message)}`);
  }
}

export function me(req: Request, res: Response) {
  const user = (req.session as any).user;
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
}

export async function getColor(req: Request, res: Response) {
  const user = (req.session as any).user;
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  const record = await prisma.staffColor.findUnique({ where: { staffId: user.staffId } });
  res.json({ color: record?.color ?? '#6b7280' });
}

export async function setColor(req: Request, res: Response) {
  const user = (req.session as any).user;
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  const color = String(req.body?.color ?? '');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Invalid color' });
  await prisma.staffColor.upsert({
    where: { staffId: user.staffId },
    update: { color },
    create: { staffId: user.staffId, color },
  });
  res.json({ color });
}

export async function getStaffColors(_req: Request, res: Response) {
  const colors = await prisma.staffColor.findMany();
  res.json(Object.fromEntries(colors.map(c => [c.staffId, c.color])));
}

export function logout(req: Request, res: Response) {
  req.session.destroy(() => res.json({ ok: true }));
}
