import React, { useState, useEffect } from 'react';
import { 
  Settings, Database, Shield, Cpu, CheckCircle, AlertCircle, 
  Plus, Trash2, List, Edit2, X, RefreshCw, Mic, BrainCircuit, 
  Eye, EyeOff, Sparkles, Server, FileJson, ChevronRight, Save,
  Key, Cloud, Lock, Globe, Zap, Layers
} from 'lucide-react';
import { checkConnection, reloadSchemaCache } from '../services/apiService';
import { getIflytekConfig, saveIflytekConfig } from '../services/iflytekService';
import { fetchOllamaModels, DEFAULT_OLLAMA_MODEL } from '../services/geminiService';
import { CustomFieldDefinition, EntityType, FieldType, AIModelType } from '../types';

interface AdminPanelProps {
  fieldDefinitions?: CustomFieldDefinition[];
  setFieldDefinitions?: React.Dispatch<React.SetStateAction<CustomFieldDefinition[]>>;
  onConfigSave?: () => void;
}

const AI_MODEL_KEY = 'visitpro_ai_model';
const DEEPSEEK_KEY_KEY = 'visitpro_deepseek_key';
const OLLAMA_MODEL_KEY = 'visitpro_ollama_model';

// CSS Variables for the design system
const cssVariables = {
  // Primary colors
  primary: '#1E40AF',
  primaryDark: '#1E3A8A',
  primaryLight: '#3B82F6',
  primaryLighter: '#93C5FD',
  primarySubtle: '#EFF6FF',
  
  // Semantic colors
  success: '#10B981',
  successLight: '#D1FAE5',
  successSubtle: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  warningSubtle: '#FFFBEB',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  errorSubtle: '#FEF2F2',
  info: '#8B5CF6',
  infoLight: '#EDE9FE',
  infoSubtle: '#F5F3FF',
  
  // Neutral colors
  background: '#F9FAFB',
  card: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#4B5563',
  textTertiary: '#6B7280',
  textMuted: '#9CA3AF',
  textDisabled: '#D1D5DB',
};

