import { Router } from "express";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";

const router = Router();

// Configuration token from environment
const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

/**
 * =====================================
 * WEBHOOK VERIFICATION (META GET)
 * =====================================
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("🔍 Webhook Verification Attempt:", { mode, token });

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.error("❌ Webhook verification failed. Token mismatch.");
  return res.sendStatus(403);
});

/**
 * =====================================
 * WEBHOOK EVENT RECEIVER (META POST)
 * =====================================
 */
router.post("/", async (req, res) => {
  const body = req.body;

  // Let Meta know we received the event immediately to avoid retries
  res.sendStatus(200);

  try {
    console.log("📥 Received Webhook Event Raw Body:", JSON.stringify(body, null, 2));

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) {
      console.log("ℹ️ Webhook payload ignored (no 'value' object found).");
      return;
    }

    // Resolve matching Gym tenant by Meta Phone Number ID
    const phoneNumberId = value.metadata?.phone_number_id;
    if (!phoneNumberId) {
      console.log("ℹ️ Webhook payload ignored (no 'phone_number_id' in metadata).");
      return;
    }

    const gym = await prisma.gym.findFirst({
      where: { whatsapp_phone_number_id: phoneNumberId },
    });

    if (!gym) {
      console.warn(`⚠️ Received WhatsApp webhook for unregistered Phone ID: ${phoneNumberId}`);
      return;
    }

    console.log(`🏢 Resolved Gym Tenant: "${gym.name}" (Slug: ${gym.slug}) for Phone ID: ${phoneNumberId}`);

    /* =====================================================
       1. CUSTOMER MESSAGES (INBOUND)
       ===================================================== */
    if (value.messages?.length) {
      console.log(`💬 Processing ${value.messages.length} inbound message(s)...`);
      for (const msg of value.messages) {
        const messageId = msg.id;
        const senderPhone = msg.from;
        const recipientPhone = value.metadata.display_phone_number || "";

        // Extract message body text
        let text = "";
        if (msg.type === "text") {
          text = msg.text?.body || "";
        } else if (msg.type === "interactive") {
          const interactive = msg.interactive;
          text = interactive?.button_reply?.title || interactive?.list_reply?.title || "[interactive]";
        } else if (msg.type === "button") {
          text = msg.button?.text || "";
        } else {
          text = `[${msg.type} message]`;
        }

        console.log(`📥 Message: "${text}" from ${senderPhone} to display # ${recipientPhone} (ID: ${messageId})`);

        // Check for duplicate messages (idempotency check)
        const exists = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
        });

        if (!exists) {
          // Log message to database
          const incomingMessage = await prisma.whatsAppMessage.create({
            data: {
              gymId: gym.id,
              messageId,
              senderPhone,
              recipientPhone,
              text,
              direction: "INBOUND",
              status: "RECEIVED",
            },
          });
          console.log(`💾 Saved inbound message to database: ${messageId}`);

          // Trigger WebSocket realtime update (if active)
          try {
            const io = getIO();
            io.to(`gym:${gym.id}`).emit("whatsapp:message", incomingMessage);
            console.log(`🔌 Emitted websocket event "whatsapp:message" for Gym ID: ${gym.id}`);
          } catch (wsErr) {
            console.error("❌ Failed to emit WhatsApp WebSocket event:", wsErr.message);
          }
        } else {
          console.log(`ℹ️ Duplicate message detected (ID: ${messageId}), skipping database insert.`);
        }
      }
    }

    /* =====================================================
       2. STATUS UPDATES (OUTBOUND DELIVERIES)
       ===================================================== */
    if (value.statuses?.length) {
      console.log(`📊 Processing ${value.statuses.length} status update(s)...`);
      for (const statusObj of value.statuses) {
        const messageId = statusObj.id;
        const metaState = statusObj.status; // sent | delivered | read | failed
        const errorCode = statusObj.errors?.[0]?.code;
        const errorMessage = statusObj.errors?.[0]?.message || null;

        console.log(`📈 Outbound Status ID: ${messageId} -> State: "${metaState}" (ErrorCode: ${errorCode || "none"})`);

        // Try to update existing database message status
        const message = await prisma.whatsAppMessage.findUnique({
          where: { messageId },
        });

        if (message) {
          await prisma.whatsAppMessage.update({
            where: { messageId },
            data: {
              status: metaState.toUpperCase(),
              errorMessage: errorMessage || null,
            },
          });
          console.log(`💾 Updated status in DB for message ${messageId} to ${metaState.toUpperCase()}`);

          // Log raw event for auditing since the message exists
          await prisma.whatsAppEvent.create({
            data: {
              messageId,
              eventType: metaState.toUpperCase(),
              timestamp: new Date(Number(statusObj.timestamp) * 1000),
              rawPayload: statusObj,
            },
          });
          console.log(`💾 Logged raw WhatsApp event for message ID: ${messageId}`);
        } else {
          console.log(`⚠️ No matching outbound message found in DB for Status ID: ${messageId}. Skipping status update and event logging.`);
        }

        // Trigger WebSocket updates for status changes
        if (message) {
          try {
            const io = getIO();
            io.to(`gym:${gym.id}`).emit("whatsapp:status", {
              messageId,
              status: metaState.toUpperCase(),
              errorCode,
              errorMessage,
            });
            console.log(`🔌 Emitted websocket event "whatsapp:status" for Gym ID: ${gym.id}`);
          } catch (wsErr) {
            console.error("❌ Failed to emit status update WebSocket event:", wsErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error("❌ Error processing WhatsApp webhook payload:", err);
  }
});

export default router;
