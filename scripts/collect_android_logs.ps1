param([string]$Adb = 'adb', [string]$OutputPath = './android-crash-log.txt')
$ErrorActionPreference = 'Stop'
# A local collection only: review/redact full crash logs before sharing in a public issue.
& $Adb logcat -d -v threadtime -s AndroidRuntime | Set-Content -Encoding utf8 -LiteralPath $OutputPath
if ($LASTEXITCODE -ne 0) { throw 'adb logcat failed. Check platform-tools, USB debugging and device authorization.' }
Write-Output "Saved AndroidRuntime logs to $OutputPath. Review and redact before sharing."
