import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ClientManager } from './components/ClientManager';
import { VisitManager } from './components/VisitManager';
import { AdminPanel } from './components/AdminPanel';
import { UserManager } from './components/UserManager';
import { DepartmentManager } from './components/DepartmentManager';
import { RoleManager } from './components/RoleManager';
import { ViewState, Client, Visit, User, ClientStatus, Sentiment, CustomFieldDefinition, Department, Role } from './types';
import { fetchClients, fetchVisits, initSupabase, fetchUsers, fetchDepartments, fetchRoles, isConfiguredFromEnv, checkConnection } from './services/supabaseService';

// Mock Data Definitions (Only used as fallback when NO DB connection exists)
const MOCK_ROLES: Role[] = [
  { id: 'r1', name: '管理员', description: '系统完全访问权限' },
  { id: 'r2', name: '销售经理', description: '管理团队和查看所有报表' },
  { id: 'r3', name: '销售代表', description: '仅管理自己的客户和拜访' },
];

const MOCK_DEPARTMENTS: Department[] = [
  { id: 'd1', name: '总部', parentId: null },
  { id: 'd2', name: '销售部', parentId: 'd1' },
  { id: 'd3', name: '华北区', parentId: 'd2' },
  { id: 'd4', name: '华南区', parentId: 'd2' },
  { id: 'd5', name: '研发部', parentId: 'd1' },
];

const MOCK_USER: User = {
  id: 'u1',
  name: '陈亚力',
  email: 'chen@visitpro.com',
  phone: '138-0013-8000',
  role: '管理员',
  roleId: 'r1',
  departmentId: 'd3',
  avatarUrl: 'https://picsum.photos/200/200',
  status: 'active'
};

const MOCK_USERS_LIST: User[] = [
  MOCK_USER,
  { id: 'u2', name: '张经理', email: 'zhang@visitpro.com', phone: '139-1234-5678', role: '销售经理', roleId: 'r2', departmentId: 'd2', avatarUrl: 'https://ui-avatars.com/api/?name=Zhang', status: 'active' },
  { id: 'u3', name: '王技术', email: 'tech@visitpro.com', phone: '137-8765-4321', role: '技术支持', roleId: 'r3', departmentId: 'd5', avatarUrl: 'https://ui-avatars.com/api/?name=Tech', status: 'active' }
];

const MOCK_CLIENTS: Client[] = [
  {
    id: 'c1',
    name: '科创未来科技有限公司',
    industry: '科技',
    status: ClientStatus.Active,
    region: '北京, 海淀区',
    ownerName: '陈亚力',
    contacts: [
      { id: 'ct1', name: '李莎拉', role: 'CTO', email: 'sarah@technova.com', phone: '138-0000-0101' }
    ],
    equityStructure: [
      { name: '创始人团队', percentage: 40, type: 'individual' },
      { name: '红杉资本', percentage: 30, type: 'institution' },
      { name: '员工期权池', percentage: 30, type: 'individual' }
    ],
    financialAnalysis: '第二季度营收同比增长 20%。烧钱率稳定，现金流健康。',
    supplyChainInfo: '主要服务器托管在阿里云（华北区），部分依赖 AWS。',
    customFields: {
      'priority': 'High',
      'contract_expiry': '2024-12-31'
    }
  },
  {
    id: 'c2',
    name: '绿叶物流集团',
    industry: '物流',
    status: ClientStatus.Lead,
    region: '上海, 浦东新区',
    ownerName: '陈亚力',
    contacts: [
      { id: 'ct2', name: '王麦克', role: '运营总监', email: 'mike@greenleaf.com', phone: '139-0000-0102' }
    ]
  },
  {
    id: 'c3',
    name: '巅峰医疗健康',
    industry: '医疗',
    status: ClientStatus.Churned,
    region: '广州, 天河区',
    ownerName: '张经理',
    contacts: []
  }
];

