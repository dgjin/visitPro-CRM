import React, { useEffect, useMemo, useState } from 'react';
import { ViewState } from '../types';
import {
  X,
  Search as SearchIcon,
  LayoutDashboard,
  Users,
  Briefcase,
  Sparkles,
  Settings,
  Keyboard,
  ChevronDown,
  MessageCircleQuestion,
  BookOpen,
  Rocket,
  Paperclip,
  Mic,
} from 'lucide-react';

interface HelpCenterProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: ViewState;
}

interface GuideItem {
  title: string;
  content: string;
}

interface Guide {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: GuideItem[];
}

const QUICK_START: GuideItem[] = [
  { title: '第 1 步 · 录入客户', content: '在「客户管理」中点击"新增客户"，填写名称、行业、地区等基础资料，工商信息与自定义字段可在客户详情页补充。' },
  { title: '第 2 步 · 记录拜访', content: '在「拜访记录」中创建拜访，选择关联客户，用文字、语音转写或上传附件（txt / Word / WPS / PDF）自动填充拜访内容。' },
  { title: '第 3 步 · 制定跟进', content: '为拜访添加跟进事项（待办），系统会在仪表盘统计待办数量，方便您跟踪下一步行动。' },
  { title: '第 4 步 · 问数分析', content: '在「智能问数」中直接用自然语言提问，例如"本月上海新增了多少客户"，系统会给出图表和 AI 总结。' },
];

const GUIDES: Guide[] = [
  {
    id: 'DASHBOARD',
    title: '仪表盘',
    icon: LayoutDashboard,
    items: [
      { title: '统计卡片', content: '展示客户总数（含覆盖行业数）、拜访总数、待办事项、我负责的客户数量，点击卡片可快速跳转到对应模块。' },
      { title: '智能建议', content: '根据近期拜访与跟进情况自动生成行动建议，例如提醒回访长期未联系的客户。' },
      { title: '最近动态', content: '展示最近的拜访记录摘要，点击可查看详情。' },
    ],
  },
  {
    id: 'CLIENTS',
    title: '客户管理',
    icon: Users,
    items: [
      { title: '新增与编辑客户', content: '点击"新增客户"填写名称（必填）、类型、行业、地区、负责人等。保存后点击客户行可进入详情页修改。' },
      { title: '客户详情页', content: '包含基础资料、工商基础信息（统一社会信用代码、法人等）、协议与落地项目、联系人、拜访历史、沟通记录、资料文件等标签页。' },
      { title: '自定义信息', content: '在客户详情页"自定义信息"卡片中可自由添加键值对字段，满足不同业务的个性化记录需求。' },
      { title: '搜索与筛选', content: '列表上方支持按名称搜索、按行业 / 地区 / 类型 / 负责人筛选。' },
      { title: '导出 CSV', content: '点击工具栏"导出"按钮可将当前筛选结果导出为 CSV 文件，方便线下汇报。' },
      { title: '数据权限', content: '普通用户仅能查看和操作分配给自己的客户；管理员可查看全部客户并调整负责人。' },
    ],
  },
  {
    id: 'VISITS',
    title: '拜访记录',
    icon: Briefcase,
    items: [
      { title: '创建拜访', content: '选择客户、拜访方式与日期后编辑拜访内容。支持文字排版工具栏（加粗、列表、标题等）。' },
      { title: '语音转写', content: '点击工具栏麦克风按钮开启实时语音转写，说话内容会自动识别并插入到拜访内容中（建议使用普通话、安静环境）。' },
      { title: '上传录音', content: '点击"上传录音"可上传已有录音文件并自动转写为文字填入正文。' },
      { title: '上传附件', content: '点击"上传附件"支持 txt、Word（.doc/.docx）、WPS（.wps）、PDF 等格式（单文件不超过 20MB），系统自动识别文件内容并填入拜访正文，超长内容保留前 3 万字符。' },
      { title: '拜访模板', content: '点击"模板"可选择预设的拜访记录结构，快速生成规范的记录框架。' },
      { title: '跟进事项', content: '在拜访详情中添加待办事项（行动项），用于跟踪后续任务，仪表盘的"待办事项"卡片会自动统计。' },
    ],
  },
  {
    id: 'AI_QUERY',
    title: '智能问数',
    icon: Sparkles,
    items: [
      { title: '如何提问', content: '直接输入自然语言问题，例如："本月新增了多少客户"、"最近一个月拜访最多的客户"、"各地区客户数量对比"。' },
      { title: '结果呈现', content: '系统会先展示查询计划与数据口径，然后给出图表 / 表格结果，最后由 AI 生成流式文字总结。' },
      { title: '支持的数据范围', content: '支持客户（行业 / 地区 / 类型 / 负责人）与拜访（次数 / 方式 / 时间）两大数据集的统计与趋势分析。' },
      { title: '提问技巧', content: '问题中带上时间范围（本月 / 最近三个月）、维度（行业 / 地区）和指标（数量 / 次数），结果会更准确。' },
      { title: '客户清单模板', content: '输入区上方提供四个固定模板：三个类别模板（地方政府 / 金融机构 / 产业客户，仅含重点客户）与全量客户清单（不限类型与重点标记），点击即可生成详细信息清单，支持全屏查看与一键导出 Excel。' },
    ],
  },
  {
    id: 'ADMIN',
    title: '组织与系统管理（管理员）',
    icon: Settings,
    items: [
      { title: '用户管理', content: '创建 / 停用账号，分配角色与所属部门，重置密码（用户首次登录需修改初始密码）。' },
      { title: '部门管理', content: '维护组织架构树，用户归属部门后可按部门筛选数据。' },
      { title: '角色管理', content: '定义角色（如管理员、销售经理、销售代表）并为角色分配功能权限，控制菜单与数据可见范围。' },
      { title: '系统设置', content: '配置 AI 服务（问数、语音转写）相关的参数与开关。' },
    ],
  },
];

