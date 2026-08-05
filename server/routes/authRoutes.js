// ==========================================
// 认证路由：登录（含暴力破解防护）/ 会话恢复 / 改密 / 重置密码 / 登录历史
// ==========================================
import { Router } from 'express';
import {
  pool, signToken, requireAuth, isAdmin,
  verifyPassword, hashForStorage, isLegacyHash,
  toMySqlDatetime, mapRow,
} from '../core.js';

const router = Router();

// 暴力破解防护：同一账号+IP 失败 N 次后锁定 M 分钟（内存计数，重启清零）
const LOGIN_MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS || 5);
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const loginAttempts = new Map(); // key -> { count, lockedUntil }

const loginKey = (identifier, ip) => `${identifier.toLowerCase()}|${ip}`;

const checkLoginLock = (key) => {
  const rec = loginAttempts.get(key);
  if (rec?.lockedUntil && rec.lockedUntil > Date.now()) {
    return Math.ceil((rec.lockedUntil - Date.now()) / 60000);
  }
  return null;
};

const recordLoginFail = (key) => {
  const rec = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_FAILS) {
    rec.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    rec.count = 0;
  }
  loginAttempts.set(key, rec);
  return rec.lockedUntil > Date.now();
};

// 定期清理过期记录，防止内存缓慢增长
setInterval(() => {
  const now = Date.now();
  for (const [k, rec] of loginAttempts) {
    if ((!rec.lockedUntil || rec.lockedUntil < now) && rec.count === 0) loginAttempts.delete(k);
  }
}, 10 * 60 * 1000).unref();

router.post('/api/auth/login', async (req, res) => {
  const { email, passwordHash, userAgent } = req.body || {};
  // email 字段兼容手机号登录（账号 = 邮箱或手机号）
  const identifier = typeof email === 'string' ? email.trim() : '';
  if (!identifier || !passwordHash) {
    return res.status(400).json({ success: false, message: '缺少账号或密码' });
  }
  const attemptKey = loginKey(identifier, req.ip);
  const lockMinutes = checkLoginLock(attemptKey);
  if (lockMinutes) {
    return res.json({ success: false, message: `失败次数过多，账号已临时锁定，请 ${lockMinutes} 分钟后再试` });
  }
  try {
    const [rows] = await pool.query(
      'SELECT u.*, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.email = ? OR u.phone = ?',
      [identifier, identifier]
    );
    if (rows.length === 0) {
      recordLoginFail(attemptKey);
      return res.json({ success: false, message: '用户不存在或账号错误' });
    }
    const user = rows[0];
    if (user.status === 'inactive') {
      return res.json({ success: false, message: '账号已停用，请联系管理员' });
    }
    if (!verifyPassword(user.password, passwordHash)) {
      const locked = recordLoginFail(attemptKey);
      return res.json({
        success: false,
        message: locked ? '失败次数过多，账号已临时锁定，请稍后再试' : '密码错误',
      });
    }

    // 登录成功：清除失败计数
    loginAttempts.delete(attemptKey);

    // 旧 SHA-256 哈希登录成功后透明升级为 bcrypt 加盐存储
    if (isLegacyHash(user.password)) {
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashForStorage(passwordHash), user.id]);
    }

    const now = toMySqlDatetime(new Date().toISOString());
    await pool.query('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id]);
    await pool.query(
      'INSERT INTO login_history (user_id, login_at, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [user.id, now, req.ip, userAgent || null]
    );
    // 登录历史只保留 180 天
    pool.query('DELETE FROM login_history WHERE login_at < DATE_SUB(NOW(), INTERVAL 180 DAY)').catch(() => {});

    res.json({
      success: true,
      token: signToken(user),
      user: { ...mapRow('users', user), role: user.roleName || '', mustChangePassword: !!user.must_change_password },
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// 会话恢复：凭 token 取当前用户
router.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT u.*, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ?',
      [req.user.uid]
    );
    if (rows.length === 0) return res.status(401).json({ success: false, message: '用户不存在' });
    const user = rows[0];
    res.json({ success: true, user: { ...mapRow('users', user), role: user.roleName || '', mustChangePassword: !!user.must_change_password } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 本人改密（首次强制改密 / 自主修改）
router.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPasswordHash, newPasswordHash } = req.body || {};
  if (!newPasswordHash || newPasswordHash.length < 8) {
    return res.status(400).json({ success: false, message: '新密码强度不足' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.uid]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: '用户不存在' });
    const user = rows[0];
    if (!verifyPassword(user.password, currentPasswordHash)) {
      return res.json({ success: false, message: '当前密码错误' });
    }
    await pool.query('UPDATE users SET password = ?, must_change_password = 0 WHERE id = ?', [hashForStorage(newPasswordHash), user.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 管理员重置他人密码（重置后强制改密）
router.post('/api/auth/reset-password', requireAuth, async (req, res) => {
  if (!isAdmin(req)) return res.status(403).json({ success: false, message: '仅管理员可重置密码' });
  const { userId, newPasswordHash } = req.body || {};
  if (!userId || !newPasswordHash || newPasswordHash.length < 8) {
    return res.status(400).json({ success: false, message: '参数无效' });
  }
  try {
    const [r] = await pool.query('UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?', [hashForStorage(newPasswordHash), userId]);
    if (r.affectedRows === 0) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 登录历史（本人或管理员可查）
router.get('/api/login-history/:userId', requireAuth, async (req, res) => {
  if (!isAdmin(req) && req.user.uid !== req.params.userId) {
    return res.status(403).json({ error: '无权查看他人登录历史' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM login_history WHERE user_id = ? ORDER BY login_at DESC LIMIT 50',
      [req.params.userId]
    );
    res.json(rows.map(r => ({ ...r, login_at: r.login_at instanceof Date ? r.login_at.toISOString() : r.login_at, id: String(r.id) })));
  } catch (e) {
    console.error('Login history error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
