import { Router, Request, Response } from 'express';
import { q } from '../db';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({
    alerts: q.getAlerts(),
    unreadCount: q.getUnreadAlertCount(),
  });
});

router.put('/:id/read', (req: Request, res: Response) => {
  q.markAlertRead.run(req.params.id);
  res.json({ success: true });
});

router.put('/read-all', (_req: Request, res: Response) => {
  q.markAllAlertsRead.run();
  res.json({ success: true });
});

export default router;
