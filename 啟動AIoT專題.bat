@echo off
chcp 65001 >nul
title AIoT Active Safety Defense Platform Launcher
pushd %~dp0

echo ==================================================
echo 🛡️  AIoT Active Safety Defense Platform Launcher
echo ==================================================
echo.
echo [1/2] Opening Web Dashboard in browser...
echo.
start http://localhost:3001

echo.
echo [2/2] Starting WSL services and Node.js backend...
echo.
wsl -d Ubuntu bash -c "echo '🔄 同步 Windows 變更至 WSL...' && rsync -av --update --exclude 'node_modules' --exclude '.git' --exclude 'yolo_low_vram' --exclude 'runs' /mnt/d/MyDesktop/antigravity2.0/yolo_db/ /home/edison/aiot_workspace/ && sudo service postgresql start && sudo service grafana-server start && cd /home/edison/aiot_workspace/backend && node index.js"

popd
pause
