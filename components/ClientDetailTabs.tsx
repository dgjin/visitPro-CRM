// ==========================================
// 客户详情 Tab 区：基本信息 / 企业画像 / 股权画像 / 联系人
// 自 ClientManager.tsx 拆分（P2 组件分层），状态与逻辑随迁
// ==========================================
import React, { useState, useEffect } from 'react';
import { Client, ClientType, TypeProfile, AgreementInfo, ProjectInfo, CustomFieldDefinition, Contact, Shareholder, Subsidiary, AIModelType } from '../types';
import {
  Search, Plus, MapPin, Mail, Phone, Building, Briefcase,
  X, Loader2, BarChart2, Users, Save, Edit2, Trash2, PieChart as PieIcon,
  Contact as ContactIcon,
  ChevronRight,
  ChevronLeft,
  User as UserIcon,
  Maximize2,
  Minimize2,
  Share2,
  LayoutGrid,
  ArrowDown,
  RefreshCw,
  ArrowLeft,
  MoreHorizontal,
  CheckSquare,
  Square as SquareIcon,
  Download,
  ArrowRight,
  Tag,
  Shield,
  Filter,
  Landmark,
  FileText,
  ClipboardCheck
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { generateClientProfile } from '../services/geminiService';

export const NATIONAL_STANDARD_INDUSTRIES = [
  "农、林、牧、渔业",
  "采矿业",
  "制造业",
  "电力、热力、燃气及水生产和供应业",
  "建筑业",
  "批发和零售业",
  "交通运输、仓储和邮政业",
  "住宿和餐饮业",
  "信息传输、软件和信息技术服务业",
  "金融业",
  "房地产业",
  "租赁和商务服务业",
  "科学研究和技术服务业",
  "水利、环境和公共设施管理业",
  "居民服务、修理和其他服务业",
  "教育",
  "卫生和社会工作",
  "文化、体育和娱乐业",
  "公共管理、社会保障和社会组织",
  "国际组织"
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
export const CLIENT_TYPES: ClientType[] = ['地方政府', '金融机构', '产业客户'];
const ADMIN_LEVELS = ['正部级', '副部级', '正厅级', '副厅级', '正处级', '副处级'];

const FIN_CATEGORIES = ['银行', '证券', '保险', '信托', '金融租赁', '其他'];

const FIN_SUB_CATEGORIES = [
  '国有大型商业银行-分行',
  '全国性股份制商业银行-分行',
  '政策性银行',
  '城市商业银行',
  '农村金融机构',
  '寿险',
  '财险',
  '其他',
];

const ENT_CATEGORIES = ['省属国企', '市属国企', '央企', '民营', '外资', '高校全资企业', '其他'];

const CREDIT_RATINGS = ['AAA', 'AA+', 'AA', 'AA-', 'A及以下', '无'];

const EquityStructureMap = ({ 
  clientName, 
  shareholders, 
  subsidiaries,
  onSelectShareholder,
  onSelectSubsidiary,
  selectedType,
  selectedIndex,
  readOnly = false
}: { 
  clientName: string; 
  shareholders: Shareholder[]; 
  subsidiaries: Subsidiary[];
  onSelectShareholder: (index: number) => void;
  onSelectSubsidiary: (index: number) => void;
  selectedType: 'shareholder' | 'subsidiary' | null;
  selectedIndex: number | null;
  readOnly?: boolean;
}) => {
  const width = 800;
  const height = 600;
  const cx = width / 2;
  const cy = height / 2;
  
  const calculatePositions = (count: number, radius: number, isTop: boolean) => {
    if (count === 0) return [];
    const spread = Math.min(Math.PI * 0.8, count * (Math.PI / 4)); 
    const startAngle = isTop ? -Math.PI / 2 - spread / 2 : Math.PI / 2 - spread / 2;
    const step = spread / (count > 1 ? count - 1 : 1);
    
    return Array.from({ length: count }).map((_, i) => {
       const angle = count === 1 ? (isTop ? -Math.PI / 2 : Math.PI / 2) : startAngle + i * step;
       return {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle)
       };
    });
  };

  const shareholderPositions = calculatePositions(shareholders.length, 180, true);
  const subsidiaryPositions = calculatePositions(subsidiaries.length, 180, false);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="select-none font-sans" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="28" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
        </marker>
        <marker id="arrowhead-reverse" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" fill="#94a3b8" />
        </marker>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.1"/>
        </filter>
      </defs>
      
      {/* --- Connecting Lines --- */}
      
      {/* Shareholders -> Client (Top Down) */}
      {shareholderPositions.map((pos, i) => {
         const isSelected = selectedType === 'shareholder' && selectedIndex === i;
         return (
            <line 
               key={`line-sh-${i}`}
               x1={pos.x} y1={pos.y} x2={cx} y2={cy}
               stroke={isSelected ? "var(--primary-500)" : "var(--border)"}
               strokeWidth={isSelected ? "2" : "1"}
               markerEnd="url(#arrowhead)"
            />
         );
      })}

      {/* Client -> Subsidiaries (Center Down) */}
      {subsidiaryPositions.map((pos, i) => {
         const isSelected = selectedType === 'subsidiary' && selectedIndex === i;
         return (
            <line 
               key={`line-sub-${i}`}
               x1={cx} y1={cy} x2={pos.x} y2={pos.y}
               stroke={isSelected ? "var(--success)" : "var(--border)"}
               strokeWidth={isSelected ? "2" : "1"}
               markerEnd="url(#arrowhead)"
            />
         );
      })}

      {/* --- Nodes --- */}

      {/* Center Node (Client) */}
      <g filter="url(#shadow)">
        <rect x={cx - 60} y={cy - 25} width="120" height="50" rx="25" fill="white" stroke="var(--primary-600)" strokeWidth="3" />
        <foreignObject x={cx - 55} y={cy - 20} width="110" height="40">
           <div className="flex flex-col items-center justify-center h-full text-center">
             <div className="text-[10px] font-bold text-[var(--text-primary)] leading-tight line-clamp-2">{clientName}</div>
           </div>
        </foreignObject>
      </g>

      {/* Shareholder Nodes */}
      {shareholders.map((s, i) => {
         const pos = shareholderPositions[i];
         const isSelected = selectedType === 'shareholder' && selectedIndex === i;
         const isInst = s.type === 'institution';
         
         return (
            <g 
              key={`node-sh-${i}`} 
              onClick={(e) => { e.stopPropagation(); if(!readOnly) onSelectShareholder(i); }} 
              className={`transition-all ${readOnly ? '' : 'cursor-pointer hover:opacity-90'}`}
              filter="url(#shadow)"
            >
               <circle 
                  cx={pos.x} cy={pos.y} r="30" 
                  fill={isInst ? (isSelected ? 'var(--primary-100)' : 'var(--primary-50)') : (isSelected ? '#ffe4e6' : '#fff1f2')}
                  stroke={isInst ? 'var(--primary-500)' : '#f43f5e'}
                  strokeWidth={isSelected ? "3" : "1.5"}
               />
               <foreignObject x={pos.x - 28} y={pos.y - 28} width="56" height="56" className="pointer-events-none">
                 <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-[9px] font-bold text-[var(--text-primary)] text-center leading-tight line-clamp-2 w-full mb-0.5">
                       {s.name}
                    </div>
                    <div className="text-[9px] text-[var(--text-secondary)] font-mono bg-white/50 px-1 rounded">
                       {s.percentage}%
                    </div>
                 </div>
               </foreignObject>
            </g>
         );
      })}

      {/* Subsidiary Nodes */}
      {subsidiaries.map((s, i) => {
         const pos = subsidiaryPositions[i];
         const isSelected = selectedType === 'subsidiary' && selectedIndex === i;
         
         return (
            <g 
              key={`node-sub-${i}`} 
              onClick={(e) => { e.stopPropagation(); if(!readOnly) onSelectSubsidiary(i); }} 
              className={`transition-all ${readOnly ? '' : 'cursor-pointer hover:opacity-90'}`}
              filter="url(#shadow)"
            >
               <rect 
                  x={pos.x - 40} y={pos.y - 20} width="80" height="40" rx="8"
                  fill={isSelected ? 'var(--success-light)' : '#ecfdf5'}
                  stroke="var(--success)"
                  strokeWidth={isSelected ? "2.5" : "1.5"}
               />
               <foreignObject x={pos.x - 38} y={pos.y - 18} width="76" height="36" className="pointer-events-none">
                 <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-[9px] font-bold text-emerald-900 text-center leading-tight line-clamp-1 w-full">
                       {s.name}
                    </div>
                    <div className="text-[8px] text-emerald-700 font-mono mt-0.5">
                       持股 {s.percentage}%
                    </div>
                 </div>
               </foreignObject>
            </g>
         );
      })}

      {/* Legends/Labels */}
      <text x={20} y={30} className="text-xs fill-[var(--text-tertiary)] font-bold uppercase">股东 (上游)</text>
      <text x={20} y={height - 20} className="text-xs fill-[var(--text-tertiary)] font-bold uppercase">对外投资 (下游)</text>

      {/* Empty State Text */}
      {shareholders.length === 0 && subsidiaries.length === 0 && (
         <text x={cx} y={cy + 60} textAnchor="middle" className="text-sm fill-[var(--text-tertiary)]">
           暂无股权数据
         </text>
      )}
    </svg>
  );
};

