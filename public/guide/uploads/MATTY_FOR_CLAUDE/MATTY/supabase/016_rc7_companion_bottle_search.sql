-- MATTY v1.1 RC7
-- 015 の後に実行してください。
-- RC6の 015_rc6_search_companion_extension.sql と同内容ですが、
-- 「015を適用した」つもりが反映されていない場合のための再実行版です。
-- 015 が適用済みでも、このファイルを実行すれば安全に上書きできます（CREATE OR REPLACE）。
--
-- 修正内容:
-- 1. ボトル名検索で代表者だけでなく同伴者もヒットするよう search_customers を拡張
-- 2. タグ検索も同様に同伴者をヒットさせる
-- 3. NOTIFY pgrst, 'reload schema' でキャッシュ強制更新

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
      -- 基本情報での検索
      c.display_name ilike '%' || q.term || '%'
      or c.kana ilike '%' || q.term || '%'
      or public.normalize_kana(c.kana) ilike '%' || public.normalize_kana(q.term) || '%'
      or c.real_name ilike '%' || q.term || '%'
      or c.memo ilike '%' || q.term || '%'
      or c.caution_reason ilike '%' || q.term || '%'

      -- 別名での検索
      or exists (
        select 1 from customer_aliases a
        where a.customer_id = c.id
          and (
            a.alias ilike '%' || q.term || '%'
            or public.normalize_kana(a.alias) ilike '%' || public.normalize_kana(q.term) || '%'
          )
      )

      -- この顧客自身のタグでの検索
      or exists (
        select 1 from customer_tags ct
        join tags t on t.id = ct.tag_id
        where ct.customer_id = c.id and t.name ilike '%' || q.term || '%'
      )

      -- この顧客自身のボトルでの検索
      or exists (
        select 1 from bottles b
        where b.customer_id = c.id
          and (b.bottle_name ilike '%' || q.term || '%'
            or (b.bottle_type is not null and b.bottle_type ilike '%' || q.term || '%'))
      )

      -- メモでの検索
      or exists (
        select 1 from notes n
        where n.customer_id = c.id and n.invalidated = false and n.note ilike '%' || q.term || '%'
      )

      -- 代表者としての来店内容での検索
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

      -- 同伴者名での検索（代表者側に同伴者名でヒット）
      or exists (
        select 1 from visit_members vm
        join customers cc on cc.id = vm.customer_id
        where vm.visit_id in (
          select id from visits where primary_customer_id = c.id
        )
        and (
          cc.display_name ilike '%' || q.term || '%'
          or cc.kana ilike '%' || q.term || '%'
          or public.normalize_kana(cc.kana) ilike '%' || public.normalize_kana(q.term) || '%'
        )
      )

      -- ★ 新規追加: 同伴者検索の拡張
      -- この顧客が同伴者として参加した来店の「代表者のタグ」での検索
      -- 理由: タグは代表者に付与されるが、同伴者も同じ来店にいたため検索対象にすべき
      or exists (
        select 1 from visit_members vm
        join visits v on v.id = vm.visit_id and v.invalidated = false
        join customer_tags ct on ct.customer_id = v.primary_customer_id
        join tags t on t.id = ct.tag_id
        where vm.customer_id = c.id
          and vm.member_type = 'companion'
          and t.name ilike '%' || q.term || '%'
      )

      -- ★ 新規追加: この顧客が同伴した来店の「代表者のボトル」での検索
      -- 理由: ボトルは代表者に登録されるが、同伴者も同じボトルを飲んでいるため検索対象にすべき
      or exists (
        select 1 from visit_members vm
        join visits v on v.id = vm.visit_id and v.invalidated = false
        join bottles b on b.customer_id = v.primary_customer_id
        where vm.customer_id = c.id
          and vm.member_type = 'companion'
          and (b.bottle_name ilike '%' || q.term || '%'
            or (b.bottle_type is not null and b.bottle_type ilike '%' || q.term || '%'))
      )
    );
$$;

notify pgrst, 'reload schema';