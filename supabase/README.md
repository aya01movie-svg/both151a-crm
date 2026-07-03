# Supabase セットアップ手順（Final版）

## 1. プロジェクト作成
1. https://supabase.com でプロジェクトを新規作成
2. Settings → API から以下をコピー
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - 例: `https://xxxxx.supabase.co`（末尾に `/rest/v1` を付けないでください）
   - anon public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. アプリの `.env.local` に貼り付け（`.env.local.example` を参照）

> URLに `/rest/v1` が含まれたままログインしようとすると、ログイン画面に
> 「Supabase URLの末尾に /rest/v1 が含まれています」という分かりやすいエラーが表示されます（RC2で追加）。

## 2. スキーマ適用
Supabaseダッシュボードの SQL Editor で、**必ずこの順番**で実行してください。

1. `001_initial_schema.sql` — テーブル・インデックス・updated_atトリガー・RLS有効化・仮ポリシー
2. `002_aggregates_and_rls.sql` — 集計カラム・再計算トリガー・権限別RLSポリシーへの置き換え
3. `003_search_and_views.sql` — 検索用インデックス（pg_trgm）・横断検索関数・最近見た顧客テーブル
4. `004_audit_log_triggers.sql` — 監査ログ自動記録トリガー（customers/visits/bottles/reservations/tags）
5. `005_bottle_quantity.sql` — ボトル本数カラムの追加（RC2）
6. `006_atomic_visit_and_reservation.sql` — 来店登録・予約登録のアトミック化、ボトル種類/シャンパン別入力、出禁・注意顧客フラグ（RC4）
7. `007_rc5_fixes.sql` — 同伴者の来店集計反映、メモ無効化、横断検索の対象拡大、タグ作成をスタッフに開放、一覧の安定ソート（RC5）
8. `008_rc6_fixes.sql` — かな正規化（ひらがな/カタカナ横断検索）（RC6）
9. `009_rc7_fixes.sql` — 来店登録・予約登録での新規顧客ふりがな入力に対応（RC7）
10. `010_rc8_fixes.sql` — 来店登録からボトル・シャンパン処理を分離、同伴者のふりがな対応（RC8・最重要）
11. `011_rc9_fixes.sql` — bottles.quantity列の再保証+スキーマキャッシュ再読込、同伴者0人時のFORループ不具合修正、予約の同伴者ふりがな、かな検索の再アサート（RC9・最重要）

CLIを使う場合:

```bash
supabase link --project-ref your-project-ref
supabase db push
```

（`supabase/migrations` 形式にリネームして使う場合は、ファイル名の先頭にタイムスタンプを付与してください。例: `20260702000001_initial_schema.sql`）

## 3. 最初の管理者アカウント作成
1. Supabaseダッシュボード → Authentication → Users → "Add user" でメール・パスワードを発行
   （`002_aggregates_and_rls.sql` のトリガーにより `profiles` 行が自動作成され、初期roleは `staff` になります）
2. SQL Editor で最初の管理者だけ手動で昇格させます:

```sql
update profiles set role = 'admin' where id = '作成したユーザーのUUID';
```

以降の管理者昇格は、設定画面（`/settings`）のスタッフ管理から行えます。

## 4. 動作確認
`profiles` テーブルにログイン用アカウントの行があることを確認してから、
アプリの `/login` でログインしてください。

## 5. 複数スタッフ同時作業について（RC5）

both151'A CRM は複数スタッフが同時に同じ端末・別の端末から操作することを前提に設計しています。

- **同時更新の方針**: 最後に保存された内容を優先します（last-write-wins）。楽観ロックや排他制御は行っていません。同じ来店・予約・顧客情報を複数人がほぼ同時に編集した場合、後から保存した内容が残ります。
- **変更履歴の保持**: customers / visits / bottles / reservations / tags / champagnes への追加・変更・削除は監査ログ（`audit_logs`）に自動記録されます（004参照）。競合が発生しても、どちらの変更が行われたかは監査ログから追跡できます。
- **重要データの削除**: 来店履歴・予約・ボトル・顧客は基本的に完全削除せず、無効化（invalidated/hidden/status変更）で扱います。完全削除はDB操作可能な管理者のみに限定しています。
- **集計値の再計算**: 来店回数・売上・チップなどの集計はDBトリガーで自動再計算されるため、複数人が同時に来店登録しても集計値が壊れることはありません。
- **今後の課題**: 同一顧客・同一来店データへの秒単位の同時編集について、ユーザーへの競合通知（「他のスタッフが更新しました」等）は現時点では実装していません。運用上問題が出る場合はご相談ください。

## 6. 過去データのふりがな未設定について

RC9でひらがな/カタカナ横断検索に対応しましたが、これは`customers.kana`（読み方）が
入力されているデータにのみ有効です。それより前に登録した顧客は`kana`が空の場合があり、
ひらがなで検索してもヒットしません。

`optional_find_customers_missing_kana.sql` を実行すると、読み方が未設定の顧客を
来店回数の多い順に一覧できます。常連客から優先的に、顧客編集画面
（`/customers/{id}/edit`）で読み方を補完していくことをお勧めします。
