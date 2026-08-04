import React, { useState, useMemo } from 'react';
import { Department, DepartmentNode, User } from '../types';
import { Plus, Edit2, Trash2, ChevronRight, ChevronDown, FolderTree, X, Network as NetworkIcon, Users, Building2, MoreHorizontal, Search } from 'lucide-react';
import { upsertDepartment, deleteDepartment } from '../services/apiService';

interface DepartmentManagerProps {
  departments: Department[];
  setDepartments: React.Dispatch<React.SetStateAction<Department[]>>;
  users: User[];
}

export const DepartmentManager: React.FC<DepartmentManagerProps> = ({ departments, setDepartments, users }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      alert(`无法删除：该部门下仍有 ${usersInDept.length} 名员工。请先在"用户管理"中转移或删除这些员工。`);
      return;
    }

    if (!confirm("确定要删除此部门吗？此操作无法撤销。")) return;

    setDepartments(prev => prev.filter(d => d.id !== id));
    await deleteDepartment(id);
  };

  // Generate tree-structured options for parent department select
  const departmentOptions = useMemo(() => {
    const options: { id: string; name: string; level: number }[] = [];
    const map = new Map<string | null, Department[]>();

    departments.forEach(d => {
        const pid = d.parentId || null;
        if (!map.has(pid)) map.set(pid, []);
        map.get(pid)?.push(d);
    });

    const traverse = (parentId: string | null, level: number) => {
        const children = map.get(parentId) || [];
        children.forEach(child => {
            // Skip current editing department to prevent self-reference
            if (editingDept?.id !== child.id) {
                options.push({ id: child.id, name: child.name, level });
                traverse(child.id, level + 1);
            }
        });
    };

    traverse(null, 0);
    return options;
  }, [departments, editingDept?.id]);

  // Get department manager name
  const getManagerName = (managerId?: string) => {
    if (!managerId) return null;
    const manager = users.find(u => u.id === managerId);
    return manager?.name;
  };

  // Filter departments based on search
  const filteredDepartments = useMemo(() => {
    if (!searchTerm.trim()) return departments;
    return departments.filter(d => 
      d.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [departments, searchTerm]);

  const treeData = buildTree(filteredDepartments);

  // Calculate stats
  const totalDepartments = departments.length;
  const rootDepartments = departments.filter(d => !d.parentId).length;
  const totalEmployees = users.filter(u => u.departmentId).length;

  const TreeItem: React.FC<{ node: DepartmentNode; level?: number }> = ({ node, level = 0 }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    
    // Calculate user count for this department (direct only)
    const userCount = users.filter(u => u.departmentId === node.id).length;
    const managerName = getManagerName(node.managerId);

    // Indentation style with connecting lines
    const indentStyle = level > 0 ? {
      marginLeft: `${level * 28}px`,
      position: 'relative' as const,
    } : {};

    return (
      <div className="select-none" style={{ animation: 'fadeInUp 0.2s ease' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-light)',
            marginBottom: '8px',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)',
            ...indentStyle
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            e.currentTarget.style.borderColor = 'var(--primary-200)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            e.currentTarget.style.borderColor = 'var(--border-light)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', flex: 1, gap: '12px' }}>
            {/* Expand/Collapse Button */}
            <button 
              onClick={() => hasChildren && toggleExpand(node.id)}
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: hasChildren ? 'var(--bg-tertiary)' : 'transparent',
                cursor: hasChildren ? 'pointer' : 'default',
                opacity: hasChildren ? 1 : 0,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (hasChildren) {
                  e.currentTarget.style.background = 'var(--primary-100)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasChildren) {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                }
              }}
            >
              {isExpanded ? (
                <ChevronDown style={{ width: '14px', height: '14px', color: 'var(--primary-600)' }} />
              ) : (
                <ChevronRight style={{ width: '14px', height: '14px', color: 'var(--primary-600)' }} />
              )}
            </button>

            {/* Department Icon */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius)',
              background: level === 0 
                ? 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-700) 100%)' 
                : 'var(--primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: level === 0 ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
            }}>
              {level === 0 ? (
                <Building2 style={{ width: '18px', height: '18px', color: 'white' }} />
              ) : (
                <FolderTree style={{ width: '18px', height: '18px', color: 'var(--primary-600)' }} />
              )}
            </div>

            {/* Department Info */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '10px',
                marginBottom: '2px'
              }}>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)'
                }}>
                  {node.name}
                </span>
                {userCount > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--primary-700)',
                    background: 'var(--primary-50)',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--primary-100)'
                  }}>
                    <Users style={{ width: '10px', height: '10px' }} />
                    {userCount} 人
                  </span>
                )}
              </div>
              {managerName && (
                <div style={{
                  fontSize: '12px',
                  color: 'var(--text-tertiary)'
                }}>
                  负责人: {managerName}
                </div>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            opacity: 0,
            transition: 'opacity 0.2s ease'
          }}
          className="dept-actions"
          >
            <button 
              onClick={() => setEditingDept({ parentId: node.id })}
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--success)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--success-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              title="添加子部门"
            >
              <Plus style={{ width: '16px', height: '16px' }} />
            </button>
            <button 
              onClick={() => setEditingDept(node)}
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--primary-600)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
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
              onClick={() => handleDelete(node.id)}
              style={{
                padding: '8px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'var(--danger)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
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
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div style={{ animation: 'fadeInDown 0.2s ease' }}>
            {node.children!.map(child => (
              <TreeItem key={child.id} node={child} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      animation: 'fadeInUp 0.3s ease'
    }}>
      {/* Header Section */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        marginBottom: '24px'
      }}>
        {/* Title Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--primary-500) 0%, var(--primary-700) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow)'
            }}>
              <NetworkIcon style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <h2 style={{
                fontSize: '22px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.5px',
                margin: 0
              }}>
                部门管理
              </h2>
              <p style={{
                fontSize: '13px',
                color: 'var(--text-tertiary)',
                margin: '2px 0 0 0'
              }}>
                管理组织架构和部门层级
              </p>
            </div>
          </div>

          <button 
            onClick={() => setEditingDept({ parentId: null })}
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
            <Plus style={{ width: '18px', height: '18px' }} />
            添加根部门
          </button>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px'
        }}>
          <div style={{
            padding: '16px 20px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius)',
              background: 'var(--primary-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 style={{ width: '20px', height: '20px', color: 'var(--primary-600)' }} />
            </div>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {totalDepartments}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '4px'
              }}>
                总部门数
              </div>
            </div>
          </div>

          <div style={{
            padding: '16px 20px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius)',
              background: 'var(--success-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderTree style={{ width: '20px', height: '20px', color: 'var(--success)' }} />
            </div>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {rootDepartments}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '4px'
              }}>
                根部门
              </div>
            </div>
          </div>

          <div style={{
            padding: '16px 20px',
            background: 'var(--bg-primary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-light)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius)',
              background: 'var(--info-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users style={{ width: '20px', height: '20px', color: 'var(--info)' }} />
            </div>
            <div>
              <div style={{
                fontSize: '20px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1
              }}>
                {totalEmployees}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '4px'
              }}>
                在职员工
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', maxWidth: '320px' }}>
          <Search style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '16px',
            height: '16px',
            color: 'var(--text-tertiary)'
          }} />
          <input
            type="text"
            placeholder="搜索部门..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 36px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              transition: 'all 0.2s ease'
            }}
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
      </div>

      {/* Tree Container */}
      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-light)',
        padding: '20px',
        overflow: 'auto'
      }}>
        {treeData.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: 'var(--text-tertiary)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}>
              <FolderTree style={{ width: '40px', height: '40px', color: 'var(--text-tertiary)', opacity: 0.5 }} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px 0' }}>
              {searchTerm ? '未找到匹配的部门' : '暂无部门数据'}
            </p>
            <p style={{ fontSize: '13px', margin: 0 }}>
              {searchTerm ? '请尝试其他搜索关键词' : '点击"添加根部门"开始构建组织架构'}
            </p>
          </div>
        ) : (
          <div>
            {treeData.map(node => <TreeItem key={node.id} node={node} />)}
          </div>
        )}
      </div>

      {/* CSS for hover effects on tree items */}
      <style>{`
        .select-none:hover .dept-actions {
          opacity: 1 !important;
        }
      `}</style>

      {/* Edit Modal */}
      {editingDept && (
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
            maxWidth: '440px',
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
                  background: editingDept.id ? 'var(--primary-100)' : 'var(--success-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {editingDept.id ? (
                    <Edit2 style={{ width: '18px', height: '18px', color: 'var(--primary-600)' }} />
                  ) : (
                    <Plus style={{ width: '18px', height: '18px', color: 'var(--success)' }} />
                  )}
                </div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  {editingDept.id ? '编辑部门' : '添加部门'}
                </h3>
              </div>
              <button
                onClick={() => setEditingDept(null)}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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

            {/* Modal Body */}
            <div style={{ padding: '24px' }}>
              {/* Department Name */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  部门名称 *
                </label>
                <input
                  type="text"
                  placeholder="请输入部门名称"
                  value={editingDept.name || ''}
                  onChange={e => setEditingDept(prev => ({ ...prev!, name: e.target.value }))}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    transition: 'all 0.2s ease'
                  }}
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

              {/* Parent Department */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  上级部门
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={editingDept.parentId || ''}
                    onChange={e => setEditingDept(prev => ({ ...prev!, parentId: e.target.value || null }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      paddingRight: '40px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      appearance: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-500)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">(无 - 作为根部门)</option>
                    {departmentOptions.map(d => (
                      <option key={d.id} value={d.id}>
                        {'\u00A0\u00A0\u00A0'.repeat(d.level) + (d.level > 0 ? '└ ' : '') + d.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>

              {/* Manager Selection */}
              <div style={{ marginBottom: '8px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  负责人
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={editingDept.managerId || ''}
                    onChange={e => setEditingDept(prev => ({ ...prev!, managerId: e.target.value || undefined }))}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      paddingRight: '40px',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      cursor: 'pointer',
                      appearance: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary-500)';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgb(59 130 246 / 0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">未指定负责人</option>
                    {users
                      .filter(u => u.status === 'active')
                      .map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} {u.departmentId === editingDept.id ? '(本部门)' : ''}
                        </option>
                      ))
                    }
                  </select>
                  <ChevronDown style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    color: 'var(--text-tertiary)',
                    pointerEvents: 'none'
                  }} />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              gap: '12px',
              padding: '20px 24px',
              borderTop: '1px solid var(--border-light)',
              background: 'var(--bg-tertiary)',
              borderRadius: '0 0 var(--radius-lg) var(--radius-lg)'
            }}>
              <button
                onClick={() => setEditingDept(null)}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--primary-300)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-primary)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!editingDept.name?.trim()}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius)',
                  border: 'none',
                  background: !editingDept.name?.trim() ? 'var(--bg-tertiary)' : 'var(--primary-600)',
                  color: !editingDept.name?.trim() ? 'var(--text-tertiary)' : 'white',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: !editingDept.name?.trim() ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: !editingDept.name?.trim() ? 'none' : '0 1px 2px 0 rgb(37 99 235 / 0.2)'
                }}
                onMouseEnter={(e) => {
                  if (editingDept.name?.trim()) {
                    e.currentTarget.style.background = 'var(--primary-700)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(37 99 235 / 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = !editingDept.name?.trim() ? 'var(--bg-tertiary)' : 'var(--primary-600)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
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
