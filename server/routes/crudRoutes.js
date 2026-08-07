// ==========================================
// 通用 CRUD 路由：列表查询 / 拜访详情 / Upsert / 删除（均需鉴权 + 数据权限 + 引用保护）
// ==========================================
import { Router } from 'express';
import {
  pool, requireAuth, isAdmin, getVisibleUserIds,
  TABLES, getTableMeta, prepareRow, mapRow,
} from '../core.js';

const router = Router();

// 列表查询（拜访按数据权限过滤；客户对所有用户可见，写权限另行控制）
router.get('/api/:table', requireAuth, async (req, res) => {
  const meta = getTableMeta(req, res);
  if (!meta) return;
  try {
    const scoped = req.params.table === 'visits';
    const visibleIds = scoped ? await getVisibleUserIds(req.user) : null;

    let sql;
    const params = [];
    if (req.params.table === 'visits') {
      // 列表排除录音大字段，降低传输量
      const cols = TABLES.visits.columns.filter(c => c !== 'recordingData').map(c => `\`${c}\``).join(', ');
      sql = `SELECT ${cols} FROM \`visits\``;
    } else {
      sql = `SELECT * FROM \`${req.params.table}\``;
    }
    if (visibleIds) {
      if (visibleIds.length === 0) return res.json([]);
      sql += ` WHERE ownerId IN (${visibleIds.map(() => '?').join(',')})`;
      params.push(...visibleIds);
    }
    if (req.params.table === 'visits') sql += ' ORDER BY `date` DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map(r => mapRow(req.params.table, r)));
  } catch (e) {
    console.error(`Fetch ${req.params.table} error:`, e);
    res.status(500).json({ error: e.message });
  }
});

// 拜访详情（含录音大字段）
router.get('/api/visits/:id', requireAuth, async (req, res) => {
  try {
    const visibleIds = await getVisibleUserIds(req.user);
    const [rows] = await pool.query('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '拜访记录不存在' });
    if (visibleIds && !visibleIds.includes(rows[0].ownerId)) {
      return res.status(403).json({ error: '无权查看该拜访记录' });
    }
    res.json(mapRow('visits', rows[0]));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 非管理员仅可修改本人信息（且不含敏感字段）
const SELF_UPDATE_COLS = ['name', 'avatarUrl', 'customFields', 'theme_preference'];

// Upsert（按 id 插入或更新）
router.put('/api/:table', requireAuth, async (req, res) => {
  const meta = getTableMeta(req, res);
  if (!meta) return;
  const table = req.params.table;
  let body = req.body || {};

  // --- 写权限控制 ---
  if (['roles', 'departments'].includes(table) && !isAdmin(req)) {
    return res.status(403).json({ error: '仅管理员可维护角色与部门' });
  }
  if (table === 'users' && !isAdmin(req)) {
    if (body.id !== req.user.uid) return res.status(403).json({ error: '仅管理员可修改他人信息' });
    const self = { id: req.user.uid };
    for (const col of SELF_UPDATE_COLS) if (col in body) self[col] = body[col];
    body = self;
  }
  if ((table === 'clients' || table === 'visits') && !isAdmin(req)) {
    const visibleIds = await getVisibleUserIds(req.user);
    if (!body.ownerId) body = { ...body, ownerId: req.user.uid };
    if (!visibleIds.includes(body.ownerId)) {
      return res.status(403).json({ error: '仅可维护本人或本部门名下的记录' });
    }
    if (body.id) {
      const [existing] = await pool.query(`SELECT ownerId FROM \`${table}\` WHERE id = ?`, [body.id]);
      if (existing.length > 0 && !visibleIds.includes(existing[0].ownerId)) {
        return res.status(403).json({ error: '仅可维护本人或本部门名下的记录' });
      }
    }
  }

  const row = prepareRow(table, body);
  if (!row.id) {
    return res.status(400).json({ error: 'id is required for upsert' });
  }
  const cols = Object.keys(row);
  try {
    const placeholders = cols.map(() => '?').join(', ');
    const updates = cols.filter(c => c !== 'id').map(c => `\`${c}\` = VALUES(\`${c}\`)`).join(', ');
    const sql = `INSERT INTO \`${table}\` (${cols.map(c => `\`${c}\``).join(', ')})
                 VALUES (${placeholders})
                 ${updates ? `ON DUPLICATE KEY UPDATE ${updates}` : ''}`;
    await pool.query(sql, cols.map(c => row[c]));
    res.json({ success: true });
  } catch (e) {
    console.error(`Upsert ${table} error:`, e);
    res.status(500).json({ error: e.message });
  }
});

// 删除（引用保护）
router.delete('/api/:table/:id', requireAuth, async (req, res) => {
  const meta = getTableMeta(req, res);
  if (!meta) return;
  const table = req.params.table;
  const id = req.params.id;
  try {
    // --- 数据权限 ---
    if (!isAdmin(req)) {
      if (['users', 'roles', 'departments'].includes(table)) {
        return res.status(403).json({ error: '仅管理员可删除' });
      }
      if (table === 'clients' || table === 'visits') {
        const visibleIds = await getVisibleUserIds(req.user);
        const [existing] = await pool.query(`SELECT ownerId FROM \`${table}\` WHERE id = ?`, [id]);
        if (existing.length > 0 && !visibleIds.includes(existing[0].ownerId)) {
          return res.status(403).json({ error: '仅可删除本人或本部门名下的记录' });
        }
      }
    }
    // --- 引用保护 ---
    if (table === 'users') {
      if (id === req.user.uid) return res.status(400).json({ error: '不能删除当前登录账号' });
      const [[c1]] = await pool.query('SELECT COUNT(*) AS n FROM clients WHERE ownerId = ?', [id]);
      const [[c2]] = await pool.query('SELECT COUNT(*) AS n FROM visits WHERE ownerId = ?', [id]);
      if (c1.n + c2.n > 0) {
        return res.status(400).json({ error: `该用户名下仍有 ${c1.n} 个客户、${c2.n} 条拜访记录，请先移交后再删除` });
      }
    }
    if (table === 'departments') {
      const [[c1]] = await pool.query('SELECT COUNT(*) AS n FROM departments WHERE parentId = ?', [id]);
      const [[c2]] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE departmentId = ?', [id]);
      if (c1.n + c2.n > 0) {
        return res.status(400).json({ error: `该部门下仍有 ${c1.n} 个子部门、${c2.n} 名成员，请先移除后再删除` });
      }
    }
    if (table === 'roles') {
      const [[c1]] = await pool.query('SELECT COUNT(*) AS n FROM users WHERE roleId = ?', [id]);
      if (c1.n > 0) {
        return res.status(400).json({ error: `仍有 ${c1.n} 名用户使用该角色，请先调整后再删除` });
      }
    }
    await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (e) {
    console.error(`Delete ${table} error:`, e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
