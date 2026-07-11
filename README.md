# MATTY（マッティー）

バー・スナック等の接客業向け、タブレット第一（tablet-first）の店舗CRM（顧客管理）PWAアプリです。
日本語UIのみで運用されています。

来店・予約・ボトルキープ・顧客情報を一元管理し、スタッフが**営業中にすばやく入力・確認できること**を最優先に設計されています。
開発方針は「シンプルさ最優先（Simplicity-first UX）」— 機能を増やすより、既存機能を分かりやすくすることを優先します。

---

## 1. システム概要

- **アプリ名**：MATTY（マッティー）
- **種別**：店舗CRM（顧客管理）PWAアプリ
- **想定利用者**
  - 店舗スタッフ（`role = "staff"`）：日常の来店・予約・顧客登録
  - 管理者（`role = "admin"`）：タグ・イベント・スタッフ管理、データ出力、変更履歴閲覧、顧客の統合・削除

### 主な機能

| 機能 | 画面 |
|---|---|
| ホーム（KPI・インライン検索・カレンダー） | `/dashboard` |
| 来店登録 | `/visits/new` |
| 来店修正・無効化 | `/visits/[id]/edit` |
| 顧客検索 | `/search` |
| 顧客一覧・詳細・編集 | `/customers`, `/customers/[id]` |
| 予約管理 | `/reservations` |
| お知らせ（カレンダー・イベント・スタッフ休み・誕生日・カレンダー反映イベント） | `/calendar` |
| ボトル管理 | `/bottles` |
| 設定（タグ・イベント・カレンダー反映イベント・スタッフ管理・データ出力等、管理者中心） | `/settings` |

---

## 2. 使用技術

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js（App Router / Turbopack / Server Actions） |
| 言語 | TypeScript |
| UI | React、Tailwind CSS v4 |
| アイコン | lucide-react |
| グラフ | recharts |
| バックエンド | Supabase（PostgreSQL + Auth + RLS + DBトリガー） |
| Supabase接続 | `@supabase/ssr`, `@supabase/supabase-js` |
| デプロイ | GitHub → Vercel（自動デプロイ） |
| PWA | `manifest.webmanifest`、`sw.js`（Service Worker。※現在オフラインキャッシュ機能は一時的に無効化中） |

正確なバージョンは `package.json` を参照してください。

---

## 3. 開発環境のセットアップ

### 3.1 必要なもの

- Node.js（`package.json` の `next` / `react` バージョンに対応するもの）
- npm
- Supabaseプロジェクト（URL・Anon Key）

### 3.2 インストールと起動

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開くと `/dashboard` へリダイレクトされます（未ログイン時は `/login` へ）。

### 3.3 環境変数

プロジェクトルートに `.env.local` を作成し、Supabaseの接続情報を設定してください（`.env.local` はGit管理対象外です）。

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> `NEXT_PUBLIC_SUPABASE_URL` の末尾に `/rest/v1` を付けないよう注意してください（よくある設定ミスとして、アプリ側でも検知・警告されます）。

### 3.4 Supabase側のセットアップ

`supabase/` フォルダ内のSQLマイグレーションファイル（`001_initial_schema.sql` 以降、番号順）をSupabaseプロジェクトに適用してください。詳細手順は `supabase/README.md` を参照してください。

### 3.5 その他のコマンド

```bash
npm run build   # 本番ビルド
npm run start   # 本番ビルドの起動
npm run lint    # ESLint
```

---

## 4. デプロイ

このプロジェクトは **GitHubへpushすると、Vercelへ自動デプロイ**されます。

- ブランチにpush → Vercelがビルド・デプロイを自動実行
- 本番URLはVercelダッシュボードで確認してください
- Vercel側の環境変数（`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`）はVercelの管理画面で別途設定が必要です

---

## 5. Repomix（AIへコードを渡す方法）

AI（Claude等）に最新のソースコード全体を渡す場合は、`make-repomix.ps1` を実行してください。

```powershell
./make-repomix.ps1
```

実行すると、プロジェクト直下に **`repomix-output.xml`** が生成されます。このファイルをAIとのチャット（プロジェクトのナレッジ等）へアップロードすることで、AIが最新のソースコード全体を参照できるようになります。

- `node_modules` / `.next` / `.git` / `.vercel` / `coverage` / `public/icons` / `README.md` などは出力から除外されます。
- **コード修正がGitHubへ反映されたら、その都度 `make-repomix.ps1` を再実行し、`repomix-output.xml` を最新版に差し替えてください。** 古い `repomix-output.xml` をAIに渡すと、AIが古いコードを基準に作業してしまいます。

AI向けの詳しい運用ルールは [`AI_README.md`](./AI_README.md) を参照してください。

---

## 6. Project Pack（正式仕様書）

このプロジェクトの**正式仕様**は、以下4つのMarkdownドキュメント（Project Pack）です。実装で迷った場合は、まずこれらを確認してください。

| ファイル | 内容 |
|---|---|
| `01_System_Spec.md` | システム・画面仕様書（アプリ概要、技術スタック、ルーティング、各画面の仕様） |
| `02_Database_Schema.md` | DBスキーマ設計書（テーブル構成、RLS、トリガー、SQL関数、バックエンド挙動） |
| `03_AI_Guidelines.md` | AIへのコーディング指示書（開発ルール・実装パターン・コミュニケーション前提） |
| `04_Development_History.md` | 開発履歴、既知のバグ・未解決事項、TODO |

> Project Pack の構成・ファイル名は今後変更される可能性があります。変更した場合は、本README.mdおよびAI_README.mdの該当箇所も必ず更新してください。

---

## 7. 注意事項

- **`node_modules`** と **`.next`** はGit管理しないでください（`.gitignore` で除外済み）。
- `.env*` もGit管理しないでください（Supabaseの認証情報が含まれるため）。
- ソースコードの正は常に **GitHubの最新版** です。ローカルや過去のやり取り・チャット内のコードを正としないでください。
- 仕様上の正式なドキュメントは **Project Pack（上記6.）** です。過去のチャットやレポートより、Project Packと実際のソースコードを優先してください。
- DBスキーマ（テーブル・カラムの追加/削除/型変更、RLSポリシー、トリガー）の変更は、影響が大きいため慎重に行ってください（詳細は `03_AI_Guidelines.md`）。

---

## 8. 開発に参加する方へ

初めてこのプロジェクトに触れる場合は、次の順番で読むことをおすすめします。

1. このREADME.md（全体像の把握）
2. `01_System_Spec.md`（画面仕様）
3. `02_Database_Schema.md`（DB構造）
4. `03_AI_Guidelines.md`（実装ルール）
5. `04_Development_History.md`（これまでの経緯・現状の課題）

AIにコード修正を依頼する場合は、[`AI_README.md`](./AI_README.md) を最初に読み込ませてください。
