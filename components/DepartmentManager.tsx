import React, { useState } from 'react';
import { Department, DepartmentNode, User } from '../types';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, FolderTree, Save, X, Network as NetworkIcon, Users } from 'lucide-react';
import { upsertDepartment, deleteDepartment } from '../services/supabaseService';

interface DepartmentManagerProps {
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  users: User[];
}

export const DepartmentManager: React.FC<DepartmentManagerProps> = ({ departments, setDepartments, users }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);

  // Helper to build tree
  const buildTree = (items: Department[]): DepartmentNode[] => {
    const map = new Map<string, DepartmentNode>();
    const roots: DepartmentNode[] = [];

    // Init map
    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    // Connect
    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const handleSave = async () => {
    if (!editingDept?.name) return;
    const deptToSave = {
        id: editingDept.id || Date.now().toString(),
        name: editingDept.name,
        parentId: editingDept.parentId || null,
        managerId: editingDept.managerId
    } as Department;

    // Update Local
    setDepartments(prev => {
        const exists = prev.find(d => d.id === deptToSave.id);
        if (exists) return prev.map(d => d.id === deptToSave.id ? deptToSave : d);
        return [...prev, deptToSave];
    });

    // Sync DB
    await upsertDepartment(deptToSave);
    setEditingDept(null);
  };

  const handleDelete = async (id: string) => {
    // Logic 1: Check for children
    if (departments.some(d => d.parentId === id)) {
      alert("无法删除：该部门下包含子部门，请先删除或移动子部门。");
      return;
    }

    // Logic 2: Check for associated users
    const usersInDept = users.filter(u => u.departmentId === id);
    if (usersInDept.length > 0) {
      alert(`无法删除：该部门下仍有 ${usersInDept.length} 名员工。请先在“用户管理”中转移或删除这些员工。`);
      return;
    }

    if (!confirm("确定要删除此部门吗？此操作无法撤销。")) return;

    setDepartments(prev => prev.filter(d => d.id !== id));
    await deleteDepartment(id);
  };

  const TreeItem: React.FC<{ node: DepartmentNode; level?: number }> = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    
    // Calculate user count for this department (direct only)
    const userCount = users.filter(u => u.departmentId === node.id).length;

    return (
      <div className="select-none">
        <div 
          className={`flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg group transition-colors ${level > 0 ? 'ml-6 border-l border-slate-100 pl-4' : ''}`}
        >
          <div className="flex items-center flex-1">
            <button 
              onClick={() => hasChildren && toggleExpand(node.id)}
              className={`p-1 rounded hover:bg-slate-200 mr-2 ${!hasChildren ? 'invisible' : ''}`}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500"/> : <ChevronRight className="w-4 h-4 text-slate-500"/>}
            </button>
            <FolderTree className={`w-5 h-5 mr-3 ${level === 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
            <div>
               <span className="text-sm font-medium text-slate-700">{node.name}</span>
               {userCount > 0 && (
                 <span className="ml-2 text-xs text-slate-400 flex inline-flex items-center bg-slate-100 px-1.5 py-0.5 rounded-full">
                   <Users className="w-3 h-3 mr-1" /> {userCount}
                 </span>
               )}
            </div>
          </div>
          
          <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
             <button 
                onClick={() => setEditingDept({ parentId: node.id })}
                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                title="添加子部门"
             >
                <Plus className="w-4 h-4" />
             </button>
             <button 
                onClick={() => setEditingDept(node)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                title="编辑"
             >
                <Edit2 className="w-4 h-4" />
             </button>
             <button 
                onClick={() => handleDelete(node.id)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="删除"
             >
                <Trash2 className="w-4 h-4" />
             </button>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="animate-fade-in-down">
            {node.children!.map(child => <TreeItem key={child.id} node={child} level={level + 1} />)}
          </div>
        )}
      </div>
    );
  };

  const treeData = buildTree(departments);

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
             <NetworkIcon className="w-6 h-6 mr-3 text-indigo-600" />
             部门管理
          </h2>
          <button 
             onClick={() => setEditingDept({ parentId: null })}
             className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm transition-colors"
          >
             <Plus className="w-5 h-5 mr-2" />
             添加根部门
          </button>
       </div>

       <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex-1 overflow-y-auto">
          {treeData.length === 0 ? (
             <div className="text-center py-20 text-slate-400">
                <FolderTree className="w-16 h-16 mx-auto mb-4 opacity-10" />
                <p>暂无部门数据，请添加您的组织架构。</p>
             </div>
          ) : (
             <div className="space-y-1">
                {treeData.map(node => <TreeItem key={node.id} node={node} />)}
             </div>
          )}
       </div>

       {/* Edit Modal */}
       {editingDept && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 w-[400px] shadow-2xl animate-scale-in">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800">
                     {editingDept.id ? '编辑部门' : '添加部门'}
                  </h3>
                  <button onClick={() => setEditingDept(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                     <X className="w-6 h-6" />
                  </button>
               </div>
               
               <div className="space-y-5">
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">部门名称</label>
                     <input 
                        className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 focus:bg-white transition-all"
                        value={editingDept.name || ''}
                        onChange={e => setEditingDept(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="输入部门名称"
                        autoFocus
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">上级部门</label>
                     <select 
                        className="w-full p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={editingDept.parentId || ''}
                        onChange={e => setEditingDept(prev => ({ ...prev, parentId: e.target.value || null }))}
                     >
                        <option value="">(无 - 根部门)</option>
                        {departments.filter(d => d.id !== editingDept.id).map(d => (
                           <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                     </select>
                  </div>
                  
                  <div className="pt-2">
                    <button 
                       onClick={handleSave}
                       className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                    >
                       保存
                    </button>
                  </div>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};