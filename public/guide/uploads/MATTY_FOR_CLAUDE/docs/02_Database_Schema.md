# 02_Database_Schema — MATTY データベース仕様書

Supabase（PostgreSQL）。マイグレーションファイルは `supabase/*.sql`
（`001_initial_schema.sql` 〜 `017_rc9_champagne_amount.sql` の連番＋
`optional_*.sql` の任意スクリプト）。

---

## 1. テーブル一覧と役割

| テーブル | 役割 |
|---|---|
| `profiles` | ログインスタッフのプロフィール（`display_name`, `role`）。`auth.users` と1:1。 |
| `customers` | 顧客マスタ。累計来店回数・累計売上等の集計値もここにキャッシュされる（後述トリガー参照）。 |
| `customer_aliases` | 顧客の別名（旧姓・源氏名など）。検索対象に含まれる。 |
| `tags` | タグマスタ（管理者のみ追加・削除可）。 |
| `customer_tags` | 顧客×タグの中間テーブル。 |
| `visits` | 来店記録。1来店＝1行（代表顧客＝会計の主体）。金額・チップ・支払方法・
  無効化フラグ等を持つ。 |
| `visit_members` | 来店の同伴者（`member_type = "companion"`）を紐付ける中間テーブル。 |
| `bottles` | ボトルキープ記録。`status`（kept/finished/returned等）、`created_at`（＝登録日時、
  「初回🍷」判定の基準）。 |
| `reservations` | 予約記録。`status`（reserved/visited/cancelled）。 |
| `reservation_members` | 予約の同伴者。 |
| `notes` | 顧客メモ。`invalidated`フラグで無効化可能（**更新は管理者のみ**、後述RLS参照）。 |
| `audit_logs` | 変更履歴（設定ページ「変更履歴」に表示）。 |
| `champagnes` | シャンパン注文記録（来店に紐づく）。 |
| `closed_days` | 店休日（日付＋メモ）。 |
| `store_events` | イベント・スタッフ休み共通テーブル（`event_type`で区別。詳細は3節）。 |
| `holidays` | 祝日マスタ。 |

---

## 2. Supabase特有のルール

### 2.1 Row Level Security（RLS）

全テーブルでRLSを有効化。基本パターン：

- **select/insert/update**：`authenticated`ロールなら（＝ログイン済みスタッフなら）
  基本的に許可（`using (true)`）。
- **delete**：多くのテーブルで `is_admin()` 関数を使い**管理者のみ**に制限。
- **例外パターンあり**：
  - `notes` の **update** は管理者のみ（`007_rc5_fixes.sql`）。
    メモの「無効化」ボタンが管理者専用になる理由。
  - `visits` の **update** はスタッフ全員に許可（`002_aggregates_and_rls.sql`）。
    来店の修正・無効化（`invalidated`更新含む）はスタッフなら誰でも可能。
  - `tags` の insert/update/delete は管理者のみ。
  - `customers` の delete は管理者のみ（編集・非表示化はスタッフ可）。
  - `profiles.role` の変更は管理者のみ（`enforce_profile_role_admin_only`
    トリガーで二重に保護）。
  - `customers.rank` の変更も管理者のみ（`enforce_customer_rank_admin_only`
    トリガー）。

`is_admin()` 関数：現在ログイン中ユーザーの `profiles.role = 'admin'` かを
判定するSQL関数。RLSポリシー内で頻用。

### 2.2 トリガーによる自動計算（重要）

Supabase側で「保存すると自動的に再計算される」値がいくつかある。
アプリ側のコードで手動計算・手動更新する必要はない。

#### `customers` の集計カラム（`002_aggregates_and_rls.sql`）
```
visit_count       -- 累計来店回数（無効化された来店は除く）
total_amount      -- 累計売上
total_tip         -- 累計チップ
first_visit_at    -- 初回来店日時
last_visit_at     -- 最終来店日時
```
`visits`テーブルの **INSERT / UPDATE（会計金額・チップ・無効化フラグの
編集を含む）/ DELETE すべて**で `trg_visits_recalculate_stats` トリガーが
発火し、`recalculate_customer_visit_stats(customer_id)` 関数が上記カラムを
再計算する。

→ **来店を無効化（`invalidated = true`に更新）すると、この一手だけで
顧客の累計来店回数・累計売上等が自動的に正しい値へ更新される**
（アプリ側で追加の再計算コードを書く必要はない）。

#### `customers.current_bottle_count`
`bottles`テーブルのINSERT/UPDATE/DELETEで`trg_bottles_recalculate_count`
トリガーが発火し、`status = 'kept'`（預かり中）のボトル本数を再計算する。

#### 月次集計（`customer_month_stats` ビュー）
月次の来店回数・売上・チップは、顧客カラムに保存せず**ビューとして
都度算出**する設計（月替わりのリセット処理が不要になるため）。
`visited_at`を当月で絞り込み、`invalidated = false`のみ集計。

### 2.3 `store_events` テーブルの設計（イベント・スタッフ休み共通）

| カラム | 説明 |
|---|---|
| `event_type` | `"staff"`（スタッフ休み）または `"other"`（通常イベント） |
| `schedule_type` | `"single"`（1日）／`"range"`（期間）／`"weekly"`（毎週）／`"annual"`（毎年） |
| `title` | イベント名。スタッフ休みは常に`"休"`固定で保存される運用。 |
| `emoji` | 表示絵文字。スタッフ休みは動物絵文字（🐑/🐯/🐰）のみ。通常イベントは
  基本的に空文字（絵文字を使いたい場合はユーザーが`title`に直接入力する）。 |
