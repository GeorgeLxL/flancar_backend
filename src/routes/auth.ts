import { Router } from 'express';
import { login, callback, me, logout, getStaffColors, setStaffColor } from '../controllers/authController';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/callback', callback);
router.get('/me', me);
router.post('/logout', logout);
router.get('/staff_colors', requireAuth, getStaffColors);
router.put('/staff_colors/:staffId', requireRole('admin'), setStaffColor);

export default router;