const EnvStatusRow = ({ label, value, isSecret }: { label: string, value: string | undefined, isSecret: boolean }) => {
  const isLoaded = !!value && value !== 'undefined';
  return (
    <div 
      className="flex items-center justify-between p-3 border-b last:border-b-0 transition-colors"
      style={{ borderColor: 'var(--border)', background: 'transparent' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }} className="text-sm">{label}</span>
      <div className="flex items-center">
        {isLoaded ? (
          <span 
            className="flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ 
              color: cssVariables.success, 
              backgroundColor: cssVariables.successSubtle 
            }}
          >
            <CheckCircle className="w-3 h-3 mr-1.5" />
            {isSecret ? '已配置' : value}
          </span>
        ) : (
          <span 
            className="flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ 
              color: cssVariables.textMuted, 
              backgroundColor: cssVariables.background 
            }}
          >
            <X className="w-3 h-3 mr-1.5" />
            未配置
          </span>
        )}
      </div>
    </div>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  fieldDefinitions = [], 
  setFieldDefinitions = (_: any) => {},
  onConfigSave
}) => {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isReloadingCache, setIsReloadingCache] = useState(false);
  
  // AI Config State
  const [aiModel, setAiModel] = useState<AIModelType>('ollama');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [showDeepseekKey, setShowDeepseekKey] = useState(false);
  const [kimiKey, setKimiKey] = useState('');
  const [showKimiKey, setShowKimiKey] = useState(false);

  // Ollama State
  const [ollamaModel, setOllamaModel] = useState(DEFAULT_OLLAMA_MODEL);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaStatus, setOllamaStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoadingOllamaModels, setIsLoadingOllamaModels] = useState(false);
  
  // iFlytek State
  const [iflytekAppId, setIflytekAppId] = useState('');
  const [iflytekApiSecret, setIflytekApiSecret] = useState('');
  const [iflytekApiKey, setIflytekApiKey] = useState('');
  const [iflytekDomain, setIflytekDomain] = useState('generalv3.5');
  const [iflytekSttDomain, setIflytekSttDomain] = useState('iat');
  const [showIflytekKey, setShowIflytekKey] = useState(false);
  const [showIflytekSecret, setShowIflytekSecret] = useState(false);
  
  // Custom Field State
  const [activeTab, setActiveTab] = useState<EntityType>('CLIENT');
  
  // Form State
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldOptions, setFieldOptions] = useState('');

  const isDeepSeekEnvConfigured = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'undefined';
  const isKimiEnvConfigured = !!process.env.KIMI_API_KEY && process.env.KIMI_API_KEY !== 'undefined';
  const isIflytekEnvConfigured = !!process.env.IFLYTEK_APP_ID && process.env.IFLYTEK_APP_ID !== 'undefined';

  useEffect(() => {
    // Load iFlytek Config
    if (!isIflytekEnvConfigured) {
        const iflyConfig = getIflytekConfig();
        setIflytekAppId(iflyConfig.appId || '');
        setIflytekApiSecret(iflyConfig.apiSecret || '');
        setIflytekApiKey(iflyConfig.apiKey || '');
        setIflytekDomain(iflyConfig.domain || 'generalv3.5');
        setIflytekSttDomain(iflyConfig.sttDomain || 'iat');
    }

    // Load AI Config
    setAiModel((localStorage.getItem(AI_MODEL_KEY) as AIModelType) || 'ollama');
    if (!isDeepSeekEnvConfigured) {
        setDeepseekKey(localStorage.getItem(DEEPSEEK_KEY_KEY) || '');
    }
    if (!isKimiEnvConfigured) {
        setKimiKey(localStorage.getItem('visitpro_kimi_key') || '');
    }
    // Load Ollama Config
    setOllamaModel(localStorage.getItem(OLLAMA_MODEL_KEY) || DEFAULT_OLLAMA_MODEL);
    loadOllamaModels();
  }, [isIflytekEnvConfigured, isDeepSeekEnvConfigured, isKimiEnvConfigured]);

  // Reset form when switching tabs
  useEffect(() => {
    resetForm();
  }, [activeTab]);

  const resetForm = () => {
    setEditingFieldId(null);
    setFieldLabel('');
    setFieldType('text');
    setFieldOptions('');
  };

  const handleTestConnection = async () => {
    // 本地 MySQL 模式：连接配置在 server/.env，这里仅做连通性检测
    const result = await checkConnection();
    if (result.success) {
      setConnectionStatus('success');
      if (onConfigSave) {
        onConfigSave();
      }
    } else {
      console.error(result.message);
      setConnectionStatus('error');
    }
  };

  const handleReloadSchemaCache = async () => {
    setIsReloadingCache(true);
    try {
      await reloadSchemaCache();
      alert("数据库缓存刷新请求已发送。请重试保存操作。");
    } catch (e: any) {
      alert(`刷新失败: ${e.message}\n请确保已运行最新的 SQL 脚本并创建了 reload_schema_cache 函数。`);
    } finally {
      setIsReloadingCache(false);
    }
  };
  
  const handleSaveIflytek = () => {
    const appId = iflytekAppId.trim();
    const secret = iflytekApiSecret.trim();
    const key = iflytekApiKey.trim();
    const domain = iflytekDomain.trim();
    const sttDomain = iflytekSttDomain.trim();
    
    setIflytekAppId(appId);
    setIflytekApiSecret(secret);
    setIflytekApiKey(key);
    setIflytekDomain(domain);
    setIflytekSttDomain(sttDomain);
    
    saveIflytekConfig(appId, secret, key, domain, sttDomain);
    alert("科大讯飞配置已保存");
  };

  const loadOllamaModels = async () => {
    setIsLoadingOllamaModels(true);
    setOllamaStatus(null);
    try {
      const models = await fetchOllamaModels();
      setOllamaModels(models);
      setOllamaStatus({ type: 'success', text: `Ollama 已连接，检测到 ${models.length} 个本地模型` });
    } catch (e: any) {
      setOllamaModels([]);
      setOllamaStatus({ type: 'error', text: e.message || '无法连接 Ollama 服务' });
    } finally {
      setIsLoadingOllamaModels(false);
    }
  };

  const handleSaveAIConfig = () => {
      localStorage.setItem(AI_MODEL_KEY, aiModel);
      localStorage.setItem(OLLAMA_MODEL_KEY, ollamaModel);
      if (!isDeepSeekEnvConfigured) {
          localStorage.setItem(DEEPSEEK_KEY_KEY, deepseekKey.trim());
      }
      if (!isKimiEnvConfigured) {
          localStorage.setItem('visitpro_kimi_key', kimiKey.trim());
      }
      alert("AI 模型配置已更新");
  };

  const handleEditClick = (field: CustomFieldDefinition) => {
    setEditingFieldId(field.id);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setFieldOptions(field.options?.join(', ') || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveField = () => {
    if (!fieldLabel.trim()) {
      alert("请输入字段显示名称");
      return;
    }

    if (editingFieldId) {
      setFieldDefinitions(prev => prev.map(f => {
        if (f.id === editingFieldId) {
          return {
            ...f,
            label: fieldLabel,
            type: fieldType,
            options: fieldType === 'select' ? fieldOptions.split(/,|，/).map(s => s.trim()).filter(Boolean) : undefined,
          };
        }
        return f;
      }));
    } else {
      const key = fieldLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
      
      if (fieldDefinitions.some(f => f.entityType === activeTab && f.key === key)) {
        alert("该字段名已存在，请使用其他名称");
        return;
      }

      const newField: CustomFieldDefinition = {
        id: Date.now().toString(),
        entityType: activeTab,
        key,
        label: fieldLabel,
        type: fieldType,
        options: fieldType === 'select' ? fieldOptions.split(/,|，/).map(s => s.trim()).filter(Boolean) : undefined
      };

      setFieldDefinitions([...fieldDefinitions, newField]);
    }

    resetForm();
  };

  const handleDeleteField = (id: string) => {
    if (confirm("确定要删除此字段吗？这将导致所有历史数据中该字段的值不再显示。")) {
      setFieldDefinitions(fieldDefinitions.filter(f => f.id !== id));
      if (editingFieldId === id) {
        resetForm();
      }
    }
  };

  const getModelIcon = (model: AIModelType) => {
    switch (model) {
      case 'ollama': return <Server className="w-4 h-4" style={{ color: cssVariables.success }} />;
      case 'gemini': return <Sparkles className="w-4 h-4" style={{ color: cssVariables.info }} />;
      case 'deepseek': return <BrainCircuit className="w-4 h-4" style={{ color: cssVariables.primary }} />;
      case 'spark': return <Zap className="w-4 h-4" style={{ color: cssVariables.warning }} />;
      case 'kimi': return <BrainCircuit className="w-4 h-4" style={{ color: '#10B981' }} />;
      default: return <BrainCircuit className="w-4 h-4" />;
    }
  };

  const getModelLabel = (model: AIModelType) => {
    switch (model) {
      case 'ollama': return 'Ollama (本地)';
      case 'gemini': return 'Google Gemini';
      case 'deepseek': return 'DeepSeek';
      case 'spark': return '讯飞星火';
      case 'kimi': return 'Kimi (月之暗面)';
      default: return model;
    }
  };

  const getTabLabel = (type: EntityType) => {
    switch (type) {
      case 'CLIENT': return '客户字段';
      case 'VISIT': return '拜访字段';
      case 'USER': return '用户字段';
      default: return type;
    }
  };

  const getTabIcon = (type: EntityType) => {
    switch (type) {
      case 'CLIENT': return <Globe className="w-4 h-4" />;
      case 'VISIT': return <List className="w-4 h-4" />;
      case 'USER': return <Shield className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeLabel = (type: FieldType) => {
    switch (type) {
      case 'select': return '选项列表';
      case 'date': return '日期';
      case 'number': return '数字';
      case 'text': return '文本';
      default: return type;
    }
  };

  const getTypeColor = (type: FieldType) => {
    switch (type) {
      case 'select': return { color: cssVariables.info, bg: cssVariables.infoSubtle };
      case 'date': return { color: cssVariables.success, bg: cssVariables.successSubtle };
      case 'number': return { color: cssVariables.warning, bg: cssVariables.warningSubtle };
      case 'text': return { color: cssVariables.primary, bg: cssVariables.primarySubtle };
      default: return { color: cssVariables.textSecondary, bg: cssVariables.background };
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12" style={{ backgroundColor: 'transparent' }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div 
            className="w-10 h-10 flex items-center justify-center"
            style={{ background: 'var(--primary-100)', borderRadius: 'var(--radius-md)' }}
          >
            <Settings className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            系统配置
          </h1>
        </div>
        <p style={{ color: 'var(--text-tertiary)' }} className="text-sm ml-13 pl-13">
          管理AI模型、自定义字段和系统连接设置
        </p>
      </div>

      <div className="space-y-6">
        {/* AI Model Configuration - Featured Section */}
        <section 
          className="overflow-hidden"
          style={{ 
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)'
          }}
        >
          {/* Section Header */}
          <div 
            className="px-6 py-4 flex items-center justify-between"
            style={{ 
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--bg-primary) 100%)'
            }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: cssVariables.infoSubtle, borderRadius: 'var(--radius)' }}
              >
                <BrainCircuit className="w-4 h-4" style={{ color: cssVariables.info }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  AI 大模型配置
                </h3>
                <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                  配置智能分析、总结生成和邮件撰写使用的AI模型
                </p>
              </div>
            </div>
          </div>

          {/* Section Content */}
          <div className="p-6 space-y-6">
            {/* Model Selection Cards */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
                选择默认分析模型
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                {(['ollama', 'gemini', 'deepseek', 'spark', 'kimi'] as AIModelType[]).map((model) => (
                  <button
                    key={model}
                    onClick={() => setAiModel(model)}
                    className="relative p-4 transition-all duration-200 text-left group"
                    style={{
                      border: `2px solid ${aiModel === model ? 'var(--primary-600)' : 'var(--border)'}`,
                      background: aiModel === model ? 'var(--primary-50)' : 'var(--bg-primary)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div 
                        className="w-10 h-10 flex items-center justify-center"
                        style={{ 
                          background: aiModel === model ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                          borderRadius: 'var(--radius)'
                        }}
                      >
                        {getModelIcon(model)}
                      </div>
                      {aiModel === model && (
                        <div 
                          className="w-5 h-5 flex items-center justify-center"
                          style={{ background: 'var(--primary-600)', borderRadius: '9999px' }}
                        >
                          <CheckCircle className="w-3 h-3" style={{ color: 'var(--bg-primary)' }} />
                        </div>
                      )}
                    </div>
                    <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {getModelLabel(model)}
                    </div>
                    <div className="text-xs mt-1" style={{ color: cssVariables.textMuted }}>
                      {model === 'ollama' && '本地部署 · 离线可用'}
                      {model === 'gemini' && 'Google Gemini 3 Flash'}
                      {model === 'deepseek' && 'DeepSeek V3'}
                      {model === 'spark' && '讯飞星火 Spark Desk'}
                      {model === 'kimi' && 'Moonshot V1'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ollama Configuration */}
            {aiModel === 'ollama' && (
              <div 
                className="p-4 animate-fade-in-down"
                style={{ 
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium flex items-center" style={{ color: 'var(--text-secondary)' }}>
                    <Server className="w-4 h-4 mr-2" />
                    Ollama 本地模型 (localhost:11434)
                  </label>
                  <button
                    onClick={loadOllamaModels}
                    disabled={isLoadingOllamaModels}
                    className="text-xs flex items-center gap-1 px-2 py-1 transition-colors"
                    style={{ color: 'var(--primary-600)', background: 'var(--primary-50)', borderRadius: 'var(--radius-sm)' }}
                  >
                    {isLoadingOllamaModels ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    刷新模型列表
                  </button>
                </div>
                <select
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-full p-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)'
                  }}
                >
                  {/* 确保当前配置值始终在下拉列表中 */}
                  {ollamaModels.length === 0 && !ollamaModel && (
                    <option value={DEFAULT_OLLAMA_MODEL}>{DEFAULT_OLLAMA_MODEL}</option>
                  )}
                  {ollamaModel && !ollamaModels.includes(ollamaModel) && (
                    <option value={ollamaModel}>{ollamaModel}</option>
                  )}
                  {ollamaModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {ollamaStatus && (
                  <div className="mt-3 text-xs flex items-center gap-1.5"
                    style={{ color: ollamaStatus.type === 'success' ? cssVariables.success : cssVariables.error }}>
                    {ollamaStatus.type === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    {ollamaStatus.text}
                  </div>
                )}
                <p className="mt-2 text-xs" style={{ color: cssVariables.textMuted }}>
                  数据不出本机，无需 API Key。若列表为空，请确认已运行 <code>ollama serve</code> 并通过 <code>ollama pull</code> 下载模型。
                </p>
              </div>
            )}

            {/* API Key Configuration */}
            {aiModel === 'deepseek' && (
              <div 
                className="p-4 animate-fade-in-down"
                style={{ 
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium flex items-center" style={{ color: 'var(--text-secondary)' }}>
                    <Key className="w-4 h-4 mr-2" />
                    DeepSeek API Key
                  </label>
                  <a 
                    href="https://platform.deepseek.com/api_keys" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs flex items-center hover:underline"
                    style={{ color: 'var(--primary-600)' }}
                  >
                    获取 Key
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
                
                {isDeepSeekEnvConfigured ? (
                  <div 
                    className="p-3 flex items-center"
                    style={{ background: cssVariables.successSubtle, borderRadius: 'var(--radius)' }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" style={{ color: cssVariables.success }} />
                    <span className="text-sm" style={{ color: cssVariables.success }}>
                      API Key 已通过环境变量配置
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      type={showDeepseekKey ? "text" : "password"}
                      value={deepseekKey}
                      onChange={(e) => setDeepseekKey(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 text-sm outline-none transition-all focus:ring-2"
                      style={{ 
                        border: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius)'
                      }}
                      placeholder="sk-..."
                    />
                    <button
                      onClick={() => setShowDeepseekKey(!showDeepseekKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: cssVariables.textMuted }}
                    >
                      {showDeepseekKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {aiModel === 'kimi' && (
              <div 
                className="p-4 animate-fade-in-down"
                style={{ 
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium flex items-center" style={{ color: 'var(--text-secondary)' }}>
                    <Key className="w-4 h-4 mr-2" />
                    Kimi API Key
                  </label>
                  <a 
                    href="https://platform.moonshot.cn/console/api-keys" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="text-xs flex items-center hover:underline"
                    style={{ color: 'var(--primary-600)' }}
                  >
                    获取 Key
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </a>
                </div>
                
                {isKimiEnvConfigured ? (
                  <div 
                    className="p-3 flex items-center"
                    style={{ background: cssVariables.successSubtle, borderRadius: 'var(--radius)' }}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" style={{ color: cssVariables.success }} />
                    <span className="text-sm" style={{ color: cssVariables.success }}>
                      API Key 已通过环境变量配置
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      type={showKimiKey ? "text" : "password"}
                      value={kimiKey}
                      onChange={(e) => setKimiKey(e.target.value)}
                      className="w-full px-4 py-2.5 pr-10 text-sm outline-none transition-all focus:ring-2"
                      style={{ 
                        border: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius)'
                      }}
                      placeholder="sk-..."
                    />
                    <button
                      onClick={() => setShowKimiKey(!showKimiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                      style={{ color: cssVariables.textMuted }}
                    >
                      {showKimiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            )}

            {aiModel === 'spark' && (
              <div 
                className="p-4 flex items-start space-x-3"
                style={{ 
                  background: cssVariables.warningSubtle,
                  border: `1px solid ${cssVariables.warningLight}`,
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cssVariables.warning }} />
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  讯飞星火模型将使用下方的"科大讯飞语音配置"中的认证信息。请确保下方的 Domain 参数正确。
                </div>
              </div>
            )}

            {aiModel === 'gemini' && (
              <div 
                className="p-4 flex items-start space-x-3"
                style={{ 
                  background: cssVariables.successSubtle,
                  border: `1px solid ${cssVariables.successLight}`,
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cssVariables.success }} />
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Gemini API Key 已通过环境变量配置，无需额外设置。
                </div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <button 
                onClick={handleSaveAIConfig}
                className="flex items-center px-5 py-2.5 text-sm font-medium transition-all duration-200"
                style={{ 
                  background: 'var(--primary-600)',
                  color: 'var(--bg-primary)',
                  borderRadius: 'var(--radius)',
                  boxShadow: `0 2px 8px ${cssVariables.primaryLighter}40`
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                保存 AI 配置
              </button>
            </div>
          </div>
        </section>

        {/* Custom Field Configuration */}
        <section 
          className="overflow-hidden"
          style={{ 
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)'
          }}
        >
          {/* Section Header */}
          <div 
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 flex items-center justify-center"
                  style={{ background: cssVariables.successSubtle, borderRadius: 'var(--radius)' }}
                >
                  <FileJson className="w-4 h-4" style={{ color: cssVariables.success }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    自定义字段管理
                  </h3>
                  <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                    为客户、拜访记录和用户添加自定义字段
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Tabs */}
            <div 
              className="flex space-x-1 p-1 mb-6"
              style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}
            >
              {(['CLIENT', 'VISIT', 'USER'] as EntityType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type)}
                  className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 text-sm font-medium transition-all duration-200"
                  style={{
                    background: activeTab === type ? 'var(--bg-primary)' : 'transparent',
                    color: activeTab === type ? 'var(--primary-600)' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius)',
                    boxShadow: activeTab === type ? 'var(--shadow-sm)' : 'none'
                  }}
                >
                  {getTabIcon(type)}
                  <span>{getTabLabel(type)}</span>
                </button>
              ))}
            </div>

            {/* Add/Edit Field Form */}
            <div 
              className="p-5 mb-6"
              style={{ 
                background: editingFieldId ? cssVariables.warningSubtle : 'var(--bg-secondary)',
                border: `1px solid ${editingFieldId ? cssVariables.warningLight : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-6 h-6 flex items-center justify-center"
                    style={{ 
                      background: editingFieldId ? cssVariables.warningLight : 'var(--primary-100)',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    {editingFieldId ? (
                      <Edit2 className="w-3 h-3" style={{ color: cssVariables.warning }} />
                    ) : (
                      <Plus className="w-3 h-3" style={{ color: 'var(--primary-600)' }} />
                    )}
                  </div>
                  <span 
                    className="text-sm font-medium"
                    style={{ color: editingFieldId ? cssVariables.warning : 'var(--text-secondary)' }}
                  >
                    {editingFieldId ? '编辑字段' : '添加新字段'}
                  </span>
                </div>
                {editingFieldId && (
                  <button 
                    onClick={resetForm} 
                    className="flex items-center text-xs px-2 py-1 transition-colors"
                    style={{ color: cssVariables.textMuted, borderRadius: 'var(--radius)' }}
                  >
                    <X className="w-3 h-3 mr-1" /> 取消
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-5">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    显示名称
                  </label>
                  <input 
                    type="text" 
                    value={fieldLabel}
                    onChange={e => setFieldLabel(e.target.value)}
                    placeholder="例如：合同编号"
                    className="w-full px-3 py-2 text-sm outline-none transition-all focus:ring-2"
                    style={{ 
                      border: '1px solid var(--border)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius)'
                    }}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                    字段类型
                  </label>
                  <select 
                    value={fieldType}
                    onChange={e => setFieldType(e.target.value as FieldType)}
                    className="w-full px-3 py-2 text-sm outline-none transition-all focus:ring-2 appearance-none"
                    style={{ 
                      border: '1px solid var(--border)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      borderRadius: 'var(--radius)'
                    }}
                  >
                    <option value="text">文本</option>
                    <option value="number">数字</option>
                    <option value="date">日期</option>
                    <option value="select">选项列表</option>
                  </select>
                </div>
                {fieldType === 'select' && (
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      选项 (逗号分隔)
                    </label>
                    <input 
                      type="text" 
                      value={fieldOptions}
                      onChange={e => setFieldOptions(e.target.value)}
                      placeholder="例如：A级, B级, C级"
                      className="w-full px-3 py-2 text-sm outline-none transition-all focus:ring-2"
                      style={{ 
                        border: '1px solid var(--border)',
                        background: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius)'
                      }}
                    />
                  </div>
                )}
                <div className={fieldType === 'select' ? 'md:col-span-12 flex justify-end' : 'md:col-span-4 flex justify-end'}>
                  <button 
                    onClick={handleSaveField}
                    className="flex items-center px-4 py-2 text-sm font-medium transition-all duration-200"
                    style={{ 
                      background: editingFieldId ? cssVariables.warning : 'var(--primary-600)',
                      color: 'var(--bg-primary)',
                      borderRadius: 'var(--radius)'
                    }}
                  >
                    {editingFieldId ? (
                      <><RefreshCw className="w-4 h-4 mr-1.5" /> 更新</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-1.5" /> 添加</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Fields List */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center" style={{ color: 'var(--text-secondary)' }}>
                <Layers className="w-4 h-4 mr-2" />
                已有字段 ({fieldDefinitions.filter(f => f.entityType === activeTab).length})
              </h4>
              
              <div className="space-y-2">
                {fieldDefinitions.filter(f => f.entityType === activeTab).length === 0 ? (
                  <div 
                    className="p-8 border-dashed flex flex-col items-center justify-center text-center"
                    style={{ border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}
                  >
                    <div 
                      className="w-12 h-12 flex items-center justify-center mb-3"
                      style={{ background: 'var(--bg-secondary)', borderRadius: '9999px' }}
                    >
                      <FileJson className="w-6 h-6" style={{ color: cssVariables.textMuted }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      暂无自定义字段
                    </p>
                    <p className="text-xs mt-1" style={{ color: cssVariables.textMuted }}>
                      添加字段以扩展数据模型
                    </p>
                  </div>
                ) : (
                  fieldDefinitions.filter(f => f.entityType === activeTab).map(field => {
                    const typeStyle = getTypeColor(field.type);
                    return (
                      <div 
                        key={field.id} 
                        className="group flex items-center justify-between p-4 transition-all duration-200"
                        style={{ 
                          background: editingFieldId === field.id ? cssVariables.warningSubtle : 'var(--bg-primary)',
                          border: `1px solid ${editingFieldId === field.id ? cssVariables.warning : 'var(--border)'}`,
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <span 
                            className="font-medium text-sm truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {field.label}
                          </span>
                          <code 
                            className="text-xs px-2 py-0.5 font-mono"
                            style={{ 
                              background: 'var(--bg-secondary)',
                              color: cssVariables.textMuted,
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            {field.key}
                          </code>
                          <span 
                            className="text-xs px-2 py-0.5 font-medium flex-shrink-0"
                            style={{ 
                              backgroundColor: typeStyle.bg,
                              color: typeStyle.color,
                              borderRadius: '9999px'
                            }}
                          >
                            {getTypeLabel(field.type)}
                          </span>
                          {field.type === 'select' && field.options && (
                            <span 
                              className="text-xs truncate max-w-[200px] hidden sm:block"
                              style={{ color: cssVariables.textMuted }}
                            >
                              [{field.options.join(', ')}]
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 ml-4">
                          <button 
                            onClick={() => handleEditClick(field)}
                            className="p-2 transition-colors"
                            style={{ color: cssVariables.textMuted, borderRadius: 'var(--radius)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'var(--primary-600)';
                              e.currentTarget.style.background = 'var(--primary-50)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = cssVariables.textMuted;
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteField(field.id)}
                            className="p-2 transition-colors"
                            style={{ color: cssVariables.textMuted, borderRadius: 'var(--radius)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = cssVariables.error;
                              e.currentTarget.style.background = cssVariables.errorSubtle;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = cssVariables.textMuted;
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Two Column Layout for iFlytek & Database */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* iFlytek Configuration */}
          <section 
            className="overflow-hidden"
            style={{ 
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div 
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 flex items-center justify-center"
                  style={{ background: cssVariables.warningSubtle, borderRadius: 'var(--radius)' }}
                >
                  <Mic className="w-4 h-4" style={{ color: cssVariables.warning }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    科大讯飞配置
                  </h3>
                  <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                    语音识别与大模型服务
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {isIflytekEnvConfigured ? (
                <div 
                  className="p-4 flex items-start space-x-3"
                  style={{ 
                    background: cssVariables.successSubtle,
                    border: `1px solid ${cssVariables.successLight}`,
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: cssVariables.success }} />
                  <div>
                    <p className="font-medium text-sm" style={{ color: cssVariables.success }}>
                      已通过环境变量配置
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                      系统已检测到 IFLYTEK_APP_ID 等变量
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                      APP ID
                    </label>
                    <input 
                      type="text" 
                      value={iflytekAppId}
                      onChange={(e) => setIflytekAppId(e.target.value)}
                      className="w-full px-3 py-2 text-sm outline-none transition-all focus:ring-2"
                      style={{ 
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        borderRadius: 'var(--radius)'
                      }}
                      placeholder="例如: 12345678"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        API Key
                      </label>
                      <div className="relative">
                        <input 
                          type={showIflytekKey ? "text" : "password"}
                          value={iflytekApiKey}
                          onChange={(e) => setIflytekApiKey(e.target.value)}
                          className="w-full px-3 py-2 pr-8 text-sm outline-none transition-all focus:ring-2"
                          style={{ 
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            borderRadius: 'var(--radius)'
                          }}
                          placeholder="API Key"
                        />
                        <button
                          onClick={() => setShowIflytekKey(!showIflytekKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          style={{ color: cssVariables.textMuted }}
                        >
                          {showIflytekKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        API Secret
                      </label>
                      <div className="relative">
                        <input 
                          type={showIflytekSecret ? "text" : "password"}
                          value={iflytekApiSecret}
                          onChange={(e) => setIflytekApiSecret(e.target.value)}
                          className="w-full px-3 py-2 pr-8 text-sm outline-none transition-all focus:ring-2"
                          style={{ 
                            border: '1px solid var(--border)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            borderRadius: 'var(--radius)'
                          }}
                          placeholder="API Secret"
                        />
                        <button
                          onClick={() => setShowIflytekSecret(!showIflytekSecret)}
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          style={{ color: cssVariables.textMuted }}
                        >
                          {showIflytekSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        大模型 Domain
                      </label>
                      <input 
                        type="text" 
                        value={iflytekDomain}
                        onChange={(e) => setIflytekDomain(e.target.value)}
                        className="w-full px-3 py-2 text-sm outline-none transition-all focus:ring-2"
                        style={{ 
                          border: '1px solid var(--border)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          borderRadius: 'var(--radius)'
                        }}
                        placeholder="generalv3.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                        语音模型
                      </label>
                      <select 
                        value={iflytekSttDomain}
                        onChange={(e) => setIflytekSttDomain(e.target.value)}
                        className="w-full px-3 py-2 text-sm outline-none transition-all focus:ring-2 appearance-none"
                        style={{ 
                          border: '1px solid var(--border)',
                          background: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          borderRadius: 'var(--radius)'
                        }}
                      >
                        <option value="iat">通用标准版</option>
                        <option value="pro_iat">极速转大模型</option>
                        <option value="general_fast">实时语音大模型</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-2">
                    <button 
                      onClick={handleSaveIflytek}
                      className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-all duration-200"
                      style={{ 
                        background: 'var(--text-secondary)',
                        color: 'var(--bg-primary)',
                        borderRadius: 'var(--radius)'
                      }}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      保存讯飞配置
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Database Configuration */}
          <section 
            className="overflow-hidden"
            style={{ 
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow)'
            }}
          >
            <div 
              className="px-6 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center space-x-3">
                <div 
                  className="w-8 h-8 flex items-center justify-center"
                  style={{ background: cssVariables.infoSubtle, borderRadius: 'var(--radius)' }}
                >
                  <Database className="w-4 h-4" style={{ color: cssVariables.info }} />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                    数据库配置
                  </h3>
                  <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                    本地 MySQL 连接设置
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
                <div className="space-y-4">
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    本地 MySQL 模式：数据库连接配置位于 server/.env，此处仅提供连通性检测。
                  </p>

                  {/* Connection Status */}
                  {connectionStatus !== 'idle' && (
                    <div 
                      className="p-3 flex items-center space-x-2"
                      style={{ 
                        background: connectionStatus === 'success' ? cssVariables.successSubtle : cssVariables.errorSubtle,
                        borderRadius: 'var(--radius)'
                      }}
                    >
                      {connectionStatus === 'success' ? (
                        <>
                          <CheckCircle className="w-4 h-4" style={{ color: cssVariables.success }} />
                          <span className="text-sm" style={{ color: cssVariables.success }}>连接成功</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4" style={{ color: cssVariables.error }} />
                          <span className="text-sm" style={{ color: cssVariables.error }}>连接失败，请检查配置</span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-3 pt-2">
                    <button 
                      onClick={handleReloadSchemaCache}
                      disabled={isReloadingCache}
                      className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50"
                      style={{ 
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius)'
                      }}
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${isReloadingCache ? 'animate-spin' : ''}`} />
                      刷新数据库缓存
                    </button>
                    <button 
                      onClick={handleTestConnection}
                      className="flex-1 flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-all duration-200"
                      style={{ 
                        background: 'var(--primary-600)',
                        color: 'var(--bg-primary)',
                        borderRadius: 'var(--radius)'
                      }}
                    >
                      <Server className="w-4 h-4 mr-2" />
                      测试连接
                    </button>
                  </div>
                </div>
            </div>
          </section>
        </div>

        {/* Access Control */}
        <section 
          className="overflow-hidden"
          style={{ 
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div 
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: cssVariables.errorSubtle, borderRadius: 'var(--radius)' }}
              >
                <Shield className="w-4 h-4" style={{ color: cssVariables.error }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  访问控制
                </h3>
                <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                  管理系统权限和功能开关
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div 
                className="flex items-center justify-between p-4"
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 flex items-center justify-center"
                    style={{ background: 'var(--primary-50)', borderRadius: 'var(--radius)' }}
                  >
                    <Shield className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      团队主管管理面板
                    </p>
                    <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                      启用后，团队主管可以访问管理功能
                    </p>
                  </div>
                </div>
                <div 
                  className="w-12 h-6 relative cursor-pointer transition-colors"
                  style={{ background: 'var(--primary-600)', borderRadius: '9999px' }}
                >
                  <div 
                    className="absolute right-1 top-1 w-4 h-4 shadow-sm transition-transform"
                    style={{ background: 'var(--bg-primary)', borderRadius: '9999px' }}
                  />
                </div>
              </div>

              <div 
                className="flex items-center justify-between p-4"
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-10 h-10 flex items-center justify-center"
                    style={{ background: cssVariables.warningSubtle, borderRadius: 'var(--radius)' }}
                  >
                    <Mic className="w-5 h-5" style={{ color: cssVariables.warning }} />
                  </div>
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      本地音频存储
                    </p>
                    <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                      允许在本地存储录音文件
                    </p>
                  </div>
                </div>
                <div 
                  className="w-12 h-6 relative cursor-pointer transition-colors"
                  style={{ background: cssVariables.textDisabled, borderRadius: '9999px' }}
                >
                  <div 
                    className="absolute left-1 top-1 w-4 h-4 shadow-sm transition-transform"
                    style={{ background: 'var(--bg-primary)', borderRadius: '9999px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Environment Diagnostics */}
        <section 
          className="overflow-hidden"
          style={{ 
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div 
            className="px-6 py-4"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)' }}
              >
                <Cpu className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  环境变量诊断
                </h3>
                <p className="text-xs" style={{ color: cssVariables.textMuted }}>
                  检查系统环境变量配置状态
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div 
              className="overflow-hidden"
              style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}
            >
              <EnvStatusRow label="API_KEY (Gemini)" value={process.env.API_KEY} isSecret={true} />
              <EnvStatusRow label="DEEPSEEK_API_KEY" value={process.env.DEEPSEEK_API_KEY} isSecret={true} />
              <EnvStatusRow label="IFLYTEK_APP_ID" value={process.env.IFLYTEK_APP_ID} isSecret={false} />
            </div>
            <div 
              className="mt-4 p-3 flex items-start space-x-2"
              style={{ 
                background: cssVariables.warningSubtle,
                borderRadius: 'var(--radius)'
              }}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: cssVariables.warning }} />
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                修改 .env 文件后，必须 <strong>重启开发服务器</strong> (Ctrl+C 然后再次 npm run dev) 才能生效。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
