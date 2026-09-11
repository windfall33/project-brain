#Requires -Version 5
Set-Location -Path $PSScriptRoot
$ErrorActionPreference = 'Stop'

Write-Host '[宿星] 启动中...' -ForegroundColor Cyan

$electron = Join-Path $PSScriptRoot 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path $electron)) {
  Write-Host '安装依赖...'
  & npm install
  if (-not (Test-Path $electron)) {
    Write-Host 'Electron 未就绪，请检查网络后重试 npm install' -ForegroundColor Red
    exit 1
  }
}

function Test-Port5173 {
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', 5173)
    $c.Close()
    return $true
  } catch {
    return $false
  }
}

if (-not (Test-Port5173)) {
  Write-Host '启动 Vite...'
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', "cd /d `"$PSScriptRoot`" && node node_modules\vite\bin\vite.js > vite.log 2>&1" -WindowStyle Minimized
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Port5173) { break }
  }
  if (-not (Test-Port5173)) {
    Write-Host 'Vite 启动失败，请查看 vite.log' -ForegroundColor Red
    exit 1
  }
}

Write-Host '打开宿星窗口...'
Start-Process -FilePath $electron -ArgumentList '--dev', '.' -WorkingDirectory $PSScriptRoot