const MOCK_VISITS: Visit[] = [
  {
    id: 'v1',
    clientId: 'c1',
    clientName: '科创未来科技有限公司',
    date: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    type: '线下拜访',
    location: '科创未来大厦 301 会议室',
    clientParticipants: '李莎拉, 王技术',
    ourParticipants: '陈亚力',
    ownerId: 'u1',
    ownerName: '陈亚力',
    content: '讨论了第四季度的路线图。他们担心目前的 API 速率限制会影响扩展计划。',
    summary: '会议主要讨论了 Q4 路线图。客户对 API 速率限制表示担忧，这可能会影响他们的业务扩展。',
    sentiment: Sentiment.Neutral,
    actionItems: ['检查 API 使用日志', '发送企业级方案报价'],
    followUpDraft: '李总您好，\n\n感谢您的会面。我正在查看 API 限制问题，稍后会发送企业级方案给您...',
    customFields: {
      'cost_estimate': '5000'
    }
  },
  {
    id: 'v2',
    clientId: 'c2',
    clientName: '绿叶物流集团',
    date: new Date(Date.now() - 86400000 * 5).toISOString(),
    type: '线上会议',
    location: '腾讯会议 (ID: 123-456-789)',
    clientParticipants: '王麦克',
    ourParticipants: '陈亚力, 张经理',
    ownerId: 'u1',
    ownerName: '陈亚力',
    content: '初步介绍沟通。他们需要在下周看产品演示。',
    summary: '初步需求挖掘顺利。客户表现出强烈兴趣，并要求下周进行完整的产品演示。',
    sentiment: Sentiment.Positive,
    actionItems: ['安排售前工程师演示', '发送成功案例集']
  }
];

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
  const [currentUser, setCurrentUser] = useState<User>(MOCK_USER);
  const [theme, setTheme] = useState(() => localStorage.getItem('visitpro_theme') || 'indigo');
  
  // Data States
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionMsg, setConnectionMsg] = useState<string | null>(null);
  
  // Navigation State
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  
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

  useEffect(() => {
    localStorage.setItem('visitpro_theme', theme);
  }, [theme]);

  // Unified Data Loading Function
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setConnectionMsg(null);

    // 1. Force initialization (Will prefer Env if available)
    const supabase = initSupabase();
    const isEnvMode = isConfiguredFromEnv();
    
    if (supabase) {
      console.log(`[App] Supabase initialized. Mode: ${isEnvMode ? 'ENV (Forced)' : 'Local Storage'}`);
      
      // 2. Explicit Connection Check
      if (isEnvMode) {
          const check = await checkConnection();
          if (!check.success) {
              const msg = `⚠️ 环境变量配置已检测到，但数据库连接失败。\n\n错误: ${check.message}\n请检查 SUPABASE_URL 和 SUPABASE_KEY 是否正确。`;
              console.error(msg);
              alert(msg);
              setConnectionMsg("数据库连接失败 (ENV)");
          } else {
              setConnectionMsg("已通过环境变量连接数据库 ✅");
              // Auto-clear success message after 3s
              setTimeout(() => setConnectionMsg(null), 3000);
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
        
        // Handle "Null" returns from fetch errors
        if (dbClients === null && isEnvMode) {
            console.warn("[App] Fetch returned null while in Env mode. Check RLS policies.");
        }

        setClients(dbClients || []);
        setVisits(dbVisits || []);
        setUsers(dbUsers || []);
        setDepartments(dbDepts || []);
        setRoles(dbRoles || []);
        
        if (dbUsers && dbUsers.length > 0) {
            // Find admin or default to first
            const found = dbUsers.find(u => u.role === '管理员') || dbUsers[0];
            setCurrentUser(found);
        } else if (isEnvMode) {
             // Connected but empty users table?
             console.log("[App] Connected to DB but 'users' table is empty.");
        }
      } catch (err) {
         console.error("Failed to fetch data from Supabase:", err);
         alert("Connected to Supabase but failed to fetch data. Check browser console for RLS or table errors.");
      }
      
    } else {
      console.log("Supabase not configured (No Env or LocalStorage). Using Mock Data.");
      setClients(MOCK_CLIENTS);
      setVisits(MOCK_VISITS);
      setUsers(MOCK_USERS_LIST);
      setDepartments(MOCK_DEPARTMENTS);
      setRoles(MOCK_ROLES);
      setCurrentUser(MOCK_USER);
    }
    
    setIsLoading(false);
  }, []);

  // Initialize Data on Mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Role Based Access Control Logic
  useEffect(() => {
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

  const handleViewVisit = (visitId: string) => {
    setSelectedVisitId(visitId);
    setView('VISITS');
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

  return (
    <>
      <style>{themeStyles}</style>
      
      {/* Toast Notification for Connection Status */}
      {connectionMsg && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in-down">
             <div className={`px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center ${connectionMsg.includes('失败') ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                {connectionMsg}
             </div>
          </div>
      )}

      <Layout 
        currentView={currentView} 
        setView={setView} 
        user={currentUser}
        allUsers={users}
        onSwitchUser={setCurrentUser}
        currentTheme={theme}
        setTheme={setTheme}
        roles={roles}
      >
        {currentView === 'DASHBOARD' && (
          <Dashboard 
            visits={visits} 
            clients={clients} 
            users={users}
            departments={departments}
            onNavigate={(view) => setView(view)} 
            onViewVisit={handleViewVisit}
          />
        )}
        {currentView === 'CLIENTS' && (
          <ClientManager 
            clients={clients} 
            setClients={setClients} 
            fieldDefinitions={fieldDefinitions.filter(f => f.entityType === 'CLIENT')}
            currentUser={currentUser}
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
    </>
  );
};

export default App;