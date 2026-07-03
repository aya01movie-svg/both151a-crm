-- both151'A CRM RC7
-- 001〜008 の後に実行してください。
--
-- レビュー指摘⑥⑦: 来店登録・予約登録で新規顧客を作成する際に
-- 「読み方（ふりがな）」も入力・保存できるようにする。

-- 既存シグネチャを明示的に削除してから再作成する
-- （引数を追加すると CREATE OR REPLACE だけでは別オーバーロードとして
--   残ってしまい、PostgREST側の呼び出しが曖昧になるため）
drop function if exists public.create_visit_with_details(
  uuid, boolean, text, timestamptz, integer, text[], integer, integer,
  text, text, boolean, text, text, uuid[], uuid, jsonb, jsonb
);
drop function if exists public.create_reservation_with_details(
  uuid, boolean, text, timestamptz, integer, text[], boolean, uuid[], text
);

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
  p_bottles jsonb,
  p_champagnes jsonb,
  p_new_customer_kana text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_customer_id uuid;
  v_visit_id uuid;
  v_companion_name text;
  v_companion_id uuid;
  v_tag_id uuid;
  v_visit_date date;
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
  if p_companion_names is not null and array_length(p_companion_names, 1) > 10 then
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

  v_visit_date := p_visited_at::date;

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

  if p_companion_names is not null then
    foreach v_companion_name in array p_companion_names loop
      if v_companion_name is null or trim(v_companion_name) = '' then
        continue;
      end if;

      select id into v_companion_id
        from customers
        where display_name = trim(v_companion_name) and hidden = false
        order by created_at asc
        limit 1;

      if v_companion_id is null then
        insert into customers (display_name, created_by)
          values (trim(v_companion_name), auth.uid())
          returning id into v_companion_id;
      end if;

      insert into visit_members (visit_id, customer_id, member_type)
        values (v_visit_id, v_companion_id, 'companion')
        on conflict (visit_id, customer_id) do nothing;
    end loop;
  end if;

  if p_tag_ids is not null then
    foreach v_tag_id in array p_tag_ids loop
      insert into customer_tags (customer_id, tag_id)
        values (v_customer_id, v_tag_id)
        on conflict (customer_id, tag_id) do nothing;
    end loop;
  end if;

  -- RC7: ボトル・シャンパンはアプリ側の個別INSERT経路で保存するため、
  -- このDB関数では扱わない（p_bottles/p_champagnesは互換性のため引数のみ残す）。

  if p_reservation_id is not null then
    update reservations set status = 'visited' where id = p_reservation_id;
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'customer_id', v_customer_id);
end;
$$;

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
  p_new_customer_kana text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_customer_id uuid;
  v_reservation_id uuid;
  v_companion_name text;
  v_companion_id uuid;
  v_tag_id uuid;
begin
  if p_people_count < 1 then
    raise exception '人数は1人以上で入力してください。';
  end if;
  if p_companion_names is not null and array_length(p_companion_names, 1) > 10 then
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

  if p_companion_names is not null then
    foreach v_companion_name in array p_companion_names loop
      if v_companion_name is null or trim(v_companion_name) = '' then
        continue;
      end if;

      select id into v_companion_id
        from customers
        where display_name = trim(v_companion_name) and hidden = false
        order by created_at asc
        limit 1;

      if v_companion_id is null then
        insert into customers (display_name, created_by)
          values (trim(v_companion_name), auth.uid())
          returning id into v_companion_id;
      end if;

      insert into reservation_members (reservation_id, customer_id)
        values (v_reservation_id, v_companion_id)
        on conflict do nothing;
    end loop;
  end if;

  if p_tag_ids is not null then
    foreach v_tag_id in array p_tag_ids loop
      insert into customer_tags (customer_id, tag_id)
        values (v_customer_id, v_tag_id)
        on conflict (customer_id, tag_id) do nothing;
    end loop;
  end if;

  return jsonb_build_object('reservation_id', v_reservation_id, 'customer_id', v_customer_id);
end;
$$;
