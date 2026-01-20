@echo off
REM Utilities Scheduler Startup Script
REM Starts the PowerShell scheduler in a hidden window
REM This script should be placed in the Windows Startup folder

echo Starting Utilities Scheduler (Metrogas + Naturgy)...

REM Run PowerShell script in hidden window
powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -File "C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker\start-utilities-scheduler.ps1"

echo Scheduler started in background
