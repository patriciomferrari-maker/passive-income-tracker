# Automated Utilities Checker - Setup Guide

## Quick Start

### 1. Manual Test
```bash
# Run once to test
.\check-utilities.bat
```

**First time:**
- Will show QR codes for Metrogas and AYSA
- Scan both with WhatsApp
- Sessions will be saved

**Subsequent runs:**
- No QR needed
- Automatic checks

---

## Windows Scheduled Task Setup

### Option A: Using Task Scheduler GUI

1. Open **Task Scheduler** (search in Start menu)
2. Click **Create Basic Task**
3. Name: `Utilities Checker`
4. Trigger: **Daily** at **8:00 AM**
5. Action: **Start a program**
   - Program: `C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker\check-utilities.bat`
   - Start in: `C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker`
6. **Important Settings:**
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges
   - ✅ Configure for: Windows 10

### Option B: Using PowerShell (Advanced)

```powershell
# Run as Administrator
$action = New-ScheduledTaskAction -Execute "C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker\check-utilities.bat" -WorkingDirectory "C:\Users\patri\.gemini\antigravity\playground\passive_income_tracker"

$trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "Utilities Checker" -Action $action -Trigger $trigger -Settings $settings -Description "Checks utilities (Metrogas, AYSA) via WhatsApp"
```

---

## Recommended Schedule

| Time | Reason |
|------|--------|
| **8:00 AM** | Morning check before work |
| **2:00 PM** | Midday check |
| **8:00 PM** | Evening check |

**To run multiple times per day:**
- In Task Scheduler, add multiple triggers
- Or use **Repeat task every: 6 hours**

---

## Logs

Check results in:
- Console output (if running manually)
- Database: `UtilityCheck` table
- Your app: `/alquileres` → Servicios tab

---

## Troubleshooting

### "WhatsApp authentication failed"
- Delete `.wwebjs_auth` folder
- Run `.\check-utilities.bat` manually
- Scan QR codes again

### "Property not found"
- Make sure properties have `gasId` or `aysaId` set
- Check in `/alquileres` → Propiedades

### Script doesn't run from Task Scheduler
- Verify path is correct
- Check "Run with highest privileges"
- Ensure PC is awake at scheduled time

---

## What Gets Checked

✅ All properties with `gasId` → Metrogas WhatsApp
✅ All properties with `aysaId` → AYSA WhatsApp
✅ Results saved to database
✅ Visible in UI immediately

---

## Next Steps

1. Test manually first: `.\check-utilities.bat`
2. Verify results in `/alquileres` → Servicios
3. Set up scheduled task
4. Monitor for a few days