export const ClientDetailTabs: React.FC<{
  client: Client;
  update: (fn: (prev: Client) => Client | null) => void;
  isReadOnly: boolean;
  fieldDefinitions: CustomFieldDefinition[];
  isSaving: boolean;
  onSave: () => void;
}> = ({ client, update, isReadOnly, fieldDefinitions, isSaving, onSave }) => {
  // 别名：保持迁移代码零改动
  const selectedClient = client;
  const setSelectedClient = (arg: Client | null | ((prev: Client) => Client | null)) =>
    update(typeof arg === 'function' ? arg : () => arg);
  const handleSaveClient = onSave;

  const [activeTab, setActiveTab] = useState<'BASIC' | 'PROFILE' | 'EQUITY' | 'CONTACTS'>('BASIC');
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [fullscreenSection, setFullscreenSection] = useState<'FINANCIAL' | 'SUPPLY' | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [tempContact, setTempContact] = useState<Partial<Contact>>({});
  const [visualMode, setVisualMode] = useState<'MAP' | 'PIE'>('MAP');
  const [selectedEquityType, setSelectedEquityType] = useState<'shareholder' | 'subsidiary' | null>(null);
  const [selectedEquityIndex, setSelectedEquityIndex] = useState<number | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState<AIModelType>('ollama');

  useEffect(() => {
      const savedModel = localStorage.getItem('visitpro_ai_model') as AIModelType;
      if (savedModel) {
          setSelectedAiModel(savedModel);
      }
  }, []);

  // 更新类型专属信息项
  const updateTypeProfile = (patch: Partial<TypeProfile>) => {
    if (isReadOnly) return;
    setSelectedClient(prev => prev ? {
      ...prev,
      typeProfile: { ...(prev.typeProfile || {}), ...patch }
    } : null);
  };

  // 更新协议签署信息（客户层）
  const updateAgreement = (patch: Partial<AgreementInfo>) => {
    if (isReadOnly) return;
    setSelectedClient(prev => prev ? {
      ...prev,
      typeProfile: {
        ...(prev.typeProfile || {}),
        agreement: { ...(prev.typeProfile?.agreement || {}), ...patch }
      }
    } : null);
  };

  // 更新落地项目信息（客户层）
  const updateProject = (patch: Partial<ProjectInfo>) => {
    if (isReadOnly) return;
    setSelectedClient(prev => prev ? {
      ...prev,
      typeProfile: {
        ...(prev.typeProfile || {}),
        project: { ...(prev.typeProfile?.project || {}), ...patch }
      }
    } : null);
  };

  const handleGenerateProfile = async () => {
    if (!selectedClient || isReadOnly) return;
    setIsProfileLoading(true);
    try {
      const profile = await generateClientProfile(selectedClient.name, selectedClient.industry, selectedClient.region, selectedAiModel);
      setSelectedClient(prev => prev ? {
        ...prev,
        equityStructure: profile.equity,
        subsidiaries: profile.subsidiaries,
        financialAnalysis: profile.financials,
        supplyChainInfo: profile.supplyChain,
        tags: profile.tags || [],
      } : null);
      setVisualMode('MAP');
    } catch (e: any) {
      alert(e.message || "生成画像失败，请检查AI配置和网络连接。");
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleUpdateCustomField = (key: string, value: any, type: string = 'text') => {
    if (!selectedClient || isReadOnly) return;
    
    let finalValue = value;
    if (type === 'number') {
         finalValue = value === '' ? null : Number(value);
    }
    
    setSelectedClient(prev => prev ? {
      ...prev,
      customFields: { ...prev.customFields, [key]: finalValue }
    } : null);
  };
  // --- Contact Handlers ---
  const handleAddContact = () => {
    if(isReadOnly) return;
    setTempContact({ id: Date.now().toString(), name: '', role: '', email: '', phone: '' });
    setEditingContactId('NEW');
  };

  const handleEditContact = (contact: Contact) => {
    if(isReadOnly) return;
    setTempContact(contact);
    setEditingContactId(contact.id);
  };

  const handleSaveContact = () => {
    if (!selectedClient || !tempContact.name || isReadOnly) return;
    
    const newContact = tempContact as Contact;
    let newContacts = [...selectedClient.contacts];

    if (editingContactId === 'NEW') {
       newContacts.push(newContact);
    } else {
       newContacts = newContacts.map(c => c.id === editingContactId ? newContact : c);
    }

    setSelectedClient({ ...selectedClient, contacts: newContacts });
    setEditingContactId(null);
    setTempContact({});
  };

  const handleDeleteContact = (id: string) => {
    if (!selectedClient || isReadOnly) return;
    if (!confirm("确认删除此联系人？")) return;
    setSelectedClient({
       ...selectedClient,
       contacts: selectedClient.contacts.filter(c => c.id !== id)
    });
  };

  // --- Equity Handlers ---
  const handleAddShareholder = () => {
     if (!selectedClient || isReadOnly) return;
     const list = selectedClient.equityStructure || [];
     const newIndex = list.length;
     setSelectedClient({
        ...selectedClient,
        equityStructure: [...list, { name: '新股东', percentage: 0, type: 'individual' }]
     });
     setSelectedEquityType('shareholder');
     setSelectedEquityIndex(newIndex);
  };

  const handleUpdateShareholder = (index: number, field: keyof Shareholder, value: any) => {
     if (!selectedClient || !selectedClient.equityStructure || isReadOnly) return;
     const newList = [...selectedClient.equityStructure];
     newList[index] = { ...newList[index], [field]: value };
     setSelectedClient({ ...selectedClient, equityStructure: newList });
  };

  const handleDeleteShareholder = (index: number) => {
     if (!selectedClient || !selectedClient.equityStructure || isReadOnly) return;
     const newList = [...selectedClient.equityStructure];
     newList.splice(index, 1);
     setSelectedClient({ ...selectedClient, equityStructure: newList });
     if (selectedEquityType === 'shareholder' && selectedEquityIndex === index) {
       setSelectedEquityType(null);
       setSelectedEquityIndex(null);
     }
  };

  const handleAddSubsidiary = () => {
     if (!selectedClient || isReadOnly) return;
     const list = selectedClient.subsidiaries || [];
     const newIndex = list.length;
     setSelectedClient({
        ...selectedClient,
        subsidiaries: [...list, { name: '新子公司', percentage: 100, industry: '未知' }]
     });
     setSelectedEquityType('subsidiary');
     setSelectedEquityIndex(newIndex);
  };

  const handleUpdateSubsidiary = (index: number, field: keyof Subsidiary, value: any) => {
     if (!selectedClient || !selectedClient.subsidiaries || isReadOnly) return;
     const newList = [...selectedClient.subsidiaries];
     newList[index] = { ...newList[index], [field]: value };
     setSelectedClient({ ...selectedClient, subsidiaries: newList });
  };

  return (
    <>
      {/* 工具栏：只读徽标 + Tab 切换 + 保存 */}
      <div className="flex justify-end items-center gap-3 px-5 py-3 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
                   <div className="flex items-center gap-3">
                      {isReadOnly && (
                          <div className="flex items-center gap-1.5 bg-[var(--warning-light)] text-[var(--warning)] text-xs px-3 py-1.5 rounded-full font-medium">
                              <Shield className="w-3.5 h-3.5" />
                              只读权限
                          </div>
                      )}
                      <div className="flex bg-[var(--bg-tertiary)] p-1 rounded-xl">
                         {(['BASIC', 'PROFILE', 'EQUITY', 'CONTACTS'] as const).map(tab => (
                            <button
                               key={tab}
                               onClick={() => setActiveTab(tab)}
                               className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? 'bg-[var(--bg-primary)] text-[var(--primary-600)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                               {tab === 'BASIC' && '基本信息'}
                               {tab === 'PROFILE' && '企业画像与财务分析'}
                               {tab === 'EQUITY' && '股权画像'}
                               {tab === 'CONTACTS' && '联系人'}
                            </button>
                         ))}
                      </div>
                      {!isReadOnly && (
                          <>
                            <div className="h-6 w-px bg-[var(--border)] mx-1"></div>
                            <button 
                                onClick={handleSaveClient} 
                                disabled={isSaving}
                                className="btn btn-primary"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                                保存
                            </button>
                          </>
                      )}
                      <button onClick={() => setSelectedClient(null)} className="p-2 text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                         <X className="w-5 h-5" />
                      </button>
                   </div>
                </div>
                {/* Modal Content */}
                <div className="flex-1 overflow-hidden bg-[var(--bg-secondary)] relative">
                   {activeTab === 'BASIC' && (
                      <div className="h-full overflow-y-auto p-6">
                         {/* 瀑布流布局：卡片按内容高度紧凑排布，避免行网格造成的纵向空隙 */}
                         <div className="columns-1 xl:columns-2 gap-6">
                               <div className="card p-5 mb-6 break-inside-avoid">
                                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                    <Building className="w-4 h-4 text-[var(--primary-500)]" />
                                    基础资料
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">客户类型 <span className="text-[var(--danger)]">*</span></label>
                                        <select 
                                           className="input"
                                           value={selectedClient.clientType || ''}
                                           onChange={e => setSelectedClient({...selectedClient, clientType: (e.target.value || undefined) as ClientType | undefined})}
                                           disabled={isReadOnly}
                                        >
                                           <option value="">请选择客户类型</option>
                                           {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                     </div>
                                     {selectedClient.clientType !== '地方政府' && (
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">所属行业</label>
                                        <select 
                                           className="input"
                                           value={selectedClient.industry}
                                           onChange={e => setSelectedClient({...selectedClient, industry: e.target.value})}
                                           disabled={isReadOnly}
                                        >
                                           {NATIONAL_STANDARD_INDUSTRIES.map(ind => (
                                              <option key={ind} value={ind}>{ind}</option>
                                           ))}
                                        </select>
                                     </div>
                                     )}
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">所在地区</label>
                                        <input 
                                           className="input"
                                           value={selectedClient.region}
                                           onChange={e => setSelectedClient({...selectedClient, region: e.target.value})}
                                           placeholder="例如：上海, 浦东新区"
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">重点客户</label>
                                        <select
                                           className="input"
                                           value={selectedClient.isKeyAccount === false ? '否' : '是'}
                                           onChange={e => setSelectedClient({...selectedClient, isKeyAccount: e.target.value === '是'})}
                                           disabled={isReadOnly}
                                        >
                                           <option value="是">是</option>
                                           <option value="否">否</option>
                                        </select>
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">是否新建客户</label>
                                        <select
                                           className="input"
                                           value={selectedClient.isNewClient === true ? '是' : '否'}
                                           onChange={e => setSelectedClient({...selectedClient, isNewClient: e.target.value === '是'})}
                                           disabled={isReadOnly}
                                        >
                                           <option value="是">是</option>
                                           <option value="否">否</option>
                                        </select>
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">所属团队</label>
                                        <input
                                           className="input"
                                           value={selectedClient.team || ''}
                                           onChange={e => setSelectedClient({...selectedClient, team: e.target.value})}
                                           placeholder="例如：政企一部"
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">清单分类</label>
                                        <select
                                           className="input"
                                           value={selectedClient.listCategory || ''}
                                           onChange={e => setSelectedClient({...selectedClient, listCategory: e.target.value})}
                                           disabled={isReadOnly}
                                        >
                                           <option value="">未分类</option>
                                           <option value="重点金融机构客户">重点金融机构客户</option>
                                           <option value="央国企客户">央国企客户</option>
                                           <option value="新兴产业及未来产业">新兴产业及未来产业</option>
                                           <option value="其他实体类客户">其他实体类客户</option>
                                           <option value="政府法院类客户">政府法院类客户</option>
                                           <option value="协会、中介类客户">协会、中介类客户</option>
                                        </select>
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">负责人</label>
                                        <div className="flex items-center p-2.5 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)]">
                                            <UserIcon className="w-4 h-4 mr-2 text-[var(--text-tertiary)]" />
                                            {selectedClient.ownerName || '未指派'}
                                        </div>
                                        <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">负责人调整请前往「组织管理 → 客户负责人」</p>
                                     </div>
                                  </div>
                               </div>

                               {/* 类型专属信息 */}
                               {selectedClient.clientType && (
                               <div className="card p-5 mb-6 break-inside-avoid">
                                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                    <Landmark className="w-4 h-4 text-[var(--primary-500)]" />
                                    {selectedClient.clientType === '地方政府' ? '政府专属信息' : selectedClient.clientType === '金融机构' ? '金融机构专属信息' : '产业客户专属信息'}
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     {selectedClient.clientType === '地方政府' && (
                                        <>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">行政级别</label>
                                              <input
                                                 className="input"
                                                 list="admin-level-options"
                                                 value={selectedClient.typeProfile?.adminLevel || ''}
                                                 onChange={e => updateTypeProfile({ adminLevel: e.target.value })}
                                                 placeholder="例如：正厅级"
                                                 disabled={isReadOnly}
                                              />
                                              <datalist id="admin-level-options">
                                                 {ADMIN_LEVELS.map(l => <option key={l} value={l} />)}
                                              </datalist>
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">上报经营单位</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.reportingUnit || ''}
                                                 onChange={e => updateTypeProfile({ reportingUnit: e.target.value })}
                                                 placeholder="例如：安徽省分公司"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                        </>
                                     )}

                                     {selectedClient.clientType === '金融机构' && (
                                        <>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">客户类别</label>
                                              <select
                                                 className="input"
                                                 value={selectedClient.typeProfile?.finCategory || ''}
                                                 onChange={e => updateTypeProfile({ finCategory: e.target.value })}
                                                 disabled={isReadOnly}
                                              >
                                                 <option value="">请选择</option>
                                                 {FIN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                              </select>
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">细分类别</label>
                                              <select
                                                 className="input"
                                                 value={selectedClient.typeProfile?.finSubCategory || ''}
                                                 onChange={e => updateTypeProfile({ finSubCategory: e.target.value })}
                                                 disabled={isReadOnly}
                                              >
                                                 <option value="">请选择</option>
                                                 {[...(selectedClient.typeProfile?.finSubCategory && !FIN_SUB_CATEGORIES.includes(selectedClient.typeProfile.finSubCategory) ? [selectedClient.typeProfile.finSubCategory] : []), ...FIN_SUB_CATEGORIES].map(c => <option key={c} value={c}>{c}</option>)}
                                              </select>
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">行业排名（如有）</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.finRank || ''}
                                                 onChange={e => updateTypeProfile({ finRank: e.target.value })}
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                        </>
                                     )}

                                     {selectedClient.clientType === '产业客户' && (
                                        <>
                                           <div className="md:col-span-2">
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">所属集团/单位/个人</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.groupOwner || ''}
                                                 onChange={e => updateTypeProfile({ groupOwner: e.target.value })}
                                                 placeholder="股权穿透至最上层的法人主体或自然人"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">客户类别</label>
                                              <select
                                                 className="input"
                                                 value={selectedClient.typeProfile?.entCategory || ''}
                                                 onChange={e => updateTypeProfile({ entCategory: e.target.value })}
                                                 disabled={isReadOnly}
                                              >
                                                 <option value="">请选择</option>
                                                 {[...(selectedClient.typeProfile?.entCategory && !ENT_CATEGORIES.includes(selectedClient.typeProfile.entCategory) ? [selectedClient.typeProfile.entCategory] : []), ...ENT_CATEGORIES].map(c => <option key={c} value={c}>{c}</option>)}
                                              </select>
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">所属行业门类</label>
                                              <select
                                                 className="input"
                                                 value={selectedClient.industry}
                                                 onChange={e => {
                                                    const v = e.target.value;
                                                    setSelectedClient(prev => prev ? {
                                                       ...prev,
                                                       industry: v,
                                                       typeProfile: { ...(prev.typeProfile || {}), industryCategory: v }
                                                    } : null);
                                                 }}
                                                 disabled={isReadOnly}
                                              >
                                                 {NATIONAL_STANDARD_INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                              </select>
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">所属行业小类</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.industrySub || ''}
                                                 onChange={e => updateTypeProfile({ industrySub: e.target.value })}
                                                 placeholder="国民经济行业分类第四层"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">行业代码</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.industryCode || ''}
                                                 onChange={e => updateTypeProfile({ industryCode: e.target.value })}
                                                 placeholder="如 L7212"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">主体评级</label>
                                              <select
                                                 className="input"
                                                 value={selectedClient.typeProfile?.creditRating || ''}
                                                 onChange={e => updateTypeProfile({ creditRating: e.target.value })}
                                                 disabled={isReadOnly}
                                              >
                                                 <option value="">请选择</option>
                                                 {[...(selectedClient.typeProfile?.creditRating && !CREDIT_RATINGS.includes(selectedClient.typeProfile.creditRating) ? [selectedClient.typeProfile.creditRating] : []), ...CREDIT_RATINGS].map(r => <option key={r} value={r}>{r}</option>)}
                                              </select>
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">世界/中企/民企500强排名</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.top500Rank || ''}
                                                 onChange={e => updateTypeProfile({ top500Rank: e.target.value })}
                                                 placeholder="如：中企500强第193位"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                        </>
                                     )}
                                  </div>
                               </div>
                               )}

                               {/* 工商基础信息（企业类客户） */}
                               {selectedClient.clientType && selectedClient.clientType !== '地方政府' && (
                               <div className="card p-5 mb-6 break-inside-avoid">
                                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                    <Building className="w-4 h-4 text-[var(--primary-500)]" />
                                    工商基础信息
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">统一社会信用代码</label>
                                        <input
                                           className="input"
                                           value={selectedClient.typeProfile?.creditCode || ''}
                                           onChange={e => updateTypeProfile({ creditCode: e.target.value })}
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">上市代码</label>
                                        <input
                                           className="input"
                                           value={selectedClient.typeProfile?.stockCode || ''}
                                           onChange={e => updateTypeProfile({ stockCode: e.target.value })}
                                           placeholder="如 601988.SH"
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">成立时间</label>
                                        <input
                                           type="date"
                                           className="input"
                                           value={selectedClient.typeProfile?.foundedDate?.slice(0, 10) || ''}
                                           onChange={e => updateTypeProfile({ foundedDate: e.target.value })}
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">第一大股东</label>
                                        <input
                                           className="input"
                                           value={selectedClient.typeProfile?.majorShareholder || ''}
                                           onChange={e => updateTypeProfile({ majorShareholder: e.target.value })}
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">第一大股东持股比例</label>
                                        <input
                                           className="input"
                                           value={selectedClient.typeProfile?.majorShareholderRatio || ''}
                                           onChange={e => updateTypeProfile({ majorShareholderRatio: e.target.value })}
                                           placeholder="如 58.59% 或 100%（国有独资）"
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">上报经营单位</label>
                                        <input
                                           className="input"
                                           value={selectedClient.typeProfile?.reportingUnit || ''}
                                           onChange={e => updateTypeProfile({ reportingUnit: e.target.value })}
                                           placeholder="例如：安徽省分公司"
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                  </div>
                               </div>
                               )}

                               {/* 协议与落地项目（客户层） */}
                               <div className="card p-5 mb-6 break-inside-avoid">
                                  <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                    <ClipboardCheck className="w-4 h-4 text-[var(--primary-500)]" />
                                    协议与落地项目
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">是否签署相关协议</label>
                                        <div className="flex gap-2">
                                           {[true, false].map(v => (
                                              <button
                                                 key={String(v)}
                                                 type="button"
                                                 disabled={isReadOnly}
                                                 onClick={() => updateAgreement({ signed: v })}
                                                 className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                    selectedClient.typeProfile?.agreement?.signed === v
                                                       ? 'bg-[var(--primary-600)] text-white border-[var(--primary-600)]'
                                                       : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]'
                                                 }`}
                                              >
                                                 {v ? '是' : '否'}
                                              </button>
                                           ))}
                                        </div>
                                     </div>
                                     {selectedClient.typeProfile?.agreement?.signed && (
                                        <>
                                           <div className="md:col-span-2">
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">协议签署主体</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.agreement?.party || ''}
                                                 onChange={e => updateAgreement({ party: e.target.value })}
                                                 placeholder="中国东方/XX分公司/XX子公司"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">协议签署时间</label>
                                              <input
                                                 type="date"
                                                 className="input"
                                                 value={selectedClient.typeProfile?.agreement?.signDate?.slice(0, 10) || ''}
                                                 onChange={e => updateAgreement({ signDate: e.target.value })}
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">协议到期时间</label>
                                              <input
                                                 type="date"
                                                 className="input"
                                                 value={selectedClient.typeProfile?.agreement?.expireDate?.slice(0, 10) || ''}
                                                 onChange={e => updateAgreement({ expireDate: e.target.value })}
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                        </>
                                     )}
                                     <div>
                                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">是否有落地项目</label>
                                        <div className="flex gap-2">
                                           {[true, false].map(v => (
                                              <button
                                                 key={String(v)}
                                                 type="button"
                                                 disabled={isReadOnly}
                                                 onClick={() => updateProject({ landed: v })}
                                                 className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                                    selectedClient.typeProfile?.project?.landed === v
                                                       ? 'bg-[var(--primary-600)] text-white border-[var(--primary-600)]'
                                                       : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--border)]'
                                                 }`}
                                              >
                                                 {v ? '是' : '否'}
                                              </button>
                                           ))}
                                        </div>
                                     </div>
                                     {selectedClient.typeProfile?.project?.landed && (
                                        <>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">项目编号</label>
                                              <input
                                                 className="input"
                                                 value={selectedClient.typeProfile?.project?.projectNo || ''}
                                                 onChange={e => updateProject({ projectNo: e.target.value })}
                                                 placeholder="多个编号用分号分隔"
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">落地规模（万元）</label>
                                              <input
                                                 type="number"
                                                 className="input"
                                                 value={selectedClient.typeProfile?.project?.scale ?? ''}
                                                 onChange={e => updateProject({ scale: e.target.value === '' ? undefined : Number(e.target.value) })}
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                           <div className="md:col-span-2">
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">项目名称</label>
                                              <textarea
                                                 className="input"
                                                 rows={2}
                                                 value={selectedClient.typeProfile?.project?.projectName || ''}
                                                 onChange={e => updateProject({ projectName: e.target.value })}
                                                 disabled={isReadOnly}
                                              />
                                           </div>
                                        </>
                                     )}
                                  </div>
                               </div>

                               {/* Custom Fields */}
                               {fieldDefinitions.length > 0 && (
                                  <div className="card p-5 mb-6 break-inside-avoid">
                                     <h4 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                                       <Filter className="w-4 h-4 text-[var(--primary-500)]" />
                                       自定义信息
                                     </h4>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {fieldDefinitions.map(field => (
                                           <div key={field.id}>
                                              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">{field.label}</label>
                                              {field.type === 'select' ? (
                                                 <select
                                                    className="input"
                                                    value={selectedClient.customFields?.[field.key] || ''}
                                                    onChange={e => handleUpdateCustomField(field.key, e.target.value, field.type)}
                                                    disabled={isReadOnly}
                                                 >
                                                    <option value="">请选择</option>
                                                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                 </select>
                                              ) : (
                                                 <input 
                                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                                    className="input"
                                                    value={selectedClient.customFields?.[field.key] || ''}
                                                    onChange={e => handleUpdateCustomField(field.key, e.target.value, field.type)}
                                                    disabled={isReadOnly}
                                                 />
                                              )}
                                           </div>
                                        ))}
                                     </div>
                                  </div>
                               )}
                            </div>
                      </div>
                   )}

                   {/* Profile Tab: 企业画像与财务分析 */}
                   {activeTab === 'PROFILE' && (
                      <div className="h-full overflow-y-auto p-6">
                         {/* Tags Section */}
                         <div className="mb-6 flex flex-wrap gap-2 animate-fade-in-down">
                            {selectedClient.tags && selectedClient.tags.length > 0 ? (
                                selectedClient.tags.map((tag, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-50)] border border-[var(--primary-200)] rounded-full text-xs text-[var(--primary-700)] font-medium">
                                        <Tag className="w-3 h-3 text-[var(--primary-500)]" />
                                        {tag}
                                        {!isReadOnly && (
                                            <button 
                                                onClick={() => {
                                                    const newTags = [...(selectedClient.tags || [])];
                                                    newTags.splice(idx, 1);
                                                    setSelectedClient({...selectedClient, tags: newTags});
                                                }}
                                                className="ml-1 text-[var(--primary-400)] hover:text-[var(--primary-600)] transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-[var(--text-tertiary)] flex items-center px-2 py-1 italic">
                                    <Tag className="w-3 h-3 mr-1.5 opacity-50" />
                                    暂无 AI 标签，点击"生成画像"自动获取
                                </div>
                            )}
                            {!isReadOnly && (
                                <button 
                                    onClick={() => {
                                        const tag = prompt("添加新标签:");
                                        if (tag) {
                                            setSelectedClient(prev => prev ? ({...prev, tags: [...(prev.tags || []), tag]}) : null);
                                        }
                                    }}
                                    className="flex items-center px-3 py-1.5 bg-[var(--bg-tertiary)] border border-transparent rounded-full text-xs text-[var(--text-secondary)] hover:bg-[var(--border)] hover:text-[var(--text-primary)] transition-colors"
                                >
                                    <Plus className="w-3 h-3 mr-1" /> 添加标签
                                </button>
                            )}
                         </div>

                         <div className="card p-6 flex flex-col">
                            <div className="flex justify-between items-center mb-5">
                               <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                                  <BarChart2 className="w-4 h-4 text-[var(--primary-500)]" />
                                  企业画像与财务分析
                               </h4>
                               {!isReadOnly && (
                                   <div className="flex items-center gap-2">
                                      <select
                                          value={selectedAiModel}
                                          onChange={(e) => setSelectedAiModel(e.target.value as AIModelType)}
                                          className="input py-1.5 px-3 text-xs w-32"
                                      >
                                          <option value="ollama">Ollama (本地)</option>
                                          <option value="gemini">Gemini</option>
                                          <option value="deepseek">DeepSeek</option>
                                          <option value="spark">讯飞星火</option>
                                          <option value="kimi">Kimi</option>
                                      </select>
                                      <button 
                                          onClick={handleGenerateProfile}
                                          disabled={isProfileLoading}
                                          className="btn btn-primary text-xs py-1.5"
                                      >
                                          {isProfileLoading ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                                          生成画像
                                      </button>
                                   </div>
                               )}
                            </div>
                            
                            <div className="grid grid-cols-1 gap-5">
                               <div className={`transition-all ${fullscreenSection === 'FINANCIAL' ? 'fixed inset-4 z-50 bg-[var(--bg-primary)] shadow-2xl p-6 rounded-2xl border border-[var(--border)]' : 'relative h-80 bg-[var(--bg-secondary)] p-5 rounded-xl border border-[var(--border-light)]'}`}>
                                  <div className="flex justify-between items-center mb-3">
                                     <h5 className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-2">
                                        <PieIcon className="w-4 h-4 text-[var(--primary-500)]" />
                                        财务分析
                                     </h5>
                                     <button 
                                        onClick={() => setFullscreenSection(fullscreenSection === 'FINANCIAL' ? null : 'FINANCIAL')}
                                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                                     >
                                        {fullscreenSection === 'FINANCIAL' ? <Minimize2 className="w-4 h-4 text-[var(--text-tertiary)]"/> : <Maximize2 className="w-4 h-4 text-[var(--text-tertiary)]"/>}
                                     </button>
                                  </div>
                                  <textarea 
                                     className="w-full h-[calc(100%-2.5rem)] bg-transparent resize-none focus:outline-none text-sm text-[var(--text-secondary)] leading-relaxed disabled:text-[var(--text-tertiary)]"
                                     value={selectedClient.financialAnalysis || ''}
                                     onChange={e => setSelectedClient({...selectedClient, financialAnalysis: e.target.value})}
                                     placeholder="点击生成画像获取财务分析..."
                                     disabled={isReadOnly}
                                  />
                               </div>
                               <div className={`transition-all ${fullscreenSection === 'SUPPLY' ? 'fixed inset-4 z-50 bg-[var(--bg-primary)] shadow-2xl p-6 rounded-2xl border border-[var(--border)]' : 'relative h-80 bg-[var(--bg-secondary)] p-5 rounded-xl border border-[var(--border-light)]'}`}>
                                  <div className="flex justify-between items-center mb-3">
                                     <h5 className="font-semibold text-[var(--text-primary)] text-sm flex items-center gap-2">
                                        <Share2 className="w-4 h-4 text-[var(--success)]" />
                                        供应链信息
                                     </h5>
                                     <button 
                                        onClick={() => setFullscreenSection(fullscreenSection === 'SUPPLY' ? null : 'SUPPLY')}
                                        className="p-1.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                                     >
                                        {fullscreenSection === 'SUPPLY' ? <Minimize2 className="w-4 h-4 text-[var(--text-tertiary)]"/> : <Maximize2 className="w-4 h-4 text-[var(--text-tertiary)]"/>}
                                     </button>
                                  </div>
                                  <textarea 
                                     className="w-full h-[calc(100%-2.5rem)] bg-transparent resize-none focus:outline-none text-sm text-[var(--text-secondary)] leading-relaxed disabled:text-[var(--text-tertiary)]"
                                     value={selectedClient.supplyChainInfo || ''}
                                     onChange={e => setSelectedClient({...selectedClient, supplyChainInfo: e.target.value})}
                                     placeholder="点击生成画像获取供应链信息..."
                                     disabled={isReadOnly}
                                  />
                               </div>
                            </div>
                         </div>
                      </div>
                   )}

                   {/* Equity Tab */}
                   {activeTab === 'EQUITY' && (
                      <div className="h-full flex flex-col md:flex-row">
                         {/* Visualization Panel */}
                         <div className={`relative transition-all duration-300 ${selectedEquityType && !isReadOnly ? 'w-full md:w-2/3' : 'w-full'} h-full bg-[var(--bg-tertiary)] flex items-center justify-center overflow-hidden`}>
                             <div className="absolute top-4 left-4 z-10 flex gap-1 bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border-light)] shadow-sm">
                                <button 
                                   onClick={() => setVisualMode('MAP')}
                                   className={`p-2 rounded-lg transition-colors ${visualMode === 'MAP' ? 'bg-[var(--primary-50)] text-[var(--primary-600)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                   title="关系图谱"
                                >
                                   <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button 
                                   onClick={() => setVisualMode('PIE')}
                                   className={`p-2 rounded-lg transition-colors ${visualMode === 'PIE' ? 'bg-[var(--primary-50)] text-[var(--primary-600)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                   title="占比图表"
                                >
                                   <PieIcon className="w-4 h-4" />
                                </button>
                             </div>
                             
                             {visualMode === 'MAP' && (
                                <div className="absolute bottom-4 left-4 z-10 bg-[var(--bg-primary)] p-3 rounded-xl border border-[var(--border-light)] shadow-sm text-xs space-y-2">
                                   <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-rose-100 border border-rose-400 mr-2"></span><span className="text-[var(--text-secondary)]">个人股东</span></div>
                                   <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-[var(--primary-100)] border border-[var(--primary-400)] mr-2"></span><span className="text-[var(--text-secondary)]">机构股东</span></div>
                                   <div className="flex items-center"><span className="w-3 h-2 bg-[var(--success-light)] border border-[var(--success)] mr-2"></span><span className="text-[var(--text-secondary)]">对外投资</span></div>
                                </div>
                             )}

                             {visualMode === 'MAP' ? (
                                <EquityStructureMap 
                                   clientName={selectedClient.name} 
                                   shareholders={selectedClient.equityStructure || []} 
                                   subsidiaries={selectedClient.subsidiaries || []}
                                   onSelectShareholder={(i) => { setSelectedEquityType('shareholder'); setSelectedEquityIndex(i); }}
                                   onSelectSubsidiary={(i) => { setSelectedEquityType('subsidiary'); setSelectedEquityIndex(i); }}
                                   selectedType={selectedEquityType}
                                   selectedIndex={selectedEquityIndex}
                                   readOnly={isReadOnly}
                                />
                             ) : (
                                <div className="w-full h-full flex flex-col md:flex-row p-6 gap-6">
                                   <div className="flex-1 h-1/2 md:h-full card p-4">
                                      <h4 className="text-center font-bold text-[var(--text-primary)] mb-4">股东结构</h4>
                                      <ResponsiveContainer width="100%" height="85%">
                                         <PieChart>
                                            <Pie
                                               data={selectedClient.equityStructure}
                                               dataKey="percentage"
                                               nameKey="name"
                                               cx="50%" cy="45%"
                                               outerRadius={80}
                                               fill="#8884d8"
                                               label
                                            >
                                               {(selectedClient.equityStructure || []).map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={entry.type === 'institution' ? 'var(--primary-500)' : '#f43f5e'} />
                                               ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" height={36}/>
                                         </PieChart>
                                      </ResponsiveContainer>
                                   </div>
                                   <div className="flex-1 h-1/2 md:h-full card p-4">
                                      <h4 className="text-center font-bold text-[var(--text-primary)] mb-4">对外投资</h4>
                                      <ResponsiveContainer width="100%" height="85%">
                                         <PieChart>
                                            <Pie
                                               data={selectedClient.subsidiaries}
                                               dataKey="percentage"
                                               nameKey="name"
                                               cx="50%" cy="45%"
                                               innerRadius={40}
                                               outerRadius={80}
                                               fill="var(--success)"
                                               label
                                            >
                                               {(selectedClient.subsidiaries || []).map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                               ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" height={36}/>
                                         </PieChart>
                                      </ResponsiveContainer>
                                   </div>
                                </div>
                             )}
                         </div>

                         {/* Editor Panel */}
                         <div className={`bg-[var(--bg-primary)] border-l border-[var(--border-light)] transition-all duration-300 flex flex-col ${selectedEquityType && !isReadOnly ? 'w-full md:w-1/3' : 'w-0 hidden'}`}>
                             <div className="p-5 border-b border-[var(--border-light)] flex justify-between items-center bg-[var(--bg-secondary)]">
                                <h3 className="font-bold text-[var(--text-primary)]">
                                   {selectedEquityType === 'shareholder' ? '编辑股东信息' : '编辑子公司信息'}
                                </h3>
                                <button onClick={() => { setSelectedEquityType(null); setSelectedEquityIndex(null); }} className="p-1.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors">
                                  <X className="w-4 h-4"/>
                                </button>
                             </div>
                             
                             <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {selectedEquityType === 'shareholder' && selectedEquityIndex !== null && selectedClient.equityStructure && (
                                   <>
                                      <div>
                                         <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">股东名称</label>
                                         <input 
                                            className="input"
                                            value={selectedClient.equityStructure[selectedEquityIndex].name}
                                            onChange={(e) => handleUpdateShareholder(selectedEquityIndex, 'name', e.target.value)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">持股比例 (%)</label>
                                         <input 
                                            type="number"
                                            className="input"
                                            value={selectedClient.equityStructure[selectedEquityIndex].percentage}
                                            onChange={(e) => handleUpdateShareholder(selectedEquityIndex, 'percentage', parseFloat(e.target.value) || 0)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">类型</label>
                                         <div className="flex gap-2">
                                            <button 
                                               onClick={() => handleUpdateShareholder(selectedEquityIndex, 'type', 'individual')}
                                               className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all ${selectedClient.equityStructure[selectedEquityIndex].type === 'individual' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-light)]'}`}
                                            >
                                               个人
                                            </button>
                                            <button 
                                               onClick={() => handleUpdateShareholder(selectedEquityIndex, 'type', 'institution')}
                                               className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all ${selectedClient.equityStructure[selectedEquityIndex].type === 'institution' ? 'bg-[var(--primary-50)] border-[var(--primary-200)] text-[var(--primary-700)]' : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-light)]'}`}
                                            >
                                               机构
                                            </button>
                                         </div>
                                      </div>
                                      <button 
                                         onClick={() => handleDeleteShareholder(selectedEquityIndex)}
                                         className="w-full mt-4 py-2.5 text-[var(--danger)] bg-[var(--danger-light)] hover:bg-[var(--danger)] hover:text-white rounded-lg text-sm font-medium flex items-center justify-center transition-all"
                                      >
                                         <Trash2 className="w-4 h-4 mr-2" /> 删除股东
                                      </button>
                                   </>
                                )}

                                {selectedEquityType === 'subsidiary' && selectedEquityIndex !== null && selectedClient.subsidiaries && (
                                   <>
                                      <div>
                                         <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">公司名称</label>
                                         <input 
                                            className="input"
                                            value={selectedClient.subsidiaries[selectedEquityIndex].name}
                                            onChange={(e) => handleUpdateSubsidiary(selectedEquityIndex, 'name', e.target.value)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">持股比例 (%)</label>
                                         <input 
                                            type="number"
                                            className="input"
                                            value={selectedClient.subsidiaries[selectedEquityIndex].percentage}
                                            onChange={(e) => handleUpdateSubsidiary(selectedEquityIndex, 'percentage', parseFloat(e.target.value) || 0)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">行业</label>
                                         <input 
                                            className="input"
                                            value={selectedClient.subsidiaries[selectedEquityIndex].industry || ''}
                                            onChange={(e) => handleUpdateSubsidiary(selectedEquityIndex, 'industry', e.target.value)}
                                         />
                                      </div>
                                      <button 
                                         onClick={() => {
                                            if(!selectedClient.subsidiaries) return;
                                            const newList = [...selectedClient.subsidiaries];
                                            newList.splice(selectedEquityIndex, 1);
                                            setSelectedClient({ ...selectedClient, subsidiaries: newList });
                                            setSelectedEquityType(null);
                                         }}
                                         className="w-full mt-4 py-2.5 text-[var(--danger)] bg-[var(--danger-light)] hover:bg-[var(--danger)] hover:text-white rounded-lg text-sm font-medium flex items-center justify-center transition-all"
                                      >
                                         <Trash2 className="w-4 h-4 mr-2" /> 删除子公司
                                      </button>
                                   </>
                                )}
                             </div>
                         </div>
                         
                         {/* Floating Add Buttons */}
                         {!selectedEquityType && !isReadOnly && (
                            <div className="absolute bottom-6 right-6 flex flex-col gap-3 z-10">
                               <button 
                                  onClick={handleAddShareholder}
                                  className="flex items-center gap-2 bg-[var(--bg-primary)] shadow-lg border border-[var(--border-light)] px-4 py-2.5 rounded-full text-sm font-medium text-[var(--text-primary)] hover:text-[var(--primary-600)] hover:shadow-xl hover:-translate-y-0.5 transition-all"
                               >
                                  <Plus className="w-4 h-4" /> 添加股东
                               </button>
                               <button 
                                  onClick={handleAddSubsidiary}
                                  className="flex items-center gap-2 bg-[var(--bg-primary)] shadow-lg border border-[var(--border-light)] px-4 py-2.5 rounded-full text-sm font-medium text-[var(--text-primary)] hover:text-[var(--success)] hover:shadow-xl hover:-translate-y-0.5 transition-all"
                               >
                                  <Plus className="w-4 h-4" /> 添加对外投资
                               </button>
                            </div>
                         )}
                      </div>
                   )}

                   {/* Contacts Tab */}
                   {activeTab === 'CONTACTS' && (
                      <div className="h-full p-6 flex flex-col md:flex-row gap-6">
                         <div className="flex-1 overflow-y-auto">
                            <div className="flex justify-between items-center mb-5">
                               <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                                  <ContactIcon className="w-4 h-4 text-[var(--primary-500)]" />
                                  联系人列表
                               </h4>
                               {!isReadOnly && (
                                   <button 
                                      onClick={handleAddContact}
                                      className="btn btn-primary text-xs py-2"
                                   >
                                      <Plus className="w-3.5 h-3.5" /> 添加联系人
                                   </button>
                               )}
                            </div>
                            <div className="space-y-3">
                               {selectedClient.contacts.map(contact => (
                                  <div 
                                    key={contact.id} 
                                    onClick={() => handleEditContact(contact)}
                                    className={`card p-4 transition-all ${editingContactId === contact.id ? 'ring-2 ring-[var(--primary-300)] border-[var(--primary-300)]' : 'card-interactive'} ${isReadOnly ? '' : 'cursor-pointer'}`}
                                  >
                                     <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                           <div className="w-11 h-11 rounded-full bg-[var(--primary-100)] flex items-center justify-center text-[var(--primary-600)] font-bold text-sm">
                                              {contact.name[0]}
                                           </div>
                                           <div>
                                              <p className="font-semibold text-[var(--text-primary)] text-sm">{contact.name}</p>
                                              <p className="text-xs text-[var(--text-tertiary)]">{contact.role}</p>
                                           </div>
                                        </div>
                                        {!isReadOnly && (
                                            <button 
                                               onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id); }}
                                               className="p-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-lg transition-all"
                                            >
                                               <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                     </div>
                                     <div className="mt-4 space-y-2 pl-14">
                                        <div className="flex items-center text-xs text-[var(--text-secondary)]">
                                           <Mail className="w-3.5 h-3.5 mr-2 text-[var(--text-tertiary)]" />
                                           {contact.email || '-'}
                                        </div>
                                        <div className="flex items-center text-xs text-[var(--text-secondary)]">
                                           <Phone className="w-3.5 h-3.5 mr-2 text-[var(--text-tertiary)]" />
                                           {contact.phone || '-'}
                                        </div>
                                     </div>
                                  </div>
                               ))}
                               {selectedClient.contacts.length === 0 && (
                                  <div className="text-center py-12 text-[var(--text-tertiary)] border-2 border-dashed border-[var(--border)] rounded-xl">
                                     <ContactIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                     <p className="text-sm">暂无联系人</p>
                                     {!isReadOnly && (
                                        <button onClick={handleAddContact} className="mt-3 text-sm text-[var(--primary-600)] hover:underline">
                                           添加第一个联系人
                                        </button>
                                     )}
                                  </div>
                               )}
                            </div>
                         </div>
                         
                         {/* Contact Editor */}
                         {editingContactId && !isReadOnly && (
                            <div className="w-full md:w-96 card p-5 h-fit">
                               <h4 className="font-bold text-[var(--text-primary)] mb-5 flex items-center gap-2">
                                  <UserIcon className="w-4 h-4 text-[var(--primary-500)]" />
                                  {editingContactId === 'NEW' ? '新建联系人' : '编辑联系人'}
                               </h4>
                               <div className="space-y-4">
                                  <div>
                                     <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">姓名</label>
                                     <input 
                                        className="input"
                                        value={tempContact.name || ''}
                                        onChange={e => setTempContact({...tempContact, name: e.target.value})}
                                        autoFocus
                                        placeholder="请输入姓名"
                                     />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">职位</label>
                                     <input 
                                        className="input"
                                        value={tempContact.role || ''}
                                        onChange={e => setTempContact({...tempContact, role: e.target.value})}
                                        placeholder="请输入职位"
                                     />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">邮箱</label>
                                     <input 
                                        type="email"
                                        className="input"
                                        value={tempContact.email || ''}
                                        onChange={e => setTempContact({...tempContact, email: e.target.value})}
                                        placeholder="请输入邮箱"
                                     />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-2">电话</label>
                                     <input 
                                        type="tel"
                                        className="input"
                                        value={tempContact.phone || ''}
                                        onChange={e => setTempContact({...tempContact, phone: e.target.value})}
                                        placeholder="请输入电话"
                                     />
                                  </div>
                                  <div className="flex gap-3 pt-2">
                                     <button 
                                        onClick={() => setEditingContactId(null)}
                                        className="flex-1 btn btn-secondary"
                                     >
                                        取消
                                     </button>
                                     <button 
                                        onClick={handleSaveContact}
                                        className="flex-1 btn btn-primary"
                                     >
                                        确认
                                     </button>
                                  </div>
                               </div>
                            </div>
                         )}
                      </div>
                   )}
                </div>
    </>
  );
};

export default ClientDetailTabs;
