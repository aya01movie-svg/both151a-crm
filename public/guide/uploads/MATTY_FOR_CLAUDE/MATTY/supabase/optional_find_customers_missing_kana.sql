-- both151'A CRM: 任意スクリプト（マイグレーション番号なし・手動実行用）
--
-- RC9以前に登録した顧客には kana（読み方）が入っていないため、
-- ひらがな検索にヒットしません。これは仕様上の制約であり、
-- 過去データを自動でふりがな変換することはできません
-- （漢字→読みの自動変換は精度の問題で行っていません）。
--
-- このSQLは「ふりがな未設定の顧客」を一覧化するだけの確認用です。
-- 実際の読み方の入力は、顧客編集画面から手動で行ってください。

select id, display_name, kana, real_name, visit_count, last_visit_at
from customers
where hidden = false
  and (kana is null or trim(kana) = '')
order by visit_count desc, last_visit_at desc nulls last;

-- 来店回数が多い常連客から優先的に、顧客編集画面（/customers/{id}/edit）で
-- ふりがなを入力していくことをお勧めします。
