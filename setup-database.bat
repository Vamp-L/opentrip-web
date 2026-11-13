@echo off
title Setup Database & Seeder - NusaTrip Open Trip
set "NODE_DIR=C:\Users\yuse\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PATH=%NODE_DIR%;%PATH%"
echo ========================================================
echo   MIGRASI DATABASE PRISMA KE POSTGRESQL & SEEDING DATA
echo ========================================================
node ".\node_modules\prisma\build\index.js" generate
node ".\node_modules\prisma\build\index.js" db push --accept-data-loss
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo [!] Gagal terhubung ke PostgreSQL. Pastikan username dan password di file .env sudah sesuai dengan PostgreSQL lokal Anda.
  pause
  exit /b %ERRORLEVEL%
)
echo.
echo Menjalankan Seeder Data Awal NusaTrip (Admin, Customer, 3 Paket Trip)...
node ".\prisma\seed.js"
echo.
echo [SUKSES] Database db_opentrip siap digunakan! Silakan jalankan start-server.bat
pause
