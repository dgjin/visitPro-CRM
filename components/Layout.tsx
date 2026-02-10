import React, { useState } from 'react';
import { ViewState, User } from '../types';
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
  UserCog
} from 'lucide-react';

interface LayoutProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  children: React.ReactNode;
  user: User;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, setView, children, user }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">V</span>
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">VisitPro</span>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <div className="mb-6">
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">业务管理</p>
            <NavItem view="DASHBOARD" icon={LayoutDashboard} label="仪表盘" />
            <NavItem view="CLIENTS" icon={Users} label="客户管理" />
            <NavItem view="VISITS" icon={Briefcase} label="拜访记录" />
          </div>

          <div className="mb-6">
             <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">组织管理</p>
             <NavItem view="USERS" icon={UserCog} label="用户管理" />
             <NavItem view="DEPARTMENTS" icon={Network} label="部门管理" />
             <NavItem view="ROLES" icon={ShieldCheck} label="角色管理" />
          </div>

          <div>
            <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">系统</p>
            <NavItem view="ADMIN" icon={Settings} label="系统设置" />
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
            <img 
              src={user.avatarUrl} 
              alt="User" 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
            />
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-semibold text-slate-700 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.role || '用户'}</p>
            </div>
            <button className="ml-auto text-slate-400 hover:text-red-500">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-white h-16 border-b border-slate-200 flex items-center justify-between px-4 z-20">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">V</span>
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
            <hr className="my-2 border-slate-100"/>
            <NavItem view="USERS" icon={UserCog} label="用户管理" />
            <NavItem view="DEPARTMENTS" icon={Network} label="部门管理" />
            <NavItem view="ROLES" icon={ShieldCheck} label="角色管理" />
            <hr className="my-2 border-slate-100"/>
            <NavItem view="ADMIN" icon={Settings} label="系统设置" />
          </div>
        )}

        {/* Top Bar (Desktop) */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8">
           <h2 className="text-xl font-semibold text-slate-800">
             {currentView === 'DASHBOARD' && '仪表盘'}
             {currentView === 'CLIENTS' && '客户管理'}
             {currentView === 'VISITS' && '拜访记录'}
             {currentView === 'USERS' && '用户管理'}
             {currentView === 'DEPARTMENTS' && '部门管理'}
             {currentView === 'ROLES' && '角色管理'}
             {currentView === 'ADMIN' && '系统设置'}
           </h2>
           <div className="flex items-center space-x-4">
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
    </div>
  );
};