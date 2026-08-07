import React, { useState, useEffect } from 'react';
import { Client, ClientStatus, ClientType, TypeProfile, AgreementInfo, ProjectInfo, CustomFieldDefinition, Contact, Shareholder, Subsidiary, User, AIModelType } from '../types';
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
import { upsertClient, deleteClient } from '../services/apiService';
import ClientDetailTabs, { NATIONAL_STANDARD_INDUSTRIES, CLIENT_TYPES } from './ClientDetailTabs';

const ITEMS_PER_PAGE = 10;

const CLIENT_TYPE_BADGE: Record<string, string> = {
  '地方政府': 'badge-warning',
  '金融机构': 'badge-info',
  '产业客户': 'badge-success',
};

interface ClientManagerProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  fieldDefinitions?: CustomFieldDefinition[];
  currentUser?: User;
  initialSearchTerm?: string;
  shouldCreateNew?: boolean;
  onResetTrigger?: () => void;
}

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
  const [typeFilter, setTypeFilter] = useState<ClientType | ''>('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // States within Modal
  const [isSaving, setIsSaving] = useState(false);

  // Batch Operations State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // --- External Control Effects ---
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchTerm(initialSearchTerm);
      if (initialSearchTerm) {
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
      if (!client) return true;
      if (currentUser?.role === '管理员') return true;
      if (client.ownerId && currentUser?.id === client.ownerId) return true;
      return false;
  };

  const isReadOnly = selectedClient ? !canEdit(selectedClient) : false;

  const filteredClients = clients.filter(c => 
    (typeFilter === '' || c.clientType === typeFilter) && (
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.region.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.ownerName?.toLowerCase().includes(searchTerm.toLowerCase()))
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
      
      const idsToDelete: string[] = Array.from(selectedIds);
      setClients(prev => prev.filter(c => !selectedIds.has(c.id)));
      setSelectedIds(new Set());
      
      for (const id of idsToDelete) {
          await deleteClient(id);
      }
  };

  const handleBatchExport = () => {
      const selectedData = clients.filter(c => selectedIds.has(c.id));
      const csvHeader = 'ID,Name,Type,Industry,Region,Owner\n';
      const csvRows = selectedData.map(c => 
          `${c.id},"${c.name}",${c.clientType || ''},${c.industry},"${c.region}",${c.ownerName}`
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
      tags: [],
      customFields: {},
      typeProfile: { reportingUnit: '安徽省分公司' },
      ownerId: currentUser?.id,
      ownerName: currentUser?.name || "未知用户"
    };
    setSelectedClient(newClient);
  };

  const handleSaveClient = async () => {
    if (!selectedClient || isReadOnly) return;
    if (!selectedClient.name.trim()) {
      alert("客户名称不能为空");
      return;
    }
    if (!selectedClient.clientType) {
      alert("请选择客户类型（地方政府/金融机构/产业客户）");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const clientToSave: Client = {
        id: selectedClient.id,
        name: selectedClient.name,
        industry: selectedClient.industry || '',
        status: selectedClient.status || ClientStatus.Lead,
        clientType: selectedClient.clientType,
        region: selectedClient.region || '',
        contacts: selectedClient.contacts || [],
        customFields: selectedClient.customFields || {},
        typeProfile: selectedClient.typeProfile || {},
        ownerId: selectedClient.ownerId,
        ownerName: selectedClient.ownerName,
        
        equityStructure: selectedClient.equityStructure || [],
        subsidiaries: selectedClient.subsidiaries || [],
        financialAnalysis: selectedClient.financialAnalysis || '',
        supplyChainInfo: selectedClient.supplyChainInfo || '',
        tags: selectedClient.tags || []
      };

      await upsertClient(clientToSave);
      
      setClients(prev => {
        const exists = prev.find(c => c.id === clientToSave.id);
        if (exists) return prev.map(c => c.id === clientToSave.id ? clientToSave : c);
        return [clientToSave, ...prev];
      });

      setIsSaving(false);
      setSelectedClient(null);
    } catch (error: unknown) {
      console.error("Failed to save client:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.startsWith("PARTIAL_SUCCESS:")) {
         const msg = errorMessage.replace("PARTIAL_SUCCESS: ", "");
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

      alert(`保存失败: ${errorMessage || '请检查网络或配置'}`);
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm("确定要删除此客户吗？\n注意：如果数据库未配置级联删除，且该客户下有拜访记录，删除可能会失败。")) return;
    
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);

    await deleteClient(id);
  };

  return (
    <div className="h-full flex flex-col relative">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
         <div className="flex items-center">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mr-3 shadow-md">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">客户管理</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-0.5">共 {clients.length} 个客户</p>
            </div>
         </div>
         <div className="flex gap-3">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] w-4 h-4" />
               <input 
                  type="text" 
                  placeholder="搜索客户..." 
                  className="input pl-10 pr-4 py-2.5 text-sm w-64"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
               />
            </div>
            <select
               className="input py-2.5 text-sm w-36"
               value={typeFilter}
               onChange={(e) => { setTypeFilter(e.target.value as ClientType | ''); setCurrentPage(1); }}
            >
               <option value="">全部类型</option>
               {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button 
               onClick={handleAddMockClient}
               className="btn btn-primary"
            >
               <Plus className="w-4 h-4" />
               新建客户
            </button>
         </div>
       </div>

       {/* Client Table List View */}
       <div className="card flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto">
             <table className="table">
                <thead>
                   <tr>
                      <th className="w-12">
                          <button onClick={handleSelectAll} className="flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--primary-600)] transition-colors">
                              {selectedIds.size > 0 && selectedIds.size === paginatedClients.length 
                                  ? <CheckSquare className="w-5 h-5 text-[var(--primary-600)]" /> 
                                  : <SquareIcon className="w-5 h-5" />}
                          </button>
                      </th>
                      <th>客户名称</th>
                      <th>客户类型</th>
                      <th>行业/地区</th>
                      <th>主要联系人</th>
                      <th>负责人</th>
                      <th className="text-right">操作</th>
                   </tr>
                </thead>
                <tbody>
                   {paginatedClients.map(client => {
                      const firstContact = client.contacts && client.contacts.length > 0 ? client.contacts[0] : null;
                      const hasPermission = canEdit(client);
                      const isSelected = selectedIds.has(client.id);
                      return (
                         <tr 
                           key={client.id} 
                           onClick={() => setSelectedClient(client)}
                           className={`cursor-pointer ${isSelected ? 'bg-[var(--primary-50)]' : ''}`}
                         >
                            <td onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleSelectOne(client.id)} className="flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--primary-600)] transition-colors">
                                    {isSelected ? <CheckSquare className="w-5 h-5 text-[var(--primary-600)]" /> : <SquareIcon className="w-5 h-5" />}
                                </button>
                            </td>
                            <td>
                               <div className="flex items-center">
                                  <div className="w-10 h-10 rounded-xl gradient-primary flex-shrink-0 flex items-center justify-center text-white font-bold text-sm mr-3 shadow-sm">
                                     {client.name.substring(0, 1)}
                                  </div>
                                  <div className="font-semibold text-[var(--text-primary)]">{client.name}</div>
                               </div>
                            </td>
                            <td>
                               {client.clientType ? (
                                  <span className={`badge ${CLIENT_TYPE_BADGE[client.clientType] || ''}`}>{client.clientType}</span>
                               ) : (
                                  <span className="badge">未分类</span>
                               )}
                            </td>
                            <td>
                               <div className="flex flex-col gap-1">
                                  <span className="text-[var(--text-secondary)] flex items-center text-xs">
                                    <Briefcase className="w-3 h-3 mr-1.5 text-[var(--text-tertiary)]"/> {client.industry}
                                  </span>
                                  <span className="text-[var(--text-tertiary)] flex items-center text-xs">
                                    <MapPin className="w-3 h-3 mr-1.5"/> {client.region || '未填写'}
                                  </span>
                               </div>
                            </td>
                            <td>
                               {firstContact ? (
                                  <div className="text-xs">
                                     <div className="font-medium text-[var(--text-primary)]">{firstContact.name} <span className="text-[var(--text-tertiary)]">({firstContact.role})</span></div>
                                     <div className="text-[var(--text-secondary)] mt-0.5">{firstContact.phone}</div>
                                  </div>
                               ) : (
                                  <span className="text-xs text-[var(--text-tertiary)] italic">无联系人</span>
                               )}
                            </td>
                            <td>
                               <div className="flex items-center text-xs text-[var(--text-secondary)]">
                                  <UserIcon className="w-3 h-3 mr-1.5 text-[var(--text-tertiary)]"/>
                                  {client.ownerName || 'Unknown'}
                               </div>
                            </td>
                            <td className="text-right">
                               {hasPermission && (
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.id); }}
                                      className="p-2 text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--danger-light)] rounded-lg transition-all"
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
                         <td colSpan={7} className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center text-[var(--text-tertiary)]">
                               <Users className="w-12 h-12 mb-3 opacity-20" />
                               <p className="text-sm">未找到相关客户</p>
                            </div>
                         </td>
                      </tr>
                   )}
                </tbody>
             </table>
          </div>
          
          {/* Pagination Controls */}
          {filteredClients.length > 0 && (
            <div className="px-6 py-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)] flex justify-between items-center">
               <span className="text-sm text-[var(--text-secondary)]">
                  显示 <span className="font-medium text-[var(--text-primary)]">{Math.min(filteredClients.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(filteredClients.length, currentPage * ITEMS_PER_PAGE)}</span> 共 <span className="font-medium text-[var(--text-primary)]">{filteredClients.length}</span> 条
               </span>
               <div className="flex items-center gap-2">
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     className="btn btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-medium text-[var(--text-primary)] px-4">
                     {currentPage} / {totalPages}
                  </span>
                  <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     className="btn btn-secondary px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <ChevronRight className="w-4 h-4" />
                  </button>
               </div>
            </div>
          )}
       </div>

       {/* Batch Action Bar */}
       {selectedIds.size > 0 && (
           <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 glass-dark text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-20 animate-fade-in-up">
               <span className="text-sm font-medium pr-4 border-r border-white/20">
                  <span className="text-[var(--primary-400)] font-bold text-lg">{selectedIds.size}</span> 个已选中
               </span>
               
               <button onClick={handleBatchExport} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors text-sm">
                   <Download className="w-4 h-4 text-[var(--primary-400)]" />
                   <span>导出 CSV</span>
               </button>
               
               <button onClick={handleBatchDelete} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--danger)]/20 transition-colors text-sm text-[var(--danger-light)]">
                   <Trash2 className="w-4 h-4" />
                   <span>删除</span>
               </button>

               <button onClick={() => setSelectedIds(new Set())} className="ml-2 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                   <X className="w-4 h-4" />
               </button>
           </div>
       )}

       {/* Detail Modal */}
       {selectedClient && (
          <div className="fixed inset-0 bg-[var(--text-primary)]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
             <div className="bg-[var(--bg-primary)] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-5 border-b border-[var(--border-light)] bg-[var(--bg-secondary)]">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white font-bold text-xl shadow-md">
                         {selectedClient.name.substring(0, 1)}
                      </div>
                      <div>
                         <input 
                            className="font-bold text-lg text-[var(--text-primary)] bg-transparent border-none focus:ring-0 p-0 w-64 focus:bg-[var(--bg-primary)] focus:px-2 rounded transition-all disabled:bg-transparent disabled:text-[var(--text-secondary)]"
                            value={selectedClient.name}
                            onChange={(e) => setSelectedClient({...selectedClient, name: e.target.value})}
                            disabled={isReadOnly}
                         />
                         <p className="text-xs text-[var(--text-tertiary)] mt-0.5">ID: {selectedClient.id}</p>
                      </div>
                   </div>
                </div>
                <ClientDetailTabs
                   key={selectedClient.id}
                   client={selectedClient}
                   update={(fn) => setSelectedClient(prev => (prev ? fn(prev) : prev))}
                   isReadOnly={isReadOnly}
                   fieldDefinitions={fieldDefinitions}
                   isSaving={isSaving}
                   onSave={handleSaveClient}
                />
             </div>
          </div>
       )}
    </div>
  );
};

export default ClientManager;
