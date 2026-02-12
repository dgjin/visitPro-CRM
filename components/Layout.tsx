import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ViewState, User, Role } from '../types';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Settings, 
  Menu, 
  X, 
  LogOut,
  Bell,
  Network,
  ShieldCheck,
  UserCog,
  ChevronUp,
  Check,
  Palette,
  Handshake,
  Search as SearchIcon,
  ArrowRight
} from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  children: React.ReactNode;
  user: User;
  allUsers?: User[];
  onSwitchUser?: (user: User) => void;
  currentTheme: string;
  setTheme: (theme: string) => void;
  roles?: Role[];
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
  currentTheme,
  setTheme,
  roles = []
}) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  
  // Command Palette State
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
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
            <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fade-in-up">
              <div className="p-2 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500">
                切换用户
              </div>
              <div className="max-h-48 overflow-y-auto">
                {allUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => {
                      if (onSwitchUser) onSwitchUser(u);
                      setIsUserMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center hover:bg-slate-50 transition-colors ${u.id === user.id ? 'bg-indigo-50' : ''}`}
                  >
                    <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full mr-3 border border-slate-100 object-cover" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${u.id === user.id ? 'text-indigo-700' : 'text-slate-700'}`}>{u.name}</p>
                      <p className="text-xs text-slate-400 truncate">{getUserRoleName(u)}</p>
                    </div>
                    {u.id === user.id && <Check className="w-4 h-4 text-indigo-600 ml-2" />}
                  </button>
                ))}
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

            {/* Mobile Theme Switch */}
             <div className="mt-4">
               <p className="text-xs font-semibold text-slate-400 uppercase mb-2">界面风格</p>
               <div className="flex flex-wrap gap-2">
                  {THEMES.map(theme => (
                     <button
                        key={theme.id}
                        onClick={() => {
                           setTheme(theme.id);
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
               <p className="text-xs font-semibold text-slate-400 uppercase mb-2">切换用户</p>
               <div className="space-y-2">
                 {allUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                        if (onSwitchUser) onSwitchUser(u);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center p-2 rounded-lg ${u.id === user.id ? 'bg-indigo-50 border border-indigo-100' : 'bg-slate-50'}`}
                    >
                       <img src={u.avatarUrl} className="w-8 h-8 rounded-full mr-3 object-cover"/>
                       <div className="flex-1 min-w-0 text-left">
                          <span className={`block text-sm ${u.id === user.id ? 'font-bold text-indigo-700' : 'text-slate-700'}`}>{u.name}</span>
                          <span className="block text-xs text-slate-400">{getUserRoleName(u)}</span>
                       </div>
                    </button>
                 ))}
               </div>
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
           
           <div className="flex items-center space-x-4">
             {/* Theme Switcher Desktop */}
             <div className="relative" ref={themeMenuRef}>
                <button 
                  onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                  title="切换主题"
                >
                  <Palette className="w-5 h-5" />
                </button>
                {isThemeMenuOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-4 z-50 animate-fade-in-up">
                     <p className="text-xs font-semibold text-slate-400 uppercase mb-3">选择界面风格</p>
                     <div className="grid grid-cols-3 gap-3">
                        {THEMES.map(theme => (
                           <button
                              key={theme.id}
                              onClick={() => {
                                setTheme(theme.id);
                                setIsThemeMenuOpen(false);
                              }}
                              className={`flex flex-col items-center p-2 rounded-lg border transition-all ${currentTheme === theme.id ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-50'}`}
                           >
                              <div className="w-6 h-6 rounded-full mb-1 shadow-sm" style={{ backgroundColor: theme.color }}></div>
                              <span className={`text-xs ${currentTheme === theme.id ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>{theme.name}</span>
                           </button>
                        ))}
                     </div>
                  </div>
                )}
             </div>

             <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full relative">
               <Bell className="w-5 h-5" />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
             </button>
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
                                setTheme(t.themeId);
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
    </div>
  );
};