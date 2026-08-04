import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ClientManager } from './components/ClientManager';
import { VisitManager } from './components/VisitManager';
import { AdminPanel } from './components/AdminPanel';
import { UserManager } from './components/UserManager';
import { DepartmentManager } from './components/DepartmentManager';
import { RoleManager } from './components/RoleManager';
import { VoiceAssistant } from './components/VoiceAssistant'; 
import { LoginPage } from './components/LoginPage'; // New
import { ForceChangePasswordModal } from './components/ForceChangePasswordModal'; // New
import { ViewState, Client, Visit, User, ClientStatus, Sentiment, CustomFieldDefinition, Department, Role } from './types';
import { fetchClients, fetchVisits, initSupabase, fetchUsers, fetchDepartments, fetchRoles, isConfiguredFromEnv, checkConnection, upsertUser, hashPassword } from './services/apiService';

// Mock Data Definitions (Only used as fallback)
const MOCK_ROLES: Role[] = [
  { id: 'r1', name: '管理员', description: '系统完全访问权限' },
  { id: 'r2', name: '销售经理', description: '管理团队和查看所有报表' },
  { id: 'r3', name: '销售代表', description: '仅管理自己的客户和拜访' },
];

const MOCK_DEPARTMENTS: Department[] = [
  { id: 'd1', name: '总部', parentId: null },
  { id: 'd2', name: '销售部', parentId: 'd1' },
];

const MOCK_USER: User = {
  id: 'u1',
  name: '陈亚力 (Mock)',
  email: 'admin@visitpro.com',
  role: '管理员',
  roleId: 'r1',
  departmentId: 'd1',
  avatarUrl: 'https://picsum.photos/200/200',
  status: 'active',
  // Mock hashed '123456'
  password: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92' 
};

// ... (Other Mock Data if needed) ...

// Color Palettes
const THEME_PALETTES: Record<string, Record<number, string>> = {
  indigo: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  rose: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
    950: '#4c0519',
  },
  amber: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  }
};

