-- ==========================================
-- VisitPro CRM - MySQL 本地数据库初始化脚本
-- 执行方式: mysql -u root < db/schema.sql
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
  customFields JSON,
  theme_preference VARCHAR(50),
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
-- 9. 种子数据
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
