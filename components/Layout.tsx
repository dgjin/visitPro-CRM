import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ViewState, User, Role, Notification } from '../types';
import { hashPassword } from '../services/apiService';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Settings, 
  Menu, 
  X, 
  Bell,
  Network,
  ShieldCheck,
  UserCog,
  ChevronUp,
  Check,
  Palette,
  Handshake,
  Search as SearchIcon,
  ArrowRight,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2,
  Camera,
  LogOut,
  User as UserIcon,
  Lock,
  Moon,
  Sparkles,
  Command,
  ChevronRight
} from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  children: React.ReactNode;
  user: User;
  allUsers?: User[];
  onSwitchUser?: (user: User) => void;
  onUpdateUser?: (user: User) => void;
  currentTheme: string;
  setTheme: (theme: string) => void;
  roles?: Role[];
  notifications?: Notification[];
  setNotifications?: React.Dispatch<React.SetStateAction<Notification[]>>;
  onLogout?: () => void;
}

const THEMES = [
  { id: 'indigo', name: '经典紫', color: '#4f46e5' },
  { id: 'blue', name: '商务蓝', color: '#2563eb' },
  { id: 'emerald', name: '翡翠绿', color: '#059669' },
  { id: 'rose', name: '活力红', color: '#e11d48' },
  { id: 'amber', name: '暖阳橙', color: '#d97706' },
  { id: 'slate', name: '极简灰', color: '#475569' },
];

// CSS Variables for theming
const THEME_CSS_VARS: Record<string, Record<string, string>> = {
  indigo: {
    '--primary': '#4f46e5',
    '--primary-dark': '#4338ca',
    '--primary-light': '#818cf8',
    '--primary-bg': '#eef2ff',
  },
  blue: {
    '--primary': '#2563eb',
    '--primary-dark': '#1d4ed8',
    '--primary-light': '#60a5fa',
    '--primary-bg': '#eff6ff',
  },
  emerald: {
    '--primary': '#059669',
    '--primary-dark': '#047857',
    '--primary-light': '#34d399',
    '--primary-bg': '#ecfdf5',
  },
  rose: {
    '--primary': '#e11d48',
    '--primary-dark': '#be123c',
    '--primary-light': '#fb7185',
    '--primary-bg': '#fff1f2',
  },
  amber: {
    '--primary': '#d97706',
    '--primary-dark': '#b45309',
    '--primary-light': '#fbbf24',
    '--primary-bg': '#fffbeb',
  },
  slate: {
    '--primary': '#475569',
    '--primary-dark': '#334155',
    '--primary-light': '#94a3b8',
    '--primary-bg': '#f8fafc',
  },
};

