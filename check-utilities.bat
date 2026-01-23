@echo off
REM Automated Utilities Checker for Passive Income Tracker
REM This script checks all utilities (Metrogas, AYSA) via WhatsApp and saves results to database

echo ========================================
echo   Utilities Checker - Starting
echo ========================================
echo.

cd /d "%~dp0"

REM Run the TypeScript script
call npx tsx scripts/check-all-utilities.ts

echo.
echo ========================================
echo   Utilities Checker - Completed
echo ========================================
echo.

REM Keep window open if run manually (not from Task Scheduler)
if "%1"=="" pause
