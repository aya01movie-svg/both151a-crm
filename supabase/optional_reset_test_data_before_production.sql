-- ============================================================================
-- 本番開始前だけ実行してください（完全削除・元に戻せません）
-- ============================================================================
--
-- このSQLは、試作・動作確認中に入力したテストデータをすべて削除し、
-- 本番運用を「まっさらな状態」から始めるためのものです。
--
-- 【削除されるもの】
--   来店履歴 / 同伴者履歴 / 予約 / 予約同伴者 / ボトル / メモ /
--   顧客 / 最近見た顧客 / 監査ログ / シャンパン記録
--   （タグは既定では削除しません。削除したい場合のみ末尾のブロックを有効にしてください）
--
-- 【削除されないもの（残ります）】
--   スタッフ・ログインユーザー（Supabase Authのアカウント）/ profiles
--   RLSポリシー / テーブル構造 / DB関数 / マイグレーション履歴 / 管理者権限
--
-- 【実行方法】
--   1. 内容を確認する
--   2. 直下の safety-stop ブロックを削除する（誤操作防止のためコメントアウトしていません）
--   3. Supabaseダッシュボード → SQL Editor で実行する
--
-- 本番運用が始まった後は、このファイルを実行しないでください。

do $$
begin
  raise exception 'このSQLは本番開始前の1回だけ実行するためのものです。実行する場合は、この safety-stop ブロック（この do $$ ... $$ 部分）を削除してから再実行してください。';
end;
$$;

-- ここから下が実際の削除処理です（上のブロックを削除すると実行されます）

begin;

-- 依存関係の子テーブルから先に削除する（外部キー制約に配慮した順序）
delete from customer_views;
delete from audit_logs;
delete from champagnes;
delete from visit_members;
delete from reservation_members;
delete from customer_tags;
delete from notes;
delete from bottles;
delete from visits;
delete from reservations;
delete from customer_aliases;
delete from customers;

-- タグは既定では残します。タグも削除したい場合のみ、以下の1行のコメントを外してください。
-- delete from tags;

commit;

-- 削除件数の確認（0件になっていればOK）
select
  (select count(*) from customers) as customers,
  (select count(*) from visits) as visits,
  (select count(*) from reservations) as reservations,
  (select count(*) from bottles) as bottles,
  (select count(*) from notes) as notes,
  (select count(*) from customer_views) as customer_views,
  (select count(*) from audit_logs) as audit_logs,
  (select count(*) from champagnes) as champagnes,
  (select count(*) from tags) as tags_remaining,
  (select count(*) from profiles) as staff_profiles_kept;
