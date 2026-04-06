import { Router, Request, Response } from 'express';
import { syncProducts, syncCustomers} from '../services/syncService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const secret = req.headers['x-sdsch-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = String(req.body?.accessToken ?? '');
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  // Run sync in background, respond immediately
  syncProducts(accessToken).catch(e => console.error('Webhook sync failed:', e));
  syncCustomers(accessToken).catch(e => console.error('Webhook sync failed:', e));

  res.status(200).json({ success: true, message: 'Sync started' });
});

router.post('/products', async (req: Request, res: Response) => {
  const secret = req.headers['x-sdsch-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = String(req.body?.accessToken ?? '');
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  await syncProducts(accessToken)
  .then(() => {
    console.log('Webhook sync completed successfully')
    return res.status(200).json({ success: true, message: 'Sync completed' });
  })
  .catch(e => {
    console.error('Webhook sync failed:', e)
    return res.status(500).json({ error: 'Sync failed' })
  });
});

router.post('/customers', async (req: Request, res: Response) => {
  const secret = req.headers['x-sdsch-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = String(req.body?.accessToken ?? '');
  if (!accessToken) {
    return res.status(400).json({ error: 'accessToken is required' });
  }

  await syncCustomers(accessToken)
  .then(() => {
    console.log('Webhook sync completed successfully')
    return res.status(200).json({ success: true, message: 'Sync completed' });
  })
  .catch(e => {
    console.error('Webhook sync failed:', e)
    return res.status(500).json({ error: 'Sync failed' })
  });
});

export default router;
