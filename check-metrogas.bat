@echo off
REM Metrogas Automatic Check Script
REM This script runs the Metrogas scraper and logs the results

cd /d C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker

echo [%date% %time%] Starting Metrogas check... >> logs\metrogas-check.log

npx tsx scripts/manual-metrogas-check.ts >> logs\metrogas-check.log 2>&1

echo [%date% %time%] Metrogas check completed >> logs\metrogas-check.log
echo. >> logs\metrogas-check.log
