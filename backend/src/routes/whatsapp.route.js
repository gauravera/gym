import { Router } from "express";
import prisma from "../prisma.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireRoles } from "../middleware/requireRole.middleware.js";
import { encrypt, decrypt } from "../utils/encryption.js";

const router = Router({ mergeParams: true });

/**
 * Helper → Generate PIN
 */
const generatePin = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

/**
 * Helper → Register Phone Number
 */
const registerPhoneNumber = async (phoneNumberId, token) => {
  const pin = generatePin();

  const resp = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}/register`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        pin,
      }),
    }
  );

  const data = await resp.json();

  if (!resp.ok) {
    if (data?.error?.code === 131045 || data?.error?.code === 133005) {
      console.log(`✅ Number already active/registered (Meta Error Code: ${data?.error?.code})`);
      return { success: true };
    }

    return { success: false, error: data };
  }

  console.log("✅ Number registered");
  return { success: true };
};

/**
 * Helper → Subscribe App
 */
const subscribeApp = async (whatsappBusinessId, token) => {
  const resp = await fetch(
    `https://graph.facebook.com/v20.0/${whatsappBusinessId}/subscribed_apps`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await resp.json();

  if (!resp.ok) {
    if (data?.error?.message?.includes("already subscribed")) {
      console.log("✅ App already subscribed");
      return { success: true };
    }

    return { success: false, error: data };
  }

  console.log("✅ App subscribed");
  return { success: true };
};

/**
 * Helper → Fetch Phone Details
 */
const fetchPhoneDetails = async (phoneNumberId, token) => {
  const resp = await fetch(
    `https://graph.facebook.com/v20.0/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status,quality_rating,platform_type,status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err?.error?.message || "Failed to fetch phone number details from Meta");
  }
  return await resp.json();
};

/**
 * Helper → Fetch Messaging limit tier
 */
const fetchMessagingTier = async (whatsappBusinessId, phoneNumberId, token) => {
  try {
    const resp = await fetch(
      `https://graph.facebook.com/v20.0/${whatsappBusinessId}/phone_numbers`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) return "UNKNOWN";
    const data = await resp.json();
    if (data?.data && Array.isArray(data.data)) {
      const numberObj = data.data.find((n) => n.id === phoneNumberId);
      if (numberObj) {
        return numberObj.messaging_limit_tier || "UNKNOWN";
      }
    }
    return "UNKNOWN";
  } catch (e) {
    console.error("Could not fetch tier", e);
    return "UNKNOWN";
  }
};

/**
 * =====================================
 * GET WHATSAPP STATUS (SAFE)
 * =====================================
 * Access: authenticated (GYM_OWNER, STAFF, SUPERADMIN)
 */
