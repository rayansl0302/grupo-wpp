# WPP Bot - Inicia API + Dashboard
Write-Host ""
Write-Host "WPP Bot - Iniciando..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "apps/api/node_modules")) {
    Write-Host "Dependencias da API nao encontradas. Rode primeiro: .\setup.ps1" -ForegroundColor Yellow
    exit 1
}
if (-not (Test-Path "apps/dashboard/node_modules")) {
    Write-Host "Dependencias do dashboard nao encontradas. Rode primeiro: .\setup.ps1" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path "apps/api/data/wpp_bot.db")) {
    Write-Host "Banco nao encontrado. Criando..." -ForegroundColor Yellow
    Set-Location apps/api
    npx prisma generate | Out-Null
    npx prisma db push | Out-Null
    npx tsx prisma/seed.ts
    Set-Location ../..
}

Write-Host "Subindo API em http://localhost:3333" -ForegroundColor Green
Write-Host "Subindo Dashboard em http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Login: admin@wppbot.com / admin123" -ForegroundColor Gray
Write-Host ""

$api = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD/apps/api'; npm run dev" -PassThru -WindowStyle Normal
Start-Sleep -Seconds 2
$dash = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD/apps/dashboard'; npm run dev" -PassThru -WindowStyle Normal

Write-Host "Tudo rodando! Abra http://localhost:5173 no navegador." -ForegroundColor Green
Write-Host "Feche as 2 janelas que abriram para parar tudo." -ForegroundColor DarkGray
Write-Host ""
