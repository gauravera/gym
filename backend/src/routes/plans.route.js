import { Router } from "express";
import prisma from "../prisma.js";

const router = Router({ mergeParams: true });

// GET /api/dashboard/:gymSlug/plans
router.get("/", async (req, res) => {
  const { gymSlug } = req.params;
  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });
    if (!gym) return res.status(404).json({ error: "Gym not found" });

    const plans = await prisma.membershipPlan.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: "desc" }
    });
    res.json({ plans });
  } catch (err) {
    console.error("❌ [Plans GET] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/dashboard/:gymSlug/plans
router.post("/", async (req, res) => {
  const { gymSlug } = req.params;
  const { name, description, price, durationDays } = req.body;

  if (!name || price === undefined || !durationDays) {
    return res.status(400).json({ error: "Name, price and duration are required" });
  }

  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });
    if (!gym) return res.status(404).json({ error: "Gym not found" });

    const plan = await prisma.membershipPlan.create({
      data: {
        gymId: gym.id,
        name,
        description: description || null,
        price: parseFloat(price),
        durationDays: parseInt(durationDays)
      }
    });

    res.status(201).json({ success: true, plan });
  } catch (err) {
    console.error("❌ [Plans POST] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/dashboard/:gymSlug/plans/:planId
router.delete("/:planId", async (req, res) => {
  const { gymSlug, planId } = req.params;
  try {
    const gym = await prisma.gym.findUnique({
      where: { slug: gymSlug.toLowerCase() }
    });
    if (!gym) return res.status(404).json({ error: "Gym not found" });

    await prisma.membershipPlan.delete({
      where: { id: planId, gymId: gym.id }
    });

    res.json({ success: true, message: "Plan deleted successfully" });
  } catch (err) {
    console.error("❌ [Plans DELETE] Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

export default router;