const App: React.FC = () => {
  const [currentView, setView] = useState<ViewState>('DASHBOARD');
  
  // App State
  // Initialize with NULL to trigger Login Flow
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isForcePasswordChange, setIsForcePasswordChange] = useState(false);
  const [theme, setTheme] = useState('indigo');
  
  // Data States
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionMsg, setConnectionMsg] = useState<string | null>(null);
  
  // Navigation & Voice Command State
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState<string>('');
  const [triggerNewVisit, setTriggerNewVisit] = useState(false);
  const [triggerNewClient, setTriggerNewClient] = useState(false);
  const [draftVisit, setDraftVisit] = useState<Partial<Visit> | null>(null); 
  
  // Custom Fields State
  const [fieldDefinitions, setFieldDefinitions] = useState<CustomFieldDefinition[]>(() => {
    const saved = localStorage.getItem('visitpro_custom_fields');
    return saved ? JSON.parse(saved) : [
      { id: '1', entityType: 'CLIENT', key: 'priority', label: '优先级', type: 'select', options: ['High', 'Medium', 'Low'] },
      { id: '2', entityType: 'CLIENT', key: 'contract_expiry', label: '合同到期日', type: 'date' },
      { id: '3', entityType: 'VISIT', key: 'cost_estimate', label: '预估费用', type: 'number' }
    ];
  });

  useEffect(() => {
    localStorage.setItem('visitpro_custom_fields', JSON.stringify(fieldDefinitions));
  }, [fieldDefinitions]);

  // Apply User Theme when user changes
  useEffect(() => {
    if (currentUser && currentUser.themePreference) {
      setTheme(currentUser.themePreference);
    } else {
      setTheme('indigo'); // Default fallback
    }
  }, [currentUser]);

  // Unified Data Loading Function
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setConnectionMsg(null);

    // 1. Force initialization (Will prefer Env if available)
    const supabase = initSupabase();
    const isEnvMode = isConfiguredFromEnv();
    
    if (supabase) {
      // 2. Explicit Connection Check
      if (isEnvMode) {
          const check = await checkConnection();
          if (!check.success) {
              setConnectionMsg("数据库连接失败 (ENV)");
          } else {
              // Auto-clear success message after 3s
              // setConnectionMsg("已连接");
          }
      }

      try {
        const [dbClients, dbVisits, dbUsers, dbDepts, dbRoles] = await Promise.all([
            fetchClients(),
            fetchVisits(),
            fetchUsers(),
            fetchDepartments(),
            fetchRoles()
        ]);
        
        setClients(dbClients || []);
        setVisits(dbVisits || []);
        setUsers(dbUsers || []);
        setDepartments(dbDepts || []);
        setRoles(dbRoles || []);
        
        // Note: We do NOT set currentUser here anymore. Login handles it.
        // If users list is empty but we are logged in, we might need to refresh user data?
      } catch (err) {
         console.error("Failed to fetch data from Supabase:", err);
      }
      
    } else {
      // Fallback Mock Data Loading
      setClients([]);
      setVisits([]);
      setUsers([MOCK_USER]); // Ensure at least admin exists in mock
      setDepartments(MOCK_DEPARTMENTS);
      setRoles(MOCK_ROLES);
    }
    
    setIsLoading(false);
  }, []);

  // Initialize Data on Login Success
  useEffect(() => {
    if (currentUser) {
        refreshData();
        checkDefaultPassword(currentUser);
    }
  }, [currentUser, refreshData]);

  // Check if password matches default '123456'
  const checkDefaultPassword = async (user: User) => {
      const defaultHash = await hashPassword('123456');
      if (user.password === defaultHash) {
          setIsForcePasswordChange(true);
      } else {
          setIsForcePasswordChange(false);
      }
  };

  // Role Based Access Control Logic
  useEffect(() => {
    if (!currentUser) return;

    const getRoleName = (u: User) => {
      if (u.roleId && roles.length > 0) {
        const foundRole = roles.find(r => r.id === u.roleId);
        if (foundRole) return foundRole.name;
      }
      return u.role || '用户';
    };

    const currentRoleName = getRoleName(currentUser);
    const isAdmin = currentRoleName === '管理员';
    const restrictedViews: ViewState[] = ['USERS', 'DEPARTMENTS', 'ROLES', 'ADMIN'];

    if (!isAdmin && restrictedViews.includes(currentView)) {
      setView('DASHBOARD');
    }
  }, [currentUser, currentView, roles]);

  const handleSwitchUser = (user: User) => {
      setCurrentUser(user);
  };

  const handleUpdateUserProfile = async (updatedUser: User) => {
      await upsertUser(updatedUser);
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      setCurrentUser(updatedUser);
  };

  const handleViewVisit = (visitId: string) => {
    setSelectedVisitId(visitId);
    setView('VISITS');
  };

  const handleCheckIn = (visitData: Partial<Visit>) => {
      setDraftVisit(visitData);
      setTriggerNewVisit(false); 
      setView('VISITS');
      setTimeout(() => setTriggerNewVisit(true), 50);
  };

  const handleVoiceCommand = (cmd: any) => {
      if (!currentUser) return; // Ignore if not logged in
      console.log("Voice Command Received:", cmd);
      
      if (cmd.action === 'NAVIGATE' && cmd.parameters?.view) {
          setView(cmd.parameters.view);
          return;
      }
      if (cmd.action === 'CREATE_VISIT') {
          setView('VISITS');
          setTriggerNewVisit(false); 
          setTimeout(() => setTriggerNewVisit(true), 100);
          return;
      }
      if (cmd.action === 'CREATE_CLIENT') {
          setView('CLIENTS');
          setTriggerNewClient(false);
          setTimeout(() => setTriggerNewClient(true), 100);
          return;
      }
      if (cmd.action === 'SEARCH' && cmd.parameters?.query) {
          const targetView = cmd.parameters.view || 'CLIENTS'; 
          setView(targetView);
          setGlobalSearchTerm('');
          setTimeout(() => setGlobalSearchTerm(cmd.parameters.query), 50);
      }
      if (cmd.action === 'SWITCH_THEME' && cmd.parameters?.theme) {
          const updatedUser = { ...currentUser, themePreference: cmd.parameters.theme };
          handleUpdateUserProfile(updatedUser);
      }
  };

  const handleLogout = () => {
      setCurrentUser(null);
      setIsForcePasswordChange(false);
      setConnectionMsg(null);
  };

  const themePalette = THEME_PALETTES[theme] || THEME_PALETTES.indigo;
  const themeStyles = `
    :root {
      --color-primary-50: ${themePalette[50]};
      --color-primary-100: ${themePalette[100]};
      --color-primary-200: ${themePalette[200]};
      --color-primary-300: ${themePalette[300]};
      --color-primary-400: ${themePalette[400]};
      --color-primary-500: ${themePalette[500]};
      --color-primary-600: ${themePalette[600]};
      --color-primary-700: ${themePalette[700]};
      --color-primary-800: ${themePalette[800]};
      --color-primary-900: ${themePalette[900]};
      --color-primary-950: ${themePalette[950]};
    }
  `;

  // --- Render ---

  return (
    <>
      <style>{themeStyles}</style>
      
      {!currentUser ? (
          <LoginPage onLoginSuccess={(u) => setCurrentUser(u)} />
      ) : (
          <>
            {/* 1. Force Change Password Modal */}
            {isForcePasswordChange && (
                <ForceChangePasswordModal 
                   user={currentUser} 
                   onPasswordChanged={(updatedUser) => {
                       handleUpdateUserProfile(updatedUser);
                       setIsForcePasswordChange(false);
                       alert("密码修改成功，欢迎使用 VisitPro CRM！");
                   }} 
                />
            )}

            {/* 2. Connection Toast */}
            {connectionMsg && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
                   <div className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center ${connectionMsg.includes('失败') ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {connectionMsg}
                   </div>
                </div>
            )}

            {/* 3. Main App Layout */}
            <Layout 
              currentView={currentView} 
              setView={setView} 
              user={currentUser}
              allUsers={users}
              onSwitchUser={handleSwitchUser}
              onUpdateUser={handleUpdateUserProfile}
              currentTheme={theme}
              setTheme={setTheme}
              roles={roles}
              onLogout={handleLogout}
            >
              {currentView === 'DASHBOARD' && (
                <Dashboard 
                  visits={visits} 
                  clients={clients} 
                  users={users}
                  departments={departments}
                  currentUser={currentUser}
                  onNavigate={(view) => setView(view)} 
                  onViewVisit={handleViewVisit}
                  onCheckIn={handleCheckIn}
                />
              )}
              {currentView === 'CLIENTS' && (
                <ClientManager 
                  clients={clients} 
                  setClients={setClients} 
                  fieldDefinitions={fieldDefinitions.filter(f => f.entityType === 'CLIENT')}
                  currentUser={currentUser}
                  initialSearchTerm={globalSearchTerm}
                  shouldCreateNew={triggerNewClient}
                  onResetTrigger={() => { setTriggerNewClient(false); setGlobalSearchTerm(''); }}
                />
              )}
              {currentView === 'VISITS' && (
                <VisitManager 
                  visits={visits} 
                  setVisits={setVisits} 
                  clients={clients} 
                  fieldDefinitions={fieldDefinitions.filter(f => f.entityType === 'VISIT')}
                  currentUser={currentUser}
                  initialVisitId={selectedVisitId}
                  onClearInitialVisit={() => setSelectedVisitId(null)}
                  shouldCreateNew={triggerNewVisit}
                  onResetTrigger={() => setTriggerNewVisit(false)}
                  initialSearchTerm={globalSearchTerm} 
                  draftVisit={draftVisit} 
                  onClearDraft={() => setDraftVisit(null)}
                />
              )}
              {currentView === 'USERS' && (
                <UserManager 
                  users={users} 
                  setUsers={setUsers}
                  roles={roles}
                  departments={departments}
                />
              )}
              {currentView === 'DEPARTMENTS' && (
                <DepartmentManager 
                  departments={departments} 
                  setDepartments={setDepartments} 
                  users={users}
                />
              )}
              {currentView === 'ROLES' && (
                <RoleManager 
                  roles={roles} 
                  setRoles={setRoles} 
                />
              )}
              {currentView === 'ADMIN' && (
                <AdminPanel 
                  fieldDefinitions={fieldDefinitions}
                  setFieldDefinitions={setFieldDefinitions}
                  onConfigSave={refreshData}
                />
              )}
            </Layout>
            
            <VoiceAssistant onCommand={handleVoiceCommand} />
          </>
      )}
    </>
  );
};

export default App;