
export enum ClientStatus {
  Active = '已签约',
  Lead = '潜在客户',
  Churned = '已流失',
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

export interface Client {
  id: string;
  name: string;
  industry: string;
  status: ClientStatus;
  region: string;
  contacts: Contact[];
  
  // Owner info
  ownerId?: string;
  ownerName?: string;

  // Dynamic fields
  customFields?: Record<string, any>;
  // AI Profile Data
  equityStructure?: Shareholder[]; // Upstream: Shareholders
  subsidiaries?: Subsidiary[];     // Downstream: Subsidiaries
  financialAnalysis?: string;
  supplyChainInfo?: string;
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
  password?: string; // Simple password field for demo
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

export type ViewState = 'DASHBOARD' | 'CLIENTS' | 'VISITS' | 'ADMIN' | 'USERS' | 'DEPARTMENTS' | 'ROLES';

export type AIModelType = 'gemini' | 'deepseek' | 'spark';

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