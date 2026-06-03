import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp-service';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// POST /api/dashboard/:gymSlug/live-chat/send
router.post('/send', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const session = req.user!;
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const member = await db.member.findFirst({
      where: { phone, gymId: gym.id },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Force bot takeover to active since staff is replying manually
    if (!member.isBotDisabled) {
      await db.member.update({
        where: { id: member.id },
        data: { isBotDisabled: true },
      });
    }

    // Save outbound staff reply to Notification logs
    await db.notification.create({
      data: {
        gymId: gym.id,
        memberId: member.id,
        recipientPhone: phone,
        title: 'WhatsApp Staff Reply',
        message,
        type: 'CHATBOT',
        status: 'SENT',
      },
    });

    // Send the message using the new WhatsApp service
    await whatsappService.sendTextMessage(gym.id, phone, message);

    await db.auditLog.create({
      data: {
        action: 'HUMAN_TAKEOVER_REPLY',
        details: `Staff sent direct message to ${member.name} (${phone})`,
        gymId: gym.id,
        userId: session.userId,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error sending staff live-chat reply:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
