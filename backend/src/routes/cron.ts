import { Router, Request, Response } from 'express';
import { runDailyRenewalChecker } from '../lib/scheduler';

const router = Router();

// GET /api/cron/renew
// POST /api/cron/renew
const handleCronTrigger = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers['authorization'];
    const expectedSecret = process.env.CRON_SECRET;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('[Cron Router] Manual cron renewal checker triggered.');
    const result = await runDailyRenewalChecker();
    return res.json(result);
  } catch (error) {
    console.error('Error running manual cron renewal checker:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

router.get('/renew', handleCronTrigger);
router.post('/renew', handleCronTrigger);

export default router;