router.get(
  "/status",
  authenticateToken,
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
        select: {
          id: true,
          whatsapp_connected: true,
          whatsapp_phone_number_id: true,
          whatsapp_waba_id: true,
          whatsapp_business_id: true,
          whatsappStatus: true,
          whatsappVerifiedAt: true,
          whatsappLastError: true,
          whatsappVerificationStatus: true,
          whatsappQualityRating: true,
          whatsappMessagingTier: true,
          whatsappVerifiedName: true,
          whatsappDisplayPhoneNumber: true,
        },
      });

      if (!gym) {
        return res.status(404).json({ error: "Gym not found" });
      }

      // Fetch message counts for analytics
      const messageStats = await prisma.whatsAppMessage.groupBy({
        by: ["status"],
        where: { gymId: gym.id },
        _count: { _all: true },
      });

      const analytics = {
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 0,
        total: 0,
      };

      messageStats.forEach((stat) => {
        const count = stat._count._all;
        analytics.total += count;
        if (stat.status === "SENT") analytics.sent += count;
        if (stat.status === "DELIVERED") analytics.delivered += count;
        if (stat.status === "READ") analytics.read += count;
        if (stat.status === "FAILED") analytics.failed += count;
      });

      // Fetch synced templates
      const templates = await prisma.whatsAppTemplate.findMany({
        where: { gymId: gym.id },
        select: {
          id: true,
          templateName: true,
          status: true,
          category: true,
          language: true,
        },
      });

      res.json({
        connected: gym.whatsapp_connected,
        phoneNumber: gym.whatsappDisplayPhoneNumber || null,
        phoneNumberId: gym.whatsapp_phone_number_id || null,
        wabaId: gym.whatsapp_waba_id || null,
        businessId: gym.whatsapp_business_id || null,
        facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || null,
        facebookConfigId: process.env.NEXT_PUBLIC_FB_SIGNUP_CONFIG_ID || null,
        whatsappVerificationStatus: gym.whatsappVerificationStatus || "NOT_VERIFIED",
        whatsappQualityRating: gym.whatsappQualityRating || "UNKNOWN",
        whatsappMessagingTier: gym.whatsappMessagingTier || "UNKNOWN",
        whatsappVerifiedName: gym.whatsappVerifiedName || null,
        whatsappDisplayPhoneNumber: gym.whatsappDisplayPhoneNumber || null,
        analytics,
        templates,
      });
    } catch (err) {
      console.error("Status check error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * =====================================
 * CONNECT WHATSAPP MANUALLY
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/connect",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { wabaId, phoneNumberId, accessToken, businessId } = req.body;
    const { gymSlug } = req.params;

    if (!wabaId || !phoneNumberId || !accessToken) {
      return res.status(400).json({
        error: "WABA ID, Phone Number ID, and Access Token are required",
      });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        return res.status(404).json({ error: "Gym not found" });
      }

      // 1️⃣ Validate credentials with Meta API
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      const whatsappVerificationStatus = phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber = phoneData?.display_phone_number || null;

      // 2️⃣ Fetch Limit Tier
      const whatsappMessagingTier = await fetchMessagingTier(wabaId, phoneNumberId, accessToken);

      // 3️⃣ Attempt to Register Phone Number
      const isTestNumber =
        whatsappVerifiedName?.toLowerCase() === "test number" ||
        whatsappDisplayPhoneNumber?.replace(/\D/g, "").startsWith("1555");
      const isAlreadyCloudAPI = phoneData?.platform_type === "CLOUD_API";

      if (!isTestNumber && !isAlreadyCloudAPI) {
        const registration = await registerPhoneNumber(phoneNumberId, accessToken);
        if (!registration.success) {
          return res.status(400).json({
            error: "Phone number registration failed",
            metaError: registration.error,
          });
        }
      }

      // 4️⃣ Attempt to Subscribe App
      const subscription = await subscribeApp(wabaId, accessToken);
      if (!subscription.success) {
        return res.status(400).json({
          error: "Webhook subscription failed",
          metaError: subscription.error,
        });
      }

      // 5️⃣ Encrypt token & save
      const encryptedToken = encrypt(accessToken);

      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsapp_connected: true,
          whatsapp_waba_id: wabaId,
          whatsapp_phone_number_id: phoneNumberId,
          whatsapp_business_id: businessId || wabaId,
          whatsapp_access_token: encryptedToken,
          whatsappStatus: "connected",
          whatsappVerifiedAt: new Date(),
          whatsappLastError: null,
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappMessagingTier,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
      });

      res.json({
        success: true,
        message: "WhatsApp successfully connected manually",
      });
    } catch (err) {
      console.error("Manual connect error:", err);
      res.status(400).json({ error: err.message || "Manual setup connection failed" });
    }
  }
);

