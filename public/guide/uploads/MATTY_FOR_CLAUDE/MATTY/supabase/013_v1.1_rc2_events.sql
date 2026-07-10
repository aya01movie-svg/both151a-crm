-- MATTY v1.1 RC2
-- 001〜012 の後に実行してください。
-- イベント管理・店休日・祝日の基盤テーブルを追加します。

-- =========================================================
-- 1. 店休日テーブル
-- =========================================================
create table if not exists closed_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  note text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

comment on table closed_days is '店休日の管理。登録した日はカレンダー・ホーム通知に表示される。';

alter table closed_days enable row level security;

create policy "staff can read closed_days" on closed_days
  for select using (auth.role() = 'authenticated');

create policy "admin can manage closed_days" on closed_days
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- =========================================================
-- 2. イベントテーブル
-- =========================================================
-- schedule_type: 'single'=1日, 'range'=期間, 'weekly'=毎週, 'annual'=毎年固定
create table if not exists store_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  emoji text not null default '📅',
  event_type text not null default 'local',
    -- 'store'=店イベント, 'local'=地元イベント, 'staff'=スタッフ関連,
    -- 'sport'=スポーツ, 'convention'=学会/コンベンション, 'weekly'=毎週, 'other'=その他
  schedule_type text not null default 'single',
    -- 'single'=1日, 'range'=期間, 'weekly'=毎週, 'annual'=毎年固定
  start_date date,        -- single / range / annual の場合
  end_date date,          -- range の場合（single は start_date = end_date）
  annual_month integer,   -- annual の場合（1〜12）
  annual_day integer,     -- annual の場合（1〜31）
  weekly_day integer,     -- weekly の場合（0=日〜6=土）
  url text,
  memo text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table store_events is 'イベント管理。店イベント・地元イベント・毎週イベント・毎年固定イベントを登録できる。';

alter table store_events enable row level security;

create policy "staff can read store_events" on store_events
  for select using (auth.role() = 'authenticated');

create policy "admin can manage store_events" on store_events
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- =========================================================
-- 3. 祝日テーブル（2025〜2027年分を事前登録）
-- =========================================================
create table if not exists holidays (
  date date primary key,
  name text not null
);

comment on table holidays is '日本の祝日データ（事前登録。毎年管理画面から追加するか、SQLで一括更新する）。';

alter table holidays enable row level security;

create policy "anyone can read holidays" on holidays
  for select using (true);

create policy "admin can manage holidays" on holidays
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- 2025年の祝日
insert into holidays (date, name) values
  ('2025-01-01', '元日'),
  ('2025-01-13', '成人の日'),
  ('2025-02-11', '建国記念の日'),
  ('2025-02-23', '天皇誕生日'),
  ('2025-02-24', '振替休日'),
  ('2025-03-20', '春分の日'),
  ('2025-04-29', '昭和の日'),
  ('2025-05-03', '憲法記念日'),
  ('2025-05-04', 'みどりの日'),
  ('2025-05-05', 'こどもの日'),
  ('2025-05-06', '振替休日'),
  ('2025-07-21', '海の日'),
  ('2025-08-11', '山の日'),
  ('2025-09-15', '敬老の日'),
  ('2025-09-23', '秋分の日'),
  ('2025-10-13', 'スポーツの日'),
  ('2025-11-03', '文化の日'),
  ('2025-11-23', '勤労感謝の日'),
  ('2025-11-24', '振替休日')
on conflict (date) do nothing;

-- 2026年の祝日（添付ファイルの内容に基づく）
insert into holidays (date, name) values
  ('2026-01-01', '元日'),
  ('2026-01-12', '成人の日'),
  ('2026-02-11', '建国記念の日'),
  ('2026-02-23', '天皇誕生日'),
  ('2026-03-20', '春分の日'),
  ('2026-04-29', '昭和の日'),
  ('2026-05-03', '憲法記念日'),
  ('2026-05-04', 'みどりの日'),
  ('2026-05-05', 'こどもの日'),
  ('2026-05-06', '振替休日'),
  ('2026-07-20', '海の日'),
  ('2026-08-11', '山の日'),
  ('2026-09-21', '敬老の日'),
  ('2026-09-22', '国民の休日'),
  ('2026-09-23', '秋分の日'),
  ('2026-10-12', 'スポーツの日'),
  ('2026-11-03', '文化の日'),
  ('2026-11-23', '勤労感謝の日')
on conflict (date) do nothing;

-- 2027年の祝日（暫定）
insert into holidays (date, name) values
  ('2027-01-01', '元日'),
  ('2027-01-11', '成人の日'),
  ('2027-02-11', '建国記念の日'),
  ('2027-02-23', '天皇誕生日'),
  ('2027-03-21', '春分の日'),
  ('2027-04-29', '昭和の日'),
  ('2027-05-03', '憲法記念日'),
  ('2027-05-04', 'みどりの日'),
  ('2027-05-05', 'こどもの日'),
  ('2027-07-19', '海の日'),
  ('2027-08-11', '山の日'),
  ('2027-09-20', '敬老の日'),
  ('2027-09-23', '秋分の日'),
  ('2027-10-11', 'スポーツの日'),
  ('2027-11-03', '文化の日'),
  ('2027-11-23', '勤労感謝の日')
on conflict (date) do nothing;

notify pgrst, 'reload schema';
