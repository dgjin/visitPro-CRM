import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Visit, User, Department, Role, LoginHistory } from '../types';

let supabase: SupabaseClient | null = null;
let isEnvInitialized = false;

// Keys for localStorage
const LS_URL_KEY = 'visitpro_supabase_url';
const LS_ANON_KEY = 'visitpro_supabase_key';

export const isConfiguredFromEnv = () => {
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_KEY;
  // Check if they exist and are not literally the string "undefined" (vite define artifact)
  return !!(envUrl && envKey && envUrl !== "undefined" && envKey !== "undefined");
};

export const initSupabase = () => {
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_KEY;
  const hasEnvVars = isConfiguredFromEnv();

  // 1. FORCE ENV CONFIGURATION
  // If Env vars are present, we MUST use them. We ignore LocalStorage completely.
  if (hasEnvVars) {
    // If supabase instance is missing OR it wasn't created from env (e.g. was LS before), recreate it.
    if (!supabase || !isEnvInitialized) {
      try {
        console.log('🚀 [System] Detected Environment Variables. Forcing Supabase Connection...');
        supabase = createClient(envUrl!, envKey!);
        isEnvInitialized = true;
      } catch (e) {
        console.error('❌ [System] Failed to initialize Supabase from Env:', e);
        return null;
      }
    }
    return supabase;
  }

  // 2. Fallback: Local Storage
  // If we previously used Env, but now they are gone (unlikely in runtime but possible in dev), reset.
  if (isEnvInitialized && !hasEnvVars) {
      supabase = null;
      isEnvInitialized = false;
  }

  const localUrl = localStorage.getItem(LS_URL_KEY);
  const localKey = localStorage.getItem(LS_ANON_KEY);

  if (localUrl && localKey) {
    try {
      if (!supabase) {
        supabase = createClient(localUrl, localKey);
        console.log('⚡ [System] Connected to Supabase via Local Storage.');
      }
    } catch (e) {
      console.error('Failed to init Supabase from Local Storage', e);
    }
  } else {
    // Reset if no config found
    supabase = null;
  }
  
  return supabase;
};

export const getSupabase = () => {
  if (!supabase) return initSupabase();
  return supabase;
};

export const checkConnection = async (): Promise<{ success: boolean; message?: string }> => {
    const client = getSupabase();
    if (!client) return { success: false, message: "Supabase client not initialized" };
    
    try {
        // Perform a lightweight HEAD request to check connectivity
        const { error, count } = await client.from('clients').select('*', { count: 'exact', head: true });
        
        if (error) {
            console.error("Connection Check Failed:", error);
            return { success: false, message: `Error ${error.code}: ${error.message}` };
        }
        return { success: true };
    } catch (e: any) {
        console.error("Connection Check Exception:", e);
        return { success: false, message: e.message || "Network error" };
    }
};

// Configuration Helpers
export const getStoredConfig = () => {
  if (isConfiguredFromEnv()) {
      return {
          url: process.env.SUPABASE_URL!,
          key: process.env.SUPABASE_KEY || ''
      };
  }
  return {
    url: localStorage.getItem(LS_URL_KEY) || '',
    key: localStorage.getItem(LS_ANON_KEY) || ''
  };
};

export const saveConfig = (url: string, key: string) => {
  if (isConfiguredFromEnv()) {
      console.warn("Attempted to save config while Env vars are active. Ignoring.");
      return;
  }
  localStorage.setItem(LS_URL_KEY, url);
  localStorage.setItem(LS_ANON_KEY, key);
  
  supabase = null; 
  initSupabase(); 
};

/**
 * Helper: Clean custom fields to remove empty strings or nulls.
 * This keeps the JSONB storage efficient.
 */
