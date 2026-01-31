$file = 'c:\Users\patri\.gemini\antigravity\playground\passive_income_tracker\components\economic\UVAEvolutionChart.tsx'
$lines = Get-Content $file

# New code to insert (lines 257-273)
$newLines = @(
    "        // Generate ALL months in the range using string manipulation (avoid timezone issues)",
    "        const monthsToProcess: string[] = [];",
    "        const [startYear, startMonth] = startMonthKey.split('-').map(Number);",
    "        const [endYear, endMonth] = endMonthKey.split('-').map(Number);",
    "        ",
    "        let currentYear = startYear;",
    "        let currentMonth = startMonth;",
    "        ",
    "        while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {",
    "            const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;",
    "            monthsToProcess.push(monthKey);",
    "            ",
    "            currentMonth++;",
    "            if (currentMonth > 12) {",
    "                currentMonth = 1;",
    "                currentYear++;",
    "            }",
    "        }"
)

# Build new file content
$newContent = @()
$newContent += $lines[0..256]  # Lines 0-256 (inclusive)
$newContent += $newLines       # New lines
$newContent += $lines[266..($lines.Length-1)]  # Rest of the file from line 266

# Write back
$newContent | Set-Content $file

Write-Host "Replacement complete. New file has $($newContent.Length) lines (was $($lines.Length))"
