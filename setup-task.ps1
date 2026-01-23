$action = New-ScheduledTaskAction -Execute "C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker\check-utilities.bat" -WorkingDirectory "C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker"

$triggers = @(
    (New-ScheduledTaskTrigger -Daily -At 11:00AM),
    (New-ScheduledTaskTrigger -Daily -At 4:00PM),
    (New-ScheduledTaskTrigger -Daily -At 11:00PM)
)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "Utilities Checker" -Action $action -Trigger $triggers -Settings $settings -Description "Checks utilities (Metrogas, AYSA) via WhatsApp" -Force
Write-Host "Task 'Utilities Checker' updated with new schedule (11:00, 16:00, 23:00)!"
