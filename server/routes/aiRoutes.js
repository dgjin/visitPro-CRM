// ==========================================
// 智能问数路由（架构参照 free-report：LLM 只理解问题/总结数据，绝不生成 SQL）
// 流程：输入净化 → LLM 计划解析 → 白名单校验 → 参数化取数（含数据权限）→ 图表/表格 → LLM 流式总结
// ==========================================
import { Router } from 'express';
import { pool, requireAuth, getVisibleUserIds } from '../core.js';
import {
  isAiAvailable, aiChat, aiChatStream,
  sanitizeQuestion, sanitizeHistory,
  buildPlanMessages, resolvePlan,
  fetchData, buildChart, buildScopeNote, buildSummaryMessages,
  DATASETS,
} from '../aiQuery.js';

const router = Router();

// 单用户并发闸门：LLM 调用慢且贵，防止重复点击打爆服务
const aiBusyUsers = new Set();

// 审计日志：问数请求全程留痕（失败也记录）
const auditAiQuery = (userId, question, status, detail) => {
  pool.query(
    'INSERT INTO ai_query_history (user_id, question, status, detail) VALUES (?, ?, ?, ?)',
    [userId, question, status, detail ? String(detail).slice(0, 2000) : null]
  ).catch(() => {});
};

// 问数编排：输入净化 → 计划解析 → 取数 → 结果构建；通过 onEvent 推送 SSE 事件
const runAiQuery = async (question, history, req, onEvent) => {
  const safeQuestion = sanitizeQuestion(question);
  if (!safeQuestion) {
    onEvent('text_only', { answer: '您的问题包含不支持的指令，请重新描述您的数据需求。', scope_note: null });
    return;
  }

  onEvent('status', '正在理解您的问题...');
  const visibleIds = await getVisibleUserIds(req.user);

  // LLM Call #1: 生成查询计划（json 模式）
  let planJson;
  try {
    planJson = await aiChat(buildPlanMessages(safeQuestion, sanitizeHistory(history)), true);
  } catch (e) {
    onEvent('text_only', { answer: `AI 服务暂时不可用：${e.message}`, scope_note: null });
    return;
  }
  const resolved = resolvePlan(planJson);
  if (resolved.textAnswer) {
    onEvent('text_only', { answer: resolved.textAnswer, scope_note: null });
    return;
  }
  const plan = resolved.plan;

  onEvent('status', '正在查询数据...');
  const data = await fetchData(plan, visibleIds, pool);
  const ds = DATASETS[plan.dataset];
  const chart = buildChart(data, plan);
  const scopeNote = buildScopeNote(plan, ds.label, data.dimensionLabel, plan.ownerNames);

  onEvent('plan', {
    dataset: plan.dataset, dataset_label: ds.label, dimension: plan.dimension,
    recent_months: plan.recentMonths, owner_names: plan.ownerNames,
    chart_type: plan.chartType, title: plan.title,
  });
  if (chart) onEvent('chart', chart);
  onEvent('table', { columns: data.columns, rows: data.rows });

  onEvent('status', '正在生成结论...');
  // LLM Call #2: 基于查询结果流式总结
  let answer;
  try {
    answer = await aiChatStream(buildSummaryMessages(safeQuestion, plan, data, scopeNote),
      chunk => onEvent('answer_delta', chunk));
  } catch (e) {
    // 总结失败不阻塞：回退为直接展示数据行数
    answer = `查询完成，共 ${data.rows.length} 组数据。（AI 总结失败：${e.message}）`;
    onEvent('answer_delta', answer);
  }

  onEvent('scope_note', scopeNote);
  return { answer, scopeNote, plan };
};

// 智能问数可用性（前端据此提示/隐藏入口）
router.get('/api/ai/config', requireAuth, async (req, res) => {
  res.json({ enabled: isAiAvailable() });
});

// SSE 流式问数：事件类型 status | text_only | plan | chart | table | answer_delta | scope_note | done | error
router.post('/api/ai/query/stream', requireAuth, async (req, res) => {
  const { question, history } = req.body || {};
  if (aiBusyUsers.has(req.user.uid)) {
    return res.status(429).json({ error: '您有一个问数请求正在处理中，请稍候' });
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (type, data) => {
    if (res.writableEnded) return;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`event: ${type}\ndata: ${payload}\n\n`);
  };
  aiBusyUsers.add(req.user.uid);
  try {
    const result = await runAiQuery(question, history, req, send);
    auditAiQuery(req.user.uid, typeof question === 'string' ? question.slice(0, 500) : '',
      'success', result ? JSON.stringify({ dataset: result.plan.dataset, dimension: result.plan.dimension }) : 'text_only');
    send('done', '');
  } catch (e) {
    console.error('AI query error:', e);
    auditAiQuery(req.user.uid, typeof question === 'string' ? question.slice(0, 500) : '', 'error', e.message);
    send('error', { error: '问数服务异常，请稍后重试' });
  } finally {
    aiBusyUsers.delete(req.user.uid);
    res.end();
  }
});

export default router;
