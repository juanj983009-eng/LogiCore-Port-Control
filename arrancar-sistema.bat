@echo off
title LOGICORE - Orquestacion Inteligente
color 0b
echo =====================================================================
echo          LOGICORE: DESPLIEGUE AUTOMATIZADO INTELIGENTE
echo =====================================================================
echo.

echo [1/3] Levantando infraestructura y aplicando politicas de memoria...
docker compose up -d --build

echo.
echo [2/3] Monitoreando Healthcheck del servicio de despacho...
:esperar_backend
:: Intenta conectar silenciosamente al endpoint de despacho en el puerto 8082
powershell -Command "$ErrorActionPreference = 'Stop'; try { Invoke-WebRequest -Uri 'http://127.0.0.1:8082/api/v1/dispatch/trucks/view' -Method GET -TimeoutSec 2 > $null; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    timeout /t 3 /nobreak > nul
    goto esperar_backend
)

echo [OK] Backend detectado en linea de forma exitosa.
echo.

echo [3/3] Abriendo Dashboard operativo en el navegador (Puerto 5500)...
start "" "http://127.0.0.1:5500/logicore-dashboard/index.html"

echo.
echo =====================================================================
echo    ¡ENTORNO EN LÍNEA Y VINCULADO EN TIEMPO REAL!
echo =====================================================================
pause