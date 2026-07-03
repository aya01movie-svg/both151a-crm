-- both151'A CRM RC2: ボトル本数カラムの追加
-- 001〜004 の後に実行してください。
--
-- 対応するレビュー指摘:
--   来店登録画面のボトル欄に「本数」を追加してほしい

alter table bottles
  add column if not exists quantity integer not null default 1 check (quantity >= 1);

comment on column bottles.quantity is '預かり本数（来店登録・ボトル管理画面から指定）';
