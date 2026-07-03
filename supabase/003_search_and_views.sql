-- both151'A CRM Phase B: 検索最適化・全文検索関数・最近見た顧客
-- 001, 002 の後に実行してください。
--
-- 対応する仕様書の章:
--   第9章・第19章 検索仕様（全項目部分一致・リアルタイム）
--   第35章 パフォーマンス（検索300ms以内・一覧500件でも快適）
--   第36章 最近見た顧客

-- =========================================================
-- 0. 001で作成した tsvector 全文検索インデックスは、本ファイルの
--    trigram(ILIKE部分一致)インデックスに統一するため削除する
--    （二重にインデックスを持つと書き込みコストが増えるため）
-- =========================================================
drop index if exists idx_customers_display_name;
drop index if exists idx_customer_aliases_alias;

-- =========================================================
-- 1. pg_trgm 拡張（部分一致 ILIKE '%text%' をインデックスで高速化する）
-- =========================================================
create extension if not exists pg_trgm;

-- =========================================================
-- 2. 検索対象カラムへのGIN trigramインデックス
--    500件超の顧客・来店履歴でも ILIKE '%...%' が高速に動作するようにする
-- =========================================================

-- 顧客: 登録名・ふりがな・本名・メモ
create index if not exists idx_customers_display_name_trgm
  on customers using gin (display_name gin_trgm_ops);
create index if not exists idx_customers_kana_trgm
  on customers using gin (kana gin_trgm_ops);
create index if not exists idx_customers_real_name_trgm
  on customers using gin (real_name gin_trgm_ops);
create index if not exists idx_customers_memo_trgm
  on customers using gin (memo gin_trgm_ops);

-- 別名
create index if not exists idx_customer_aliases_alias_trgm
  on customer_aliases using gin (alias gin_trgm_ops);

-- 来店: 領収書宛名・メモ
create index if not exists idx_visits_receipt_name_trgm
  on visits using gin (receipt_name gin_trgm_ops);
create index if not exists idx_visits_memo_trgm
  on visits using gin (memo gin_trgm_ops);

-- ボトル名
create index if not exists idx_bottles_name_trgm
  on bottles using gin (bottle_name gin_trgm_ops);

-- タグ名（件数は少ないが検索経路として使うためbtreeで十分）
create index if not exists idx_tags_name on tags (name);

-- =========================================================
-- 3. 一覧表示・並び替え用インデックス（第26章・第35章）
--    顧客一覧の初期表示は「最終来店日が新しい順」
-- =========================================================
create index if not exists idx_customers_hidden_last_visit
  on customers (hidden, last_visit_at desc nulls last);
create index if not exists idx_customers_favorite
  on customers (favorite) where favorite = true;
create index if not exists idx_customer_tags_tag_id
  on customer_tags (tag_id);

-- =========================================================
-- 4. 全項目横断検索関数（第9章・第19章）
--    登録名・ふりがな・本名・メモ・別名・タグ・領収書宛名・来店メモ・ボトル名を
--    1回のクエリで横断検索し、一致した顧客IDを返す。
--    金額・チップの数値検索は「文字列に変換した値」との部分一致として扱う
--    （例: "18000" で 18,000円 の来店にヒット）。
-- =========================================================
create or replace function public.search_customers(p_query text)
returns table (customer_id uuid)
language sql
stable
as $$
  with q as (
    select nullif(trim(p_query), '') as term
  )
  select distinct c.id
  from customers c, q
  where q.term is not null
    and c.hidden = false
    and (
      c.display_name ilike '%' || q.term || '%'
      or c.kana ilike '%' || q.term || '%'
      or c.real_name ilike '%' || q.term || '%'
      or c.memo ilike '%' || q.term || '%'
      or exists (
        select 1 from customer_aliases a
        where a.customer_id = c.id and a.alias ilike '%' || q.term || '%'
      )
      or exists (
        select 1 from customer_tags ct
        join tags t on t.id = ct.tag_id
        where ct.customer_id = c.id and t.name ilike '%' || q.term || '%'
      )
      or exists (
        select 1 from bottles b
        where b.customer_id = c.id and b.bottle_name ilike '%' || q.term || '%'
      )
      or exists (
        select 1 from visits v
        where v.primary_customer_id = c.id
          and v.invalidated = false
          and (
            v.receipt_name ilike '%' || q.term || '%'
            or v.memo ilike '%' || q.term || '%'
            or v.payment_method ilike '%' || q.term || '%'
            or v.amount::text ilike '%' || q.term || '%'
            or v.tip::text ilike '%' || q.term || '%'
            or to_char(v.visited_at, 'YYYY/MM/DD') ilike '%' || q.term || '%'
          )
      )
      or exists (
        -- 同伴者名での検索（同伴者も顧客として登録されている前提・第6章）
        select 1 from visit_members vm
        join customers cc on cc.id = vm.customer_id
        where vm.visit_id in (
          select id from visits where primary_customer_id = c.id
        )
        and cc.display_name ilike '%' || q.term || '%'
      )
    );
$$;

comment on function public.search_customers(text) is
  '第9章・第19章: 登録名/ふりがな/本名/メモ/別名/タグ/領収書宛名/来店メモ/支払方法/金額/チップ/日付/同伴者名を横断検索する。';

-- =========================================================
-- 5. 最近見た顧客（第36章）
--    スタッフ全員でリアルタイム共有する運用のため、店舗全体で
--    「直近に開かれた顧客詳細」を記録する（個人別の履歴ではない）。
-- =========================================================
create table if not exists customer_views (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  viewed_by uuid references profiles(id),
  viewed_at timestamptz not null default now()
);

create index if not exists idx_customer_views_customer_viewed_at
  on customer_views (customer_id, viewed_at desc);
create index if not exists idx_customer_views_viewed_at
  on customer_views (viewed_at desc);

alter table customer_views enable row level security;

create policy "customer_views select staff" on customer_views
  for select to authenticated using (true);

create policy "customer_views insert staff" on customer_views
  for insert to authenticated with check (true);

-- 閲覧履歴は肥大化するため、直近30日分のみ残す運用を想定
-- （削除は明示的にadminのみ許可。定期クリーンアップは運用タスクとして別途cronで実行する想定）
create policy "customer_views delete admin only" on customer_views
  for delete to authenticated using (is_admin());
