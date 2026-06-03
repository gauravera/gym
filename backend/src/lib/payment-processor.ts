import { db } from './db';

interface UpiPaymentDetails {
  upiUrl: string;
  qrImageUrl: string;
}

/**
 * Generates dynamic UPI URI and dynamic QR Code image URL.
 */
export function generateUpiPaymentDetails(
  upiId: string,
  upiName: string,
  amount: number,
  transactionId: string
): UpiPaymentDetails {
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(upiName)}&am=${amount}&tr=${transactionId}&tn=${encodeURIComponent(`Gym-Plan-${transactionId.slice(-6)}`)}`;
  
  // Public, free, fast QR Code API
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiUrl)}&margin=10`;

  return {
    upiUrl,
    qrImageUrl,
  };
}

/**
 * Generates Razorpay checkout session links or mock payment page links.
 */
export async function createRazorpayPaymentLink(
  gym: any,
  member: any,
  plan: any,
  transactionId: string
): Promise<string> {
  const razorpayKey = gym.paymentSettings?.razorpayKeyId || 'rzp_test_mockKey12345';
  
  // Return a sleek public simulated checkout endpoint for Razorpay testing
  // Allows testing the Razorpay webhook without needing live credentials!
  return `/dashboard/${gym.slug}/payments/mock-gateway?transactionId=${transactionId}&amount=${plan.price}&key=${razorpayKey}&member=${encodeURIComponent(member.name)}`;
}

/**
 * Core business transaction: Approves a transaction, activates membership, generates invoice & notifies member.
 */
export async function approveTransaction(transactionId: string, approverUserId?: string): Promise<boolean> {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { member: true, plan: true, gym: true },
    });

    if (!transaction || transaction.status === 'PAID') return false;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + transaction.plan.durationDays);

    await db.$transaction(async (tx: any) => {
      // 1. Mark transaction as PAID
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'PAID' },
      });

      // 2. Deactivate any existing active memberships
      await tx.membership.updateMany({
        where: {
          memberId: transaction.memberId,
          gymId: transaction.gymId,
          status: 'ACTIVE',
        },
        data: { status: 'EXPIRED' },
      });

      // 3. Create active Membership
      const membership = await tx.membership.create({
        data: {
          memberId: transaction.memberId,
          planId: transaction.planId,
          startDate,
          endDate,
          status: 'ACTIVE',
          gymId: transaction.gymId,
        },
      });

      // 4. Create Invoice
      const invoiceNumber = `INV-${Date.now()}-${transactionId.slice(-4).toUpperCase()}`;
      await tx.invoice.create({
        data: {
          transactionId,
          invoiceNumber,
          gymId: transaction.gymId,
        },
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          action: 'TRANSACTION_APPROVE',
          details: `Approved transaction ${transactionId} for plan ${transaction.plan.name}`,
          gymId: transaction.gymId,
          userId: approverUserId,
        },
      });

      // 6. Create Notification for Payment Receipt
      await tx.notification.create({
        data: {
          gymId: transaction.gymId,
          memberId: transaction.memberId,
          recipientPhone: transaction.member.phone,
          title: `TEMPLATE:payment_receipt:${transaction.member.name},${transaction.plan.name},${transaction.amount}`,
          message: `Dear ${transaction.member.name}, your payment of ₹${transaction.amount} for ${transaction.plan.name} has been received! Expiry: ${endDate.toLocaleDateString('en-IN')}. Thank you!`,
          type: 'PAYMENT_RECEIVED',
          status: 'PENDING',
        },
      });
    });

    return true;
  } catch (error) {
    console.error('Approve Transaction error:', error);
    return false;
  }
}

/**
 * Rejects a manual transaction payment.
 */
export async function rejectTransaction(transactionId: string, reason: string, rejecterUserId?: string): Promise<boolean> {
  try {
    const transaction = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { member: true, plan: true },
    });

    if (!transaction || transaction.status !== 'AWAITING_VERIFICATION') return false;

    await db.$transaction(async (tx: any) => {
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: 'REJECTED' },
      });

      await tx.auditLog.create({
        data: {
          action: 'TRANSACTION_REJECT',
          details: `Rejected transaction ${transactionId} for plan ${transaction.plan.name}. Reason: ${reason}`,
          gymId: transaction.gymId,
          userId: rejecterUserId,
        },
      });

      await tx.notification.create({
        data: {
          gymId: transaction.gymId,
          memberId: transaction.memberId,
          recipientPhone: transaction.member.phone,
          title: 'Payment Rejected',
          message: `Dear ${transaction.member.name}, your payment verification request for ${transaction.plan.name} was rejected by staff. Reason: ${reason || 'Reference ID mismatch'}. Please try again or contact support.`,
          type: 'PAYMENT_REJECTED',
          status: 'PENDING',
        },
      });
    });

    return true;
  } catch (error) {
    console.error('Reject Transaction error:', error);
    return false;
  }
}
export default generateUpiPaymentDetails;
