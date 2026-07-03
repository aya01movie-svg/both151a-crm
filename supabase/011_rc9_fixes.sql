-- both151'A CRM RC9
-- 001〜010 の後に実行してください。
-- 既存データがあっても安全に再実行できるよう、すべて IF NOT EXISTS / OR REPLACE で記述しています。

-- =========================================================
-- 1. bottles テーブルのカラムを確実に存在させる（レビュー指摘1・8）
--    「Could not find the 'quantity' column ... in the schema cache」対策。
-- =========================================================
alter table bottles
  add column if not exists quantity integer not null default 1;

alter table bottles
  add column if not exists bottle_type text;

alter table bottles drop constraint if exists bottles_quantity_check;
alter table bottles add constraint bottles_quantity_check check (quantity >= 1);

-- =========================================================
-- 2. PostgRESTのスキーマキャッシュを強制的に再読み込みする
-- =========================================================
notify pgrst, 'reload schema';

-- =========================================================
-- 3. 来店登録: 同伴者0人で「upper bound of FOR loop cannot be null」になる不具合修正
--    （レビュー指摘3）空配列の array_length() は NULL を返すため coalesce で防ぐ。
-- =========================================================
create or replace function public.create_visit_with_details(
  p_customer_id uuid,
  p_is_new_customer boolean,
  p_new_customer_name text,
  p_visited_at timestamptz,
  p_people_count integer,
  p_companion_names text[],
  p_amount integer,
  p_tip integer,
  p_payment_method text,
  p_seat_type text,
  p_receipt_required boolean,
  p_receipt_name text,
  p_memo text,
  p_tag_ids uuid[],
  p_reservation_id uuid,
  p_new_customer_kana text default null,
  p_companion_kanas text[] default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_customer_id uuid;
  v_visit_id uuid;
  v_companion_name text;
  v_companion_kana text;
  v_companion_id uuid;
  v_tag_id uuid;
  v_i integer;
  v_companion_count integer;
begin
  if p_people_count < 1 then
    raise exception '人数は1人以上で入力してください。';
  end if;
  if p_amount < 0 then
    raise exception '会計金額は0円以上で入力してください。';
  end if;
  if p_tip < 0 then
    raise exception 'チップは0円以上で入力してください。';
  end if;

  v_companion_count := coalesce(array_length(p_companion_names, 1), 0);
  if v_companion_count > 10 then
    raise exception '同伴者は最大10名までです。';
  end if;

  if p_receipt_required and (p_receipt_name is null or trim(p_receipt_name) = '') then
    raise exception '領収書が必要な場合は宛名を入力してください。';
  end if;

  if p_is_new_customer then
    if p_new_customer_name is null or trim(p_new_customer_name) = '' then
      raise exception '代表者名を入力してください。';
    end if;
    insert into customers (display_name, kana, created_by)
      values (trim(p_new_customer_name), nullif(trim(coalesce(p_new_customer_kana, '')), ''), auth.uid())
      returning id into v_customer_id;
  else
    if p_customer_id is null then
      raise exception '代表者を選択してください。';
    end if;
    v_customer_id := p_customer_id;
  end if;

  insert into visits (
    primary_customer_id, visited_at, people_count, amount, tip,
    payment_method, seat_type, receipt_required, receipt_name, memo, created_by
  ) values (
    v_customer_id, p_visited_at, p_people_count, p_amount, p_tip,
    p_payment_method, p_seat_type, p_receipt_required,
    case when p_receipt_required then p_receipt_name else null end,
    p_memo, auth.uid()
  ) returning id into v_visit_id;

  insert into visit_members (visit_id, customer_id, member_type)
    values (v_visit_id, v_customer_id, 'primary')
    on conflict (visit_id, customer_id) do nothing;

  if v_companion_count > 0 then
    for v_i in 1..v_companion_count loop
      v_companion_name := p_companion_names[v_i];
      if v_companion_name is null or trim(v_companion_name) = '' then
        continue;
      end if;
      v_companion_kana := case
        when p_companion_kanas is not null and coalesce(array_length(p_companion_kanas, 1), 0) >= v_i
        then nullif(trim(coalesce(p_companion_kanas[v_i], '')), '')
        else null
      end;

      select id into v_companion_id
        from customers
        where display_name = trim(v_companion_name) and hidden = false
        order by created_at asc
        limit 1;

      if v_companion_id is null then
        insert into customers (display_name, kana, created_by)
          values (trim(v_companion_name), v_companion_kana, auth.uid())
          returning id into v_companion_id;
      elsif v_companion_kana is not null then
        update customers set kana = v_companion_kana
          where id = v_companion_id and (kana is null or trim(kana) = '');
      end if;

      insert into visit_members (visit_id, customer_id, member_type)
        values (v_visit_id, v_companion_id, 'companion')
        on conflict (visit_id, customer_id) do nothing;
    end loop;
  end if;

  if coalesce(array_length(p_tag_ids, 1), 0) > 0 then
    foreach v_tag_id in array p_tag_ids loop
      insert into customer_tags (customer_id, tag_id)
        values (v_customer_id, v_tag_id)
        on conflict (customer_id, tag_id) do nothing;
    end loop;
  end if;

  if p_reservation_id is not null then
    update reservations set status = 'visited' where id = p_reservation_id;
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'customer_id', v_customer_id);
end;
$$;

