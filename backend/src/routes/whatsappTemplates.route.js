import { Router } from "express";
import prisma from "../prisma.js";
import { decrypt } from "../utils/encryption.js";
import { uploadTemplateMediaToMeta } from "../utils/uploadTemplateMediaToMeta.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router({ mergeParams: true });

const META_API_VERSION = process.env.META_API_VERSION || "v20.0";
const GRAPH_BASE_URL = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";

// Multer storage configuration for template draft headers
const uploadDir = "uploads/templates";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

/**
 * =====================================
 * GET ALL TEMPLATES
 * =====================================
 */
router.get("/", async (req, res) => {
  const { gymSlug } = req.params;
  console.log(`🔌 [Templates GET] Fetching templates for Gym Slug: "${gymSlug}"`);

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const templates = await prisma.whatsAppTemplate.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(templates);
  } catch (err) {
    console.error("❌ [Templates GET] Error:", err);
    res.status(500).json({ error: "Failed to retrieve templates" });
  }
});

/**
 * =====================================
 * CREATE TEMPLATE DRAFT (LOCAL ONLY)
 * =====================================
 */
router.post("/", upload.single("headerFile"), async (req, res) => {
  const { gymSlug } = req.params;
  const { name, category, language, body, footer, buttons } = req.body;

  console.log(`🔌 [Templates POST] Creating local draft template "${name}" for Gym: "${gymSlug}"`);

  if (!name || !category || !language || !body) {
    return res.status(400).json({ error: "Missing required fields (name, category, language, body)" });
  }

  // Validate clean name (lowercase, numbers, underscores only)
  const nameRegex = /^[a-z0-9_]+$/;
  if (!nameRegex.test(name)) {
    return res.status(400).json({
      error: "Template name must contain only lowercase alphanumeric characters and underscores (e.g. welcome_member)",
    });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Check unique name constraints
    const existing = await prisma.whatsAppTemplate.findUnique({
      where: {
        gymId_templateName: {
          gymId: gym.id,
          templateName: name,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: `A template named "${name}" already exists.` });
    }

    // Parse buttons if provided
    let parsedButtons = [];
    if (buttons) {
      try {
        parsedButtons = JSON.parse(buttons);
      } catch (e) {
        console.error("❌ Failed to parse buttons string:", e);
      }
    }

    const components = [];

    // Header component
    const headerType = req.body.headerType || "NONE";
    if (headerType === "TEXT" && req.body.headerText) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: req.body.headerText,
      });
    } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerType)) {
      if (!req.file) {
        return res.status(400).json({ error: `Header type is ${headerType} but no file was uploaded.` });
      }

      components.push({
        type: "HEADER",
        format: headerType,
        example: {
          header_handle: [],
          local_filename: req.file.filename,
          local_mimetype: req.file.mimetype,
          local_originalname: req.file.originalname,
        },
      });
    }

    // Body component
    components.push({
      type: "BODY",
      text: body,
    });

    // Footer component
    if (footer) {
      components.push({
        type: "FOOTER",
        text: footer,
      });
    }

    // Buttons component
    if (parsedButtons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: parsedButtons.map((btn) => {
          if (btn.type === "URL") {
            return {
              type: "URL",
              text: btn.text,
              url: btn.value,
            };
          }
          if (btn.type === "PHONE_NUMBER") {
            return {
              type: "PHONE_NUMBER",
              text: btn.text,
              phone_number: btn.value,
            };
          }
          return {
            type: "QUICK_REPLY",
            text: btn.text,
          };
        }),
      });
    }

    // Save in DB
    const template = await prisma.whatsAppTemplate.create({
      data: {
        gymId: gym.id,
        templateName: name,
        language,
        category,
        status: "draft",
        components: components,
      },
    });

    console.log(`✅ [Templates POST] Created template draft: ${template.id}`);
    res.json(template);
  } catch (err) {
    console.error("❌ [Templates POST] Error:", err);
    res.status(500).json({ error: err.message || "Failed to create template" });
  }
});

