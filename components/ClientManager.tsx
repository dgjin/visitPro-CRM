import React, { useState } from 'react';
import { Client, ClientStatus, CustomFieldDefinition, Contact, Shareholder, User } from '../types';
import { 
  Search, Plus, MapPin, Mail, Phone, Building, Briefcase, 
  X, Loader2, BarChart2, Users, Save, Edit2, Trash2, PieChart as PieIcon,
  Contact as ContactIcon,
  ChevronRight,
  User as UserIcon,
  Maximize2,
  Minimize2
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

interface ClientManagerProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  fieldDefinitions?: CustomFieldDefinition[];
  currentUser?: User;
}

export const ClientManager: React.FC<ClientManagerProps> = ({ clients, setClients, fieldDefinitions = [], currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'BASIC' | 'EQUITY' | 'CONTACTS'>('BASIC');
  const [expandedField, setExpandedField] = useState<'financial' | 'supply' | null>(null);
  
  // States within Modal
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Contact Editing State
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [tempContact, setTempContact] = useState<Partial<Contact>>({});

  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ownerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateProfile = async () => {
    if (!selectedClient) return;
    setIsProfileLoading(true);
    try {
      const profile = await generateClientProfile(selectedClient.name, selectedClient.industry, selectedClient.region);
      setSelectedClient(prev => prev ? {
        ...prev,
        equityStructure: profile.equity, // Now array
        financialAnalysis: profile.financials,
        supplyChainInfo: profile.supplyChain,
      } : null);
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
  
  const handleUpdateCustomField = (key: string, value: string) => {
    if (!selectedClient) return;
    setSelectedClient(prev => prev ? {
      ...prev,
      customFields: { ...prev.customFields, [key]: value }
    } : null);
  };

  const handleSaveClient = async () => {
    if (!selectedClient) return;
    if (!selectedClient.name.trim()) {
      alert("客户名称不能为空");
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Ensure data integrity for Supabase
      const clientToSave: Client = {
        id: selectedClient.id,
        name: selectedClient.name,
        industry: selectedClient.industry || '',
        status: selectedClient.status,
        region: selectedClient.region || '',
        contacts: selectedClient.contacts || [],
        customFields: selectedClient.customFields || {},
        ownerId: selectedClient.ownerId,
        ownerName: selectedClient.ownerName,
        equityStructure: selectedClient.equityStructure || [],
        financialAnalysis: selectedClient.financialAnalysis || '',
        supplyChainInfo: selectedClient.supplyChainInfo || ''
      };

      // 1. Sync to Supabase
      await upsertClient(clientToSave);
      
      // 2. Optimistic Update (or post-save update)
      setClients(prev => {
        const exists = prev.find(c => c.id === clientToSave.id);
        if (exists) return prev.map(c => c.id === clientToSave.id ? clientToSave : c);
        return [clientToSave, ...prev];
      });

      setIsSaving(false);
      setSelectedClient(null);
    } catch (err) {
      console.error("Failed to save client:", err);
      alert("保存客户失败，请检查网络或配置。");
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除此客户吗？此操作无法撤销。")) return;
    
    setClients(prev => prev.filter(c => c.id !== id));
    await deleteClient(id);
    if (selectedClient?.id === id) setSelectedClient(null);
  };

  // --- Contact Handlers ---
  const handleAddContact = () => {
    setTempContact({ id: Date.now().toString(), name: '', role: '', email: '', phone: '' });
    setEditingContactId('NEW');
  };

  const handleEditContact = (contact: Contact) => {
    setTempContact(contact);
    setEditingContactId(contact.id);
  };

  const handleSaveContact = () => {
    if (!selectedClient || !tempContact.name) return;
    
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
    if (!selectedClient) return;
    if (!confirm("确认删除此联系人？")) return;
    setSelectedClient({
       ...selectedClient,
       contacts: selectedClient.contacts.filter(c => c.id !== id)
    });
  };

  // --- Equity Handlers ---
  const handleAddShareholder = () => {
     if (!selectedClient) return;
     const currentEquity = selectedClient.equityStructure || [];
     setSelectedClient({
        ...selectedClient,
        equityStructure: [...currentEquity, { name: '新股东', percentage: 0, type: 'individual' }]
     });
  };

  const handleUpdateShareholder = (index: number, field: keyof Shareholder, value: any) => {
     if (!selectedClient || !selectedClient.equityStructure) return;
     const newEquity = [...selectedClient.equityStructure];
     newEquity[index] = { ...newEquity[index], [field]: value };
     setSelectedClient({ ...selectedClient, equityStructure: newEquity });
  };

  const handleDeleteShareholder = (index: number) => {
     if (!selectedClient || !selectedClient.equityStructure) return;
     const newEquity = [...selectedClient.equityStructure];
     newEquity.splice(index, 1);
     setSelectedClient({ ...selectedClient, equityStructure: newEquity });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="搜索客户、行业或负责人..." 
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={handleAddMockClient}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          添加客户
        </button>
      </div>

      {/* Client List (Table View) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 font-semibold text-slate-600">客户名称</th>
              <th className="px-6 py-4 font-semibold text-slate-600">行业</th>
              <th className="px-6 py-4 font-semibold text-slate-600">区域</th>
              <th className="px-6 py-4 font-semibold text-slate-600">状态</th>
              <th className="px-6 py-4 font-semibold text-slate-600">负责人</th>
              <th className="px-6 py-4 font-semibold text-slate-600 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                  没有找到匹配的客户
                </td>
              </tr>
            ) : (
              filteredClients.map(client => {
                const canDelete = currentUser?.role === '管理员' || (client.ownerId && currentUser?.id === client.ownerId);
                return (
                  <tr 
                    key={client.id} 
                    onClick={() => { setSelectedClient(client); setActiveTab('BASIC'); }}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs mr-3 flex-shrink-0 ${
                          client.status === ClientStatus.Active ? 'bg-emerald-500' :
                          client.status === ClientStatus.Lead ? 'bg-blue-500' : 'bg-slate-400'
                        }`}>
                          {client.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-800">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{client.industry}</td>
                    <td className="px-6 py-4 text-slate-600 flex items-center">
                      {client.region ? (
                         <><MapPin className="w-3 h-3 mr-1 text-slate-400" /> {client.region}</>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        client.status === ClientStatus.Active ? 'bg-emerald-50 text-emerald-600' :
                        client.status === ClientStatus.Lead ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center">
                        <UserIcon className="w-3 h-3 mr-1 text-slate-400" />
                        {client.ownerName || '未分配'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => { setSelectedClient(client); setActiveTab('BASIC'); }}
                        className="text-indigo-600 hover:text-indigo-800 mx-2 p-1 hover:bg-indigo-50 rounded"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4"/>
                      </button>
                      {canDelete && (
                        <button 
                          onClick={(e) => handleDeleteClient(client.id, e)} 
                          className="text-red-500 hover:text-red-700 mx-2 p-1 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Detail Modal */}
      {selectedClient && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end">
          <div className="w-full md:w-[700px] bg-white h-full shadow-2xl overflow-hidden animate-slide-in-right flex flex-col">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-white z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {selectedClient.id && filteredClients.find(c => c.id === selectedClient.id) ? '编辑客户' : '新增客户'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">{selectedClient.name || '未命名'}</p>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={handleSaveClient}
                  disabled={isSaving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <Save className="w-4 h-4 mr-2" />}
                  保存
                </button>
                <button 
                  onClick={() => setSelectedClient(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-2 border-b border-slate-100 flex space-x-6 bg-white">
               <button 
                  onClick={() => setActiveTab('BASIC')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'BASIC' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
               >
                 基础信息
               </button>
               <button 
                  onClick={() => setActiveTab('EQUITY')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'EQUITY' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
               >
                 股权结构
               </button>
               <button 
                  onClick={() => setActiveTab('CONTACTS')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'CONTACTS' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
               >
                 联系人 ({selectedClient.contacts.length})
               </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
               
               {/* --- BASIC INFO TAB --- */}
               {activeTab === 'BASIC' && (
                  <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center mb-2">
                        <Building className="w-4 h-4 mr-2 text-indigo-600" /> 基本资料
                      </h3>
                      
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">客户名称 <span className="text-red-500">*</span></label>
                        <input 
                          type="text"
                          className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          value={selectedClient.name}
                          onChange={(e) => setSelectedClient(prev => prev ? {...prev, name: e.target.value} : null)}
                          placeholder="输入公司全称"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">所属行业 (国标一级)</label>
                          <select
                            className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                            value={selectedClient.industry}
                            onChange={(e) => setSelectedClient(prev => prev ? {...prev, industry: e.target.value} : null)}
                          >
                            <option value="">请选择行业</option>
                            {NATIONAL_STANDARD_INDUSTRIES.map(ind => (
                              <option key={ind} value={ind}>{ind}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">客户状态</label>
                          <select
                            className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                            value={selectedClient.status}
                            onChange={(e) => setSelectedClient(prev => prev ? {...prev, status: e.target.value as ClientStatus} : null)}
                          >
                            {Object.values(ClientStatus).map(status => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">所在区域</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text"
                            className="w-full pl-9 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            value={selectedClient.region}
                            onChange={(e) => setSelectedClient(prev => prev ? {...prev, region: e.target.value} : null)}
                            placeholder="例如：北京, 海淀区"
                          />
                        </div>
                      </div>
                      
                      {/* Owner Field in Edit Mode */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">负责人</label>
                        <div className="relative">
                           <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                           <input 
                              type="text"
                              className="w-full pl-9 p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-500"
                              value={selectedClient.ownerName || '未分配'}
                              readOnly
                              title="负责人由创建人自动分配，暂不支持修改"
                           />
                        </div>
                      </div>
                    </div>

                    {/* Extended Fields */}
                    {fieldDefinitions.length > 0 && (
                       <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                          <h3 className="text-sm font-bold text-slate-800 flex items-center mb-2">
                            <Briefcase className="w-4 h-4 mr-2 text-indigo-600" /> 扩展信息
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {fieldDefinitions.map(field => (
                              <div key={field.id}>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">{field.label}</label>
                                {field.type === 'select' ? (
                                  <select
                                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={selectedClient.customFields?.[field.key] || ''}
                                    onChange={(e) => handleUpdateCustomField(field.key, e.target.value)}
                                  >
                                    <option value="">请选择</option>
                                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                ) : (
                                  <input 
                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={selectedClient.customFields?.[field.key] || ''}
                                    onChange={(e) => handleUpdateCustomField(field.key, e.target.value)}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                       </div>
                    )}
                    
                    {/* Financial & Supply Chain (Text only) with Expandable View */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center">
                         <h3 className="text-sm font-bold text-slate-800 flex items-center mb-2">
                           <BarChart2 className="w-4 h-4 mr-2 text-indigo-600" /> AI 经营分析
                         </h3>
                         <button 
                            onClick={handleGenerateProfile}
                            disabled={isProfileLoading || !selectedClient.industry || !selectedClient.region}
                            className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-md hover:bg-indigo-100 disabled:opacity-50"
                         >
                            {isProfileLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'AI 更新画像'}
                         </button>
                      </div>
                      <div className="space-y-3">
                         {/* Financial Analysis */}
                         <div className={`${expandedField === 'financial' ? 'fixed inset-0 z-50 bg-white p-6 flex flex-col' : 'relative'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase">财务分析</label>
                                <button 
                                  onClick={() => setExpandedField(expandedField === 'financial' ? null : 'financial')}
                                  className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100"
                                  title={expandedField === 'financial' ? "最小化" : "全屏编辑"}
                                >
                                   {expandedField === 'financial' ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-3 h-3"/>}
                                </button>
                            </div>
                            <textarea
                              className={`w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${expandedField === 'financial' ? 'flex-1 text-base' : 'h-20'}`}
                              value={selectedClient.financialAnalysis || ''}
                              readOnly={false} // Allow editing
                              onChange={(e) => setSelectedClient(prev => prev ? {...prev, financialAnalysis: e.target.value} : null)}
                              placeholder="点击“AI 更新画像”自动生成，或手动输入..."
                            />
                         </div>

                         {/* Supply Chain Info */}
                         <div className={`${expandedField === 'supply' ? 'fixed inset-0 z-50 bg-white p-6 flex flex-col' : 'relative'}`}>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-semibold text-slate-500 uppercase">供应链信息</label>
                                <button 
                                  onClick={() => setExpandedField(expandedField === 'supply' ? null : 'supply')}
                                  className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100"
                                  title={expandedField === 'supply' ? "最小化" : "全屏编辑"}
                                >
                                   {expandedField === 'supply' ? <Minimize2 className="w-4 h-4"/> : <Maximize2 className="w-3 h-3"/>}
                                </button>
                            </div>
                            <textarea
                              className={`w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 ${expandedField === 'supply' ? 'flex-1 text-base' : 'h-20'}`}
                              value={selectedClient.supplyChainInfo || ''}
                              readOnly={false}
                              onChange={(e) => setSelectedClient(prev => prev ? {...prev, supplyChainInfo: e.target.value} : null)}
                              placeholder="点击“AI 更新画像”自动生成，或手动输入..."
                            />
                         </div>
                      </div>
                    </div>
                  </div>
               )}

               {/* --- EQUITY STRUCTURE TAB --- */}
               {activeTab === 'EQUITY' && (
                  <div className="space-y-6">
                     <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                        <div>
                          <h3 className="text-sm font-bold text-indigo-900">股权结构图谱</h3>
                          <p className="text-xs text-indigo-600 mt-1">AI 自动生成或手动维护的股东信息</p>
                        </div>
                        <button 
                           onClick={handleGenerateProfile}
                           disabled={isProfileLoading}
                           className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-50 disabled:opacity-50 flex items-center"
                        >
                           {isProfileLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <PieIcon className="w-3 h-3 mr-1"/>}
                           AI 智能获取
                        </button>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Visualization */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm h-64 flex flex-col items-center justify-center">
                           {!selectedClient.equityStructure || selectedClient.equityStructure.length === 0 ? (
                              <div className="text-center text-slate-400">
                                 <PieIcon className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                 <p className="text-xs">暂无数据</p>
                              </div>
                           ) : (
                             <ResponsiveContainer width="100%" height="100%">
                               <PieChart>
                                 <Pie
                                   data={selectedClient.equityStructure}
                                   cx="50%"
                                   cy="50%"
                                   innerRadius={60}
                                   outerRadius={80}
                                   paddingAngle={5}
                                   dataKey="percentage"
                                 >
                                   {selectedClient.equityStructure.map((entry, index) => (
                                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                   ))}
                                 </Pie>
                                 <RechartsTooltip />
                                 <Legend verticalAlign="bottom" height={36}/>
                               </PieChart>
                             </ResponsiveContainer>
                           )}
                        </div>
                        
                        {/* Edit List */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                           <div className="flex justify-between items-center mb-3">
                              <h4 className="text-sm font-bold text-slate-700">股东列表</h4>
                              <button onClick={handleAddShareholder} className="text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded flex items-center">
                                 <Plus className="w-3 h-3 mr-1" /> 添加
                              </button>
                           </div>
                           <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                              {(!selectedClient.equityStructure || selectedClient.equityStructure.length === 0) && (
                                 <p className="text-xs text-slate-400 text-center py-4">请添加股东或使用 AI 获取</p>
                              )}
                              {selectedClient.equityStructure?.map((shareholder, idx) => (
                                 <div key={idx} className="flex items-center gap-2 text-sm">
                                    <input 
                                       className="flex-1 border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                       value={shareholder.name}
                                       onChange={(e) => handleUpdateShareholder(idx, 'name', e.target.value)}
                                       placeholder="股东名称"
                                    />
                                    <div className="relative w-16">
                                       <input 
                                          type="number"
                                          className="w-full border border-slate-200 rounded px-2 py-1 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                          value={shareholder.percentage}
                                          onChange={(e) => handleUpdateShareholder(idx, 'percentage', parseFloat(e.target.value))}
                                       />
                                       <span className="absolute right-1 top-1 text-xs text-slate-400">%</span>
                                    </div>
                                    <button onClick={() => handleDeleteShareholder(idx)} className="text-slate-400 hover:text-red-500">
                                       <X className="w-4 h-4" />
                                    </button>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
               )}

               {/* --- CONTACTS TAB --- */}
               {activeTab === 'CONTACTS' && (
                  <div className="space-y-4">
                     {/* List */}
                     {selectedClient.contacts.map(contact => (
                        <div key={contact.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-start group">
                           <div className="flex items-start">
                              <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold mr-3">
                                 {contact.name.charAt(0)}
                              </div>
                              <div>
                                 <h4 className="font-bold text-slate-800">{contact.name}</h4>
                                 <p className="text-xs text-slate-500 mb-1">{contact.role}</p>
                                 <div className="flex flex-col space-y-1">
                                    {contact.email && <a href={`mailto:${contact.email}`} className="text-xs text-slate-600 hover:text-indigo-600 flex items-center"><Mail className="w-3 h-3 mr-1.5"/> {contact.email}</a>}
                                    {contact.phone && <a href={`tel:${contact.phone}`} className="text-xs text-slate-600 hover:text-indigo-600 flex items-center"><Phone className="w-3 h-3 mr-1.5"/> {contact.phone}</a>}
                                 </div>
                              </div>
                           </div>
                           <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEditContact(contact)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                                 <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteContact(contact.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </div>
                        </div>
                     ))}
                     
                     {/* Add Button */}
                     <button 
                        onClick={handleAddContact}
                        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center font-medium text-sm"
                     >
                        <Plus className="w-4 h-4 mr-2" /> 添加联系人
                     </button>
                     
                     {/* Edit Modal (Nested) */}
                     {editingContactId && (
                        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center backdrop-blur-sm">
                           <div className="bg-white rounded-2xl p-6 w-[400px] shadow-xl animate-scale-in">
                              <h3 className="text-lg font-bold text-slate-800 mb-4">{editingContactId === 'NEW' ? '新增联系人' : '编辑联系人'}</h3>
                              <div className="space-y-3">
                                 <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">姓名</label>
                                    <input 
                                       className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                       value={tempContact.name || ''}
                                       onChange={(e) => setTempContact({...tempContact, name: e.target.value})}
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">职位</label>
                                    <input 
                                       className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                       value={tempContact.role || ''}
                                       onChange={(e) => setTempContact({...tempContact, role: e.target.value})}
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">邮箱</label>
                                    <input 
                                       className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                       value={tempContact.email || ''}
                                       onChange={(e) => setTempContact({...tempContact, email: e.target.value})}
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">电话</label>
                                    <input 
                                       className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                       value={tempContact.phone || ''}
                                       onChange={(e) => setTempContact({...tempContact, phone: e.target.value})}
                                    />
                                 </div>
                              </div>
                              <div className="flex gap-3 mt-6">
                                 <button 
                                    onClick={() => setEditingContactId(null)}
                                    className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium"
                                 >
                                    取消
                                 </button>
                                 <button 
                                    onClick={handleSaveContact}
                                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium"
                                 >
                                    保存
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