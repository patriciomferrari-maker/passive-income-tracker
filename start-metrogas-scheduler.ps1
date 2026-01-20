# Script para ejecutar checks de Metrogas en horarios programados
# Se ejecuta en segundo plano y verifica la hora cada 30 minutos

$logFile = "logs\metrogas-scheduler.log"
$scriptPath = "scripts\manual-metrogas-check.ts"

# Horarios configurados (formato 24h)
$scheduledTimes = @("11:00", "16:00", "23:00")

# Registrar inicio
"[$(Get-Date)] Scheduler iniciado. Horarios: $($scheduledTimes -join ', ')" | Out-File -Append $logFile

while ($true) {
    $currentTime = Get-Date -Format "HH:mm"
    
    # Verificar si es hora de ejecutar
    if ($scheduledTimes -contains $currentTime) {
        "[$(Get-Date)] Ejecutando check de Metrogas..." | Out-File -Append $logFile
        
        try {
            # Ejecutar el script
            npx tsx $scriptPath 2>&1 | Out-File -Append $logFile
            "[$(Get-Date)] Check completado exitosamente" | Out-File -Append $logFile
        }
        catch {
            "[$(Get-Date)] Error: $_" | Out-File -Append $logFile
        }
        
        # Esperar 2 minutos para no ejecutar múltiples veces en el mismo minuto
        Start-Sleep -Seconds 120
    }
    
    # Verificar cada 30 segundos
    Start-Sleep -Seconds 30
}
