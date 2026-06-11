/**
 * Middleware to restrict endpoint access to specific roles.
 * Supports passing a single role or an array of roles.
 */
export function requireRoles(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User session missing' });
    }

    // Ensure the authenticated user's role is in the list of allowed roles.
    // Enums are UPPERCASE: SUPERADMIN, GYM_OWNER, STAFF
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: `Forbidden: Access restricted to roles: [${roles.join(', ')}]. Current role: ${user.role}`
      });
    }

    next();
  };
}
