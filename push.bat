@echo off
chcp 65001 >nul
title PDF Studio - Envoi vers GitHub

echo ========================================================
echo    PDF STUDIO ANDROID - ASSISTANT D'ENVOI GITHUB
echo ========================================================
echo.

:: Verifier si Git est disponible
where git >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\MinGit\cmd\git.exe" (
        set "PATH=%LOCALAPPDATA%\Programs\MinGit\cmd;%PATH%"
    ) else (
        echo [ERREUR] Git n'est pas détecté. 
        echo Veuillez installer Git ou redémarrer votre session.
        pause
        exit /b 1
    )
)

echo Git est prêt !
echo.
echo Veuillez coller l'URL de votre dépôt GitHub créé à l'étape A.
echo (Exemple: https://github.com/votre-pseudo/pdf-studio.git)
echo.
set /p REPO_URL="URL du dépôt GitHub : "

if "%REPO_URL%"=="" (
    echo [ERREUR] Aucune URL entrée. Annulation.
    pause
    exit /b 1
)

echo.
echo [1/3] Configuration du dépôt distant (remote origin)...
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [2/3] Configuration de la branche main...
git branch -M main

echo [3/3] Envoi du code vers GitHub (Push)...
echo.
echo * Note: Une fenêtre de connexion GitHub (navigateur) peut s'ouvrir pour vous identifier.
echo.
git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  SUCCÈS ! Votre code a été envoyé avec succès sur GitHub.
    echo.
    echo  Rendez-vous maintenant sur votre dépôt GitHub :
    echo  1. Cliquez sur l'onglet 'Actions' en haut.
    echo  2. Le build Android 'Build Android APK' se lance automatiquement.
    echo  3. En 2-3 minutes, téléchargez votre fichier 'app-release.apk' !
    echo ========================================================
) else (
    echo.
    echo [ATTENTION] L'envoi a rencontré une erreur.
    echo Vérifiez votre connexion ou vos identifiants GitHub.
)

echo.
pause
