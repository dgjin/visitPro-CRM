// ==========================================
// 智能问数模块（架构参照 free-report 项目）：
// 自然语言 → LLM 解析为白名单查询计划 → 参数化 SQL 取数（含数据权限）→ 表格/图表构建 → LLM 流式总结。
// 大模型只负责「理解问题」与「总结数据」，绝不生成 SQL；取数一律走白名单 + 参数化查询。
// ==========================================

// ---- AI 客户端配置（OpenAI 兼容接口：DeepSeek / Ollama / 自建网关均可） ----
// 注意：ESM import 提升使本模块先于宿主 dotenv.config() 执行，配置必须惰性读取
const getAiConfig = () => ({
  baseUrl: (process.env.AI_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
  apiKey: process.env.AI_API_KEY || '',
  model: process.env.AI_MODEL || 'deepseek-chat',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 60000),
});

/** 智能问数是否可用（未配置 Key 时前端隐藏入口） */
export const isAiAvailable = () => {
  const { apiKey, baseUrl } = getAiConfig();
  return !!(apiKey && baseUrl);
};

/**
 * 发起一次对话补全调用，返回模型文本。
 * @param {Array<{role:string, content:string}>} messages
 * @param {boolean} jsonMode 是否要求输出 JSON 对象
 */
export async function aiChat(messages, jsonMode = false) {
  const { baseUrl, apiKey, model, timeoutMs } = getAiConfig();
  if (!apiKey || !baseUrl) throw new Error('智能问数未配置，请在 server/.env 中配置 AI_API_KEY');
  const body = {
    model,
    messages,
    temperature: jsonMode ? 0 : 0.3,
    stream: false,
    max_tokens: 2048,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) {
    const text = (await r.text().catch(() => '')).slice(0, 300);
    throw new Error(`AI 服务调用失败 (${r.status}): ${text}`);
  }
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? '';
}

/**
 * 流式对话补全：逐片段回调 onChunk，返回拼接后的完整文本。
 */
export async function aiChatStream(messages, onChunk) {
  const { baseUrl, apiKey, model, timeoutMs } = getAiConfig();
  if (!apiKey || !baseUrl) throw new Error('智能问数未配置，请在 server/.env 中配置 AI_API_KEY');
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.3, stream: true, max_tokens: 1024 }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok || !r.body) {
    const text = (await r.text().catch(() => '')).slice(0, 300);
    throw new Error(`AI 服务调用失败 (${r.status}): ${text}`);
  }
  let full = '';
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
        if (delta) { full += delta; onChunk(delta); }
      } catch { /* 忽略不完整的 SSE 分片 */ }
    }
  }
  return full;
}

// ---- 数据集白名单：可问数维度 / 时间列 / 标签 ----
// 维度值全部是固定列或固定表达式，LLM 只能从中选择，无法注入任意 SQL
export const DATASETS = {
  clients: {
    label: '客户',
    table: 'clients',
    // created_at 为 DATETIME，按日期比较
    timeCutoffExpr: 'DATE(`created_at`)',
    dimensions: {
      industry:   { label: '行业',     expr: '`industry`' },
      region:     { label: '地区',     expr: '`region`' },
      status:     { label: '客户状态', expr: '`status`' },
      clientType: { label: '客户类型', expr: '`clientType`' },
      owner:      { label: '负责人',   expr: '`ownerName`' },
    },
  },
  visits: {
    label: '拜访',
    table: 'visits',
    // date 为 varchar（ISO 字符串），取前 10 位按 'YYYY-MM-DD' 做字典序比较
    timeCutoffExpr: 'LEFT(`date`, 10)',
    dimensions: {
      type:      { label: '拜访类型', expr: '`type`' },
      sentiment: { label: '拜访氛围', expr: '`sentiment`' },
      owner:     { label: '负责人',   expr: '`ownerName`' },
      month:     { label: '月份',     expr: "LEFT(`date`, 7)" },
    },
  },
};
// 「总计」维度：不按任何字段分组
const NONE_DIMENSION = 'none';

// ---- 输入净化：防 prompt injection（对齐 free-report AiQueryService） ----
const MAX_QUESTION_LENGTH = 500;
const MAX_HISTORY_CONTENT_LENGTH = 300;
const PROTOCOL_INJECTION = /system\s*:|<\|[^|]*\|>|\[INST\]|<<SYS>>|\[\/INST\]|<<\/SYS>>/gi;

export function sanitizeQuestion(question) {
  if (!question || typeof question !== 'string') return null;
  let cleaned = question.trim();
  if (!cleaned) return null;
  if (cleaned.length > MAX_QUESTION_LENGTH) cleaned = cleaned.slice(0, MAX_QUESTION_LENGTH);
  const meaningfulLen = cleaned.length;
  cleaned = cleaned.replace(PROTOCOL_INJECTION, '[已过滤]');
  // 过滤后剩余有效内容不足原文 30%：视为纯注入攻击，整体拒绝
  if (!cleaned || cleaned.replace(/\[已过滤\]/g, '').length < meaningfulLen * 0.3) return null;
  return cleaned;
}

