@echo off
chcp 65001 >nul
title PDF Studio - Envoi vers GitHub

echo ========================================================
echo    PDF STUDIO ANDROID - ASSISTANT D'ENVOI GITHUB
echo ========================================================
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe" (
        set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd;%PATH%"
    ) else if exist "%ProgramFiles%\Git\cmd\git.exe" (
        set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
    ) else if exist "%LOCALAPPDATA%\Programs\Git\cmd\git.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\Git\cmd;%PATH%"
    ) else if exist "%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%"
    ) else (
        echo [ERREUR] Git n'est pas détecté sur ce système.
        pause
        exit /b 1
    )
)

:: Verifier si un remote origin existe deja
git remote get-url origin >nul 2>&1
if %errorlevel% equ 0 (
    echo Dépôt distant configuré :
    git remote get-url origin
    echo.
    echo Envoi des modifications vers GitHub (Push)...
    git push -u origin main
) else (
    echo Veuillez coller l'URL de votre dépôt GitHub :
    set /p REPO_URL="URL du dépôt : "
    git remote add origin %REPO_URL%
    git branch -M main
    git push -u origin main
)

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCÈS ! Votre code a été envoyé sur GitHub.
    echo  Le build de votre APK démarre maintenant dans 'Actions' !
    echo ========================================================
) else (
    echo.
    echo [ATTENTION] Erreur lors de l'envoi.
)

echo.
pause
