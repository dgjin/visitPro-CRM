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
  if (!client) return;
  const { error } = await client.from('clients').upsert(clientData);
  if (error) console.error('Error saving client:', error);
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
  if (!client) return;
  const { error } = await client.from('visits').upsert(visitData);
  if (error) console.error('Error saving visit:', error);
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
  
  const { error } = await client.from('users').upsert(dbUser);
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