/**
 * =====================================
 * SUBMIT TEMPLATE TO META (APPROVAL)
 * =====================================
 */
router.post("/:id/submit", async (req, res) => {
  const { gymSlug, id } = req.params;
  console.log(`🔌 [Templates SUBMIT] Submitting template ID ${id} for Gym Slug: "${gymSlug}"`);

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_business_id) {
      return res.status(400).json({ error: "WhatsApp credentials or business setup missing." });
    }

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found." });
    }

    if (template.status === "APPROVED" || template.status === "PENDING") {
      return res.status(400).json({ error: `Cannot submit a template that is already ${template.status}` });
    }

    const accessToken = decrypt(gym.whatsapp_access_token);
    const appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;

    if (!appId) {
      return res.status(500).json({ error: "Facebook App ID configuration missing on server." });
    }

    // Build the Meta Payload components list
    const componentsRaw = Array.isArray(template.components)
      ? template.components
      : [];
    const metaComponents = [];

    for (const comp of componentsRaw) {
      if (comp.type === "HEADER") {
        if (comp.format === "TEXT") {
          metaComponents.push({
            type: "HEADER",
            format: "TEXT",
            text: comp.text,
          });
        } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format)) {
          const fileInfo = comp.example;
          if (!fileInfo || !fileInfo.local_filename) {
            throw new Error(`Media header configuration missing local file reference.`);
          }

          const filePath = path.join(uploadDir, fileInfo.local_filename);
          if (!fs.existsSync(filePath)) {
            throw new Error(`Local file reference ${fileInfo.local_filename} not found on disk.`);
          }

          const fileBuffer = fs.readFileSync(filePath);

          console.log(`🔌 [Templates SUBMIT] Uploading media header file to Meta...`);
          const handle = await uploadTemplateMediaToMeta({
            accessToken,
            appId,
            buffer: fileBuffer,
            mimeType: fileInfo.local_mimetype || "image/jpeg",
            fileName: fileInfo.local_originalname || "header-file",
          });

          metaComponents.push({
            type: "HEADER",
            format: comp.format,
            example: {
              header_handle: [handle],
            },
          });
        }
      } else if (comp.type === "BODY") {
        // Look for variables like {{1}}, {{2}} to add examples
        const variables = comp.text.match(/{{\d+}}/g) || [];
        const bodyComp = {
          type: "BODY",
          text: comp.text,
        };

        if (variables.length > 0) {
          bodyComp.example = {
            body_text: [variables.map((_, idx) => `Sample${idx + 1}`)],
          };
        }
        metaComponents.push(bodyComp);
      } else if (comp.type === "FOOTER") {
        metaComponents.push({
          type: "FOOTER",
          text: comp.text,
        });
      } else if (comp.type === "BUTTONS") {
        metaComponents.push({
          type: "BUTTONS",
          buttons: comp.buttons.map((btn) => {
            if (btn.type === "URL") {
              const hasVariable = btn.url.includes("{{1}}");
              return {
                type: "URL",
                text: btn.text,
                url: btn.url,
                ...(hasVariable && { example: ["TRACK123"] }),
              };
            }
            if (btn.type === "PHONE_NUMBER") {
              return {
                type: "PHONE_NUMBER",
                text: btn.text,
                phone_number: btn.phone_number,
              };
            }
            return {
              type: "QUICK_REPLY",
              text: btn.text,
            };
          }),
        });
      }
    }

    const payload = {
      name: template.templateName,
      category: template.category,
      language: template.language,
      components: metaComponents,
    };

    console.log(`🔌 [Templates SUBMIT] Sending request to Meta Graph API...`);
    const submitRes = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_business_id}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const submitData = await submitRes.json();

    if (!submitRes.ok) {
      console.error("❌ [Templates SUBMIT] Meta rejection response:", submitData);
      return res.status(400).json({
        error: submitData?.error?.message || "Meta Template submission rejected",
        details: submitData,
      });
    }

    console.log(`✅ [Templates SUBMIT] Meta response succeeded. ID: ${submitData.id}`);

    // Update status to pending and store Meta ID
    const updated = await prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        status: "PENDING",
        metaTemplateId: submitData.id,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("❌ [Templates SUBMIT] Error:", err);
    res.status(400).json({ error: err.message || "Failed to submit template to Meta" });
  }
});

