-- both151'A CRM RC6
-- 001〜007 の後に実行してください。

-- =========================================================
-- 1. かな正規化関数（レビュー指摘⑬）
--    カタカナをひらがなへ変換する。ひらがな・カタカナどちらで検索しても
--    ヒットするよう、検索時に双方を正規化して比較する。
-- =========================================================
create or replace function public.normalize_kana(input text)
returns text
language sql
immutable
as $$
  select translate(
    coalesce(input, ''),
    'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ',
    'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔゕゖ'
  );
$$;

comment on function public.normalize_kana(text) is
  'カタカナをひらがなに変換する。検索時にひらがな/カタカナの表記ゆれを吸収するために使う。';

-- =========================================================
-- 2. 横断検索: かな正規化を適用（レビュー指摘⑬）
--    display_name・kana・real_name・エイリアスについて、検索語もデータも
--    normalize_kana() を通してから比較することで、
--    「やまだ」でも「ヤマダ」でも同じ結果にヒットするようにする。
--    漢字表記は元々display_name/real_nameのILIKEで別途ヒットする。
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
      or public.normalize_kana(c.kana) ilike '%' || public.normalize_kana(q.term) || '%'
      or c.real_name ilike '%' || q.term || '%'
      or c.memo ilike '%' || q.term || '%'
      or c.caution_reason ilike '%' || q.term || '%'
      or exists (
        select 1 from customer_aliases a
        where a.customer_id = c.id
          and (
            a.alias ilike '%' || q.term || '%'
            or public.normalize_kana(a.alias) ilike '%' || public.normalize_kana(q.term) || '%'
          )
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

-- かな正規化での比較を高速化するインデックス
create index if not exists idx_customers_kana_normalized
  on customers (public.normalize_kana(kana));
