-- ==========================================
-- VisitPro CRM - MySQL 本地数据库初始化脚本
-- 执行方式: mysql -u root < db/schema.sql
-- 全量初始化数据（角色/部门/用户/客户快照）: mysql -u root visitpro < db/seed_data.sql
-- 重新生成种子数据: node db/export-seed.cjs
-- ==========================================

-- 1. 创建数据库（utf8mb4 支持中文与 emoji）
CREATE DATABASE IF NOT EXISTS visitpro
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

-- 2. 创建独立用户 visitpro 并授权
CREATE USER IF NOT EXISTS 'visitpro'@'localhost' IDENTIFIED BY 'Visitpro@2026';
CREATE USER IF NOT EXISTS 'visitpro'@'127.0.0.1' IDENTIFIED BY 'Visitpro@2026';
GRANT ALL PRIVILEGES ON visitpro.* TO 'visitpro'@'localhost';
GRANT ALL PRIVILEGES ON visitpro.* TO 'visitpro'@'127.0.0.1';

-- 2.1 创建只读用户 visitpro_ro（仅 SELECT，用于报表/查询类场景）
-- '%' 账号允许任意主机连接（密码与应用账号一致），认证插件用默认 caching_sha2_password
-- 注意：MySQL 9.x 已移除 mysql_native_password 插件，IDENTIFIED WITH mysql_native_password 会报错
CREATE USER IF NOT EXISTS 'visitpro_ro'@'localhost' IDENTIFIED BY 'VisitproRo@2026';
CREATE USER IF NOT EXISTS 'visitpro_ro'@'127.0.0.1' IDENTIFIED BY 'VisitproRo@2026';
CREATE USER IF NOT EXISTS 'visitpro_ro'@'%' IDENTIFIED BY 'Visitpro@2026';
GRANT SELECT ON visitpro.* TO 'visitpro_ro'@'localhost';
GRANT SELECT ON visitpro.* TO 'visitpro_ro'@'127.0.0.1';
GRANT SELECT ON visitpro.* TO 'visitpro_ro'@'%';
FLUSH PRIVILEGES;

USE visitpro;

-- 3. 角色表
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY COMMENT '角色ID',
  name VARCHAR(100) NOT NULL COMMENT '角色名称',
  description TEXT COMMENT '角色描述',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';

-- 4. 部门表（parentId 自关联实现树形结构）
CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(64) PRIMARY KEY COMMENT '部门ID',
  name VARCHAR(100) NOT NULL COMMENT '部门名称',
  parentId VARCHAR(64) NULL COMMENT '上级部门ID（自关联，树形结构）',
  managerId VARCHAR(64) NULL COMMENT '部门负责人ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_depts_parent (parentId),
  CONSTRAINT fk_dept_parent FOREIGN KEY (parentId) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表';

