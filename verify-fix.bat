@echo off
echo ============================================
echo VERIFICACION DE FIX - PREMIUM/FREE SYSTEM
echo ============================================
echo.

echo [1/4] Verificando archivo compilado...
if exist "functions\lib\index.js" (
    echo ✅ functions\lib\index.js existe
    dir "functions\lib\index.js" | findstr /C:"index.js"
) else (
    echo ❌ ERROR: functions\lib\index.js NO existe
    echo Ejecuta: cd functions ^&^& npm run build
    pause
    exit /b 1
)
echo.

echo [2/4] Verificando procesos de Node...
tasklist | findstr /I "node.exe" >nul
if %errorlevel%==0 (
    echo ⚠️ ADVERTENCIA: Hay procesos node.exe ejecutandose
    echo.
    echo Procesos encontrados:
    tasklist | findstr /I "node.exe"
    echo.
    echo Para detener el emulador: Ctrl+C en la terminal donde corre
    echo Para forzar cierre: taskkill /F /IM node.exe /T
) else (
    echo ✅ No hay procesos node.exe ejecutandose
)
echo.

echo [3/4] Instrucciones para reiniciar emulador...
echo.
echo PASO 1: Si el emulador esta corriendo, detenerlo con Ctrl+C
echo PASO 2: Ejecutar: firebase emulators:start
echo PASO 3: Esperar mensaje: "✔ All emulators ready!"
echo PASO 4: En el browser, presionar Ctrl+Shift+R (hard refresh)
echo.

echo [4/4] Logs que DEBES ver al probar en modo Free:
echo.
echo === BROWSER CONSOLE (F12) ===
echo 🚀 [APP] Generating recipe with isPremium: false
echo 🔍 [FRONTEND] Sending to Cloud Function: { isPremium: false }
echo ✅ [APP] Recipe received, imageUrl: NO IMAGE
echo.
echo === FUNCTIONS CONSOLE (Terminal) ===
echo 🔥🔥🔥 BACKEND NUEVO EJECUTANDOSE - isPremium recibido: false
echo 🔍 [BACKEND] Request Data: { isPremium: false, isPremiumType: 'boolean' }
echo 🌑 [BACKEND] Skipping image generation for Free user
echo.

echo ============================================
echo Si NO ves el log "🔥🔥🔥 BACKEND NUEVO", el
echo emulador sigue con codigo viejo. REINICIAR.
echo ============================================
echo.
pause
