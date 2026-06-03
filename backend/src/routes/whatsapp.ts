import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp-service';

const router = Router({ mergeParams: true });

// Apply authentication and scoping
router.use(authenticateToken);
router.use(scopeToGym);

// GET /api/dashboard/:gymSlug/whatsapp/status
router.get('/status', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    // 1. Calculate analytics counts from WhatsAppMessage table
    const sentCount = await db.whatsAppMessage.count({
      where: { gymId: gym.id, status: 'SENT' },
    });

    const deliveredCount = await db.whatsAppMessage.count({
      where: { gymId: gym.id, status: 'DELIVERED' },
    });

    const readCount = await db.whatsAppMessage.count({
      where: { gymId: gym.id, status: 'READ' },
    });

    const failedCount = await db.whatsAppMessage.count({
      where: { gymId: gym.id, status: 'FAILED' },
    });

    // 2. Fetch recent message logs
    const recentMessages = await db.whatsAppMessage.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // 3. Fetch synced templates
    const templates = await db.whatsAppTemplate.findMany({
      where: { gymId: gym.id },
      orderBy: { templateName: 'asc' },
    });

    return res.json({
      connected: gym.whatsapp_connected,
      phoneNumber: gym.whatsapp_phone_number,
      phoneNumberId: gym.whatsapp_phone_number_id,
      wabaId: gym.whatsapp_waba_id,
      businessId: gym.whatsapp_business_id,
      analytics: {
        sent: sentCount,
        delivered: deliveredCount,
        read: readCount,
        failed: failedCount,
        total: sentCount + deliveredCount + readCount + failedCount,
      },
      recentMessages,
      templates,
    });
  } catch (error) {
    console.error('Error fetching WhatsApp status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/whatsapp/connect
router.post('/connect', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const { accessToken, wabaId, phoneNumberId, businessId } = req.body;

    if (!accessToken || !wabaId || !phoneNumberId || !businessId) {
      return res.status(400).json({ error: 'Missing Meta Embedded Signup details' });
    }

    const gym = await db.gym.findUnique({ where: { slug: gymSlug } });
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const result = await whatsappService.connectWhatsApp(gym.id, {
      accessToken,
      wabaId,
      phoneNumberId,
      businessId,
    });

    return res.json(result);
  } catch (error) {
    console.error('Error connecting WhatsApp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/whatsapp/disconnect
router.post('/disconnect', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({ where: { slug: gymSlug } });
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    await whatsappService.disconnectWhatsApp(gym.id);
    return res.json({ success: true, message: 'WhatsApp disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting WhatsApp:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/whatsapp/verify-eligibility
router.post('/verify-eligibility', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const { phoneNumberId, accessToken } = req.body;

    if (!phoneNumberId) {
      return res.status(400).json({ error: 'Phone Number ID is required' });
    }

    const gym = await db.gym.findUnique({ where: { slug: gymSlug } });
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const result = await whatsappService.verifyCoexistenceEligibility(
      gym.id,
      phoneNumberId,
      accessToken
    );

    return res.json(result);
  } catch (error) {
    console.error('Error verifying coexistence eligibility:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/whatsapp/sync-templates
router.post('/sync-templates', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({ where: { slug: gymSlug } });
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const success = await whatsappService.syncTemplates(gym.id);
    if (!success) {
      return res.status(400).json({ error: 'Template sync failed. Verify WABA is active.' });
    }

    return res.json({ success: true, message: 'Templates synchronized successfully' });
  } catch (error) {
    console.error('Error syncing templates:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/whatsapp/simulate
router.post('/simulate', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const { phone, message } = req.body;

    if (!phone || !message) {
      return res.status(400).json({ error: 'Recipient phone and message text are required' });
    }

    const gym = await db.gym.findUnique({ where: { slug: gymSlug } });
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    // Mock incoming message webhook logic
    const mockWebhookPayload = {
      entry: [{
        changes: [{
          value: {
            metadata: {
              phone_number_id: gym.whatsapp_phone_number_id || 'mock_phone_id',
              display_phone_number: gym.whatsapp_phone_number || '919988776655',
            },
            contacts: [{
              wa_id: phone.replace('+', ''),
              profile: { name: 'Simulated User' },
            }],
            messages: [{
              id: `wamid.HBgM${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
              from: phone.replace('+', ''),
              text: { body: message },
              type: 'text',
              timestamp: Math.floor(Date.now() / 1000).toString(),
            }],
          },
        }],
      }],
    };

    // Run webhook processing logic
    await whatsappService.processWebhook(mockWebhookPayload);

    return res.json({ success: true, message: 'Inbound message simulated and chatbot executed' });
  } catch (error) {
    console.error('Error simulating WhatsApp inbound message:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/whatsapp/connect/simulate-success
router.post('/connect/simulate-success', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({ where: { slug: gymSlug } });
    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    // Simulate Embedded Signup result
    const result = await whatsappService.connectWhatsApp(gym.id, {
      accessToken: `mock_long_lived_token_${Date.now()}`,
      wabaId: `mock_waba_id_${Math.floor(Math.random() * 100000000)}`,
      phoneNumberId: `mock_phone_id_${Math.floor(Math.random() * 100000000)}`,
      businessId: `mock_business_id_${Math.floor(Math.random() * 100000000)}`,
    });

    return res.json(result);
  } catch (error) {
    console.error('Error simulating pairing success:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
