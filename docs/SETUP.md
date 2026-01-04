# Nexus Hub Setup Guide

Complete setup guide for deploying Nexus Hub to Supabase.

## Prerequisites

- Supabase account and project
- Supabase CLI installed
- Node.js/npm installed

## Step 1: Database Setup (SQL Editor)

Run these SQL scripts in order via Supabase SQL Editor. All SQL files are in the project root:

1. **Core Tables**: `CREATE_TABLES_WITH_LOGOS.sql`
2. **Cache Tables**: `CREATE_CACHE_TABLES.sql`
3. **Job Tables**: `CREATE_JOB_TABLES.sql`
4. **Tool Permissions**: `CREATE_TOOL_PERMISSIONS.sql`

**Note:** If tables already exist, use `ADD_LOGO_SUPPORT.sql` to add logo support.

## Step 2: Set Vault Encryption Key

Generate a 64-character hex key:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$keyHex = ($bytes | ForEach-Object { $_.ToString("x2") }) -join ""
Write-Host $keyHex
```

Set as Supabase secret:
```powershell
supabase secrets set VAULT_ENCRYPTION_KEY=<your-key>
```

Or via Dashboard: Settings → API → Secrets

## Step 3: Deploy Edge Function

**Important:** Run this in your own terminal (not agent mode) to avoid hanging:

```powershell
supabase functions deploy nexus-hub --no-verify-jwt --yes
```

This deploys to: `https://<your-project-ref>.supabase.co/functions/v1/nexus-hub`

## Step 4: Configure Database for pg_net

After deployment, run this SQL (replace with your actual values):

```sql
ALTER DATABASE postgres SET app.edge_function_url = 'https://<your-project-ref>.supabase.co/functions/v1/nexus-hub';
ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
```

Get service role key from: Dashboard → Settings → API

## Step 5: Test Setup

Test health endpoint:

```powershell
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/nexus-hub" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <your-anon-key>" `
  -d '{\"action\": \"health\"}'
```

Expected: `{"status":"healthy","timestamp":"..."}`

## Optional: Storage Setup for Logos

See `docs/STORAGE_SETUP.md` for setting up Supabase Storage for server logos.

## Troubleshooting

- **CLI hanging**: Use your own terminal, not agent mode
- **Deployment fails**: Check you're in project root, verify login with `supabase projects list`
- **pg_net errors**: Verify database settings are set correctly
