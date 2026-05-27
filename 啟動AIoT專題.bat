@echo off
title AIoT Active Safety Defense Platform Launcher
pushd %~dp0

echo ==================================================
echo 🛡️  AIoT Active Safety Defense Platform Launcher
echo ==================================================
echo.
echo [1/2] Opening Web Dashboard in browser...
start http://localhost:3001

echo.
echo [2/2] Starting WSL services and Node.js backend...
echo.
wsl -d Ubuntu bash -c "export GEMINI_API_KEY='AIzaSyDSovky6___JLpkkGnIf0OtslGkX8KGD9c' && sudo service postgresql start && sudo service grafana-server start && cd ~/aiot_workspace/backend && node index.js"

popd
pause
