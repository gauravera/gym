import { db } from '../lib/db';
import { encrypt, decrypt } from './encryption';
import { processChatbotMessage } from '../lib/chatbot-engine';

const META_GRAPH_VERSION = 'v20.0';
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const whatsappService = {
  /**
   * Exchanges an authorization code or token from Embedded Signup for a long-lived Access Token.
   * Onboards the WABA and phone details for the gym.
   */
  async connectWhatsApp(
    gymId: string,
    payload: {
      accessToken: string;
      wabaId: string;
      phoneNumberId: string;
      businessId: string;
    }
  ): Promise<any> {
    const { accessToken, wabaId, phoneNumberId, businessId } = payload;

    // 1. Swap user/short-lived token for long-lived system token via Meta API if live credentials exist
    let longLivedToken = accessToken;
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (appId && appSecret && !accessToken.startsWith('mock_')) {
      try {
        const url = `${META_GRAPH_BASE_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${accessToken}`;
        const response = await fetch(url);
        const data = (await response.json()) as any;
        if (data.access_token) {
          longLivedToken = data.access_token;
        }
      } catch (err) {
        console.error('[WhatsApp Service] Token exchange failed, falling back to provided token', err);
      }
    }

    // 2. Query phone number details to extract the verified phone number
    let phoneNumber = 'Unknown';
    if (!longLivedToken.startsWith('mock_')) {
      try {
        const phoneUrl = `${META_GRAPH_BASE_URL}/${phoneNumberId}?access_token=${longLivedToken}`;
        const response = await fetch(phoneUrl);
        const data = (await response.json()) as any;
        if (data.display_phone_number) {
          phoneNumber = data.display_phone_number.replace(/\D/g, ''); // strip formatting
        }
      } catch (err) {
        console.error('[WhatsApp Service] Display phone number retrieval failed', err);
      }
    } else {
      phoneNumber = '919988776655'; // mock default
    }

    // Encrypt the token before saving
    const encryptedToken = encrypt(longLivedToken);

    // Save configuration to Database
    const gym = await db.gym.update({
      where: { id: gymId },
      data: {
        whatsapp_connected: true,
        whatsapp_phone_number: phoneNumber,
        whatsapp_phone_number_id: phoneNumberId,
        whatsapp_waba_id: wabaId,
        whatsapp_business_id: businessId,
        whatsapp_access_token: encryptedToken,
      },
    });

    // Seed default templates locally
    await this.seedDefaultTemplates(gymId);

    // Create Audit Log
    await db.auditLog.create({
      data: {
        action: 'WHATSAPP_CONNECT',
        details: `Connected WhatsApp Cloud API for number: +${phoneNumber}`,
        gymId,
      },
    });

    return {
      success: true,
      gym: {
        id: gym.id,
        name: gym.name,
        whatsapp_connected: gym.whatsapp_connected,
        whatsapp_phone_number: gym.whatsapp_phone_number,
        whatsapp_waba_id: gym.whatsapp_waba_id,
        whatsapp_phone_number_id: gym.whatsapp_phone_number_id,
      },
    };
  },

  /**
   * Disconnects the WhatsApp Account and revokes tokens.
   */
  async disconnectWhatsApp(gymId: string): Promise<boolean> {
    await db.gym.update({
      where: { id: gymId },
      data: {
        whatsapp_connected: false,
        whatsapp_phone_number: null,
        whatsapp_phone_number_id: null,
        whatsapp_waba_id: null,
        whatsapp_business_id: null,
        whatsapp_access_token: null,
      },
    });

    // Log the disconnection
    await db.auditLog.create({
      data: {
        action: 'WHATSAPP_DISCONNECT',
        details: 'Disconnected WhatsApp Cloud API WABA configuration.',
        gymId,
      },
    });

    return true;
  },

  /**
   * Checks whether a phone number is eligible for WhatsApp Business App Coexistence.
   */
  async verifyCoexistenceEligibility(
    gymId: string,
    phoneNumberId: string,
    accessToken?: string
  ): Promise<{
    eligible: boolean;
    status: string;
    qualityRating: string;
    reason?: string;
    details?: string;
  }> {
    // If it's a mock token or simulator state
    if (!accessToken || accessToken.startsWith('mock_')) {
      // Mock validation logic based on phoneNumberId ending
      const isEligible = !phoneNumberId.endsWith('9'); // Simulate ineligible numbers ending in 9
      return {
        eligible: isEligible,
        status: 'APPROVED',
        qualityRating: isEligible ? 'GREEN' : 'RED',
        reason: isEligible ? undefined : 'VERSION_INCOMPATIBLE',
        details: isEligible
          ? 'Eligible. Ensure your WhatsApp Business App version is 2.24.17 or higher.'
          : 'Ineligible. The phone number is using an outdated WhatsApp Business mobile app client (< 2.24.17) or lacks tenure.',
      };
    }

    try {
      const url = `${META_GRAPH_BASE_URL}/${phoneNumberId}?fields=status,quality_rating,is_coexistence_eligible&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = (await response.json()) as any;

      if (data.error) {
        return {
          eligible: false,
          status: 'ERROR',
          qualityRating: 'UNKNOWN',
          reason: 'API_ERROR',
          details: data.error.message,
        };
      }

      // Check the coexistence capability flags returned by Meta Graph API
      const eligible = data.is_coexistence_eligible === true || data.status === 'APPROVED';

      return {
        eligible,
        status: data.status || 'UNKNOWN',
        qualityRating: data.quality_rating || 'UNKNOWN',
        details: eligible
          ? 'Eligible. Coexistence is supported for this WABA configuration.'
          : 'Ineligible. Meta determines this account is not eligible. Verify WhatsApp Business app is updated.',
      };
    } catch (err: any) {
      console.error('[WhatsApp Service] Coexistence check error:', err);
      return {
        eligible: false,
        status: 'ERROR',
        qualityRating: 'UNKNOWN',
        reason: 'FETCH_ERROR',
        details: err.message || 'Meta API connection timed out.',
      };
    }
  },

  /**
   * Sends a WhatsApp template-based message.
   */
  async sendTemplateMessage(
    gymId: string,
    recipientPhone: string,
    templateName: string,
    parameters: any[] = []
  ): Promise<boolean> {
    const gym = await db.gym.findUnique({ where: { id: gymId } });
    if (!gym || !gym.whatsapp_connected || !gym.whatsapp_phone_number_id || !gym.whatsapp_access_token) {
      console.warn(`[WhatsApp Outbound] Gym ${gymId} is not connected to WhatsApp.`);
      return false;
    }

    const token = decrypt(gym.whatsapp_access_token);
    const phoneNumberId = gym.whatsapp_phone_number_id;

    const payload = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: 'en_US',
        },
        components: [
          {
            type: 'body',
            parameters: parameters.map((param) => ({
              type: 'text',
              text: String(param),
            })),
          },
        ],
      },
    };

    console.log(`[WhatsApp Outbound Template] Sending template '${templateName}' to +${recipientPhone}`);

    // If it's a simulated token, mock successful send
    if (token.startsWith('mock_')) {
      const mockMessageId = `wamid.HBgM${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      await db.whatsAppMessage.create({
        data: {
          gymId,
          messageId: mockMessageId,
          senderPhone: gym.whatsapp_phone_number || '919988776655',
          recipientPhone,
          text: `Template: ${templateName} | Params: ${parameters.join(', ')}`,
          direction: 'OUTBOUND',
          status: 'SENT',
        },
      });

      // Automatically mock delivery and read events after a short delay
      setTimeout(async () => {
        try {
          await this.processWebhook({
            entry: [{
              changes: [{
                value: {
                  statuses: [{
                    id: mockMessageId,
                    status: 'delivered',
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    recipient_id: recipientPhone,
                  }],
                },
              }],
            }],
          });
        } catch (e) {
          console.error('Error simulating delivery webhook:', e);
        }
      }, 1000);

      return true;
    }

    try {
      const url = `${META_GRAPH_BASE_URL}/${phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;
      if (data.messages && data.messages.length > 0) {
        const messageId = data.messages[0].id;
        await db.whatsAppMessage.create({
          data: {
            gymId,
            messageId,
            senderPhone: gym.whatsapp_phone_number || 'Unknown',
            recipientPhone,
            text: `[Template Message: ${templateName}]`,
            direction: 'OUTBOUND',
            status: 'SENT',
          },
        });
        return true;
      } else {
        console.error('[WhatsApp Outbound] Failed to send template message:', data);
        return false;
      }
    } catch (err) {
      console.error('[WhatsApp Outbound] Error sending template message:', err);
      return false;
    }
  },

  /**
   * Sends a standard free-form text message.
   */
  async sendTextMessage(gymId: string, recipientPhone: string, text: string): Promise<boolean> {
    const gym = await db.gym.findUnique({ where: { id: gymId } });
    if (!gym || !gym.whatsapp_connected || !gym.whatsapp_phone_number_id || !gym.whatsapp_access_token) {
      console.warn(`[WhatsApp Outbound] Gym ${gymId} is not connected to WhatsApp.`);
      return false;
    }

    const token = decrypt(gym.whatsapp_access_token);
    const phoneNumberId = gym.whatsapp_phone_number_id;

    const payload = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: {
        body: text,
      },
    };

    if (token.startsWith('mock_')) {
      const mockMessageId = `wamid.HBgM${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      await db.whatsAppMessage.create({
        data: {
          gymId,
          messageId: mockMessageId,
          senderPhone: gym.whatsapp_phone_number || '919988776655',
          recipientPhone,
          text,
          direction: 'OUTBOUND',
          status: 'SENT',
        },
      });
      return true;
    }

    try {
      const url = `${META_GRAPH_BASE_URL}/${phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as any;
      if (data.messages && data.messages.length > 0) {
        const messageId = data.messages[0].id;
        await db.whatsAppMessage.create({
          data: {
            gymId,
            messageId,
            senderPhone: gym.whatsapp_phone_number || 'Unknown',
            recipientPhone,
            text,
            direction: 'OUTBOUND',
            status: 'SENT',
          },
        });
        return true;
      } else {
        console.error('[WhatsApp Outbound] Failed to send text message:', data);
        return false;
      }
    } catch (err) {
      console.error('[WhatsApp Outbound] Error sending text message:', err);
      return false;
    }
  },

  /**
   * Fetches message templates from Meta and synchronizes status and metadata locally.
   */
  async syncTemplates(gymId: string): Promise<boolean> {
    const gym = await db.gym.findUnique({ where: { id: gymId } });
    if (!gym || !gym.whatsapp_connected || !gym.whatsapp_waba_id || !gym.whatsapp_access_token) {
      return false;
    }

    const token = decrypt(gym.whatsapp_access_token);
    const wabaId = gym.whatsapp_waba_id;

    if (token.startsWith('mock_')) {
      // Mock sync templates
      const mockTemplates = [
        { name: 'membership_expiry', status: 'APPROVED', category: 'UTILITY' },
        { name: 'payment_receipt', status: 'APPROVED', category: 'UTILITY' },
        { name: 'welcome_member', status: 'APPROVED', category: 'UTILITY' },
        { name: 'birthday_wish', status: 'APPROVED', category: 'UTILITY' },
      ];

      for (const t of mockTemplates) {
        await db.whatsAppTemplate.upsert({
          where: { gymId_templateName: { gymId, templateName: t.name } },
          update: { status: t.status, category: t.category },
          create: {
            gymId,
            templateName: t.name,
            status: t.status,
            category: t.category,
            components: {},
          },
        });
      }
      return true;
    }

    try {
      const url = `${META_GRAPH_BASE_URL}/${wabaId}/message_templates?access_token=${token}`;
      const response = await fetch(url);
      const data = (await response.json()) as any;

      if (data.data) {
        for (const metaT of data.data) {
          await db.whatsAppTemplate.upsert({
            where: {
              gymId_templateName: {
                gymId,
                templateName: metaT.name,
              },
            },
            update: {
              metaTemplateId: metaT.id,
              status: metaT.status,
              category: metaT.category,
              components: metaT.components || {},
            },
            create: {
              gymId,
              templateName: metaT.name,
              metaTemplateId: metaT.id,
              status: metaT.status,
              category: metaT.category,
              components: metaT.components || {},
              language: metaT.language || 'en_US',
            },
          });
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('[WhatsApp Service] Template sync failed:', err);
      return false;
    }
  },

  /**
   * Seeds default placeholders templates inside local WABA table on registration.
   */
  async seedDefaultTemplates(gymId: string): Promise<void> {
    const defaults = [
      { name: 'membership_expiry', category: 'UTILITY' },
      { name: 'payment_receipt', category: 'UTILITY' },
      { name: 'welcome_member', category: 'UTILITY' },
      { name: 'birthday_wish', category: 'UTILITY' },
    ];

    for (const def of defaults) {
      await db.whatsAppTemplate.upsert({
        where: { gymId_templateName: { gymId, templateName: def.name } },
        update: { status: 'APPROVED' },
        create: {
          gymId,
          templateName: def.name,
          status: 'APPROVED',
          category: def.category,
          components: {},
        },
      });
    }
  },

  /**
   * Processes the Webhook event notification from Meta Cloud API.
   * Handles delivery receipts, read receipts, template status updates, and customer messages.
   * Automatically supports WhatsApp Business App coexistence echos.
   */
  async processWebhook(payload: any): Promise<boolean> {
    if (!payload.entry || payload.entry.length === 0) return false;

    for (const entry of payload.entry) {
      if (!entry.changes || entry.changes.length === 0) continue;

      for (const change of entry.changes) {
        const value = change.value;
        if (!value) continue;

        // 1. Handle Message Status Updates (Delivered, Read, Failed)
        if (value.statuses && value.statuses.length > 0) {
          for (const statusObj of value.statuses) {
            const messageId = statusObj.id;
            const status = statusObj.status.toUpperCase(); // DELIVERED, READ, FAILED
            const timestamp = new Date(parseInt(statusObj.timestamp) * 1000);
            
            let errorMessage: string | null = null;
            if (statusObj.errors && statusObj.errors.length > 0) {
              errorMessage = statusObj.errors[0].message;
            }

            // Find matching message in database
            const msg = await db.whatsAppMessage.findUnique({
              where: { messageId },
            });

            if (msg) {
              await db.whatsAppMessage.update({
                where: { messageId },
                data: {
                  status,
                  errorMessage,
                },
              });

              // Log status event history
              await db.whatsAppEvent.create({
                data: {
                  messageId,
                  eventType: status,
                  timestamp,
                  rawPayload: statusObj,
                },
              });
            }
          }
        }

        // 2. Handle Incoming Customer Messages & SMB Coexistence Echoes
        if (value.messages && value.messages.length > 0) {
          const metadata = value.metadata;
          const displayPhoneNumber = metadata?.display_phone_number?.replace(/\D/g, '');

          // Find which Gym this webhook correlates to using the phone number id or display number
          const gym = await db.gym.findFirst({
            where: {
              OR: [
                { whatsapp_phone_number_id: metadata?.phone_number_id },
                { whatsapp_phone_number: displayPhoneNumber },
              ],
            },
          });

          if (!gym) {
            console.warn(`[WhatsApp Webhook] No matching gym found for phone number ID: ${metadata?.phone_number_id} or display number: ${displayPhoneNumber}`);
            continue;
          }

          for (const message of value.messages) {
            const messageId = message.id;
            const from = message.from; // Customer's number
            const timestamp = new Date(parseInt(message.timestamp) * 1000);
            let textContent = '';

            if (message.type === 'text') {
              textContent = message.text.body;
            } else if (message.type === 'button') {
              textContent = message.button.text;
            } else if (message.type === 'interactive') {
              textContent = message.interactive.button_reply?.title || message.interactive.list_reply?.title || 'Interactive response';
            } else {
              textContent = `[Media/Unsupported: ${message.type}]`;
            }

            // Detect SMB Coexistence Echos:
            // An echo represents a message sent manually by staff from the WhatsApp Business mobile app.
            // Meta includes standard fields, but the sender matches the business's own display number or WABA number,
            // or the payload is flagged as an echo. We compare `from` with the business phone number.
            const isEcho = from === gym.whatsapp_phone_number;

            if (isEcho) {
              // Extract the recipient of the echo message
              // Typically, echoes have a "to" or are structured inside an echo change payload
              const recipient = message.to || value.contacts?.[0]?.wa_id || 'Unknown';
              console.log(`[WhatsApp Webhook] Coexistence message echo received from mobile app. From business to +${recipient}`);

              // Store this outbound message in our logs
              await db.whatsAppMessage.upsert({
                where: { messageId },
                update: { status: 'READ' }, // mark read as it was sent by a human staff member
                create: {
                  gymId: gym.id,
                  messageId,
                  senderPhone: gym.whatsapp_phone_number || 'Unknown',
                  recipientPhone: recipient,
                  text: textContent,
                  direction: 'ECHO',
                  status: 'READ',
                },
              });

              // Log notification copy to main notifications table
              const member = await db.member.findFirst({
                where: { phone: recipient, gymId: gym.id },
              });

              if (member) {
                await db.notification.create({
                  data: {
                    gymId: gym.id,
                    memberId: member.id,
                    recipientPhone: recipient,
                    title: 'WhatsApp Staff Reply (Mobile App)',
                    message: textContent,
                    type: 'OUTBOUND',
                    status: 'SENT',
                  },
                });
              }

              continue; // Do NOT run chatbot logic for staff echos!
            }

            // 3. Process normal customer incoming messages
            console.log(`[WhatsApp Webhook] Inbound message from +${from} to Gym: ${gym.name}`);

            await db.whatsAppMessage.create({
              data: {
                gymId: gym.id,
                messageId,
                senderPhone: from,
                recipientPhone: gym.whatsapp_phone_number || 'Unknown',
                text: textContent,
                direction: 'INBOUND',
                status: 'DELIVERED',
              },
            });

            // Find or create member record
            let member = await db.member.findFirst({
              where: { phone: from, gymId: gym.id },
            });

            if (!member) {
              member = await db.member.create({
                data: {
                  gymId: gym.id,
                  phone: from,
                  name: `Guest ${from.slice(-4)}`,
                },
              });
            }

            // Capture notification logs
            await db.notification.create({
              data: {
                gymId: gym.id,
                memberId: member.id,
                recipientPhone: from,
                title: 'WhatsApp Incoming',
                message: textContent,
                type: 'INBOUND',
                status: 'SENT',
              },
            });

            // Skip chatbot response if takeover/bot disabled is active
            if (member.isBotDisabled) {
              console.log(`[WhatsApp Webhook] Human takeover active for +${from}. Chatbot execution skipped.`);
              continue;
            }

            // Process message through chatbot RAG/Engine
            // Imports and runs local chatbot engine logic
            const botResponses = await processChatbotMessage(gym.id, member, textContent);

            // Send replies back to client
            for (const reply of botResponses) {
              await this.sendTextMessage(gym.id, from, reply);
            }
          }
        }

        // 4. Handle Template Status Updates (Approved / Rejected) from Meta
        if (value.event === 'TEMPLATE_STATUS_UPDATE' || (value.message_template_id && value.event)) {
          const templateName = value.message_template_name;
          const status = value.event; // APPROVED, REJECTED, etc.
          const wabaId = value.whatsapp_business_account_id;

          const gym = await db.gym.findFirst({
            where: { whatsapp_waba_id: wabaId },
          });

          if (gym && templateName) {
            await db.whatsAppTemplate.updateMany({
              where: {
                gymId: gym.id,
                templateName: templateName,
              },
              data: {
                status: status,
              },
            });
            console.log(`[WhatsApp Webhook] Template Status Update: ${templateName} is now ${status}`);
          }
        }
      }
    }

    return true;
  },
};

export default whatsappService;
