@echo off
title LOGICORE - Orquestacion Un Clic
color 0b
echo =====================================================================
echo          LOGICORE: DESPLIEGUE AUTOMATIZADO INTEGRAL
echo =====================================================================
echo.

echo [1/2] Levantando contenedores y asignando recursos de RAM...
docker compose up -d --build

REM Ventana de tiempo prudencial para inicialización y healthcheck de contenedores de persistencia
echo [2/2] Esperando inicializacion completa de las estructuras...
timeout /t 45 /nobreak > nul

echo.
REM Disparo automático del punto de acceso local del dashboard operativo
echo [OK] Abriendo Dashboard operativo en el navegador (Puerto 5501)...
start "" "http://127.0.0.1:5501/logicore-dashboard/index.html"

echo.
echo =====================================================================
echo   ¡ENTORNO OPERATIVO COMPLETADO!
echo =====================================================================
pause