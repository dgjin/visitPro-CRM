import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Role, Department, LoginHistory } from '../types';
import { Plus, Edit2, Trash2, UserCog, X, Search, ChevronLeft, ChevronRight, Clock, History, Camera } from 'lucide-react';
import { upsertUser, deleteUser, fetchLoginHistory } from '../services/supabaseService';

const ITEMS_PER_PAGE = 10;

interface UserManagerProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  roles: Role[];
  departments: Department[];
}

export const UserManager: React.FC<UserManagerProps> = ({ users, setUsers, roles, departments }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  
  // Login History State
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Generate tree-structured options for department select
  const departmentOptions = useMemo(() => {
    const options: { id: string; name: string; level: number }[] = [];
    const map = new Map<string | null, Department[]>();

    // Group by parentId
    departments.forEach(d => {
        const pid = d.parentId || null;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)?.push(d);
    });

    const traverse = (parentId: string | null, level: number) => {
        const children = map.get(parentId) || [];
        children.forEach(child => {
            options.push({ id: child.id, name: child.name, level });
            traverse(child.id, level + 1);
        });
    };

    traverse(null, 0);
    return options;
  }, [departments]);

  // Load history when user is selected
  useEffect(() => {
      if (editingUser?.id) {
          setIsLoadingHistory(true);
          fetchLoginHistory(editingUser.id)
            .then(setLoginHistory)
            .catch(() => setLoginHistory([]))
            .finally(() => setIsLoadingHistory(false));
      } else {
          setLoginHistory([]);
      }
  }, [editingUser?.id]);

  // Helper to get full department path (e.g. "Root - Child - Leaf")
  const getDepartmentPath = (deptId: string | undefined) => {
    if (!deptId) return '-';
    const path: string[] = [];
    let current = departments.find(d => d.id === deptId);
    while (current) {
        path.unshift(current.name);
        current = departments.find(d => d.id === current?.parentId);
    }
    return path.join(' - ');
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("图片大小不能超过 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingUser(prev => prev ? ({ ...prev, avatarUrl: reader.result as string }) : null);
      };
      reader.readAsDataURL(file);
    }
  };

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

  const formatDateTime = (iso?: string) => {
      if (!iso) return '-';
      return new Date(iso).toLocaleString('zh-CN', {
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
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
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-900 bg-white"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
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

       {/* Table Container */}
       <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1">
          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                    <tr>
                    <th className="px-6 py-4 font-semibold text-slate-600">用户</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">机构-部门</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">角色</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">最后登录</th>
                    <th className="px-6 py-4 font-semibold text-slate-600">状态</th>
                    <th className="px-6 py-4 font-semibold text-slate-600 text-right">操作</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {paginatedUsers.map(user => {
                    const deptPath = getDepartmentPath(user.departmentId);
                    const roleName = roles.find(r => r.id === user.roleId)?.name || user.role || '-';
                    return (
                        <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center">
                                <img 
                                    src={user.avatarUrl} 
                                    alt="" 
                                    className="w-10 h-10 rounded-full mr-3 object-cover border border-slate-100 bg-slate-50" 
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.name}&background=random`;
                                    }}
                                />
                                <div>
                                    <div className="font-medium text-slate-900">{user.name}</div>
                                    <div className="text-xs text-slate-500">{user.email}</div>
                                    {user.phone && <div className="text-xs text-slate-400">{user.phone}</div>}
                                </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 text-slate-700 font-medium">{deptPath}</td>
                            <td className="px-6 py-4">
                                <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs border border-indigo-100">
                                {roleName}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                                {formatDateTime(user.last_login_at)}
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
                    {filteredUsers.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                                未找到符合条件的用户
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredUsers.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
               <span className="text-xs text-slate-500">
                  显示 {Math.min(filteredUsers.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(filteredUsers.length, currentPage * ITEMS_PER_PAGE)} 共 {filteredUsers.length} 条
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

       {/* Edit Modal */}
       {editingUser && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
               {/* Modal Header */}
               <div className="flex justify-between items-center p-6 border-b border-slate-100">
                  <h3 className="text-lg font-bold text-slate-800">
                     {editingUser.id ? '编辑用户' : '添加用户'}
                  </h3>
                  <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               {/* Modal Body (Scrollable) */}
               <div className="flex-1 overflow-y-auto p-6">
                   {/* Avatar Upload Section */}
                   <div className="flex flex-col items-center mb-6">
                       <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                           <img 
                               src={editingUser.avatarUrl || `https://ui-avatars.com/api/?name=${editingUser.name || 'New User'}&background=random`} 
                               alt="Avatar" 
                               className="w-24 h-24 rounded-full object-cover border-4 border-slate-100 group-hover:border-indigo-100 transition-all shadow-sm"
                               onError={(e) => {
                                   (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${editingUser.name || 'New'}&background=random`;
                               }}
                           />
                           <div className="absolute inset-0 bg-slate-900/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[1px]">
                               <Camera className="w-8 h-8 text-white" />
                           </div>
                           <input 
                               type="file" 
                               ref={fileInputRef} 
                               className="hidden" 
                               accept="image/*"
                               onChange={handleAvatarUpload}
                           />
                       </div>
                       <p className="text-xs text-slate-400 mt-2">点击头像上传新图片 (最大 2MB)</p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">姓名</label>
                         <input 
                            className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                            value={editingUser.name || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="请输入姓名"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">邮箱</label>
                         <input 
                            className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                            value={editingUser.email || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@company.com"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">电话</label>
                         <input 
                            className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                            value={editingUser.phone || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="138-xxxx-xxxx"
                         />
                      </div>
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">部门</label>
                         <select 
                            className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                            value={editingUser.departmentId || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, departmentId: e.target.value }))}
                         >
                            <option value="">选择部门</option>
                            {departmentOptions.map(d => (
                                <option key={d.id} value={d.id}>
                                    {'\u00A0\u00A0\u00A0'.repeat(d.level) + (d.level > 0 ? '└ ' : '') + d.name}
                                </option>
                            ))}
                         </select>
                      </div>
                      <div>
                         <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">角色</label>
                         <select 
                            className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
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
                            className="w-full p-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-900"
                            value={editingUser.status || 'active'}
                            onChange={e => setEditingUser(prev => ({ ...prev, status: e.target.value as any }))}
                         >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                         </select>
                      </div>
                   </div>

                   {/* Login History Section */}
                   {editingUser.id && (
                       <div className="mt-8 pt-6 border-t border-slate-100">
                           <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
                               <History className="w-4 h-4 mr-2 text-indigo-600" />
                               登录日志 (最近50条)
                           </h4>
                           <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden max-h-48 overflow-y-auto">
                               {isLoadingHistory ? (
                                   <div className="p-4 text-center text-slate-400 text-xs">加载中...</div>
                               ) : loginHistory.length === 0 ? (
                                   <div className="p-4 text-center text-slate-400 text-xs">暂无登录记录</div>
                               ) : (
                                   <table className="w-full text-xs text-left">
                                       <thead className="bg-slate-100 border-b border-slate-200 text-slate-500 sticky top-0">
                                           <tr>
                                               <th className="px-3 py-2 font-medium">时间</th>
                                               <th className="px-3 py-2 font-medium">IP 地址</th>
                                           </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-100">
                                           {loginHistory.map((log) => (
                                               <tr key={log.id} className="hover:bg-slate-100">
                                                   <td className="px-3 py-2 text-slate-700 font-mono">
                                                       {new Date(log.login_at).toLocaleString()}
                                                   </td>
                                                   <td className="px-3 py-2 text-slate-600 font-mono">
                                                       {log.ip_address || '-'}
                                                   </td>
                                               </tr>
                                           ))}
                                       </tbody>
                                   </table>
                               )}
                           </div>
                       </div>
                   )}
               </div>
               
               {/* Modal Footer */}
               <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                   <button 
                      onClick={handleSave}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                   >
                      保存用户
                   </button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};