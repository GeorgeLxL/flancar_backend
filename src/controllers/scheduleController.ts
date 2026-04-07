import { Request, Response } from 'express';
import { format } from 'date-fns';
import prisma from '../prisma';

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

function sanitizeItems(items: any[]) {
  return (items || []).map((item: any) => ({
    productId: item.productId,
    productName: item.productName,
    maker: item.maker ?? '',
    unitPrice: Number(item.unitPrice) || 0,
    quantity: item.quantity,
  }));
}

export async function listSchedules(_req: Request, res: Response) {
  const schedules = await prisma.schedule.findMany({ include: { items: true }, orderBy: { startAt: 'desc' } });
  res.json(schedules);
}

export async function listSchedulesByRange(req: Request, res: Response) {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  const fromDate = new Date(String(from));
  const toDate = new Date(String(to));
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { startAt: { gte: fromDate, lte: toDate } },
        { endAt: { gte: fromDate, lte: toDate } },
        { startAt: { lte: fromDate }, endAt: { gte: toDate } },
      ],
    },
    include: { items: true },
    orderBy: { startAt: 'asc' },
  });
  res.json(schedules);
}

export async function getSchedule(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({
    where: { id: Number(req.params.id) },
    include: { items: true },
  });
  if (!schedule) return res.status(404).json({ error: 'Not found' });
  res.json(schedule);
}

export async function createSchedule(req: Request, res: Response) {
  const { items, ...data } = req.body;
  const dateStr = format(new Date(), 'yyyyMMdd');
  const count = await prisma.schedule.count();
  const pdfNumber = `${dateStr}${String(count + 1).padStart(3, '0')}`;

  const schedule = await prisma.schedule.create({
    data: {
      ...data,
      pdfNumber,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      items: { create: sanitizeItems(items) },
    },
    include: { items: true },
  });

  res.status(201).json(schedule);
}

export async function updateSchedule(req: Request, res: Response) {
  const guard = await ensureWorkerCanEdit(req, Number(req.params.id));
  if (guard) return res.status(guard.status).json({ error: guard.error });

  const { items, ...data } = req.body;

  const schedule = await prisma.schedule.update({
    where: { id: Number(req.params.id) },
    data: {
      ...data,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      items: { deleteMany: {}, create: sanitizeItems(items) },
    },
    include: { items: true },
  });

  res.json(schedule);
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

  res.json(schedule);
}
