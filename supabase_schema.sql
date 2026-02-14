-- VisitPro CRM 数据库初始化脚本
-- 建议在 Supabase SQL Editor 中直接运行此脚本

-- 1. 启用扩展
create extension if not exists "uuid-ossp";

-- 2. 基础表结构 (如果不存在则创建)

-- Roles 表
create table if not exists public.roles (
    "id" text primary key,
    "name" text not null,
    "description" text,
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Departments 表
create table if not exists public.departments (
    "id" text primary key,
    "name" text not null,
    "parentId" text references public.departments("id"), -- 自关联实现树形结构
    "managerId" text, -- 将在 User 表创建后关联
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Users 表
create table if not exists public.users (
    "id" text primary key,
    "name" text not null,
    "email" text,
    "phone" text, -- 电话
    "avatarUrl" text,
    "roleId" text references public.roles("id"),
    "departmentId" text references public.departments("id"),
    "status" text default 'active', -- active, inactive
    "customFields" jsonb default '{}'::jsonb,
    "last_login_at" timestamp with time zone, -- 最后登录时间
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Clients 表
create table if not exists public.clients (
    "id" text primary key, -- 前端生成的时间戳ID或UUID
    "name" text not null,
    "industry" text,
    "status" text, -- 对应 ClientStatus 枚举
    "region" text,
    "contacts" jsonb default '[]'::jsonb, -- 存储 Contact[] 数组
    "customFields" jsonb default '{}'::jsonb, -- 扩展字段
    
    -- Owner/Creator
    "ownerId" text,
    "ownerName" text,
    
    -- AI 画像数据
    "equityStructure" jsonb default '[]'::jsonb, -- 存储结构化股东数据
    "subsidiaries" jsonb default '[]'::jsonb, -- 存储子公司数据
    "financialAnalysis" text,
    "supplyChainInfo" text,
    "tags" jsonb default '[]'::jsonb, -- AI 生成的标签
    
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Visits 表
create table if not exists public.visits (
    "id" text primary key,
    "clientId" text references public.clients("id"),
    "clientName" text, -- 冗余字段，便于列表展示
    "date" text, -- ISO 格式日期字符串
    "content" text, -- 原始笔记
    "type" text, -- 线下拜访/线上会议/电话沟通/客户到访
    
    -- 负责人信息
    "ownerId" text,
    "ownerName" text,
    
    -- 拜访详情
    "location" text,
    "clientContact" text,
    "clientContactRole" text,
    "clientParticipants" text,
    "ourParticipants" text,
    
    -- 录音数据
    "recordingData" text, -- (已弃用，保留兼容)
    "recordings" jsonb default '[]'::jsonb, -- 支持多录音文件

    -- 扩展字段
    "customFields" jsonb default '{}'::jsonb,
    
    -- AI 分析数据
    "summary" text,
    "sentiment" text, -- Positive/Neutral/Negative
    "actionItems" jsonb default '[]'::jsonb, -- 字符串数组
    "followUpDraft" text,
    
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- Login History 表 (新增)
create table if not exists public.login_history (
    "id" uuid primary key default uuid_generate_v4(),
    "user_id" text references public.users("id") on delete cascade,
    "login_at" timestamp with time zone default timezone('utc'::text, now()),
    "ip_address" text,
    "user_agent" text
);

-- 3. 开启行级安全 (RLS)
alter table public.roles enable row level security;
alter table public.departments enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.visits enable row level security;
alter table public.login_history enable row level security;

-- 4. 创建访问策略 (Policies)
-- 开发环境策略：允许所有操作。生产环境请务必修改为基于 auth.uid() 的策略。

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
-- 6. 迁移脚本 (Migration Scripts)
-- ==========================================
-- 即使表已存在，以下脚本会确保所有新字段都被添加。

-- 6.1 更新 Clients 表 (AI 画像字段)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'ownerId') then
    alter table public.clients add column "ownerId" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'ownerName') then
    alter table public.clients add column "ownerName" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'equityStructure') then
    alter table public.clients add column "equityStructure" jsonb default '[]'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'subsidiaries') then
    alter table public.clients add column "subsidiaries" jsonb default '[]'::jsonb;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'financialAnalysis') then
    alter table public.clients add column "financialAnalysis" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'supplyChainInfo') then
    alter table public.clients add column "supplyChainInfo" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'clients' and column_name = 'tags') then
    alter table public.clients add column "tags" jsonb default '[]'::jsonb;
  end if;
end $$;

-- 6.2 更新 Visits 表 (录音与详情字段)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'ownerId') then
    alter table public.visits add column "ownerId" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'ownerName') then
    alter table public.visits add column "ownerName" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'location') then
    alter table public.visits add column "location" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'clientContact') then
    alter table public.visits add column "clientContact" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'clientContactRole') then
    alter table public.visits add column "clientContactRole" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'clientParticipants') then
    alter table public.visits add column "clientParticipants" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'ourParticipants') then
    alter table public.visits add column "ourParticipants" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'recordingData') then
    alter table public.visits add column "recordingData" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'visits' and column_name = 'recordings') then
    alter table public.visits add column "recordings" jsonb default '[]'::jsonb;
  end if;
end $$;

-- 6.3 更新 Users 表 (电话与登录时间)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'phone') then
    alter table public.users add column "phone" text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'last_login_at') then
    alter table public.users add column "last_login_at" timestamp with time zone;
  end if;
end $$;

-- ==========================================
-- 7. 高级功能：API 缓存刷新函数
-- ==========================================
-- 创建一个 RPC 函数，允许前端调用以强制刷新 PostgREST schema cache。
-- 当添加新列后前端报错 "Could not find the ... column" 时，此函数非常有用。

create or replace function public.reload_schema_cache()
returns void as $$
begin
  notify pgrst, 'reload config';
end;
$$ language plpgsql security definer;

-- 授予 API 角色执行该函数的权限
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO anon;
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reload_schema_cache() TO service_role;

-- 立即刷新一次
notify pgrst, 'reload config';