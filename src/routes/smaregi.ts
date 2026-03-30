import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProducts, getStores } from '../controllers/smaregiController';

const router = Router();
router.use(requireAuth);

router.get('/products', getProducts);
router.get('/stores', getStores);

export default router;
