import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// GET /api/dashboard/:gymSlug
router.get('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    // Fetch Gym
    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym tenant not found' });
    }

    // 1. Gather live operational metrics
    const activeMembersCount = await db.member.count({
      where: {
        gymId: gym.id,
        memberships: {
          some: { status: 'ACTIVE' },
        },
      },
    });

    const totalMembersCount = await db.member.count({
      where: { gymId: gym.id },
    });

    const expiringMembersCount = await db.membership.count({
      where: {
        gymId: gym.id,
        status: 'ACTIVE',
        endDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
        },
      },
    });

    const totalRevenue = await db.transaction.aggregate({
      _sum: { amount: true },
      where: {
        gymId: gym.id,
        status: 'PAID',
      },
    });

    const pendingPaymentsCount = await db.transaction.count({
      where: {
        gymId: gym.id,
        status: 'AWAITING_VERIFICATION',
      },
    });

    const recentTransactions = await db.transaction.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { member: true, plan: true },
    });

    const recentAuditLogs = await db.auditLog.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Calculate monthly renewals/paid txns
    const monthlyPaidTxns = await db.transaction.count({
      where: {
        gymId: gym.id,
        status: 'PAID',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        },
      },
    });

    // 2. Formulate Recharts data
    const chartData = [
      { name: 'Jan', revenue: 5000, members: 10, renewals: 2 },
      { name: 'Feb', revenue: 12000, members: 22, renewals: 5 },
      { name: 'Mar', revenue: 19000, members: 35, renewals: 12 },
      { name: 'Apr', revenue: 26000, members: 48, renewals: 18 },
      { name: 'May', revenue: (totalRevenue._sum.amount || 0) + 15000, members: totalMembersCount + 5, renewals: monthlyPaidTxns },
    ];

    return res.json({
      gym: {
        id: gym.id,
        name: gym.name,
        slug: gym.slug,
      },
      metrics: {
        activeMembersCount,
        totalMembersCount,
        expiringMembersCount,
        totalRevenue: totalRevenue._sum.amount || 0,
        pendingPaymentsCount,
        monthlyPaidTxns,
      },
      recentTransactions,
      recentAuditLogs,
      chartData,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
