# Quick Start: Push to GitHub

## Step-by-Step Instructions

### 1. Install Git (if not installed)

**Option A: Using winget (Windows Package Manager)**
```powershell
winget install Git.Git
```

**Option B: Download installer**
- Go to: https://git-scm.com/download/win
- Download and run the installer
- Use default settings

**Option C: Using Chocolatey**
```powershell
choco install git
```

### 2. Verify Git Installation

Open PowerShell and run:
```powershell
git --version
```

You should see something like: `git version 2.x.x`

### 3. Navigate to Project Directory

```powershell
cd "C:\Users\USER\Desktop\rork-dietku-clone-356-main"
```

### 4. Run the Setup Script (Optional)

```powershell
.\push-to-github.ps1
```

Or follow manual steps below:

### 5. Manual Setup (Alternative)

**Initialize Git repository:**
```powershell
git init
```

**Add remote repository:**
```powershell
git remote add origin https://github.com/ktimothybudi-source/rork-dietku-clone-356.git
```

**Stage all files:**
```powershell
git add .
```

**Create initial commit:**
```powershell
git commit -m "Initial commit: Complete Rork Dietku Clone with backend setup"
```

**Set main branch:**
```powershell
git branch -M main
```

**Push to GitHub:**
```powershell
git push -u origin main
```

### 6. Authentication

When you run `git push`, you'll be prompted for credentials:

**Use Personal Access Token (Recommended):**
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: `rork-dietku-clone`
4. Select scope: `repo` (full control)
5. Click "Generate token"
6. **Copy the token immediately** (you won't see it again)
7. When prompted for password, paste the token

**Or use GitHub CLI:**
```powershell
# Install GitHub CLI
winget install GitHub.cli

# Authenticate
gh auth login

# Then push
git push -u origin main
```

## Troubleshooting

### "Repository not found"
- Make sure the repository exists at: https://github.com/ktimothybudi-source/rork-dietku-clone-356
- Verify you have access to the repository
- Check the URL is correct

### "Permission denied"
- Use Personal Access Token instead of password
- Make sure token has `repo` scope

### "Git is not recognized"
- Git is not installed or not in PATH
- Restart PowerShell after installing Git
- Or add Git to PATH manually

### "Remote origin already exists"
```powershell
git remote set-url origin https://github.com/ktimothybudi-source/rork-dietku-clone-356.git
```

## Verify Success

After pushing, check:
1. Go to: https://github.com/ktimothybudi-source/rork-dietku-clone-356
2. Verify all files are present
3. Check that `.env` is NOT visible (it's in .gitignore)

## What Gets Pushed

✅ All source code
✅ Backend implementation
✅ Database schemas
✅ Documentation
✅ Configuration files

❌ `.env` file (excluded for security)
❌ `node_modules/` (excluded)
❌ Build artifacts (excluded)

## Next Steps

After pushing:
1. Set up environment variables in GitHub Secrets (for CI/CD)
2. Configure branch protection rules
3. Add collaborators if needed
4. Set up GitHub Actions for automated testing (optional)
