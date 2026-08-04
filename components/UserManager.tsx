import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Role, Department, LoginHistory } from '../types';
import { Plus, Edit2, Trash2, UserCog, X, Search, ChevronLeft, ChevronRight, Clock, History, Camera, Lock, Upload, User as UserIcon } from 'lucide-react';
import { upsertUser, deleteUser, fetchLoginHistory, hashPassword } from '../services/apiService';

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
    return path.join(' / ');
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
    
    const isNewUser = !editingUser.id;
    let passwordHash = undefined;

    // Set default password '123456' for new users
    if (isNewUser) {
        passwordHash = await hashPassword('123456');
    }

    const userToSave: User = {
        id: editingUser.id || Date.now().toString(),
        name: editingUser.name,
        email: editingUser.email || '',
        phone: editingUser.phone || '', 
        avatarUrl: editingUser.avatarUrl || `https://ui-avatars.com/api/?name=${editingUser.name}&background=random`,
        roleId: editingUser.roleId,
        departmentId: editingUser.departmentId,
        role: roleObj?.name || '用户', // Fallback for display
        status: editingUser.status || 'active',
        customFields: editingUser.customFields || {},
        ...(isNewUser ? { password: passwordHash } : {}) // Only set password on creation
    };

    setUsers(prev => {
        const exists = prev.find(u => u.id === userToSave.id);
        if (exists) return prev.map(u => u.id === userToSave.id ? userToSave : u);
        return [...prev, userToSave];
    });

    await upsertUser(userToSave);
    
    if (isNewUser) {
        alert(`用户 ${userToSave.name} 已创建。默认密码为：123456`);
    }
    
    setEditingUser(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此用户吗？")) return;
    setUsers(prev => prev.filter(u => u.id !== id));
    await deleteUser(id);
  };

  const handleResetPassword = async () => {
      if (!editingUser?.id) return;
      if (!confirm(`确定要重置 ${editingUser.name} 的密码为 "123456" 吗？`)) return;
      
      const defaultHash = await hashPassword('123456');
      const updatedUser = { ...editingUser, password: defaultHash } as User;
      
      await upsertUser(updatedUser);
      alert("密码已重置为 123456");
  };

  const formatLastLogin = (iso?: string) => {
      if (!iso) return <span style={{ color: 'var(--text-tertiary)' }}>从未登录</span>;
      
      const date = new Date(iso);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      let text = '';
      if (diffSec < 60) text = '刚刚';
      else if (diffMin < 60) text = `${diffMin} 分钟前`;
      else if (diffHour < 24) text = `${diffHour} 小时前`;
      else if (diffDay === 1) text = '昨天';
      else if (diffDay < 7) text = `${diffDay} 天前`;
      else text = date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

      return <span title={date.toLocaleString('zh-CN')}>{text}</span>;
  };

  return (
    <div className="h-full flex flex-col" style={{ animation: 'fadeInUp 0.3s ease' }}>
       {/* Header */}
       <div style={{ 
         display: 'flex', 
         flexDirection: 'row',
         alignItems: 'center',
         justifyContent: 'space-between',
         gap: '16px',
         marginBottom: '24px',
         flexWrap: 'wrap'
       }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-700) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow)'
            }}>
              <UserCog style={{ width: '20px', height: '20px', color: 'white' }} />
            </div>
            <h2 style={{ 
              fontSize: '22px', 
              fontWeight: 700, 
              color: 'var(--text-primary)',
              letterSpacing: '-0.5px'
            }}>
              用户管理
            </h2>
         </div>
         <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
               <Search style={{ 
                 position: 'absolute', 
                 left: '12px', 
                 top: '50%', 
                 transform: 'translateY(-50%)', 
                 color: 'var(--text-tertiary)', 
                 width: '16px', 
                 height: '16px' 
               }} />
               <input 
                  type="text" 
                  placeholder="搜索用户..." 
                  style={{
                    padding: '10px 14px 10px 36px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    width: '220px',
                    transition: 'all 0.2s ease'
                  }}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-500)';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
               />
            </div>
            <button 
               onClick={() => setEditingUser({})}
               className="btn btn-primary"
               style={{
                 display: 'flex',
                 alignItems: 'center',
                 gap: '8px',
                 padding: '10px 18px',
                 background: 'var(--primary-600)',
                 color: 'white',
                 border: 'none',
                 borderRadius: 'var(--radius)',
                 fontSize: '14px',
                 fontWeight: 500,
                 cursor: 'pointer',
                 boxShadow: '0 1px 2px 0 rgb(37 99 235 / 0.2)',
                 transition: 'all 0.2s ease'
               }}
               onMouseEnter={(e) => {
                 e.currentTarget.style.background = 'var(--primary-700)';
                 e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(37 99 235 / 0.3)';
                 e.currentTarget.style.transform = 'translateY(-1px)';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.background = 'var(--primary-600)';
                 e.currentTarget.style.boxShadow = '0 1px 2px 0 rgb(37 99 235 / 0.2)';
                 e.currentTarget.style.transform = 'translateY(0)';
               }}
            >
               <Plus style={{ width: '16px', height: '16px' }} />
               添加用户
            </button>
         </div>
       </div>

       {/* Table Container */}
       <div className="card" style={{
         flex: 1,
         display: 'flex',
         flexDirection: 'column',
         overflow: 'hidden',
         borderRadius: 'var(--radius-md)',
         background: 'var(--bg-primary)',
         boxShadow: 'var(--shadow)',
         border: '1px solid var(--border-light)'
       }}>
          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="table">
                <thead>
                    <tr>
                    <th>用户信息</th>
                    <th>部门</th>
                    <th>角色</th>
                    <th>最后登录</th>
                    <th>状态</th>
                    <th style={{ textAlign: 'right' }}>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedUsers.map(user => {
                    const deptPath = getDepartmentPath(user.departmentId);
                    const roleName = roles.find(r => r.id === user.roleId)?.name || user.role || '-';
                    return (
                        <tr key={user.id}>
                            <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img 
                                    src={user.avatarUrl} 
                                    alt="" 
                                    style={{ 
                                      width: '40px', 
                                      height: '40px', 
                                      borderRadius: '50%', 
                                      objectFit: 'cover',
                                      border: '2px solid var(--border-light)',
                                      background: 'var(--bg-tertiary)'
                                    }}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${user.name}&background=random`;
                                    }}
                                />
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                                      {user.name}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                      {user.email || '暂无邮箱'}
                                    </div>
                                </div>
                                </div>
                            </td>
                            <td>
                              <span style={{ 
                                fontSize: '13px', 
                                color: 'var(--text-secondary)',
                                fontWeight: 500
                              }}>
                                {deptPath}
                              </span>
                            </td>
                            <td>
                                <span className="badge badge-info" style={{
                                  background: 'var(--primary-50)',
                                  color: 'var(--primary-700)',
                                  border: '1px solid var(--primary-100)'
                                }}>
                                  {roleName}
                                </span>
                            </td>
                            <td>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                fontSize: '13px',
                                color: 'var(--text-secondary)'
                              }}>
                                <Clock style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }} />
                                {formatLastLogin(user.last_login_at)}
                              </div>
                            </td>
                            <td>
                                <span className={`badge ${user.status === 'inactive' ? 'badge-danger' : 'badge-success'}`}>
                                  <span className={`status-dot ${user.status === 'inactive' ? 'status-dot-danger' : 'status-dot-success'}`} style={{ marginRight: '6px' }}></span>
                                  {user.status === 'active' ? '正常' : '已停用'}
                                </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                                <button 
                                  onClick={() => setEditingUser(user)} 
                                  style={{
                                    padding: '8px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--primary-600)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    marginRight: '4px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--primary-50)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                  title="编辑"
                                >
                                  <Edit2 style={{ width: '16px', height: '16px' }} />
                                </button>
                                <button 
                                  onClick={() => handleDelete(user.id)} 
                                  style={{
                                    padding: '8px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--danger)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--danger-light)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                  title="删除"
                                >
                                  <Trash2 style={{ width: '16px', height: '16px' }} />
                                </button>
                            </td>
                        </tr>
                    );
                    })}
                    {filteredUsers.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{ 
                              padding: '48px', 
                              textAlign: 'center', 
                              color: 'var(--text-tertiary)' 
                            }}>
                              <div style={{ marginBottom: '12px' }}>
                                <UserIcon style={{ 
                                  width: '48px', 
                                  height: '48px', 
                                  margin: '0 auto',
                                  opacity: 0.3 
                                }} />
                              </div>
                              未找到符合条件的用户
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredUsers.length > 0 && (
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
               <span style={{ 
                 fontSize: '13px', 
                 color: 'var(--text-secondary)',
                 fontWeight: 500
               }}>
                  显示 {Math.min(filteredUsers.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)} - {Math.min(filteredUsers.length, currentPage * ITEMS_PER_PAGE)} 共 {filteredUsers.length} 条
               </span>
               <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                     onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                     disabled={currentPage === 1}
                     style={{
                       padding: '8px',
                       borderRadius: 'var(--radius-sm)',
                       border: '1px solid var(--border)',
                       background: 'var(--bg-primary)',
                       color: 'var(--text-secondary)',
                       cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                       opacity: currentPage === 1 ? 0.5 : 1,
                       transition: 'all 0.2s ease',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center'
                     }}
                     onMouseEnter={(e) => {
                       if (currentPage !== 1) {
                         e.currentTarget.style.borderColor = 'var(--primary-300)';
                         e.currentTarget.style.color = 'var(--primary-600)';
                       }
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.borderColor = 'var(--border)';
                       e.currentTarget.style.color = 'var(--text-secondary)';
                     }}
                  >
                     <ChevronLeft style={{ width: '16px', height: '16px' }} />
                  </button>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    padding: '0 12px'
                  }}>
                     {currentPage} / {totalPages}
                  </span>
                  <button 
                     onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                     disabled={currentPage === totalPages}
                     style={{
                       padding: '8px',
                       borderRadius: 'var(--radius-sm)',
                       border: '1px solid var(--border)',
                       background: 'var(--bg-primary)',
                       color: 'var(--text-secondary)',
                       cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                       opacity: currentPage === totalPages ? 0.5 : 1,
                       transition: 'all 0.2s ease',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center'
                     }}
                     onMouseEnter={(e) => {
                       if (currentPage !== totalPages) {
                         e.currentTarget.style.borderColor = 'var(--primary-300)';
                         e.currentTarget.style.color = 'var(--primary-600)';
                       }
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.borderColor = 'var(--border)';
                       e.currentTarget.style.color = 'var(--text-secondary)';
                     }}
                  >
                     <ChevronRight style={{ width: '16px', height: '16px' }} />
                  </button>
               </div>
            </div>
          )}
       </div>

       {/* Edit Modal */}
       {editingUser && (
         <div style={{
           position: 'fixed',
           inset: 0,
           background: 'rgba(15, 23, 42, 0.6)',
           backdropFilter: 'blur(4px)',
           zIndex: 50,
           display: 'flex',
           alignItems: 'center',
           justifyContent: 'center',
           padding: '20px',
           animation: 'fadeIn 0.2s ease'
         }}>
            <div style={{
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '520px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-light)',
              animation: 'scaleIn 0.2s ease'
            }}>
               {/* Modal Header */}
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 alignItems: 'center',
                 padding: '20px 24px',
                 borderBottom: '1px solid var(--border-light)',
                 background: 'var(--bg-tertiary)',
                 borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
               }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: 'var(--radius)',
                      background: editingUser.id ? 'var(--primary-100)' : 'var(--success-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {editingUser.id ? (
                        <Edit2 style={{ width: '18px', height: '18px', color: 'var(--primary-600)' }} />
                      ) : (
                        <Plus style={{ width: '18px', height: '18px', color: 'var(--success)' }} />
                      )}
                    </div>
                    <h3 style={{ 
                      fontSize: '18px', 
                      fontWeight: 700, 
                      color: 'var(--text-primary)' 
                    }}>
                       {editingUser.id ? '编辑用户' : '添加用户'}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setEditingUser(null)} 
                    style={{
                      padding: '8px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-secondary)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-tertiary)';
                    }}
                  >
                     <X style={{ width: '20px', height: '20px' }} />
                  </button>
               </div>
               
               {/* Modal Body (Scrollable) */}
               <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
                   {/* Avatar Upload Section - Modern Design */}
                   <div style={{
                     display: 'flex',
                     flexDirection: 'column',
                     alignItems: 'center',
                     marginBottom: '24px',
                     padding: '24px',
                     background: 'var(--bg-tertiary)',
                     borderRadius: 'var(--radius-md)',
                     border: '2px dashed var(--border)',
                     transition: 'all 0.2s ease'
                   }}
                   onMouseEnter={(e) => {
                     e.currentTarget.style.borderColor = 'var(--primary-300)';
                     e.currentTarget.style.background = 'var(--primary-50)';
                   }}
                   onMouseLeave={(e) => {
                     e.currentTarget.style.borderColor = 'var(--border)';
                     e.currentTarget.style.background = 'var(--bg-tertiary)';
                   }}
                   >
                       <div 
                         style={{ 
                           position: 'relative', 
                           cursor: 'pointer',
                           marginBottom: '12px'
                         }} 
                         onClick={() => fileInputRef.current?.click()}
                       >
                           <img 
                               src={editingUser.avatarUrl || `https://ui-avatars.com/api/?name=${editingUser.name || 'New User'}&background=random`} 
                               alt="Avatar" 
                               style={{
                                 width: '88px',
                                 height: '88px',
                                 borderRadius: '50%',
                                 objectFit: 'cover',
                                 border: '4px solid var(--bg-primary)',
                                 boxShadow: 'var(--shadow-md)'
                               }}
                               onError={(e) => {
                                   (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${editingUser.name || 'New'}&background=random`;
                               }}
                           />
                           <div style={{
                             position: 'absolute',
                             bottom: '0',
                             right: '0',
                             width: '28px',
                             height: '28px',
                             borderRadius: '50%',
                             background: 'var(--primary-600)',
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             border: '3px solid var(--bg-primary)',
                             boxShadow: 'var(--shadow)'
                           }}>
                               <Camera style={{ width: '14px', height: '14px', color: 'white' }} />
                           </div>
                           <input 
                               type="file" 
                               ref={fileInputRef} 
                               style={{ display: 'none' }}
                               accept="image/*"
                               onChange={handleAvatarUpload}
                           />
                       </div>
                       <p style={{ 
                         fontSize: '13px', 
                         color: 'var(--text-tertiary)',
                         fontWeight: 500
                       }}>
                         点击更换头像
                       </p>
                       <p style={{ 
                         fontSize: '12px', 
                         color: 'var(--text-tertiary)',
                         marginTop: '4px'
                       }}>
                         支持 JPG、PNG，最大 2MB
                       </p>
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ gridColumn: 'span 2' }}>
                         <label style={{ 
                           display: 'block', 
                           fontSize: '13px', 
                           fontWeight: 600, 
                           color: 'var(--text-secondary)',
                           marginBottom: '6px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.5px'
                         }}>
                           姓名 *
                         </label>
                         <input 
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              transition: 'all 0.2s ease'
                            }}
                            value={editingUser.name || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="请输入用户姓名"
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary-500)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                         />
                      </div>
                      <div>
                         <label style={{ 
                           display: 'block', 
                           fontSize: '13px', 
                           fontWeight: 600, 
                           color: 'var(--text-secondary)',
                           marginBottom: '6px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.5px'
                         }}>
                           邮箱
                         </label>
                         <input 
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              transition: 'all 0.2s ease'
                            }}
                            value={editingUser.email || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="email@company.com"
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary-500)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                         />
                      </div>
                      <div>
                         <label style={{ 
                           display: 'block', 
                           fontSize: '13px', 
                           fontWeight: 600, 
                           color: 'var(--text-secondary)',
                           marginBottom: '6px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.5px'
                         }}>
                           电话
                         </label>
                         <input 
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              transition: 'all 0.2s ease'
                            }}
                            value={editingUser.phone || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, phone: e.target.value }))}
                            placeholder="138-xxxx-xxxx"
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary-500)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                         />
                      </div>
                      <div>
                         <label style={{ 
                           display: 'block', 
                           fontSize: '13px', 
                           fontWeight: 600, 
                           color: 'var(--text-secondary)',
                           marginBottom: '6px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.5px'
                         }}>
                           部门
                         </label>
                         <select 
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              cursor: 'pointer',
                              appearance: 'none',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 12px center',
                              paddingRight: '36px',
                              transition: 'all 0.2s ease'
                            }}
                            value={editingUser.departmentId || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, departmentId: e.target.value }))}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary-500)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
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
                         <label style={{ 
                           display: 'block', 
                           fontSize: '13px', 
                           fontWeight: 600, 
                           color: 'var(--text-secondary)',
                           marginBottom: '6px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.5px'
                         }}>
                           角色
                         </label>
                         <select 
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              cursor: 'pointer',
                              appearance: 'none',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 12px center',
                              paddingRight: '36px',
                              transition: 'all 0.2s ease'
                            }}
                            value={editingUser.roleId || ''}
                            onChange={e => setEditingUser(prev => ({ ...prev, roleId: e.target.value }))}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary-500)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                         >
                            <option value="">选择角色</option>
                            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                         </select>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                         <label style={{ 
                           display: 'block', 
                           fontSize: '13px', 
                           fontWeight: 600, 
                           color: 'var(--text-secondary)',
                           marginBottom: '6px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.5px'
                         }}>
                           状态
                         </label>
                         <select 
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                              background: 'var(--bg-primary)',
                              color: 'var(--text-primary)',
                              fontSize: '14px',
                              cursor: 'pointer',
                              appearance: 'none',
                              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
                              backgroundRepeat: 'no-repeat',
                              backgroundPosition: 'right 12px center',
                              paddingRight: '36px',
                              transition: 'all 0.2s ease'
                            }}
                            value={editingUser.status || 'active'}
                            onChange={e => setEditingUser(prev => ({ ...prev, status: e.target.value as any }))}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary-500)';
                              e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                         >
                            <option value="active">正常</option>
                            <option value="inactive">已停用</option>
                         </select>
                      </div>
                   </div>

                   {/* Admin Actions */}
                   {editingUser.id && (
                       <div style={{
                         marginTop: '20px',
                         paddingTop: '20px',
                         borderTop: '1px solid var(--border-light)',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'space-between'
                       }}>
                           <button 
                               onClick={handleResetPassword}
                               style={{
                                 display: 'flex',
                                 alignItems: 'center',
                                 gap: '8px',
                                 padding: '10px 16px',
                                 fontSize: '13px',
                                 fontWeight: 500,
                                 color: 'var(--warning)',
                                 background: 'var(--warning-light)',
                                 border: '1px solid transparent',
                                 borderRadius: 'var(--radius)',
                                 cursor: 'pointer',
                                 transition: 'all 0.2s ease'
                               }}
                               onMouseEnter={(e) => {
                                 e.currentTarget.style.background = 'var(--warning)';
                                 e.currentTarget.style.color = 'white';
                               }}
                               onMouseLeave={(e) => {
                                 e.currentTarget.style.background = 'var(--warning-light)';
                                 e.currentTarget.style.color = 'var(--warning)';
                               }}
                           >
                               <Lock style={{ width: '14px', height: '14px' }} />
                               重置密码
                           </button>
                       </div>
                   )}

                   {/* Login History Section */}
                   {editingUser.id && (
                       <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-light)' }}>
                           <h4 style={{ 
                             fontSize: '14px', 
                             fontWeight: 700, 
                             color: 'var(--text-primary)',
                             marginBottom: '12px',
                             display: 'flex',
                             alignItems: 'center',
                             gap: '8px'
                           }}>
                               <History style={{ width: '16px', height: '16px', color: 'var(--primary-600)' }} />
                               登录日志
                               <span style={{ 
                                 fontSize: '12px', 
                                 fontWeight: 500, 
                                 color: 'var(--text-tertiary)',
                                 marginLeft: '4px'
                               }}>
                                 (最近50条)
                               </span>
                           </h4>
                           <div style={{
                             background: 'var(--bg-tertiary)',
                             borderRadius: 'var(--radius)',
                             border: '1px solid var(--border-light)',
                             overflow: 'hidden',
                             maxHeight: '200px',
                             overflowY: 'auto'
                           }}>
                               {isLoadingHistory ? (
                                   <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                     <div className="animate-spin" style={{
                                       width: '24px',
                                       height: '24px',
                                       border: '2px solid var(--border)',
                                       borderTopColor: 'var(--primary-500)',
                                       borderRadius: '50%',
                                       margin: '0 auto 8px'
                                     }} />
                                     加载中...
                                   </div>
                               ) : loginHistory.length === 0 ? (
                                   <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                                     <Clock style={{ width: '32px', height: '32px', margin: '0 auto 8px', opacity: 0.3 }} />
                                     暂无登录记录
                                   </div>
                               ) : (
                                   <table style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
                                       <thead style={{ 
                                         background: 'var(--bg-secondary)', 
                                         borderBottom: '1px solid var(--border)',
                                         position: 'sticky',
                                         top: 0
                                       }}>
                                           <tr>
                                               <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>时间</th>
                                               <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>IP 地址</th>
                                           </tr>
                                       </thead>
                                       <tbody style={{ divideY: '1px solid var(--border-light)' }}>
                                           {loginHistory.map((log) => (
                                               <tr key={log.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                   <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '12px' }}>
                                                       {new Date(log.login_at).toLocaleString()}
                                                   </td>
                                                   <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
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
               <div style={{
                 padding: '20px 24px',
                 borderTop: '1px solid var(--border-light)',
                 background: 'var(--bg-tertiary)',
                 borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
                 display: 'flex',
                 gap: '12px'
               }}>
                   <button 
                      onClick={() => setEditingUser(null)}
                      style={{
                        flex: 1,
                        padding: '12px 20px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary-300)';
                        e.currentTarget.style.color = 'var(--primary-700)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }}
                   >
                      取消
                   </button>
                   <button 
                      onClick={handleSave}
                      style={{
                        flex: 2,
                        padding: '12px 20px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'white',
                        background: 'var(--primary-600)',
                        border: 'none',
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px 0 rgb(37 99 235 / 0.2)',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'var(--primary-700)';
                        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(37 99 235 / 0.3)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'var(--primary-600)';
                        e.currentTarget.style.boxShadow = '0 1px 2px 0 rgb(37 99 235 / 0.2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
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
