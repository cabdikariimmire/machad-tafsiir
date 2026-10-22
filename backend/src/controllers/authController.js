import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { logAudit } from '../services/auditService.js';

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Fadlan geli magaca isticmaalaha iyo furaha sirta ah (Username and password required).'
      });
    }

    const users = await query(
      `SELECT u.id, u.username, u.password_hash, u.full_name, u.email, u.phone, 
              u.division_scope, u.is_active, r.name as role_name, r.display_name as role_display
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Magaca isticmaalaha ama furaha sirta ah waa khalad (Invalid credentials).'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Akoonkan waa la xannibay (Account is inactive). Fadlan la xiriir maamulaha guud.'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit({
        userId: user.id,
        action: 'FAILED_LOGIN',
        module: 'auth',
        details: `Failed login attempt for user ${username}`,
        ipAddress: req.ip
      });
      return res.status(401).json({
        success: false,
        error: 'Magaca isticmaalaha ama furaha sirta ah waa khalad (Invalid credentials).'
      });
    }

    // Set session user object
    req.session.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: user.role_name,
      role_display: user.role_display,
      division_scope: user.division_scope
    };

    await logAudit({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      details: `User ${user.username} logged in successfully`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Si guul leh ayaad u gashay nidaamka.',
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role_name,
        role_display: user.role_display,
        division_scope: user.division_scope
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res, next) {
  try {
    const userId = req.session?.user?.id;
    if (userId) {
      await logAudit({
        userId,
        action: 'LOGOUT',
        module: 'auth',
        details: 'User logged out',
        ipAddress: req.ip
      });
    }

    req.session.destroy((err) => {
      if (err) {
        return next(err);
      }
      res.clearCookie('mahad_sid');
      res.json({
        success: true,
        message: 'Si guul leh ayaad uga baxday nidaamka.'
      });
    });
  } catch (error) {
    next(error);
  }
}

export function getCurrentUser(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Lama aqoonsan isticmaalaha (Not authenticated).'
    });
  }
  res.json({
    success: true,
    user: req.session.user
  });
}

export async function changePassword(req, res, next) {
  try {
    const userId = req.session.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Fadlan geli furaha hadda iyo furaha cusub labadaba.'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Furaha cusub waa inuu ka koobnaadaa ugu yaraan 6 xaraf.'
      });
    }

    const [user] = await query('SELECT password_hash FROM users WHERE id = ?', [userId]);
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Furaha hadda jira waa khalad.'
      });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]);

    await logAudit({
      userId,
      action: 'PASSWORD_CHANGE',
      module: 'auth',
      details: 'User changed their password',
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Furaha sirta ah si guul leh ayaa loo cusbooneysiiyay.'
    });
  } catch (error) {
    next(error);
  }
}
