import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Sparkles, Send, Loader2, AlertCircle, BarChart3, Table2, ChevronDown } from 'lucide-react';
import { aiQueryStream, getAiConfig, AiChart, AiTable, AiPlan } from '../services/apiService';

// ==========================================
// 智能问数：自然语言提问 → 后端解析为白名单查询计划 → 图表/表格 + 流式结论
// 交互与事件协议参照 free-report 的 AiQuery 页面（SSE：status/plan/chart/table/answer_delta/scope_note）
// ==========================================

/** 图表配色：低饱和色板，多系列可辨识且不刺眼 */
const SERIES_COLORS = ['#3B6E8F', '#7A9E7E', '#C08A5A', '#8E7CA8', '#B4676A', '#5E8C8A'];

const SUGGESTED_QUESTIONS = [
  '各行业的客户数量分布',
  '各地区的客户占比情况',
  '目前一共有多少客户',
  '各客户状态的分布如何',
];

interface AiMessage {
  role: 'user' | 'assistant';
  content?: string;        // 用户问题或纯文本回答
  status?: string;         // 进行中的状态提示
  plan?: AiPlan;
  chart?: AiChart;
  table?: AiTable;
  answer?: string;         // 流式累积的结论
  scopeNote?: string;
  error?: boolean;
  done?: boolean;
}

