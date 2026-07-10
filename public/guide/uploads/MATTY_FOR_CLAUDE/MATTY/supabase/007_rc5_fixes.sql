-- both151'A CRM RC5
-- 001〜006 の後に実行してください。

-- =========================================================
-- 1. notes: 登録者表示・無効化（第23章・レビュー指摘9,10）
-- =========================================================
alter table notes
  add column if not exists invalidated boolean not null default false;

-- 追記方式の原則は維持しつつ、誤登録メモを「無効化」できるようにする（本文の書き換えは不可）
drop policy if exists "notes update admin only" on notes;
create policy "notes update admin only" on notes
  for update to authenticated using (is_admin()) with check (is_admin());

-- =========================================================
-- 2. 同伴者の来店回数・来店履歴への反映（レビュー指摘3）
--    これまで visit_count 等は primary_customer_id のみを集計していた。
--    同伴者としての来店も「来店回数」としてカウントする
--    （売上・チップの帰属は代表者のみとし、二重計上しない）。
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
      count(distinct v.id) as visit_count,
      coalesce(sum(v.amount) filter (where v.primary_customer_id = p_customer_id), 0) as total_amount,
      coalesce(sum(v.tip) filter (where v.primary_customer_id = p_customer_id), 0) as total_tip,
      min(v.visited_at) as first_visit_at,
      max(v.visited_at) as last_visit_at
    from visits v
    where v.invalidated = false
      and (
        v.primary_customer_id = p_customer_id
        or exists (
          select 1 from visit_members vm
          where vm.visit_id = v.id and vm.customer_id = p_customer_id
        )
      )
  ) agg
  where c.id = p_customer_id;
end;
$$;

-- visit_members の増減でも、対象顧客の集計を再計算する（同伴者として来店した分の反映）
create or replace function public.trg_visit_members_recalculate_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    perform public.recalculate_customer_visit_stats(OLD.customer_id);
    return OLD;
  end if;

  perform public.recalculate_customer_visit_stats(NEW.customer_id);
  return NEW;
end;
$$;

drop trigger if exists trg_visit_members_after_change on visit_members;
create trigger trg_visit_members_after_change
  after insert or delete on visit_members
  for each row execute function public.trg_visit_members_recalculate_stats();

-- 同伴者側の customer_month_stats（今月来店回数）にも同伴を含める
create or replace view customer_month_stats as
select
  c.id as customer_id,
  count(distinct v.id) filter (
    where v.invalidated = false
      and date_trunc('month', v.visited_at) = date_trunc('month', now())
  ) as month_visit_count,
  coalesce(sum(v.amount) filter (
    where v.invalidated = false
      and v.primary_customer_id = c.id
      and date_trunc('month', v.visited_at) = date_trunc('month', now())
  ), 0) as month_amount,
  coalesce(sum(v.tip) filter (
    where v.invalidated = false
      and v.primary_customer_id = c.id
      and date_trunc('month', v.visited_at) = date_trunc('month', now())
  ), 0) as month_tip
from customers c
left join visits v on (
  v.primary_customer_id = c.id
  or exists (select 1 from visit_members vm where vm.visit_id = v.id and vm.customer_id = c.id)
)
group by c.id;

-- =========================================================
-- 3. 横断検索: メモ・注意理由も対象にする（レビュー指摘4）
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
      or c.caution_reason ilike '%' || q.term || '%'
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
        where b.customer_id = c.id
          and (b.bottle_name ilike '%' || q.term || '%' or b.bottle_type ilike '%' || q.term || '%')
      )
      or exists (
        select 1 from notes n
        where n.customer_id = c.id and n.invalidated = false and n.note ilike '%' || q.term || '%'
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
        select 1 from visit_members vm
        join customers cc on cc.id = vm.customer_id
        where vm.visit_id in (
          select id from visits where primary_customer_id = c.id
        )
        and cc.display_name ilike '%' || q.term || '%'
      )
    );
$$;

-- =========================================================
-- 4. タグの新規作成をスタッフ全員に許可（レビュー指摘12）
--    第32章の原則（タグ管理＝管理者のみ）から一部緩和する変更のため、
--    削除・名称変更は引き続き管理者限定のまま、新規作成のみスタッフに開放する。
-- =========================================================
drop policy if exists "tags insert admin only" on tags;
create policy "tags insert staff" on tags
  for insert to authenticated with check (true);

-- =========================================================
-- 5. 顧客一覧の並び順を安定させる（レビュー指摘8）
--    last_visit_at が同値（NULL含む）の場合に順序が毎回変わってしまうのを防ぐため、
--    idを第2ソートキーとして使えるようインデックスを用意する。
-- =========================================================
create index if not exists idx_customers_hidden_last_visit_id
  on customers (hidden, last_visit_at desc nulls last, id);