const FAQS = [
  { question: '忘记密码怎么办？', answer: '请联系系统管理员，由管理员在「用户管理」中为您重置密码，重置后首次登录会要求修改密码。' },
  { question: '如何切换界面主题？', answer: '按 ⌘K（Windows 为 Ctrl+K）打开命令面板，搜索"主题"选择喜欢的风格；或点击右上角头像 →「个人设置」→「个性化」。' },
  { question: '附件上传后内容识别不准确？', answer: '早期 WPS Writer / Word 97-2003 的 .wps / .doc 二进制格式采用启发式提取，可能存在少量噪声，建议先在办公软件中另存为 .docx 再上传。扫描件 PDF 无文本层，无法提取文字。' },
  { question: '语音转写不准确怎么办？', answer: '请尽量在安静环境使用普通话表述，麦克风距离适中；识别结果插入正文后可手动编辑修正。' },
  { question: '为什么看不到某些客户？', answer: '系统按负责人分配数据权限，普通用户仅可见分配给自己的客户。如需调整，请联系管理员修改客户负责人。' },
  { question: '如何快速跳转页面？', answer: '按 ⌘K（Windows 为 Ctrl+K）打开命令面板，输入页面名称、主题名称即可快速跳转或切换。' },
];

const SHORTCUTS = [
  { keys: '⌘K / Ctrl+K', desc: '打开命令面板，搜索页面与主题' },
  { keys: 'Esc', desc: '关闭当前弹窗或抽屉' },
];

const VIEW_GUIDE_MAP: Partial<Record<ViewState, string>> = {
  DASHBOARD: 'DASHBOARD',
  CLIENTS: 'CLIENTS',
  VISITS: 'VISITS',
  AI_QUERY: 'AI_QUERY',
  USERS: 'ADMIN',
  DEPARTMENTS: 'ADMIN',
  ROLES: 'ADMIN',
  ADMIN: 'ADMIN',
};

