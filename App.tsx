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
import { fetchClients, fetchVisits, initSupabase, fetchUsers, fetchDepartments, fetchRoles } from './services/supabaseService';

// Mock Data Initialization (Fallback)
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
  role: '销售代表',
  roleId: 'r3',
  departmentId: 'd3',
  avatarUrl: 'https://picsum.photos/200/200',
  status: 'active'
};

const MOCK_USERS_LIST: User[] = [
  MOCK_USER,
  { id: 'u2', name: '张经理', email: 'zhang@visitpro.com', role: '销售经理', roleId: 'r2', departmentId: 'd2', avatarUrl: 'https://ui-avatars.com/api/?name=Zhang', status: 'active' }
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

const App: React.FC = () => {
  const [currentView, setView] = useState<ViewState>('DASHBOARD');
  
  // Data States
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [visits, setVisits] = useState<Visit[]>(MOCK_VISITS);
  const [users, setUsers] = useState<User[]>(MOCK_USERS_LIST);
  const [departments, setDepartments] = useState<Department[]>(MOCK_DEPARTMENTS);
  const [roles, setRoles] = useState<Role[]>(MOCK_ROLES);
  
  const [isLoading, setIsLoading] = useState(false);
  
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

  // Unified Data Loading Function
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    const supabase = initSupabase();
    if (supabase) {
      console.log("Loading data from Supabase...");
      const [dbClients, dbVisits, dbUsers, dbDepts, dbRoles] = await Promise.all([
        fetchClients(),
        fetchVisits(),
        fetchUsers(),
        fetchDepartments(),
        fetchRoles()
      ]);
      
      // If DB returns data (even empty array), override mocks.
      // If DB returns null (error/not connected), keep current state (mocks or prev data).
      if (dbClients !== null) setClients(dbClients);
      if (dbVisits !== null) setVisits(dbVisits);
      if (dbUsers !== null) setUsers(dbUsers);
      if (dbDepts !== null) setDepartments(dbDepts);
      if (dbRoles !== null) setRoles(dbRoles);
    }
    setIsLoading(false);
  }, []);

  // Initialize Data on Mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <Layout currentView={currentView} setView={setView} user={MOCK_USER}>
      {currentView === 'DASHBOARD' && (
        <Dashboard 
          visits={visits} 
          clients={clients} 
          onNavigate={(view) => setView(view)} 
        />
      )}
      {currentView === 'CLIENTS' && (
        <ClientManager 
          clients={clients} 
          setClients={setClients} 
          fieldDefinitions={fieldDefinitions.filter(f => f.entityType === 'CLIENT')}
          currentUser={MOCK_USER}
        />
      )}
      {currentView === 'VISITS' && (
        <VisitManager 
          visits={visits} 
          setVisits={setVisits} 
          clients={clients} 
          fieldDefinitions={fieldDefinitions.filter(f => f.entityType === 'VISIT')}
          currentUser={MOCK_USER}
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
  );
};

export default App;