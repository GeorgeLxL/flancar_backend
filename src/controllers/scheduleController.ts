import { Request, Response } from 'express';
import { format } from 'date-fns';
import { ScheduleStatus } from '@prisma/client';
import prisma from '../prisma';

async function ensureWorkerCanEdit(req: Request, scheduleId: number) {
  const user = (req.session as any).user;
  if (!user || user.roleId !== '3' || user.roleId !== '1') return null;
  const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId }, select: { status: true, staffId: true } });
  if (!schedule) return { error: 'Not found', status: 404 as const };
  // if (schedule.staffId !== user.staffId) return { error: 'Workers can only modify their own schedules', status: 403 as const };
  // if (schedule.status !== 'draft') return { error: 'Workers can only modify draft schedules', status: 403 as const };
  return null;
}

function sanitizeItems(items: any[]) {
  return (items || []).map((item: any) => ({
    productId: item.productId,
    categoryId: item.categoryId ?? '',
    unitPrice: Number(item.unitPrice) || 0,
    quantity: item.quantity,
  }));
}

function sanitizeSchedule(data: any) {
  return {
    title: data.title ?? '',
    carType: data.carType ?? '',
    description: data.description ?? '',
    startAt: data.startAt,
    endAt: data.endAt,
    customerId: data.customerId ?? '',
    staffId: data.staffId ?? '',
    staffName: data.staffName ?? '',
    customer: data.customer ?? '',
    requester: data.requester ?? '',
    showComiPack: data.showComiPack ?? false,
    status: data.status ?? 'draft',
  };
}

export async function searchSchedules(req: Request, res: Response) {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json([]);
  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { customerData: { customerName: { contains: q, mode: 'insensitive' } } },
        { customer: { contains: q, mode: 'insensitive' } },
        { staffName: { contains: q, mode: 'insensitive' } },
        { requester: { contains: q, mode: 'insensitive' } },
        { carType: { contains: q, mode: 'insensitive' } },
        { items: { some: { product: { productName: { contains: q, mode: 'insensitive' } } } } },
      ],
    },
    orderBy: { startAt: 'asc' },
    take: 50,
    include: { items: { include: { product: true } }, customerData: true },
  });
  res.json(schedules.map(schedule => ({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({
      ...item,
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  })));
}

export async function listSchedules(_req: Request, res: Response) {
  const schedules = await prisma.schedule.findMany({ 
    include: { items: { include: { product: true } }, customerData: true }, 
    orderBy: { startAt: 'desc' } 
  });
  res.json(schedules.map(schedule => ({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({
      ...item,
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  })));
}

export async function listSchedulesByRange(req: Request, res: Response) {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  const fromDate = new Date(String(from));
  const toDate = new Date(String(to));
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return res.status(400).json({ error: 'Invalid date format' });
  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { startAt: { gte: fromDate, lte: toDate } },
        { endAt: { gte: fromDate, lte: toDate } },
        { startAt: { lte: fromDate }, endAt: { gte: toDate } },
      ],
    },
    include: { items: { include: { product: true } }, customerData: true },
    orderBy: { startAt: 'asc' },
  });
  res.json(schedules.map(schedule => ({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({
      ...item,
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  })));
}

export async function getSchedule(req: Request, res: Response) {
  const schedule = await prisma.schedule.findUnique({ 
    where: { id: Number(req.params.id) }, 
    include: { items: { include: { product: true } }, customerData: true } 
  });
  if (!schedule) return res.status(404).json({ error: 'Not found' });
  const categoryIds = [...new Set(schedule.items.map(i => i.categoryId).filter(Boolean))];
  const categories = categoryIds.length ? await prisma.category.findMany({ where: { categoryId: { in: categoryIds } } }) : [];
  const categoryMap = new Map(categories.map(c => [c.categoryId, c.categoryName]));
  res.json({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({ 
      ...item, 
      categoryName: categoryMap.get(item.categoryId) ?? '',
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  });
}

export async function createSchedule(req: Request, res: Response) {
  const { items, ...rawData } = req.body;
  const data = sanitizeSchedule(rawData);
  const dateStr = format(new Date(), 'MMdd');
  const latestTodaySchedule = await prisma.schedule.findFirst({
    where: { pdfNumber: { startsWith: dateStr } },
    orderBy: { pdfNumber: 'desc' },
    select: { pdfNumber: true },
  });
  const latestTodayNumber = latestTodaySchedule?.pdfNumber
    ? Number(latestTodaySchedule.pdfNumber.slice(dateStr.length))
    : 0;
  const pdfNumber = `${dateStr}${String(latestTodayNumber + 1).padStart(3, '0')}`;
  const schedule = await prisma.schedule.create({
    data: {
      ...data,
      pdfNumber,
      startAt: data.startAt ? new Date(data.startAt) : new Date(),
      endAt: data.endAt ? new Date(data.endAt) : new Date(),
      items: { create: sanitizeItems(items) },
    },
    include: { items: { include: { product: true } }, customerData: true },
  });
  res.status(201).json({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({
      ...item,
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  });
}

export async function updateSchedule(req: Request, res: Response) {
  const guard = await ensureWorkerCanEdit(req, Number(req.params.id));
  if (guard) return res.status(guard.status).json({ error: guard.error });
  const { items, ...rawData } = req.body;
  const data = sanitizeSchedule(rawData);
  const schedule = await prisma.schedule.update({
    where: { id: Number(req.params.id) },
    data: {
      ...data,
      startAt: data.startAt ? new Date(data.startAt) : new Date(),
      endAt: data.endAt ? new Date(data.endAt) : new Date(),
      items: { deleteMany: {}, create: sanitizeItems(items) },
    },
    include: { items: { include: { product: true } }, customerData: true },
  });
  res.json({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({
      ...item,
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  });
}

export async function deleteSchedule(req: Request, res: Response) {
  const guard = await ensureWorkerCanEdit(req, Number(req.params.id));
  if (guard) return res.status(guard.status).json({ error: guard.error });
  await prisma.schedule.delete({ where: { id: Number(req.params.id) } });
  res.json({ ok: true });
}

export async function updateScheduleStatus(req: Request, res: Response) {
  const status = String(req.body?.status ?? '');
  if (!Object.values(ScheduleStatus).includes(status as ScheduleStatus)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const schedule = await prisma.schedule.update({
    where: { id: Number(req.params.id) },
    data: { status: status as ScheduleStatus },
    include: { items: { include: { product: true } }, customerData: true },
  });
  res.json({
    ...schedule,
    customerName: schedule.customerData?.customerName ?? '',
    items: schedule.items.map(item => ({
      ...item,
      productName: item.product?.productName ?? '',
      maker: item.product?.maker ?? '',
    })),
  });
}
