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

export async function syncProductsAndCustomers(accessToken: string) {
  const contractId = process.env.SMAREGI_CONTRACT_ID!;
  const api = smaregiApi(accessToken);

  // Sync products
  try {
    const products = await fetchAllPages<any>(api, `/${contractId}/pos/products`);
    const BATCH = 500;
    for (let i = 0; i < products.length; i += BATCH) {
      const batch = products.slice(i, i + BATCH).map((p: any) => ({
        productId: String(p.productId ?? p.productCode ?? ''),
        productName: p.productName ?? p.name ?? '',
        unitPrice: getProductUnitPrice(p),
      })).filter((p: any) => p.productId);

      await prisma.$executeRawUnsafe(`
          INSERT INTO "Product" ("productId", "productName", "unitPrice", "updatedAt")
          VALUES ${batch
                  .map((_, j) => `(
              $${j * 4 + 1},
              $${j * 4 + 2},
              $${j * 4 + 3}::INTEGER,
              NOW()
            )`).join(',')}
          ON CONFLICT ("productId") DO UPDATE
          SET
            "productName" = EXCLUDED."productName",
            "unitPrice" = EXCLUDED."unitPrice",
            "updatedAt" = NOW()
        `,
        ...batch.flatMap(p => [
          p.productId,
          p.productName,
          p.unitPrice === null ? null : Number(p.unitPrice),
        ]));
    }
    console.log(`Synced ${products.length} products`);
  } catch (e) {
    console.error('Failed to sync products:', e);
  }

  // Sync customers
  try {
    const customers = await fetchAllPages<any>(api, `/${contractId}/pos/customers`);
    const BATCH = 500;
    for (let i = 0; i < customers.length; i += BATCH) {
      const batch = customers.slice(i, i + BATCH).map((c: any) => ({
        customerId: String(c.customerId ?? c.memberNo ?? ''),
        customerName: c.customerName ?? c.name ?? '',
      })).filter((c: any) => c.customerId);

      await prisma.$executeRawUnsafe(`
        INSERT INTO "Customer" ("customerId", "customerName", "updatedAt")
        VALUES ${batch.map((_: any, j: number) => `($${j * 3 + 1}, $${j * 3 + 2}, NOW())`).join(',')}
        ON CONFLICT ("customerId") DO UPDATE
        SET "customerName" = EXCLUDED."customerName", "updatedAt" = NOW()
      `, ...batch.flatMap((c: any) => [c.customerId, c.customerName]));
    }
    console.log(`Synced ${customers.length} customers`);
  } catch (e) {
    console.error('Failed to sync customers:', e);
  }
}
