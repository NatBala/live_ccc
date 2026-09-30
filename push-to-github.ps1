# Windows: creates the GitHub repo and pushes this code.  Usage: .\push-to-github.ps1 [-Name live_ccc] [-Visibility private] [-Owner org]
param([string]$Name = "live_ccc", [string]$Visibility = "private", [string]$Owner = "")
$target = if ($Owner) { "$Owner/$Name" } else { $Name }
if (Get-Command gh -ErrorAction SilentlyContinue) {
  gh auth status 2>$null; if ($LASTEXITCODE -ne 0) { gh auth login }
  gh repo create $target "--$Visibility" --source . --remote origin --push --description "Connected Client Experience: live multi-agent demo on a shared AI foundation"
} else {
  Write-Host "Install GitHub CLI from https://cli.github.com, or create an empty repo named $Name on github.com and run:"
  Write-Host "  git remote add origin https://github.com/<owner>/$Name.git"
  Write-Host "  git push -u origin main"
}
