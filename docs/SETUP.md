# Nexus Hub Setup Guide

Complete setup guide for deploying Nexus Hub to Supabase.

## Prerequisites

- Supabase account and project
- Supabase CLI installed
- Node.js/npm installed

## Step 1: Database Setup (SQL Editor)

Run these SQL scripts in order via Supabase SQL Editor. All SQL files are in the `supabase/migrations/` directory:

1. **Core Tables**: `20240101000000_create_core_tables.sql`
2. **Cache Tables**: `20240102000000_create_cache_tables.sql`
3. **Job Tables**: `20240103000000_create_job_tables.sql`
4. **Tool Permissions**: `20240104000000_create_tool_permissions.sql`
5. **Stripe Billing**: `20240106000000_add_stripe_billing.sql` (optional, for monetization)

**Note:** If using migrations, run `supabase db reset` or apply migrations via Supabase Dashboard → SQL Editor.

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

## Step 3: Deploy Edge Functions

**Important:** Run this in your own terminal (not agent mode) to avoid hanging:

```powershell
# Deploy main hub function
supabase functions deploy nexus-hub --no-verify-jwt --yes

# Deploy Stripe customer creation function (if using billing)
supabase functions deploy create-stripe-customer --no-verify-jwt --yes
```

This deploys to:
- Nexus Hub: `https://<your-project-ref>.supabase.co/functions/v1/nexus-hub`
- Stripe Customer: `https://<your-project-ref>.supabase.co/functions/v1/create-stripe-customer`

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

## Optional: Stripe Billing Setup

See `docs/STRIPE_SETUP.md` for complete Stripe metered billing integration guide.

## Troubleshooting

- **CLI hanging**: Use your own terminal, not agent mode
- **Deployment fails**: Check you're in project root, verify login with `supabase projects list`
- **pg_net errors**: Verify database settings are set correctly