-- 5. 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY COMMENT '用户ID',
  name VARCHAR(100) NOT NULL COMMENT '用户姓名',
  email VARCHAR(200) COMMENT '邮箱（登录标识，唯一）',
  phone VARCHAR(50) COMMENT '手机号（登录标识，唯一）',
  avatarUrl TEXT COMMENT '头像URL',
  password VARCHAR(128) COMMENT '密码（SHA-256 哈希）',
  roleId VARCHAR(64) COMMENT '角色ID',
  departmentId VARCHAR(64) COMMENT '所属部门ID',
  status VARCHAR(20) DEFAULT 'active' COMMENT '账号状态：active=启用 inactive=禁用',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否须首次登录改密：1=是 0=否',
  customFields JSON COMMENT '自定义字段（JSON）',
  theme_preference VARCHAR(50) COMMENT '主题偏好',
  last_login_at DATETIME COMMENT '最近登录时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_phone (phone),
  INDEX idx_users_dept (departmentId),
  CONSTRAINT fk_user_role FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_dept FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- 6. 客户表
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY COMMENT '客户ID',
  name VARCHAR(200) NOT NULL COMMENT '客户名称',
  industry VARCHAR(100) COMMENT '所属行业',
  status VARCHAR(50) COMMENT '客户状态：已签约/潜在客户/已流失/实施中',
  clientType VARCHAR(20) COMMENT '客户类型：地方政府/金融机构/产业客户',
  region VARCHAR(100) COMMENT '所属区域',
  isKeyAccount TINYINT(1) NOT NULL DEFAULT 1 COMMENT '重点客户：1=是 0=否',
  team VARCHAR(100) DEFAULT NULL COMMENT '所属团队',
  listCategory VARCHAR(50) DEFAULT NULL COMMENT '清单分类（重点营销客户大表的客户分类）',
  isNewClient TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否新建客户：1=是 0=否（存量清单客户默认否）',
  contacts JSON COMMENT '联系人列表（JSON）',
  customFields JSON COMMENT '自定义字段（JSON）',
  typeProfile JSON COMMENT '按客户类型区分的专属信息项（JSON）',
  ownerId VARCHAR(64) COMMENT '客户负责人ID',
  ownerName VARCHAR(100) COMMENT '客户负责人姓名',
  equityStructure JSON COMMENT '股权结构：上游股东列表（JSON）',
  subsidiaries JSON COMMENT '下游子公司列表（JSON）',
  financialAnalysis MEDIUMTEXT COMMENT '财务分析（AI 生成）',
  supplyChainInfo MEDIUMTEXT COMMENT '供应链信息（AI 生成）',
  tags JSON COMMENT 'AI 生成标签（行业地位、财务状况等）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';

