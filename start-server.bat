@echo off
title Server Jasa Open Trip NusaTrip - Port 3000
set "NODE_DIR=C:\Users\yuse\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin"
set "PATH=%NODE_DIR%;%PATH%"
echo ========================================================
echo   MENJALANKAN SERVER NUSATRIP (PORT 3000)
echo ========================================================
node server.js
pause
