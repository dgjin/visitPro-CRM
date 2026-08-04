import React, { useState } from 'react';
import { Role } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  ShieldCheck, 
  X, 
  Users,
  Briefcase,
  Shield,
  FileText,
  MoreHorizontal
} from 'lucide-react';
import { upsertRole, deleteRole } from '../services/apiService';

interface RoleManagerProps {
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
}

// 预定义的权限模块
const permissionModules = [
  { id: 'clients', name: '客户管理', icon: Users, description: '查看、编辑客户信息' },
  { id: 'visits', name: '拜访管理', icon: Briefcase, description: '管理拜访记录' },
  { id: 'users', name: '用户管理', icon: Shield, description: '管理系统用户' },
  { id: 'reports', name: '报表查看', icon: FileText, description: '查看统计报表' },
];

// 生成角色颜色
const getRoleColor = (index: number) => {
  const colors = [
    { bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    { bg: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    { bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    { bg: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200' },
    { bg: 'bg-cyan-500', light: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
  ];
  return colors[index % colors.length];
};

// 生成角色首字母头像
const getInitials = (name: string) => {
  return name.slice(0, 2).toUpperCase();
};

export const RoleManager: React.FC<RoleManagerProps> = ({ roles, setRoles }) => {
  const [editingRole, setEditingRole] = useState<Partial<Role> & { permissions?: string[] } | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

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
    setSelectedPermissions([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此角色吗？此操作不可恢复。")) return;
    setRoles(prev => prev.filter(r => r.id !== id));
    await deleteRole(id);
  };

  const openEditModal = (role?: Role) => {
    if (role) {
      setEditingRole({ ...role, permissions: ['clients', 'visits'] });
      setSelectedPermissions(['clients', 'visits']);
    } else {
      setEditingRole({ permissions: [] });
      setSelectedPermissions([]);
    }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permissionId) 
        ? prev.filter(p => p !== permissionId)
        : [...prev, permissionId]
    );
    setEditingRole(prev => ({
      ...prev,
      permissions: prev?.permissions?.includes(permissionId)
        ? prev.permissions.filter(p => p !== permissionId)
        : [...(prev?.permissions || []), permissionId]
    }));
  };

  return (
    <div className="h-full flex flex-col">
      {/* 页面头部 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 flex items-center justify-center shadow-lg"
            style={{ background: 'var(--primary-600)', borderRadius: 'var(--radius-md)' }}
          >
            <ShieldCheck className="w-5 h-5" style={{ color: 'var(--bg-primary)' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>角色管理</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>管理系统角色和权限配置</p>
          </div>
        </div>
        <button 
          onClick={() => openEditModal()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 font-medium text-sm transition-all duration-200 hover:-translate-y-0.5"
          style={{ 
            background: 'var(--primary-600)', 
            color: 'var(--bg-primary)', 
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)'
          }}
        >
          <Plus className="w-4 h-4" />
          添加角色
        </button>
      </div>

      {/* 角色统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          className="p-5 transition-shadow duration-200 hover:shadow-md"
          style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--primary-50)', borderRadius: 'var(--radius-sm)' }}
            >
              <ShieldCheck className="w-5 h-5" style={{ color: 'var(--primary-600)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{roles.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>角色总数</p>
            </div>
          </div>
        </div>
        <div 
          className="p-5 transition-shadow duration-200 hover:shadow-md"
          style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--success-50)', borderRadius: 'var(--radius-sm)' }}
            >
              <Users className="w-5 h-5" style={{ color: 'var(--success-600)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{roles.filter(r => r.name.includes('经理') || r.name.includes('主管')).length}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>管理角色</p>
            </div>
          </div>
        </div>
        <div 
          className="p-5 transition-shadow duration-200 hover:shadow-md"
          style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 flex items-center justify-center"
              style={{ background: 'var(--purple-50)', borderRadius: 'var(--radius-sm)' }}
            >
              <Briefcase className="w-5 h-5" style={{ color: 'var(--purple-600)' }} />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{permissionModules.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>权限模块</p>
            </div>
          </div>
        </div>
      </div>

      {/* 角色列表 - 卡片式表格 */}
      <div 
        className="flex-1 overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead 
              style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
            >
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>角色</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>描述</th>
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>权限</th>
                <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>操作</th>
              </tr>
            </thead>
            <tbody style={{ borderTop: '1px solid var(--border)' }}>
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center" style={{ color: 'var(--text-tertiary)' }}>
                      <div 
                        className="w-16 h-16 flex items-center justify-center mb-3"
                        style={{ background: 'var(--bg-secondary)', borderRadius: '50%' }}
                      >
                        <ShieldCheck className="w-8 h-8" style={{ color: 'var(--border)' }} />
                      </div>
                      <p className="text-sm font-medium">暂无角色数据</p>
                      <p className="text-xs mt-1">点击上方按钮添加新角色</p>
                    </div>
                  </td>
                </tr>
              ) : (
                roles.map((role, index) => {
                  const color = getRoleColor(index);
                  return (
                    <tr 
                      key={role.id} 
                      className="group transition-colors duration-150"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 flex items-center justify-center font-semibold text-sm shadow-sm ${color.bg}`} style={{ borderRadius: 'var(--radius-sm)', color: 'var(--bg-primary)' }}>
                            {getInitials(role.name)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{role.name}</p>
                            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>ID: {role.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{role.description || '暂无描述'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium border ${color.light} ${color.text} ${color.border}`} style={{ borderRadius: '9999px' }}>
                            <Shield className="w-3 h-3 mr-1" />
                            {permissionModules.length} 项权限
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button 
                            onClick={() => openEditModal(role)} 
                            className="p-2 transition-colors duration-150"
                            style={{ borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary-600)'; e.currentTarget.style.background = 'var(--primary-50)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="编辑"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(role.id)} 
                            className="p-2 transition-colors duration-150"
                            style={{ borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--danger-600)'; e.currentTarget.style.background = 'var(--danger-50)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div 
            className="absolute inset-0 backdrop-blur-sm transition-opacity duration-300"
            style={{ background: 'rgba(17, 24, 39, 0.6)' }}
            onClick={() => {
              setEditingRole(null);
              setSelectedPermissions([]);
            }}
          />
          
          {/* 弹窗内容 */}
          <div 
            className="relative w-full max-w-lg max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{ background: 'var(--bg-primary)', borderRadius: '1rem', boxShadow: 'var(--shadow-lg)' }}
          >
            {/* 弹窗头部 */}
            <div 
              className="px-6 py-5"
              style={{ borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, var(--bg-secondary), var(--bg-primary))' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 flex items-center justify-center shadow-md"
                    style={{ background: 'var(--primary-600)', borderRadius: 'var(--radius-md)' }}
                  >
                    {editingRole.id ? <Edit2 className="w-5 h-5" style={{ color: 'var(--bg-primary)' }} /> : <Plus className="w-5 h-5" style={{ color: 'var(--bg-primary)' }} />}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                      {editingRole.id ? '编辑角色' : '添加角色'}
                    </h3>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {editingRole.id ? '修改角色信息和权限' : '创建新角色并配置权限'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setEditingRole(null);
                    setSelectedPermissions([]);
                  }}
                  className="p-2 transition-colors duration-150"
                  style={{ borderRadius: 'var(--radius-sm)', color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent'; }}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
              <div className="space-y-5">
                {/* 角色名称 */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    角色名称 <span style={{ color: 'var(--danger-600)' }}>*</span>
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    <input 
                      className="w-full pl-10 pr-4 py-2.5 text-sm transition-all duration-200 focus:outline-none"
                      style={{ 
                        background: 'var(--bg-primary)', 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius)',
                        color: 'var(--text-primary)'
                      }}
                      value={editingRole.name || ''}
                      onChange={e => setEditingRole(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="例如：销售经理"
                    />
                  </div>
                </div>

                {/* 角色描述 */}
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    角色描述
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                    <textarea 
                      className="w-full pl-10 pr-4 py-2.5 text-sm transition-all duration-200 resize-none focus:outline-none"
                      style={{ 
                        background: 'var(--bg-primary)', 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius)',
                        color: 'var(--text-primary)'
                      }}
                      value={editingRole.description || ''}
                      onChange={e => setEditingRole(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="描述该角色的职责和权限范围..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* 权限配置 */}
                <div>
                  <label className="block text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                    权限配置
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {permissionModules.map((module) => {
                      const Icon = module.icon;
                      const isSelected = selectedPermissions.includes(module.id);
                      return (
                        <button
                          key={module.id}
                          onClick={() => togglePermission(module.id)}
                          className="relative flex items-start gap-3 p-4 text-left transition-all duration-200"
                          style={{ 
                            border: `2px solid ${isSelected ? 'var(--primary-600)' : 'var(--border)'}`, 
                            background: isSelected ? 'var(--primary-50)' : 'var(--bg-primary)', 
                            borderRadius: 'var(--radius-md)',
                            boxShadow: isSelected ? 'var(--shadow-sm)' : 'none'
                          }}
                        >
                          <div 
                            className="flex-shrink-0 w-10 h-10 flex items-center justify-center transition-colors duration-200"
                            style={{ 
                              background: isSelected ? 'var(--primary-600)' : 'var(--bg-secondary)', 
                              color: isSelected ? 'var(--bg-primary)' : 'var(--text-secondary)',
                              borderRadius: 'var(--radius-sm)'
                            }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm" style={{ color: isSelected ? 'var(--primary-600)' : 'var(--text-primary)' }}>
                              {module.name}
                            </p>
                            <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                              {module.description}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <div 
                                className="w-5 h-5 flex items-center justify-center"
                                style={{ background: 'var(--primary-600)', borderRadius: '50%' }}
                              >
                                <svg className="w-3 h-3" style={{ color: 'var(--bg-primary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 */}
            <div 
              className="px-6 py-4 flex justify-end gap-3"
              style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}
            >
              <button 
                onClick={() => {
                  setEditingRole(null);
                  setSelectedPermissions([]);
                }}
                className="px-5 py-2.5 text-sm font-medium transition-colors duration-200"
                style={{ 
                  color: 'var(--text-secondary)', 
                  background: 'var(--bg-primary)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius)' 
                }}
              >
                取消
              </button>
              <button 
                onClick={handleSave}
                disabled={!editingRole.name}
                className="px-5 py-2.5 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ 
                  color: 'var(--bg-primary)', 
                  background: 'var(--primary-600)', 
                  borderRadius: 'var(--radius)',
                  boxShadow: 'var(--shadow)'
                }}
              >
                {editingRole.id ? '保存修改' : '创建角色'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