/** 历史消息仅保留 user 消息，避免上一轮实际数据泄露给 LLM */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(h => h && h.role === 'user' && typeof h.content === 'string' && h.content.trim())
    .map(h => ({
      role: 'user',
      content: h.content.slice(0, MAX_HISTORY_CONTENT_LENGTH).replace(PROTOCOL_INJECTION, '[已过滤]'),
    }));
}

// ---- 计划解析：构建 prompt + 白名单校验（对齐 free-report AiPlanResolver） ----

function buildCatalog() {
  let catalog = '';
  for (const [key, ds] of Object.entries(DATASETS)) {
    catalog += `- 数据集=${key}（${ds.label}）可用分组维度: `
      + Object.entries(ds.dimensions).map(([k, d]) => `${k}(${d.label})`).join('、')
      + `；另有 ${NONE_DIMENSION}(仅统计总数)\n`;
  }
  return catalog;
}

export function buildPlanMessages(question, history) {
  const systemPrompt = `你是 CRM 系统的数据查询助手。用户用自然语言提问，你需要把问题解析成 JSON 查询计划。

当前可查询的数据集：
${buildCatalog()}
说明：clients 是客户档案（含行业/地区/状态/类型/负责人），visits 是拜访记录（含拜访类型/氛围/负责人/拜访日期）。
统计口径固定为「记录条数」。

请只输出一个 JSON 对象，字段如下：
- dataset: "clients" 或 "visits"，必须来自上面清单
- dimension: 分组维度，必须来自该数据集的「可用分组维度」；问趋势/按月统计选 month（仅 visits）；只问总数选 none
- recent_months: 整数或 null；用户说「最近三个月/近半年/今年」时换算为月数（最多 36），未限定时间填 null 表示全部
- owner_names: 字符串数组；用户点名了具体负责人时填写，否则留空数组表示全部
- chart_type: "bar" | "line" | "pie" | "table"；趋势用 line，分类对比用 bar，占比用 pie，仅总数用 table
- title: 简短中文图表标题
- unanswerable_reason: 若问题与客户/拜访数据无关，填写一句中文说明；否则为 null

注意：不要编造清单外的数据集或维度；不要输出 JSON 以外的任何文字。`;

  const messages = [{ role: 'system', content: systemPrompt }];
  const recent = (history || []).slice(-6);
  for (const h of recent) messages.push({ role: h.role, content: h.content });
  messages.push({ role: 'user', content: question });
  return messages;
}

/** 宽松解析模型输出的 JSON（可能包裹说明文字或代码块） */
function parseJsonLoose(raw) {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { /* 继续尝试截取 */ }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(raw.slice(start, end + 1)); } catch { /* fall through */ }
  }
  return null;
}

/**
 * 解析并白名单校验查询计划。
 * @returns {{plan?: object, textAnswer?: string}} plan 或直答文本
 */
export function resolvePlan(planJson) {
  const scopeHint = `当前可问数的数据集有：客户（行业/地区/状态/类型/负责人）、拜访（类型/氛围/负责人/月份）。`;
  const plan = parseJsonLoose(planJson);
  if (!plan) return { textAnswer: `没能理解这个问题，请换一种说法，例如「各行业客户数量分布」。${scopeHint}` };

  const unanswerable = plan.unanswerable_reason;
  if (typeof unanswerable === 'string' && unanswerable.trim() && unanswerable.trim() !== 'null') {
    return { textAnswer: `${unanswerable.trim()}${scopeHint}` };
  }

  const ds = DATASETS[plan.dataset];
  if (!ds) return { textAnswer: `没能定位到您要查询的数据集。${scopeHint}` };

  // 维度白名单校验；非法维度回退为「总数」
  let dimension = plan.dimension;
  if (dimension !== NONE_DIMENSION && !(dimension && ds.dimensions[dimension])) {
    dimension = NONE_DIMENSION;
  }

  // 时间范围：仅接受 1~36 的整数月
  let recentMonths = Number(plan.recent_months);
  if (!Number.isInteger(recentMonths) || recentMonths <= 0) recentMonths = null;
  else recentMonths = Math.min(recentMonths, 36);
  // month 趋势维度默认给足 12 个月窗口，避免只看 1 个月画不出趋势
  if (dimension === 'month' && recentMonths === null) recentMonths = 12;

  const ownerNames = Array.isArray(plan.owner_names)
    ? [...new Set(plan.owner_names.filter(n => typeof n === 'string' && n.trim()))].slice(0, 5)
    : [];

  const chartType = ['line', 'pie', 'table'].includes(plan.chart_type) ? plan.chart_type : 'bar';
  const title = (typeof plan.title === 'string' && plan.title.trim()) ? plan.title.trim().slice(0, 60) : `${ds.label}统计`;

  return { plan: { dataset: plan.dataset, dimension, recentMonths, ownerNames, chartType, title } };
}

