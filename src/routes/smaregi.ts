import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProducts, getStores, getStaffs } from '../controllers/smaregiController';

const router = Router();
router.use(requireAuth);

router.get('/products', getProducts);
router.get('/stores', getStores);
router.get('/staffs', getStaffs);

export default router;
