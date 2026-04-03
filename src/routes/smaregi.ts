import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getProducts, getStores, getCustomers, getStaffs, searchProducts, searchCustomers } from '../controllers/smaregiController';

const router = Router();
router.use(requireAuth);

router.get('/products', requireAuth, getProducts);
router.get('/products/search', requireAuth, searchProducts);
router.get('/stores', requireAuth, getStores);
router.get('/staffs', requireAuth, getStaffs);
router.get('/customers', requireAuth, getCustomers);
router.get('/customers/search', requireAuth, searchCustomers);

export default router;
