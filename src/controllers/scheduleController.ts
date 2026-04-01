import { Request, Response } from 'express';
import { format } from 'date-fns';
import axios from 'axios';
import prisma from '../prisma';
import { getProductUnitPrice } from './smaregiController';

const smaregiApi = (token: string) =>
  axios.create({
    baseURL: process.env.SMAREGI_API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

async function enrichScheduleItems(req: Request, schedule: any) {
  const user = (req.session as any).user;

  if (!user || !schedule?.items?.length) return schedule;

  try {
    const result = await smaregiApi(user.accessToken).get(`/${process.env.SMAREGI_CONTRACT_ID!}/pos/products`, { params: { limit: 1000 } });
    const products = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.data?.products)
        ? result.data.products
        : [];

    const productPriceMap = new Map<string, number>();
    for (const product of products) {
      const productId = product.productId ?? product.productCode;
      if (!productId) continue;
      productPriceMap.set(String(productId), getProductUnitPrice(product));
    }

    return {
      ...schedule,
      items: schedule.items.map((item: any) => ({
        ...item,
        unitPrice: productPriceMap.get(item.productId) ?? item.unitPrice ?? 0,
      })),
    };
  } catch {
    return {
      ...schedule,
      items: schedule.items.map((item: any) => ({
        ...item,
        unitPrice: item.unitPrice ?? 0,
      })),
    };
  }
}

async function ensureWorkerCanEdit(req: Request, scheduleId: number) {
  const user = (req.session as any).user;

  if (!user || user.roleId !== '3') return null;

  const schedule = await (prisma.schedule as any).findUnique({
    where: { id: scheduleId },
    select: { status: true },
  });

  if (!schedule) return { error: 'Not found', status: 404 as const };
  if (schedule.status !== 'draft') {
    return { error: 'Workers can only modify draft schedules', status: 403 as const };
  }

  return null;
}

export async function listSchedules(_req: Request, res: Response) {
  const schedules = await prisma.schedule.findMany({ include: { items: true }, orderBy: { startAt: 'desc' } });
  res.json(schedules);
}

export async function getSchedule(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: Number(req.params.id) },
    include: { items: true },
  });
  if (!schedule) return res.status(404).json({ error: 'Not found' });
  res.json(await enrichScheduleItems(req, schedule));
}

export async function createSchedule(req: Request, res: Response) {
  const { items, ...data } = req.body;
  const dateStr = format(new Date(), 'yyyyMMdd');
  const count = await prisma.schedule.count();
  const pdfNumber = `${dateStr}${String(count + 1).padStart(3, '0')}`;
  const staffId = data.staffId || '';
  const staffName = data.staffName || '';

  const sanitizedItems = (items || []).map((item: any) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
  }));

  const schedule = await prisma.schedule.create({
    data: {
      ...data,
      staffId,
      staffName,
      pdfNumber,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      items: { create: sanitizedItems },
    },
    include: { items: true },
  });

  res.status(201).json(await enrichScheduleItems(req, schedule));
}

export async function updateSchedule(req: Request, res: Response) {
  const guard = await ensureWorkerCanEdit(req, Number(req.params.id));
  if (guard) return res.status(guard.status).json({ error: guard.error });

  const { items, ...data } = req.body;

  const staffId = data.staffId || '';
  const staffName = data.staffName || '';

  const sanitizedItems = (items || []).map((item: any) => ({
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
  }));

  const schedule = await prisma.schedule.update({
    where: { id: Number(req.params.id) },
    data: {
      ...data,
      staffId,
      staffName,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      items: { deleteMany: {}, create: sanitizedItems },
    },
    include: { items: true },
  });

  res.json(await enrichScheduleItems(req, schedule));
}

export async function deleteSchedule(req: Request, res: Response) {
  const guard = await ensureWorkerCanEdit(req, Number(req.params.id));
  if (guard) return res.status(guard.status).json({ error: guard.error });

  await prisma.schedule.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

export async function updateScheduleStatus(req: Request, res: Response) {
  const status = String(req.body?.status ?? '');

  if (!['draft', 'pending', 'sent', 'finished'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const schedule = await (prisma.schedule as any).update({
    where: { id: Number(req.params.id) },
    data: { status },
    include: { items: true },
  });

  res.json(await enrichScheduleItems(req, schedule));
}
