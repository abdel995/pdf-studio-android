# 📱 PDF Studio Pro - Application Mobile Android (APK)

> Suite complète de traitement et manipulation de fichiers PDF pour Android, 100% locale, privée et hors-ligne.  
> Conçue pour être compilée automatiquement en **fichier APK installable via GitHub Actions**.

---

## 🌟 Fonctionnalités Incluses dans l'APK Mobile

L'application Android embarque l'ensemble des outils de traitement directement sur votre smartphone :

- 🖼️ **Images en PDF** : conversion de JPG, PNG, WEBP en document PDF unique avec choix des marges et du format.
- 📸 **PDF en Images** : extraction haute définition de chaque page en images PNG téléchargeables.
- 📑 **Organiser & Fusionner** : réorganisation des pages, rotation et combinaison de documents.
- ✂️ **Découper / Diviser PDF** : extraction de pages ou découpage par plages personnalisées (ex: `1-3, 5-8`).
- 🗑️ **Supprimer des pages** : élimination des pages blanches ou indésirables.
- 📋 **Aplatir PDF (Flatten)** : verrouillage définitif des formulaires et annotations.
- 📖 **PDF en Texte & Markdown** : extraction paginée en `.txt` ou en Markdown structuré `.md`.
- 🏷️ **Métadonnées & RGPD** : modification ou anonymisation complète des métadonnées en 1 clic.
- 💧 **Ajouter un Filigrane** : texte diagonal personnalisé, opacité et rotation configurables.
- 🔢 **Numéroter les pages** : pagination personnalisable (`Page X sur Y`) avec positionnement précis.
- ⚖️ **Numérotation Bates Juridique** : indexation légale séquentielle pour dossiers d'avocats.
- 🔄 **Pivoter les pages** : rotation instantanée globale, pages paires ou impaires.

---

## 🚀 Comment Générer Votre Fichier APK via GitHub

Ce dossier est configuré avec un pipeline d'intégration continue **GitHub Actions** (`.github/workflows/build-apk.yml`) qui compile automatiquement votre application en APK sur les serveurs cloud de GitHub sans que vous n'ayez besoin d'installer Android Studio.

### Étape 1 : Créer un nouveau dépôt sur GitHub
1. Connectez-vous à votre compte sur [GitHub.com](https://github.com/).
2. Cliquez sur le bouton vert **New** (ou rendez-vous sur `https://github.com/new`).
3. Donnez un nom à votre dépôt (par exemple : `pdf-studio-android`).
4. Choisissez la visibilité (**Public** ou **Private** selon votre préférence).
5. Ne cochez **pas** "Initialize this repository with a README" (ce dossier contient déjà tout le nécessaire).
6. Cliquez sur **Create repository**.

### Étape 2 : Publier ce dossier vers votre dépôt GitHub
Ouvrez un terminal PowerShell dans ce dossier (`d:\pdf-studio-android`) et exécutez les commandes suivantes (en remplaçant par l'URL de votre dépôt) :

```powershell
cd "d:\pdf-studio-android"

# Lier le dépôt distant (remplacez par votre URL GitHub)
git remote add origin https://github.com/VOTRE_NOM_UTILISATEUR/pdf-studio-android.git

# Définir la branche principale
git branch -M main

# Envoyer le code sur GitHub
git push -u origin main
```

### Étape 3 : Récupérer votre fichier APK compilé
1. Sur la page de votre projet GitHub, cliquez sur l'onglet **Actions** en haut.
2. Vous verrez le workflow **Build Android APK** en cours d'exécution.
3. La compilation prend environ **2 à 3 minutes**.
4. Dès que l'icône verte apparaît (✓), cliquez sur la tâche terminée.
5. Dans la section **Artifacts** en bas de page, cliquez sur **PDF-Studio-Pro-APK** pour télécharger le fichier zip contenant votre **APK installable** !

---

## 🏷️ Créer une Release Officielle Téléchargeable (Optionnel)

Si vous souhaitez obtenir un lien direct de téléchargement permanent sur GitHub :

```powershell
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions compilera alors l'application et créera automatiquement une **GitHub Release** avec le fichier `PDF-Studio-Pro.apk` attaché et téléchargeable d'un simple clic sur mobile !

---

## 📲 Comment Installer l'APK sur Votre Téléphone Android

1. Transférez ou téléchargez le fichier `PDF-Studio-Pro.apk` sur votre smartphone Android.
2. Appuyez sur le fichier APK depuis vos notifications ou votre gestionnaire de fichiers.
3. Si Android affiche un message de sécurité :
   - Appuyez sur **Paramètres**.
   - Cochez **Autoriser l'installation à partir de cette source**.
4. Appuyez sur **Installer**.
5. Ouvrez **PDF Studio Pro** et commencez à manipuler vos PDF 100% hors-ligne !

---

## 📂 Structure du Projet

```text
d:\pdf-studio-android\
├── .github/workflows/
│   └── build-apk.yml            # Pipeline CI/CD GitHub Actions pour compiler l'APK
├── app/
│   ├── build.gradle             # Configuration Android Gradle
│   └── src/main/
│       ├── AndroidManifest.xml  # Permissions (Stockage, Fichiers, Téléchargements)
│       ├── java/com/pdfstudio/pro/
│       │   ├── MainActivity.java     # WebView avec gestionnaire de fichiers natif
│       │   └── WebAppInterface.java  # Passerelle de téléchargement et notifications
│       └── assets/www/          # Interface Web embarquée et moteurs PDF hors-ligne
│           ├── index.html       # Dashboard et 19 outils PDF
│           ├── css/style.css    # Styles modernes et mode sombre
│           └── js/
│               ├── mobile_engine.js  # Moteur de manipulation PDF côté client
│               ├── pdf-lib.min.js    # Bibliothèque vectorielle PDF
│               └── pdf.min.js        # Moteur de rendu et d'extraction de texte
├── build.gradle                 # Configuration racine Gradle
├── gradlew & gradlew.bat        # Wrapper Gradle multi-plateforme
└── settings.gradle              # Modules du projet
```