| `weekly_day` | `schedule_type = "weekly"`のとき使用。0=日曜〜6=土曜。 |
| `start_date` / `end_date` | 単日・期間イベントの日付。 |
| `annual_month` / `annual_day` | 毎年イベントの月日。 |
| `url` | 任意。設定するとタイトルがリンクになる。 |
| `is_active` | 論理削除フラグ（削除ボタンで`false`に更新。物理削除はしない）。 |

**表示側の正規化について（重要・アプリ側の設計）：**
過去のバグにより、`store_events`テーブルには以下のような「本来の
仕様と異なる値」が残っている可能性がある：
- スタッフ休みなのに `emoji = "🐑🚫"` や `title = "スタッフAお休み"`
  のような文言が保存されている行（古いテスト登録データ）
- 通常イベントなのに `emoji = "📅"` が自動付与されている行
  （絵文字選択UIが存在した時期がなく、この値は100%自動付与バグによるもの
  と判断できる）

これらは**データベースの値そのものは書き換えず**、一覧取得関数
`listStoreEvents()`（`src/lib/data/events.ts`）内の`normalizeEvent()`で
「表示側だけ」正規化している：
- `event_type === "staff"` の行 → `emoji`は動物1文字のみ抽出、
  `title`は常に`"休"`に強制上書きして返す
- `emoji === "📅"` の行（スタッフ休み以外） → `emoji`を空文字にして返す

この関数は全消費先（設定ページのイベント管理、お知らせページ、
カレンダー月表示）から共通で呼ばれるため、1箇所の修正で全画面に反映される。

→ **もし将来的にDBの値そのものをクリーンにしたい場合**（例：他システムが
`store_events`を直接参照する等）は、以下のようなクリーンアップSQLを
別途実行することも可能（現時点では未実行・不要）：
```sql
update store_events set title = '休' where event_type = 'staff';
update store_events set emoji = left(emoji, 2) where event_type = 'staff'; -- 動物部分のみ残す等、要調整
update store_events set emoji = '' where emoji = '📅' and event_type <> 'staff';
```
（実行前に必ずバックアップ・要件再確認をすること）

### 2.4 来店登録の作成はRPC経由

新規来店登録（同伴者・タグ・顧客新規作成・予約ステータス更新を含む
複合処理）は、`create_visit_with_details` というSQL関数（RPC）を
`supabase.rpc()`経由で呼び出す方式。複数テーブルにまたがる処理を
アトミックに行うための設計（`006_atomic_visit_and_reservation.sql`）。

一方、**来店の「修正」「無効化」機能（v1.2で追加）は、このRPCを使わず、
`visits`テーブル自身のカラムのみを対象にした直接UPDATEで実装**している
（`src/lib/data/visits.ts`の`updateVisit()`/`invalidateVisit()`）。
理由：同伴者・タグの変更は複数テーブルにまたがり複雑なため、まずは
「入力ミスの多い基本項目（日時・金額・チップ・支払方法・席タイプ・
領収書・メモ）」の修正に対応を限定する設計判断とした。同伴者・タグの
修正機能を追加する場合は、既存のRPCを拡張するか、別途専用のRPCを
新設する必要がある（03_AI_Guidelines.md「複雑な多対多更新の扱い」も参照）。

### 2.5 検索（`search_customers` SQL関数）

`003_search_and_views.sql`で定義、`015`・`016`で拡張。trigramインデックスを
使用し、以下を横断検索する：
- `display_name`, `kana`, `real_name`, `memo`, `customer_aliases`
- タグ名
- ボトル名（`bottles.bottle_name`）
- 来店メモ・同伴者名

顧客一覧・HOME検索窓はいずれもこの関数を`supabase.rpc()`経由で呼ぶ
（`listCustomers({ search })`）。

---

## 3. 今回（v1.2）の修正でのバックエンド挙動まとめ

| 機能 | DB変更 | 挙動 |
|---|---|---|
| 来店の修正 | なし | `visits`テーブルの直接UPDATE。RLSは`update staff`のため
  管理者でなくても実行可能。 |
| 来店の無効化 | なし | `visits.invalidated = true`に更新。既存トリガーにより
  `customers`の集計値が自動再計算される。 |
| 顧客の無効化ボタン削除 | なし | UIから削除しただけ。`customers.hidden`カラム自体・
  RLSポリシーは変更していない（データ構造は温存）。 |
| スタッフ休み表記統一 | なし | `listStoreEvents()`での表示側正規化のみ。 |
| イベント絵文字自動付与バグ | なし | 同上。新規保存時のデフォルト値自体も
  空文字に修正済み（今後は不正データが増えない）。 |
| HOME売上合計バグ修正 | なし | カレンダーデータ取得クエリ（`invalidated = false`
  条件）は元々正しく実装されていた。フロントエンド側の表示ロジックの
  バグ（選択日と連動していなかった）を修正。 |

**今回のv1.2一連の修正を通じて、SQLマイグレーション・DBスキーマ変更は
一度も発生していない。** すべてアプリケーション層（Next.js側）の
修正で完結している。
