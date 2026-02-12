import React, { useState, useEffect } from 'react';
import { Client, ClientStatus, CustomFieldDefinition, Contact, Shareholder, Subsidiary, User } from '../types';
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
  ArrowRight
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
import { upsertClient, deleteClient } from '../services/supabaseService';

// 国标一级行业分类 (GB/T 4754)
const NATIONAL_STANDARD_INDUSTRIES = [
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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
const ITEMS_PER_PAGE = 10;

interface ClientManagerProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  fieldDefinitions?: CustomFieldDefinition[];
  currentUser?: User;
  initialSearchTerm?: string;
  shouldCreateNew?: boolean;
  onResetTrigger?: () => void;
}

// Internal Component: SVG Mind Map for Equity Structure (Upstream & Downstream)
const EquityStructureMap = ({ 
  clientName, 
  shareholders, 
  subsidiaries,
  onSelectShareholder,
  onSelectSubsidiary,
  selectedType, // 'shareholder' | 'subsidiary' | null
  selectedIndex, // number | null
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
  
  // Helper to distribute nodes on an arc
  // For shareholders (Top): Angle -PI to 0
  // For subsidiaries (Bottom): Angle 0 to PI
  const calculatePositions = (count: number, radius: number, isTop: boolean) => {
    if (count === 0) return [];
    // Limit arc spread based on count to avoid too wide spread for few nodes
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
               stroke={isSelected ? "#6366f1" : "#cbd5e1"}
               strokeWidth={isSelected ? "2" : "1"}
               markerEnd="url(#arrowhead)" // Arrow points to Client (Center)
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
               stroke={isSelected ? "#10b981" : "#cbd5e1"}
               strokeWidth={isSelected ? "2" : "1"}
               markerEnd="url(#arrowhead)" // Arrow points to Subsidiary
            />
         );
      })}

      {/* --- Nodes --- */}

      {/* Center Node (Client) */}
      <g filter="url(#shadow)">
        <rect x={cx - 60} y={cy - 25} width="120" height="50" rx="25" fill="white" stroke="#4f46e5" strokeWidth="3" />
        <foreignObject x={cx - 55} y={cy - 20} width="110" height="40">
           <div className="flex flex-col items-center justify-center h-full text-center">
             <div className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2">{clientName}</div>
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
                  fill={isInst ? (isSelected ? '#e0f2fe' : '#f0f9ff') : (isSelected ? '#ffe4e6' : '#fff1f2')}
                  stroke={isInst ? '#0ea5e9' : '#f43f5e'}
                  strokeWidth={isSelected ? "3" : "1.5"}
               />
               <foreignObject x={pos.x - 28} y={pos.y - 28} width="56" height="56" className="pointer-events-none">
                 <div className="flex flex-col items-center justify-center h-full">
                    <div className="text-[9px] font-bold text-slate-700 text-center leading-tight line-clamp-2 w-full mb-0.5">
                       {s.name}
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono bg-white/50 px-1 rounded">
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
                  fill={isSelected ? '#d1fae5' : '#ecfdf5'}
                  stroke="#10b981"
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
      <text x={20} y={30} className="text-xs fill-slate-400 font-bold uppercase">股东 (上游)</text>
      <text x={20} y={height - 20} className="text-xs fill-slate-400 font-bold uppercase">对外投资 (下游)</text>

      {/* Empty State Text */}
      {shareholders.length === 0 && subsidiaries.length === 0 && (
         <text x={cx} y={cy + 60} textAnchor="middle" className="text-sm fill-slate-400">
           暂无股权数据
         </text>
      )}
    </svg>
  );
};

