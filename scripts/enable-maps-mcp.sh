#!/bin/bash
# Enable Maps Grounding Lite MCP Policy
# This script enables the MCP policy layer required for Maps Grounding Lite API

PROJECT_ID="${1:-project-nexus-483122}"

echo "========================================"
echo "Maps Grounding Lite MCP Policy Enabler"
echo "========================================"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed or not in PATH"
    echo ""
    echo "Install gcloud from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo "✅ gcloud CLI found"
echo ""

# Step 1: Enable base service
echo "Step 1: Enabling base mapstools.googleapis.com service..."
if gcloud services enable mapstools.googleapis.com --project="$PROJECT_ID" 2>&1; then
    echo "✅ Base service enabled"
else
    echo "⚠️  Base service enablement had issues (may already be enabled)"
fi
echo ""

# Step 2: Enable MCP policy (CRITICAL)
echo "Step 2: Enabling MCP policy (CRITICAL STEP)..."
echo "This is the step that fixes the 403 error!"
echo ""

if gcloud beta services mcp enable mapstools.googleapis.com --project="$PROJECT_ID" 2>&1; then
    echo "✅ MCP policy enabled successfully!"
else
    echo "❌ Error enabling MCP policy"
    exit 1
fi
echo ""

# Step 3: Verify
echo "Step 3: Verifying MCP policy is enabled..."
if gcloud beta services mcp list --enabled --project="$PROJECT_ID" 2>&1 | grep -q "mapstools"; then
    echo "✅ MCP policy verified as enabled"
else
    echo "⚠️  Could not verify MCP policy (may need to wait a few minutes)"
fi
echo ""

# Final instructions
echo "========================================"
echo "✅ Setup Complete!"
echo "========================================"
echo ""
echo "⚠️  IMPORTANT: Wait 3-5 minutes for changes to propagate"
echo "   before testing your /maps command again."
echo ""
echo "Next steps:"
echo "  1. Ensure billing is enabled for project: $PROJECT_ID"
echo "  2. Wait 3-5 minutes"
echo "  3. Test your /maps command"
echo ""
echo "To check billing status:"
echo "  https://console.cloud.google.com/billing/linked?project=$PROJECT_ID"
echo ""
