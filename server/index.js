import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 录音 Base64 数据可能较大

// ==========================================
// MySQL 连接池
// ==========================================
const pool = mysql.createPool({
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
// 表元数据：列白名单 / JSON 列 / 日期列
// ==========================================
const TABLES = {
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
    columns: ['id', 'name', 'email', 'phone', 'avatarUrl', 'password', 'roleId', 'departmentId', 'status', 'customFields', 'theme_preference', 'last_login_at', 'created_at'],
    json: ['customFields'],
    dates: ['last_login_at', 'created_at'],
  },
  clients: {
    columns: ['id', 'name', 'industry', 'status', 'clientType', 'region', 'contacts', 'customFields', 'typeProfile', 'ownerId', 'ownerName', 'equityStructure', 'subsidiaries', 'financialAnalysis', 'supplyChainInfo', 'tags', 'created_at'],
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
const toMySqlDatetime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

// 写入前：过滤列白名单 + 序列化 JSON/日期列
const prepareRow = (table, body) => {
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

const mapRow = (table, row) => {
  const meta = TABLES[table];
  const out = { ...row };
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

const getTableMeta = (req, res) => {
  const meta = TABLES[req.params.table];
  if (!meta) { res.status(404).json({ error: `Unknown table: ${req.params.table}` }); return null; }
  return meta;
};

// ==========================================
// 健康检查
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, database: 'visitpro (MySQL)' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 登录认证
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, passwordHash, userAgent } = req.body || {};
  // email 字段兼容手机号登录（账号 = 邮箱或手机号）
  const identifier = typeof email === 'string' ? email.trim() : '';
  if (!identifier || !passwordHash) {
    return res.status(400).json({ success: false, message: '缺少账号或密码' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT u.*, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.email = ? OR u.phone = ?',
      [identifier, identifier]
    );
    if (rows.length === 0) {
      return res.json({ success: false, message: '用户不存在或账号错误' });
    }
    const user = rows[0];
    if (user.password !== passwordHash) {
      return res.json({ success: false, message: '密码错误' });
    }

    const now = toMySqlDatetime(new Date().toISOString());
    // 更新最后登录时间 + 记录登录历史
    await pool.query('UPDATE users SET last_login_at = ? WHERE id = ?', [now, user.id]);
    await pool.query(
      'INSERT INTO login_history (user_id, login_at, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [user.id, now, req.ip, userAgent || null]
    );

    // 附带角色名（前端权限判断依赖 role 字段）
    res.json({ success: true, user: { ...mapRow('users', user), role: user.roleName || '' } });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ success: false, message: e.message });
  }
});

// ==========================================
// 登录历史
// ==========================================
app.get('/api/login-history/:userId', async (req, res) => {
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

// ==========================================
// Ollama 本地模型代理（规避浏览器 CORS）
// OLLAMA_BASE 可在 server/.env 中配置
// ==========================================
const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://127.0.0.1:11434';

// 获取本地已安装模型列表
app.get('/api/ollama/models', async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`Ollama responded ${r.status}`);
    const data = await r.json();
    res.json({ success: true, models: (data.models || []).map(m => m.name) });
  } catch (e) {
    res.status(503).json({ success: false, message: `无法连接 Ollama (${OLLAMA_BASE})，请确认 ollama serve 已启动: ${e.message}` });
  }
});

// 对话补全（OpenAI 兼容接口转发）
app.post('/api/ollama/chat', async (req, res) => {
  const { model, messages, jsonMode } = req.body || {};
  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'model and messages are required' });
  }
  try {
    const r = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: `Ollama Error ${r.status}: ${text.slice(0, 300)}` });
    }
    const data = await r.json();
    res.json({ content: data.choices?.[0]?.message?.content ?? '' });
  } catch (e) {
    res.status(503).json({ error: `无法连接 Ollama (${OLLAMA_BASE})，请确认 ollama serve 已启动: ${e.message}` });
  }
});

// ==========================================
// 通用 CRUD：列表查询
// ==========================================
app.get('/api/:table', async (req, res) => {
  const meta = getTableMeta(req, res);
  if (!meta) return;
  try {
    const orderBy = req.params.table === 'visits' ? ' ORDER BY `date` DESC' : '';
    const [rows] = await pool.query(`SELECT * FROM \`${req.params.table}\`${orderBy}`);
    res.json(rows.map(r => mapRow(req.params.table, r)));
  } catch (e) {
    console.error(`Fetch ${req.params.table} error:`, e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// 通用 CRUD：Upsert（按 id 插入或更新）
// ==========================================
app.put('/api/:table', async (req, res) => {
  const meta = getTableMeta(req, res);
  if (!meta) return;
  const row = prepareRow(req.params.table, req.body || {});
  if (!row.id) {
    return res.status(400).json({ error: 'id is required for upsert' });
  }
  const cols = Object.keys(row);
  try {
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols.filter(c => c !== 'id').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
    const sql = `INSERT INTO \`${req.params.table}\` (${cols.map(c => `\`${c}\``).join(', ')})
                 VALUES (${placeholders})
                 ${updates ? `ON DUPLICATE KEY UPDATE ${updates}` : ''}`;
    await pool.query(sql, cols.map(c => row[c]));
    res.json({ success: true });
  } catch (e) {
    console.error(`Upsert ${req.params.table} error:`, e);
    res.status(500).json({ error: e.message });
  }
});

// ==========================================
// 通用 CRUD：删除
// ==========================================
app.delete('/api/:table/:id', async (req, res) => {
  const meta = getTableMeta(req, res);
  if (!meta) return;
  try {
    await pool.query(`DELETE FROM \`${req.params.table}\` WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    console.error(`Delete ${req.params.table} error:`, e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`✅ VisitPro API server running at http://localhost:${PORT}`);
  console.log(`   Database: ${process.env.DB_NAME || 'visitpro'} @ ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306} (user: ${process.env.DB_USER || 'visitpro'})`);
});
