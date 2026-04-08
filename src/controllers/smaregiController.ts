import { Request, Response } from 'express';
import axios from 'axios';
import prisma from '../prisma';

const smaregiApi = (token: string) =>
  axios.create({
    baseURL: process.env.SMAREGI_API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

type SmaregiProduct = {
  productId?: string;
  productCode?: string;
  productName?: string;
  name?: string;
  price?: string;
  customerPrice?: string;
  reduceTaxPrice?: string;
  reduceTaxCustomerPrice?: string;
  cost?: string;
  prices?: Array<{ price?: number | string }>;
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function getProductUnitPrice(product: SmaregiProduct): number {
  const candidates = [
    product?.price,
    product?.customerPrice,
    product?.reduceTaxPrice,
    product?.reduceTaxCustomerPrice,
    product?.cost,
    product?.prices?.[0]?.price,
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed !== null) return parsed;
  }

  return 0;
}

function normalizeProduct(product: SmaregiProduct) {
  return {
    ...product,
    productId: product.productId ?? product.productCode ?? '',
    productName: product.productName ?? product.name ?? '',
    unitPrice: getProductUnitPrice(product),
  };
}

export async function getProducts(req: Request, res: Response) {
  const { accessToken } = (req.session as any).user;
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  try {
    const result = await smaregiApi(accessToken).get(`/${contractId}/pos/products`, {params: { limit: 1000 }});
    const products = Array.isArray(result.data)
      ? result.data.map(normalizeProduct)
      : Array.isArray(result.data?.products)
        ? result.data.products.map(normalizeProduct)
        : [];
    res.json(products);
  } catch {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

export async function getStores(req: Request, res: Response) {
  const { accessToken } = (req.session as any).user;
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  try {
    const result = await smaregiApi(accessToken).get(`/${contractId}/pos/stores`);
    res.json(result.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
}

export async function searchProducts(req: Request, res: Response) {
  const q = String(req.query.q ?? '');
  const products = await prisma.product.findMany({
    where: q ? { productName: { contains: q, mode: 'insensitive' } } : {},
    orderBy: { productName: 'asc' },
    take: 50,
    select: { productId: true, productName: true, maker: true, categoryId: true, unitPrice: true },
  });
  const categoryIds = [...new Set(products.map(product => product.categoryId).filter(Boolean))];
  const categories = categoryIds.length
    ? await prisma.category.findMany({
        where: { categoryId: { in: categoryIds } },
        select: { categoryId: true, categoryName: true },
      })
    : [];
  const categoryMap = new Map(categories.map(category => [category.categoryId, category.categoryName]));

  res.json(
    products.map(product => ({
      ...product,
      categoryName: categoryMap.get(product.categoryId) ?? '',
    }))
  );
}

export async function searchCustomers(req: Request, res: Response) {
  const q = String(req.query.q ?? '');
  const customers = await prisma.customer.findMany({
    where: q ? { customerName: { contains: q, mode: 'insensitive' } } : {},
    orderBy: { customerName: 'asc' },
    take: 50,
  });
  res.json(customers);
}

export async function getStaffs(req: Request, res: Response) {
  const { accessToken } = (req.session as any).user;
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  try {
    const result = await smaregiApi(accessToken).get(`/${contractId}/pos/staffs`);
    res.json(result.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch staffs' });
  }
}

export async function getCustomers(req: Request, res: Response) {
  const { accessToken } = (req.session as any).user;
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  try {
    const result = await smaregiApi(accessToken).get(`/${contractId}/pos/customers`, {params: { limit: 1000 }});
    const customers = Array.isArray(result.data) ? result.data : result.data?.customers ?? [];
    res.json(customers.map((c: any) => {
      const name = c.lastName + ' ' + c.firstName
      return {
        customerId: c.customerId ?? c.customerNo ?? '',
        customerName: c.customerName ?? name ?? '',
      }
    }));
  } catch {
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
}
