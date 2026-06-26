import { Router } from "express";
import prisma from "../prisma.js";
import { getIO } from "../socket.js";

const router = Router({ mergeParams: true });

/**
 * =====================================
 * GET ALL MEMBERS (DIRECTORY)
 * =====================================
 */
router.get("/", async (req, res) => {
  const { gymSlug } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const members = await prisma.member.findMany({
      where: { gymId: gym.id },
      include: {
        memberships: {
          include: {
            plan: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Map memberName to name for frontend compatibility
    const mappedMembers = members.map(m => ({
      ...m,
      name: m.memberName
    }));

    res.json({ members: mappedMembers });
  } catch (err) {
    console.error("❌ [Members GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * ADD NEW MEMBER
 * =====================================
 */
router.post("/", async (req, res) => {
  const { gymSlug } = req.params;
  const { name, memberName, phone, email, address, dob, emergencyContact, notes } = req.body;
  const actualName = name || memberName;

  if (!actualName || !phone) {
    return res.status(400).json({ error: "Name and Phone number are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true, name: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    // Clean phone number (leave digits only)
    const formattedPhone = phone.replace(/\D/g, "");

    // Check unique phone number per gym tenant
    const existing = await prisma.member.findUnique({
      where: {
        gymId_phone: {
          gymId: gym.id,
          phone: formattedPhone
        }
      }
    });

    if (existing) {
      return res.status(400).json({ error: "A member with this phone number is already registered." });
    }

    const newMember = await prisma.member.create({
      data: {
        gymId: gym.id,
        memberName: actualName,
        phone: formattedPhone,
        email: email || null,
        address: address || null,
        dob: dob ? new Date(dob) : null,
        emergencyContact: emergencyContact || null,
        notes: notes || null
      },
      include: {
        memberships: true
      }
    });

    // Queue welcome template message for the new member
    await prisma.notification.create({
      data: {
        gymId: gym.id,
        memberId: newMember.id,
        recipientPhone: formattedPhone,
        title: `TEMPLATE:welcome_member:${actualName},${gym.name}`,
        message: `Welcome ${actualName} to ${gym.name}! Your account has been registered successfully.`,
        type: "ACTIVATION",
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_CREATE",
        details: `Member ${actualName} (${formattedPhone}) registered manually.`,
        gymId: gym.id,
        userId: req.user?.userId || null
      }
    });

    // Map memberName to name for frontend compatibility
    const mappedMember = {
      ...newMember,
      name: newMember.memberName
    };

    res.status(201).json({ success: true, member: mappedMember });
  } catch (err) {
    console.error("❌ [Members POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * GET MEMBER MESSAGES (AUDIT TRAIL)
 * =====================================
 */
router.get("/:memberId/messages", async (req, res) => {
  const { gymSlug, memberId } = req.params;

  try {
    const messages = await prisma.notification.findMany({
      where: {
        memberId,
        gym: { slug: gymSlug.toLowerCase() },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ messages });
  } catch (err) {
    console.error("❌ [Member Messages GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * TOGGLE BOT CHATBOT PAUSE/RESUME
 * =====================================
 */
router.post("/:memberId/toggle-bot", async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { isBotDisabled } = req.body;

  if (typeof isBotDisabled !== "boolean") {
    return res.status(400).json({ error: "isBotDisabled must be a boolean" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: { isBotDisabled }
    });

    const mappedMember = {
      ...updatedMember,
      name: updatedMember.memberName
    };

    await prisma.auditLog.create({
      data: {
        action: isBotDisabled ? "BOT_TAKEOVER_START" : "BOT_TAKEOVER_STOP",
        details: isBotDisabled
          ? `Human took over conversation with member ${member.memberName} (${member.phone}). Bot paused.`
          : `Chatbot resumed control for member ${member.memberName} (${member.phone}).`,
        gymId: gym.id,
        userId: req.user?.userId || null
      }
    });

    res.json({ success: true, member: mappedMember });
  } catch (err) {
    console.error("❌ [Member Toggle Bot] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * UPDATE MEMBER
 * =====================================
 */
router.put("/:memberId", async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { name, memberName, phone, email, address, dob, emergencyContact, notes } = req.body;
  const actualName = name || memberName;

  if (!actualName || !phone) {
    return res.status(400).json({ error: "Name and Phone number are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const phoneRegex = /^\+?[0-9]+$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: "WhatsApp Phone Number must contain only numbers (optionally starting with +)" });
    }

    const formattedPhone = phone.replace(/\D/g, "");

    // Verify member belongs to this gym
    const memberToUpdate = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found in this gym" });
    }

    // Check if phone registered to another member in this gym
    const existing = await prisma.member.findFirst({
      where: {
        gymId: gym.id,
        phone: formattedPhone,
        NOT: { id: memberId },
      },
    });

    if (existing) {
      return res.status(400).json({ error: "Member phone already exists for this gym" });
    }

    const updatedMember = await prisma.member.update({
      where: { id: memberId },
      data: {
        memberName: actualName,
        phone: formattedPhone,
        email: email || null,
        address: address || null,
        dob: dob ? new Date(dob) : null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
      },
    });

    const mappedMember = {
      ...updatedMember,
      name: updatedMember.memberName
    };

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_UPDATE",
        details: `Updated member ${actualName} (${formattedPhone})`,
        gymId: gym.id,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true, member: mappedMember });
  } catch (err) {
    console.error("❌ [Member PUT] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * DELETE MEMBER
 * =====================================
 */
router.delete("/:memberId", async (req, res) => {
  const { gymSlug, memberId } = req.params;

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    await prisma.member.delete({
      where: { id: memberId },
    });

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_DELETE",
        details: `Deleted member ${member.memberName} (${member.phone})`,
        gymId: gym.id,
        userId: req.user?.userId || null,
      },
    });

    res.json({ success: true, message: "Member deleted successfully" });
  } catch (err) {
    console.error("❌ [Member DELETE] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * =====================================
 * CREATE MEMBERSHIP (ASSIGN PLAN)
 * =====================================
 */
router.post("/:memberId/memberships", async (req, res) => {
  const { gymSlug, memberId } = req.params;
  const { planId, startDate } = req.body;

  if (!planId) {
    return res.status(400).json({ error: "Membership Plan is required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() },
      select: { id: true, name: true }
    });

    if (!gym) {
      return res.status(404).json({ error: "Gym not found" });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId }
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: "Member not found" });
    }

    const plan = await prisma.membershipPlan.findUnique({
      where: { id: planId }
    });

    if (!plan || plan.gymId !== gym.id) {
      return res.status(404).json({ error: "Membership plan not found" });
    }

    const start = startDate ? new Date(startDate) : new Date();
    const end = new Date(start.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Create the membership
    const membership = await prisma.membership.create({
      data: {
        gymId: gym.id,
        memberId: member.id,
        planId: plan.id,
        startDate: start,
        endDate: end,
        status: "ACTIVE"
      },
      include: {
        plan: true
      }
    });

    // Also queue a welcome/activation template message
    await prisma.notification.create({
      data: {
        gymId: gym.id,
        memberId: member.id,
        recipientPhone: member.phone,
        title: `TEMPLATE:membership_active:${member.memberName},${plan.name},${end.toLocaleDateString('en-IN')}`,
        message: `Hello ${member.memberName}, your ${plan.name} membership at ${gym.name} is now active until ${end.toLocaleDateString('en-IN')}!`,
        type: "ACTIVATION",
        status: "PENDING",
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "MEMBERSHIP_CREATE",
        details: `Assigned plan ${plan.name} to member ${member.memberName}. Expires on ${end.toLocaleDateString('en-IN')}.`,
        gymId: gym.id,
        userId: req.user?.userId || null
      }
    });

    // Send real-time socket events
    try {
      const io = getIO();
      io.to(`gym:${gym.id}`).emit("inbox:update");
    } catch (wsErr) {
      console.error("Socket emit failed on membership create:", wsErr);
    }

    res.status(201).json({ success: true, membership });
  } catch (err) {
    console.error("❌ [Membership POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
