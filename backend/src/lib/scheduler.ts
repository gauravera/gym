import { db } from './db';
import { whatsappService } from '../services/whatsapp-service';
import { ReminderType } from '@prisma/client';

interface ExpiryGroup {
  type: ReminderType;
  daysDiff: number;
  messageTemplate: string;
}

const EXPIRY_CONFIGS: ExpiryGroup[] = [
  {
    type: 'EXPIRING_7',
    daysDiff: 7,
    messageTemplate: 'Hey {{name}}! Your membership for plan "{{plan}}" at {{gym}} is expiring in 7 days ({{date}}). Please renew to keep your progress uninterrupted!',
  },
  {
    type: 'EXPIRING_3',
    daysDiff: 3,
    messageTemplate: 'Hello {{name}}! Quick heads up: Your membership for "{{plan}}" at {{gym}} will expire in 3 days on {{date}}. Please renew.',
  },
  {
    type: 'EXPIRING_1',
    daysDiff: 1,
    messageTemplate: 'Warning {{name}}! Your membership for "{{plan}}" at {{gym}} expires tomorrow ({{date}}). Keep your gym access active.',
  },
  {
    type: 'EXPIRED_TODAY',
    daysDiff: 0,
    messageTemplate: 'Oh no {{name}}! Your membership for "{{plan}}" at {{gym}} has expired today. Don\'t miss your training session, renew today!',
  },
  {
    type: 'EXPIRED_3',
    daysDiff: -3,
    messageTemplate: 'Miss you {{name}}! Your membership at {{gym}} expired 3 days ago. Don\'t lose your hard-earned muscle!',
  },
  {
    type: 'EXPIRED_7',
    daysDiff: -7,
    messageTemplate: 'Hey {{name}}! It has been a week since your membership expired at {{gym}}. We want you back!',
  },
];

/**
 * Runs the daily renewal check across all active gyms and sends WhatsApp notifications via Meta Cloud API.
 */
export async function runDailyRenewalChecker(): Promise<{ success: boolean; remindersSent: number }> {
  let remindersSent = 0;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const gyms = await db.gym.findMany({
      where: { whatsapp_connected: true },
    });

    for (const gym of gyms) {
      for (const config of EXPIRY_CONFIGS) {
        // Calculate target date
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + config.daysDiff);

        const targetStart = new Date(targetDate);
        targetStart.setHours(0, 0, 0, 0);
        const targetEnd = new Date(targetDate);
        targetEnd.setHours(23, 59, 59, 999);

        // Fetch memberships expiring on targetDate
        const memberships = await db.membership.findMany({
          where: {
            gymId: gym.id,
            endDate: {
              gte: targetStart,
              lte: targetEnd,
            },
            status: config.daysDiff >= 0 ? 'ACTIVE' : 'EXPIRED',
          },
          include: {
            member: true,
            plan: true,
          },
        });

        for (const membership of memberships) {
          // Check if a reminder of this type was already sent today to avoid double sending
          const existingLog = await db.renewalLog.findFirst({
            where: {
              membershipId: membership.id,
              reminderType: config.type,
              sentAt: {
                gte: today,
              },
            },
          });

          if (existingLog) continue;

          const member = membership.member;
          const plan = membership.plan;
          const dateStr = membership.endDate.toLocaleDateString('en-IN');

          // Send template message 'membership_expiry' via Meta Cloud API
          const success = await whatsappService.sendTemplateMessage(
            gym.id,
            member.phone,
            'membership_expiry',
            [member.name, plan.name, dateStr]
          );

          if (success) {
            // Log the reminder in RenewalLog
            await db.renewalLog.create({
              data: {
                memberId: member.id,
                membershipId: membership.id,
                reminderType: config.type,
                status: 'SENT',
                gymId: gym.id,
              },
            });

            // Log notification copy
            await db.notification.create({
              data: {
                gymId: gym.id,
                memberId: member.id,
                recipientPhone: member.phone,
                title: `Membership Expiry Reminder (${config.type})`,
                message: config.messageTemplate
                  .replace('{{name}}', member.name)
                  .replace('{{plan}}', plan.name)
                  .replace('{{gym}}', gym.name)
                  .replace('{{date}}', dateStr),
                type: 'REMINDER',
                status: 'SENT',
              },
            });

            // Update status if expired today
            if (config.daysDiff === 0) {
              await db.membership.update({
                where: { id: membership.id },
                data: { status: 'EXPIRED' },
              });
            }

            remindersSent++;
          }
        }
      }
    }

    return { success: true, remindersSent };
  } catch (error) {
    console.error('Renewal engine error:', error);
    return { success: false, remindersSent };
  }
}
