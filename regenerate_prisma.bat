@echo off
echo ================================================================
echo Regenerando Prisma Client para Alquileres
echo ================================================================
echo.
echo IMPORTANTE: Asegurate de haber detenido npm run dev antes de ejecutar esto.
echo Presiona Ctrl+C para cancelar si todavia esta corriendo.
echo.
pause

echo.
echo [1/3] Borrando cache de Prisma...
rmdir /s /q node_modules\.prisma 2>nul
if errorlevel 1 (
    echo No se pudo borrar el cache. El dev server podria estar corriendo.
    echo Detene npm run dev y vuelve a intentar.
    pause
    exit /b 1
)
echo ✓ Cache borrado

echo.
echo [2/3] Regenerando Prisma Client...
call npx prisma generate
if errorlevel 1 (
    echo ✗ Error al regenerar Prisma Client
    pause
    exit /b 1
)
echo ✓ Cliente regenerado

echo.
echo [3/3] Listo!
echo.
echo Ahora podes reiniciar el dev server con: npm run dev
echo.
pause
