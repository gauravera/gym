import { Router } from "express";
import prisma from "../prisma.js";

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

    res.json({ members });
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
  const { name, phone, email, address, dob, emergencyContact, notes } = req.body;

  if (!name || !phone) {
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
        name,
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

    await prisma.auditLog.create({
      data: {
        action: "MEMBER_CREATE",
        details: `Member ${name} (${formattedPhone}) registered manually.`,
        gymId: gym.id,
        userId: req.user?.userId || null
      }
    });

    res.status(201).json({ success: true, member: newMember });
  } catch (err) {
    console.error("❌ [Members POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
