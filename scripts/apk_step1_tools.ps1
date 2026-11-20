# 青养 APK 打包 · 第一步：下载并解压 JDK17 与 Android cmdline-tools（需联网）
# 用法：pwsh -File scripts\apk_step1_tools.ps1
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\小新AIR\Documents\qingyunapp'
$dl = Join-Path $root 'android-tools\dl'
$tools = Join-Path $root 'android-tools'
New-Item -ItemType Directory -Path $dl -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tools 'jdk') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $tools 'sdk') -Force | Out-Null

function Get-File([string]$Url, [string]$Out) {
  if (Test-Path $Out) { Write-Output "已存在，跳过: $Out"; return }
  Write-Output "下载: $Url"
  & curl.exe -L -f -sS --retry 3 --connect-timeout 20 -o $Out $Url
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $Out) -or (Get-Item $Out).Length -lt 1000) { throw "下载失败: $Url" }
  Write-Output ("完成: {0} ({1:N1} MB)" -f $Out, ((Get-Item $Out).Length / 1MB))
}

# 1) JDK 17（Microsoft Build，微软 CDN，国内可达性较好）
$jdkZip = Join-Path $dl 'jdk17.zip'
Get-File 'https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip' $jdkZip
Write-Output '解压 JDK ...'
Expand-Archive -Path $jdkZip -DestinationPath (Join-Path $tools 'jdk') -Force
$jdkDir = Get-ChildItem (Join-Path $tools 'jdk') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
if (-not $jdkDir) { throw 'JDK 解压后未找到 java.exe' }
Write-Output ("JDK 目录: " + $jdkDir.FullName)

# 2) Android commandline-tools（谷歌官方）
$cltZip = Join-Path $dl 'cmdline-tools.zip'
Get-File 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip' $cltZip
Write-Output '解压 cmdline-tools ...'
$cltTmp = Join-Path $tools 'clt-tmp'
if (Test-Path $cltTmp) { Remove-Item $cltTmp -Recurse -Force }
Expand-Archive -Path $cltZip -DestinationPath $cltTmp -Force
$latestDir = Join-Path $tools 'sdk\cmdline-tools\latest'
New-Item -ItemType Directory -Path $latestDir -Force | Out-Null
Copy-Item (Join-Path $cltTmp 'cmdline-tools\*') $latestDir -Recurse -Force
Remove-Item $cltTmp -Recurse -Force
if (-not (Test-Path "$latestDir\bin\sdkmanager.bat")) { throw 'cmdline-tools 解压异常（缺 sdkmanager）' }
Write-Output ("sdkmanager: " + (Join-Path $latestDir 'bin\sdkmanager.bat'))

# 输出环境信息供下一步使用
Write-Output ('JAVA_HOME=' + $jdkDir.FullName)
Write-Output ('ANDROID_HOME=' + (Join-Path $tools 'sdk'))
Write-Output '工具下载与解压完成。'