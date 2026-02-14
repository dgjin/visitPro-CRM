import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ViewState, User, Role, Notification } from '../types';
import { hashPassword } from '../services/supabaseService';
import { HelpDrawer } from './HelpDrawer';
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
  HelpCircle
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  
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
        setIsProfileModalOpen(false); // Also close profile modal
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
        // Close modal
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

  const NavItem = ({ view, icon: Icon, label }: { view: ViewState; icon: any; label: string }) => (
    <button
      onClick={() => {
        setView(view);
        setIsMobileMenuOpen(false);
      }}
      className={`flex items-center w-full px-4 py-3 mb-1 rounded-lg transition-colors ${
        currentView === view
          ? 'bg-indigo-600 text-white shadow-md'
          : 'text-slate-600 hover:bg-slate-100 hover:text-indigo-600'
      }`}
    >
      <Icon className="w-5 h-5 mr-3" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      
      {/* Help Drawer */}
      <HelpDrawer isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Global Toast Container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
          {activeToasts.map(toast => (
              <div 
                 key={toast.id} 
                 className="pointer-events-auto bg-white rounded-lg shadow-xl border border-slate-100 p-3 min-w-[300px] animate-slide-in-right flex items-start cursor-pointer hover:bg-slate-50"
                 onClick={() => markAsRead(toast.id)}
                 role="alert"
              >
                  <div className={`mr-3 mt-0.5 ${
                      toast.type === 'success' ? 'text-emerald-500' :
                      toast.type === 'error' ? 'text-red-500' :
                      toast.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                  }`}>
                      {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
                      {toast.type === 'error' && <XCircle className="w-5 h-5" />}
                      {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
                      {toast.type === 'info' && <Info className="w-5 h-5" />}
                  </div>
                  <div className="flex-1">
                      <h4 className={`text-sm font-bold ${
                           toast.type === 'error' ? 'text-red-700' : 'text-slate-800'
                      }`}>{toast.title}</h4>
                      <p className="text-xs text-slate-500 mt-1">{toast.message}</p>
                  </div>
              </div>
          ))}
      </div>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <Handshake className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">VisitPro</span>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
           {/* Command Palette Trigger Hint */}
           <button 
             onClick={() => setIsCommandOpen(true)}
             className="w-full mb-6 flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all text-xs"
           >
             <span className="flex items-center"><SearchIcon className="w-3.5 h-3.5 mr-2"/> 快速搜索...</span>
             <kbd className="font-mono bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[10px]">⌘K</kbd>
           </button>

          <div className="mb-6">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">业务管理</p>
            <NavItem view="DASHBOARD" icon={LayoutDashboard} label="仪表盘" />
            <NavItem view="CLIENTS" icon={Users} label="客户管理" />
            <NavItem view="VISITS" icon={Briefcase} label="拜访记录" />
          </div>

          {isAdmin && (
            <div className="mb-6">
               <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">组织管理</p>
               <NavItem view="USERS" icon={UserCog} label="用户管理" />
               <NavItem view="DEPARTMENTS" icon={Network} label="部门管理" />
               <NavItem view="ROLES" icon={ShieldCheck} label="角色管理" />
            </div>
          )}

          {isAdmin && (
            <div>
              <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">系统</p>
              <NavItem view="ADMIN" icon={Settings} label="系统设置" />
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 relative" ref={userMenuRef}>
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in-up w-64 origin-bottom-left">
              <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                当前账户
              </div>
              <div className="p-2 border-b border-slate-50">
                 <button 
                    onClick={() => {
                        setIsProfileModalOpen(true);
                        setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center hover:bg-slate-50 rounded-lg transition-colors text-slate-700 hover:text-indigo-600 group"
                 >
                    <UserIcon className="w-4 h-4 mr-3 text-slate-400 group-hover:text-indigo-600" />
                    <span className="text-sm font-medium">个人设置</span>
                 </button>
              </div>
              
              <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 mt-1">
                操作
              </div>
              <div className="max-h-40 overflow-y-auto">
                <button
                    onClick={() => {
                        if (onLogout) onLogout();
                        setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 flex items-center hover:bg-red-50 text-slate-700 hover:text-red-600 transition-colors"
                >
                    <LogOut className="w-4 h-4 mr-3" />
                    <span className="text-sm font-medium">退出登录</span>
                </button>
              </div>
            </div>
          )}
          
          <div 
            className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors group"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <img 
              src={user.avatarUrl} 
              alt="User" 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
            />
            <div className="ml-3 overflow-hidden flex-1">
              <p className="text-sm font-semibold text-slate-700 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate" title={roleName}>{roleName}</p>
            </div>
            <div className="text-slate-400">
               <ChevronUp className={`w-4 h-4 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white h-16 border-b border-slate-200 flex items-center justify-between px-4 z-20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800">VisitPro</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="text-slate-600 focus:outline-none"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 w-full h-[calc(100%-4rem)] bg-white z-10 p-4 flex flex-col md:hidden animate-fade-in-down overflow-y-auto">
            <NavItem view="DASHBOARD" icon={LayoutDashboard} label="仪表盘" />
            <NavItem view="CLIENTS" icon={Users} label="客户管理" />
            <NavItem view="VISITS" icon={Briefcase} label="拜访记录" />
            
            {isAdmin && (
              <>
                <hr className="my-2 border-slate-100"/>
                <NavItem view="USERS" icon={UserCog} label="用户管理" />
                <NavItem view="DEPARTMENTS" icon={Network} label="部门管理" />
                <NavItem view="ROLES" icon={ShieldCheck} label="角色管理" />
                <hr className="my-2 border-slate-100"/>
                <NavItem view="ADMIN" icon={Settings} label="系统设置" />
              </>
            )}

            {/* Mobile Profile & Theme */}
             <div className="mt-4">
               <button 
                  onClick={() => { setIsProfileModalOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full text-left py-2 flex items-center text-slate-700 font-medium"
               >
                  <UserIcon className="w-5 h-5 mr-3 text-slate-400" />
                  个人设置
               </button>

               <button 
                  onClick={() => { setIsHelpOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full text-left py-2 flex items-center text-slate-700 font-medium"
               >
                  <HelpCircle className="w-5 h-5 mr-3 text-slate-400" />
                  使用帮助
               </button>
               
               <p className="text-xs font-semibold text-slate-400 uppercase mt-4 mb-2">界面风格</p>
               <div className="flex flex-wrap gap-2">
                  {THEMES.map(theme => (
                     <button
                        key={theme.id}
                        onClick={() => {
                           if(onUpdateUser) onUpdateUser({ ...user, themePreference: theme.id });
                        }}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${currentTheme === theme.id ? 'border-indigo-600 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: theme.color }}
                        title={theme.name}
                     >
                       {currentTheme === theme.id && <Check className="w-4 h-4 text-white" />}
                     </button>
                  ))}
               </div>
            </div>
            
            {/* Mobile User Switch */}
            <div className="mt-auto border-t border-slate-100 pt-4">
               <button
                  onClick={() => {
                    if (onLogout) onLogout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center p-2 rounded-lg bg-red-50 text-red-700"
                >
                   <LogOut className="w-5 h-5 mr-3" />
                   <span className="block text-sm font-bold">退出登录</span>
                </button>
            </div>
          </div>
        )}

        {/* Top Bar (Desktop) */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8">
           <div className="flex items-center space-x-2">
               <h2 className="text-xl font-semibold text-slate-800">
                 {currentView === 'DASHBOARD' && '仪表盘'}
                 {currentView === 'CLIENTS' && '客户管理'}
                 {currentView === 'VISITS' && '拜访记录'}
                 {currentView === 'USERS' && '用户管理'}
                 {currentView === 'DEPARTMENTS' && '部门管理'}
                 {currentView === 'ROLES' && '角色管理'}
                 {currentView === 'ADMIN' && '系统设置'}
               </h2>
           </div>
           
           <div className="flex items-center space-x-3">
             {/* Help Button */}
             <button
               onClick={() => setIsHelpOpen(true)}
               className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-full transition-colors"
               title="使用帮助"
             >
               <HelpCircle className="w-5 h-5" />
             </button>

             {/* Notification Bell */}
             <div className="relative" ref={notificationRef}>
                 <button 
                    onClick={() => {
                        setIsNotificationOpen(!isNotificationOpen);
                    }}
                    className={`p-2 rounded-full relative transition-colors ${isNotificationOpen ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}
                 >
                   <Bell className="w-5 h-5" />
                   {unreadCount > 0 && (
                       <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white flex items-center justify-center text-[8px] text-white">
                           {unreadCount > 9 ? '9+' : unreadCount}
                       </span>
                   )}
                 </button>
                 
                 {isNotificationOpen && (
                     <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in-up flex flex-col">
                        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <span className="text-xs font-bold text-slate-700 uppercase">系统消息 ({unreadCount})</span>
                            <button onClick={clearNotifications} className="text-xs text-slate-400 hover:text-slate-600 flex items-center">
                                <Trash2 className="w-3 h-3 mr-1" /> 清空
                            </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                            {(notifications || []).length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs">暂无消息</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {(notifications || []).map(n => (
                                        <div 
                                            key={n.id} 
                                            onClick={() => markAsRead(n.id)}
                                            className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer ${!n.read ? 'bg-indigo-50/30' : ''}`}
                                        >
                                            <div className="flex items-start">
                                                <div className={`mt-0.5 mr-3 ${
                                                    n.type === 'success' ? 'text-emerald-500' :
                                                    n.type === 'error' ? 'text-red-500' :
                                                    n.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                                                }`}>
                                                    {n.type === 'success' && <CheckCircle className="w-4 h-4" />}
                                                    {n.type === 'error' && <XCircle className="w-4 h-4" />}
                                                    {n.type === 'warning' && <AlertTriangle className="w-4 h-4" />}
                                                    {n.type === 'info' && <Info className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-medium truncate ${n.type === 'error' ? 'text-red-700' : 'text-slate-800'}`}>{n.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>
                                                    <p className="text-[10px] text-slate-400 mt-1">{new Date(n.timestamp).toLocaleTimeString()}</p>
                                                </div>
                                                {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 ml-2"></div>}
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
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>

      {/* Global Command Palette Modal */}
      {isCommandOpen && (
        <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100] flex items-start justify-center pt-[15vh]">
           <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-scale-in">
              <div className="flex items-center p-4 border-b border-slate-100">
                 <SearchIcon className="w-5 h-5 text-slate-400 mr-3" />
                 <input 
                    ref={commandInputRef}
                    className="flex-1 outline-none text-slate-700 placeholder:text-slate-400 text-lg"
                    placeholder="输入指令或搜索..."
                    value={commandSearch}
                    onChange={e => setCommandSearch(e.target.value)}
                 />
                 <div className="flex items-center gap-1">
                    <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500">ESC</kbd>
                 </div>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                 {/* Navigation Group */}
                 {filteredCommands.navs.length > 0 && (
                    <div className="mb-2">
                       <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase">页面导航</div>
                       {filteredCommands.navs.map(nav => (
                          <button
                             key={nav.view}
                             onClick={() => {
                                setView(nav.view as any);
                                setIsCommandOpen(false);
                             }}
                             className="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors group"
                          >
                             <nav.icon className="w-5 h-5 mr-3 text-slate-400 group-hover:text-indigo-600" />
                             <span className="flex-1 text-left">{nav.label}</span>
                             <ArrowRight className="w-4 h-4 text-slate-300 opacity-0 group-hover:opacity-100" />
                          </button>
                       ))}
                    </div>
                 )}
                 
                 {/* Themes Group */}
                 {filteredCommands.themes.length > 0 && (
                    <div className="mb-2">
                       <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase">切换主题</div>
                       {filteredCommands.themes.map(t => (
                          <button
                             key={t.themeId}
                             onClick={() => {
                                // Direct global update via voice/command for now, ideally should route through user profile
                                if(onUpdateUser) onUpdateUser({ ...user, themePreference: t.themeId });
                                setIsCommandOpen(false);
                             }}
                             className="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                          >
                             <div className="w-5 h-5 rounded-full mr-3 border border-slate-200" style={{ backgroundColor: t.color }}></div>
                             <span className="flex-1 text-left">{t.label}</span>
                             {currentTheme === t.themeId && <Check className="w-4 h-4 text-indigo-600" />}
                          </button>
                       ))}
                    </div>
                 )}

                 {filteredCommands.navs.length === 0 && filteredCommands.themes.length === 0 && (
                    <div className="py-8 text-center text-slate-400">
                       未找到相关指令。
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* User Profile Modal */}
      {isProfileModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50">
                      <div className="flex items-center space-x-3">
                          <UserCog className="w-6 h-6 text-indigo-600" />
                          <h3 className="text-lg font-bold text-slate-800">个人设置</h3>
                      </div>
                      <button onClick={() => setIsProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-6 h-6" />
                      </button>
                  </div>
                  
                  <div className="flex flex-1 overflow-hidden">
                      {/* Tabs Sidebar */}
                      <div className="w-48 bg-slate-50 border-r border-slate-100 p-4 space-y-1">
                          <button 
                              onClick={() => setProfileTab('BASIC')}
                              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors ${profileTab === 'BASIC' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                          >
                              <UserIcon className="w-4 h-4 mr-3" /> 基本信息
                          </button>
                          <button 
                              onClick={() => setProfileTab('PREFS')}
                              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors ${profileTab === 'PREFS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                          >
                              <Palette className="w-4 h-4 mr-3" /> 个性化
                          </button>
                          <button 
                              onClick={() => setProfileTab('SECURITY')}
                              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center transition-colors ${profileTab === 'SECURITY' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                          >
                              <Lock className="w-4 h-4 mr-3" /> 安全设置
                          </button>
                      </div>

                      {/* Content Area */}
                      <div className="flex-1 p-8 overflow-y-auto">
                          {profileTab === 'BASIC' && (
                              <div className="space-y-6">
                                  {/* Avatar */}
                                  <div className="flex items-center space-x-6">
                                      <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                                          <img 
                                              src={editingProfile.avatarUrl} 
                                              alt="Avatar" 
                                              className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md group-hover:opacity-80 transition-opacity"
                                          />
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Camera className="w-8 h-8 text-white" />
                                          </div>
                                          <input 
                                              type="file" 
                                              ref={avatarInputRef} 
                                              onChange={handleAvatarUpload} 
                                              accept="image/*" 
                                              className="hidden" 
                                          />
                                      </div>
                                      <div>
                                          <h4 className="text-sm font-bold text-slate-700 mb-1">头像设置</h4>
                                          <p className="text-xs text-slate-500 mb-3">支持 JPG, PNG 格式，最大 2MB。</p>
                                          <button 
                                              onClick={() => avatarInputRef.current?.click()}
                                              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                                          >
                                              更换图片
                                          </button>
                                      </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">姓名</label>
                                          <input 
                                              value={editingProfile.name}
                                              onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">角色 (只读)</label>
                                          <div className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-500 flex items-center">
                                              <ShieldCheck className="w-4 h-4 mr-2" /> {getUserRoleName(editingProfile)}
                                          </div>
                                      </div>
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">邮箱</label>
                                          <input 
                                              value={editingProfile.email || ''}
                                              onChange={(e) => setEditingProfile({ ...editingProfile, email: e.target.value })}
                                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                              placeholder="name@company.com"
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">电话</label>
                                          <input 
                                              value={editingProfile.phone || ''}
                                              onChange={(e) => setEditingProfile({ ...editingProfile, phone: e.target.value })}
                                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                              placeholder="138-xxxx-xxxx"
                                          />
                                      </div>
                                  </div>
                              </div>
                          )}

                          {profileTab === 'PREFS' && (
                              <div className="space-y-6">
                                  <div>
                                      <h4 className="text-sm font-bold text-slate-800 mb-4">界面主题风格</h4>
                                      <div className="grid grid-cols-3 gap-4">
                                          {THEMES.map(t => (
                                              <button
                                                  key={t.id}
                                                  onClick={() => handleThemeSelect(t.id)}
                                                  className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${editingProfile.themePreference === t.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-100 hover:border-indigo-200'}`}
                                              >
                                                  <div className="w-12 h-12 rounded-full mb-3 shadow-md" style={{ backgroundColor: t.color }}></div>
                                                  <span className={`text-sm font-medium ${editingProfile.themePreference === t.id ? 'text-indigo-700' : 'text-slate-600'}`}>{t.name}</span>
                                                  {editingProfile.themePreference === t.id && <CheckCircle className="w-5 h-5 text-indigo-600 mt-2" />}
                                              </button>
                                          ))}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-4 flex items-center">
                                          <Info className="w-4 h-4 mr-1" /> 点击上方主题可预览选择，点击右下角“保存更改”生效。
                                      </p>
                                  </div>
                              </div>
                          )}

                          {profileTab === 'SECURITY' && (
                              <div className="space-y-6">
                                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl mb-6">
                                      <h4 className="text-sm font-bold text-amber-800 flex items-center mb-1">
                                          <AlertTriangle className="w-4 h-4 mr-2" /> 更改秘密 (密码)
                                      </h4>
                                      <p className="text-xs text-amber-700">建议定期更改密码以保护账户安全。</p>
                                  </div>

                                  <div className="space-y-4 max-w-sm">
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">旧密码</label>
                                          <input 
                                              type="password"
                                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                              placeholder="••••••••"
                                              value={passwordForm.old}
                                              onChange={(e) => setPasswordForm({ ...passwordForm, old: e.target.value })}
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">新密码</label>
                                          <input 
                                              type="password"
                                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                              placeholder="••••••••"
                                              value={passwordForm.new}
                                              onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                          />
                                      </div>
                                      <div>
                                          <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">确认新密码</label>
                                          <input 
                                              type="password"
                                              className="w-full p-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                              placeholder="••••••••"
                                              value={passwordForm.confirm}
                                              onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                          />
                                      </div>
                                      
                                      <button 
                                          onClick={handleChangePassword}
                                          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium w-full transition-colors mt-2"
                                      >
                                          确认修改密码
                                      </button>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button 
                          onClick={() => setIsProfileModalOpen(false)}
                          className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                      >
                          取消
                      </button>
                      <button 
                          onClick={handleSaveProfile}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-md transition-colors"
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