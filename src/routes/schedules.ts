import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, updateScheduleStatus } from '../controllers/scheduleController';

const router = Router();
router.use(requireAuth);

router.get('/', listSchedules);
router.get('/:id', getSchedule);
router.post('/', createSchedule);
router.put('/:id', updateSchedule);
router.patch('/:id/status', updateScheduleStatus);
router.delete('/:id', deleteSchedule);

export default router;
