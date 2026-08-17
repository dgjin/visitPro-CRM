# VisitPro CRM — 智慧客户拜访系统

面向外勤销售与客户经理的智能 CRM 系统：语音实时转写录入拜访记录、本地大模型智能问数与报告整理、客户全流程管理。所有 AI 能力均支持本地化部署，数据不出内网。

## 核心功能

| 模块 | 说明 |
|---|---|
| 仪表盘 | 拜访统计、客户概览、近期动态 |
| 客户管理 | 259 家营销清单客户导入、客户负责人指派、标签、联系人、股权/供应链等企业画像 |
| 拜访记录 | 录音 + **本地 FunASR 实时转写**、AI 自动整理、附件上传（PDF/DOCX 解析） |
| 智能问数 | 基于本地 Ollama 大模型的自然语言数据分析，支持图表/表格/流式输出与固定模板 |
| 组织管理 | 用户 / 部门 / 角色管理、客户负责人批量指派 |
| 系统设置 | 自定义字段管理（客户/拜访/用户）、大模型配置、帮助中心 |
| 移动端适配 | 底部 Tab Bar 导航，支持手机浏览器访问 |

## 技术架构

```
浏览器（React 19 + Vite 6 + TypeScript + Tailwind CSS）
    │  /api 反代
    ▼
Spring Boot 3.3.5（Java 17，端口 3006）── MySQL 8（visitpro）
    │                        │
    ▼                        ▼
本地 Ollama（:11434）     本地 FunASR（:8321，SenseVoiceSmall）
 智能问数/AI 整理           语音实时转写/录音转文字
```

- **前端**：React 19 + Vite 6 + TypeScript + Tailwind CSS 3
- **后端**：Spring Boot 3.3.5（主），JWT 鉴权、bcrypt 密码、登录限流、表/列白名单 + 参数化查询；`server/` 下保留 Node.js 旧后端（逐步停用）
- **数据库**：MySQL 8，初始化脚本 `db/schema.sql`，全量种子数据 `db/seed_data.sql`（本地生成，不入库）
- **语音识别**：本地 FunASR（`local-asr/server.py`，OpenAI 兼容接口，已配置 launchd 开机自启）
- **大模型**：本地 Ollama（默认 qwen3.6），可选讯飞星火等云端模型用于 AI 文本生成

## 目录结构

```
├── components/          # 前端页面组件（布局、客户、拜访、管理后台等）
├── services/            # 前端服务层（API、本地 ASR、AI 提供商、模板）
├── db/                  # 数据库 schema、迁移与种子导出脚本
├── server-spring/       # Spring Boot 后端（主后端）
├── server/              # Node.js 旧后端（兼容保留）
├── local-asr/           # 本地 FunASR 服务（Python）
├── scripts/             # 数据导入工具（通讯录、营销清单）
└── doc/                 # DEPLOYMENT.md 部署手册、SYSTEM_DESIGN.md 系统设计
```

## 快速开始

**环境要求**：Node.js 22+、Java 17、Maven、MySQL 8、Python 3（ASR）、Ollama

```bash
# 1. 前端依赖
npm install

# 2. 初始化数据库（配置 server/.env 后）
mysql -u root visitpro < db/schema.sql

# 3. 启动后端（端口 3006）
./server-spring/start.sh

# 4. 启动本地语音识别（端口 8321，可选但录音转写必需）
./local-asr/start.sh

# 5. 启动前端（端口 5173）
npm run dev
```

访问 http://localhost:5173 ，默认管理员账号 `admin`（初始密码 admin123，首次登录强制改密）。

> 完整安装部署手册（含生产环境 Nginx/HTTPS 配置、常见问题）见 [doc/DEPLOYMENT.md](doc/DEPLOYMENT.md)。

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动前端开发服务器（5173） |
| `npm run build` | 生产构建（输出 dist/） |
| `npm test` | 前端单元测试（Vitest） |
| `npm run server` | 启动 Spring Boot 后端 |
| `NODE_PATH=server/node_modules node db/export-seed.cjs` | 从当前库重新生成种子数据 |

## 安全说明

- 密码 bcrypt 哈希存储（旧 SHA-256 登录时自动升级），登录失败 5 次锁定 15 分钟
- JWT 鉴权，密钥经环境变量注入；数据库访问全部参数化查询 + 白名单校验
- `server/.env`（数据库密码）、`db/seed_data.sql`（含手机号与密码哈希）均不入版本库
- 生产部署必须启用 HTTPS（详见 DEPLOYMENT.md）
