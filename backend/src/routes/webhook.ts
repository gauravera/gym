import { Router, Request, Response } from 'express';
import { whatsappService } from '../services/whatsapp-service';

const router = Router();

// GET /api/webhooks/whatsapp (Webhook validation from Meta)
router.get('/', (req: Request, res: Response): any => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const localVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'fitflow_whatsapp_webhook_verify_token_2026';

  if (mode === 'subscribe' && token === localVerifyToken) {
    console.log('[WhatsApp Webhook] Webhook verified successfully by Meta.');
    return res.status(200).send(challenge);
  } else {
    console.warn('[WhatsApp Webhook] Webhook verification failed. Tokens mismatch.');
    return res.sendStatus(403);
  }
});

// POST /api/webhooks/whatsapp (Webhook incoming payloads)
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const payload = req.body;
    
    // Process webhook in background to release request immediately
    whatsappService.processWebhook(payload).catch((err) => {
      console.error('[WhatsApp Webhook] Error processing payload in background:', err);
    });

    // Meta expects 200 OK immediately
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('[WhatsApp Webhook] Webhook parsing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
