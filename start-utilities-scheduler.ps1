# Utilities Scheduler - Metrogas & Naturgy
# Runs automatic checks 3 times daily: 11:00 AM, 4:00 PM, 11:00 PM

$projectPath = "C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker"
$logFile = "$projectPath\logs\utilities-scheduler.log"

# Ensure logs directory exists
if (-not (Test-Path "$projectPath\logs")) {
    New-Item -ItemType Directory -Path "$projectPath\logs" | Out-Null
}

# Scheduled times (24-hour format)
$scheduledTimes = @("11:00", "16:00", "23:00")

Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Utilities Scheduler started" | Out-File -FilePath $logFile -Append
Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Scheduled times: 11:00 AM, 4:00 PM, 11:00 PM" | Out-File -FilePath $logFile -Append

while ($true) {
    $currentTime = Get-Date -Format "HH:mm"
    
    if ($scheduledTimes -contains $currentTime) {
        Write-Output "`n[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ⏰ Scheduled time reached - Starting utility checks..." | Out-File -FilePath $logFile -Append
        
        # Change to project directory
        Set-Location $projectPath
        
        # Run Metrogas check
        Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 🔥 Running Metrogas check..." | Out-File -FilePath $logFile -Append
        $metrogasOutput = npx tsx scripts/manual-metrogas-check.ts 2>&1
        Write-Output $metrogasOutput | Out-File -FilePath $logFile -Append
        
        # Run Naturgy check
        Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] 🔥 Running Naturgy check..." | Out-File -FilePath $logFile -Append
        $naturgyOutput = npx tsx scripts/manual-naturgy-check.ts 2>&1
        Write-Output $naturgyOutput | Out-File -FilePath $logFile -Append
        
        Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ✅ Utility checks completed" | Out-File -FilePath $logFile -Append
        
        # Wait 60 seconds to avoid running multiple times in the same minute
        Start-Sleep -Seconds 60
    }
    
    # Check every 30 seconds
    Start-Sleep -Seconds 30
}