export const ClientManager: React.FC<ClientManagerProps> = ({ 
  clients, 
  setClients, 
  fieldDefinitions = [], 
  currentUser,
  initialSearchTerm,
  shouldCreateNew,
  onResetTrigger
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'BASIC' | 'EQUITY' | 'CONTACTS'>('BASIC');
  const [currentPage, setCurrentPage] = useState(1);
  
  // States within Modal
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [fullscreenSection, setFullscreenSection] = useState<'FINANCIAL' | 'SUPPLY' | null>(null);
  
  // Contact Editing State
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [tempContact, setTempContact] = useState<Partial<Contact>>({});

  // Equity UI State
  const [visualMode, setVisualMode] = useState<'MAP' | 'PIE'>('MAP');
  
  // Selection for editing
  const [selectedEquityType, setSelectedEquityType] = useState<'shareholder' | 'subsidiary' | null>(null);
  const [selectedEquityIndex, setSelectedEquityIndex] = useState<number | null>(null);

  // Batch Operations State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- External Control Effects ---
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
      if (initialSearchTerm) {
          // If searching, close details to show results
          setSelectedClient(null); 
      }
    }
  }, [initialSearchTerm]);

  useEffect(() => {
    if (shouldCreateNew) {
      handleAddMockClient();
      if (onResetTrigger) onResetTrigger();
    }
  }, [shouldCreateNew, onResetTrigger]);

  // Permission Logic
  const canEdit = (client: Client | null) => {
      if (!client) return true; // New client
      if (currentUser?.role === '管理员') return true;
      if (client.ownerId && currentUser?.id === client.ownerId) return true;
      return false; // Read only for others
  };

  const isReadOnly = selectedClient ? !canEdit(selectedClient) : false;

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ownerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);
  const paginatedClients = filteredClients.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // --- Batch Operations Logic ---
  const handleSelectAll = () => {
      if (selectedIds.size === paginatedClients.length) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(paginatedClients.map(c => c.id)));
      }
  };

  const handleSelectOne = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
          newSet.delete(id);
      } else {
          newSet.add(id);
      }
      setSelectedIds(newSet);
  };

  const handleBatchDelete = async () => {
      if (!confirm(`确定要删除选中的 ${selectedIds.size} 个客户吗？此操作无法撤销。`)) return;
      
      const idsToDelete = Array.from(selectedIds);
      setClients(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      
      // Execute deletions in background
      for (const id of idsToDelete) {
          await deleteClient(id);
      }
  };

  const handleBatchStatus = (status: ClientStatus) => {
      setClients(prev => prev.map(c => {
          if (selectedIds.has(c.id)) {
              // Trigger background update (async, no await)
              upsertClient({ ...c, status });
              return { ...c, status };
          }
          return c;
      }));
      setSelectedIds(new Set());
  };

  const handleBatchExport = () => {
      const selectedData = clients.filter(c => selectedIds.has(c.id));
      const csvHeader = 'ID,Name,Industry,Status,Region,Owner\n';
      const csvRows = selectedData.map(c => 
          `${c.id},"${c.name}",${c.industry},${c.status},"${c.region}",${c.ownerName}`
      ).join('\n');
      
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export_clients_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Regular Client Handlers ---

  const handleGenerateProfile = async () => {
    if (!selectedClient || isReadOnly) return;
    setIsProfileLoading(true);
    try {
      const profile = await generateClientProfile(selectedClient.name, selectedClient.industry, selectedClient.region);
      setSelectedClient(prev => prev ? {
        ...prev,
        equityStructure: profile.equity, // Array of Shareholders
        subsidiaries: profile.subsidiaries, // Array of Subsidiaries
        financialAnalysis: profile.financials,
        supplyChainInfo: profile.supplyChain,
      } : null);
      setVisualMode('MAP'); // Switch to map view to see result
    } catch (e) {
      alert("生成画像失败，请检查控制台。");
    } finally {
      setIsProfileLoading(false);
    }
  };

  const handleAddMockClient = async () => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: "新客户",
      industry: NATIONAL_STANDARD_INDUSTRIES[2],
      status: ClientStatus.Lead,
      region: "",
      contacts: [],
      equityStructure: [],
      subsidiaries: [],
      financialAnalysis: "",
      supplyChainInfo: "",
      customFields: {},
      ownerId: currentUser?.id,
      ownerName: currentUser?.name || "未知用户"
    };
    // Don't add to main list yet, just open modal
    setSelectedClient(newClient); 
    setActiveTab('BASIC');
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

  const handleSaveClient = async () => {
    if (!selectedClient || isReadOnly) return;
    if (!selectedClient.name.trim()) {
      alert("客户名称不能为空");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const clientToSave: Client = {
        id: selectedClient.id,
        name: selectedClient.name,
        industry: selectedClient.industry || '',
        status: selectedClient.status || ClientStatus.Lead,
        region: selectedClient.region || '',
        contacts: selectedClient.contacts || [],
        customFields: selectedClient.customFields || {},
        ownerId: selectedClient.ownerId,
        ownerName: selectedClient.ownerName,
        
        equityStructure: selectedClient.equityStructure || [],
        subsidiaries: selectedClient.subsidiaries || [],
        financialAnalysis: selectedClient.financialAnalysis || '',
        supplyChainInfo: selectedClient.supplyChainInfo || ''
      };

      await upsertClient(clientToSave);
      
      setClients(prev => {
        const exists = prev.find(c => c.id === clientToSave.id);
        if (exists) return prev.map(c => c.id === clientToSave.id ? clientToSave : c);
        return [clientToSave, ...prev];
      });

      setIsSaving(false);
      setSelectedClient(null);
    } catch (err: any) {
      console.error("Failed to save client:", err);
      
      if (err.message && err.message.startsWith("PARTIAL_SUCCESS:")) {
         const msg = err.message.replace("PARTIAL_SUCCESS: ", "");
         alert(`⚠️ ${msg}\n\n建议联系管理员更新数据库结构。`);
         setIsSaving(false);
         setSelectedClient(null);
         
         const clientToSave = selectedClient as Client; 
         setClients(prev => {
            const exists = prev.find(c => c.id === clientToSave.id);
            if (exists) return prev.map(c => c.id === clientToSave.id ? clientToSave : c);
            return [clientToSave, ...prev];
         });
         return;
      }

      alert(`保存失败: ${err.message || '请检查网络或配置'}`);
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("确定要删除此客户吗？\n注意：如果数据库未配置级联删除，且该客户下有拜访记录，删除可能会失败。")) return;
    
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);

    await deleteClient(id);
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
    <div className="h-full flex flex-col relative">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
         <div className="flex items-center">
            <Users className="w-6 h-6 mr-3 text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-800">客户管理</h2>
         </div>
         <div className="flex gap-4">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
               <input 
                  type="text" 
                  placeholder="搜索客户..." 
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-64"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
               />
            </div>
            <button 
               onClick={handleAddMockClient}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm text-sm"
            >
               <Plus className="w-4 h-4 mr-2" />
               新建客户
            </button>
         </div>
       </div>

       {/* Client Table List View */}
       <div className="flex-1 overflow-hidden bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex-1 overflow-y-auto">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                   <tr>
                      <th className="px-4 py-4 w-12">
                          <button onClick={handleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                              {selectedIds.size > 0 && selectedIds.size === paginatedClients.length 
                                  ? <CheckSquare className="w-5 h-5 text-indigo-600" /> 
                                  : <SquareIcon className="w-5 h-5" />}
                          </button>
                      </th>
                      <th className="px-6 py-4 font-semibold text-slate-600">客户名称</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">行业/地区</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">主要联系人</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">状态</th>
                      <th className="px-6 py-4 font-semibold text-slate-600">负责人</th>
                      <th className="px-6 py-4 font-semibold text-slate-600 text-right">操作</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {paginatedClients.map(client => {
                      const firstContact = client.contacts && client.contacts.length > 0 ? client.contacts[0] : null;
                      const hasPermission = canEdit(client);
                      const isSelected = selectedIds.has(client.id);
                      return (
                         <tr 
                           key={client.id} 
                           onClick={() => { setSelectedClient(client); setActiveTab('BASIC'); }}
                           className={`transition-colors cursor-pointer group ${isSelected ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                         >
                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleSelectOne(client.id)} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                                    {isSelected ? <CheckSquare className="w-5 h-5 text-indigo-600" /> : <SquareIcon className="w-5 h-5" />}
                                </button>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center">
                                  <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white font-bold text-sm mr-3 ${
                                     client.status === ClientStatus.Active ? 'bg-indigo-50' : client.status === ClientStatus.Churned ? 'bg-slate-400' : 'bg-blue-400'
                                  }`}>
                                     {client.name.substring(0, 1)}
                                  </div>
                                  <div className="font-bold text-slate-800 line-clamp-1">{client.name}</div>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col">
                                  <span className="text-slate-700 flex items-center text-xs mb-1">
                                    <Briefcase className="w-3 h-3 mr-1 text-slate-400"/> {client.industry}
                                  </span>
                                  <span className="text-slate-500 flex items-center text-xs">
                                    <MapPin className="w-3 h-3 mr-1 text-slate-400"/> {client.region || '未填写'}
                                  </span>
                               </div>
                            </td>
                            <td className="px-6 py-4">
                               {firstContact ? (
                                  <div className="text-xs">
                                     <div className="font-medium text-slate-700">{firstContact.name} <span className="text-slate-400">({firstContact.role})</span></div>
                                     <div className="text-slate-500 mt-0.5">{firstContact.phone}</div>
                                  </div>
                               ) : (
                                  <span className="text-xs text-slate-400 italic">无联系人</span>
                               )}
                            </td>
                            <td className="px-6 py-4">
                               <span className={`text-xs px-2 py-1 rounded-full border ${
                                  client.status === ClientStatus.Active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                  client.status === ClientStatus.Churned ? 'bg-slate-50 text-slate-600 border-slate-100' : 'bg-blue-50 text-blue-700 border-blue-100'
                               }`}>
                                  {client.status}
                               </span>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex items-center text-xs text-slate-600">
                                  <UserIcon className="w-3 h-3 mr-1 text-slate-400"/>
                                  {client.ownerName || 'Unknown'}
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                               {hasPermission && (
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }}
                                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                      title="删除客户"
                                   >
                                      <Trash2 className="w-4 h-4" />
                                   </button>
                               )}
                            </td>
                         </tr>
                      );
                   })}
                   {paginatedClients.length === 0 && (
                      <tr>
                         <td colSpan={7} className="px-6 py-20 text-center text-slate-400">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-10" />
                            <p>未找到相关客户</p>
                         </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredClients.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
               <span className="text-xs text-slate-500">
                  显示 {Math.min(filteredClients.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(filteredClients.length, currentPage * ITEMS_PER_PAGE)} 共 {filteredClients.length} 条
               </span>
               <div className="flex space-x-2">
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs flex items-center px-2 font-medium text-slate-600">
                     {currentPage} / {totalPages}
                  </span>
                  <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          )}
       </div>

       {/* Batch Action Bar */}
       {selectedIds.size > 0 && (
           <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-800 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-6 z-20 animate-fade-in-up">
               <span className="text-sm font-medium mr-2">{selectedIds.size} 个已选中</span>
               
               <div className="h-6 w-px bg-slate-600"></div>
               
               <button onClick={() => handleBatchStatus(ClientStatus.Active)} className="flex flex-col items-center hover:text-emerald-400 transition-colors">
                   <CheckSquare className="w-5 h-5 mb-1" />
                   <span className="text-[10px]">设为已签约</span>
               </button>
               
               <button onClick={handleBatchExport} className="flex flex-col items-center hover:text-blue-400 transition-colors">
                   <Download className="w-5 h-5 mb-1" />
                   <span className="text-[10px]">导出 CSV</span>
               </button>
               
               <button onClick={handleBatchDelete} className="flex flex-col items-center hover:text-red-400 transition-colors">
                   <Trash2 className="w-5 h-5 mb-1" />
                   <span className="text-[10px]">删除</span>
               </button>

               <button onClick={() => setSelectedIds(new Set())} className="ml-4 p-1 rounded-full bg-slate-700 hover:bg-slate-600">
                   <X className="w-4 h-4" />
               </button>
           </div>
       )}

       {/* Detail Modal */}
       {selectedClient && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                   <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
                         {selectedClient.name.substring(0, 1)}
                      </div>
                      <div>
                         <input 
                            className="font-bold text-lg text-slate-800 bg-transparent border-none focus:ring-0 p-0 w-64 focus:bg-white focus:px-2 rounded transition-all disabled:bg-transparent disabled:text-slate-600"
                            value={selectedClient.name}
                            onChange={(e) => setSelectedClient({...selectedClient, name: e.target.value})}
                            disabled={isReadOnly}
                         />
                         <p className="text-xs text-slate-500">ID: {selectedClient.id}</p>
                      </div>
                   </div>
                   <div className="flex items-center space-x-3">
                      {isReadOnly && (
                          <div className="flex items-center bg-amber-50 text-amber-600 text-xs px-3 py-1.5 rounded-full border border-amber-100 mr-2">
                              <ShieldIcon className="w-3 h-3 mr-1" />
                              只读权限
                          </div>
                      )}
                      <div className="flex bg-slate-200 p-1 rounded-lg">
                         {(['BASIC', 'EQUITY', 'CONTACTS'] as const).map(tab => (
                            <button
                               key={tab}
                               onClick={() => setActiveTab(tab)}
                               className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                               {tab === 'BASIC' && '基本信息'}
                               {tab === 'EQUITY' && '股权画像'}
                               {tab === 'CONTACTS' && '联系人'}
                            </button>
                         ))}
                      </div>
                      {!isReadOnly && (
                          <>
                            <div className="h-6 w-px bg-slate-300 mx-2"></div>
                            <button 
                                onClick={handleSaveClient} 
                                disabled={isSaving}
                                className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-70"
                            >
                                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2"/>}
                                保存
                            </button>
                          </>
                      )}
                      <button onClick={() => setSelectedClient(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg">
                         <X className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-hidden bg-slate-50 relative">
                   {activeTab === 'BASIC' && (
                      <div className="h-full overflow-y-auto p-6">
                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Basic Fields */}
                            <div className="space-y-4 lg:col-span-1">
                               <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                  <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">基础资料</h4>
                                  <div className="space-y-4">
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">所属行业</label>
                                        <select 
                                           className="w-full p-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                           value={selectedClient.industry}
                                           onChange={e => setSelectedClient({...selectedClient, industry: e.target.value})}
                                           disabled={isReadOnly}
                                        >
                                           {NATIONAL_STANDARD_INDUSTRIES.map(ind => (
                                              <option key={ind} value={ind}>{ind}</option>
                                           ))}
                                        </select>
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">所在地区</label>
                                        <input 
                                           className="w-full p-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                           value={selectedClient.region}
                                           onChange={e => setSelectedClient({...selectedClient, region: e.target.value})}
                                           placeholder="例如：上海, 浦东新区"
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">客户状态</label>
                                        <select 
                                           className="w-full p-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                           value={selectedClient.status}
                                           onChange={e => setSelectedClient({...selectedClient, status: e.target.value as ClientStatus})}
                                           disabled={isReadOnly}
                                        >
                                           {Object.values(ClientStatus).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                     </div>
                                     <div>
                                        <label className="block text-xs font-semibold text-slate-500 mb-1">负责人</label>
                                        <div className="flex items-center p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-600">
                                            <UserIcon className="w-4 h-4 mr-2" />
                                            {selectedClient.ownerName || 'Unknown'}
                                        </div>
                                     </div>
                                  </div>
                               </div>

                               {/* Custom Fields */}
                               {fieldDefinitions.length > 0 && (
                                  <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                                     <h4 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">自定义信息</h4>
                                     <div className="space-y-3">
                                        {fieldDefinitions.map(field => (
                                           <div key={field.id}>
                                              <label className="block text-xs font-semibold text-slate-500 mb-1">{field.label}</label>
                                              {field.type === 'select' ? (
                                                 <select
                                                    className="w-full p-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
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
                                                    className="w-full p-2 rounded-lg border border-slate-200 text-sm disabled:bg-slate-50 disabled:text-slate-500"
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

                            {/* AI Analysis Section */}
                            <div className="lg:col-span-2 space-y-4">
                               <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm h-full flex flex-col">
                                  <div className="flex justify-between items-center mb-4">
                                     <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                                        <PieIcon className="w-4 h-4 mr-2 text-indigo-600" />
                                        企业画像与财务分析
                                     </h4>
                                     {!isReadOnly && (
                                         <button 
                                            onClick={handleGenerateProfile}
                                            disabled={isProfileLoading}
                                            className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center font-medium transition-colors"
                                         >
                                            {isProfileLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin"/> : <RefreshCw className="w-3 h-3 mr-1"/>}
                                            AI 生成画像
                                         </button>
                                     )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 gap-4 flex-1">
                                     <div className={`relative transition-all ${fullscreenSection === 'FINANCIAL' ? 'fixed inset-4 z-50 bg-white shadow-2xl p-6 rounded-xl border border-slate-200' : 'bg-slate-50 p-4 rounded-xl border border-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                           <h5 className="font-bold text-slate-700 text-sm">财务分析</h5>
                                           <button onClick={() => setFullscreenSection(fullscreenSection === 'FINANCIAL' ? null : 'FINANCIAL')}>
                                              {fullscreenSection === 'FINANCIAL' ? <Minimize2 className="w-4 h-4 text-slate-400"/> : <Maximize2 className="w-4 h-4 text-slate-400"/>}
                                           </button>
                                        </div>
                                        <textarea 
                                           className="w-full h-[calc(100%-2rem)] bg-transparent resize-none focus:outline-none text-sm text-slate-600 leading-relaxed disabled:text-slate-500"
                                           value={selectedClient.financialAnalysis || ''}
                                           onChange={e => setSelectedClient({...selectedClient, financialAnalysis: e.target.value})}
                                           placeholder="点击生成画像获取财务分析..."
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                     <div className={`relative transition-all ${fullscreenSection === 'SUPPLY' ? 'fixed inset-4 z-50 bg-white shadow-2xl p-6 rounded-xl border border-slate-200' : 'bg-slate-50 p-4 rounded-xl border border-slate-100'}`}>
                                        <div className="flex justify-between items-center mb-2">
                                           <h5 className="font-bold text-slate-700 text-sm">供应链信息</h5>
                                           <button onClick={() => setFullscreenSection(fullscreenSection === 'SUPPLY' ? null : 'SUPPLY')}>
                                              {fullscreenSection === 'SUPPLY' ? <Minimize2 className="w-4 h-4 text-slate-400"/> : <Maximize2 className="w-4 h-4 text-slate-400"/>}
                                           </button>
                                        </div>
                                        <textarea 
                                           className="w-full h-[calc(100%-2rem)] bg-transparent resize-none focus:outline-none text-sm text-slate-600 leading-relaxed disabled:text-slate-500"
                                           value={selectedClient.supplyChainInfo || ''}
                                           onChange={e => setSelectedClient({...selectedClient, supplyChainInfo: e.target.value})}
                                           placeholder="点击生成画像获取供应链信息..."
                                           disabled={isReadOnly}
                                        />
                                     </div>
                                  </div>
                               </div>
                            </div>
                         </div>
                      </div>
                   )}

                   {/* Equity & Contacts tabs preserved as is ... */}
                   {activeTab === 'EQUITY' && (
                      <div className="h-full flex flex-col md:flex-row">
                         {/* Visualization Panel */}
                         <div className={`relative transition-all duration-300 ${selectedEquityType && !isReadOnly ? 'w-full md:w-2/3' : 'w-full'} h-full bg-slate-100 flex items-center justify-center overflow-hidden`}>
                             <div className="absolute top-4 left-4 z-10 flex space-x-2 bg-white/80 backdrop-blur p-1 rounded-lg border border-slate-200">
                                <button 
                                   onClick={() => setVisualMode('MAP')}
                                   className={`p-1.5 rounded ${visualMode === 'MAP' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                   title="关系图谱"
                                >
                                   <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button 
                                   onClick={() => setVisualMode('PIE')}
                                   className={`p-1.5 rounded ${visualMode === 'PIE' ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                                   title="占比图表"
                                >
                                   <PieIcon className="w-4 h-4" />
                                </button>
                             </div>
                             
                             {visualMode === 'MAP' && (
                                <div className="absolute bottom-4 left-4 z-10 bg-white/80 backdrop-blur p-2 rounded-lg border border-slate-200 text-xs">
                                   <div className="flex items-center mb-1"><span className="w-3 h-3 rounded-full bg-red-100 border border-red-400 mr-2"></span>个人股东</div>
                                   <div className="flex items-center mb-1"><span className="w-3 h-3 rounded-full bg-blue-100 border border-blue-400 mr-2"></span>机构股东</div>
                                   <div className="flex items-center"><span className="w-3 h-2 bg-emerald-100 border border-emerald-400 mr-2"></span>对外投资</div>
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
                                <div className="w-full h-full flex flex-col md:flex-row p-4">
                                   <div className="flex-1 h-1/2 md:h-full">
                                      <h4 className="text-center font-bold text-slate-700 mb-2">股东结构</h4>
                                      <ResponsiveContainer width="100%" height="90%">
                                         <PieChart>
                                            <Pie
                                               data={selectedClient.equityStructure}
                                               dataKey="percentage"
                                               nameKey="name"
                                               cx="50%" cy="50%"
                                               outerRadius={80}
                                               fill="#8884d8"
                                               label
                                            >
                                               {(selectedClient.equityStructure || []).map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={entry.type === 'institution' ? '#3b82f6' : '#f43f5e'} />
                                               ))}
                                            </Pie>
                                            <RechartsTooltip />
                                            <Legend verticalAlign="bottom" height={36}/>
                                         </PieChart>
                                      </ResponsiveContainer>
                                   </div>
                                   <div className="flex-1 h-1/2 md:h-full border-t md:border-t-0 md:border-l border-slate-200">
                                      <h4 className="text-center font-bold text-slate-700 mb-2 mt-4 md:mt-0">对外投资</h4>
                                      <ResponsiveContainer width="100%" height="90%">
                                         <PieChart>
                                            <Pie
                                               data={selectedClient.subsidiaries}
                                               dataKey="percentage"
                                               nameKey="name"
                                               cx="50%" cy="50%"
                                               innerRadius={40}
                                               outerRadius={80}
                                               fill="#10b981"
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
                         <div className={`bg-white border-l border-slate-200 transition-all duration-300 flex flex-col ${selectedEquityType && !isReadOnly ? 'w-full md:w-1/3' : 'w-0 hidden'}`}>
                             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-slate-800">
                                   {selectedEquityType === 'shareholder' ? '编辑股东信息' : '编辑子公司信息'}
                                </h3>
                                <button onClick={() => { setSelectedEquityType(null); setSelectedEquityIndex(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4"/></button>
                             </div>
                             
                             <div className="p-4 space-y-4 overflow-y-auto flex-1">
                                {selectedEquityType === 'shareholder' && selectedEquityIndex !== null && selectedClient.equityStructure && (
                                   <>
                                      <div>
                                         <label className="block text-xs font-semibold text-slate-500 mb-1">股东名称</label>
                                         <input 
                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                            value={selectedClient.equityStructure[selectedEquityIndex].name}
                                            onChange={(e) => handleUpdateShareholder(selectedEquityIndex, 'name', e.target.value)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-slate-500 mb-1">持股比例 (%)</label>
                                         <input 
                                            type="number"
                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                            value={selectedClient.equityStructure[selectedEquityIndex].percentage}
                                            onChange={(e) => handleUpdateShareholder(selectedEquityIndex, 'percentage', parseFloat(e.target.value) || 0)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-slate-500 mb-1">类型</label>
                                         <div className="flex space-x-2">
                                            <button 
                                               onClick={() => handleUpdateShareholder(selectedEquityIndex, 'type', 'individual')}
                                               className={`flex-1 py-2 text-xs rounded-lg border ${selectedClient.equityStructure[selectedEquityIndex].type === 'individual' ? 'bg-red-50 border-red-200 text-red-700' : 'border-slate-200 text-slate-600'}`}
                                            >
                                               个人
                                            </button>
                                            <button 
                                               onClick={() => handleUpdateShareholder(selectedEquityIndex, 'type', 'institution')}
                                               className={`flex-1 py-2 text-xs rounded-lg border ${selectedClient.equityStructure[selectedEquityIndex].type === 'institution' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600'}`}
                                            >
                                               机构
                                            </button>
                                         </div>
                                      </div>
                                      <button 
                                         onClick={() => handleDeleteShareholder(selectedEquityIndex)}
                                         className="w-full mt-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium flex items-center justify-center"
                                      >
                                         <Trash2 className="w-4 h-4 mr-2" /> 删除股东
                                      </button>
                                   </>
                                )}

                                {selectedEquityType === 'subsidiary' && selectedEquityIndex !== null && selectedClient.subsidiaries && (
                                   <>
                                      <div>
                                         <label className="block text-xs font-semibold text-slate-500 mb-1">公司名称</label>
                                         <input 
                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                            value={selectedClient.subsidiaries[selectedEquityIndex].name}
                                            onChange={(e) => handleUpdateSubsidiary(selectedEquityIndex, 'name', e.target.value)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-slate-500 mb-1">持股比例 (%)</label>
                                         <input 
                                            type="number"
                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                            value={selectedClient.subsidiaries[selectedEquityIndex].percentage}
                                            onChange={(e) => handleUpdateSubsidiary(selectedEquityIndex, 'percentage', parseFloat(e.target.value) || 0)}
                                         />
                                      </div>
                                      <div>
                                         <label className="block text-xs font-semibold text-slate-500 mb-1">行业</label>
                                         <input 
                                            className="w-full p-2 rounded-lg border border-slate-200 text-sm"
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
                                         className="w-full mt-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium flex items-center justify-center"
                                      >
                                         <Trash2 className="w-4 h-4 mr-2" /> 删除子公司
                                      </button>
                                   </>
                                )}
                             </div>
                         </div>
                         
                         {/* Floating Add Buttons */}
                         {!selectedEquityType && !isReadOnly && (
                            <div className="absolute bottom-6 right-6 flex flex-col space-y-3 z-20">
                               <button 
                                  onClick={handleAddShareholder}
                                  className="flex items-center bg-white shadow-lg border border-slate-100 px-4 py-2 rounded-full text-sm font-medium text-slate-700 hover:text-indigo-600 hover:scale-105 transition-all"
                               >
                                  <Plus className="w-4 h-4 mr-2" /> 添加股东
                               </button>
                               <button 
                                  onClick={handleAddSubsidiary}
                                  className="flex items-center bg-white shadow-lg border border-slate-100 px-4 py-2 rounded-full text-sm font-medium text-slate-700 hover:text-emerald-600 hover:scale-105 transition-all"
                               >
                                  <Plus className="w-4 h-4 mr-2" /> 添加对外投资
                               </button>
                            </div>
                         )}
                      </div>
                   )}

                   {activeTab === 'CONTACTS' && (
                      <div className="h-full p-6 flex flex-col md:flex-row gap-6">
                         <div className="flex-1 overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                               <h4 className="font-bold text-slate-800">联系人列表</h4>
                               {!isReadOnly && (
                                   <button 
                                      onClick={handleAddContact}
                                      className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100"
                                   >
                                      <Plus className="w-4 h-4 inline mr-1" /> 添加
                                   </button>
                               )}
                            </div>
                            <div className="space-y-3">
                               {selectedClient.contacts.map(contact => (
                                  <div 
                                    key={contact.id} 
                                    onClick={() => handleEditContact(contact)}
                                    className={`p-4 rounded-xl border transition-all ${editingContactId === contact.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-200'} ${isReadOnly ? '' : 'cursor-pointer'}`}
                                  >
                                     <div className="flex justify-between items-start">
                                        <div className="flex items-center">
                                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-3">
                                              {contact.name[0]}
                                           </div>
                                           <div>
                                              <p className="font-bold text-slate-800 text-sm">{contact.name}</p>
                                              <p className="text-xs text-slate-500">{contact.role}</p>
                                           </div>
                                        </div>
                                        {!isReadOnly && (
                                            <button 
                                               onClick={(e) => { e.stopPropagation(); handleDeleteContact(contact.id); }}
                                               className="text-slate-300 hover:text-red-500"
                                            >
                                               <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                     </div>
                                     <div className="mt-3 space-y-1">
                                        <div className="flex items-center text-xs text-slate-600">
                                           <Mail className="w-3 h-3 mr-2 text-slate-400" />
                                           {contact.email || '-'}
                                        </div>
                                        <div className="flex items-center text-xs text-slate-600">
                                           <Phone className="w-3 h-3 mr-2 text-slate-400" />
                                           {contact.phone || '-'}
                                        </div>
                                     </div>
                                  </div>
                               ))}
                               {selectedClient.contacts.length === 0 && (
                                  <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                     <ContactIcon className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                     <p className="text-sm">暂无联系人</p>
                                  </div>
                               )}
                            </div>
                         </div>
                         
                         {/* Contact Editor */}
                         {editingContactId && !isReadOnly && (
                            <div className="w-full md:w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
                               <h4 className="font-bold text-slate-800 mb-4">{editingContactId === 'NEW' ? '新建联系人' : '编辑联系人'}</h4>
                               <div className="space-y-4">
                                  <div>
                                     <label className="block text-xs font-semibold text-slate-500 mb-1">姓名</label>
                                     <input 
                                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                        value={tempContact.name || ''}
                                        onChange={e => setTempContact({...tempContact, name: e.target.value})}
                                        autoFocus
                                     />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-semibold text-slate-500 mb-1">职位</label>
                                     <input 
                                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                        value={tempContact.role || ''}
                                        onChange={e => setTempContact({...tempContact, role: e.target.value})}
                                     />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-semibold text-slate-500 mb-1">邮箱</label>
                                     <input 
                                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                        value={tempContact.email || ''}
                                        onChange={e => setTempContact({...tempContact, email: e.target.value})}
                                     />
                                  </div>
                                  <div>
                                     <label className="block text-xs font-semibold text-slate-500 mb-1">电话</label>
                                     <input 
                                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                        value={tempContact.phone || ''}
                                        onChange={e => setTempContact({...tempContact, phone: e.target.value})}
                                     />
                                  </div>
                                  <div className="flex gap-2 pt-2">
                                     <button 
                                        onClick={() => setEditingContactId(null)}
                                        className="flex-1 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium"
                                     >
                                        取消
                                     </button>
                                     <button 
                                        onClick={handleSaveContact}
                                        className="flex-1 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium"
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
             </div>
          </div>
       )}
    </div>
  );
};

const ShieldIcon = (props: any) => <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;