/** 图表区：按后端给定的 chart_type 渲染柱状/折线/饼图 */
const ChartBlock = React.memo(({ chart }: { chart: AiChart }) => {
  const data = useMemo(
    () => chart.categories.map((cat, i) => ({
      category: cat || '未填写',
      ...Object.fromEntries(chart.series.map(s => [s.name, s.data[i] ?? 0])),
    })),
    [chart]
  );
  const seriesNames = chart.series.map(s => s.name);
  const axisStyle = { fontSize: 11, fill: 'var(--gray-500)' } as const;

  if (chart.type === 'pie') {
    const key = seriesNames[0];
    const pieData = data
      .map(d => ({ name: String(d.category), value: Number(d[key] || 0) }))
      .filter(d => d.value > 0);
    if (pieData.length === 0) return <div className="text-xs text-[var(--gray-400)]">当前数据为空，暂无可展示的占比图。</div>;
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label={(e: any) => e.name}>
            {pieData.map((_, idx) => <Cell key={idx} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--gray-200)" vertical={false} />
          <XAxis dataKey="category" tick={axisStyle} />
          <YAxis tick={axisStyle} width={56} allowDecimals={false} />
          <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {seriesNames.map((name, idx) => (
            <Line key={name} type="monotone" dataKey={name} stroke={SERIES_COLORS[idx % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--gray-200)" vertical={false} />
        <XAxis dataKey="category" tick={axisStyle} interval={0}
          angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'}
          height={data.length > 6 ? 64 : 30} />
        <YAxis tick={axisStyle} width={56} allowDecimals={false} />
        <Tooltip formatter={(v: any) => Number(v).toLocaleString()} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {seriesNames.map((name, idx) => (
          <Bar key={name} dataKey={name} fill={SERIES_COLORS[idx % SERIES_COLORS.length]} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
});

/** 数据表格：默认折叠，供用户核对统计口径 */
const TableBlock = React.memo(({ table }: { table: AiTable }) => {
  const [open, setOpen] = useState(false);
  if (!table.rows || table.rows.length === 0) return null;
  return (
    <div className="rounded-lg border border-[var(--gray-200)] overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-semibold text-[var(--gray-600)] hover:bg-[var(--gray-50)] transition-colors">
        <span className="flex items-center gap-1.5">
          <Table2 className="w-3.5 h-3.5 text-[var(--gray-400)]" />
          数据明细（{table.rows.length} 行）
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--gray-400)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="overflow-x-auto bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[var(--gray-50)] text-[var(--gray-500)] text-[11px] font-semibold">
                {table.columns.map((c, i) => <th key={i} className="p-2.5 text-left whitespace-nowrap">{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-t border-[var(--gray-100)]">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className={`p-2.5 whitespace-nowrap ${cIdx === 0 ? 'font-semibold' : 'text-[var(--gray-600)] tabular-nums'}`}>
                      {cell === '' ? '未填写' : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

/** 计划摘要：展示本次问数解析出的查询口径 */
const PlanChip: React.FC<{ plan: AiPlan }> = ({ plan }) => {
  const DIMENSION_LABELS: Record<string, string> = {
    industry: '按行业', region: '按地区', status: '按状态', clientType: '按客户类型',
    owner: '按负责人', type: '按拜访类型', sentiment: '按拜访氛围', month: '按月份', none: '仅统计总数',
  };
  const parts = [
    plan.dataset_label,
    DIMENSION_LABELS[plan.dimension] || plan.dimension,
    plan.recent_months ? `最近 ${plan.recent_months} 个月` : null,
    plan.owner_names.length > 0 ? `负责人：${plan.owner_names.join('、')}` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--gray-500)]">
      <BarChart3 className="w-3.5 h-3.5" />
      {parts.map((p, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full bg-[var(--gray-100)] border border-[var(--gray-200)]">{p}</span>
      ))}
    </div>
  );
};

export const AiQueryAssistant: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null); // null=检测中
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAiConfig().then(cfg => setEnabled(cfg.enabled));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const updateLastAssistant = (patch: Partial<AiMessage> | ((m: AiMessage) => Partial<AiMessage>)) => {
    setMessages(prev => {
      const idx = prev.length - 1;
      if (idx < 0 || prev[idx].role !== 'assistant') return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...(typeof patch === 'function' ? patch(next[idx]) : patch) };
      return next;
    });
  };

  const handleAsk = async (rawQuestion: string) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;
    if (question.length > 500) {
      alert('问题过长，请控制在 500 字以内');
      return;
    }

    // 构造最近对话历史（仅用户问题 + 助手结论摘要，供多轮理解）
    const history = messages
      .filter(m => m.role === 'user' ? m.content : m.answer || m.content)
      .slice(-6)
      .map(m => ({ role: m.role, content: (m.role === 'user' ? m.content : (m.answer || m.content)) as string }));

    setMessages(prev => [...prev, { role: 'user', content: question }, { role: 'assistant', status: '正在连接服务...' }]);
    setInput('');
    setLoading(true);

    try {
      await aiQueryStream(question, history, (type, data) => {
        switch (type) {
          case 'status':
            updateLastAssistant({ status: data });
            break;
          case 'text_only': {
            try {
              const parsed = JSON.parse(data);
              updateLastAssistant({ content: parsed.answer, scopeNote: parsed.scope_note || undefined, status: undefined, done: true });
            } catch { updateLastAssistant({ content: data, status: undefined, done: true }); }
            break;
          }
          case 'plan':
            try { updateLastAssistant({ plan: JSON.parse(data), status: undefined }); } catch { /* ignore */ }
            break;
          case 'chart':
            try { updateLastAssistant({ chart: JSON.parse(data) }); } catch { /* ignore */ }
            break;
          case 'table':
            try { updateLastAssistant({ table: JSON.parse(data) }); } catch { /* ignore */ }
            break;
          case 'answer_delta':
            updateLastAssistant(m => ({ answer: (m.answer || '') + data, status: undefined }));
            break;
          case 'scope_note':
            updateLastAssistant({ scopeNote: data });
            break;
          case 'done':
            updateLastAssistant({ done: true, status: undefined });
            break;
          case 'error':
            try { updateLastAssistant({ content: JSON.parse(data).error, error: true, status: undefined, done: true }); }
            catch { updateLastAssistant({ content: data, error: true, status: undefined, done: true }); }
            break;
        }
      });
    } catch (e: any) {
      updateLastAssistant({ content: e.message || '问数请求失败，请稍后重试', error: true, status: undefined, done: true });
    } finally {
      setLoading(false);
    }
  };

  if (enabled === false) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center">
        <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-10">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold mb-2">智能问数未启用</h3>
          <p className="text-sm text-[var(--gray-500)]">
            请在 server/.env 中配置 AI_BASE_URL / AI_API_KEY / AI_MODEL（OpenAI 兼容接口，如 DeepSeek、Kimi 或本地 Ollama），然后重启后端服务。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
        {messages.length === 0 && (
          <div className="text-center pt-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--primary-bg)' }}>
              <Sparkles className="w-7 h-7" style={{ color: 'var(--primary)' }} />
            </div>
            <h2 className="text-lg font-bold mb-1">智能问数</h2>
            <p className="text-sm text-[var(--gray-500)] mb-6">
              用自然语言提问，AI 将在您可见的数据范围内统计客户与拜访情况
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} onClick={() => handleAsk(q)}
                  className="px-3.5 py-2 text-xs rounded-full border border-[var(--gray-200)] bg-white hover:border-[var(--gray-300)] hover:bg-[var(--gray-50)] transition-colors text-[var(--gray-600)]">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => {
          if (msg.role === 'user') {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[75%] px-4 py-2.5 rounded-2xl rounded-br-md text-sm text-white"
                  style={{ backgroundColor: 'var(--primary)' }}>
                  {msg.content}
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className="flex justify-start">
              <div className="max-w-[85%] w-full bg-white rounded-2xl rounded-bl-md border border-[var(--gray-200)] p-4 space-y-3">
                {msg.status && (
                  <div className="flex items-center gap-2 text-xs text-[var(--gray-500)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--primary)' }} />
                    {msg.status}
                  </div>
                )}
                {msg.error && <AlertCircle className="w-4 h-4 text-red-500" />}
                {msg.plan && <PlanChip plan={msg.plan} />}
                {(msg.chart || msg.table) && msg.chart && (
                  <div>
                    <p className="text-sm font-semibold mb-2">{msg.chart.title}</p>
                    <ChartBlock chart={msg.chart} />
                  </div>
                )}
                {msg.table && <TableBlock table={msg.table} />}
                {(msg.answer || msg.content) && (
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.answer || msg.content}
                    {!msg.done && <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse" style={{ backgroundColor: 'var(--primary)' }} />}
                  </div>
                )}
                {msg.scopeNote && (
                  <p className="text-[11px] text-[var(--gray-400)] border-t border-[var(--gray-100)] pt-2">{msg.scopeNote}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 输入区 */}
      <div className="p-4 border-t border-[var(--gray-200)] bg-white">
        <form
          onSubmit={e => { e.preventDefault(); handleAsk(input); }}
          className="flex items-center gap-2 max-w-3xl mx-auto"
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading || enabled === null}
            placeholder={enabled === null ? '正在检测 AI 服务...' : '例如：各地区的客户占比情况'}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--gray-200)] focus:outline-none focus:border-[var(--primary)] text-sm disabled:bg-[var(--gray-50)]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || enabled === null}
            className="px-4 py-2.5 rounded-xl text-white disabled:opacity-50 transition-opacity flex items-center gap-1.5 text-sm font-medium"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            提问
          </button>
        </form>
        <p className="text-[11px] text-[var(--gray-400)] text-center mt-2">
          统计范围受数据权限约束；AI 只负责理解问题与总结，查询由系统白名单执行
        </p>
      </div>
    </div>
  );
};
