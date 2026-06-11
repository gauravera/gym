import prisma from '../prisma.js';
import { hashPassword } from '../utils/auth.js';

/**
 * Enforces the team member limit for a gym.
 * Default limit is 5 team members.
 */
export async function enforceTeamUsersLimit(gymId) {
  const userCount = await prisma.gymUser.count({
    where: { gymId },
  });

  const limit = 5; // Default limit for the gym's team size
  if (userCount >= limit) {
    const err = new Error(`Team limit reached. Your gym tier allows up to ${limit} team members.`);
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Create a new team member (Staff) under the gym.
 */
export async function createStaff(req, res) {
  try {
    const { name, email, password } = req.body;
    const { gymId } = req.user;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (!gymId) {
      return res.status(400).json({ error: 'User is not associated with any gym tenant' });
    }

    // Check unique email
    const existingUser = await prisma.gymUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Enforce team limit checks
    try {
      await enforceTeamUsersLimit(gymId);
    } catch (limitErr) {
      return res.status(limitErr.statusCode || 400).json({ error: limitErr.message });
    }

    const passwordHash = hashPassword(password);

    // Create staff member
    const newStaff = await prisma.gymUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'STAFF',
        gymId,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_INVITE',
        details: `Staff member ${name} (${email}) created by owner.`,
        gymId,
        userId: req.user.userId,
      },
    });

    return res.status(201).json({
      success: true,
      user: {
        id: newStaff.id,
        name: newStaff.name,
        email: newStaff.email,
        role: newStaff.role,
      },
    });
  } catch (error) {
    console.error('Create staff error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * List all team members for the gym.
 */
export async function listTeamMembers(req, res) {
  try {
    const { gymId } = req.user;

    if (!gymId) {
      return res.status(400).json({ error: 'User is not associated with any gym tenant' });
    }

    const members = await prisma.gymUser.findMany({
      where: { gymId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return res.json({ success: true, team: members });
  } catch (error) {
    console.error('List team members error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Remove/Delete a team member (Staff) from the gym.
 */
export async function deleteTeamMember(req, res) {
  try {
    const { id } = req.params;
    const { gymId, userId: currentUserId } = req.user;

    if (!gymId) {
      return res.status(400).json({ error: 'User is not associated with any gym tenant' });
    }

    const userToDelete = await prisma.gymUser.findUnique({
      where: { id },
    });

    if (!userToDelete) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    if (userToDelete.gymId !== gymId) {
      return res.status(403).json({ error: 'Forbidden: Member belongs to another gym' });
    }

    // Do not allow deleting self
    if (userToDelete.id === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Do not allow deleting a GYM_OWNER
    if (userToDelete.role === 'GYM_OWNER') {
      return res.status(400).json({ error: 'Cannot delete the Gym Owner' });
    }

    await prisma.gymUser.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        action: 'STAFF_DELETE',
        details: `Staff member ${userToDelete.name} (${userToDelete.email}) was deleted.`,
        gymId,
        userId: currentUserId,
      },
    });

    return res.json({ success: true, message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Delete team member error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
