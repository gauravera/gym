import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// GET /api/dashboard/:gymSlug/chatbot
router.get('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
      include: {
        chatbotSettings: true,
        paymentSettings: true,
      },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    return res.json({
      chatbotSettings: gym.chatbotSettings,
      paymentSettings: gym.paymentSettings,
    });
  } catch (error) {
    console.error('Error fetching chatbot settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/chatbot
router.post('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const session = req.user!;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const {
      welcomeMessage,
      isAiModeEnabled,
      aiKnowledgeBase,
      upiId,
      upiName,
      razorpayKeyId,
      razorpayKeySecret,
      isRazorpayEnabled,
    } = req.body;

    // Update settings in database
    const chatbotSettings = await db.chatbotSettings.upsert({
      where: { gymId: gym.id },
      update: {
        welcomeMessage,
        isAiModeEnabled,
        aiKnowledgeBase,
      },
      create: {
        gymId: gym.id,
        welcomeMessage,
        isAiModeEnabled,
        aiKnowledgeBase,
      },
    });

    const paymentSettings = await db.paymentSettings.upsert({
      where: { gymId: gym.id },
      update: {
        upiId,
        upiName,
        razorpayKeyId,
        razorpayKeySecret,
        isRazorpayEnabled,
      },
      create: {
        gymId: gym.id,
        upiId,
        upiName,
        razorpayKeyId,
        razorpayKeySecret,
        isRazorpayEnabled,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'SETTINGS_UPDATE',
        details: `Updated chatbot and payment configurations`,
        gymId: gym.id,
        userId: session.userId,
      },
    });

    return res.json({
      success: true,
      chatbotSettings,
      paymentSettings,
    });
  } catch (error) {
    console.error('Error updating chatbot settings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
