import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp-service';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// POST /api/dashboard/:gymSlug/check-in
router.post('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const { memberId } = req.body;

    if (!memberId) {
      return res.status(400).json({ error: 'Member ID is required' });
    }

    const member = await db.member.findUnique({
      where: { id: memberId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
        },
      },
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: 'Member not found or unauthorized' });
    }

    const activeMembership = member.memberships[0];

    if (!activeMembership) {
      return res.json({
        success: false,
        error: 'NO_ACTIVE_MEMBERSHIP',
        message: 'Member does not have an active subscription.',
        member,
      });
    }

    // Log check-in
    await db.auditLog.create({
      data: {
        action: 'MEMBER_CHECKIN',
        details: `Member ${member.name} checked in successfully. Active Plan: ${activeMembership.plan.name}`,
        gymId: gym.id,
      },
    });

    // Send WhatsApp attendance alert
    const checkinTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const message = `Check-in Verified! 🟢\nWelcome back *${member.name}* to *${gym.name}*!\nTime: *${checkinTime}*\nPlan: *${activeMembership.plan.name}*\n\nHave a solid training session today! 🏋️`;
    
    // Dispatch message via new WhatsApp service
    await whatsappService.sendTextMessage(gym.id, member.phone, message);

    return res.json({
      success: true,
      member: {
        id: member.id,
        name: member.name,
        phone: member.phone,
      },
      membership: {
        planName: activeMembership.plan.name,
        endDate: activeMembership.endDate,
      },
    });
  } catch (error) {
    console.error('Error during checkin API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
