# both151'A CRM

飲食店（バー・スナック）向け顧客管理システム。
営業中でも30秒以内で来店登録できることを最優先に設計。

**現在のバージョン: Final（RC9の内容を正式版としたもの）**

---

## 目次

1. [主な機能](#主な機能)
2. [技術スタック](#技術スタック)
3. [ディレクトリ構成](#ディレクトリ構成)
4. [セットアップ手順（ローカル開発）](#セットアップ手順ローカル開発)
5. [DBマイグレーション一覧](#dbマイグレーション一覧)
6. [本番公開手順](#本番公開手順)
7. [バックアップ方法](#バックアップ方法)
8. [権限について](#権限について)
9. [既知の制約・注意点](#既知の制約注意点)
10. [今後のv1.1候補](#今後のv11候補)

---

## 主な機能

- スタッフごとのログイン（Supabase Auth）、一般スタッフ / 管理者の権限分離
- 顧客登録・編集・無効化（論理削除）、お気に入り、出禁・注意フラグ
- 来店登録（代表者・同伴者・カウンター/BOX・支払方法・タグ・領収書・メモ）
  - 同伴者は自動的に顧客マスターへ登録され、次回以降は代表者としても選択可能
  - 「前回来店をコピー」機能
- 顧客検索（登録名・ふりがな・本名・タグ・メモ・領収書宛名・来店内容など横断検索、ひらがな/カタカナ表記ゆれ対応）
- オフライン時はIndexedDBに保存した直近1000件のキャッシュから検索可能
- 予約管理（予約 → 来店登録への引き継ぎ、同伴者・タグ対応）
- ボトル管理（種類・ボトルネーム・本数・期限、期限による色分け、状態変更）
- 顧客タイムライン（来店・ボトル追加・予約・メモ追加を時系列表示）
- カレンダー（月間ビュー、来店・予約・誕生日・ボトル期限・売上/チップ集計）
- ダッシュボード（本日/今月の売上・チップ、期限アラート、誕生日、来店ペース分析）
- CSV出力（顧客一覧・来店履歴・ボトル一覧・予約一覧、管理者限定）
- 監査ログ（変更履歴の自動記録、管理者限定閲覧）
- オフライン一時保存（来店登録・予約登録・メモ入力、通信復旧後に自動同期）
- PWA対応（ホーム画面への追加）

## 技術スタック

- Next.js 16 (App Router, Turbopack) / React 19 / TypeScript
- Tailwind CSS v4
- Supabase（PostgreSQL / Auth / Realtime基盤 / Row Level Security）
- PWA（Service Worker・Web App Manifest）

## ディレクトリ構成

```
src/
  app/                       # 画面（App Router）
    login/                   # ログイン
    dashboard/                # ホーム
    visits/new/                # 来店登録
    customers/                  # 顧客一覧・新規登録・詳細・編集
    search/                      # 顧客検索
    reservations/                 # 予約管理
    bottles/                       # ボトル管理
    calendar/                       # カレンダー
    settings/                        # 設定（タグ・スタッフ管理・CSV出力・監査ログ）
    api/export/                       # CSV出力APIルート
  components/
    layout/                    # Header / SideNav / BottomNav / AppShell / オフライン関連
    ui/                          # Button / Card / TextField
    customers/ visits/ reservations/ bottles/ calendar/ settings/ search/
  lib/
    supabase/                    # client.ts / server.ts / middleware.ts
    auth/                          # ログイン/ログアウト・現在ユーザー取得
    data/                            # DBアクセス層（画面ごとのデータ取得関数）
    actions/                          # Server Actions（保存・更新処理）
    offline/                            # オフラインキュー・顧客検索キャッシュ
    date.ts                              # 日付・日本時間(JST)変換ユーティリティ
    pace.ts bottle-expiry.ts bottle-types.ts error-message.ts csv.ts
  types/
    database.ts                          # Supabase型定義
supabase/
  001〜011_*.sql                          # マイグレーション（下記参照）
  README.md                               # Supabaseセットアップ・運用方針
  optional_find_customers_missing_kana.sql  # 任意の確認用スクリプト
```

## セットアップ手順（ローカル開発）

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

```bash
cp .env.local.example .env.local
```

`.env.local` にSupabaseプロジェクトの実際のURL・anonキーを設定してください
（`.env.local.example` に取得方法を記載しています）。

### 3. Supabaseスキーマの適用

`supabase/README.md` の手順に従い、`supabase/001_initial_schema.sql` から
`supabase/011_rc9_fixes.sql` まで、**番号順に**SQL Editorで実行してください。

### 4. 最初の管理者アカウント作成

`supabase/README.md`「3. 最初の管理者アカウント作成」を参照してください。

### 5. 開発サーバー起動

```bash
npm run dev
```

http://localhost:3000 を開くと `/login` にリダイレクトされます。

### 6. 動作確認用コマンド

```bash
npx tsc --noEmit   # 型チェック
npx eslint .        # Lint
npm run build        # 本番ビルド確認
```

## DBマイグレーション一覧

`supabase/` 内のSQLファイルを **001から011まで、必ず番号順に** Supabase SQL Editorで実行してください。

| # | ファイル | 内容 |
|---|---|---|
| 001 | `001_initial_schema.sql` | ベーステーブル・インデックス・RLS有効化（初期スキーマ） |
| 002 | `002_aggregates_and_rls.sql` | 来店/ボトル集計カラムの自動再計算トリガー、権限別RLS（一般スタッフ/管理者） |
| 003 | `003_search_and_views.sql` | 検索用trigramインデックス、`search_customers()`関数、最近見た顧客テーブル |
| 004 | `004_audit_log_triggers.sql` | 監査ログ自動記録トリガー |
| 005 | `005_bottle_quantity.sql` | ボトル本数カラム追加 |
| 006 | `006_atomic_visit_and_reservation.sql` | 来店・予約登録のアトミック化、ボトル種類/シャンパン別入力、出禁・注意フラグ |
| 007 | `007_rc5_fixes.sql` | 同伴者の来店集計反映、メモ無効化、検索対象拡大、タグ作成権限緩和、一覧の安定ソート |
| 008 | `008_rc6_fixes.sql` | かな正規化（ひらがな/カタカナ横断検索） |
| 009 | `009_rc7_fixes.sql` | 来店・予約登録での新規顧客ふりがな入力対応 |
| 010 | `010_rc8_fixes.sql` | 来店登録からボトル・シャンパン処理を分離（安定性優先の設計変更）、同伴者ふりがな対応 |
| 011 | `011_rc9_fixes.sql` | **最重要**：bottles.quantity列の保証+スキーマキャッシュ再読込、同伴者0人時のFORループ不具合修正、予約の同伴者ふりがな、かな検索の再アサート |

すべて `IF NOT EXISTS` / `CREATE OR REPLACE` ベースで書かれているため、既存データがある状態で再実行しても安全です。

## 本番公開手順

このリポジトリはNext.js標準構成のため、Vercel等のNext.js対応ホスティングにそのままデプロイできます。

1. **Supabase側の準備**
   - 本番用Supabaseプロジェクトを作成（開発用と分けることを推奨）
   - `supabase/001`〜`011`を番号順に適用
   - Authentication → Users からスタッフアカウントを発行し、`profiles.role`を`admin`に昇格（`supabase/README.md`参照）
   - Authentication → Settings でセッション有効期限（JWT expiry）を運用方針に合わせて設定（第10章レビュー「ログイン保持」対応の一環。デフォルトのままだと長時間ログイン状態が保持されます）

2. **ホスティング側の準備（例: Vercel）**
   - リポジトリをGit管理下に置き、Vercelと連携
   - 環境変数 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を本番用Supabaseプロジェクトの値で設定
   - ビルドコマンド: `npm run build`（デフォルトのままで動作）
   - Node.jsバージョンは18以上を指定

3. **デプロイ後の確認**
   - `/login` が表示されること
   - 管理者アカウントでログインし、`/settings` で管理者専用メニュー（スタッフ管理・CSV出力・監査ログ）が見えること
   - 来店登録 → 顧客詳細への反映、ボトル追加、検索、カレンダー表示を一通り確認
   - 古いAndroidタブレットのChromeでも表示・操作できることを確認（第44章）

4. **PWAとしてホーム画面に追加**
   - スタッフの端末でブラウザから対象URLを開き、「ホーム画面に追加」を実行
   - 本番用PWAアイコン（現状は簡易モノグlabelのプレースホルダー）に差し替える場合は `public/icon.svg` を置き換えてください

## バックアップ方法

Supabase（PostgreSQL）のデータバックアップについて：

1. **Supabase標準のバックアップ機能**
   - Supabaseダッシュボード → Database → Backups で、プランに応じた自動バックアップ（Point-in-Time Recovery含む）が提供されます。本番プロジェクトでは有料プラン以上でのPITR有効化を推奨します。
2. **手動バックアップ（推奨: 定期的に実施）**
   - Supabaseダッシュボード → Database → Backups から手動バックアップを作成、またはSupabase CLIで `supabase db dump` を実行してSQLダンプを取得・保管
3. **監査ログによる変更履歴の保持**
   - `audit_logs`テーブルに主要テーブルの変更履歴が自動記録され、削除もできない設計のため、誤操作の追跡・復元の手がかりになります
4. **論理削除の方針**
   - 顧客・来店・予約・ボトル・メモは基本的に完全削除せず「無効化」で扱う設計のため、誤操作からの復旧余地があります（詳細は `supabase/README.md` の「複数スタッフ同時作業について」参照）

## 権限について

- **一般スタッフ**: 閲覧・登録・編集（顧客・来店・予約・ボトル・メモ・タグ付け・タグ新規作成）
- **管理者**: 上記に加えて、完全削除・CSV出力・スタッフ管理・監査ログ閲覧・顧客ランクの手動変更・タグの削除/改名・メモの無効化

最初の管理者は`supabase/README.md`の手順でSQLから直接昇格させる必要があります。以降は設定画面のスタッフ管理から昇格できます。

## 既知の制約・注意点

- **かな検索は「読み方」が入力されているデータのみ対象**です。RC9より前に登録した顧客は`kana`が未設定の場合があり、ひらがな検索にヒットしません。`supabase/optional_find_customers_missing_kana.sql`で未設定の顧客を確認し、優先度の高い常連客から顧客編集画面で読み方を補完することを推奨します。
- ボトルの「複数本のうち1本だけ部分消費」機能は未実装です（v1.1候補）。
- 誕生日前日18:00の自動プッシュ通知は未実装です（Web Push基盤が別途必要）。
- 本番用PWAアイコンは簡易プレースホルダーのままです。
- 実機（古いAndroidタブレット）での最終的な動作確認は、リリース前に必ず実機で行ってください。

## 今後のv1.1候補

今回のリリースで見送った改善点です。優先度は運用しながら判断することを推奨します。

- ボトルの部分消費（同じ種類複数本のうち指定本数だけ状態変更）のUI再実装
- 誕生日前日18:00の自動通知（Web Push）
- 本番用ブランドPWAアイコンへの差し替え
- 顧客検索のオフライン対応の強化（現在は直近1000件のキャッシュのみ）
- 週表示・日表示などカレンダーの表示バリエーション追加
- 同時編集時のリアルタイム競合通知（現状はlast-write-win + 監査ログのみ）
- 過去データの読み方（ふりがな）一括登録支援ツール
