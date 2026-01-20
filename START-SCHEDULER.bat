@echo off
REM Iniciar el scheduler de Metrogas en segundo plano

echo Iniciando scheduler de Metrogas...
echo El scheduler correra en segundo plano y ejecutara checks a las 11 AM, 4 PM y 11 PM

cd /d C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker

start /min powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File start-metrogas-scheduler.ps1

echo.
echo Scheduler iniciado! Se ejecutara en segundo plano.
echo Para detenerlo, cierra el proceso PowerShell desde el Administrador de tareas.
echo.
pause
