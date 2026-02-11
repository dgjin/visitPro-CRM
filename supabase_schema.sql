-- VisitPro CRM 数据库初始化脚本
-- 注意：为了适配前端 TypeScript 接口的驼峰命名法 (CamelCase)，
-- 本脚本中的列名使用了双引号 "columnName"。

-- 1. 启用必要的扩展（可选）
create extension if not exists "uuid-ossp";

-- 2. 创建基础配置表 (Roles, Departments)

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

-- 3. 创建 Users 表 (扩展 Supabase Auth 或独立管理)
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
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- 4. 创建 Clients 表
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
    "equityStructure" jsonb default '[]'::jsonb, -- 修改为 JSONB 存储结构化股东数据
    "subsidiaries" jsonb default '[]'::jsonb, -- 修改为 JSONB 存储子公司数据
    "financialAnalysis" text,
    "supplyChainInfo" text,
    
    "created_at" timestamp with time zone default timezone('utc'::text, now())
);

-- 5. 创建 Visits 表
create table if not exists public.visits (
    "id" text primary key,
    "clientId" text references public.clients("id"),
    "clientName" text, -- 冗余字段，便于列表展示
    "date" text, -- ISO 格式日期字符串
    "content" text, -- 原始笔记
    "type" text, -- 线下拜访/线上会议/电话沟通/客户到访
    
    -- 负责人信息 (新增)
    "ownerId" text,
    "ownerName" text,
    
    -- 拜访详情 (新增)
    "location" text,
    "clientParticipants" text,
    "ourParticipants" text,
    
    -- 录音数据 (新增 - Base64)
    "recordingData" text,
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

-- 6. 开启行级安全 (RLS)
alter table public.roles enable row level security;
alter table public.departments enable row level security;
alter table public.users enable row level security;
alter table public.clients enable row level security;
alter table public.visits enable row level security;

-- 7. 创建访问策略 (Policies)
-- 为了演示方便，允许所有操作。生产环境请限制。

create policy "Enable all access for roles" on public.roles for all using (true) with check (true);
create policy "Enable all access for departments" on public.departments for all using (true) with check (true);
create policy "Enable all access for users" on public.users for all using (true) with check (true);
create policy "Enable all access for clients" on public.clients for all using (true) with check (true);
create policy "Enable all access for visits" on public.visits for all using (true) with check (true);

-- 8. 索引
create index if not exists idx_users_dept on public.users ("departmentId");
create index if not exists idx_depts_parent on public.departments ("parentId");

-- ==========================================
-- 9. 迁移脚本 (Migration Scripts)
-- ==========================================
-- 如果您的表已经存在，请运行以下命令来添加缺失的字段。

-- 9.1 更新 Clients 表
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
end $$;

-- 9.2 更新 Visits 表
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

-- 9.3 更新 Users 表 (Added Phone)
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'phone') then
    alter table public.users add column "phone" text;
  end if;
end $$;

-- 9.4 刷新 Schema Cache (PostgREST)
notify pgrst, 'reload config';