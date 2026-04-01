import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';
import { listSchedules, listSchedulesByRange, getSchedule, createSchedule, updateSchedule, deleteSchedule, updateScheduleStatus } from '../controllers/scheduleController';

const router = Router();
router.use(requireAuth);

router.get('/', requireAuth, listSchedules);
router.get('/range', requireAuth, listSchedulesByRange);
router.get('/:id', requireAuth, getSchedule);
router.post('/', requireRole('worker', 'admin'), createSchedule);
router.put('/:id', requireRole('worker', 'admin'), updateSchedule);
router.patch('/:id/status', requireRole('clerk', 'admin'), updateScheduleStatus);
router.delete('/:id', requireRole('worker', 'admin'), deleteSchedule);

export default router;
