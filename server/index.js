// ==========================================
// 应用入口：Express 装配 / 中间件 / 路由挂载
// 核心基建见 core.js；业务路由见 routes/
// ==========================================
import express from 'express';
import cors from 'cors';

import { pool } from './core.js';
import authRoutes from './routes/authRoutes.js';
import ollamaRoutes from './routes/ollamaRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import crudRoutes from './routes/crudRoutes.js';

const app = express();

// CORS：仅允许配置的前端来源（vite 代理场景为同源，此配置兜底直连场景）
const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:4173')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: CORS_ORIGINS }));

// body 大小：全局 2mb；拜访保存（含录音 Base64）走专用大限制解析
app.use((req, res, next) => {
  const limit = req.method === 'PUT' && req.path === '/api/visits' ? '50mb' : '2mb';
  express.json({ limit })(req, res, next);
});

// ==========================================
// 健康检查（无需鉴权）
// ==========================================
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, database: 'visitpro (MySQL)' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// 业务路由：具体路径路由在前，通用 CRUD（/api/:table 通配）必须最后挂载
app.use(authRoutes);
app.use(ollamaRoutes);
app.use(aiRoutes);
app.use(crudRoutes);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => {
  console.log(`✅ VisitPro API server running at http://localhost:${PORT}`);
  console.log(`   Database: ${process.env.DB_NAME || 'visitpro'} @ ${process.env.DB_HOST || '127.0.0.1'}:${process.env.DB_PORT || 3306} (user: ${process.env.DB_USER || 'visitpro'})`);
});
