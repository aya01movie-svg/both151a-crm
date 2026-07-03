-- both151'A CRM Phase D: 監査ログ自動記録
-- 001, 002, 003 の後に実行してください。
--
-- 対応する仕様書の章:
--   第24章 監査ログ（変更履歴）
--   第32章 権限管理

-- =========================================================
-- 1. 汎用監査ログ記録関数
--    customers / visits / bottles / reservations / tags の
--    INSERT・UPDATE・DELETE を自動的に audit_logs へ記録する。
--    アプリ側でのログ書き忘れを防ぐため、DBトリガーで一元管理する。
-- =========================================================
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_record_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if TG_OP = 'DELETE' then
    v_record_id := OLD.id;
    v_before := to_jsonb(OLD);
    v_after := null;
  elsif TG_OP = 'INSERT' then
    v_record_id := NEW.id;
    v_before := null;
    v_after := to_jsonb(NEW);
  else
    v_record_id := NEW.id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  end if;

  insert into audit_logs (
    table_name, record_id, action, actor_id, before_data, after_data
  ) values (
    TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_before, v_after
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_audit_customers on customers;
create trigger trg_audit_customers
  after insert or update or delete on customers
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_visits on visits;
create trigger trg_audit_visits
  after insert or update or delete on visits
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_bottles on bottles;
create trigger trg_audit_bottles
  after insert or update or delete on bottles
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_reservations on reservations;
create trigger trg_audit_reservations
  after insert or update or delete on reservations
  for each row execute function public.write_audit_log();

drop trigger if exists trg_audit_tags on tags;
create trigger trg_audit_tags
  after insert or update or delete on tags
  for each row execute function public.write_audit_log();

-- =========================================================
-- 2. audit_logs 用インデックス（一覧表示・対象レコード検索の高速化）
-- =========================================================
create index if not exists idx_audit_logs_created_at on audit_logs (created_at desc);
create index if not exists idx_audit_logs_table_record on audit_logs (table_name, record_id);
