import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';
import { approveTransaction, rejectTransaction } from '../lib/payment-processor';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// GET /api/dashboard/:gymSlug/payments
router.get('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const transactions = await db.transaction.findMany({
      where: { gym: { slug: gymSlug } },
      orderBy: { createdAt: 'desc' },
      include: {
        member: true,
        plan: true,
        invoice: true,
      },
    });

    return res.json({ transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/payments
router.post('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const session = req.user!;
    const { transactionId, action, reason } = req.body;

    if (!transactionId || !action) {
      return res.status(400).json({ error: 'Transaction ID and Action are required' });
    }

    if (action === 'APPROVE') {
      const ok = await approveTransaction(transactionId, session.userId);
      if (!ok) {
        return res.status(400).json({ error: 'Transaction cannot be approved' });
      }
      return res.json({ success: true, message: 'Transaction approved and membership activated' });
    } else if (action === 'REJECT') {
      const ok = await rejectTransaction(transactionId, reason || 'Transaction reference invalid', session.userId);
      if (!ok) {
        return res.status(400).json({ error: 'Transaction cannot be rejected' });
      }
      return res.json({ success: true, message: 'Transaction rejected successfully' });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
