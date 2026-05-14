# WPP Bot - Setup inicial
Write-Host ""
Write-Host "WPP Bot - Setup inicial" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Instalando dependencias da API..." -ForegroundColor Yellow
Set-Location apps/api
npm install

Write-Host ""
Write-Host "[2/3] Configurando banco de dados..." -ForegroundColor Yellow
if (-not (Test-Path "data")) { New-Item -ItemType Directory -Name "data" | Out-Null }
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

Set-Location ../..

Write-Host ""
Write-Host "[3/3] Instalando dependencias do dashboard..." -ForegroundColor Yellow
Set-Location apps/dashboard
npm install
Set-Location ../..

Write-Host ""
Write-Host "Setup concluido com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "Para iniciar tudo de uma vez, rode:" -ForegroundColor White
Write-Host "  .\start.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "Ou separadamente em 2 terminais:" -ForegroundColor White
Write-Host "  Terminal 1 (API):       cd apps/api; npm run dev" -ForegroundColor Gray
Write-Host "  Terminal 2 (Dashboard): cd apps/dashboard; npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Login padrao:" -ForegroundColor White
Write-Host "  E-mail: admin@wppbot.com" -ForegroundColor Gray
Write-Host "  Senha:  admin123" -ForegroundColor Gray
Write-Host ""
