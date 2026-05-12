@echo off
title Spotify Smart Discovery
cd /d "%~dp0"

echo.
echo ==========================================
echo   Spotify Smart Discovery baslatiliyor...
echo ==========================================
echo.

REM Paketler yuklu degilse ilk kurulum
if not exist "node_modules" (
    echo node_modules bulunamadi, npm install calistiriliyor...
    echo.
    call npm install
    if not exist "node_modules" (
        echo.
        echo HATA: npm install basarisiz oldu. Devam edilemiyor.
        pause
        exit /b 1
    )
    echo.
)

REM .env kontrolu
if not exist ".env" (
    echo UYARI: .env dosyasi bulunamadi.
    echo   1. .env.example dosyasini .env olarak kopyalayin
    echo   2. Spotify credentials'larinizi doldurun
    echo   3. node get-token.js ile refresh token alin
    echo.
    echo Sunucu yine de baslayacak ama API cagrilarinda hata verebilir.
    echo.
)

echo Tarayici 3 saniye sonra otomatik acilacak: http://localhost:3000
echo Sunucuyu durdurmak icin: Ctrl+C
echo.

REM Sunucu hazir olduktan sonra tarayiciyi arka planda ac
start /b "" cmd /c "timeout /t 3 /nobreak >nul 2>&1 && start """" http://localhost:3000"

REM Sunucuyu on planda baslat (log bu pencerede gorunur)
node server.js

echo.
echo Sunucu kapandi. Pencereyi kapatmak icin bir tusa basin.
pause >nul
