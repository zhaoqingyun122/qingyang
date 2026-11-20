# 青养 APK 打包 · 第二步：安装 Android SDK 组件 + 初始化 Capacitor 工程（需联网）
# 依赖第一步已生成的 android-tools\jdk 与 android-tools\sdk
# 用法：pwsh -File scripts\apk_step2_sdk.ps1
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\小新AIR\Documents\qingyunapp'
$tools = Join-Path $root 'android-tools'
$jdkDir = Get-ChildItem (Join-Path $tools 'jdk') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'bin\java.exe') } | Select-Object -First 1
if (-not $jdkDir) { throw '未找到 JDK，请先运行第一步' }
$env:JAVA_HOME = $jdkDir.FullName
$env:ANDROID_HOME = Join-Path $tools 'sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# 1) sdkmanager 安装组件（一次装好；minSdk 用 Capacitor 默认）
Write-Output '== 安装 Android SDK 组件 =='
& (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat') 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0' 'platforms;android-35'
if ($LASTEXITCODE -ne 0) { throw 'sdkmanager 安装组件失败' }
Write-Output '== 接受许可协议 =='
& (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin\sdkmanager.bat') --licenses | Out-Null
Write-Output 'SDK 组件就绪：'
Get-ChildItem $env:ANDROID_HOME -Directory | Select-Object -ExpandProperty Name

# 2) npm 初始化 + Capacitor
Write-Output '== npm 初始化 =='
$node = Join-Path $root 'runtime\node.exe'
Push-Location $root
if (-not (Test-Path 'package.json')) { & $node -e "require('fs').writeFileSync('package.json', JSON.stringify({name:'qingyang-app', version:'1.0.0', private:true}, null, 2))" }
Write-Output '== 安装 Capacitor（国内镜像） =='
& $node (Join-Path $root 'node_modules\npm\bin\npm-cli.js') --version 2>$null
& $node $env:APPDATA 2>$null
if (-not (Test-Path 'node_modules\@capacitor\cli')) {
  & $node (Join-Path $root 'node_modules\npm\bin\npm-cli.js') install @capacitor/core@latest @capacitor/cli@latest --registry=https://registry.npmmirror.com 2>&1 | Select-Object -Last 5
  if ($LASTEXITCODE -ne 0) { throw 'capacitor 安装失败' }
}
Write-Output 'Capacitor 安装完成。'
Pop-Location