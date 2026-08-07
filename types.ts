
export enum ClientStatus {
  Active = '已签约',
  Lead = '潜在客户',
  Churned = '已流失',
  Onboarding = '实施中',
}

export enum Sentiment {
  Positive = '积极',
  Neutral = '中性',
  Negative = '消极',
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
}

export interface Shareholder {
  name: string;
  percentage: number; // 0-100
  type?: 'individual' | 'institution';
}

export interface Subsidiary {
  name: string;
  percentage: number; // Client owns X% of subsidiary
  industry?: string;
  status?: string;
}

// 客户类型（对应《客户营销清单》三个分类）
export type ClientType = '地方政府' | '金融机构' | '产业客户';

// 协议签署信息（客户层）
export interface AgreementInfo {
  signed?: boolean;      // 是否签署相关协议
  party?: string;        // 协议签署主体（中国东方/XX分公司/XX子公司）
  signDate?: string;     // 协议签署时间
  expireDate?: string;   // 协议到期时间
}

// 落地项目信息（客户层）
export interface ProjectInfo {
  landed?: boolean;      // 是否有落地项目
  projectNo?: string;    // 项目编号
  projectName?: string;  // 项目名称
  scale?: number;        // 落地规模（万元）
}

// 按客户类型区分的专属信息项
export interface TypeProfile {
  // --- 公共基础（政府类型无信用代码/股东等字段）---
  creditCode?: string;            // 统一社会信用代码
  stockCode?: string;             // 上市代码
  foundedDate?: string;           // 成立时间
  majorShareholder?: string;      // 第一大股东
  majorShareholderRatio?: string; // 第一大股东持股比例
  reportingUnit?: string;         // 上报经营单位

  // --- 地方政府 ---
  adminLevel?: string;            // 行政级别

  // --- 金融机构 ---
  finCategory?: string;           // 客户类别（银行/证券/保险/信托/金融租赁）
  finSubCategory?: string;        // 细分类别
  finRank?: string;               // 行业排名

  // --- 产业客户 ---
  groupOwner?: string;            // 客户所属集团/单位/个人（股权穿透至最上层）
  entCategory?: string;           // 客户类别（省属国企/市属国企/民营...）
  industryCategory?: string;      // 所属行业门类（国民经济行业分类第一层）
  industrySub?: string;           // 所属行业小类（第四层）
  industryCode?: string;          // 行业代码
  creditRating?: string;          // 主体评级
  top500Rank?: string;            // 世界/中企/民企500强排名

  // --- 协议与项目（客户层，所有类型共用）---
  agreement?: AgreementInfo;
  project?: ProjectInfo;
}

export interface Client {
  id: string;
  name: string;
  industry: string;
  status: ClientStatus;
  clientType?: ClientType;
  region: string;
  /** 重点客户：true=是 false=否（默认是，清单模板仅导出重点客户） */
  isKeyAccount?: boolean;
  /** 所属团队 */
  team?: string;
  /** 清单分类（重点营销客户大表的客户分类） */
  listCategory?: string;
  contacts: Contact[];
  
  // Owner info
  ownerId?: string;
  ownerName?: string;

  // 按客户类型区分的专属信息项
  typeProfile?: TypeProfile;

  // Dynamic fields
  customFields?: Record<string, any>;
  // AI Profile Data
  equityStructure?: Shareholder[]; // Upstream: Shareholders
  subsidiaries?: Subsidiary[];     // Downstream: Subsidiaries
  financialAnalysis?: string;
  supplyChainInfo?: string;
  tags?: string[]; // AI Generated Labels (Industry Status, Financials, etc.)
}

export interface VisitRecording {
  id: string;
  url: string; // Base64 Data URL
  duration?: number; // In seconds
  timestamp: string;
}

export interface Visit {
  id: string;
  clientId: string;
  clientName: string;
  date: string; // ISO String
  content: string; // Raw notes or transcript
  type: '线下拜访' | '线上会议' | '电话沟通' | '客户到访';
  
  // Visit Details
  location?: string;
  clientContact?: string;     // 拜访对象 (Main Contact Person)
  clientContactRole?: string; // 拜访对象职位 (Main Contact Position)
  clientParticipants?: string; // Comma separated names (Other participants)
  ourParticipants?: string;    // Comma separated names

  // Owner info
  ownerId?: string;
  ownerName?: string;

  // Audio Data
  recordings?: VisitRecording[]; // New field for multiple recordings
  recordingData?: string | null; // Deprecated: Kept for backward compatibility

  // AI Generated fields
  summary?: string;
  sentiment?: Sentiment;
  actionItems?: string[];
  followUpDraft?: string;
  
  // Dynamic fields
  customFields?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  managerId?: string;
}

// Tree structure helper type
export interface DepartmentNode extends Department {
  children?: DepartmentNode[];
  level?: number;
}

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string; // Add phone field
  roleId?: string; // Relation to Role
  departmentId?: string; // Relation to Department
  avatarUrl: string;
  status?: 'active' | 'inactive';
  role?: string; // Legacy string or display name
  customFields?: Record<string, any>;
  last_login_at?: string; // Add last login time
  themePreference?: string; // Stored theme preference
  mustChangePassword?: boolean; // 服务端标记：默认密码用户首次登录须改密
}

export interface LoginHistory {
  id: string;
  user_id: string;
  login_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: number;
  read: boolean;
}

export type ViewState = 'DASHBOARD' | 'CLIENTS' | 'VISITS' | 'AI_QUERY' | 'ADMIN' | 'USERS' | 'DEPARTMENTS' | 'ROLES';

export type AIModelType = 'ollama' | 'gemini' | 'deepseek' | 'spark' | 'kimi';

export interface AppSettings {
  aiModel: AIModelType;
  deepseekApiKey?: string;
  themeColor: string;
}

export type EntityType = 'CLIENT' | 'VISIT' | 'USER';
export type FieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomFieldDefinition {
  id: string;
  entityType: EntityType;
  key: string;
  label: string;
  type: FieldType;
  options?: string[]; // For select type, comma separated
}