// ---- 取数：白名单列 + 参数化 SQL + 数据权限（visibleIds） ----

/**
 * @param {object} plan 已校验的查询计划
 * @param {string[]|null} visibleIds null=不限制（管理员）
 * @returns {Promise<{columns: string[], rows: Array<Array<string|number>>, dimensionLabel: string}>}
 */
export async function fetchData(plan, visibleIds, pool) {
  const ds = DATASETS[plan.dataset];
  // 负责人筛选单独记录：模型给出的名字可能与真实姓名不完全一致，
  // 加了筛选后结果为空时忽略该筛选再查一次，而不是直接返回空
  const buildWhere = (withOwners) => {
    const where = [];
    const params = [];
    if (visibleIds) {
      if (visibleIds.length === 0) return null; // 哨兵：无任何可见数据
      where.push(`\`ownerId\` IN (${visibleIds.map(() => '?').join(',')})`);
      params.push(...visibleIds);
    }
    if (plan.recentMonths) {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - plan.recentMonths);
      where.push(`${ds.timeCutoffExpr} >= ?`);
      params.push(cutoff.toISOString().slice(0, 10));
    }
    if (withOwners && plan.ownerNames.length > 0) {
      where.push(plan.ownerNames.map(() => '`ownerName` LIKE ?').join(' OR '));
      params.push(...plan.ownerNames.map(n => `%${n}%`));
    }
    return { whereSql: where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '', params };
  };

  const runQuery = async (withOwners) => {
    const built = buildWhere(withOwners);
    if (!built) return { columns: [], rows: [], dimensionLabel: '' };
    const { whereSql, params } = built;
    if (plan.dimension === NONE_DIMENSION) {
      const [rows] = await pool.query(`SELECT COUNT(*) AS cnt FROM \`${ds.table}\`${whereSql}`, params);
      return { columns: ['指标', '数量'], rows: [[`${ds.label}总数`, Number(rows[0].cnt)]], dimensionLabel: '' };
    }
    const dim = ds.dimensions[plan.dimension];
    const sql = `SELECT COALESCE(NULLIF(TRIM(${dim.expr}), ''), '未填写') AS dim, COUNT(*) AS cnt
                 FROM \`${ds.table}\`${whereSql}
                 GROUP BY dim ORDER BY cnt DESC, dim ASC LIMIT 50`;
    const [rows] = await pool.query(sql, params);
    return {
      columns: [dim.label, '数量'],
      rows: rows.map(r => [r.dim, Number(r.cnt)]),
      dimensionLabel: dim.label,
    };
  };

  let result = await runQuery(plan.ownerNames.length > 0);
  if (plan.ownerNames.length > 0 && result.rows.length === 0) {
    const retry = await runQuery(false);
    if (retry.rows.length > 0) {
      result = retry; // 负责人名全对不上时忽略筛选
      plan.ownerNames = [];
    }
  }
  return result;
}

// ---- 结果构建：图表数据 + 总结 prompt ----

export function buildChart(data, plan) {
  if (plan.dimension === NONE_DIMENSION || data.rows.length === 0) return null;
  return {
    type: plan.chartType,
    title: plan.title,
    categories: data.rows.map(r => r[0]),
    series: [{ name: '数量', data: data.rows.map(r => r[1]) }],
  };
}

export function buildScopeNote(plan, dsLabel, dimensionLabel, ownerNames) {
  let note = `数据集：${dsLabel}`;
  note += dimensionLabel ? ` ｜ 分组：${dimensionLabel}` : ' ｜ 统计：总数';
  if (plan.recentMonths) note += ` ｜ 时间：最近 ${plan.recentMonths} 个月`;
  if (ownerNames.length > 0) note += ` ｜ 负责人：${ownerNames.join('、')}`;
  note += ' ｜ 仅统计您当前权限范围内的数据';
  return note;
}

export function buildSummaryMessages(question, plan, data, scopeNote) {
  const tableText = data.rows.map(r => r.join('：')).join('\n');
  return [
    {
      role: 'system',
      content: `你是 CRM 数据分析助手。请基于下面的查询结果，用简洁的中文回答用户问题：先给结论，再点出 1-3 个关键特征（最高/最低/集中度等）。不要编造数据以外的信息，不超过 150 字，不要输出 Markdown 标题。`,
    },
    {
      role: 'user',
      content: `用户问题：${question}\n\n统计口径：${scopeNote}\n\n查询结果（${data.columns.join('，')}）：\n${tableText || '（无数据）'}`,
    },
  ];
}
