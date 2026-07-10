-- MATTY v1.1 RC9
-- 016 の後に実行してください。
-- シャンパン登録に金額（amount）カラムを追加します。
-- 既存データがあっても安全です（DEFAULT 0）。

alter table champagnes
  add column if not exists amount integer not null default 0;

comment on column champagnes.amount is 'シャンパン1本あたりの売上金額（円）。0は未入力。';

notify pgrst, 'reload schema';