/**
 * =====================================
 * EMBEDDED SIGNUP CALLBACK
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/embedded-setup",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { code, wabaId, phoneNumberId, businessId } = req.body;
    const { gymSlug } = req.params;

    if (!code || !wabaId || !phoneNumberId) {
      return res.status(400).json({ error: "Missing required embedded signup data" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        return res.status(404).json({ error: "Gym not found" });
      }

      const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      if (!appId || !appSecret) {
        return res.status(500).json({ error: "Meta App settings missing on backend server" });
      }

      // 1️⃣ Exchange code for token
      const qs = new URLSearchParams({
        client_id: appId,
        client_secret: appSecret,
        code,
      });

      const tokenResp = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token?${qs.toString()}`
      );
      const tokenData = await tokenResp.json();

      if (!tokenResp.ok || !tokenData.access_token) {
        return res.status(400).json({
          error: "OAuth token exchange failed",
          metaError: tokenData,
        });
      }

      const accessToken = tokenData.access_token;

      // 2️⃣ Fetch details
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      const whatsappVerificationStatus = phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber = phoneData?.display_phone_number || null;

      // 3️⃣ Fetch Tier
      const whatsappMessagingTier = await fetchMessagingTier(wabaId, phoneNumberId, accessToken);

      // 4️⃣ Attempt to Register
      const isTestNumber =
        whatsappVerifiedName?.toLowerCase() === "test number" ||
        whatsappDisplayPhoneNumber?.replace(/\D/g, "").startsWith("1555");
      const isAlreadyCloudAPI = phoneData?.platform_type === "CLOUD_API";

      if (!isTestNumber && !isAlreadyCloudAPI) {
        const registration = await registerPhoneNumber(phoneNumberId, accessToken);
        if (!registration.success) {
          await prisma.gym.update({
            where: { id: gym.id },
            data: {
              whatsappStatus: "error",
              whatsappLastError: JSON.stringify(registration.error),
            },
          });

          return res.status(400).json({
            error: "Phone number registration failed",
            metaError: registration.error,
          });
        }
      }

      // 5️⃣ Subscribe App
      const subscription = await subscribeApp(wabaId, accessToken);
      if (!subscription.success) {
        await prisma.gym.update({
          where: { id: gym.id },
          data: {
            whatsappStatus: "error",
            whatsappLastError: JSON.stringify(subscription.error),
          },
        });

        return res.status(400).json({
          error: "Webhook subscription failed",
          metaError: subscription.error,
        });
      }

      // 6️⃣ Encrypt token & save
      const encryptedToken = encrypt(accessToken);

      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsapp_connected: true,
          whatsapp_waba_id: wabaId,
          whatsapp_phone_number_id: phoneNumberId,
          whatsapp_business_id: businessId || wabaId,
          whatsapp_access_token: encryptedToken,
          whatsappStatus: "connected",
          whatsappVerifiedAt: new Date(),
          whatsappLastError: null,
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappMessagingTier,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Embedded signup error:", err);
      res.status(400).json({ error: err.message || "Embedded signup failed" });
    }
  }
);

/**
 * =====================================
 * DISCONNECT WHATSAPP
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/disconnect",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym) {
        return res.status(404).json({ error: "Gym not found" });
      }

      await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsapp_connected: false,
          whatsapp_waba_id: null,
          whatsapp_phone_number_id: null,
          whatsapp_business_id: null,
          whatsapp_access_token: null,
          whatsappStatus: "disconnected",
          whatsappVerifiedAt: null,
          whatsappLastError: null,
          whatsappVerificationStatus: "NOT_VERIFIED",
          whatsappQualityRating: "UNKNOWN",
          whatsappMessagingTier: "UNKNOWN",
          whatsappVerifiedName: null,
          whatsappDisplayPhoneNumber: null,
        },
      });

      res.json({ success: true, message: "WhatsApp successfully disconnected" });
    } catch (err) {
      console.error("Disconnect error:", err);
      res.status(500).json({ error: "Failed to disconnect WhatsApp" });
    }
  }
);

/**
 * =====================================
 * REFRESH WHATSAPP STATUS
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/refresh-status",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;
      const wabaId = gym.whatsapp_waba_id || gym.whatsapp_business_id;

      // 1️⃣ Fetch Details
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      const whatsappVerificationStatus = phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber = phoneData?.display_phone_number || null;

      // 2️⃣ Fetch Tier
      let whatsappMessagingTier = gym.whatsappMessagingTier || "UNKNOWN";
      if (wabaId) {
        whatsappMessagingTier = await fetchMessagingTier(wabaId, phoneNumberId, accessToken);
      }

      const updated = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappMessagingTier,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
        select: {
          whatsapp_connected: true,
          whatsappVerificationStatus: true,
          whatsappQualityRating: true,
          whatsappMessagingTier: true,
          whatsappVerifiedName: true,
          whatsappDisplayPhoneNumber: true,
        },
      });

      res.json(updated);
    } catch (err) {
      console.error("Refresh status error:", err);
      res.status(400).json({ error: err.message || "Failed to refresh WhatsApp status" });
    }
  }
);

/**
 * =====================================
 * REVERIFY WHATSAPP REGISTRATION
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/reverify",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      // Retries registration
      const registration = await registerPhoneNumber(phoneNumberId, accessToken);

      if (!registration.success) {
        const errCode = registration.error?.error?.code;
        const isTokenExpired = errCode === 190 || errCode === 463;

        return res.status(400).json({
          error: isTokenExpired
            ? "Your Meta access token has expired. Please reconfigure the connection."
            : "Phone number registration failed",
          metaError: registration.error,
        });
      }

      // Sync Health Status
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      const whatsappVerificationStatus = phoneData?.code_verification_status || "NOT_VERIFIED";
      const whatsappQualityRating = phoneData?.quality_rating || "UNKNOWN";
      const whatsappVerifiedName = phoneData?.verified_name || null;
      const whatsappDisplayPhoneNumber = phoneData?.display_phone_number || null;

      const updated = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerificationStatus,
          whatsappQualityRating,
          whatsappVerifiedName,
          whatsappDisplayPhoneNumber,
        },
      });

      res.json(updated);
    } catch (err) {
      console.error("Reverify error:", err);
      res.status(400).json({ error: err.message || "Reverify registration failed" });
    }
  }
);

/**
 * =====================================
 * REQUEST VERIFICATION CODE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/register",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      const resp = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/request_code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            code_method: "SMS",
            language: "en_US",
          }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        return res.status(400).json({
          error: "Failed to request verification code",
          metaError: data?.error || data,
        });
      }

      res.json({ success: true, message: "Verification code requested via SMS" });
    } catch (err) {
      console.error("Request code error:", err);
      res.status(400).json({ error: err.message || "Failed to request verification code" });
    }
  }
);

/**
 * =====================================
 * VERIFY CODE & REGISTER LINE
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/verify",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { code } = req.body;
    const { gymSlug } = req.params;

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_phone_number_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const phoneNumberId = gym.whatsapp_phone_number_id;

      // 1️⃣ Verify the code
      const verifyResp = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/verify_code`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code,
          }),
        }
      );

      const verifyData = await verifyResp.json();

      if (!verifyResp.ok) {
        return res.status(400).json({
          error: "Verification failed",
          metaError: verifyData?.error || verifyData,
        });
      }

      // 2️⃣ Register phone line
      const registration = await registerPhoneNumber(phoneNumberId, accessToken);
      if (!registration.success) {
        return res.status(400).json({
          error: "Code verified but registration failed",
          metaError: registration.error,
        });
      }

      // 3️⃣ Refresh Gym record
      const phoneData = await fetchPhoneDetails(phoneNumberId, accessToken);
      const whatsappVerificationStatus = phoneData?.code_verification_status || "VERIFIED";

      const updated = await prisma.gym.update({
        where: { id: gym.id },
        data: {
          whatsappVerificationStatus,
          whatsapp_connected: true,
          whatsappStatus: "connected",
          whatsappVerifiedAt: new Date(),
        },
      });

      res.json(updated);
    } catch (err) {
      console.error("Verify code error:", err);
      res.status(400).json({ error: err.message || "Verification failed" });
    }
  }
);

/**
 * =====================================
 * SYNC TEMPLATES FROM META
 * =====================================
 * Access: GYM_OWNER, SUPERADMIN
 */
