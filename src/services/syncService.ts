import axios from 'axios';
import prisma from '../prisma';
import { getProductUnitPrice } from '../controllers/smaregiController';

const smaregiApi = (token: string) =>
  axios.create({
    baseURL: process.env.SMAREGI_API_BASE,
    headers: { Authorization: `Bearer ${token}` },
  });

async function fetchAllPages<T>(api: ReturnType<typeof smaregiApi>, path: string): Promise<T[]> {
  const limit = 1000;
  let page = 1;
  const all: T[] = [];

  while (true) {
    const result = await api.get(path, { params: { limit, page } });
    const items: T[] = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result.data?.items)
        ? result.data.items
        : [];

    all.push(...items);
    if (items.length < limit) break;
    page++;
  }

  return all;
}

export async function syncProducts(accessToken: string) {
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  const api = smaregiApi(accessToken);

  // Sync categories first
  try {
    const raw = await fetchAllPages<any>(api, `/${contractId}/pos/categories`);
    const categories = raw
      .map((c: any) => ({
        categoryId: String(c.categoryId ?? ''),
        categoryName: String(c.categoryName ?? ''),
      }))
      .filter(c => c.categoryId);

    const BATCH = 200;
    for (let i = 0; i < categories.length; i += BATCH) {
      const batch = categories.slice(i, i + BATCH);
      await Promise.all(
        batch.map(c =>
          prisma.category.upsert({
            where: { categoryId: c.categoryId },
            update: { categoryName: c.categoryName },
            create: c,
          })
        )
      );
    }
    console.log(`Synced ${categories.length} categories`);
  } catch (e) {
    console.error('Failed to sync categories:', e);
  }

  // Sync products
  try {
    const raw = await fetchAllPages<any>(api, `/${contractId}/pos/products`);
    const products = raw
      .map((p: any) => ({
        productId: String(p.productId ?? p.productCode ?? ''),
        productName: String(p.productName ?? p.name ?? ''),
        maker: String(p.productKana ?? ''),
        categoryId: String(p.categoryId ?? ''),
        unitPrice: getProductUnitPrice(p),
      }))
      .filter(p => p.productId);

    const BATCH = 200;
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH);
      await Promise.all(
        batch.map(p =>
          prisma.product.upsert({
            where: { productId: p.productId },
            update: { productName: p.productName, maker: p.maker, categoryId: p.categoryId, unitPrice: p.unitPrice },
            create: p,
          })
        )
      );
    }
    console.log(`Synced ${products.length} products`);
  } catch (e) {
    console.error('Failed to sync products:', e);
  }
}

export async function syncCustomers(accessToken: string) {
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  const api = smaregiApi(accessToken);

  // Sync customers
  try {
    const raw = await fetchAllPages<any>(api, `/${contractId}/pos/customers`);
    const customers = raw
      .map((c: any) => ({
        customerId: String(c.customerId ?? c.memberNo ?? ''),
        customerName: String(`${c.lastName} ${c.firstName}` ? `${c.lastName} ${c.firstName}` : c.customerName ?? c.name ?? ''),
      }))
      .filter(c => c.customerId);

    const BATCH = 200;
    for (let i = 0; i < customers.length; i += BATCH) {
      const batch = customers.slice(i, i + BATCH);
      await Promise.all(
        batch.map(c =>
          prisma.customer.upsert({
            where: { customerId: c.customerId },
            update: { customerName: c.customerName },
            create: c,
          })
        )
      );
    }
    console.log(`Synced ${customers.length} customers`);
  } catch (e) {
    console.error('Failed to sync customers:', e);
  }
}