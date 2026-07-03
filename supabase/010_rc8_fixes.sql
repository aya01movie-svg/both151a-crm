-- both151'A CRM RC8
-- 001〜009 の後に実行してください。
--
-- レビュー指摘1: 来店登録保存の安定性を最優先するため、
--   ボトル・シャンパンの保存を来店登録の保存処理から完全に切り離す
--   （顧客詳細の「ボトル追加」からのみ登録する設計に変更）。
-- レビュー指摘3・9: 同伴者にも「ふりがな」を入力・保存できるようにする。

drop function if exists public.create_visit_with_details(
  uuid, boolean, text, timestamptz, integer, text[], integer, integer,
  text, text, boolean, text, text, uuid[], uuid, jsonb, jsonb, text
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
    for v_i in 1..array_length(p_companion_names, 1) loop
      v_companion_name := p_companion_names[v_i];
      if v_companion_name is null or trim(v_companion_name) = '' then
        continue;
      end if;
      v_companion_kana := case
        when p_companion_kanas is not null and array_length(p_companion_kanas, 1) >= v_i
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

  if p_tag_ids is not null then
    foreach v_tag_id in array p_tag_ids loop
      insert into customer_tags (customer_id, tag_id)
        values (v_customer_id, v_tag_id)
        on conflict (customer_id, tag_id) do nothing;
    end loop;
  end if;

  -- RC8: ボトル・シャンパンはこの関数では扱わない
  -- （顧客詳細の「ボトル追加」からのみ登録する設計に変更したため）。

  if p_reservation_id is not null then
    update reservations set status = 'visited' where id = p_reservation_id;
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'customer_id', v_customer_id);
end;
$$;

comment on function public.create_visit_with_details is
  'RC8: 来店登録の保存（顧客作成・来店・同伴者・タグ・予約更新）を1トランザクションで行う。ボトル・シャンパンは扱わない（顧客詳細の「ボトル追加」から別途登録する設計）。';