router.post(
  "/sync-templates",
  authenticateToken,
  requireRoles(["GYM_OWNER", "SUPERADMIN"]),
  async (req, res) => {
    const { gymSlug } = req.params;

    try {
      const gym = await prisma.gym.findUnique({
        where: { slug: gymSlug.toLowerCase() },
      });

      if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_waba_id) {
        return res.status(400).json({ error: "WhatsApp not fully configured" });
      }

      const accessToken = decrypt(gym.whatsapp_access_token);
      const wabaId = gym.whatsapp_waba_id;

      const resp = await fetch(
        `https://graph.facebook.com/v20.0/${wabaId}/message_templates?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        return res.status(400).json({
          error: "Failed to fetch templates from Meta",
          metaError: data,
        });
      }

      if (data && Array.isArray(data.data)) {
        for (const metaTpl of data.data) {
          await prisma.whatsAppTemplate.upsert({
            where: {
              gymId_templateName: {
                gymId: gym.id,
                templateName: metaTpl.name,
              },
            },
            update: {
              metaTemplateId: metaTpl.id,
              language: metaTpl.language,
              category: metaTpl.category,
              status: metaTpl.status,
              components: metaTpl.components || [],
            },
            create: {
              gymId: gym.id,
              templateName: metaTpl.name,
              metaTemplateId: metaTpl.id,
              language: metaTpl.language,
              category: metaTpl.category,
              status: metaTpl.status,
              components: metaTpl.components || [],
            },
          });
        }
      }

      res.json({ success: true, message: "Templates synchronized successfully" });
    } catch (err) {
      console.error("Template sync error:", err);
      res.status(400).json({ error: err.message || "Failed to synchronize templates" });
    }
  }
);

export default router;
