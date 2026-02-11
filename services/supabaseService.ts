import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Client, Visit, User, Department, Role } from '../types';

let supabase: SupabaseClient | null = null;

// Keys for localStorage
const LS_URL_KEY = 'visitpro_supabase_url';
const LS_ANON_KEY = 'visitpro_supabase_key';

export const initSupabase = () => {
  // Priority: Process Env -> Local Storage
  const envUrl = process.env.SUPABASE_URL;
  const envKey = process.env.SUPABASE_KEY;
  
  const localUrl = localStorage.getItem(LS_URL_KEY);
  const localKey = localStorage.getItem(LS_ANON_KEY);

  const url = envUrl || localUrl;
  const key = envKey || localKey;

  if (url && key) {
    try {
      supabase = createClient(url, key);
      console.log('Supabase initialized');
    } catch (e) {
      console.error('Failed to init Supabase', e);
    }
  }
  return supabase;
};

export const getSupabase = () => {
  if (!supabase) return initSupabase();
  return supabase;
};

// Configuration Helpers
export const getStoredConfig = () => ({
  url: localStorage.getItem(LS_URL_KEY) || '',
  key: localStorage.getItem(LS_ANON_KEY) || ''
});

export const saveConfig = (url: string, key: string) => {
  localStorage.setItem(LS_URL_KEY, url);
  localStorage.setItem(LS_ANON_KEY, key);
  initSupabase(); // Re-init
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

// --- System ---
export const reloadSchemaCache = async () => {
  const client = getSupabase();
  if (!client) throw new Error("Supabase client not initialized");
  
  const { error } = await client.rpc('reload_schema_cache');
  if (error) {
    console.error("Failed to reload schema cache", error);
    throw error;
  }
};