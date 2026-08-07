# VisitPro API — Spring Boot 版

Express + mysql2 后端的 Spring Boot 等价实现，API 契约完全一致，前端无需任何改动（vite 代理 `/api` → `localhost:3006`）。

## 技术栈

- Spring Boot 3.3.5 / Java 17 / Maven
- spring-boot-starter-web、spring-boot-starter-jdbc（JdbcTemplate + 动态 SQL，非 JPA）
- mysql-connector-j、spring-security-crypto（BCrypt）、jjwt 0.12.6（HS256，与 Node jsonwebtoken 令牌互操作）

## 运行

```sh
./start.sh                 # 自动加载 ../server/.env（与 Node 版共用同一份配置）
# 或手动：
set -a && source ../server/.env && set +a
mvn spring-boot:run
```

端口默认 3006（`PORT` 环境变量可改）。启动前请先停掉 Node 版后端（同端口）。

## 测试

```sh
mvn test    # 智能问数契约测试（18 项，移植自 server/test/aiQuery.test.js）
```

## 代码结构

```
src/main/java/com/visitpro/
├── VisitProApplication.java      # 入口（@EnableScheduling：限流记录定期清理）
├── config/
│   ├── VisitProProperties.java   # visitpro.* 配置绑定（jwt/cors/login/ollama/ai）
│   └── AppConfig.java            # BCrypt、Ollama RestClient（3s 超时）、CORS
├── security/
│   ├── AuthUser.java             # 鉴权上下文（uid/role/deptId，均 varchar）
│   ├── AuthFilter.java           # 白名单放行 + 逐请求复核账号状态（停用/删除即失效）
│   ├── JwtService.java           # HS256 签发/校验，沿用同一 JWT_SECRET 保持会话连续
│   └── PasswordService.java      # bcrypt + 旧 SHA-256 哈希兼容（登录时透明升级）
├── service/
│   ├── TableMeta.java            # 表元数据：列白名单/JSON 列/日期列，prepareRow/mapRow
│   ├── DataScopeService.java     # 数据权限：本人 + 部门子树（管理员不限）
│   └── LoginRateLimiter.java     # 登录限流：同账号+IP 失败 5 次锁 15 分钟
├── web/
│   ├── HealthController.java     # GET /api/health（免鉴权）
│   ├── AuthController.java       # 登录/me/改密/重置密码/登录历史
│   ├── CrudController.java       # GET/PUT/DELETE /api/{table} + 拜访详情
│   ├── OllamaController.java     # Ollama 本地模型代理（规避浏览器 CORS）
│   └── AiController.java         # 智能问数：GET /api/ai/config、POST /api/ai/query/stream（SSE）
└── ai/
    ├── AiClient.java             # OpenAI 兼容接口客户端（普通 + SSE 流式）
    └── AiQueryService.java       # 白名单计划解析 + 参数化取数 + 图表/总结构建
```

## 与 Node 版的等价性要点

| 能力 | 实现方式 |
| --- | --- |
| JWT 互操作 | 同一 `JWT_SECRET`，载荷 `{uid, role, deptId}`；Node 签发的旧 token 直接可用 |
| 密码 | bcryptjs(10 轮) ↔ BCryptPasswordEncoder(10)；旧 SHA-256 登录成功后自动升级 |
| 表映射 | TABLES 白名单逐列对齐；JSON 列空值归一化、日期列 UTC→ISO |
| 数据权限 | clients/visits 按 `ownerId IN (本人+部门子树)` 过滤 |
| 登录限流 | 内存计数，重启清零；行为与 Node 版一致 |
| AI 问数 | LLM 只做计划解析与总结，取数全部白名单 + 参数化 SQL；SSE 事件格式一致 |
| body 限制 | Tomcat 对 JSON 请求体无默认上限，天然满足拜访保存 50MB |

## 回滚

Node 版后端保留在 `server/` 目录，停掉 Spring Boot 后 `cd server && npm start` 即可回滚。
