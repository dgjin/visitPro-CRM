/**
 * 导出当前系统数据为初始化种子数据（db/seed_data.sql）
 * 覆盖表：roles / departments / users / clients
 * 不导出：visits（拜访记录）、ai_query_history / login_history（运行日志，新环境从空表开始）
 * 生成 INSERT IGNORE 语句，可重复执行：已存在的行（按主键）不会被覆盖。
 *
 * 执行方式（在 server/ 目录下，读取 server/.env 数据库配置）:
 *   node db/export-seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', 'server', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

/** 每张表导出的列（显式列清单，避免结构漂移） */
const TABLE_COLUMNS = {
  roles: ['id', 'name', 'description'],
  departments: ['id', 'name', 'parentId', 'managerId'],
  users: ['id', 'name', 'email', 'phone', 'avatarUrl', 'password', 'roleId', 'departmentId', 'status', 'must_change_password', 'customFields', 'theme_preference'],
  clients: ['id', 'name', 'industry', 'status', 'clientType', 'region', 'isKeyAccount', 'team', 'listCategory', 'isNewClient', 'contacts', 'customFields', 'typeProfile', 'ownerId', 'ownerName', 'equityStructure', 'subsidiaries', 'financialAnalysis', 'supplyChainInfo', 'tags'],
};

/** 数据库 JSON 类型列：导出时须为合法 JSON 文本，空串等脏数据归一为 NULL */
const JSON_COLUMNS = new Set([
  'customFields', 'contacts', 'typeProfile', 'equityStructure', 'subsidiaries', 'tags',
]);

function normalizeValue(col, v) {
  if (v === undefined || v === null) return null;
  if (JSON_COLUMNS.has(col)) {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    if (!s.trim()) return null;
    try { JSON.parse(s); return s; } catch { return null; }
  }
  return v;
}

(async () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const lines = [
    '-- ==========================================',
    '-- VisitPro CRM - 种子数据（由 db/export-seed.cjs 生成，勿手工编辑）',
    `-- 生成时间: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
    '-- 语义: INSERT IGNORE，已存在的行（按主键）保持不变，可重复执行',
    '-- 执行方式: mysql -u root visitpro < db/seed_data.sql',
    '-- ==========================================',
    '',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
  ];

  for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
    const [rows] = await pool.query(`SELECT \`${cols.join('`, `')}\` FROM \`${table}\``);
    lines.push(`-- ${table}: ${rows.length} 行`);
    if (rows.length === 0) { lines.push(''); continue; }
    for (const row of rows) {
      const values = cols.map(c => pool.pool.escape(normalizeValue(c, row[c])));
      lines.push(`INSERT IGNORE INTO \`${table}\` (\`${cols.join('`, `')}\`) VALUES (${values.join(', ')});`);
    }
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;', '');
  const out = path.join(__dirname, 'seed_data.sql');
  fs.writeFileSync(out, lines.join('\n'));
  console.log('已生成', out, '行数:', lines.length);
  await pool.end();
})();
