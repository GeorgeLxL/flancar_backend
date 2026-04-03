import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProducts, getStores, getCustomers, getStaffs } from '../controllers/smaregiController';

const router = Router();
router.use(requireAuth);

router.get('/products', requireAuth, getProducts);
router.get('/stores', requireAuth, getStores);
router.get('/staffs', requireAuth, getStaffs);
router.get('/customers', requireAuth, getCustomers);

export default router;
