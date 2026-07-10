-- both151'A CRM Supabase schema draft v1.0
-- This is a practical starting schema for Claude implementation.
--
-- [Phase A注記]
-- このファイルは提供された schema.sql をそのまま採用したベース定義です。
-- 集計カラムの追加・再計算トリガー・ロール別RLSポリシーへの強化は
-- 002_aggregates_and_rls.sql で行います（このファイルの後に実行してください）。

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  kana text,
  real_name text,
  birthday date,
  memo text,
  rank text not null default 'first' check (rank in ('first','regular','vip','special')),
  favorite boolean not null default false,
  hidden boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists customer_aliases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now()
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists customer_tags (
  customer_id uuid not null references customers(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (customer_id, tag_id)
);

create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  primary_customer_id uuid not null references customers(id),
  visited_at timestamptz not null,
  people_count integer not null default 1 check (people_count >= 1),
  amount integer not null default 0 check (amount >= 0),
  tip integer not null default 0 check (tip >= 0),
  payment_method text not null default 'cash' check (payment_method in ('cash','credit','other')),
  seat_type text check (seat_type in ('counter','box')),
  receipt_required boolean not null default false,
  receipt_name text,
  memo text,
  invalidated boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists visit_members (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  customer_id uuid not null references customers(id),
  member_type text not null default 'companion' check (member_type in ('primary','companion')),
  created_at timestamptz not null default now(),
  unique (visit_id, customer_id)
);

create table if not exists bottles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  bottle_name text not null,
  start_date date not null default current_date,
  expiry_date date not null default (current_date + interval '365 days')::date,
  status text not null default 'kept' check (status in ('kept','finished','returned','disposed')),
  memo text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  reserved_at timestamptz not null,
  people_count integer not null default 1 check (people_count >= 1),
  bottle_plan boolean not null default false,
  memo text,
  status text not null default 'reserved' check (status in ('reserved','visited','cancelled')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reservation_members (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  customer_id uuid not null references customers(id),
  created_at timestamptz not null default now(),
  unique (reservation_id, customer_id)
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  note text not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  table_name text not null,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index if not exists idx_customers_display_name on customers using gin (to_tsvector('simple', coalesce(display_name,'') || ' ' || coalesce(kana,'') || ' ' || coalesce(real_name,'')));
create index if not exists idx_customer_aliases_alias on customer_aliases using gin (to_tsvector('simple', alias));
create index if not exists idx_visits_visited_at on visits (visited_at);
create index if not exists idx_visits_customer on visits (primary_customer_id);
create index if not exists idx_bottles_customer on bottles (customer_id);
create index if not exists idx_bottles_expiry on bottles (expiry_date);
create index if not exists idx_reservations_reserved_at on reservations (reserved_at);

-- Updated_at helper
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_customers_updated_at on customers;
create trigger trg_customers_updated_at before update on customers for each row execute function set_updated_at();

drop trigger if exists trg_visits_updated_at on visits;
create trigger trg_visits_updated_at before update on visits for each row execute function set_updated_at();

drop trigger if exists trg_bottles_updated_at on bottles;
create trigger trg_bottles_updated_at before update on bottles for each row execute function set_updated_at();

drop trigger if exists trg_reservations_updated_at on reservations;
create trigger trg_reservations_updated_at before update on reservations for each row execute function set_updated_at();

-- RLS
alter table profiles enable row level security;
alter table customers enable row level security;
alter table customer_aliases enable row level security;
alter table tags enable row level security;
alter table customer_tags enable row level security;
alter table visits enable row level security;
alter table visit_members enable row level security;
alter table bottles enable row level security;
alter table reservations enable row level security;
alter table reservation_members enable row level security;
alter table notes enable row level security;
alter table audit_logs enable row level security;

-- Simple authenticated access policies; refine admin-only operations in app logic or with stricter policies.
create policy "authenticated profiles read" on profiles for select to authenticated using (true);
create policy "authenticated customers all" on customers for all to authenticated using (true) with check (true);
create policy "authenticated aliases all" on customer_aliases for all to authenticated using (true) with check (true);
create policy "authenticated tags all" on tags for all to authenticated using (true) with check (true);
create policy "authenticated customer_tags all" on customer_tags for all to authenticated using (true) with check (true);
create policy "authenticated visits all" on visits for all to authenticated using (true) with check (true);
create policy "authenticated visit_members all" on visit_members for all to authenticated using (true) with check (true);
create policy "authenticated bottles all" on bottles for all to authenticated using (true) with check (true);
create policy "authenticated reservations all" on reservations for all to authenticated using (true) with check (true);
create policy "authenticated reservation_members all" on reservation_members for all to authenticated using (true) with check (true);
create policy "authenticated notes all" on notes for all to authenticated using (true) with check (true);
create policy "authenticated audit read" on audit_logs for select to authenticated using (true);
create policy "authenticated audit insert" on audit_logs for insert to authenticated with check (true);