export const HelpCenter: React.FC<HelpCenterProps> = ({ isOpen, onClose, currentView }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGuides, setExpandedGuides] = useState<Set<string>>(new Set());

  // 打开时重置搜索并展开当前页面对应的指南
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      const guideId = VIEW_GUIDE_MAP[currentView];
      setExpandedGuides(new Set(guideId ? [guideId] : []));
    }
  }, [isOpen, currentView]);

  // Esc 关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleGuide = (id: string) => {
    setExpandedGuides(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const term = searchTerm.trim().toLowerCase();

  // 搜索结果：跨指南条目与常见问题做关键词匹配
  const searchResults = useMemo(() => {
    if (!term) return null;
    const guideHits = GUIDES.flatMap(g =>
      g.items
        .filter(it => (g.title + it.title + it.content).toLowerCase().includes(term))
        .map(it => ({ source: g.title, title: it.title, content: it.content }))
    );
    const faqHits = FAQS.filter(f => (f.question + f.answer).toLowerCase().includes(term))
      .map(f => ({ source: '常见问题', title: f.question, content: f.answer }));
    return [...guideHits, ...faqHits];
  }, [term]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-[var(--gray-900)]/40 backdrop-blur-sm" onClick={onClose} />

      {/* 抽屉 */}
      <div className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl border-l border-[var(--gray-200)] flex flex-col animate-slide-in-right">
        {/* 头部 */}
        <div className="px-5 py-4 border-b border-[var(--gray-100)] flex items-center justify-between bg-gradient-to-r from-white to-[var(--gray-50)]">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-bg)] flex items-center justify-center mr-3">
              <BookOpen className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--gray-800)]">帮助中心</h3>
              <p className="text-xs text-[var(--gray-500)]">使用指南与常见问题</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--gray-400)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-600)] transition-colors"
            aria-label="关闭帮助"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 搜索 */}
        <div className="px-5 py-3 border-b border-[var(--gray-100)]">
          <div className="relative">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-400)]" />
            <input
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索帮助内容，例如：附件、语音、主题..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-[var(--gray-200)] bg-[var(--gray-50)] focus:bg-white focus:ring-2 focus:outline-none text-sm transition-all"
              style={{ '--tw-ring-color': 'var(--primary-light)' } as React.CSSProperties}
            />
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {searchResults ? (
            <div>
              <p className="text-xs font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-3">
                搜索结果（{searchResults.length}）
              </p>
              {searchResults.length === 0 ? (
                <div className="py-10 text-center text-[var(--gray-400)]">
                  <SearchIcon className="w-8 h-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">未找到相关内容</p>
                  <p className="text-xs mt-1">尝试使用其他关键词，如"客户""拜访""附件"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((r, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-[var(--gray-200)] bg-white">
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-[var(--primary-bg)] text-[var(--primary)] font-medium mb-1.5">
                        {r.source}
                      </span>
                      <p className="text-sm font-semibold text-[var(--gray-800)]">{r.title}</p>
                      <p className="text-xs text-[var(--gray-500)] mt-1 leading-relaxed">{r.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 快速上手 */}
              <section>
                <p className="text-xs font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-3 flex items-center">
                  <Rocket className="w-3.5 h-3.5 mr-1.5" /> 快速上手
                </p>
                <div className="space-y-2">
                  {QUICK_START.map((item, idx) => (
                    <div key={idx} className="flex items-start p-3 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)]">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 mr-3 mt-0.5"
                        style={{ backgroundColor: 'var(--primary)' }}
                      >
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--gray-800)]">{item.title}</p>
                        <p className="text-xs text-[var(--gray-500)] mt-0.5 leading-relaxed">{item.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* 功能指南 */}
              <section>
                <p className="text-xs font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-3 flex items-center">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" /> 功能指南
                </p>
                <div className="space-y-2">
                  {GUIDES.map(guide => {
                    const Icon = guide.icon;
                    const expanded = expandedGuides.has(guide.id);
                    return (
                      <div key={guide.id} className="rounded-xl border border-[var(--gray-200)] bg-white overflow-hidden">
                        <button
                          onClick={() => toggleGuide(guide.id)}
                          className="w-full flex items-center px-4 py-3 hover:bg-[var(--gray-50)] transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-[var(--primary-bg)] flex items-center justify-center mr-3">
                            <Icon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                          </div>
                          <span className="flex-1 text-left text-sm font-medium text-[var(--gray-800)]">{guide.title}</span>
                          <ChevronDown
                            className={`w-4 h-4 text-[var(--gray-400)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {expanded && (
                          <div className="px-4 pb-3 space-y-3 border-t border-[var(--gray-100)] pt-3">
                            {guide.items.map((item, idx) => (
                              <div key={idx}>
                                <p className="text-xs font-semibold text-[var(--gray-700)]">{item.title}</p>
                                <p className="text-xs text-[var(--gray-500)] mt-0.5 leading-relaxed">{item.content}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 常见问题 */}
              <section>
                <p className="text-xs font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-3 flex items-center">
                  <MessageCircleQuestion className="w-3.5 h-3.5 mr-1.5" /> 常见问题
                </p>
                <div className="space-y-3">
                  {FAQS.map((faq, idx) => (
                    <details key={idx} className="group rounded-xl border border-[var(--gray-200)] bg-white overflow-hidden">
                      <summary className="flex items-center px-4 py-3 cursor-pointer hover:bg-[var(--gray-50)] transition-colors text-sm font-medium text-[var(--gray-800)] list-none">
                        <span className="flex-1">{faq.question}</span>
                        <ChevronDown className="w-4 h-4 text-[var(--gray-400)] group-open:rotate-180 transition-transform" />
                      </summary>
                      <div className="px-4 pb-4 text-xs text-[var(--gray-500)] leading-relaxed border-t border-[var(--gray-100)] pt-3">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </section>

              {/* 快捷键 */}
              <section>
                <p className="text-xs font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-3 flex items-center">
                  <Keyboard className="w-3.5 h-3.5 mr-1.5" /> 快捷键
                </p>
                <div className="rounded-xl border border-[var(--gray-200)] bg-white divide-y divide-[var(--gray-100)]">
                  {SHORTCUTS.map((sc, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-3">
                      <span className="text-xs text-[var(--gray-600)]">{sc.desc}</span>
                      <kbd className="font-mono bg-[var(--gray-50)] border border-[var(--gray-200)] rounded px-2 py-0.5 text-[11px] text-[var(--gray-500)]">
                        {sc.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </section>

              {/* 反馈提示 */}
              <div className="p-4 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-100)] flex items-start">
                <Mic className="w-4 h-4 text-[var(--gray-400)] mr-2.5 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-[var(--gray-500)] leading-relaxed">
                  没有找到想要的答案？请联系系统管理员，或在拜访记录模块中使用语音 / 附件上传功能记录您的反馈。
                  <Paperclip className="w-3 h-3 inline ml-1" />
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
