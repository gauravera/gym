import cron from 'node-cron';
import { db } from '../lib/db';
import { queueService } from '../services/queue-service';
import { runDailyRenewalChecker } from '../lib/scheduler';

export const cronJobs = {
  /**
   * Initializes all cron job schedules.
   */
  init() {
    // Run daily at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
      console.log('[Cron Job] Executing scheduled daily scans...');
      try {
        await runDailyRenewalChecker();
        await this.scanBirthdays();
      } catch (err) {
        console.error('[Cron Job] Error executing daily scans:', err);
      }
    });

    console.log('[Cron Job] Scheduled jobs registered successfully.');
  },

  /**
   * Scans member birthdays and queues greetings.
   */
  async scanBirthdays() {
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // getMonth is 0-indexed
    const todayDay = today.getDate();

    // Query members with DOB
    const members = await db.member.findMany({
      where: {
        dob: {
          not: null,
        },
      },
      include: {
        gym: true,
      },
    });

    // Filter in JS since date comparison can vary by DB adapters
    const birthdayMembers = members.filter((m) => {
      if (!m.dob) return false;
      const dobDate = new Date(m.dob);
      return dobDate.getMonth() + 1 === todayMonth && dobDate.getDate() === todayDay;
    });

    console.log(`[Cron Job - Birthday] Found ${birthdayMembers.length} member(s) with birthday today.`);

    for (const member of birthdayMembers) {
      const gym = member.gym;
      const messageText = `Happy Birthday ${member.name}! Warm wishes from the team at ${gym.name}. Have a fantastic day!`;

      await queueService.queueMessage({
        gymId: gym.id,
        memberId: member.id,
        recipientPhone: member.phone,
        type: 'BIRTHDAY',
        title: `Birthday Greeting`,
        message: messageText,
        templateName: 'birthday_wish',
        templateParams: [member.name, gym.name],
      });
    }
  },
};

export default cronJobs;
