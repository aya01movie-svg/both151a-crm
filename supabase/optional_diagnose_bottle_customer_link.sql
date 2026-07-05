-- =====================================================================
-- MATTY v1.1: ボトル紐づき確認・修正SQL
-- =====================================================================
-- 実行前に必ずバックアップを取ってください。
-- Supabase SQL Editor で実行してください。

-- =====================================================================
-- 【Step 1】現在のボトル状況を確認する
-- =====================================================================

-- ▼ ボトルが登録されているが顧客一覧に出ない場合の確認
-- bottles.customer_id と customers.id が正しく紐付いているか確認する
select
  b.id as bottle_id,
  b.bottle_name,
  b.bottle_type,
  b.customer_id as bottle_customer_id,
  c.display_name as customer_name,
  c.id as customer_id_in_customers,
  case when c.id is null then '⚠️ 顧客が存在しない' else '✓ OK' end as status
from bottles b
left join customers c on c.id = b.customer_id
order by b.created_at desc
limit 50;

-- =====================================================================
-- 【Step 2】search_customers関数がボトルを検索できるか確認
-- =====================================================================

-- 例: 'ボトル名' を実際のボトル名に変えて実行してください
-- select * from search_customers('鏡月');

-- =====================================================================
-- 【Step 3】同伴者に紐づいているべきボトルが代表者に紐づいていないか確認
-- =====================================================================

-- 来店に同伴者として参加した顧客のボトルを確認
-- （来店来店した顧客としてボトルを持つが、visit_membersではcompanionになっている）
select distinct
  c.id,
  c.display_name,
  count(b.id) as bottle_count,
  'companion' as usual_role
from customers c
join visit_members vm on vm.customer_id = c.id and vm.member_type = 'companion'
join bottles b on b.customer_id = c.id
group by c.id, c.display_name
order by bottle_count desc
limit 20;

-- =====================================================================
-- 【Step 4】もしRC8以前のデータでボトルが代表者に紐付いているならば
-- 手動で移し替えるSQL（実行前に上記で確認すること）
-- =====================================================================

-- ⚠️ このSQLは確認後にのみ実行してください。
-- 特定の来店IDに対して、代表者のボトルを同伴者に移す例:
-- （このままでは実行できません。実際の customer_id を入れてください）

/*
-- 例: bottle_id が '...' のボトルを customer_id '...' に移す
UPDATE bottles
SET customer_id = '同伴者のcustomer_id'
WHERE id = 'bottle_id';
*/

-- =====================================================================
-- 【Step 5】search_customers 関数の動作確認
-- =====================================================================
-- 以下を実行して、ボトル検索が機能しているか確認する
-- (014_rc4_companion_birthday.sql を適用済みの場合)

-- select * from search_customers('鏡月');
-- select * from search_customers('ジャックダニエル');