const cleanCustomFields = (fields?: Record<string, any>) => {
  if (!fields) return {};
  const cleaned: Record<string, any> = {};
  Object.entries(fields).forEach(([key, value]) => {
    // Keep 0, false, but remove null, undefined, or empty string
    if (value !== null && value !== undefined && value !== '') {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

// --- Clients ---
export const fetchClients = async (): Promise<Client[] | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('clients').select('*');
  if (error) { console.error('Error fetching clients:', error); return null; }
  return data as Client[];
};

export const upsertClient = async (clientData: Client) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase client not initialized");
  
  // Optimize: Clean custom fields
  const optimizedClientData = {
      ...clientData,
      customFields: cleanCustomFields(clientData.customFields)
  };

  // 1. Try Full Save (Best Effort)
  const { error } = await client.from('clients').upsert(optimizedClientData);
  
  if (error) {
    // Check if error is related to missing columns (Schema drift)
    // PGRST204: Columns not found in schema cache
    // 42703: Undefined column (Postgres error)
    const isColumnError = error.code === 'PGRST204' || error.code === '42703' || error.message?.includes("column");

    if (isColumnError) {
        console.warn("Full save failed due to schema mismatch. Attempting fallback save (Basic Info only).");
        
        // 2. Create Fallback Data (Remove new fields that might be missing in old DB)
        const { 
            equityStructure, 
            subsidiaries, 
            financialAnalysis, 
            supplyChainInfo,
            ownerId, 
            ownerName,
            ...basicData 
        } = optimizedClientData;
        
        // 3. Try Basic Save
        const { error: fallbackError } = await client.from('clients').upsert(basicData);
        
        if (fallbackError) {
            console.error("Fallback save also failed:", fallbackError);
            throw fallbackError; // If basic save fails, throw real error
        }
        
        // 4. Throw special warning to UI
        throw new Error("PARTIAL_SUCCESS: 基础信息保存成功，但数据库缺少 AI 画像相关字段 (如 subsidiaries)。AI 分析数据未能保存。");
    }

    console.error('Error saving client:', error);
    throw error;
  }
};

export const deleteClient = async (id: string) => {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('clients').delete().eq('id', id);
  if (error) console.error('Error deleting client:', error);
};

// --- Visits ---
export const fetchVisits = async (): Promise<Visit[] | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('visits').select('*').order('date', { ascending: false });
  if (error) { console.error('Error fetching visits:', error); return null; }
  return data as Visit[];
};

export const upsertVisit = async (visitData: Visit) => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase client not initialized");
  
  // Optimize: Clean custom fields
  const optimizedVisitData = {
      ...visitData,
      customFields: cleanCustomFields(visitData.customFields)
  };
  
  // 1. Try Full Save
  const { error } = await client.from('visits').upsert(optimizedVisitData);
  
  if (error) {
      // Check for schema mismatch
      const isColumnError = error.code === 'PGRST204' || error.code === '42703' || error.message?.includes("column");
      
      if (isColumnError) {
          console.warn("Full visit save failed. Attempting fallback...");
          
          // 2. Fallback: Strip new fields (Recordings, Owner, Participants, Location)
          const { 
              recordings, 
              ownerId, 
              ownerName, 
              location, 
              clientContact,
              clientContactRole,
              clientParticipants, 
              ourParticipants, 
              recordingData,
              ...basicVisit 
          } = optimizedVisitData;

          const { error: fallbackError } = await client.from('visits').upsert(basicVisit);
          
          if (fallbackError) {
              throw fallbackError;
          }
          
          throw new Error("PARTIAL_SUCCESS: 拜访摘要已保存，但录音或详情字段因数据库结构过旧未能保存。");
      }

      console.error('Error saving visit:', error);
      throw error;
  }
};

export const deleteVisit = async (id: string) => {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('visits').delete().eq('id', id);
  if (error) console.error('Error deleting visit:', error);
};

// --- Roles ---
export const fetchRoles = async (): Promise<Role[] | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('roles').select('*');
  if (error) return null;
  return data as Role[];
};

export const upsertRole = async (roleData: Role) => {
  const client = getSupabase();
  if (!client) return;
  await client.from('roles').upsert(roleData);
};

export const deleteRole = async (id: string) => {
  const client = getSupabase();
  if (!client) return;
  await client.from('roles').delete().eq('id', id);
};

// --- Departments ---
export const fetchDepartments = async (): Promise<Department[] | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('departments').select('*');
  if (error) return null;
  return data as Department[];
};

export const upsertDepartment = async (deptData: Department) => {
  const client = getSupabase();
  if (!client) return;
  await client.from('departments').upsert(deptData);
};

export const deleteDepartment = async (id: string) => {
  const client = getSupabase();
  if (!client) return;
  await client.from('departments').delete().eq('id', id);
};

// --- Users ---
export const fetchUsers = async (): Promise<User[] | null> => {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('users').select('*');
  if (error) return null;
  return data as User[];
};

export const upsertUser = async (userData: User) => {
  const client = getSupabase();
  if (!client) return;
  
  // Clean up user data to match DB schema (remove UI-only fields like 'role')
  // The 'role' field in the User type is for display convenience, but the DB uses 'roleId'.
  const { role, ...dbUser } = userData;
  const optimizedUser = {
      ...dbUser,
      customFields: cleanCustomFields(userData.customFields)
  };
  
  const { error } = await client.from('users').upsert(optimizedUser);
  if (error) {
    console.error('Error saving user:', error);
  }
};

export const deleteUser = async (id: string) => {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.from('users').delete().eq('id', id);
  if (error) {
    console.error('Error deleting user:', error);
  }
};

// --- Login History ---
export const fetchLoginHistory = async (userId: string): Promise<LoginHistory[]> => {
  const client = getSupabase();
  if (!client) return [];
  
  const { data, error } = await client
      .from('login_history')
      .select('*')
      .eq('user_id', userId)
      .order('login_at', { ascending: false })
      .limit(50); // Limit to last 50 entries
      
  if (error) {
      // Silently fail if table doesn't exist yet to prevent crashing the UI
      console.warn("Fetch login history failed:", error.message);
      return [];
  }
  return data as LoginHistory[];
};

// --- System ---
export const reloadSchemaCache = async () => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase client not initialized");
  
  const { error } = await client.rpc('reload_schema_cache');
  if (error) {
    console.error("Failed to reload schema cache via RPC:", error);
    
    // Check specifically for permissions or missing function
    if (error.code === 'PGRST202' || error.message?.includes('function') || error.message?.includes('exist')) {
        throw new Error("数据库函数 'reload_schema_cache' 不存在。\n请在 Supabase SQL 编辑器中运行数据库创建脚本。");
    }
    
    if (error.code === '42501' || error.message?.includes('permission')) {
        throw new Error("权限不足。请在 Supabase SQL 编辑器中运行以下命令以开放 API 调用权限:\nGRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO anon, authenticated;");
    }
    
    throw error;
  }
};