export const Layout: React.FC<LayoutProps> = ({ 
  currentView, 
  setView, 
  children, 
  user, 
  allUsers = [], 
  onSwitchUser,
  onUpdateUser,
  currentTheme,
  setTheme,
  roles = [],
  notifications = [],
  setNotifications,
  onLogout
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  
  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'BASIC' | 'PREFS' | 'SECURITY'>('BASIC');
  const [editingProfile, setEditingProfile] = useState<User>(user);
  const [passwordForm, setPasswordForm] = useState({ old: '', new: '', confirm: '' });
  
  // Command Palette State
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const unreadCount = notifications ? notifications.filter(n => !n.read).length : 0;

  // Apply CSS variables for current theme
  useEffect(() => {
    const vars = THEME_CSS_VARS[currentTheme] || THEME_CSS_VARS['indigo'];
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, [currentTheme]);

  // Active Toasts
  const activeToasts = useMemo(() => {
      const now = Date.now();
      return (notifications || [])
        .filter(n => !n.read && (now - n.timestamp < 5000)) 
        .slice(0, 3);
  }, [notifications]);

  // Sync editing profile when user changes
  useEffect(() => {
      setEditingProfile(user);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Command Palette Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandOpen(false);
        setIsProfileModalOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when command palette opens
  useEffect(() => {
    if (isCommandOpen) {
      setTimeout(() => commandInputRef.current?.focus(), 100);
      setCommandSearch('');
    }
  }, [isCommandOpen]);

  const markAsRead = (id: string) => {
      if (setNotifications) {
          setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
  };

  const clearNotifications = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (setNotifications) {
        setNotifications([]);
    }
  };

  // Profile Handlers
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("图片大小不能超过 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditingProfile(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = () => {
      if (onUpdateUser) {
          onUpdateUser(editingProfile);
          if (setNotifications) {
              setNotifications(prev => [
                  ...prev, 
                  { id: Date.now().toString(), title: '个人信息已更新', message: '您的修改已成功保存。', type: 'success', timestamp: Date.now(), read: false }
              ]);
          }
      }
      setIsProfileModalOpen(false);
  };

  // Only update local state, DO NOT call global setTheme immediately
  const handleThemeSelect = (themeId: string) => {
      setEditingProfile(prev => ({ ...prev, themePreference: themeId }));
  };

  const handleChangePassword = async () => {
      if (!passwordForm.new || passwordForm.new !== passwordForm.confirm) {
          alert("两次输入的新密码不一致，或密码为空。");
          return;
      }
      
      try {
        // Use global util
        const hashedPassword = await hashPassword(passwordForm.new);

        // Update profile with hashed password
        const updatedProfile = { ...editingProfile, password: hashedPassword };
        setEditingProfile(updatedProfile);
        
        if (onUpdateUser) {
            onUpdateUser(updatedProfile);
            if (setNotifications) {
                setNotifications(prev => [
                    ...prev, 
                    { id: Date.now().toString(), title: '密码已修改', message: '您的账户密码已加密并安全保存。', type: 'success', timestamp: Date.now(), read: false }
                ]);
            }
        }
        setPasswordForm({ old: '', new: '', confirm: '' });
        setIsProfileModalOpen(false);
      } catch (error) {
        console.error("Password encryption failed:", error);
        alert("密码处理失败，请重试。");
      }
  };

  // Filtered Commands
  const filteredCommands = useMemo(() => {
    const term = commandSearch.toLowerCase();
    
    const navs = [
      { label: 'Go to Dashboard (仪表盘)', view: 'DASHBOARD', icon: LayoutDashboard },
      { label: 'Go to Clients (客户管理)', view: 'CLIENTS', icon: Users },
      { label: 'Go to Visits (拜访记录)', view: 'VISITS', icon: Briefcase },
      { label: 'Go to Users (用户管理)', view: 'USERS', icon: UserCog, adminOnly: true },
      { label: 'Go to Departments (部门管理)', view: 'DEPARTMENTS', icon: Network, adminOnly: true },
      { label: 'Go to Roles (角色管理)', view: 'ROLES', icon: ShieldCheck, adminOnly: true },
      { label: 'System Settings (系统设置)', view: 'ADMIN', icon: Settings, adminOnly: true },
    ].filter(item => {
        if (item.adminOnly && getUserRoleName(user) !== '管理员') return false;
        return item.label.toLowerCase().includes(term);
    });

    const themes = THEMES.map(t => ({
      label: `Switch Theme: ${t.name}`,
      themeId: t.id,
      color: t.color
    })).filter(item => item.label.toLowerCase().includes(term));

    return { navs, themes };
  }, [commandSearch, user]);

  // Helper to resolve dynamic role name
  function getUserRoleName(u: User) {
    if (u.roleId && roles.length > 0) {
      const foundRole = roles.find(r => r.id === u.roleId);
      if (foundRole) return foundRole.name;
    }
    return u.role || '用户';
  };

  const roleName = getUserRoleName(user);
  const isAdmin = roleName === '管理员';

  const getThemeColor = () => {
    return THEME_CSS_VARS[currentTheme]?.['--primary'] || '#4f46e5';
  };

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => {
    const isActive = currentView === view;
    const primaryColor = getThemeColor();
    
    return (
      <button
        onClick={() => {
          setView(view);
          setIsMobileMenuOpen(false);
        }}
        className={`group flex items-center w-full px-3 py-2.5 mb-0.5 rounded-lg transition-all duration-200 ${
          isActive
            ? 'text-white shadow-sm'
            : 'text-[var(--gray-600)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-900)]'
        }`}
        style={isActive ? { backgroundColor: primaryColor } : {}}
      >
        <div className={`flex items-center justify-center w-8 h-8 rounded-md mr-3 transition-all ${
          isActive 
            ? 'bg-white/20' 
            : 'bg-transparent group-hover:bg-[var(--gray-200)]'
        }`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <span className="font-medium text-sm tracking-wide">{label}</span>
        {isActive && (
          <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
        )}
      </button>
    );
  };

  const getViewTitle = () => {
    const titles: Record<ViewState, string> = {
      DASHBOARD: '仪表盘',
      CLIENTS: '客户管理',
      VISITS: '拜访记录',
      USERS: '用户管理',
      DEPARTMENTS: '部门管理',
      ROLES: '角色管理',
      ADMIN: '系统设置'
    };
    return titles[currentView] || '';
  };

  return (
    <div className="flex h-screen bg-[var(--gray-50)] overflow-hidden">
      {/* CSS Variables */}
      <style>{`
        :root {
          --primary: #2563eb;
          --primary-dark: #1d4ed8;
          --primary-light: #60a5fa;
          --primary-bg: #eff6ff;
          
          --gray-50: #f9fafb;
          --gray-100: #f3f4f6;
          --gray-200: #e5e7eb;
          --gray-300: #d1d5db;
          --gray-400: #9ca3af;
          --gray-500: #6b7280;
          --gray-600: #4b5563;
          --gray-700: #374151;
          --gray-800: #1f2937;
          --gray-900: #111827;
          
          --success: #10b981;
          --warning: #f59e0b;
          --error: #ef4444;
          --info: #8b5cf6;
          
          --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
          --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
          --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
          
          --glass-bg: rgba(255, 255, 255, 0.85);
          --glass-border: rgba(255, 255, 255, 0.5);
          
          --radius-sm: 6px;
          --radius: 8px;
          --radius-md: 12px;
          --radius-lg: 16px;
          --radius-xl: 20px;
        }
        
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes fade-in-up {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fade-in-down {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.2s ease-out;
        }
        
        .animate-fade-in-down {
          animation: fade-in-down 0.2s ease-out;
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
      
      {/* Global Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {activeToasts.map(toast => (
              <div 
                 key={toast.id} 
                 className="pointer-events-auto bg-white rounded-lg shadow-lg border border-[var(--gray-200)] p-4 min-w-[320px] animate-slide-in-right flex items-start cursor-pointer hover:shadow-xl transition-shadow"
                 onClick={() => markAsRead(toast.id)}
                 role="alert"
                 style={{ borderLeftWidth: '4px', borderLeftColor: 
                   toast.type === 'success' ? 'var(--success)' :
                   toast.type === 'error' ? 'var(--error)' :
                   toast.type === 'warning' ? 'var(--warning)' : 'var(--info)'
                 }}
              >
                  <div className={`mr-3 mt-0.5 ${
                      toast.type === 'success' ? 'text-[var(--success)]' :
                      toast.type === 'error' ? 'text-[var(--error)]' :
                      toast.type === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--info)]'
                  }`}>
                      {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                      {toast.type === 'error' && <XCircle className="w-5 h-5" />}
                      {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                      {toast.type === 'info' && <Info className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                      <h4 className={`text-sm font-semibold ${
                           toast.type === 'error' ? 'text-[var(--error)]' : 'text-[var(--gray-800)]'
                      }`}>{toast.title}</h4>
                      <p className="text-xs text-[var(--gray-500)] mt-0.5">{toast.message}</p>
                  </div>
              </div>
          ))}
      </div>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-[260px] bg-white border-r border-[var(--gray-200)]">
        {/* Logo */}
        <div className="h-16 px-5 flex items-center border-b border-[var(--gray-100)]">
          <div 
            className="w-9 h-9 rounded-lg flex items-center justify-center mr-3"
            style={{ backgroundColor: getThemeColor() }}
          >
            <Handshake className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-[var(--gray-900)] tracking-tight">VisitPro</span>
            <span className="block text-[10px] text-[var(--gray-400)] -mt-0.5">CRM 管理系统</span>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {/* Command Palette Trigger */}
          <button 
            onClick={() => setIsCommandOpen(true)}
            className="w-full mb-5 flex items-center justify-between px-3 py-2.5 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg text-[var(--gray-500)] hover:border-[var(--gray-300)] hover:bg-[var(--gray-100)] transition-all text-sm"
          >
            <span className="flex items-center">
              <SearchIcon className="w-4 h-4 mr-2.5"/>
              <span>快速搜索...</span>
            </span>
            <kbd className="font-mono bg-white border border-[var(--gray-200)] rounded px-1.5 py-0.5 text-[10px] text-[var(--gray-400)]">⌘K</kbd>
          </button>

          {/* Main Navigation */}
          <div className="mb-6">
            <p className="px-3 text-[11px] font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-2">业务管理</p>
            <NavItem view="DASHBOARD" icon={LayoutDashboard} label="仪表盘" />
            <NavItem view="CLIENTS" icon={Users} label="客户管理" />
            <NavItem view="VISITS" icon={Briefcase} label="拜访记录" />
          </div>

          {isAdmin && (
            <div className="mb-6">
               <p className="px-3 text-[11px] font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-2">组织管理</p>
               <NavItem view="USERS" icon={UserCog} label="用户管理" />
               <NavItem view="DEPARTMENTS" icon={Network} label="部门管理" />
               <NavItem view="ROLES" icon={ShieldCheck} label="角色管理" />
            </div>
          )}

          {isAdmin && (
            <div>
              <p className="px-3 text-[11px] font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-2">系统</p>
              <NavItem view="ADMIN" icon={Settings} label="系统设置" />
            </div>
          )}
        </nav>

        {/* User Menu */}
        <div className="p-3 border-t border-[var(--gray-100)] relative" ref={userMenuRef}>
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-xl border border-[var(--gray-200)] overflow-hidden z-50 animate-fade-in-up">
              {/* User Info Card */}
              <div className="p-4 bg-gradient-to-br from-[var(--gray-50)] to-white border-b border-[var(--gray-100)]">
                <div className="flex items-center">
                  <img 
                    src={user.avatarUrl} 
                    alt="User" 
                    className="w-12 h-12 rounded-full border-2 border-white shadow-sm object-cover"
                  />
                  <div className="ml-3">
                    <p className="font-semibold text-[var(--gray-800)] text-sm">{user.name}</p>
                    <p className="text-xs text-[var(--gray-500)]">{roleName}</p>
                  </div>
                </div>
              </div>
              
              {/* Menu Items */}
              <div className="p-2">
                <button 
                  onClick={() => {
                      setIsProfileModalOpen(true);
                      setIsUserMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 flex items-center rounded-lg hover:bg-[var(--gray-100)] transition-colors text-[var(--gray-700)] group"
                >
                  <div className="w-7 h-7 rounded-md bg-[var(--primary-bg)] flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                    <UserIcon className="w-4 h-4" style={{ color: getThemeColor() }} />
                  </div>
                  <span className="text-sm font-medium">个人设置</span>
                </button>
                
                <button
                    onClick={() => {
                        if (onLogout) onLogout();
                        setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center rounded-lg hover:bg-red-50 text-[var(--gray-700)] hover:text-red-600 transition-colors group mt-1"
                >
                  <div className="w-7 h-7 rounded-md bg-red-50 flex items-center justify-center mr-3 group-hover:scale-105 transition-transform">
                    <LogOut className="w-4 h-4 text-red-500" />
                  </div>
                  <span className="text-sm font-medium">退出登录</span>
                </button>
              </div>
            </div>
          )}
          
          {/* User Menu Trigger */}
          <div 
            className="flex items-center p-2.5 rounded-xl bg-[var(--gray-50)] border border-[var(--gray-200)] cursor-pointer hover:bg-[var(--gray-100)] hover:border-[var(--gray-300)] transition-all group"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <img 
              src={user.avatarUrl} 
              alt="User" 
              className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover"
            />
            <div className="ml-3 overflow-hidden flex-1">
              <p className="text-sm font-semibold text-[var(--gray-800)] truncate">{user.name}</p>
              <p className="text-xs text-[var(--gray-500)] truncate" title={roleName}>{roleName}</p>
            </div>
            <div className="text-[var(--gray-400)]">
               <ChevronUp className={`w-4 h-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden h-14 bg-white border-b border-[var(--gray-200)] flex items-center justify-between px-4 z-20">
          <div className="flex items-center">
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center mr-2"
              style={{ backgroundColor: getThemeColor() }}
            >
              <Handshake className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[var(--gray-800)] text-lg">VisitPro</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--gray-600)] hover:bg-[var(--gray-100)] transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-14 left-0 w-full h-[calc(100%-3.5rem)] bg-white z-10 p-4 flex flex-col md:hidden animate-fade-in-down overflow-y-auto">
            <div className="space-y-1">
              <NavItem view="DASHBOARD" icon={LayoutDashboard} label="仪表盘" />
              <NavItem view="CLIENTS" icon={Users} label="客户管理" />
              <NavItem view="VISITS" icon={Briefcase} label="拜访记录" />
            </div>
            
            {isAdmin && (
              <>
                <div className="my-4 h-px bg-[var(--gray-200)]" />
                <p className="px-3 text-[11px] font-semibold text-[var(--gray-400)] uppercase tracking-wider mb-2">组织管理</p>
                <NavItem view="USERS" icon={UserCog} label="用户管理" />
                <NavItem view="DEPARTMENTS" icon={Network} label="部门管理" />
                <NavItem view="ROLES" icon={ShieldCheck} label="角色管理" />
                <div className="my-4 h-px bg-[var(--gray-200)]" />
                <NavItem view="ADMIN" icon={Settings} label="系统设置" />
              </>
            )}

            {/* Mobile Profile & Theme */}
             <div className="mt-auto pt-4 border-t border-[var(--gray-200)]">
               <button 
                  onClick={() => { setIsProfileModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center p-3 rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-700)] transition-colors"
               >
                  <UserIcon className="w-5 h-5 mr-3 text-[var(--gray-400)]" />
                  <span className="font-medium">个人设置</span>
               </button>
               
               <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center p-3 rounded-lg bg-red-50 text-red-600 mt-2 hover:bg-red-100 transition-colors"
                >
                   <LogOut className="w-5 h-5 mr-3" />
                   <span className="font-medium">退出登录</span>
                </button>
            </div>
          </div>
        )}

        {/* Top Bar (Desktop) - Glass Effect */}
        <header 
          className="hidden md:flex h-14 items-center justify-between px-6 sticky top-0 z-30"
          style={{
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--glass-border)',
          }}
        >
           <div className="flex items-center">
             <h2 className="text-lg font-semibold text-[var(--gray-800)]">
               {getViewTitle()}
             </h2>
           </div>
           
           <div className="flex items-center gap-2">
             {/* Command Palette Button */}
             <button
               onClick={() => setIsCommandOpen(true)}
               className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--gray-100)] text-[var(--gray-500)] hover:bg-[var(--gray-200)] transition-colors text-sm"
             >
               <SearchIcon className="w-4 h-4" />
               <span className="hidden lg:inline">搜索</span>
               <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-[var(--gray-300)] bg-white px-1.5 font-mono text-[10px] text-[var(--gray-500)]">⌘K</kbd>
             </button>
             
             {/* Notification Bell */}
             <div className="relative" ref={notificationRef}>
                 <button 
                    onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all relative ${
                      isNotificationOpen 
                        ? 'bg-[var(--primary-bg)]' 
                        : 'text-[var(--gray-500)] hover:bg-[var(--gray-100)]'
                    }`}
                    style={isNotificationOpen ? { color: getThemeColor() } : {}}
                 >
                   <Bell className="w-[18px] h-[18px]" />
                   {unreadCount > 0 && (
                       <span 
                         className="absolute top-1.5 right-1.5 min-w-[16px] h-4 rounded-full text-[10px] font-medium text-white flex items-center justify-center px-1"
                         style={{ backgroundColor: getThemeColor() }}
                       >
                           {unreadCount > 99 ? '99+' : unreadCount}
                       </span>
                   )}
                 </button>
                 
                 {isNotificationOpen && (
                     <div className="absolute top-full right-0 mt-2 w-[360px] bg-white rounded-xl shadow-xl border border-[var(--gray-200)] overflow-hidden z-50 animate-fade-in-up flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-[var(--gray-100)] flex justify-between items-center bg-gradient-to-r from-white to-[var(--gray-50)]">
                            <div>
                              <span className="text-sm font-semibold text-[var(--gray-800)]">通知中心</span>
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-[var(--primary-bg)]" style={{ color: getThemeColor() }}>
                                {unreadCount} 未读
                              </span>
                            </div>
                            <button 
                              onClick={clearNotifications} 
                              className="text-xs text-[var(--gray-500)] hover:text-[var(--error)] flex items-center transition-colors"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" /> 清空
                            </button>
                        </div>
                        
                        {/* Notification List */}
                        <div className="max-h-[400px] overflow-y-auto">
                            {(notifications || []).length === 0 ? (
                                <div className="p-10 text-center text-[var(--gray-400)]">
                                    <div className="w-16 h-16 rounded-full bg-[var(--gray-100)] flex items-center justify-center mx-auto mb-3">
                                      <Bell className="w-7 h-7 opacity-40" />
                                    </div>
                                    <p className="text-sm">暂无通知</p>
                                    <p className="text-xs mt-1 opacity-70">新消息将在这里显示</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-[var(--gray-100)]">
                                    {(notifications || []).map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => markAsRead(n.id)}
                                            className={`p-4 hover:bg-[var(--gray-50)] transition-colors cursor-pointer ${!n.read ? 'bg-[var(--primary-bg)]/30' : ''}`}
                                        >
                                            <div className="flex items-start">
                                                <div className={`mr-3 mt-0.5 ${
                                                    n.type === 'success' ? 'text-[var(--success)]' :
                                                    n.type === 'error' ? 'text-[var(--error)]' :
                                                    n.type === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--info)]'
                                                }`}>
                                                    {n.type === 'success' && <CheckCircle className="w-5 h-5" />}
                                                    {n.type === 'error' && <XCircle className="w-5 h-5" />}
                                                    {n.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                                                    {n.type === 'info' && <Info className="w-5 h-5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${n.type === 'error' ? 'text-[var(--error)]' : 'text-[var(--gray-800)]'}`}>
                                                      {n.title}
                                                    </p>
                                                    <p className="text-xs text-[var(--gray-500)] mt-0.5 line-clamp-2">{n.message}</p>
                                                    <p className="text-[11px] text-[var(--gray-400)] mt-1.5 flex items-center">
                                                      <span>{new Date(n.timestamp).toLocaleTimeString()}</span>
                                                    </p>
                                                </div>
                                                {!n.read && (
                                                  <div 
                                                    className="w-2 h-2 rounded-full mt-2 ml-2 flex-shrink-0"
                                                    style={{ backgroundColor: getThemeColor() }}
                                                  />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                     </div>
                 )}
             </div>
           </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      {/* Global Command Palette Modal */}
      {isCommandOpen && (
        <div className="fixed inset-0 bg-[var(--gray-900)]/40 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh]">
           <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-[var(--gray-200)] overflow-hidden flex flex-col animate-scale-in">
              {/* Search Header */}
              <div className="flex items-center px-5 py-4 border-b border-[var(--gray-100)]">
                 <Command className="w-5 h-5 text-[var(--gray-400)] mr-3" />
                 <input 
                    ref={commandInputRef}
                    className="flex-1 outline-none text-[var(--gray-800)] placeholder:text-[var(--gray-400)] text-base bg-transparent"
                    placeholder="输入指令或搜索..."
                    value={commandSearch}
                    onChange={e => setCommandSearch(e.target.value)}
                 />
                 <kbd className="hidden md:inline-flex h-6 items-center gap-1 rounded-md border border-[var(--gray-200)] bg-[var(--gray-50)] px-2 font-mono text-[11px] font-medium text-[var(--gray-500)]">ESC</kbd>
              </div>
              
              {/* Results */}
              <div className="max-h-[50vh] overflow-y-auto p-2">
                 {/* Navigation Group */}
                 {filteredCommands.navs.length > 0 && (
                    <div className="mb-1">
                       <div className="text-[11px] font-semibold text-[var(--gray-400)] px-3 py-2 uppercase tracking-wider">页面导航</div>
                       {filteredCommands.navs.map((nav, idx) => (
                          <button
                             key={nav.view}
                             onClick={() => {
                                setView(nav.view as any);
                                setIsCommandOpen(false);
                             }}
                             className="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-700)] transition-colors group"
                          >
                             <div 
                               className="w-8 h-8 rounded-md flex items-center justify-center mr-3"
                               style={{ backgroundColor: idx === 0 ? 'var(--primary-bg)' : 'var(--gray-100)' }}
                             >
                               <nav.icon 
                                 className="w-4 h-4" 
                                 style={{ color: idx === 0 ? getThemeColor() : 'var(--gray-500)' }}
                               />
                             </div>
                             <span className="flex-1 text-left text-sm font-medium">{nav.label}</span>
                             <ArrowRight className="w-4 h-4 text-[var(--gray-300)] opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                       ))}
                    </div>
                 )}
                 
                 {/* Themes Group */}
                 {filteredCommands.themes.length > 0 && (
                    <div className="mb-1">
                       <div className="text-[11px] font-semibold text-[var(--gray-400)] px-3 py-2 uppercase tracking-wider">切换主题</div>
                       {filteredCommands.themes.map(t => (
                          <button
                             key={t.themeId}
                             onClick={() => {
                                if(onUpdateUser) onUpdateUser({ ...user, themePreference: t.themeId });
                                setIsCommandOpen(false);
                             }}
                             className="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-700)] transition-colors"
                          >
                             <div className="w-8 h-8 rounded-md flex items-center justify-center mr-3" style={{ backgroundColor: t.color }}>
                               <Palette className="w-4 h-4 text-white" />
                             </div>
                             <span className="flex-1 text-left text-sm font-medium">{t.label}</span>
                             {currentTheme === t.themeId && (
                               <Check className="w-4 h-4" style={{ color: getThemeColor() }} />
                             )}
                          </button>
                       ))}
                    </div>
                 )}

                 {filteredCommands.navs.length === 0 && filteredCommands.themes.length === 0 && (
                    <div className="py-10 text-center text-[var(--gray-400)]">
                       <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
                       <p className="text-sm">未找到相关指令</p>
                       <p className="text-xs mt-1">尝试使用其他关键词搜索</p>
                    </div>
                 )}
              </div>
              
              {/* Footer */}
              <div className="px-5 py-3 bg-[var(--gray-50)] border-t border-[var(--gray-100)] flex items-center justify-between text-[11px] text-[var(--gray-400)]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center"><kbd className="font-mono bg-white border border-[var(--gray-200)] rounded px-1 mr-1">↑↓</kbd> 选择</span>
                  <span className="flex items-center"><kbd className="font-mono bg-white border border-[var(--gray-200)] rounded px-1 mr-1">↵</kbd> 确认</span>
                </div>
                <span>{filteredCommands.navs.length + filteredCommands.themes.length} 个结果</span>
              </div>
           </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && (
          <div className="fixed inset-0 bg-[var(--gray-900)]/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="flex justify-between items-center px-6 py-4 border-b border-[var(--gray-100)] bg-gradient-to-r from-white to-[var(--gray-50)]">
                      <div className="flex items-center">
                          <div 
                            className="w-10 h-10 rounded-xl flex items-center justify-center mr-3"
                            style={{ backgroundColor: 'var(--primary-bg)' }}
                          >
                            <UserCog className="w-5 h-5" style={{ color: getThemeColor() }} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-[var(--gray-800)]">个人设置</h3>
                            <p className="text-xs text-[var(--gray-500)]">管理您的个人信息和偏好设置</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => setIsProfileModalOpen(false)} 
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--gray-400)] hover:bg-[var(--gray-100)] hover:text-[var(--gray-600)] transition-colors"
                      >
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="flex flex-1 overflow-hidden">
                      {/* Tabs Sidebar */}
                      <div className="w-52 bg-[var(--gray-50)] border-r border-[var(--gray-100)] p-4">
                          <nav className="space-y-1">
                              <button 
                                  onClick={() => setProfileTab('BASIC')}
                                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center transition-all ${
                                    profileTab === 'BASIC' 
                                      ? 'bg-white text-[var(--gray-800)] shadow-sm' 
                                      : 'text-[var(--gray-600)] hover:bg-[var(--gray-100)]'
                                  }`}
                              >
                                  <div 
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                                      profileTab === 'BASIC' ? '' : 'bg-[var(--gray-100)]'
                                    }`}
                                    style={profileTab === 'BASIC' ? { backgroundColor: 'var(--primary-bg)' } : {}}
                                  >
                                    <UserIcon 
                                      className="w-4 h-4" 
                                      style={profileTab === 'BASIC' ? { color: getThemeColor() } : { color: 'var(--gray-500)' }}
                                    />
                                  </div>
                                  基本信息
                                  {profileTab === 'BASIC' && (
                                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: getThemeColor() }} />
                                  )}
                              </button>
                              <button 
                                  onClick={() => setProfileTab('PREFS')}
                                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center transition-all ${
                                    profileTab === 'PREFS' 
                                      ? 'bg-white text-[var(--gray-800)] shadow-sm' 
                                      : 'text-[var(--gray-600)] hover:bg-[var(--gray-100)]'
                                  }`}
                              >
                                  <div 
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                                      profileTab === 'PREFS' ? '' : 'bg-[var(--gray-100)]'
                                    }`}
                                    style={profileTab === 'PREFS' ? { backgroundColor: 'var(--primary-bg)' } : {}}
                                  >
                                    <Palette 
                                      className="w-4 h-4" 
                                      style={profileTab === 'PREFS' ? { color: getThemeColor() } : { color: 'var(--gray-500)' }}
                                    />
                                  </div>
                                  个性化
                                  {profileTab === 'PREFS' && (
                                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: getThemeColor() }} />
                                  )}
                              </button>
                              <button 
                                  onClick={() => setProfileTab('SECURITY')}
                                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium flex items-center transition-all ${
                                    profileTab === 'SECURITY' 
                                      ? 'bg-white text-[var(--gray-800)] shadow-sm' 
                                      : 'text-[var(--gray-600)] hover:bg-[var(--gray-100)]'
                                  }`}
                              >
                                  <div 
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center mr-3 ${
                                      profileTab === 'SECURITY' ? '' : 'bg-[var(--gray-100)]'
                                    }`}
                                    style={profileTab === 'SECURITY' ? { backgroundColor: 'var(--primary-bg)' } : {}}
                                  >
                                    <Lock 
                                      className="w-4 h-4" 
                                      style={profileTab === 'SECURITY' ? { color: getThemeColor() } : { color: 'var(--gray-500)' }}
                                    />
                                  </div>
                                  安全设置
                                  {profileTab === 'SECURITY' && (
                                    <ChevronRight className="w-4 h-4 ml-auto" style={{ color: getThemeColor() }} />
                                  )}
                              </button>
                          </nav>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 p-6 overflow-y-auto">
                          {profileTab === 'BASIC' && (
                              <div className="space-y-6">
                                  {/* Avatar */}
                                  <div className="flex items-center p-4 bg-[var(--gray-50)] rounded-xl border border-[var(--gray-100)]">
                                      <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                                          <img 
                                              src={editingProfile.avatarUrl} 
                                              alt="Avatar" 
                                              className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md group-hover:opacity-80 transition-opacity"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Camera className="w-6 h-6 text-white" />
                                          </div>
                                          <input 
                                              type="file" 
                                              ref={avatarInputRef} 
                                              onChange={handleAvatarUpload} 
                                              accept="image/*" 
                                              className="hidden" 
                                          />
                                      </div>
                                      <div className="ml-5">
                                          <h4 className="text-sm font-semibold text-[var(--gray-800)] mb-1">头像设置</h4>
                                          <p className="text-xs text-[var(--gray-500)] mb-3">支持 JPG, PNG 格式，最大 2MB</p>
                                          <button 
                                              onClick={() => avatarInputRef.current?.click()}
                                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                                              style={{ 
                                                backgroundColor: 'var(--primary-bg)', 
                                                color: getThemeColor() 
                                              }}
                                          >
                                              更换图片
                                          </button>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">姓名</label>
                                          <input 
                                              value={editingProfile.name}
                                              onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                                              className="w-full px-3 py-2.5 rounded-lg border border-[var(--gray-200)] focus:ring-2 focus:outline-none text-sm bg-white transition-all"
                                              style={{ '--tw-ring-color': `${getThemeColor()}33` } as React.CSSProperties}
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">角色</label>
                                          <div className="w-full px-3 py-2.5 rounded-lg bg-[var(--gray-100)] border border-[var(--gray-200)] text-sm text-[var(--gray-500)] flex items-center">
                                              <ShieldCheck className="w-4 h-4 mr-2" /> {getUserRoleName(editingProfile)}
                                          </div>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">邮箱</label>
                                          <input 
                                              value={editingProfile.email || ''}
                                              onChange={(e) => setEditingProfile({ ...editingProfile, email: e.target.value })}
                                              className="w-full px-3 py-2.5 rounded-lg border border-[var(--gray-200)] focus:ring-2 focus:outline-none text-sm bg-white transition-all"
                                              style={{ '--tw-ring-color': `${getThemeColor()}33` } as React.CSSProperties}
                                              placeholder="name@company.com"
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">电话</label>
                                          <input 
                                              value={editingProfile.phone || ''}
                                              onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                                              className="w-full px-3 py-2.5 rounded-lg border border-[var(--gray-200)] focus:ring-2 focus:outline-none text-sm bg-white transition-all"
                                              style={{ '--tw-ring-color': `${getThemeColor()}33` } as React.CSSProperties}
                                              placeholder="138-xxxx-xxxx"
                                          />
                                      </div>
                                  </div>
                              </div>
                          )}

                          {profileTab === 'PREFS' && (
                              <div className="space-y-6">
                                  <div>
                                      <div className="flex items-center mb-4">
                                        <Sparkles className="w-5 h-5 mr-2" style={{ color: getThemeColor() }} />
                                        <h4 className="text-sm font-semibold text-[var(--gray-800)]">界面主题风格</h4>
                                      </div>
                                      <div className="grid grid-cols-3 gap-3">
                                          {THEMES.map(t => (
                                              <button
                                                  key={t.id}
                                                  onClick={() => handleThemeSelect(t.id)}
                                                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                                                    editingProfile.themePreference === t.id 
                                                      ? 'border-[var(--primary)] bg-[var(--primary-bg)]' 
                                                      : 'border-[var(--gray-200)] hover:border-[var(--gray-300)] bg-white'
                                                  }`}
                                                  style={editingProfile.themePreference === t.id ? { borderColor: getThemeColor() } : {}}
                                              >
                                                  <div className="w-12 h-12 rounded-full mb-3 shadow-sm" style={{ backgroundColor: t.color }}></div>
                                                  <span className={`text-sm font-medium ${editingProfile.themePreference === t.id ? 'text-[var(--gray-800)]' : 'text-[var(--gray-600)]'}`}>
                                                    {t.name}
                                                  </span>
                                                  {editingProfile.themePreference === t.id && (
                                                    <CheckCircle className="w-4 h-4 mt-2" style={{ color: getThemeColor() }} />
                                                  )}
                                              </button>
                                          ))}
                                      </div>
                                      <p className="text-xs text-[var(--gray-400)] mt-4 flex items-center p-3 bg-[var(--gray-50)] rounded-lg">
                                          <Info className="w-4 h-4 mr-2 flex-shrink-0" /> 
                                          点击上方主题可预览选择，点击右下角"保存更改"生效
                                      </p>
                                  </div>
                              </div>
                          )}

                          {profileTab === 'SECURITY' && (
                              <div className="space-y-6">
                                  <div className="p-4 rounded-xl border" style={{ backgroundColor: '#fffbeb', borderColor: '#fef3c7' }}>
                                      <h4 className="text-sm font-semibold text-amber-800 flex items-center mb-1">
                                          <AlertTriangle className="w-4 h-4 mr-2" /> 更改密码
                                      </h4>
                                      <p className="text-xs text-amber-700">建议定期更改密码以保护账户安全</p>
                                  </div>

                                  <div className="space-y-4 max-w-sm">
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">旧密码</label>
                                          <input 
                                              type="password"
                                              className="w-full px-3 py-2.5 rounded-lg border border-[var(--gray-200)] focus:ring-2 focus:outline-none text-sm bg-white transition-all"
                                              style={{ '--tw-ring-color': `${getThemeColor()}33` } as React.CSSProperties}
                                              placeholder="输入当前密码"
                                              value={passwordForm.old}
                                              onChange={(e) => setPasswordForm({ ...passwordForm, old: e.target.value })}
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">新密码</label>
                                          <input 
                                              type="password"
                                              className="w-full px-3 py-2.5 rounded-lg border border-[var(--gray-200)] focus:ring-2 focus:outline-none text-sm bg-white transition-all"
                                              style={{ '--tw-ring-color': `${getThemeColor()}33` } as React.CSSProperties}
                                              placeholder="输入新密码"
                                              value={passwordForm.new}
                                              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-medium text-[var(--gray-600)] mb-2">确认新密码</label>
                                          <input 
                                              type="password"
                                              className="w-full px-3 py-2.5 rounded-lg border border-[var(--gray-200)] focus:ring-2 focus:outline-none text-sm bg-white transition-all"
                                              style={{ '--tw-ring-color': `${getThemeColor()}33` } as React.CSSProperties}
                                              placeholder="再次输入新密码"
                                              value={passwordForm.confirm}
                                              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                          />
                                      </div>
                                      
                                      <button 
                                          onClick={handleChangePassword}
                                          className="w-full text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2"
                                          style={{ backgroundColor: getThemeColor() }}
                                      >
                                          确认修改密码
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-[var(--gray-100)] bg-[var(--gray-50)] flex justify-end gap-3">
                      <button 
                          onClick={() => setIsProfileModalOpen(false)}
                          className="px-5 py-2 text-[var(--gray-600)] hover:bg-[var(--gray-200)] rounded-lg text-sm font-medium transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handleSaveProfile}
                          className="px-6 py-2 text-white rounded-lg text-sm font-medium shadow-sm transition-all hover:shadow-md"
                          style={{ backgroundColor: getThemeColor() }}
                      >
                          保存更改
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
