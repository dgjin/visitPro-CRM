import { Client, Visit, User, Department, Role, LoginHistory } from '../types';

// ==========================================
// 本地 API 数据服务 (MySQL 后端)
// 后端服务: server/index.js (Express + mysql2)
// 开发环境通过 vite 代理 /api -> http://localhost:3006
// ==========================================

const API_BASE = '/api';

// ==========================================
// 会话 token 管理（JWT，登录后由服务端签发）
// ==========================================
const TOKEN_KEY = 'visitpro_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const storeToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

const apiFetch = async (path: string, options?: RequestInit) => {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  if (res.status === 401 && path !== '/auth/login') {
    // 会话失效：清除本地 token，由应用层回到登录页
    clearToken();
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
      if (body.message) message = body.message;
    } catch { /* ignore */ }
    throw new Error(message);
  }
  return res.json();
};

// --- Security / Auth Helpers ---

/**
 * Hash password using SHA-256 (Web Crypto API)
 */
export const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Login user by checking account (email or phone) and password hash
 */
export const loginUser = async (email: string, passwordPlain: string): Promise<{ success: boolean; user?: User; message?: string }> => {
  try {
    const passwordHash = await hashPassword(passwordPlain);
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, passwordHash, userAgent: navigator.userAgent }),
    });

    if (!result.success) {
      return { success: false, message: result.message || '登录失败' };
    }

    if (result.token) storeToken(result.token);

    // Map snake_case DB columns to camelCase JS properties
    const user: User = {
      ...result.user,
      themePreference: result.user.theme_preference,
    };
    return { success: true, user };
  } catch (e: any) {
    console.error('Login request failed:', e);
    return { success: false, message: e.message?.includes('Failed to fetch') ? '后端服务未启动，请先运行 npm run server' : (e.message || '网络错误') };
  }
};

/**
 * 会话恢复：凭本地 token 获取当前用户（刷新页面后免重新登录）
 */
export const fetchMe = async (): Promise<User | null> => {
  if (!getStoredToken()) return null;
  try {
    const result = await apiFetch('/auth/me');
    if (!result.success || !result.user) return null;
    return { ...result.user, themePreference: result.user.theme_preference } as User;
  } catch {
    return null;
  }
};

/**
 * 本人修改密码（服务端校验当前密码并加盐存储）
 */
export const changePassword = async (currentPlain: string, newPlain: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const result = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPasswordHash: await hashPassword(currentPlain),
        newPasswordHash: await hashPassword(newPlain),
      }),
    });
    return { success: !!result.success, message: result.message };
  } catch (e: any) {
    return { success: false, message: e.message || '网络错误' };
  }
};

/**
 * 管理员重置他人密码（重置后对方首次登录强制改密）
 */
export const resetPassword = async (userId: string, newPlain: string): Promise<{ success: boolean; message?: string }> => {
  try {
    const result = await apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ userId, newPasswordHash: await hashPassword(newPlain) }),
    });
    return { success: !!result.success, message: result.message };
  } catch (e: any) {
    return { success: false, message: e.message || '网络错误' };
  }
};

export const isConfiguredFromEnv = () => {
  // 本地 MySQL 后端始终视为已配置（连接配置在 server/.env）
  return true;
};

export const initApi = () => {
  // 返回一个真值标记对象，表示使用本地 API
  return { apiUrl: API_BASE };
};

export const checkConnection = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const result = await apiFetch('/health');
    return { success: !!result.success };
  } catch (e: any) {
    return { success: false, message: e.message?.includes('Failed to fetch') ? '后端服务未启动 (localhost:3006)' : e.message };
  }
};

/**
 * Helper: Clean custom fields to remove empty strings or nulls.
 */
