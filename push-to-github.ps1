# PowerShell script to push code to GitHub repository
# Run this script after installing Git

Write-Host "=== GitHub Repository Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check if Git is installed
try {
    $gitVersion = git --version
    Write-Host "✓ Git is installed: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Git is not installed!" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host "Or run: winget install Git.Git" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Repository URL: https://github.com/ktimothybudi-source/rork-dietku-clone-356" -ForegroundColor Cyan
Write-Host ""

# Check if already a git repository
if (Test-Path ".git") {
    Write-Host "✓ Git repository already initialized" -ForegroundColor Green
} else {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✓ Repository initialized" -ForegroundColor Green
}

# Check if remote exists
$remoteExists = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Remote 'origin' already exists: $remoteExists" -ForegroundColor Green
    Write-Host "Do you want to update it? (y/n)" -ForegroundColor Yellow
    $update = Read-Host
    if ($update -eq "y") {
        git remote set-url origin https://github.com/ktimothybudi-source/rork-dietku-clone-356.git
        Write-Host "✓ Remote updated" -ForegroundColor Green
    }
} else {
    Write-Host "Adding remote repository..." -ForegroundColor Yellow
    git remote add origin https://github.com/ktimothybudi-source/rork-dietku-clone-356.git
    Write-Host "✓ Remote added" -ForegroundColor Green
}

Write-Host ""
Write-Host "Staging all files..." -ForegroundColor Yellow
git add .
Write-Host "✓ Files staged" -ForegroundColor Green

Write-Host ""
Write-Host "Checking status..." -ForegroundColor Yellow
git status

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Review the changes above" -ForegroundColor White
Write-Host "2. Create initial commit:" -ForegroundColor White
Write-Host "   git commit -m 'Initial commit: Complete Rork Dietku Clone with backend setup'" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Push to GitHub:" -ForegroundColor White
Write-Host "   git branch -M main" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "Note: You may need to authenticate with GitHub." -ForegroundColor Yellow
Write-Host "Use a Personal Access Token instead of password." -ForegroundColor Yellow
Write-Host ""
