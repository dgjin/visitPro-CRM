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
FLUSH PRIVILEGES;

USE visitpro;

-- 3. 角色表
CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 部门表（parentId 自关联实现树形结构）
CREATE TABLE IF NOT EXISTS departments (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parentId VARCHAR(64) NULL,
  managerId VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_depts_parent (parentId),
  CONSTRAINT fk_dept_parent FOREIGN KEY (parentId) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  phone VARCHAR(50),
  avatarUrl TEXT,
  password VARCHAR(128),
  roleId VARCHAR(64),
  departmentId VARCHAR(64),
  status VARCHAR(20) DEFAULT 'active',
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  customFields JSON,
  theme_preference VARCHAR(50),
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_users_email (email),
  UNIQUE KEY uk_users_phone (phone),
  INDEX idx_users_dept (departmentId),
  CONSTRAINT fk_user_role FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE SET NULL,
  CONSTRAINT fk_user_dept FOREIGN KEY (departmentId) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. 客户表
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  industry VARCHAR(100),
  status VARCHAR(50),
  clientType VARCHAR(20),
  region VARCHAR(100),
  isKeyAccount TINYINT(1) NOT NULL DEFAULT 1 COMMENT '重点客户：1=是 0=否',
  team VARCHAR(100) DEFAULT NULL COMMENT '所属团队',
  listCategory VARCHAR(50) DEFAULT NULL COMMENT '清单分类（重点营销客户大表的客户分类）',
  contacts JSON,
  customFields JSON,
  typeProfile JSON,
  ownerId VARCHAR(64),
  ownerName VARCHAR(100),
  equityStructure JSON,
  subsidiaries JSON,
  financialAnalysis MEDIUMTEXT,
  supplyChainInfo MEDIUMTEXT,
  tags JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 兼容旧库：为已有 clients 表补充新列
SET @has_client_type = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'clientType');
SET @sql_client_type = IF(@has_client_type = 0, 'ALTER TABLE clients ADD COLUMN clientType VARCHAR(20) NULL', 'SELECT 1');
PREPARE stmt FROM @sql_client_type; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_type_profile = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'typeProfile');
SET @sql_type_profile = IF(@has_type_profile = 0, 'ALTER TABLE clients ADD COLUMN typeProfile JSON NULL', 'SELECT 1');
PREPARE stmt FROM @sql_type_profile; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_key_account = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'isKeyAccount');
SET @sql_key_account = IF(@has_key_account = 0, 'ALTER TABLE clients ADD COLUMN isKeyAccount TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''重点客户：1=是 0=否''', 'SELECT 1');
PREPARE stmt FROM @sql_key_account; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_team = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'team');
SET @sql_team = IF(@has_team = 0, 'ALTER TABLE clients ADD COLUMN team VARCHAR(100) DEFAULT NULL COMMENT ''所属团队''', 'SELECT 1');
PREPARE stmt FROM @sql_team; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @has_list_category = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = 'visitpro' AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'listCategory');
SET @sql_list_category = IF(@has_list_category = 0, 'ALTER TABLE clients ADD COLUMN listCategory VARCHAR(50) DEFAULT NULL COMMENT ''清单分类''', 'SELECT 1');
PREPARE stmt FROM @sql_list_category; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 7. 拜访记录表
CREATE TABLE IF NOT EXISTS visits (
  id VARCHAR(64) PRIMARY KEY,
  clientId VARCHAR(64),
  clientName VARCHAR(200),
  date VARCHAR(50),
  content MEDIUMTEXT,
  type VARCHAR(50),
  ownerId VARCHAR(64),
  ownerName VARCHAR(100),
  location VARCHAR(200),
  clientContact VARCHAR(100),
  clientContactRole VARCHAR(100),
  clientParticipants TEXT,
  ourParticipants TEXT,
  recordingData MEDIUMTEXT,
  recordings LONGTEXT,
  customFields JSON,
  summary MEDIUMTEXT,
  sentiment VARCHAR(20),
  actionItems JSON,
  followUpDraft MEDIUMTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_visits_client (clientId),
  CONSTRAINT fk_visit_client FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. 登录历史表
CREATE TABLE IF NOT EXISTS login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64),
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(64),
  user_agent TEXT,
  INDEX idx_login_history_user (user_id),
  CONSTRAINT fk_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
SET @sql_must_change = IF(@has_must_change = 0, 'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0', 'SELECT 1');
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
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(100) NOT NULL,
  question VARCHAR(500),
  status VARCHAR(20),
  detail VARCHAR(2000),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  KEY idx_aiq_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
