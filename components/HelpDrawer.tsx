import React, { useState } from 'react';
import { X, BookOpen, Users, Briefcase, Sparkles, Settings, Mic, Command, ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

interface HelpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const HelpSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white mb-3 shadow-sm">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center text-slate-800 font-bold text-sm">
          <Icon className="w-5 h-5 mr-3 text-indigo-600" />
          {title}
        </div>
        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      {isExpanded && (
        <div className="p-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 animate-fade-in-down">
          {children}
        </div>
      )}
    </div>
  );
};

export const HelpDrawer: React.FC<HelpDrawerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Drawer Content */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in-right">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center mr-3">
              <HelpCircle className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">使用帮助 & 文档</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          
          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider px-1">快速开始</h3>
            
            <HelpSection title="如何创建客户？" icon={Users}>
              <ol className="list-decimal pl-5 space-y-2">
                <li>点击左侧导航栏的 <strong>客户管理</strong>。</li>
                <li>点击右上角的 <strong>+ 新建客户</strong> 按钮。</li>
                <li>填写基本信息。如果想获得 AI 分析，请确保填写准确的“客户名称”和“所属行业”。</li>
                <li>点击 <strong>保存</strong> 即可。</li>
                <li><span className="text-indigo-600 font-medium">Tips:</span> 保存后，点击“生成画像”按钮，AI 将自动补全财务、股权和供应链信息。</li>
              </ol>
            </HelpSection>

            <HelpSection title="如何记录拜访 & 录音？" icon={Mic}>
              <ol className="list-decimal pl-5 space-y-2">
                <li>点击 <strong>拜访记录</strong> <ChevronRight className="w-3 h-3 inline mx-1 text-slate-400" /> <strong>新建拜访</strong>。</li>
                <li>选择客户（支持搜索）。</li>
                <li>
                  <strong>方式一（文字）：</strong> 直接在编辑器中输入笔记。
                </li>
                <li>
                  <strong>方式二（录音）：</strong> 点击右下角的 <Mic className="w-3 h-3 inline"/> 麦克风图标开始实时录音，或点击 <span className="font-bold">上传</span> 图标上传音频文件。
                </li>
                <li>上传或录制完成后，点击音频卡片上的 <strong>转写为文字</strong>，Gemini AI 将自动将语音转换为文本。</li>
              </ol>
            </HelpSection>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider px-1">AI 智能功能</h3>
            
            <HelpSection title="AI 拜访分析" icon={Briefcase}>
              <p className="mb-2">VisitPro 利用 LLM (大语言模型) 自动分析您的会议记录：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>执行摘要：</strong> 自动提炼长篇对话的核心内容。</li>
                <li><strong>情感分析：</strong> 判断客户的意向（积极/中性/消极）。</li>
                <li><strong>待办事项：</strong> 自动识别下一步计划 (Action Items)。</li>
              </ul>
              <p className="mt-2 text-xs text-slate-500">操作：在拜访详情页右侧，点击“开始智能分析”按钮。</p>
            </HelpSection>

            <HelpSection title="企业智能画像" icon={Sparkles}>
              <p>系统可以根据客户名称和行业，模拟生成以下数据（Demo 演示用）：</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><strong>财务分析：</strong> 营收趋势、利润率等。</li>
                <li><strong>供应链：</strong> 上下游供应商与客户。</li>
                <li><strong>股权结构：</strong> 自动生成可视化的股权穿透图。</li>
              </ul>
            </HelpSection>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider px-1">设置与配置</h3>
            
            <HelpSection title="系统配置" icon={Settings}>
              <p className="mb-2">您可以在 <strong>系统设置</strong> 中配置：</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>AI 模型：</strong> 切换 Gemini (默认)、DeepSeek 或 讯飞星火。</li>
                <li><strong>数据库：</strong> 配置 Supabase 连接 URL 和 Key。</li>
                <li><strong>自定义字段：</strong> 为客户或拜访添加额外的业务字段。</li>
              </ul>
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                <strong>注意：</strong> 如果您在本地开发，建议使用根目录下的 <code>.env</code> 文件配置 API Key，安全性更高。
              </div>
            </HelpSection>

            <HelpSection title="快捷键" icon={Command}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 bg-slate-100 rounded">
                  <span>打开搜索</span>
                  <kbd className="font-mono bg-white px-1 rounded border">Cmd+K</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-100 rounded">
                  <span>关闭弹窗</span>
                  <kbd className="font-mono bg-white px-1 rounded border">ESC</kbd>
                </div>
              </div>
            </HelpSection>
          </div>

        </div>

        <div className="p-4 border-t border-slate-100 bg-white text-center text-xs text-slate-400">
          VisitPro CRM v1.3.0
        </div>
      </div>
    </div>
  );
};