-- =========================================================
-- 4. 予約登録: 同伴者にもふりがなを保存できるようにする（レビュー指摘6）
--    ＋同じ空配列バグの予防的修正
-- =========================================================
drop function if exists public.create_reservation_with_details(
  uuid, boolean, text, timestamptz, integer, text[], boolean, uuid[], text, text
);

create or replace function public.create_reservation_with_details(
  p_customer_id uuid,
  p_is_new_customer boolean,
  p_new_customer_name text,
  p_reserved_at timestamptz,
  p_people_count integer,
  p_companion_names text[],
  p_bottle_plan boolean,
  p_tag_ids uuid[],
  p_memo text,
  p_new_customer_kana text default null,
  p_companion_kanas text[] default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_customer_id uuid;
  v_reservation_id uuid;
  v_companion_name text;
  v_companion_kana text;
  v_companion_id uuid;
  v_tag_id uuid;
  v_i integer;
  v_companion_count integer;
begin
  if p_people_count < 1 then
    raise exception '人数は1人以上で入力してください。';
  end if;

  v_companion_count := coalesce(array_length(p_companion_names, 1), 0);
  if v_companion_count > 10 then
    raise exception '同伴者は最大10名までです。';
  end if;
  if p_reserved_at is null then
    raise exception '予約日時を入力してください。';
  end if;

  if p_is_new_customer then
    if p_new_customer_name is null or trim(p_new_customer_name) = '' then
      raise exception '代表者名を入力してください。';
    end if;
    insert into customers (display_name, kana, created_by)
      values (trim(p_new_customer_name), nullif(trim(coalesce(p_new_customer_kana, '')), ''), auth.uid())
      returning id into v_customer_id;
  else
    if p_customer_id is null then
      raise exception '代表者を選択してください。';
    end if;
    v_customer_id := p_customer_id;
  end if;

  insert into reservations (customer_id, reserved_at, people_count, bottle_plan, memo, created_by)
    values (v_customer_id, p_reserved_at, p_people_count, coalesce(p_bottle_plan, false), p_memo, auth.uid())
    returning id into v_reservation_id;

  if v_companion_count > 0 then
    for v_i in 1..v_companion_count loop
      v_companion_name := p_companion_names[v_i];
      if v_companion_name is null or trim(v_companion_name) = '' then
        continue;
      end if;
      v_companion_kana := case
        when p_companion_kanas is not null and coalesce(array_length(p_companion_kanas, 1), 0) >= v_i
        then nullif(trim(coalesce(p_companion_kanas[v_i], '')), '')
        else null
      end;

      select id into v_companion_id
        from customers
        where display_name = trim(v_companion_name) and hidden = false
        order by created_at asc
        limit 1;

      if v_companion_id is null then
        insert into customers (display_name, kana, created_by)
          values (trim(v_companion_name), v_companion_kana, auth.uid())
          returning id into v_companion_id;
      elsif v_companion_kana is not null then
        update customers set kana = v_companion_kana
          where id = v_companion_id and (kana is null or trim(kana) = '');
      end if;

      insert into reservation_members (reservation_id, customer_id)
        values (v_reservation_id, v_companion_id)
        on conflict do nothing;
    end loop;
  end if;

  if coalesce(array_length(p_tag_ids, 1), 0) > 0 then
    foreach v_tag_id in array p_tag_ids loop
      insert into customer_tags (customer_id, tag_id)
        values (v_customer_id, v_tag_id)
        on conflict (customer_id, tag_id) do nothing;
    end loop;
  end if;

  return jsonb_build_object('reservation_id', v_reservation_id, 'customer_id', v_customer_id);
end;
$$;

-- =========================================================
-- 5. 横断検索: かな正規化ロジックを再宣言（安全のための再アサート）
--    レビュー指摘7: 読み方（ひらがな）が検索対象に確実に入るようにする。
--    同伴者のかなでもヒットするようにする（レビュー指摘5の前提）。
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
        and (
          cc.display_name ilike '%' || q.term || '%'
          or cc.kana ilike '%' || q.term || '%'
          or public.normalize_kana(cc.kana) ilike '%' || public.normalize_kana(q.term) || '%'
        )
      )
    );
$$;

-- 冒頭のDDL変更も含めて確実に反映させるため、末尾でも再度リロードしておく
notify pgrst, 'reload schema';
