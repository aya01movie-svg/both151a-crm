[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "==============================="
Write-Host " MATTY Repomix Generator"
Write-Host "==============================="
Write-Host ""

npx repomix `
  --output repomix-output.xml `
  --ignore ".git/**,.next/**,node_modules/**,.vercel/**,coverage/**,public/icons/**,README.md,MATTY_REAL_ALL_CODE.txt"

Write-Host ""
Write-Host "==============================="
Write-Host " 完了しました！"
Write-Host " repomix-output.xml をAIへ渡してください。"
Write-Host "==============================="
Pause