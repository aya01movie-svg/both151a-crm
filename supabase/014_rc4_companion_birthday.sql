-- MATTY v1.1 RC4
-- 013 の後に実行してください。
-- 来店登録時の同伴者誕生日入力に対応するため、
-- create_visit_with_details 関数に p_companion_birthdays 引数を追加します。

drop function if exists public.create_visit_with_details(
  uuid, boolean, text, timestamptz, integer, text[], integer, integer,
  text, text, boolean, text, text, uuid[], uuid, text, text[], text[]
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
  p_new_customer_birthday date default null,
  p_companion_kanas text[] default null,
  p_companion_birthdays text[] default null   -- 追加: 2000-MM-DD 形式、未入力は空文字
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
  v_companion_birthday date;
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
    insert into customers (display_name, kana, birthday, created_by)
      values (
        trim(p_new_customer_name),
        nullif(trim(coalesce(p_new_customer_kana, '')), ''),
        p_new_customer_birthday,
        auth.uid()
      )
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
      -- 誕生日: 空文字や無効な文字列は NULL にする
      begin
        v_companion_birthday := case
          when p_companion_birthdays is not null
            and coalesce(array_length(p_companion_birthdays, 1), 0) >= v_i
            and p_companion_birthdays[v_i] is not null
            and length(trim(p_companion_birthdays[v_i])) = 10
          then trim(p_companion_birthdays[v_i])::date
          else null
        end;
      exception when others then
        v_companion_birthday := null;
      end;

      select id into v_companion_id
        from customers
        where display_name = trim(v_companion_name) and hidden = false
        order by created_at asc
        limit 1;

      if v_companion_id is null then
        insert into customers (display_name, kana, birthday, created_by)
          values (trim(v_companion_name), v_companion_kana, v_companion_birthday, auth.uid())
          returning id into v_companion_id;
      else
        -- 既存顧客にkana未設定なら補完、誕生日も同様に補完
        if v_companion_kana is not null then
          update customers set kana = v_companion_kana
            where id = v_companion_id and (kana is null or trim(kana) = '');
        end if;
        if v_companion_birthday is not null then
          update customers set birthday = v_companion_birthday
            where id = v_companion_id and birthday is null;
        end if;
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

notify pgrst, 'reload schema';

-- =========================================================
-- search_customers 関数の明示的な再作成（ボトル検索復旧）
-- RC9で定義済みの内容を再アサートして確実に最新版を適用する
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
          and (b.bottle_name ilike '%' || q.term || '%'
            or (b.bottle_type is not null and b.bottle_type ilike '%' || q.term || '%'))
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

notify pgrst, 'reload schema';
