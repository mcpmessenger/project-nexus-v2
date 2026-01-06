# Enable Maps Grounding Lite MCP Policy
# This script enables the MCP policy layer required for Maps Grounding Lite API

param(
    [string]$ProjectId = "project-nexus-483122"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Maps Grounding Lite MCP Policy Enabler" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if gcloud is installed
$gcloudPath = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloudPath) {
    Write-Host "❌ Error: gcloud CLI is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install gcloud from: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ gcloud CLI found" -ForegroundColor Green
Write-Host ""

# Step 1: Enable base service
Write-Host "Step 1: Enabling base mapstools.googleapis.com service..." -ForegroundColor Yellow
$enableBase = gcloud services enable mapstools.googleapis.com --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Base service enabled" -ForegroundColor Green
} else {
    Write-Host "⚠️  Base service enablement result: $enableBase" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Enable MCP policy (CRITICAL)
Write-Host "Step 2: Enabling MCP policy (CRITICAL STEP)..." -ForegroundColor Yellow
Write-Host "This is the step that fixes the 403 error!" -ForegroundColor Cyan
Write-Host ""

$enableMcp = gcloud beta services mcp enable mapstools.googleapis.com --project=$ProjectId 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ MCP policy enabled successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Error enabling MCP policy:" -ForegroundColor Red
    Write-Host $enableMcp -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Verify
Write-Host "Step 3: Verifying MCP policy is enabled..." -ForegroundColor Yellow
$verify = gcloud beta services mcp list --enabled --project=$ProjectId 2>&1
if ($verify -match "mapstools") {
    Write-Host "✅ MCP policy verified as enabled" -ForegroundColor Green
} else {
    Write-Host "⚠️  Verification output: $verify" -ForegroundColor Yellow
}
Write-Host ""

# Final instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: Wait 3-5 minutes for changes to propagate" -ForegroundColor Yellow
Write-Host "   before testing your /maps command again." -ForegroundColor Yellow
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Ensure billing is enabled for project: $ProjectId" -ForegroundColor White
Write-Host "  2. Wait 3-5 minutes" -ForegroundColor White
Write-Host "  3. Test your /maps command" -ForegroundColor White
Write-Host ""
Write-Host "To check billing status:" -ForegroundColor Cyan
Write-Host "  https://console.cloud.google.com/billing/linked?project=$ProjectId" -ForegroundColor White
Write-Host ""
