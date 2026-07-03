-- both151'A CRM Phase A: 集計カラム・再計算トリガー・権限別RLS強化
-- 001_initial_schema.sql の後に実行してください。
--
-- 対応する仕様書の章:
--   第18章 データ連携（来店登録時の自動更新）
--   第21章 データ整合性（編集時の再計算）
--   第32章 権限管理（一般スタッフ / 管理者）
--   第24章 監査ログ（削除不可・管理画面のみ閲覧）

-- =========================================================
-- 1. 権限判定ヘルパー関数
-- =========================================================

-- SECURITY DEFINER: RLSポリシー内から profiles を安全に参照するため
-- （通常権限のままだとポリシー評価が profiles 自身のRLSと循環する可能性があるため）
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =========================================================
-- 2. 新規スタッフ登録時に profiles を自動作成
--    （Supabase Authでユーザー作成 → profiles行を自動生成。role初期値は 'staff'）
-- =========================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'staff'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- role列は管理者のみ変更可能（アプリ層だけでなくDB層でも保証する）
create or replace function public.enforce_profile_role_admin_only()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'スタッフの権限（role）変更は管理者のみ可能です';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on profiles;
create trigger trg_profiles_role_guard
  before update on profiles
  for each row execute function public.enforce_profile_role_admin_only();

-- =========================================================
-- 3. customers: 集計カラムの追加（第6章・第15章・第18章・第21章）
--    「保存して自動更新」方式。都度計算ではなく、来店/ボトルの変更時に
--    トリガーで再計算してこのカラムへ書き戻す。
-- =========================================================

alter table customers
  add column if not exists visit_count integer not null default 0,
  add column if not exists total_amount integer not null default 0,
  add column if not exists total_tip integer not null default 0,
  add column if not exists first_visit_at timestamptz,
  add column if not exists last_visit_at timestamptz,
  add column if not exists current_bottle_count integer not null default 0;

comment on column customers.visit_count is '累計来店回数（無効化された来店は除く）。visits変更時にトリガーで自動再計算。';
comment on column customers.total_amount is '累計売上。visits変更時にトリガーで自動再計算。';
comment on column customers.total_tip is '累計チップ。visits変更時にトリガーで自動再計算。';
comment on column customers.current_bottle_count is '現在預かり中(status=kept)のボトル本数。bottles変更時にトリガーで自動再計算。';

-- 「今月来店回数」「今月売上」「今月チップ」について（設計メモ）
--   月次値は月替わりで自動的にリセットされる必要があるため、
--   customersカラムに保存して都度トリガー更新する方式は、月初に
--   全顧客分をリセットするバッチが別途必要になり整合性リスクが上がる。
--   そのため月次値は下記 customer_month_stats ビューで visited_at を
--   都度絞り込んで算出する（インデックスにより高速）。
--   累計値（visit_count等）は本方針どおり「保存して自動更新」する。

create or replace view customer_month_stats as
select
  c.id as customer_id,
  count(v.id) filter (
    where v.invalidated = false
      and date_trunc('month', v.visited_at) = date_trunc('month', now())
  ) as month_visit_count,
  coalesce(sum(v.amount) filter (
    where v.invalidated = false
      and date_trunc('month', v.visited_at) = date_trunc('month', now())
  ), 0) as month_amount,
  coalesce(sum(v.tip) filter (
    where v.invalidated = false
      and date_trunc('month', v.visited_at) = date_trunc('month', now())
  ), 0) as month_tip
from customers c
left join visits v on v.primary_customer_id = c.id
group by c.id;

-- =========================================================
-- 4. 来店データ変更時の顧客集計再計算（第18章・第21章）
--    INSERT / UPDATE（会計金額・チップ・無効化フラグ編集を含む）/ DELETE すべてで発火
-- =========================================================

