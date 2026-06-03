import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// GET /api/dashboard/:gymSlug/plans
router.get('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const plans = await db.membershipPlan.findMany({
      where: { gym: { slug: gymSlug } },
      orderBy: { price: 'asc' },
    });

    return res.json({ plans });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/plans
router.post('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const session = req.user!;
    const { name, description, price, durationDays } = req.body;

    if (!name || !price || !durationDays) {
      return res.status(400).json({ error: 'Name, price and durationDays are required' });
    }

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const plan = await db.membershipPlan.create({
      data: {
        name,
        description: description || null,
        price: parseFloat(price),
        durationDays: parseInt(durationDays),
        gymId: gym.id,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'PLAN_CREATE',
        details: `Created membership plan ${name} (Price: ₹${price}, Duration: ${durationDays} Days)`,
        gymId: gym.id,
        userId: session.userId,
      },
    });

    return res.json({ success: true, plan });
  } catch (error) {
    console.error('Error creating membership plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/dashboard/:gymSlug/plans/:planId
router.delete('/:planId', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug, planId } = req.params;
    const session = req.user!;

    const plan = await db.membershipPlan.findUnique({
      where: {
        id: planId,
        gym: { slug: gymSlug },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    await db.membershipPlan.delete({
      where: { id: planId },
    });

    await db.auditLog.create({
      data: {
        action: 'PLAN_DELETE',
        details: `Deleted membership plan ${plan.name}`,
        gymId: plan.gymId,
        userId: session.userId,
      },
    });

    return res.json({ success: true, message: 'Plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting membership plan:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
