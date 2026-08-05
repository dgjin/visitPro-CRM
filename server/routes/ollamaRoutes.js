// ==========================================
// Ollama 本地模型代理路由（规避浏览器 CORS）
// OLLAMA_BASE 可在 server/.env 中配置
// ==========================================
import { Router } from 'express';
import { requireAuth } from '../core.js';

const router = Router();
const OLLAMA_BASE = process.env.OLLAMA_BASE || 'http://127.0.0.1:11434';

// 获取本地已安装模型列表
router.get('/api/ollama/models', requireAuth, async (req, res) => {
  try {
    const r = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`Ollama responded ${r.status}`);
    const data = await r.json();
    res.json({ success: true, models: (data.models || []).map(m => m.name) });
  } catch (e) {
    res.status(503).json({ success: false, message: `无法连接 Ollama (${OLLAMA_BASE})，请确认 ollama serve 已启动: ${e.message}` });
  }
});

// 对话补全（OpenAI 兼容接口转发）
router.post('/api/ollama/chat', requireAuth, async (req, res) => {
  const { model, messages, jsonMode } = req.body || {};
  if (!model || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'model and messages are required' });
  }
  try {
    const r = await fetch(`${OLLAMA_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: `Ollama Error ${r.status}: ${text.slice(0, 300)}` });
    }
    const data = await r.json();
    res.json({ content: data.choices?.[0]?.message?.content ?? '' });
  } catch (e) {
    res.status(503).json({ error: `无法连接 Ollama (${OLLAMA_BASE})，请确认 ollama serve 已启动: ${e.message}` });
  }
});

export default router;