create or replace function public.recalculate_customer_visit_stats(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update customers c
  set
    visit_count = agg.visit_count,
    total_amount = agg.total_amount,
    total_tip = agg.total_tip,
    first_visit_at = agg.first_visit_at,
    last_visit_at = agg.last_visit_at,
    updated_at = now()
  from (
    select
      count(*) as visit_count,
      coalesce(sum(amount), 0) as total_amount,
      coalesce(sum(tip), 0) as total_tip,
      min(visited_at) as first_visit_at,
      max(visited_at) as last_visit_at
    from visits
    where primary_customer_id = p_customer_id
      and invalidated = false
  ) agg
  where c.id = p_customer_id;
end;
$$;

create or replace function public.trg_visits_recalculate_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recalculate_customer_visit_stats(OLD.primary_customer_id);
    return OLD;
  end if;

  perform public.recalculate_customer_visit_stats(NEW.primary_customer_id);

  -- 代表顧客が変更された場合は変更前の顧客side も再計算する
  if TG_OP = 'UPDATE' and OLD.primary_customer_id is distinct from NEW.primary_customer_id then
    perform public.recalculate_customer_visit_stats(OLD.primary_customer_id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_visits_after_change on visits;
create trigger trg_visits_after_change
  after insert or update or delete on visits
  for each row execute function public.trg_visits_recalculate_stats();

-- =========================================================
-- 5. ボトル変更時の現在預かり本数の再計算（第11章・第21章）
-- =========================================================

create or replace function public.recalculate_customer_bottle_count(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update customers c
  set
    current_bottle_count = (
      select count(*) from bottles
      where customer_id = p_customer_id and status = 'kept'
    ),
    updated_at = now()
  where c.id = p_customer_id;
end;
$$;

create or replace function public.trg_bottles_recalculate_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recalculate_customer_bottle_count(OLD.customer_id);
    return OLD;
  end if;

  perform public.recalculate_customer_bottle_count(NEW.customer_id);

  if TG_OP = 'UPDATE' and OLD.customer_id is distinct from NEW.customer_id then
    perform public.recalculate_customer_bottle_count(OLD.customer_id);
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_bottles_after_change on bottles;
create trigger trg_bottles_after_change
  after insert or update or delete on bottles
  for each row execute function public.trg_bottles_recalculate_count();

-- =========================================================
-- 6. 顧客ランクは管理者のみ変更可（第7章・第32章）
-- =========================================================

create or replace function public.enforce_customer_rank_admin_only()
returns trigger
language plpgsql
as $$
begin
  if new.rank is distinct from old.rank and not public.is_admin() then
    raise exception '顧客ランクの変更は管理者のみ可能です（第32章）';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customers_rank_guard on customers;
create trigger trg_customers_rank_guard
  before update on customers
  for each row execute function public.enforce_customer_rank_admin_only();

-- =========================================================
-- 7. RLSポリシーの再構成：一般スタッフ / 管理者
--    第32章:
--      一般スタッフ = 閲覧・登録・編集
--      管理者       = 上記 + 設定変更・完全削除・CSV出力・タグ管理・
--                      ランク変更・監査ログ閲覧・スタッフ管理
--    方針:
--      - SELECT/INSERT/UPDATE は authenticated（スタッフ）に許可
--        （ランク変更等の列単位の制御は上記トリガーで別途保護）
--      - DELETE（完全削除）は管理者のみ
--      - tags の追加・変更・削除（タグ管理）は管理者のみ
--      - audit_logs の閲覧は管理者のみ／削除は誰にも許可しない
-- =========================================================

-- --- 既存の緩いポリシーを削除 ---
drop policy if exists "authenticated profiles read" on profiles;
drop policy if exists "authenticated customers all" on customers;
drop policy if exists "authenticated aliases all" on customer_aliases;
drop policy if exists "authenticated tags all" on tags;
drop policy if exists "authenticated customer_tags all" on customer_tags;
drop policy if exists "authenticated visits all" on visits;
drop policy if exists "authenticated visit_members all" on visit_members;
drop policy if exists "authenticated bottles all" on bottles;
drop policy if exists "authenticated reservations all" on reservations;
drop policy if exists "authenticated reservation_members all" on reservation_members;
drop policy if exists "authenticated notes all" on notes;
drop policy if exists "authenticated audit read" on audit_logs;
drop policy if exists "authenticated audit insert" on audit_logs;

-- --- profiles（スタッフ管理は管理者のみ／自分の表示名は自分で編集可） ---
create policy "profiles select all staff" on profiles
  for select to authenticated using (true);

create policy "profiles insert admin only" on profiles
  for insert to authenticated with check (is_admin());

create policy "profiles update self or admin" on profiles
  for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

create policy "profiles delete admin only" on profiles
  for delete to authenticated using (is_admin());

-- --- customers（閲覧・登録・編集はスタッフ全員／完全削除のみ管理者） ---
create policy "customers select staff" on customers
  for select to authenticated using (true);

create policy "customers insert staff" on customers
  for insert to authenticated with check (true);

create policy "customers update staff" on customers
  for update to authenticated using (true) with check (true);

create policy "customers delete admin only" on customers
  for delete to authenticated using (is_admin());

-- --- customer_aliases（顧客情報の一部としてスタッフが編集可） ---
create policy "aliases select staff" on customer_aliases
  for select to authenticated using (true);

create policy "aliases insert staff" on customer_aliases
  for insert to authenticated with check (true);

create policy "aliases update staff" on customer_aliases
  for update to authenticated using (true) with check (true);

create policy "aliases delete staff" on customer_aliases
  for delete to authenticated using (true);

-- --- tags（タグの新規作成・改名・削除＝タグ管理は管理者のみ／閲覧は全員） ---
create policy "tags select staff" on tags
  for select to authenticated using (true);

create policy "tags insert admin only" on tags
  for insert to authenticated with check (is_admin());

create policy "tags update admin only" on tags
  for update to authenticated using (is_admin()) with check (is_admin());

create policy "tags delete admin only" on tags
  for delete to authenticated using (is_admin());

-- --- customer_tags（来店登録などで顧客へタグを付け外しするのはスタッフの通常業務） ---
create policy "customer_tags select staff" on customer_tags
  for select to authenticated using (true);

create policy "customer_tags insert staff" on customer_tags
  for insert to authenticated with check (true);

create policy "customer_tags delete staff" on customer_tags
  for delete to authenticated using (true);

-- --- visits（登録・編集・無効化はスタッフ／完全削除のみ管理者） ---
create policy "visits select staff" on visits
  for select to authenticated using (true);

create policy "visits insert staff" on visits
  for insert to authenticated with check (true);

create policy "visits update staff" on visits
  for update to authenticated using (true) with check (true);

create policy "visits delete admin only" on visits
  for delete to authenticated using (is_admin());

-- --- visit_members ---
create policy "visit_members select staff" on visit_members
  for select to authenticated using (true);

create policy "visit_members insert staff" on visit_members
  for insert to authenticated with check (true);

create policy "visit_members update staff" on visit_members
  for update to authenticated using (true) with check (true);

create policy "visit_members delete staff" on visit_members
  for delete to authenticated using (true);

-- --- bottles（登録・状態変更・期限延長はスタッフ／完全削除のみ管理者） ---
create policy "bottles select staff" on bottles
  for select to authenticated using (true);

create policy "bottles insert staff" on bottles
  for insert to authenticated with check (true);

create policy "bottles update staff" on bottles
  for update to authenticated using (true) with check (true);

create policy "bottles delete admin only" on bottles
  for delete to authenticated using (is_admin());

-- --- reservations（登録・変更・キャンセルはスタッフ／完全削除のみ管理者） ---
create policy "reservations select staff" on reservations
  for select to authenticated using (true);

create policy "reservations insert staff" on reservations
  for insert to authenticated with check (true);

create policy "reservations update staff" on reservations
  for update to authenticated using (true) with check (true);

create policy "reservations delete admin only" on reservations
  for delete to authenticated using (is_admin());

-- --- reservation_members ---
create policy "reservation_members select staff" on reservation_members
  for select to authenticated using (true);

create policy "reservation_members insert staff" on reservation_members
  for insert to authenticated with check (true);

create policy "reservation_members update staff" on reservation_members
  for update to authenticated using (true) with check (true);

create policy "reservation_members delete staff" on reservation_members
  for delete to authenticated using (true);

-- --- notes（第23章: 追加方式。上書き編集・削除は想定しないため
--            UPDATEポリシーは作らない。誤登録の削除のみ管理者に許可） ---
create policy "notes select staff" on notes
  for select to authenticated using (true);

create policy "notes insert staff" on notes
  for insert to authenticated with check (true);

create policy "notes delete admin only" on notes
  for delete to authenticated using (is_admin());

-- --- audit_logs（第24章: 管理画面のみ閲覧可能／削除は誰にも許可しない） ---
create policy "audit_logs select admin only" on audit_logs
  for select to authenticated using (is_admin());

create policy "audit_logs insert staff" on audit_logs
  for insert to authenticated with check (true);

-- UPDATE / DELETE ポリシーは意図的に作成しない（監査ログは改変・削除不可）
