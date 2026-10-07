/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_query_history` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id` varchar(100) NOT NULL COMMENT '提问用户ID',
  `question` varchar(500) DEFAULT NULL COMMENT '提问内容',
  `status` varchar(20) DEFAULT NULL COMMENT '查询状态：success/error 等',
  `detail` varchar(2000) DEFAULT NULL COMMENT '结果详情或错误信息',
  `answer` text COMMENT '最终结论文本（历史回放）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '提问时间',
  `plan_json` text COMMENT '查询计划 JSON（审计与质量复盘）',
  `result_json` json DEFAULT NULL COMMENT '结果快照（口径/图表/表格），用于历史回放',
  `retry_count` int NOT NULL DEFAULT '0' COMMENT '计划纠错重试次数',
  `latency_ms` int DEFAULT NULL COMMENT '端到端耗时（毫秒）',
  `feedback` varchar(10) DEFAULT NULL COMMENT '用户反馈：up/down',
  `feedback_note` varchar(200) DEFAULT NULL COMMENT '反馈备注',
  PRIMARY KEY (`id`),
  KEY `idx_aiq_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=143 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='智能问数审计日志表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `clients` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户ID',
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '客户名称',
  `industry` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '所属行业',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户状态：已签约/潜在客户/已流失/实施中',
  `region` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '所属区域',
  `contacts` json DEFAULT NULL COMMENT '联系人列表（JSON）',
  `customFields` json DEFAULT NULL COMMENT '自定义字段（JSON）',
  `ownerId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户负责人ID',
  `ownerName` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户负责人姓名',
  `equityStructure` json DEFAULT NULL COMMENT '股权结构：上游股东列表（JSON）',
  `subsidiaries` json DEFAULT NULL COMMENT '下游子公司列表（JSON）',
  `financialAnalysis` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '财务分析（AI 生成）',
  `supplyChainInfo` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '供应链信息（AI 生成）',
  `tags` json DEFAULT NULL COMMENT 'AI 生成标签（行业地位、财务状况等）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `clientType` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户类型：地方政府/金融机构/产业客户',
  `typeProfile` json DEFAULT NULL COMMENT '按客户类型区分的专属信息项（JSON）',
  `isKeyAccount` tinyint(1) NOT NULL DEFAULT '1' COMMENT '重点客户：1=是 0=否',
  `team` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '所属团队',
  `listCategory` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '清单分类（重点营销客户大表的客户分类）',
  `isNewClient` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否新建客户：1=是 0=否',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `departments` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '部门ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '部门名称',
  `parentId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '上级部门ID（自关联，树形结构）',
  `managerId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '部门负责人ID',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_depts_parent` (`parentId`),
  CONSTRAINT `fk_dept_parent` FOREIGN KEY (`parentId`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='部门表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_history` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '用户ID',
  `login_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '登录时间',
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '登录IP地址',
  `user_agent` text COLLATE utf8mb4_unicode_ci COMMENT '浏览器UA',
  PRIMARY KEY (`id`),
  KEY `idx_login_history_user` (`user_id`),
  CONSTRAINT `fk_login_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=89 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='登录历史表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '角色名称',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '角色描述',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='角色表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户ID',
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户姓名',
  `email` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邮箱（登录标识，唯一）',
  `phone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '手机号（登录标识，唯一）',
  `avatarUrl` text COLLATE utf8mb4_unicode_ci COMMENT '头像URL',
  `password` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '密码（SHA-256 哈希）',
  `roleId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '角色ID',
  `departmentId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '所属部门ID',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '账号状态：active=启用 inactive=禁用',
  `customFields` json DEFAULT NULL COMMENT '自定义字段（JSON）',
  `theme_preference` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '主题偏好',
  `last_login_at` datetime DEFAULT NULL COMMENT '最近登录时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `must_change_password` tinyint(1) NOT NULL DEFAULT '0' COMMENT '是否须首次登录改密：1=是 0=否',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  UNIQUE KEY `uk_users_phone` (`phone`),
  KEY `idx_users_dept` (`departmentId`),
  KEY `fk_user_role` (`roleId`),
  CONSTRAINT `fk_user_dept` FOREIGN KEY (`departmentId`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_user_role` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `visits` (
  `id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '拜访记录ID',
  `clientId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户ID',
  `clientName` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '客户名称',
  `date` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访日期（ISO 字符串）',
  `content` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '拜访内容（原始笔记或语音转写文本）',
  `type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访类型：线下拜访/线上会议/电话沟通/客户到访',
  `ownerId` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访人ID',
  `ownerName` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访人姓名',
  `location` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访地点',
  `clientContact` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访对象（主要联系人）',
  `clientContactRole` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '拜访对象职位',
  `clientParticipants` text COLLATE utf8mb4_unicode_ci COMMENT '客户方其他参与人（逗号分隔）',
  `ourParticipants` text COLLATE utf8mb4_unicode_ci COMMENT '我方参与人（逗号分隔）',
  `recordingData` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '录音数据（已废弃，兼容保留）',
  `recordings` longtext COLLATE utf8mb4_unicode_ci COMMENT '录音列表（多段录音，JSON）',
  `customFields` json DEFAULT NULL COMMENT '自定义字段（JSON）',
  `summary` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '拜访摘要（AI 生成）',
  `sentiment` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '情感倾向：积极/中性/消极（AI 生成）',
  `actionItems` json DEFAULT NULL COMMENT '行动事项列表（AI 生成，JSON）',
  `followUpDraft` mediumtext COLLATE utf8mb4_unicode_ci COMMENT '跟进计划草稿（AI 生成）',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_visits_client` (`clientId`),
  CONSTRAINT `fk_visit_client` FOREIGN KEY (`clientId`) REFERENCES `clients` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='拜访记录表';
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

