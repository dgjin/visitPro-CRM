# VisitPro CRM 安装部署手册

> 智慧客户拜访系统 —— 本地化部署指南
> 适用版本：2026-08（Spring Boot 后端 + MySQL + 本地 ASR + 本地 Ollama）

---

## 1. 系统架构

| 组件 | 技术栈 | 端口 | 目录 |
|---|---|---|---|
| 前端 | React 19 + Vite 6 + TypeScript + TailwindCSS | 5173（开发） | 项目根目录 |
| 后端 API | Spring Boot 3.3.5 / Java 17 / Maven | 3006 | `server-spring/` |
| 数据库 | MySQL 8.x（utf8mb4） | 3306 | 初始化脚本见 `db/` |
| 语音识别（ASR） | Python + FunASR（SenseVoiceSmall，离线） | 8321 | `local-asr/` |
| 智能问数 LLM | 本地 Ollama（OpenAI 兼容接口） | 11434 | 系统外部依赖 |

前端开发模式通过 Vite 代理将 `/api` 转发到 `http://localhost:3006`，前端不持有任何密钥（密钥一律在 `server/.env` 或系统设置中配置）。

> 说明：`server/` 目录为旧 Node 版后端（Express + mysql2），与 Spring 版 API 契约一致，仅作为回滚备份保留。**两者共用 3006 端口与同一份 `server/.env` 配置，不可同时启动。**

---

## 2. 环境要求

| 依赖 | 版本要求 | 验证命令 |
|---|---|---|
| Node.js | ≥ 20（推荐 22） | `node -v` |
| Java | 17 | `java -version` |
| Maven | 3.8+ | `mvn -v` |
| MySQL | 8.x | `mysql --version` |
| Python | 3.10+（仅 ASR 需要） | `python3 -V` |
| Ollama | 任意近期版本（仅智能问数需要） | `ollama -v` |

---

## 3. 数据库初始化

### 3.1 建库建表 + 应用账号

```bash
mysql -u root < db/schema.sql
```

脚本幂等（`CREATE ... IF NOT EXISTS` + 自动补列迁移），重复执行安全。该脚本会：

- 创建 `visitpro` 数据库（utf8mb4）；
- 创建应用账号 `visitpro@localhost / 127.0.0.1`（默认密码见脚本内，**生产环境请修改**）并授权；
- 创建 7 张表：`roles / departments / users / clients / visits / login_history / ai_query_history`；
- 写入最小种子数据（默认管理员等）。

### 3.2 导入全量初始化数据

```bash
mysql -u root visitpro < db/seed_data.sql
```

`db/seed_data.sql` 为当前系统的完整数据快照（角色 5、部门 14、用户 43、客户 259（含客户负责人 ownerId/ownerName））。**不包含拜访记录（visits）与运行日志（智能问数历史、登录历史）**，这些在新环境中从空表开始。采用 `INSERT IGNORE` 语义，**可重复执行，已存在的行不会被覆盖**。

> ⚠️ **该文件含用户手机号与密码哈希，已被 `.gitignore` 排除，仅保留在本地、不入版本库。**
> 新环境获取方式二选一：
> 1. 从现有部署环境运行 `node db/export-seed.cjs` 生成后线下传递；
> 2. 跳过本步骤，仅用 `schema.sql` 的最小种子数据初始化，后续在系统中录入。

### 3.3 重新生成种子数据（数据变更后）

```bash
NODE_PATH=server/node_modules node db/export-seed.cjs    # 读取 server/.env 连接数据库，重新生成 db/seed_data.sql（不导出 visits 与运行日志表）
```

### 3.4 配置后端连接

编辑 `server/.env`（Spring 与 Node 后端共用）：

```ini
# MySQL 连接
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=visitpro
DB_PASSWORD=<数据库密码>
DB_NAME=visitpro

# API 端口
PORT=3006

# JWT 签名密钥（固定后重启不踢登录；务必替换为随机长字符串）
JWT_SECRET=<随机字符串>

# 智能问数 LLM（OpenAI 兼容接口，指向本地 Ollama）
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=<已拉取的模型名>
AI_TIMEOUT_MS=180000
```

> 云端 AI 密钥（Gemini/DeepSeek/Moonshot）已失效，智能问数默认走本地 Ollama；恢复云端后改回 `AI_BASE_URL` 即可。本地推理较慢，超时建议 ≥ 180s。

