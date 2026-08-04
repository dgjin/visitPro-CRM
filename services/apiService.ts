import { Client, Visit, User, Department, Role, LoginHistory } from '../types';

// ==========================================
// 本地 API 数据服务 (MySQL 后端)
// 后端服务: server/index.js (Express + mysql2)
// 开发环境通过 vite 代理 /api -> http://localhost:3006
// ==========================================

const API_BASE = '/api';

const apiFetch = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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

export const isConfiguredFromEnv = () => {
  // 本地 MySQL 后端始终视为已配置（连接配置在 server/.env）
  return true;
};

export const initSupabase = () => {
  // 兼容旧调用：返回一个真值标记对象，表示使用本地 API
  return { apiUrl: API_BASE };
};

export const getSupabase = () => initSupabase();

export const checkConnection = async (): Promise<{ success: boolean; message?: string }> => {
  try {
    const result = await apiFetch('/health');
    return { success: !!result.success };
  } catch (e: any) {
    return { success: false, message: e.message?.includes('Failed to fetch') ? '后端服务未启动 (localhost:3006)' : e.message };
  }
};

// Configuration Helpers (保留接口兼容，本地后端无需前端配置)
export const getStoredConfig = () => ({ url: API_BASE, key: '' });

export const saveConfig = (_url: string, _key: string) => {
  console.warn('本地 MySQL 模式下无需配置数据库连接，连接信息位于 server/.env');
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
export const fetchClients = async (): Promise<Client[] | null> => {
  try {
    return await apiFetch('/clients');
  } catch (e) {
    console.error('Error fetching clients:', e);
    return null;
  }
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
export const fetchVisits = async (): Promise<Visit[] | null> => {
  try {
    return await apiFetch('/visits');
  } catch (e) {
    console.error('Error fetching visits:', e);
    return null;
  }
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
export const fetchRoles = async (): Promise<Role[] | null> => {
  try {
    return await apiFetch('/roles');
  } catch {
    return null;
  }
};

export const upsertRole = async (roleData: Role) => {
  await apiFetch('/roles', { method: 'PUT', body: JSON.stringify(roleData) });
};

export const deleteRole = async (id: string) => {
  await apiFetch(`/roles/${id}`, { method: 'DELETE' });
};

// --- Departments ---
export const fetchDepartments = async (): Promise<Department[] | null> => {
  try {
    return await apiFetch('/departments');
  } catch {
    return null;
  }
};

export const upsertDepartment = async (deptData: Department) => {
  await apiFetch('/departments', { method: 'PUT', body: JSON.stringify(deptData) });
};

export const deleteDepartment = async (id: string) => {
  await apiFetch(`/departments/${id}`, { method: 'DELETE' });
};

// --- Users ---
export const fetchUsers = async (): Promise<User[] | null> => {
  try {
    const data = await apiFetch('/users');
    // Map snake_case DB columns to camelCase JS properties
    return data.map((u: any) => ({
      ...u,
      themePreference: u.theme_preference,
    })) as User[];
  } catch {
    return null;
  }
};

export const upsertUser = async (userData: User) => {
  // remove UI-only fields like 'role'
  const { role, themePreference, ...rest } = userData;

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
  try {
    await apiFetch(`/users/${id}`, { method: 'DELETE' });
  } catch (e) {
    console.error('Error deleting user:', e);
  }
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
