import React, { useState, useEffect } from 'react';
import { Settings, Save, Database, Shield, Cpu, CheckCircle, AlertCircle, Plus, Trash2, List, Edit2, X, RefreshCw, Mic, Palette } from 'lucide-react';
import { getStoredConfig, saveConfig, initSupabase } from '../services/supabaseService';
import { getIflytekConfig, saveIflytekConfig } from '../services/iflytekService';
import { CustomFieldDefinition, EntityType, FieldType } from '../types';

interface AdminPanelProps {
  fieldDefinitions?: CustomFieldDefinition[];
  setFieldDefinitions?: React.Dispatch<React.SetStateAction<CustomFieldDefinition[]>>;
  onConfigSave?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ 
  fieldDefinitions = [], 
  setFieldDefinitions = (_: any) => {},
  onConfigSave
}) => {
  const [sbUrl, setSbUrl] = useState('');
  const [sbKey, setSbKey] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
  // iFlytek State
  const [iflytekAppId, setIflytekAppId] = useState('');
  const [iflytekApiSecret, setIflytekApiSecret] = useState('');
  const [iflytekApiKey, setIflytekApiKey] = useState('');
  const [iflytekDomain, setIflytekDomain] = useState('iat');
  
  // Custom Field State
  const [activeTab, setActiveTab] = useState<EntityType>('CLIENT');
  
  // Form State
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<FieldType>('text');
  const [fieldOptions, setFieldOptions] = useState('');

  const isEnvConfigured = !!process.env.SUPABASE_URL;

  useEffect(() => {
    if (!isEnvConfigured) {
      const config = getStoredConfig();
      // Use stored config or fallback to provided defaults for testing
      setSbUrl(config.url || 'https://gdrruugeqttiyufqqaug.supabase.co');
      setSbKey(config.key || 'sb_publishable_h_ehiKEEFGHT7iw0IDKFQQ_jDjuXY5u');
    }
    
    // Load iFlytek Config
    const iflyConfig = getIflytekConfig();
    // Use stored config or fallback to provided defaults for testing
    setIflytekAppId(iflyConfig.appId || '8cc61805');
    setIflytekApiSecret(iflyConfig.apiSecret || 'MjU5OTkzOWMyN2ZiNDhlMDNkNjdjMDli');
    setIflytekApiKey(iflyConfig.apiKey || 'ffed16b33a183c42c3b989d5306f0d75');
    setIflytekDomain(iflyConfig.domain || 'iat');
  }, [isEnvConfigured]);

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
  
  const handleSaveIflytek = () => {
    const appId = iflytekAppId.trim();
    const secret = iflytekApiSecret.trim();
    const key = iflytekApiKey.trim();
    const domain = iflytekDomain.trim();
    
    setIflytekAppId(appId);
    setIflytekApiSecret(secret);
    setIflytekApiKey(key);
    setIflytekDomain(domain);
    
    saveIflytekConfig(appId, secret, key, domain);
    alert("科大讯飞配置已保存");
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
            // Note: We DO NOT update the 'key' to prevent breaking existing data associations
          };
        }
        return f;
      }));
    } else {
      // --- CREATE NEW ---
      // Generate a simple key from label
      const key = fieldLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^\w]/g, '');
      
      // Check for duplicates
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
            科大讯飞语音配置 (iFlytek)
          </h3>
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">业务领域 (Domain)</label>
              <input 
                type="text" 
                value={iflytekDomain}
                onChange={(e) => setIflytekDomain(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="默认: iat, 可填 pro_large 等"
              />
              <p className="text-xs text-slate-400 mt-1">
                 普通听写默认为 <code>iat</code>。如购买了极速超脑或特定模型，请参考讯飞文档填写对应 domain 参数。
              </p>
            </div>
            <div className="flex justify-end pt-2">
               <button 
                onClick={handleSaveIflytek}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
               >
                 保存配置
               </button>
            </div>
          </div>
        </section>

        {/* Database */}
        <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-indigo-600" />
            数据与存储 (Supabase)
          </h3>
          
          <div className="space-y-4">
            {isEnvConfigured ? (
              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start">
                <CheckCircle className="w-5 h-5 text-emerald-600 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">已通过环境变量配置</h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    系统已检测到 `process.env.SUPABASE_URL`。本地配置界面已禁用。
                  </p>
                </div>
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
                   <button 
                    onClick={handleSaveSupabase}
                    className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700"
                   >
                     保存并连接
                   </button>
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
      </div>
    </div>
  );
};