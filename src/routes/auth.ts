import { Router } from 'express';
import { login, callback, me, logout, getColor, setColor, getStaffColors } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', login);
router.get('/callback', callback);
router.get('/me', me);
router.post('/logout', logout);
router.get('/color', requireAuth, getColor);
router.post('/color', requireAuth, setColor);
router.get('/staff-colors', requireAuth, getStaffColors);

export default router;
