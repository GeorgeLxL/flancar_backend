import { Router } from 'express';
import { login, callback, me, logout } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.get('/callback', callback);
router.get('/me', me);
router.post('/logout', logout);

export default router;
