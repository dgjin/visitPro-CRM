import React, { useState, useEffect } from 'react';
import { Settings, Database, Shield, Cpu, CheckCircle, AlertCircle, Plus, Trash2, List, Edit2, X, RefreshCw, Mic, BrainCircuit, Eye, EyeOff } from 'lucide-react';
import { getStoredConfig, saveConfig, initSupabase, reloadSchemaCache } from '../services/supabaseService';
import { getIflytekConfig, saveIflytekConfig } from '../services/iflytekService';
import { CustomFieldDefinition, EntityType, FieldType, AIModelType } from '../types';

interface AdminPanelProps {
  fieldDefinitions?: CustomFieldDefinition[];
  setFieldDefinitions?: React.Dispatch<React.SetStateAction<CustomFieldDefinition[]>>;
  onConfigSave?: () => void;
}

const AI_MODEL_KEY = 'visitpro_ai_model';
const DEEPSEEK_KEY_KEY = 'visitpro_deepseek_key';

const EnvStatusRow = ({ label, value, isSecret }: { label: string, value: string | undefined, isSecret: boolean }) => {
    const isLoaded = !!value && value !== 'undefined';
    return (
        <div className="flex items-center justify-between p-2 border-b border-slate-50 last:border-0">
            <span className="text-slate-600 font-medium">{label}</span>
            <div className="flex items-center">
                {isLoaded ? (
                    <span className="flex items-center text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-mono">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        {isSecret ? '已加载 (隐藏)' : value}
                    </span>
                ) : (
                    <span className="flex items-center text-slate-400 bg-slate-100 px-2 py-0.5 rounded text-xs font-mono">
                        <X className="w-3 h-3 mr-1" />
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
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isReloadingCache, setIsReloadingCache] = useState(false);
  
  // AI Config State
  const [aiModel, setAiModel] = useState<AIModelType>('gemini');
  const [deepseekKey, setDeepseekKey] = useState('');
  
  // iFlytek State
  const [iflytekAppId, setIflytekAppId] = useState('');
  const [iflytekApiSecret, setIflytekApiSecret] = useState('');
  const [iflytekApiKey, setIflytekApiKey] = useState('');
  const [iflytekDomain, setIflytekDomain] = useState('generalv3.5');
  const [iflytekSttDomain, setIflytekSttDomain] = useState('iat');
  
  // Custom Field State
  const [activeTab, setActiveTab] = useState<EntityType>('CLIENT');
  
  // Form State
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldOptions, setFieldOptions] = useState('');

  const isSupabaseEnvConfigured = !!process.env.SUPABASE_URL && process.env.SUPABASE_URL !== 'undefined';
  const isDeepSeekEnvConfigured = !!process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY !== 'undefined';
  const isIflytekEnvConfigured = !!process.env.IFLYTEK_APP_ID && process.env.IFLYTEK_APP_ID !== 'undefined';

  useEffect(() => {
    if (!isSupabaseEnvConfigured) {
      const config = getStoredConfig();
      setSbUrl(config.url || 'https://gdrruugeqttiyufqqaug.supabase.co');
      setSbKey(config.key || 'sb_publishable_h_ehiKEEFGHT7iw0IDKFQQ_jDjuXY5u');
    }
    
    // Load iFlytek Config (Load from local storage if env not present, else blank for controlled input)
    if (!isIflytekEnvConfigured) {
        const iflyConfig = getIflytekConfig();
        setIflytekAppId(iflyConfig.appId || '8cc61805');
        setIflytekApiSecret(iflyConfig.apiSecret || 'MjU5OTkzOWMyN2ZiNDhlMDNkNjdjMDli');
        setIflytekApiKey(iflyConfig.apiKey || 'ffed16b33a183c42c3b989d5306f0d75');
        setIflytekDomain(iflyConfig.domain || 'generalv3.5');
        setIflytekSttDomain(iflyConfig.sttDomain || 'iat');
    }

    // Load AI Config
    setAiModel((localStorage.getItem(AI_MODEL_KEY) as AIModelType) || 'gemini');
    if (!isDeepSeekEnvConfigured) {
        setDeepseekKey(localStorage.getItem(DEEPSEEK_KEY_KEY) || '');
    }
  }, [isSupabaseEnvConfigured, isIflytekEnvConfigured, isDeepSeekEnvConfigured]);

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

  const handleSaveSupabase = async () => {
    saveConfig(sbUrl, sbKey);
    const client = initSupabase();
    if (client) {
      // Simple test query
      const { error } = await client.from('clients').select('id').limit(1);
      if (!error) {
        setConnectionStatus('success');
        if (onConfigSave) {
          onConfigSave();
        }
      } else {
        console.error(error);
        setConnectionStatus('error');
      }
    } else {
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

  const handleSaveAIConfig = () => {
      localStorage.setItem(AI_MODEL_KEY, aiModel);
      if (!isDeepSeekEnvConfigured) {
          localStorage.setItem(DEEPSEEK_KEY_KEY, deepseekKey.trim());
      }
      alert("AI 模型配置已更新");
  };

  const handleEditClick = (field: CustomFieldDefinition) => {
    setEditingFieldId(field.id);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setFieldOptions(field.options?.join(', ') || '');
    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveField = () => {
    if (!fieldLabel.trim()) {
      alert("请输入字段显示名称");
      return;
    }

    if (editingFieldId) {
      // --- UPDATE EXISTING ---
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
      // --- CREATE NEW ---
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

  return (
    <div className="max-w-3xl mx-auto pb-10">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <Settings className="w-6 h-6 mr-3 text-slate-400" />
        系统配置
      </h2>

      <div className="space-y-6">

        {/* AI Model Configuration */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
             <BrainCircuit className="w-5 h-5 mr-2 text-indigo-600" />
             AI 大模型配置
           </h3>
           <div className="space-y-4">
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">默认分析模型</label>
                 <select 
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value as AIModelType)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                 >
                    <option value="gemini">Google Gemini 3 (Flash)</option>
                    <option value="deepseek">DeepSeek (V3)</option>
                    <option value="spark">讯飞星火 (Spark Desk)</option>
                 </select>
                 <p className="text-xs text-slate-400 mt-1">
                    选择用于经营分析、拜访总结和邮件生成的后台模型。
                    {aiModel === 'gemini' && <span className="text-emerald-600 ml-1">Gemini Key 已通过环境变量配置。</span>}
                 </p>
              </div>

              {aiModel === 'deepseek' && (
                  <div className="animate-fade-in-down">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        DeepSeek API Key
                        <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs ml-2 font-normal">
                            (获取 Key)
                        </a>
                    </label>
                    {isDeepSeekEnvConfigured ? (
                        <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center text-sm text-emerald-800">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            API Key 已通过环境变量 (DEEPSEEK_API_KEY) 配置
                        </div>
                    ) : (
                        <input 
                            type="password" 
                            value={deepseekKey}
                            onChange={(e) => setDeepseekKey(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="sk-..."
                        />
                    )}
                  </div>
              )}

              {aiModel === 'spark' && (
                  <div className="animate-fade-in-down p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
                     讯飞星火模型将复用下方的“科大讯飞语音配置”中的 AppID、API Key 和 API Secret。请确保下方的 Domain 参数正确（推荐 generalv3.5）。
                  </div>
              )}

              <div className="flex justify-end pt-2">
                 <button 
                  onClick={handleSaveAIConfig}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
                 >
                   保存 AI 模型设置
                 </button>
              </div>
           </div>
        </section>
        
        {/* Custom Field Configuration */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <List className="w-5 h-5 mr-2 text-indigo-600" />
            自定义字段管理
          </h3>
          
          <div className="flex space-x-2 mb-4 border-b border-slate-100 pb-1">
            {(['CLIENT', 'VISIT', 'USER'] as EntityType[]).map(type => (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === type 
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' 
                    : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                {type === 'CLIENT' ? '客户字段' : type === 'VISIT' ? '拜访记录字段' : '用户字段'}
              </button>
            ))}
          </div>

          {/* Add/Edit Field Form */}
          <div className={`p-4 rounded-xl mb-4 border transition-colors ${editingFieldId ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex justify-between items-center mb-3">
              <h4 className={`text-xs font-bold uppercase ${editingFieldId ? 'text-amber-600' : 'text-slate-500'}`}>
                {editingFieldId ? '编辑字段' : '添加新字段'}
              </h4>
              {editingFieldId && (
                <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-700 flex items-center">
                  <X className="w-3 h-3 mr-1" /> 取消编辑
                </button>
              )}
            </div>
            
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-slate-500 mb-1">显示名称</label>
                <input 
                  type="text" 
                  value={fieldLabel}
                  onChange={e => setFieldLabel(e.target.value)}
                  placeholder="例如：合同编号"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-slate-500 mb-1">类型</label>
                <select 
                  value={fieldType}
                  onChange={e => setFieldType(e.target.value as FieldType)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="text">文本</option>
                  <option value="number">数字</option>
                  <option value="date">日期</option>
                  <option value="select">选项列表</option>
                </select>
              </div>
              {fieldType === 'select' && (
                <div className="flex-1 w-full">
                  <label className="block text-xs text-slate-500 mb-1">选项 (逗号分隔)</label>
                  <input 
                    type="text" 
                    value={fieldOptions}
                    onChange={e => setFieldOptions(e.target.value)}
                    placeholder="例如：A级, B级, C级"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
              <button 
                onClick={handleSaveField}
                className={`${editingFieldId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center h-[38px] min-w-[80px] justify-center transition-colors`}
              >
                {editingFieldId ? <RefreshCw className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
                {editingFieldId ? '更新' : '添加'}
              </button>
            </div>
          </div>

          {/* Existing Fields List */}
          <div className="space-y-2">
            {fieldDefinitions.filter(f => f.entityType === activeTab).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">暂无自定义字段</p>
            ) : (
              fieldDefinitions.filter(f => f.entityType === activeTab).map(field => (
                <div 
                  key={field.id} 
                  className={`flex items-center justify-between p-3 bg-white border rounded-lg group transition-colors ${editingFieldId === field.id ? 'border-amber-400 ring-1 ring-amber-100' : 'border-slate-100'}`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-medium text-slate-700 text-sm">{field.label}</span>
                    <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-500 rounded font-mono" title="系统内部标识 (Key)">{field.key}</span>
                    <span className="text-xs text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded">
                      {field.type === 'select' ? '选项列表' : field.type === 'date' ? '日期' : field.type === 'number' ? '数字' : '文本'}
                    </span>
                    {field.type === 'select' && field.options && (
                      <span className="text-xs text-slate-400 truncate max-w-[200px]">
                        [{field.options.join(', ')}]
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEditClick(field)}
                      className="text-slate-400 hover:text-indigo-600 p-1.5 hover:bg-indigo-50 rounded"
                      title="编辑"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteField(field.id)}
                      className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
        
        {/* iFlytek Configuration */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Mic className="w-5 h-5 mr-2 text-indigo-600" />
            科大讯飞语音/大模型配置 (iFlytek)
          </h3>
          {isIflytekEnvConfigured ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start justify-between">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-3 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-emerald-900 text-sm">已通过环境变量配置</h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      系统已检测到 `IFLYTEK_APP_ID` 等变量。本地配置界面已禁用。
                    </p>
                  </div>
                </div>
              </div>
          ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">APP ID</label>
                  <input 
                    type="text" 
                    value={iflytekAppId}
                    onChange={(e) => setIflytekAppId(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="例如: 12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                  <input 
                    type="password" 
                    value={iflytekApiKey}
                    onChange={(e) => setIflytekApiKey(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="API Key"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">API Secret</label>
                  <input 
                    type="password" 
                    value={iflytekApiSecret}
                    onChange={(e) => setIflytekApiSecret(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="API Secret"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">大模型版本 (Domain)</label>
                      <input 
                        type="text" 
                        value={iflytekDomain}
                        onChange={(e) => setIflytekDomain(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="默认: generalv3.5 (Spark Max)"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                         用于“星火大模型”分析功能。推荐 <code>generalv3.5</code>。
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">语音转文字模型</label>
                      <select 
                        value={iflytekSttDomain}
                        onChange={(e) => setIflytekSttDomain(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="iat">通用标准版 (iat)</option>
                        <option value="pro_iat">极速语音转大模型 (pro_iat)</option>
                        <option value="general_fast">实时语音转写大模型 (general_fast)</option>
                      </select>
                      <p className="text-xs text-slate-400 mt-1">
                         用于实时语音听写功能。推荐使用 <code>general_fast</code> 以获得更好的体验。
                      </p>
                    </div>
                </div>

                <div className="flex justify-end pt-2">
                   <button 
                    onClick={handleSaveIflytek}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
                   >
                     保存讯飞配置
                   </button>
                </div>
              </div>
          )}
        </section>

        {/* Database */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-indigo-600" />
            数据与存储 (Supabase)
          </h3>
          
          <div className="space-y-4">
            {isSupabaseEnvConfigured ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start justify-between">
                <div className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mr-3 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-emerald-900 text-sm">已通过环境变量配置</h4>
                    <p className="text-xs text-emerald-700 mt-1">
                      系统已检测到 `process.env.SUPABASE_URL`。本地配置界面已禁用。
                    </p>
                  </div>
                </div>
                <button 
                   onClick={handleReloadSchemaCache}
                   disabled={isReloadingCache}
                   className="text-xs flex items-center text-emerald-700 hover:text-emerald-900 bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                   <RefreshCw className={`w-3 h-3 mr-1 ${isReloadingCache ? 'animate-spin' : ''}`} />
                   刷新数据库缓存
                </button>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Project URL</label>
                  <input 
                    type="text" 
                    placeholder="https://xyz.supabase.co"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Anon API Key</label>
                  <input 
                    type="password" 
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                
                <div className="flex items-center justify-between pt-2">
                   <div className="flex items-center">
                     {connectionStatus === 'success' && <span className="text-xs text-emerald-600 flex items-center"><CheckCircle className="w-4 h-4 mr-1"/> 连接成功</span>}
                     {connectionStatus === 'error' && <span className="text-xs text-red-600 flex items-center"><AlertCircle className="w-4 h-4 mr-1"/> 连接失败，请检查配置</span>}
                   </div>
                   <div className="flex space-x-2">
                     <button 
                        onClick={handleReloadSchemaCache}
                        disabled={isReloadingCache || !sbUrl || !sbKey}
                        className="text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center"
                        title="解决 'Column not found' 错误"
                     >
                        <RefreshCw className={`w-4 h-4 mr-1 ${isReloadingCache ? 'animate-spin' : ''}`} />
                        刷新缓存
                     </button>
                     <button 
                      onClick={handleSaveSupabase}
                      className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
                     >
                       保存并连接
                     </button>
                   </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Permissions */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
           <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Shield className="w-5 h-5 mr-2 text-indigo-600" />
            访问控制
          </h3>
           <div className="space-y-3">
             <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                <span className="text-sm text-slate-700">启用团队主管管理面板</span>
                <div className="w-10 h-5 bg-indigo-600 rounded-full relative cursor-pointer">
                  <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                </div>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">允许本地音频存储</span>
                <div className="w-10 h-5 bg-slate-200 rounded-full relative cursor-pointer">
                   <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                </div>
             </div>
           </div>
        </section>

        {/* Environment Diagnostics (New Section) */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6">
           <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
             <Cpu className="w-5 h-5 mr-2 text-indigo-600" />
             环境变量诊断
           </h3>
           <div className="bg-slate-50 rounded-xl border border-slate-200 text-sm overflow-hidden">
              <EnvStatusRow label="SUPABASE_URL" value={process.env.SUPABASE_URL} isSecret={false} />
              <EnvStatusRow label="SUPABASE_KEY" value={process.env.SUPABASE_KEY} isSecret={true} />
              <EnvStatusRow label="API_KEY (Gemini)" value={process.env.API_KEY} isSecret={true} />
              <EnvStatusRow label="DEEPSEEK_API_KEY" value={process.env.DEEPSEEK_API_KEY} isSecret={true} />
              <EnvStatusRow label="IFLYTEK_APP_ID" value={process.env.IFLYTEK_APP_ID} isSecret={false} />
           </div>
           <p className="text-xs text-slate-400 mt-4 flex items-center">
              <AlertCircle className="w-4 h-4 mr-1 text-amber-500" />
              注意：修改 .env 文件后，必须 <strong>重启开发服务器</strong> (终端 Ctrl+C 然后再次 npm run dev) 才能生效。
           </p>
        </section>
      </div>
    </div>
  );
};