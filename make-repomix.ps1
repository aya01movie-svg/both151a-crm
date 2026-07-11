[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "==============================="
Write-Host " MATTY Repomix Generator"
Write-Host "==============================="
Write-Host ""

# 除外パターン（カテゴリごとに整理。今後増やす場合はここに1行追記するだけでOK）
$ignorePatterns = @(
  # ビルド成果物・依存関係
  ".git/**",
  ".next/**",
  "node_modules/**",
  ".vercel/**",
  "coverage/**",
  "dist/**",
  "build/**",
  "out/**",

  # 画像ファイル
  "**/*.png",
  "**/*.jpg",
  "**/*.jpeg",
  "**/*.gif",
  "**/*.svg",
  "**/*.webp",
  "**/*.ico",
  "**/*.bmp",

  # アーカイブ（ZIPなど）
  "**/*.zip",
  "**/*.rar",
  "**/*.7z",
  "**/*.tar",
  "**/*.tar.gz",
  "**/*.gz",

  # ログファイル
  "**/*.log",
  "npm-debug.log*",
  "yarn-debug.log*",
  "yarn-error.log*",

  # 環境変数・秘密情報（誤って含まれた場合の保険）
  ".env",
  ".env.*",

  # 安全策：public/guide/uploads は今後使用しない運用（フォルダごと削除済み）。
  # 万一、今後誤ってZIPや旧ドキュメント等が置かれてしまった場合でも
  # repomix-output.xml に混入しないよう、念のため除外を残しておく。
  "public/guide/uploads/**",

  # 個別に除外していたファイル（従来の設定を踏襲）
  "README.md",
  "MATTY_REAL_ALL_CODE.txt"
) -join ","

npx repomix `
  --output repomix-output.xml `
  --ignore $ignorePatterns

Write-Host ""
Write-Host "==============================="
Write-Host " 完了しました！"
Write-Host " repomix-output.xml をAIへ渡してください。"
Write-Host "==============================="
Pause