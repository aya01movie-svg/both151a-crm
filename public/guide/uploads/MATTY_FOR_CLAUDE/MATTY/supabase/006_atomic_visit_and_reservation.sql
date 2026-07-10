-- both151'A CRM RC4
-- 001〜005 の後に実行してください。
--
-- 対応するレビュー指摘:
--   1. 来店登録保存が「DBには一部保存されるがアプリはエラー扱い」になる
--      → 複数テーブルへの個別INSERTを1つのDB関数（1トランザクション）にまとめ、
--        全て成功するか、全て失敗してロールバックされるかのどちらかにする。
--   5〜7. ボトルの種類/ボトルネーム/本数/期限/メモを分離、シャンパン別入力を追加
--   10. 出禁・注意顧客フラグ

-- =========================================================
-- 1. bottles: 種類とボトルネームを分離
-- =========================================================
alter table bottles
  add column if not exists bottle_type text;

comment on column bottles.bottle_type is 'ボトルの種類（銘柄・候補選択または手入力）。bottle_name は個体識別用のボトルネーム。';

-- =========================================================
-- 2. シャンパン別テーブル（第7章指摘: 売上金額には加算せずメモとして記録）
-- =========================================================
create table if not exists champagnes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  visit_id uuid references visits(id) on delete cascade,
  name text not null,
  quantity integer not null default 1 check (quantity >= 1),
  memo text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_champagnes_customer on champagnes (customer_id);
create index if not exists idx_champagnes_visit on champagnes (visit_id);

alter table champagnes enable row level security;

create policy "champagnes select staff" on champagnes
  for select to authenticated using (true);
create policy "champagnes insert staff" on champagnes
  for insert to authenticated with check (true);
create policy "champagnes update staff" on champagnes
  for update to authenticated using (true) with check (true);
create policy "champagnes delete admin only" on champagnes
  for delete to authenticated using (is_admin());

drop trigger if exists trg_audit_champagnes on champagnes;
create trigger trg_audit_champagnes
  after insert or update or delete on champagnes
  for each row execute function public.write_audit_log();

-- =========================================================
-- 3. 出禁・注意顧客フラグ（第10章指摘）
-- =========================================================
alter table customers
  add column if not exists caution_level text not null default 'none'
    check (caution_level in ('none', 'caution', 'banned')),
  add column if not exists caution_reason text,
  add column if not exists caution_registered_at timestamptz,
  add column if not exists caution_registered_by uuid references profiles(id);

comment on column customers.caution_level is '注意/出禁フラグ（none=通常, caution=注意, banned=出禁）';

create index if not exists idx_customers_caution_level
  on customers (caution_level) where caution_level <> 'none';

-- =========================================================
-- 4. 来店登録を1トランザクションで行うDB関数
--    これまでアプリ側で「顧客作成→来店作成→visit_members→タグ→ボトル→予約更新」を
--    個別のSupabase呼び出しで順番に実行しており、途中で失敗すると
--    それまでの変更だけが残ってしまっていた（重複登録の原因）。
--    1つの関数にまとめ、失敗時は自動的に全体がロールバックされるようにする。
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
  p_bottles jsonb,
  p_champagnes jsonb
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
  v_bottle jsonb;
  v_champagne jsonb;
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

  -- 代表者
  if p_is_new_customer then
    if p_new_customer_name is null or trim(p_new_customer_name) = '' then
      raise exception '代表者名を入力してください。';
    end if;
    insert into customers (display_name, created_by)
      values (trim(p_new_customer_name), auth.uid())
      returning id into v_customer_id;
  else
    if p_customer_id is null then
      raise exception '代表者を選択してください。';
    end if;
    v_customer_id := p_customer_id;
  end if;

  v_visit_date := p_visited_at::date;

  -- 来店本体
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

  -- 同伴者（第6章: 同伴者も顧客として登録・検索対象にする）
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

  -- タグ
  if p_tag_ids is not null then
    foreach v_tag_id in array p_tag_ids loop
      insert into customer_tags (customer_id, tag_id)
        values (v_customer_id, v_tag_id)
        on conflict (customer_id, tag_id) do nothing;
    end loop;
  end if;

  -- ボトル（複数本・第4章・第11章・第12章）
  if p_bottles is not null then
    for v_bottle in select * from jsonb_array_elements(p_bottles)
    loop
      if coalesce(v_bottle->>'bottle_name', '') = '' and coalesce(v_bottle->>'bottle_type', '') = '' then
        continue;
      end if;
      insert into bottles (
        customer_id, bottle_type, bottle_name, quantity,
        start_date, expiry_date, memo, created_by
      ) values (
        v_customer_id,
        nullif(v_bottle->>'bottle_type', ''),
        coalesce(nullif(v_bottle->>'bottle_name', ''), v_bottle->>'bottle_type'),
        greatest(1, coalesce((v_bottle->>'quantity')::int, 1)),
        v_visit_date,
        coalesce(
          nullif(v_bottle->>'expiry_date', '')::date,
          (v_visit_date + interval '365 days')::date
        ),
        nullif(v_bottle->>'memo', ''),
        auth.uid()
      );
    end loop;
  end if;

  -- シャンパン（第7章: 売上金額には加算せずメモとして記録するのみ）
  if p_champagnes is not null then
    for v_champagne in select * from jsonb_array_elements(p_champagnes)
    loop
      if coalesce(v_champagne->>'name', '') = '' then
        continue;
      end if;
      insert into champagnes (customer_id, visit_id, name, quantity, memo, created_by)
      values (
        v_customer_id,
        v_visit_id,
        v_champagne->>'name',
        greatest(1, coalesce((v_champagne->>'quantity')::int, 1)),
        nullif(v_champagne->>'memo', ''),
        auth.uid()
      );
    end loop;
  end if;

  -- 予約からの引き継ぎ
  if p_reservation_id is not null then
    update reservations set status = 'visited' where id = p_reservation_id;
  end if;

  return jsonb_build_object('visit_id', v_visit_id, 'customer_id', v_customer_id);
end;
$$;

comment on function public.create_visit_with_details is
  'RC4: 来店登録の全ての関連書き込み（顧客作成・来店・同伴者・タグ・ボトル・シャンパン・予約更新）を1トランザクションで行う。途中で失敗した場合は全体がロールバックされ、部分保存・重複登録を防ぐ。';

-- =========================================================
-- 5. 予約登録も同様に1トランザクション化
-- =========================================================
create or replace function public.create_reservation_with_details(
  p_customer_id uuid,
  p_is_new_customer boolean,
  p_new_customer_name text,
  p_reserved_at timestamptz,
  p_people_count integer,
  p_companion_names text[],
  p_bottle_plan boolean,
  p_tag_ids uuid[],
  p_memo text
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
    insert into customers (display_name, created_by)
      values (trim(p_new_customer_name), auth.uid())
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

comment on function public.create_reservation_with_details is
  'RC4: 予約登録の全ての関連書き込み（顧客作成・予約・同伴者・タグ）を1トランザクションで行う。';
