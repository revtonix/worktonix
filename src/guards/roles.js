/**
 * Role hierarchy and permission definitions.
 *
 * ADMIN  — full access to everything
 * TECH   — workspace CRUD, staff management, profile creation (no billing/system settings)
 * MANAGER — workspace operations, view staff
 * STAFF  — own workspace operations only
 */

const ROLE_HIERARCHY = {
  ADMIN: 4,
  TECH: 3,
  MANAGER: 2,
  STAFF: 1,
};

/**
 * Resources and the minimum role required to access them.
 * Roles at or above the minimum level are granted access.
 */
const RESOURCE_PERMISSIONS = {
  // Workspace operations — STAFF and above
  'workspaces:read': 'STAFF',
  'workspaces:create': 'TECH',
  'workspaces:update': 'TECH',
  'workspaces:delete': 'TECH',
  'workspaces:launch': 'STAFF',
  'workspaces:stop': 'STAFF',

  // Staff management — TECH and above
  'staff:read': 'TECH',
  'staff:create': 'TECH',
  'staff:update': 'TECH',
  'staff:delete': 'ADMIN',

  // Profile creation — TECH and above
  'profiles:create': 'TECH',
  'profiles:read': 'STAFF',
  'profiles:update': 'TECH',
  'profiles:delete': 'TECH',

  // Admin-only resources
  'billing:read': 'ADMIN',
  'billing:update': 'ADMIN',
  'settings:read': 'ADMIN',
  'settings:update': 'ADMIN',
  'system:manage': 'ADMIN',
};

/**
 * Check if a role meets the minimum required role level.
 */
function hasMinimumRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || Infinity);
}

/**
 * Check if a role has permission to access a specific resource.
 */
function hasPermission(userRole, resource) {
  const requiredRole = RESOURCE_PERMISSIONS[resource];
  if (!requiredRole) {
    // Unknown resource — deny by default
    return false;
  }
  return hasMinimumRole(userRole, requiredRole);
}

/**
 * Express middleware factory — restrict route to a minimum role.
 *
 * Usage:
 *   router.get('/staff', requireRole('TECH'), listStaff);
 *   router.delete('/staff/:id', requireRole('ADMIN'), deleteStaff);
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowed = allowedRoles.some((role) => hasMinimumRole(userRole, role));
    if (!allowed) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

/**
 * Express middleware factory — restrict route by resource permission.
 *
 * Usage:
 *   router.post('/profiles', requirePermission('profiles:create'), createProfile);
 */
function requirePermission(resource) {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!hasPermission(userRole, resource)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: RESOURCE_PERMISSIONS[resource],
        current: userRole,
      });
    }

    next();
  };
}

module.exports = {
  ROLE_HIERARCHY,
  RESOURCE_PERMISSIONS,
  hasMinimumRole,
  hasPermission,
  requireRole,
  requirePermission,
};
