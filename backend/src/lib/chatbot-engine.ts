import { db } from './db';
import { getAiChatbotResponse } from './rag-service';
import { generateUpiPaymentDetails, createRazorpayPaymentLink } from './payment-processor';

/**
 * Main state machine for processing chatbot inputs.
 * Returns an array of text messages to send back to the member.
 */
export async function processChatbotMessage(
  gymId: string,
  member: { id: string; name: string; phone: string },
  text: string
): Promise<string[]> {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Fetch gym details
  const gym = await db.gym.findUnique({
    where: { id: gymId },
    include: {
      chatbotSettings: true,
      paymentSettings: true,
      plans: true,
    },
  });

  if (!gym) {
    return ['System error: Gym profile not found. Please contact support.'];
  }

  const chatbotSettings = gym.chatbotSettings;
  const paymentSettings = gym.paymentSettings;
  const welcomeText = chatbotSettings?.welcomeMessage.replace('{{gym_name}}', gym.name) || `Welcome to ${gym.name}!`;

  // 1. Check for manual payment confirmation: "PAID <refId>"
  if (lower.startsWith('paid')) {
    const refId = trimmed.slice(4).trim();
    if (!refId) {
      return ['⚠️ Please provide the transaction ID. Example: "PAID TXN123456"'];
    }

    // Find the latest pending transaction for this member
    const lastPendingTxn = await db.transaction.findFirst({
      where: {
        memberId: member.id,
        status: 'PENDING',
        gymId,
      },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });

    if (!lastPendingTxn) {
      return ['❌ No pending subscription request found. Type "2" to view plans and renew.'];
    }

    // Update transaction to AWAITING_VERIFICATION
    await db.transaction.update({
      where: { id: lastPendingTxn.id },
      data: {
        status: 'AWAITING_VERIFICATION',
        referenceId: refId,
      },
    });

    // Create Audit Log
    await db.auditLog.create({
      data: {
        action: 'TRANSACTION_SUBMIT',
        details: `Member submitted transaction verification for ${lastPendingTxn.plan.name} (Ref: ${refId})`,
        gymId,
      },
    });

    // Send WhatsApp notification alert
    await db.notification.create({
      data: {
        gymId,
        memberId: member.id,
        recipientPhone: member.phone,
        title: 'Payment Submitted',
        message: `Your payment verification request for ${lastPendingTxn.plan.name} has been submitted. Our team will verify and activate it shortly.`,
        type: 'PAYMENT_RECEIVED',
        status: 'SENT',
      },
    });

    return [
      `✅ Payment Submitted!`,
      `We have received your payment reference: *${refId}* for the plan *${lastPendingTxn.plan.name}* (₹${lastPendingTxn.amount}).`,
      `Status: *Pending Verification* ⏳\nOur staff will verify the receipt and activate your membership shortly. You will receive an instant WhatsApp confirmation.`,
    ];
  }

  // 2. Check for plan selection: "P<index>" (e.g. P1, P2)
  if (/^p\d+$/i.test(lower)) {
    const planIndex = parseInt(trimmed.substring(1)) - 1;
    const plans = gym.plans;

    if (planIndex < 0 || planIndex >= plans.length) {
      return [`⚠️ Invalid choice. Please reply with a valid plan number, e.g., "P1", "P2".`];
    }

    const selectedPlan = plans[planIndex];

    // Create a Pending Transaction
    const transaction = await db.transaction.create({
      data: {
        amount: selectedPlan.price,
        status: 'PENDING',
        paymentMode: paymentSettings?.isRazorpayEnabled ? 'RAZORPAY' : 'MANUAL_UPI',
        memberId: member.id,
        planId: selectedPlan.id,
        gymId,
      },
    });

    // Handle Payment Modes
    if (paymentSettings?.isRazorpayEnabled && paymentSettings.razorpayKeyId) {
      // Razorpay Integration Link Generation
      const paymentLink = await createRazorpayPaymentLink(gym, member, selectedPlan, transaction.id);
      
      return [
        `💳 *Subscription Order Created!*`,
        `Plan: *${selectedPlan.name}*\nAmount: *₹${selectedPlan.price}*\nDuration: *${selectedPlan.durationDays} Days*`,
        `Please click the link below to complete your secure payment via card, UPI, netbanking or wallets:`,
        `👉 ${paymentLink}`,
        `⚡ Membership activates immediately upon payment success.`,
      ];
    } else {
      // Manual UPI Mode
      const upiId = paymentSettings?.upiId || 'payment@upi';
      const upiName = paymentSettings?.upiName || gym.name;

      const upiDetails = generateUpiPaymentDetails(upiId, upiName, selectedPlan.price, transaction.id);

      return [
        `🏋️ *Subscription Request Generated!*`,
        `Plan: *${selectedPlan.name}*\nAmount: *₹${selectedPlan.price}*\nDuration: *${selectedPlan.durationDays} Days*`,
        `---`,
        `📲 *Pay via any UPI App (GPay, PhonePe, Paytm):*`,
        `UPI ID: \`${upiId}\`\nName: *${upiName}*\nAmount: *₹${selectedPlan.price}*`,
        `👉 Click to pay: ${upiDetails.upiUrl}`,
        `---`,
        `🖼️ *UPI QR Code URL:*`,
        `${upiDetails.qrImageUrl}`,
        `---`,
        `⚠️ *Action Required:*`,
        `Once paid, reply to this chat with:`,
        `*PAID <your-transaction-reference-number>*`,
        `Example: _PAID 6539201739_`,
      ];
    }
  }

  // 3. Handle basic main menu selections
  switch (trimmed) {
    case '1': {
      // My Membership
      const activeMembership = await db.membership.findFirst({
        where: {
          memberId: member.id,
          status: 'ACTIVE',
          gymId,
        },
        include: { plan: true },
      });

      if (!activeMembership) {
        return [
          `ℹ️ *Membership Status*`,
          `Name: *${member.name}*`,
          `Plan: *No Active Membership* ❌`,
          `---`,
          `Reply with *2* to check our plans and join today!`,
        ];
      }

      const today = new Date();
      const diffTime = activeMembership.endDate.getTime() - today.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      return [
        `ℹ️ *Membership Status*`,
        `Name: *${member.name}*`,
        `Current Plan: *${activeMembership.plan.name}*`,
        `Expiry Date: *${activeMembership.endDate.toLocaleDateString('en-IN')}*`,
        `Days Remaining: *${daysRemaining} days* ${daysRemaining > 0 ? '✅' : '⚠️'}`,
        `---`,
        `Reply *2* to extend or renew.`,
      ];
    }

    case '2': {
      // Renew Membership
      if (gym.plans.length === 0) {
        return [`We are currently updating our plans. Please type "4" to contact staff directly.`];
      }

      const planList = gym.plans
        .map((p: any, idx: number) => `*P${idx + 1}*. ${p.name} — *₹${p.price}* (${p.durationDays} Days)\n_${p.description || 'Access to all gym zones'}_`)
        .join('\n\n');

      return [
        `🏆 *Renew / Change Membership*`,
        `Choose a subscription plan to continue:`,
        `---`,
        planList,
        `---`,
        `👉 *Reply with the Option Code (e.g. P1, P2) to generate your payment link.*`,
      ];
    }

    case '3': {
      // View Plans
      if (gym.plans.length === 0) {
        return [`No active membership plans found. Please check back later or contact staff.`];
      }

      const planList = gym.plans
        .map((p: any, idx: number) => `*${idx + 1}. ${p.name}* - ₹${p.price}\nDuration: ${p.durationDays} Days\nDescription: ${p.description || 'Normal entry'}`)
        .join('\n\n');

      return [`📋 *Gym Membership Plans*`, planList, `Reply *2* to choose and subscribe!`];
    }

    case '4': {
      // Contact Gym
      const contactMsg = `📞 *Contact ${gym.name}*\n\nReach our trainers or managers directly:\n- Phone: ${member.phone.replace(/\d{4}$/, 'XXXX')}\n- Email: support@${gym.slug}.com\n- Address: Gym main reception desk.\n\nTimings: Mon-Sat: 6:00 AM - 10:00 PM`;
      return [contactMsg];
    }

    case '5': {
      // Offers
      return [
        `🎁 *Exclusive Member Offers*`,
        `1. *Annual Elite Bonus*: Pay for Annual Elite and get 2 free Personal Trainer sessions!`,
        `2. *Quarterly Pro Discount*: Pay quarterly and save ₹500 over monthly plan.`,
        `3. *Friend Referral*: Refer a friend and get 7 days added to your membership upon their signup!`,
      ];
    }

    default: {
      // 4. Handle optional AI Mode (RAG Engine)
      if (chatbotSettings?.isAiModeEnabled) {
        const aiResponse = await getAiChatbotResponse(gymId, member.id, trimmed);
        if (aiResponse) {
          return [aiResponse];
        }
      }

      // Default fallback: show welcome menu
      return [
        `Hello *${member.name}*! 👋`,
        welcomeText,
        `---`,
        `👉 *Please reply with a option number (1 - 5) or type your question.*`,
      ];
    }
  }
}
export default processChatbotMessage;
