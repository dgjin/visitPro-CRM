// ==========================================
// 核心基建：数据库连接池 / JWT 鉴权 / 密码工具 / 表元数据 / 数据权限
// 注意：ESM import 提升使本模块先于宿主入口执行，dotenv 必须在此先行加载
// ==========================================
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// ==========================================
// MySQL 连接池
// ==========================================
export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'visitpro',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'visitpro',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z', // 统一按 UTC 存储
});

// ==========================================
// JWT 鉴权
// ==========================================
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  未配置 JWT_SECRET，使用随机密钥（服务重启后所有登录会话失效）。生产环境请在 server/.env 中配置固定密钥。');
}
const TOKEN_TTL = process.env.JWT_TTL || '7d';

export const signToken = (user) => jwt.sign(
  { uid: user.id, role: user.roleName || '', deptId: user.departmentId || null },
  JWT_SECRET,
  { expiresIn: TOKEN_TTL }
);

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: '未登录或会话已过期' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // 每次请求复核账号实时状态：被停用/删除的账号即使持有有效 token 也被拒绝；
    // 角色以数据库为准，避免改角色后旧 token 仍按旧权限生效
    const [rows] = await pool.query(
      'SELECT u.id, u.status, u.departmentId, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ?',
      [payload.uid]
    );
    if (rows.length === 0) return res.status(401).json({ success: false, message: '账号不存在，请重新登录' });
    if (rows[0].status === 'inactive') return res.status(401).json({ success: false, message: '账号已停用，请联系管理员' });
    req.user = { ...payload, role: rows[0].roleName || '', deptId: rows[0].departmentId || null };
    next();
  } catch {
    return res.status(401).json({ success: false, message: '登录已过期，请重新登录' });
  }
};

export const isAdmin = (req) => req.user?.role === '管理员';

// ==========================================
// 密码：服务端 bcrypt 加盐存储；兼容旧 SHA-256 哈希（登录时自动升级）
// 前端传输 SHA-256(明文)，服务端对该摘要再做 bcrypt（本地 HTTP 环境不传明文）
// ==========================================
export const isLegacyHash = (v) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const verifyPassword = (stored, receivedHash) => {
  if (!stored || !receivedHash) return false;
  if (isLegacyHash(stored)) return stored === receivedHash;
  try { return bcrypt.compareSync(receivedHash, stored); } catch { return false; }
};
export const hashForStorage = (receivedHash) => bcrypt.hashSync(receivedHash, 10);

// ==========================================
// 表元数据：列白名单 / JSON 列 / 日期列
// ==========================================
export const TABLES = {
  roles: {
    columns: ['id', 'name', 'description', 'created_at'],
    json: [],
    dates: ['created_at'],
  },
  departments: {
    columns: ['id', 'name', 'parentId', 'managerId', 'created_at'],
    json: [],
    dates: ['created_at'],
  },
  users: {
    columns: ['id', 'name', 'email', 'phone', 'avatarUrl', 'roleId', 'departmentId', 'status', 'customFields', 'theme_preference', 'last_login_at', 'created_at'],
    json: ['customFields'],
    dates: ['last_login_at', 'created_at'],
  },
  clients: {
    columns: ['id', 'name', 'industry', 'status', 'clientType', 'region', 'isKeyAccount', 'team', 'listCategory', 'contacts', 'customFields', 'typeProfile', 'ownerId', 'ownerName', 'equityStructure', 'subsidiaries', 'financialAnalysis', 'supplyChainInfo', 'tags', 'created_at'],
    json: ['contacts', 'customFields', 'typeProfile', 'equityStructure', 'subsidiaries', 'tags'],
    dates: ['created_at'],
  },
  visits: {
    columns: ['id', 'clientId', 'clientName', 'date', 'content', 'type', 'ownerId', 'ownerName', 'location', 'clientContact', 'clientContactRole', 'clientParticipants', 'ourParticipants', 'recordingData', 'recordings', 'customFields', 'summary', 'sentiment', 'actionItems', 'followUpDraft', 'created_at'],
    json: ['customFields', 'actionItems', 'recordings'], // recordings 为 LONGTEXT，读出后手动解析
    dates: ['created_at'],
  },
};

// ISO 字符串 -> MySQL DATETIME 字符串
export const toMySqlDatetime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// 写入前：过滤列白名单 + 序列化 JSON/日期列
export const prepareRow = (table, body) => {
  const meta = TABLES[table];
  const row = {};
  for (const col of meta.columns) {
    if (col === 'created_at') continue; // 由数据库默认值生成
    if (!(col in body)) continue;
    let value = body[col];
    if (meta.json.includes(col)) {
      value = value === null || value === undefined ? null : JSON.stringify(value);
    } else if (meta.dates.includes(col)) {
      value = toMySqlDatetime(value);
    }
    row[col] = value === undefined ? null : value;
  }
  return row;
};

// 读取后：日期列转 ISO 字符串，JSON 列空值归一化（对齐前端默认值）
const JSON_DEFAULTS = {
  customFields: {},
  contacts: [],
  typeProfile: {},
  equityStructure: [],
  subsidiaries: [],
  tags: [],
  actionItems: [],
  recordings: [],
};

export const mapRow = (table, row) => {
  const meta = TABLES[table];
  const out = { ...row };
  delete out.password; // 密码哈希永不下发
  for (const col of meta.dates) {
    if (out[col] instanceof Date) out[col] = out[col].toISOString();
  }
  for (const col of meta.json) {
    if (typeof out[col] === 'string') {
      try { out[col] = JSON.parse(out[col]); } catch { out[col] = JSON_DEFAULTS[col] ?? null; }
    }
    if (out[col] === null || out[col] === undefined) {
      out[col] = JSON_DEFAULTS[col] ?? null;
    }
  }
  return out;
};

export const getTableMeta = (req, res) => {
  const meta = TABLES[req.params.table];
  if (!meta) { res.status(404).json({ error: `Unknown table: ${req.params.table}` }); return null; }
  return meta;
};

// ==========================================
// 数据权限：非管理员可见范围 = 本人 + 所在部门子树内成员
// 返回 null 表示不限制（管理员）
// ==========================================
export const getVisibleUserIds = async (reqUser) => {
  if (isAdmin({ user: reqUser })) return null;
  const ids = new Set([reqUser.uid]);
  if (reqUser.deptId) {
    const [allDepts] = await pool.query('SELECT id, parentId FROM departments');
    const childrenOf = {};
    allDepts.forEach(d => { (childrenOf[d.parentId] = childrenOf[d.parentId] || []).push(d.id); });
    const subtree = [reqUser.deptId];
    for (let i = 0; i < subtree.length; i++) {
      (childrenOf[subtree[i]] || []).forEach(c => subtree.push(c));
    }
    if (subtree.length > 0) {
      const [deptUsers] = await pool.query(
        `SELECT id FROM users WHERE departmentId IN (${subtree.map(() => '?').join(',')})`,
        subtree
      );
      deptUsers.forEach(u => ids.add(u.id));
    }
  }
  return [...ids];
};
