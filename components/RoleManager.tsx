import React, { useState } from 'react';
import { Role } from '../types';
import { Plus, Edit2, Trash2, ShieldCheck, X } from 'lucide-react';
import { upsertRole, deleteRole } from '../services/supabaseService';

interface RoleManagerProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
}

export const RoleManager: React.FC<RoleManagerProps> = ({ roles, setRoles }) => {
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);

  const handleSave = async () => {
    if (!editingRole?.name) return;
    const roleToSave = {
        id: editingRole.id || Date.now().toString(),
        name: editingRole.name,
        description: editingRole.description || ''
    } as Role;

    setRoles(prev => {
        const exists = prev.find(r => r.id === roleToSave.id);
        if (exists) return prev.map(r => r.id === roleToSave.id ? roleToSave : r);
        return [...prev, roleToSave];
    });

    await upsertRole(roleToSave);
    setEditingRole(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此角色吗？")) return;
    setRoles(prev => prev.filter(r => r.id !== id));
    await deleteRole(id);
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
             <ShieldCheck className="w-6 h-6 mr-3 text-indigo-600" />
             角色管理
          </h2>
          <button 
             onClick={() => setEditingRole({})}
             className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm"
          >
             <Plus className="w-5 h-5 mr-2" />
             添加角色
          </button>
       </div>

       <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full text-left text-sm">
             <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-6 py-4 font-semibold text-slate-600">角色名称</th>
                   <th className="px-6 py-4 font-semibold text-slate-600">描述</th>
                   <th className="px-6 py-4 font-semibold text-slate-600 text-right">操作</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {roles.length === 0 ? (
                   <tr>
                      <td colSpan={3} className="px-6 py-10 text-center text-slate-400">暂无角色数据</td>
                   </tr>
                ) : (
                   roles.map(role => (
                      <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 font-medium text-slate-800">{role.name}</td>
                         <td className="px-6 py-4 text-slate-600">{role.description}</td>
                         <td className="px-6 py-4 text-right">
                            <button onClick={() => setEditingRole(role)} className="text-indigo-600 hover:text-indigo-800 mx-2"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => handleDelete(role.id)} className="text-red-500 hover:text-red-700 mx-2"><Trash2 className="w-4 h-4"/></button>
                         </td>
                      </tr>
                   ))
                )}
             </tbody>
          </table>
       </div>

       {/* Edit Modal */}
       {editingRole && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 w-[400px] shadow-2xl animate-scale-in">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-slate-800">
                     {editingRole.id ? '编辑角色' : '添加角色'}
                  </h3>
                  <button onClick={() => setEditingRole(null)} className="text-slate-400 hover:text-slate-600">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">角色名称</label>
                     <input 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editingRole.name || ''}
                        onChange={e => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="例如：销售经理"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">描述</label>
                     <textarea 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none"
                        value={editingRole.description || ''}
                        onChange={e => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="角色职责描述..."
                     />
                  </div>
                  <button 
                     onClick={handleSave}
                     className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium mt-2"
                  >
                     保存
                  </button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};