-- 兼容旧库：为已有 clients 表补充新列
SET @has_client_type = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'clientType');
SET @sql_client_type = IF(@has_client_type = 0, 'ALTER TABLE clients ADD COLUMN clientType VARCHAR(20) NULL COMMENT ''客户类型：地方政府/金融机构/产业客户''', 'SELECT 1');
PREPARE stmt FROM @sql_client_type; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_type_profile = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'typeProfile');
SET @sql_type_profile = IF(@has_type_profile = 0, 'ALTER TABLE clients ADD COLUMN typeProfile JSON NULL COMMENT ''按客户类型区分的专属信息项（JSON）''', 'SELECT 1');
PREPARE stmt FROM @sql_type_profile; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_key_account = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'isKeyAccount');
SET @sql_key_account = IF(@has_key_account = 0, 'ALTER TABLE clients ADD COLUMN isKeyAccount TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''重点客户：1=是 0=否''', 'SELECT 1');
PREPARE stmt FROM @sql_key_account; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_team = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'team');
SET @sql_team = IF(@has_team = 0, 'ALTER TABLE clients ADD COLUMN team VARCHAR(100) DEFAULT NULL COMMENT ''所属团队''', 'SELECT 1');
PREPARE stmt FROM @sql_team; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_list_category = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'listCategory');
SET @sql_list_category = IF(@has_list_category = 0, 'ALTER TABLE clients ADD COLUMN listCategory VARCHAR(50) DEFAULT NULL COMMENT ''清单分类（重点营销客户大表的客户分类）''', 'SELECT 1');
PREPARE stmt FROM @sql_list_category; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_new_client = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'isNewClient');
SET @sql_new_client = IF(@has_new_client = 0, 'ALTER TABLE clients ADD COLUMN isNewClient TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否新建客户：1=是 0=否（存量清单客户默认否）''', 'SELECT 1');
PREPARE stmt FROM @sql_new_client; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. 拜访记录表
CREATE TABLE IF NOT EXISTS visits (
  id VARCHAR(64) PRIMARY KEY COMMENT '拜访记录ID',
  clientId VARCHAR(64) COMMENT '客户ID',
  clientName VARCHAR(200) COMMENT '客户名称',
  date VARCHAR(50) COMMENT '拜访日期（ISO 字符串）',
  content MEDIUMTEXT COMMENT '拜访内容（原始笔记或语音转写文本）',
  type VARCHAR(50) COMMENT '拜访类型：线下拜访/线上会议/电话沟通/客户到访',
  ownerId VARCHAR(64) COMMENT '拜访人ID',
  ownerName VARCHAR(100) COMMENT '拜访人姓名',
  location VARCHAR(200) COMMENT '拜访地点',
  clientContact VARCHAR(100) COMMENT '拜访对象（主要联系人）',
  clientContactRole VARCHAR(100) COMMENT '拜访对象职位',
  clientParticipants TEXT COMMENT '客户方其他参与人（逗号分隔）',
  ourParticipants TEXT COMMENT '我方参与人（逗号分隔）',
  recordingData MEDIUMTEXT COMMENT '录音数据（已废弃，兼容保留）',
  recordings LONGTEXT COMMENT '录音列表（多段录音，JSON）',
  customFields JSON COMMENT '自定义字段（JSON）',
  summary MEDIUMTEXT COMMENT '拜访摘要（AI 生成）',
  sentiment VARCHAR(20) COMMENT '情感倾向：积极/中性/消极（AI 生成）',
  actionItems JSON COMMENT '行动事项列表（AI 生成，JSON）',
  followUpDraft MEDIUMTEXT COMMENT '跟进计划草稿（AI 生成）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_visits_client (clientId),
  CONSTRAINT fk_visit_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='拜访记录表';

-- 8. 登录历史表
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  user_id VARCHAR(64) COMMENT '用户ID',
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  ip_address VARCHAR(64) COMMENT '登录IP地址',
  user_agent TEXT COMMENT '浏览器UA',
  INDEX idx_login_history_user (user_id),
  CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录历史表';

-- ==========================================
-- 9. 种子数据（最小可用集；全量快照见 db/seed_data.sql，由 db/export-seed.cjs 生成）
-- ==========================================

-- 默认角色
INSERT INTO roles (id, name, description) VALUES
  ('role_admin', '管理员', '系统管理员，拥有全部权限'),
  ('role_staff', '普通员工', '普通员工，负责客户与拜访管理')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 默认部门
INSERT INTO departments (id, name, parentId) VALUES
  ('dept_root', '总公司', NULL)
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- 默认管理员账号: admin@visitpro.com / admin123 (SHA-256)
INSERT INTO users (id, name, email, password, roleId, departmentId, status) VALUES
  ('user_admin', '系统管理员', 'admin@visitpro.com',
   '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
   'role_admin', 'dept_root', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- ==========================================
-- 10. 幂等迁移：users 强制改密标记 + 登录标识唯一索引
-- ==========================================
SET @has_must_change = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'must_change_password');
SET @sql_must_change = IF(@has_must_change = 0, 'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否须首次登录改密：1=是 0=否''', 'SELECT 1');
PREPARE stmt FROM @sql_must_change; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_uk_email = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_users_email');
SET @sql_uk_email = IF(@has_uk_email = 0, 'ALTER TABLE users ADD UNIQUE INDEX uk_users_email (email)', 'SELECT 1');
PREPARE stmt FROM @sql_uk_email; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_uk_phone = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_users_phone');
SET @sql_uk_phone = IF(@has_uk_phone = 0, 'ALTER TABLE users ADD UNIQUE INDEX uk_users_phone (phone)', 'SELECT 1');
PREPARE stmt FROM @sql_uk_phone; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 通讯录导入的默认密码用户首次登录须改密
UPDATE users SET must_change_password = 1 WHERE id LIKE 'user_imp_%' AND must_change_password = 0;

-- 智能问数审计日志
CREATE TABLE IF NOT EXISTS ai_query_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
  user_id VARCHAR(100) NOT NULL COMMENT '提问用户ID',
  question VARCHAR(500) COMMENT '提问内容',
  status VARCHAR(20) COMMENT '查询状态：success/error 等',
  detail VARCHAR(2000) COMMENT '结果详情或错误信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '提问时间',
  KEY idx_aiq_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='智能问数审计日志表';
