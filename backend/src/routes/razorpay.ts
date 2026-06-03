import { Router, Request, Response } from 'express';
import { db } from '../lib/db';
import { approveTransaction } from '../lib/payment-processor';

const router = Router();

// POST /api/webhooks/razorpay
router.post('/', async (req: Request, res: Response): Promise<any> => {
  try {
    const payload = req.body;
    console.log('[Razorpay Webhook] Received webhook payload:', JSON.stringify(payload));

    const event = payload.event;

    // Check for order/payment completion events
    if (event === 'payment.captured' || event === 'order.paid') {
      const entity = payload.payload.payment?.entity || payload.payload.order?.entity;
      
      // Try to find the transaction reference ID
      const referenceId = entity?.order_id || entity?.id;
      const notes = entity?.notes || {};
      
      // Look up transaction by referenceId or custom notes parameter
      const transactionId = notes.transactionId || payload.payload.payment?.entity?.notes?.transactionId;

      let transaction = null;

      if (transactionId) {
        transaction = await db.transaction.findUnique({ where: { id: transactionId } });
      } else if (referenceId) {
        transaction = await db.transaction.findFirst({ where: { referenceId } });
      }

      if (transaction) {
        // Complete payment approval workflow!
        const ok = await approveTransaction(transaction.id);
        if (ok) {
          // Log complete webhook payload on transaction record
          await db.transaction.update({
            where: { id: transaction.id },
            data: {
              paymentDetails: payload,
              referenceId: referenceId || transaction.referenceId,
            },
          });
          console.log(`[Razorpay Webhook] Transaction ${transaction.id} approved successfully via webhook.`);
          return res.json({ success: true, message: 'Payment processed and active' });
        }
      } else {
        console.warn(`[Razorpay Webhook] No matching transaction found for Reference: ${referenceId}, notes transactionId: ${transactionId}`);
      }
    }

    return res.json({ success: true, message: 'Event ignored' });
  } catch (error) {
    console.error('Error processing Razorpay webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
