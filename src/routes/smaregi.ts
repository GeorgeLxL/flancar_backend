import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProducts, getStores, getStaffs } from '../controllers/smaregiController';

const router = Router();
router.use(requireAuth);

router.get('/products', requireAuth, getProducts);
router.get('/stores', requireAuth, getStores);
router.get('/staffs', requireAuth, getStaffs);

export default router;
