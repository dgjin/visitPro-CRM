
-- VisitPro CRM 数据库初始化脚本
-- 建议在 Supabase SQL Editor 中直接运行此脚本

-- 1. 启用扩展
create extension if not exists "uuid-ossp";

-- 2. 基础表结构 (如果不存在则创建)
create table if not exists public.roles (
    "id" text primary key,
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.departments (
    "id" text primary key,
    "name" text not null,
    "parentId" text references public.departments("id"),
    "managerId" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.users (
    "id" text primary key,
    "name" text not null,
    "email" text,
    "phone" text,
    "avatarUrl" text,
    "roleId" text references public.roles("id"),
    "departmentId" text references public.departments("id"),
    "status" text default 'active',
    "customFields" jsonb default '{}'::jsonb,
    "last_login_at" timestamp with time zone,
    "theme_preference" text, -- 新增：用户主题偏好
    "password" text, -- 新增：用户密码 (Demo用途，生产环境应使用 Supabase Auth)
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.clients (
    "id" text primary key,
    "name" text not null,
    "industry" text,
    "status" text,
    "region" text,
    "contacts" jsonb default '[]'::jsonb,
    "customFields" jsonb default '{}'::jsonb,
    "ownerId" text,
    "ownerName" text,
    "equityStructure" jsonb default '[]'::jsonb,
    "subsidiaries" jsonb default '[]'::jsonb,
    "financialAnalysis" text,
    "supplyChainInfo" text,
    "tags" jsonb default '[]'::jsonb, -- AI 生成的标签
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists public.visits (
    "id" text primary key,
    "clientId" text references public.clients("id"),
    "clientName" text,
    "date" text,
    "content" text,
    "type" text,
    "ownerId" text,
    "ownerName" text,
    "location" text,
    "clientContact" text,
    "clientContactRole" text,
    "clientParticipants" text,
    "ourParticipants" text,
    "recordingData" text,
    "recordings" jsonb default '[]'::jsonb,
    "customFields" jsonb default '{}'::jsonb,
    "summary" text,
    "sentiment" text,
    "actionItems" jsonb default '[]'::jsonb,
    "followUpDraft" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- 新增：登录历史表
create table if not exists public.login_history (
    "id" uuid primary key default uuid_generate_v4(),
    "user_id" text references public.users("id") on delete cascade,
    "login_at" timestamp with time zone default timezone('utc'::text, now()),
    "ip_address" text,
    "user_agent" text
);

-- 3. 开启 RLS (行级安全)
alter table public.roles enable row level security;
alter table public.departments enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.visits enable row level security;
alter table public.login_history enable row level security;

-- 4. 宽松的 RLS 策略 (允许所有操作，生产环境请修改)
create policy "Enable all access for roles" on public.roles for all using (true) with check (true);
create policy "Enable all access for departments" on public.departments for all using (true) with check (true);
create policy "Enable all access for users" on public.users for all using (true) with check (true);
create policy "Enable all access for clients" on public.clients for all using (true) with check (true);
create policy "Enable all access for visits" on public.visits for all using (true) with check (true);
create policy "Enable all access for login_history" on public.login_history for all using (true) with check (true);

-- 5. 索引
create index if not exists idx_users_dept on public.users ("departmentId");
create index if not exists idx_depts_parent on public.departments ("parentId");
create index if not exists idx_login_history_user on public.login_history ("user_id");

-- ==========================================
-- 6. 字段补全 (确保老表也有新字段)
-- ==========================================

-- Clients 表
alter table public.clients add column if not exists "ownerId" text;
alter table public.clients add column if not exists "ownerName" text;
alter table public.clients add column if not exists "equityStructure" jsonb default '[]'::jsonb;
alter table public.clients add column if not exists "subsidiaries" jsonb default '[]'::jsonb;
alter table public.clients add column if not exists "financialAnalysis" text;
alter table public.clients add column if not exists "supplyChainInfo" text;
alter table public.clients add column if not exists "tags" jsonb default '[]'::jsonb;

-- Visits 表
alter table public.visits add column if not exists "ownerId" text;
alter table public.visits add column if not exists "ownerName" text;
alter table public.visits add column if not exists "location" text;
alter table public.visits add column if not exists "clientContact" text;
alter table public.visits add column if not exists "clientContactRole" text;
alter table public.visits add column if not exists "clientParticipants" text;
alter table public.visits add column if not exists "ourParticipants" text;
alter table public.visits add column if not exists "recordingData" text;
alter table public.visits add column if not exists "recordings" jsonb default '[]'::jsonb;

-- Users 表 - 包含个性化设置字段
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'phone') then
    alter table public.users add column "phone" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'last_login_at') then
    alter table public.users add column "last_login_at" timestamp with time zone;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'theme_preference') then
    alter table public.users add column "theme_preference" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'password') then
    alter table public.users add column "password" text;
  end if;
end $$;

-- ==========================================
-- 7. 高级功能：API 缓存刷新函数
-- ==========================================
-- 创建一个 RPC 函数，允许前端调用以强制刷新 PostgREST schema cache
create or replace function public.reload_schema_cache()
returns void as $$
begin
  notify pgrst, 'reload config';
end;
$$ language plpgsql security definer;

-- 【关键修复】授予 API 角色执行该函数的权限
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO anon;
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO service_role;

-- 立即刷新一次
notify pgrst, 'reload config';