---

## 4. 启动后端

```bash
cd server-spring
./start.sh          # 自动加载 ../server/.env，等效 mvn spring-boot:run
# 或在项目根目录：npm run server
```

健康检查：

```bash
curl http://localhost:3006/api/health
# 期望输出: {"database":"visitpro (MySQL)","success":true}
```

后端测试（智能问数契约测试 18 项）：`cd server-spring && mvn test`

---

## 5. 启动前端

```bash
npm install
npm run dev         # 默认 http://localhost:5173（端口被占用时自动顺延）
```

打开浏览器访问，使用种子数据中的管理员账号登录（初始密码 `admin123`，登录后请及时修改）。通讯录导入的用户（`user_imp_*`）首次登录会被强制改密。

前端单元测试：`npm test`（vitest，覆盖清单模板等核心逻辑）。

---

## 6. 本地语音识别服务（必需）

拜访录音的实时转写与录音转文字统一使用本地 FunASR（离线、免费），不再依赖云端讯飞。该服务未启动时录音转写功能不可用。

```bash
cd local-asr
python3 -m venv .venv
.venv/bin/pip install funasr torch fastapi uvicorn   # 首次安装（模型约数 GB）
./start.sh                                            # 前台启动，默认端口 8321
```

### 配置 macOS 开机自启（launchd）

```bash
ln -sf "$(pwd)/com.visitpro.local-asr.plist" ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.visitpro.local-asr.plist
launchctl list | grep visitpro    # 有输出即注册成功
```

plist 配置要点：`RunAtLoad=true`；`KeepAlive.SuccessfulExit=false`（仅异常退出时自动拉起）；`ThrottleInterval=30`；日志输出到 `local-asr/logs/`。

验证：

```bash
curl http://localhost:8321/health
```

---

## 7. 生产构建与静态部署

```bash
npm run build       # 产物输出到 dist/
npm run preview     # 本地预览构建产物
```

将 `dist/` 部署到任意静态服务器（Nginx 等）。**必须配置 `/api` 反向代理到后端**，示例 Nginx：

```nginx
server {
    listen 80;
    root /path/to/dist;
    location / {
        try_files $uri /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3006;
        proxy_set_header Host $host;
    }
}
```

生产环境建议：

- 修改 `db/schema.sql` 中的应用账号默认密码与 `JWT_SECRET`；
- `db/seed_data.sql` 不在版本库中（仅本地保留），如需导入请通过线下渠道获取；
- 前端访问启用 HTTPS。

---

## 8. 部署验证清单

| 检查项 | 方法 | 期望结果 |
|---|---|---|
| 数据库 | `curl localhost:3006/api/health` | `success: true` |
| 鉴权 | `curl localhost:3006/api/clients` | 返回 401（未登录拦截生效） |
| 登录 | 浏览器登录管理员账号 | 进入仪表盘 |
| 客户数据 | 客户管理列表 | 259 家客户，团队/清单分类列正常 |
| 智能问数 | 提问"有多少重点客户" | 返回统计结果（依赖 Ollama 在线） |
| 语音转写 | 拜访录音上传 | 转写成功（依赖 8321 服务） |

---

## 9. 常见问题

| 问题 | 原因与处理 |
|---|---|
| 后端启动报端口占用 | 3006 被 Node 版后端或旧进程占用：`lsof -ti :3006` 找到并停止后重启 |
| `Invalid JSON text` 导入报错 | JSON 列存在空串脏数据，用 `node db/export-seed.cjs` 重新生成种子（脚本会自动归一为 NULL） |
| 重启后全员掉登录 | `JWT_SECRET` 发生变化，固定该值即可 |
| 智能问数超时 | 本地模型推理慢，调大 `AI_TIMEOUT_MS`；或换更小模型 |
| 转写无响应 | 检查 `curl localhost:8321/health`；查看 `local-asr/logs/` 日志 |
| 新建客户字段保存丢失 | 新增 DB 列后须同步加入两处白名单：`server/core.js` 的 `TABLES.clients.columns` 与 `server-spring/.../TableMeta.java`，并重编译重启 Spring |

---

*手册更新：2026-08-07（同步 db/seed_data.sql 种子数据机制与清单分类/所属团队/重点客户字段）*
