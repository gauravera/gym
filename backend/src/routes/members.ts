import { Router, Response } from 'express';
import { db } from '../lib/db';
import { authenticateToken, scopeToGym, RequestWithUser } from '../middleware/auth';

const router = Router({ mergeParams: true });

// Apply authentication and gym scoping middleware to all member routes
router.use(authenticateToken);
router.use(scopeToGym);

// GET /api/dashboard/:gymSlug/members
router.get('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const members = await db.member.findMany({
      where: { gymId: gym.id },
      orderBy: { createdAt: 'desc' },
      include: {
        memberships: {
          include: { plan: true },
        },
      },
    });

    return res.json({ members });
  } catch (error) {
    console.error('Error fetching members API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/members
router.post('/', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug } = req.params;
    const session = req.user!;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const { name, phone, email, address, dob, emergencyContact, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const phoneRegex = /^\+?[0-9]+$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'WhatsApp Phone Number must contain only numbers (optionally starting with +)' });
    }

    // Check if phone already registered in this gym
    const existing = await db.member.findUnique({
      where: {
        gymId_phone: {
          gymId: gym.id,
          phone,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Member phone already exists for this gym' });
    }

    const member = await db.member.create({
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
        dob: dob ? new Date(dob) : null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
        gymId: gym.id,
      },
    });

    // Queue welcome template message for the new member
    await db.notification.create({
      data: {
        gymId: gym.id,
        memberId: member.id,
        recipientPhone: phone,
        title: `TEMPLATE:welcome_member:${name},${gym.name}`,
        message: `Welcome ${name} to ${gym.name}! Your account has been registered successfully.`,
        type: 'ACTIVATION',
        status: 'PENDING',
      },
    });

    await db.auditLog.create({
      data: {
        action: 'MEMBER_CREATE',
        details: `Created member ${name} (${phone})`,
        gymId: gym.id,
        userId: session.userId,
      },
    });

    return res.json({ success: true, member });
  } catch (error) {
    console.error('Error creating member API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/:gymSlug/members/:memberId/messages
router.get('/:memberId/messages', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug, memberId } = req.params;

    const messages = await db.notification.findMany({
      where: {
        memberId,
        gym: { slug: gymSlug },
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ messages });
  } catch (error) {
    console.error('Error fetching member messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/dashboard/:gymSlug/members/:memberId/toggle-bot
router.post('/:memberId/toggle-bot', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug, memberId } = req.params;
    const session = req.user!;
    const { isBotDisabled } = req.body;

    const member = await db.member.update({
      where: {
        id: memberId,
        gym: { slug: gymSlug },
      },
      data: { isBotDisabled },
    });

    await db.auditLog.create({
      data: {
        action: isBotDisabled ? 'BOT_PAUSE' : 'BOT_RESUME',
        details: `${isBotDisabled ? 'Paused' : 'Resumed'} chatbot for member ${member.name} (${member.phone})`,
        gymId: member.gymId,
        userId: session.userId,
      },
    });

    return res.json({ success: true, member });
  } catch (error) {
    console.error('Error toggling bot status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/dashboard/:gymSlug/members/:memberId
router.put('/:memberId', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug, memberId } = req.params;
    const session = req.user!;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const { name, phone, email, address, dob, emergencyContact, notes } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required' });
    }

    const phoneRegex = /^\+?[0-9]+$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: 'WhatsApp Phone Number must contain only numbers (optionally starting with +)' });
    }

    // Verify member belongs to this gym
    const memberToUpdate = await db.member.findUnique({
      where: { id: memberId },
    });

    if (!memberToUpdate || memberToUpdate.gymId !== gym.id) {
      return res.status(404).json({ error: 'Member not found in this gym' });
    }

    // Check if phone registered to another member in this gym
    const existing = await db.member.findFirst({
      where: {
        gymId: gym.id,
        phone,
        NOT: { id: memberId },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Member phone already exists for this gym' });
    }

    const member = await db.member.update({
      where: {
        id: memberId,
      },
      data: {
        name,
        phone,
        email: email || null,
        address: address || null,
        dob: dob ? new Date(dob) : null,
        emergencyContact: emergencyContact || null,
        notes: notes || null,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'MEMBER_UPDATE',
        details: `Updated member ${name} (${phone})`,
        gymId: gym.id,
        userId: session.userId,
      },
    });

    return res.json({ success: true, member });
  } catch (error) {
    console.error('Error updating member:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/dashboard/:gymSlug/members/:memberId
router.delete('/:memberId', async (req: RequestWithUser, res: Response): Promise<any> => {
  try {
    const { gymSlug, memberId } = req.params;
    const session = req.user!;

    const gym = await db.gym.findUnique({
      where: { slug: gymSlug },
    });

    if (!gym) {
      return res.status(404).json({ error: 'Gym not found' });
    }

    const member = await db.member.findUnique({
      where: {
        id: memberId,
      },
    });

    if (!member || member.gymId !== gym.id) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await db.member.delete({
      where: {
        id: memberId,
      },
    });

    await db.auditLog.create({
      data: {
        action: 'MEMBER_DELETE',
        details: `Deleted member ${member.name} (${member.phone})`,
        gymId: gym.id,
        userId: session.userId,
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting member:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
