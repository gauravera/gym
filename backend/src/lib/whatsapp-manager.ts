import { db } from './db';
import { processChatbotMessage } from './chatbot-engine';

// Mock connection registry to store active sessions / simulated messages
interface ActiveConnection {
  gymId: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'INITIALIZING' | 'QR_READY';
  qrCode?: string;
  socket?: any; // For actual Baileys socket in real environment
}

const activeConnections = new Map<string, ActiveConnection>();

export const whatsappManager = {
  /**
   * Initializes a WhatsApp session for a Gym tenant.
   * If in simulation or if Baileys isn't paired yet, it updates database session status.
   */
  async initializeSession(gymId: string): Promise<ActiveConnection> {
    let connection = activeConnections.get(gymId);

    if (!connection) {
      connection = {
        gymId,
        status: 'INITIALIZING',
      };
      activeConnections.set(gymId, connection);
    }

    // Set a simulated QR Code to demonstrate connection capability
    const simulatedQR = `https://whatsapp.com/pair?gym=${gymId}&t=${Date.now()}`;
    connection.status = 'QR_READY';
    connection.qrCode = simulatedQR;

    // Persist session state in Database
    await db.whatsappSession.upsert({
      where: { gymId },
      update: {
        status: 'QR_READY',
        qrCode: simulatedQR,
      },
      create: {
        gymId,
        status: 'QR_READY',
        qrCode: simulatedQR,
      },
    });

    // Start background recovery checking if needed
    this.monitorSession(gymId);

    return connection;
  },

  /**
   * Recovers/reconnects an existing session.
   */
  async recoverSession(gymId: string): Promise<boolean> {
    const session = await db.whatsappSession.findUnique({ where: { gymId } });
    if (session && session.status === 'CONNECTED') {
      activeConnections.set(gymId, {
        gymId,
        status: 'CONNECTED',
      });
      return true;
    }
    return false;
  },

  /**
   * Activates/Connects a WhatsApp session.
   */
  async connectSession(gymId: string): Promise<void> {
    const connection = activeConnections.get(gymId) || { gymId, status: 'CONNECTED' };
    connection.status = 'CONNECTED';
    connection.qrCode = undefined;
    activeConnections.set(gymId, connection);

    await db.whatsappSession.upsert({
      where: { gymId },
      update: {
        status: 'CONNECTED',
        qrCode: null,
      },
      create: {
        gymId,
        status: 'CONNECTED',
        qrCode: null,
      },
    });
  },

  /**
   * Monitors session and auto-reconnects on disconnection.
   */
  monitorSession(gymId: string) {
    // In production, listens to socket 'close' and calls re-initialization
    console.log(`[WhatsApp Monitor] Monitoring session for gym ID: ${gymId}`);
  },

  /**
   * Disconnects/logs out of the WhatsApp session.
   */
  async disconnectSession(gymId: string): Promise<void> {
    activeConnections.delete(gymId);

    await db.whatsappSession.upsert({
      where: { gymId },
      update: {
        status: 'DISCONNECTED',
        qrCode: null,
      },
      create: {
        gymId,
        status: 'DISCONNECTED',
        qrCode: null,
      },
    });
  },

  /**
   * Sends a message to a recipient's phone number.
   * Scopes message by gymId. Saves notification for tracking.
   */
  async sendMessage(gymId: string, recipientPhone: string, text: string, type: string = 'CHATBOT'): Promise<boolean> {
    console.log(`[WhatsApp Outbound] Gym: ${gymId} | To: ${recipientPhone} | Msg: ${text}`);

    // Fetch member to link the notification
    const member = await db.member.findFirst({
      where: { phone: recipientPhone, gymId },
    });

    if (member) {
      await db.notification.create({
        data: {
          gymId,
          memberId: member.id,
          recipientPhone,
          title: `WhatsApp ${type}`,
          message: text,
          type,
          status: 'SENT',
        },
      });
    }

    return true;
  },

  /**
   * Simulates receiving an incoming WhatsApp message.
   * This is used by the simulator and API webhooks to process chatbot menus.
   */
  async receiveMessage(gymId: string, phone: string, text: string): Promise<string[]> {
    console.log(`[WhatsApp Inbound] Gym: ${gymId} | From: ${phone} | Msg: ${text}`);

    // Find or create member automatically to preserve isolation
    let member = await db.member.findFirst({
      where: { phone, gymId },
    });

    if (!member) {
      member = await db.member.create({
        data: {
          gymId,
          phone,
          name: `Guest ${phone.slice(-4)}`,
        },
      });
    }

    // Capture Notification in Logs
    await db.notification.create({
      data: {
        gymId,
        memberId: member.id,
        recipientPhone: phone,
        title: 'WhatsApp Incoming',
        message: text,
        type: 'INBOUND',
        status: 'SENT',
      },
    });

    // Check if human takeover is active
    if (member.isBotDisabled) {
      console.log(`[WhatsApp Inbound] Human takeover active for ${phone}. Bot response skipped.`);
      return [];
    }

    // Process through the chatbot state engine
    const botResponses = await processChatbotMessage(gymId, member, text);

    // Send the bot responses back
    for (const response of botResponses) {
      await this.sendMessage(gymId, phone, response, 'CHATBOT');
    }

    return botResponses;
  },
};
export default whatsappManager;
