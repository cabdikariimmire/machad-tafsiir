import { query } from '../db/connection.js';

/**
 * Authentication and Authorization Middleware
 */

/**
 * Ensure user is logged in and active
 */
export async function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Fadlan gal nidaamka (Authentication required).',
      code: 'UNAUTHENTICATED'
    });
  }

  try {
    const [user] = await query('SELECT is_active FROM users WHERE id = ?', [req.session.user.id]);
    if (!user || !user.is_active) {
      if (req.session.destroy) {
        req.session.destroy(() => {});
      }
      return res.status(403).json({
        success: false,
        error: 'Akoonkaaga waa la xannibay (Account is inactive). Fadlan la xiriir maamulaha.',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Require one of the specified roles
 * @param {string[]} allowedRoles
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Fadlan gal nidaamka.',
        code: 'UNAUTHENTICATED'
      });
    }

    const userRole = req.session.user.role;
    if (userRole === 'super_admin' || allowedRoles.includes(userRole)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Ma lihid fasax aad ku gasho qaybtan (Forbidden role).',
      code: 'FORBIDDEN_ROLE'
    });
  };
}

/**
 * Require division scope: 'institute' or 'quran'
 * Super Admins and users with scope 'all' have access to both divisions.
 * @param {'institute' | 'quran'} requiredDivision
 */
export function requireDivisionScope(requiredDivision) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({
        success: false,
        error: 'Fadlan gal nidaamka.',
        code: 'UNAUTHENTICATED'
      });
    }

    const user = req.session.user;

    // Super Admin and Examination Officer have universal cross-division scope
    if (user.role === 'super_admin' || user.role === 'examination_officer' || user.division_scope === 'all') {
      return next();
    }

    // Role-specific check
    if (requiredDivision === 'institute') {
      if (user.role === 'institute_admin' || user.division_scope === 'institute') {
        return next();
      }
    } else if (requiredDivision === 'quran') {
      if (user.role === 'quran_admin' || user.division_scope === 'quran') {
        return next();
      }
    }

    return res.status(403).json({
      success: false,
      error: `Ma lihid fasax aad ku gasho waaxda ${requiredDivision === 'institute' ? 'Machadka (Institute)' : 'Dugsiga Quraanka (Quran)'}.`,
      code: 'FORBIDDEN_DIVISION_SCOPE'
    });
  };
}

/**
 * Helper to check if a user can access a specific division
 */
export function canAccessDivision(user, division) {
  if (!user) return false;
  if (user.role === 'super_admin' || user.role === 'examination_officer' || user.division_scope === 'all') return true;
  if (division === 'institute' && (user.role === 'institute_admin' || user.division_scope === 'institute')) return true;
  if (division === 'quran' && (user.role === 'quran_admin' || user.division_scope === 'quran')) return true;
  return false;
}

