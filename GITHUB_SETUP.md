# GitHub Repository Setup Guide

Follow these steps to import your code to the GitHub repository: https://github.com/ktimothybudi-source/rork-dietku-clone-356

## Prerequisites

1. **Install Git** (if not already installed):
   - Download from: https://git-scm.com/download/win
   - Or install via winget: `winget install Git.Git`
   - Or install via Chocolatey: `choco install git`

2. **Verify Git Installation**:
   ```bash
   git --version
   ```

## Setup Steps

### Option 1: Initialize New Repository (Recommended)

1. **Open terminal in project directory**:
   ```bash
   cd "C:\Users\USER\Desktop\rork-dietku-clone-356-main"
   ```

2. **Initialize Git repository**:
   ```bash
   git init
   ```

3. **Add remote repository**:
   ```bash
   git remote add origin https://github.com/ktimothybudi-source/rork-dietku-clone-356.git
   ```

4. **Stage all files**:
   ```bash
   git add .
   ```

5. **Create initial commit**:
   ```bash
   git commit -m "Initial commit: Complete Rork Dietku Clone with backend setup"
   ```

6. **Push to GitHub**:
   ```bash
   git branch -M main
   git push -u origin main
   ```

### Option 2: Clone and Copy Files

If the repository already exists on GitHub:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ktimothybudi-source/rork-dietku-clone-356.git
   cd rork-dietku-clone-356
   ```

2. **Copy all files from your current project**:
   ```bash
   # Copy everything except .git folder
   xcopy /E /I /Y "C:\Users\USER\Desktop\rork-dietku-clone-356-main\*" .
   ```

3. **Stage and commit**:
   ```bash
   git add .
   git commit -m "Add complete project files"
   git push
   ```

## Authentication

If you encounter authentication issues:

### Using Personal Access Token (Recommended)

1. **Create a Personal Access Token**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token with `repo` scope
   - Copy the token

2. **Use token when pushing**:
   ```bash
   git push https://YOUR_TOKEN@github.com/ktimothybudi-source/rork-dietku-clone-356.git
   ```

### Using GitHub CLI (Alternative)

1. **Install GitHub CLI**:
   ```bash
   winget install GitHub.cli
   ```

2. **Authenticate**:
   ```bash
   gh auth login
   ```

3. **Push**:
   ```bash
   git push
   ```

## Files to Commit

The following important files are included:
- ✅ All source code (`app/`, `components/`, `contexts/`, `lib/`, `utils/`)
- ✅ Backend code (`backend/`)
- ✅ Database schemas (`supabase/`)
- ✅ Configuration files (`package.json`, `app.json`, `tsconfig.json`)
- ✅ Documentation (`SETUP.md`, `BACKEND_TASKS.md`, `EXTERNAL_SETUP_REQUIREMENTS.md`)
- ✅ Environment template (`.env.example`)

## Files Excluded (via .gitignore)

- ❌ `.env` (contains secrets)
- ❌ `node_modules/`
- ❌ `.expo/`
- ❌ Build artifacts
- ❌ OS-specific files

## Verification

After pushing, verify:
1. Go to https://github.com/ktimothybudi-source/rork-dietku-clone-356
2. Check that all files are present
3. Verify `.env` is NOT in the repository (security)

## Troubleshooting

### "Repository not found" error
- Verify you have access to the repository
- Check repository URL is correct
- Ensure you're authenticated

### "Permission denied" error
- Use Personal Access Token instead of password
- Check token has `repo` scope

### Large file upload issues
- Ensure `.gitignore` excludes large files
- Use Git LFS for large files if needed

## Next Steps After Pushing

1. **Set up GitHub Actions** (optional):
   - Create `.github/workflows/` for CI/CD

2. **Add README.md**:
   - Update with project description
   - Add setup instructions

3. **Protect main branch**:
   - Require pull requests for changes
   - Enable branch protection rules

4. **Add collaborators** (if needed):
   - Settings → Collaborators → Add people

## Quick Command Reference

```bash
# Initialize repository
git init

# Add remote
git remote add origin https://github.com/ktimothybudi-source/rork-dietku-clone-356.git

# Check status
git status

# Stage all files
git add .

# Commit
git commit -m "Your commit message"

# Push
git push -u origin main

# Check remote
git remote -v
```
