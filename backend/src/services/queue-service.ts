import { db } from '../lib/db';
import { whatsappService } from './whatsapp-service';

export const queueService = {
  isProcessing: false,
  intervalId: null as any,

  /**
   * Starts the background queue worker.
   */
  startWorker(pollIntervalMs: number = 5000) {
    if (this.intervalId) return;
    
    console.log(`[Queue Worker] Starting database-backed message queue worker. Polling every ${pollIntervalMs}ms.`);
    
    this.intervalId = setInterval(async () => {
      await this.processQueue();
    }, pollIntervalMs);
  },

  /**
   * Stops the background queue worker.
   */
  stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Queue Worker] Stopped background queue worker.');
    }
  },

  /**
   * Adds a notification message to the queue (database-backed).
   */
  async queueMessage(data: {
    gymId: string;
    memberId: string;
    recipientPhone: string;
    type: 'ACTIVATION' | 'RENEWAL' | 'PAYMENT_RECEIVED' | 'PAYMENT_REJECTED' | 'REMINDER' | 'BIRTHDAY';
    title: string;
    message: string;
    templateName?: string;
    templateParams?: string[];
  }): Promise<any> {
    const notification = await db.notification.create({
      data: {
        gymId: data.gymId,
        memberId: data.memberId,
        recipientPhone: data.recipientPhone,
        type: data.type,
        title: data.templateName 
          ? `TEMPLATE:${data.templateName}:${(data.templateParams || []).join(',')}` 
          : data.title,
        message: data.message,
        status: 'PENDING',
      },
    });

    console.log(`[Queue Worker] Queued notification message ID: ${notification.id} for recipient: +${data.recipientPhone}`);
    return notification;
  },

  /**
   * Processes pending messages in the queue, handling rate-limiting and updates.
   */
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Find all PENDING notifications in order of creation
      const pendingNotifications = await db.notification.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 10, // process in small batches to prevent database locks
      });

      if (pendingNotifications.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[Queue Worker] Processing batch of ${pendingNotifications.length} pending notification(s).`);

      for (const notification of pendingNotifications) {
        try {
          // Check if it is a template message or free-text message.
          // We encoded template messages in the title field as 'TEMPLATE:template_name:param1,param2'
          const isTemplate = notification.title.startsWith('TEMPLATE:');
          let success = false;

          if (isTemplate) {
            const parts = notification.title.split(':');
            const templateName = parts[1];
            const paramString = parts[2] || '';
            const params = paramString ? paramString.split(',') : [];

            success = await whatsappService.sendTemplateMessage(
              notification.gymId,
              notification.recipientPhone,
              templateName,
              params
            );
          } else {
            success = await whatsappService.sendTextMessage(
              notification.gymId,
              notification.recipientPhone,
              notification.message
            );
          }

          // Update status in the database
          await db.notification.update({
            where: { id: notification.id },
            data: {
              status: success ? 'SENT' : 'FAILED',
            },
          });

          // Throttle messages slightly to comply with Meta standard Cloud API send rate limits (e.g. 80 msg/sec, keeping 100ms delay here is safe)
          await new Promise((resolve) => setTimeout(resolve, 100));

        } catch (itemError) {
          console.error(`[Queue Worker] Failed to dispatch notification ID: ${notification.id}`, itemError);
          await db.notification.update({
            where: { id: notification.id },
            data: { status: 'FAILED' },
          });
        }
      }
    } catch (error) {
      console.error('[Queue Worker] Error running queue batch:', error);
    } finally {
      this.isProcessing = false;
    }
  },
};

export default queueService;
