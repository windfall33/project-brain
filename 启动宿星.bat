@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo [宿星] 启动中...

where node >nul 2>&1
if errorlevel 1 (
  echo 未找到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo 首次运行，安装依赖...
  call npm install
  if not exist "node_modules\electron\dist\electron.exe" (
    echo Electron 未就绪，请检查网络后重试 npm install
    pause
    exit /b 1
  )
)

rem 若 Vite 未占用 5173，则在后台启动
powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',5173); $c.Close(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo 启动本地服务 Vite...
  start "lodestar-vite" /min cmd /c "cd /d "%~dp0" && node node_modules\vite\bin\vite.js > vite.log 2>&1"
  rem 等待端口就绪，最多约 20 秒
  for /l %%i in (1,1,40) do (
    powershell -NoProfile -Command "try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',5173); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
    if not errorlevel 1 goto :vite_ready
    ping -n 1 127.0.0.1 >nul
  )
  echo Vite 启动超久，请查看 vite.log
  pause
  exit /b 1
)

:vite_ready
echo 打开宿星窗口...
start "" "%~dp0node_modules\electron\dist\electron.exe" --dev .

endlocal
exit /b 0