/**
 * =====================================
 * SYNC STATUS OF INDIVIDUAL TEMPLATE
 * =====================================
 */
router.post("/:id/sync-status", async (req, res) => {
  const { gymSlug, id } = req.params;
  console.log(`🔌 [Templates SYNC] Checking status for Template ${id}`);

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym || !gym.whatsapp_access_token || !gym.whatsapp_business_id) {
      return res.status(400).json({ error: "WhatsApp credentials or business setup missing" });
    }

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    const accessToken = decrypt(gym.whatsapp_access_token);

    console.log(`🔌 [Templates SYNC] Querying Meta templates by name: "${template.templateName}"`);
    const statusRes = await fetch(
      `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_business_id}/message_templates?name=${template.templateName}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const statusData = await statusRes.json();

    if (!statusRes.ok) {
      return res.status(400).json({ error: "Failed to query status from Meta", details: statusData });
    }

    const metaTemplate = statusData.data?.[0];

    if (!metaTemplate) {
      return res.status(404).json({ error: "Template not found on Meta Dashboard." });
    }

    const newStatus = metaTemplate.status; // APPROVED / PENDING / REJECTED

    const updated = await prisma.whatsAppTemplate.update({
      where: { id },
      data: {
        status: newStatus,
        metaTemplateId: metaTemplate.id,
      },
    });

    console.log(`✅ [Templates SYNC] Status updated to: ${newStatus}`);
    res.json(updated);
  } catch (err) {
    console.error("❌ [Templates SYNC] Error:", err);
    res.status(500).json({ error: err.message || "Failed to sync status" });
  }
});

/**
 * =====================================
 * DELETE TEMPLATE (LOCAL & META)
 * =====================================
 */
router.delete("/:id", async (req, res) => {
  const { gymSlug, id } = req.params;
  console.log(`🔌 [Templates DELETE] Removing template ID ${id}`);

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }

    // Try deleting from Meta if it has been submitted and is active/pending
    if (template.status !== "draft" && gym.whatsapp_access_token && gym.whatsapp_business_id) {
      try {
        const accessToken = decrypt(gym.whatsapp_access_token);
        const metaDeleteUrl = `${GRAPH_BASE_URL}/${META_API_VERSION}/${gym.whatsapp_business_id}/message_templates?name=${template.templateName}`;

        console.log(`🔌 [Templates DELETE] Requesting deletion from Meta for name: "${template.templateName}"`);
        const metaRes = await fetch(metaDeleteUrl, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!metaRes.ok) {
          const deleteErr = await metaRes.json();
          console.warn(`⚠️ [Templates DELETE] Meta deletion failed (proceeding locally):`, deleteErr);
        } else {
          console.log(`✅ [Templates DELETE] Meta deleted template successfully`);
        }
      } catch (metaErr) {
        console.error("⚠️ Failed to request deletion on Meta server:", metaErr.message);
      }
    }

    // Also clean up any local uploaded header file
    const components = Array.isArray(template.components) ? template.components : [];
    const headerComp = components.find((c) => c.type === "HEADER");
    if (headerComp && headerComp.example?.local_filename) {
      const filePath = path.join(uploadDir, headerComp.example.local_filename);
      if (fs.existsSync(filePath)) {
        console.log(`🔌 [Templates DELETE] Cleaning up local file: ${filePath}`);
        fs.unlinkSync(filePath);
      }
    }

    await prisma.whatsAppTemplate.delete({
      where: { id },
    });

    res.json({ success: true, message: "Template deleted successfully" });
  } catch (err) {
    console.error("❌ [Templates DELETE] Error:", err);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

export default router;
