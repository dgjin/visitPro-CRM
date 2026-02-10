import React, { useState } from 'react';
import { User, Role, Department } from '../types';
import { Plus, Edit2, Trash2, UserCog, X, Search } from 'lucide-react';
import { upsertUser, deleteUser } from '../services/supabaseService';

interface UserManagerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  roles: Role[];
  departments: Department[];
}

export const UserManager: React.FC<UserManagerProps> = ({ users, setUsers, roles, departments }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async () => {
    if (!editingUser?.name) return;
    
    // Find Role Name for legacy support
    const roleObj = roles.find(r => r.id === editingUser.roleId);
    
    const userToSave: User = {
        id: editingUser.id || Date.now().toString(),
        name: editingUser.name,
        email: editingUser.email || '',
        phone: editingUser.phone || '', // Save Phone
        avatarUrl: editingUser.avatarUrl || `https://ui-avatars.com/api/?name=${editingUser.name}&background=random`,
        roleId: editingUser.roleId,
        departmentId: editingUser.departmentId,
        role: roleObj?.name || '用户', // Fallback for display
        status: editingUser.status || 'active',
        customFields: editingUser.customFields || {}
    };

    setUsers(prev => {
        const exists = prev.find(u => u.id === userToSave.id);
        if (exists) return prev.map(u => u.id === userToSave.id ? userToSave : u);
        return [...prev, userToSave];
    });

    await upsertUser(userToSave);
    setEditingUser(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此用户吗？")) return;
    setUsers(prev => prev.filter(u => u.id !== id));
    await deleteUser(id);
  };

  return (
    <div className="h-full flex flex-col">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
         <div className="flex items-center">
            <UserCog className="w-6 h-6 mr-3 text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-800">用户管理</h2>
         </div>
         <div className="flex gap-4">
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
               <input 
                  type="text" 
                  placeholder="搜索用户..." 
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
               />
            </div>
            <button 
               onClick={() => setEditingUser({})}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center font-medium shadow-sm text-sm"
            >
               <Plus className="w-4 h-4 mr-2" />
               添加用户
            </button>
         </div>
       </div>

       {/* Table */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex-1 overflow-y-auto">
          <table className="w-full text-left text-sm">
             <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr>
                   <th className="px-6 py-4 font-semibold text-slate-600">用户</th>
                   <th className="px-6 py-4 font-semibold text-slate-600">部门</th>
                   <th className="px-6 py-4 font-semibold text-slate-600">角色</th>
                   <th className="px-6 py-4 font-semibold text-slate-600">状态</th>
                   <th className="px-6 py-4 font-semibold text-slate-600 text-right">操作</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {filteredUsers.map(user => {
                   const deptName = departments.find(d => d.id === user.departmentId)?.name || '-';
                   const roleName = roles.find(r => r.id === user.roleId)?.name || user.role || '-';
                   return (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4">
                            <div className="flex items-center">
                               <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full mr-3" />
                               <div>
                                  <div className="font-medium text-slate-800">{user.name}</div>
                                  <div className="text-xs text-slate-500">{user.email}</div>
                                  {user.phone && <div className="text-xs text-slate-400">{user.phone}</div>}
                               </div>
                            </div>
                         </td>
                         <td className="px-6 py-4 text-slate-600">{deptName}</td>
                         <td className="px-6 py-4">
                            <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs border border-indigo-100">
                               {roleName}
                            </span>
                         </td>
                         <td className="px-6 py-4">
                            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${user.status === 'inactive' ? 'bg-slate-400' : 'bg-emerald-500'}`}></span>
                            <span className="text-slate-600 capitalize">{user.status || 'Active'}</span>
                         </td>
                         <td className="px-6 py-4 text-right">
                            <button onClick={() => setEditingUser(user)} className="text-indigo-600 hover:text-indigo-800 mx-2"><Edit2 className="w-4 h-4"/></button>
                            <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-700 mx-2"><Trash2 className="w-4 h-4"/></button>
                         </td>
                      </tr>
                   );
                })}
             </tbody>
          </table>
       </div>

       {/* Edit Modal */}
       {editingUser && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-6 w-[500px] shadow-2xl animate-scale-in">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-800">
                     {editingUser.id ? '编辑用户' : '添加用户'}
                  </h3>
                  <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">姓名</label>
                     <input 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editingUser.name || ''}
                        onChange={e => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">邮箱</label>
                     <input 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editingUser.email || ''}
                        onChange={e => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">电话</label>
                     <input 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editingUser.phone || ''}
                        onChange={e => setEditingUser(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="138-xxxx-xxxx"
                     />
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">部门</label>
                     <select 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={editingUser.departmentId || ''}
                        onChange={e => setEditingUser(prev => ({ ...prev, departmentId: e.target.value }))}
                     >
                        <option value="">选择部门</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                     </select>
                  </div>
                  <div>
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">角色</label>
                     <select 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={editingUser.roleId || ''}
                        onChange={e => setEditingUser(prev => ({ ...prev, roleId: e.target.value }))}
                     >
                        <option value="">选择角色</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                     </select>
                  </div>
                  <div className="col-span-2">
                     <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">状态</label>
                     <select 
                        className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        value={editingUser.status || 'active'}
                        onChange={e => setEditingUser(prev => ({ ...prev, status: e.target.value as any }))}
                     >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                     </select>
                  </div>
               </div>
               
               <button 
                  onClick={handleSave}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium mt-6"
               >
                  保存用户
               </button>
            </div>
         </div>
       )}
    </div>
  );
};