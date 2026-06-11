import { Router } from 'express';
import { createStaff, listTeamMembers, deleteTeamMember } from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRoles } from '../middleware/requireRole.middleware.js';

const router = Router();

// Only owners and superadmins can invite/create new staff
router.post('/invite', authenticateToken, requireRoles(['GYM_OWNER', 'SUPERADMIN']), createStaff);

// All authenticated members within the tenant can list the team
router.get('/', authenticateToken, requireRoles(['GYM_OWNER', 'STAFF', 'SUPERADMIN']), listTeamMembers);

// Only owners and superadmins can delete/remove team members
router.delete('/:id', authenticateToken, requireRoles(['GYM_OWNER', 'SUPERADMIN']), deleteTeamMember);

export default router;