const cleanCustomFields = (fields?: Record<string, any>) => {
  if (!fields) return {};
  const cleaned: Record<string, any> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

// --- Clients ---
// 列表查询类接口统一抛错，由调用点决定降级策略（App.tsx 有 try/catch 兜底）
export const fetchClients = async (): Promise<Client[]> => {
  return await apiFetch('/clients');
};

export const upsertClient = async (clientData: Client) => {
  const optimizedClientData = {
    ...clientData,
    customFields: cleanCustomFields(clientData.customFields),
  };
  await apiFetch('/clients', { method: 'PUT', body: JSON.stringify(optimizedClientData) });
};

export const deleteClient = async (id: string) => {
  try {
    await apiFetch(`/clients/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('Error deleting client:', e);
  }
};

// --- Visits ---
export const fetchVisits = async (): Promise<Visit[]> => {
  return await apiFetch('/visits');
};

export const upsertVisit = async (visitData: Visit) => {
  const optimizedVisitData = {
    ...visitData,
    customFields: cleanCustomFields(visitData.customFields),
  };
  await apiFetch('/visits', { method: 'PUT', body: JSON.stringify(optimizedVisitData) });
};

export const deleteVisit = async (id: string) => {
  try {
    await apiFetch(`/visits/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('Error deleting visit:', e);
  }
};

// --- Roles ---
export const fetchRoles = async (): Promise<Role[]> => {
  return await apiFetch('/roles');
};

export const upsertRole = async (roleData: Role) => {
  await apiFetch('/roles', { method: 'PUT', body: JSON.stringify(roleData) });
};

export const deleteRole = async (id: string) => {
  await apiFetch(`/roles/${id}`, { method: 'DELETE' });
};

// --- Departments ---
export const fetchDepartments = async (): Promise<Department[]> => {
  return await apiFetch('/departments');
};

export const upsertDepartment = async (deptData: Department) => {
  await apiFetch('/departments', { method: 'PUT', body: JSON.stringify(deptData) });
};

export const deleteDepartment = async (id: string) => {
  await apiFetch(`/departments/${id}`, { method: 'DELETE' });
};

// --- Users ---
export const fetchUsers = async (): Promise<User[]> => {
  const data = await apiFetch('/users');
  // Map snake_case DB columns to camelCase JS properties
  return data.map((u: any) => ({
    ...u,
    themePreference: u.theme_preference,
  })) as User[];
};

export const upsertUser = async (userData: User) => {
  // remove UI-only fields like 'role'; password 不通过此接口修改（走改密/重置专用接口）
  const { role, themePreference, mustChangePassword, ...rest } = userData;

  const optimizedUser = {
    ...rest,
    ...(themePreference !== undefined ? { theme_preference: themePreference } : {}),
    customFields: cleanCustomFields(userData.customFields),
  };

  try {
    await apiFetch('/users', { method: 'PUT', body: JSON.stringify(optimizedUser) });
  } catch (e) {
    console.error('Error saving user:', e);
  }
};

export const deleteUser = async (id: string) => {
  // 服务端会做引用保护校验（名下有客户/拜访时拒绝删除），错误需向上抛出
  await apiFetch(`/users/${id}`, { method: 'DELETE' });
};

// --- Login History ---
export const fetchLoginHistory = async (userId: string): Promise<LoginHistory[]> => {
  try {
    return await apiFetch(`/login-history/${userId}`);
  } catch (e: any) {
    console.warn('Fetch login history failed:', e.message);
    return [];
  }
};

// --- System ---
export const reloadSchemaCache = async () => {
  // 本地 MySQL 模式无 schema cache 概念，保留接口兼容
  console.info('本地 MySQL 模式下无需刷新 schema 缓存');
};

// ==========================================
// 智能问数（AI Query）：SSE 流式接口
// 后端流程参照 free-report：LLM 只理解问题/总结数据，取数走白名单 + 数据权限
// ==========================================
export interface AiChart {
  type: 'bar' | 'line' | 'pie' | 'table';
  title: string;
  categories: string[];
  series: { name: string; data: number[] }[];
  index?: number; // 复合计划中的子分析序号
}

export interface AiTable {
  columns: string[];
  rows: (string | number)[][];
  index?: number; // 复合计划中的子分析序号
}

export interface AiPlan {
  dataset: string;
  dataset_label: string;
  dimension: string;
  recent_months: number | null;
  owner_names: string[];
  chart_type: string;
  title: string;
  index?: number;          // 复合计划中的子分析序号
  analysis_count?: number; // 复合计划的子分析总数
}

export const getAiConfig = async (): Promise<{ enabled: boolean }> => {
  try {
    return await apiFetch('/ai/config');
  } catch {
    return { enabled: false };
  }
};

/**
 * SSE 流式问数：逐事件回调 onEvent(type, data)。
 * 事件类型：status | text_only | plan | chart | table | answer_delta | scope_note | done | error
 */
export const aiQueryStream = async (
  question: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  onEvent: (type: string, data: string) => void
): Promise<void> => {
  const token = getStoredToken();
  const res = await fetch(`${API_BASE}/ai/query/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, history }),
  });
  if (res.status === 401) { clearToken(); throw new Error('登录已过期，请重新登录'); }
  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`;
    try { message = (await res.json()).error || message; } catch { /* ignore */ }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE 事件以空行分隔
    let sepIndex;
    while ((sepIndex = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      let type = 'message';
      const dataLines: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      if (dataLines.length > 0) onEvent(type, dataLines.join('\n'));
    }
  }
};

