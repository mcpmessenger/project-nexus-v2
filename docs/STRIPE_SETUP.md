# Stripe Billing Setup Guide

Complete guide for setting up Stripe metered billing in Project Nexus V2.

## Prerequisites

- Stripe account (sign up at https://stripe.com)
- Stripe API keys (from Stripe Dashboard)
- Supabase project with migrations applied

## Step 1: Configure Stripe Meter

Before integrating, you must create a Meter in your Stripe Dashboard:

1. Go to **Stripe Dashboard** → **Billing** → **Meters**
2. Click **Create Meter**
3. Configure:
   - **Meter Name**: `Nexus Tool Calls`
   - **Event Name**: `tool_call_executed` (must match `STRIPE_METER_EVENT_NAME` env var)
   - **Aggregation**: Choose one:
     - **Sum**: Total count of all tool calls
     - **Unique**: Count of unique tools used
   - **Dimensions** (optional): Add `server_id` and `tool_name` for detailed reporting

4. Save the meter

## Step 2: Set Environment Variables

### Next.js Environment Variables

Add to `.env.local`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Your Stripe publishable key (for future frontend integration)
STRIPE_METER_EVENT_NAME=tool_call_executed  # Must match the meter event name in Stripe
STRIPE_WEBHOOK_SECRET=whsec_...  # For webhook verification (optional, for future use)

# Supabase Configuration (if not already set)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### Supabase Edge Function Secrets

Set secrets for Edge Functions:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_METER_EVENT_NAME=tool_call_executed
```

Or via Dashboard: **Settings** → **API** → **Secrets**

## Step 3: Deploy Edge Functions

Deploy the Stripe customer creation function:

```bash
supabase functions deploy create-stripe-customer --no-verify-jwt --yes
```

This function is automatically called when new users sign up via the database trigger.

## Step 4: Configure Database for Stripe Customer Creation

Update the database settings to point to your Edge Function:

```sql
-- Update the edge function URL if needed (should already be set from nexus-hub setup)
ALTER DATABASE postgres SET app.edge_function_url = 'https://<your-project-ref>.supabase.co/functions/v1';
ALTER DATABASE postgres SET app.service_role_key = '<your-service-role-key>';
```

The trigger `on_auth_user_created` will automatically:
1. Create a user profile in `user_profiles` table
2. Call the `create-stripe-customer` Edge Function
3. Store the Stripe customer ID in the user profile

## Step 5: Verify Setup

### Test Stripe Customer Creation

1. Create a new user account in your app
2. Check Supabase Dashboard → **Table Editor** → `user_profiles`
3. Verify `stripe_customer_id` is populated
4. Check Stripe Dashboard → **Customers** to see the new customer

### Test Usage Reporting

1. Make a tool call through your MCP interface
2. Check Supabase Dashboard → **Table Editor** → `billing_usage_events`
3. Verify a new event was created
4. Check Stripe Dashboard → **Billing** → **Meter Events** to see the event

## How It Works

### Automatic Customer Creation

When a user signs up:
1. Database trigger `on_auth_user_created` fires
2. Creates profile in `user_profiles` table
3. Calls `create-stripe-customer` Edge Function via `pg_net`
4. Edge Function creates Stripe Customer
5. Updates `user_profiles.stripe_customer_id`

### Usage Reporting

Every tool call automatically:
1. Executes the tool (MCP server call)
2. Logs usage to `billing_usage_events` table (audit trail)
3. Reports to Stripe Meter Events API (non-blocking)
4. Updates `billing_usage_events.stripe_event_id` on success

**Important**: Usage reporting is **non-blocking**. If Stripe reporting fails, the tool call still succeeds. This ensures reliability.

## Integration Points

Usage is reported from three locations:

1. **Direct MCP Route** (`app/api/mcp/route.ts`)
   - When tools are called directly via the MCP API

2. **Hub Tool Invocation** (`supabase/functions/nexus-hub/lib/hub.ts`)
   - When tools are called via the Nexus Hub

3. **Async Job Execution** (`supabase/functions/nexus-hub/lib/job_queue.ts`)
   - When long-running tools complete (e.g., Playwright)

## Pricing Models Supported

The infrastructure supports all three pricing models:

### 1. Margin Model
- Charge markup on LLM token costs
- Track `token_count` in usage metadata
- Implement pricing logic in Stripe Dashboard or webhook handlers

### 2. Premium Tool Marketplace
- Use `user_subscriptions.plan_type` to gate tool access
- Free tier: Standard tools only
- Paid tier: Premium MCP servers unlocked

### 3. Enterprise Model
- Flat monthly fee per seat (`user_subscriptions`)
- Metered billing on top for AI compute
- Track both subscription and usage events

## Monitoring & Debugging

### View Usage Events

```sql
-- View recent usage events
SELECT 
  u.email,
  bue.tool_name,
  bue.server_id,
  bue.created_at,
  bue.stripe_event_id
FROM billing_usage_events bue
JOIN auth.users u ON u.id = bue.user_id
ORDER BY bue.created_at DESC
LIMIT 100;
```

### Check Users Without Stripe Customers

```sql
-- Find users without Stripe customers
SELECT u.id, u.email, up.stripe_customer_id
FROM auth.users u
LEFT JOIN user_profiles up ON up.id = u.id
WHERE up.stripe_customer_id IS NULL;
```

### Manually Create Stripe Customer

If a user doesn't have a Stripe customer, you can manually trigger creation:

```bash
curl -X POST "https://<your-project-ref>.supabase.co/functions/v1/create-stripe-customer" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service-role-key>" \
  -d '{"user_id": "<user-uuid>", "email": "user@example.com", "name": "User Name"}'
```

## Troubleshooting

### Users Not Getting Stripe Customers

1. Check Edge Function logs in Supabase Dashboard
2. Verify `STRIPE_SECRET_KEY` is set correctly
3. Check database settings for `app.edge_function_url` and `app.service_role_key`
4. Verify `pg_net` extension is enabled

### Usage Events Not Appearing in Stripe

1. Check `billing_usage_events` table for local events
2. Verify `STRIPE_SECRET_KEY` is set in both Next.js and Edge Functions
3. Check `STRIPE_METER_EVENT_NAME` matches the meter in Stripe Dashboard
4. Verify user has a `stripe_customer_id` in `user_profiles`
5. Check Edge Function logs for Stripe API errors

### Rate Limiting

The system includes rate limiting per server. To add subscription-based limits:

1. Update `checkRateLimit()` in `supabase/functions/nexus-hub/lib/rate_limiter.ts`
2. Query `user_subscriptions` table for plan limits
3. Enforce different limits based on `plan_type`

## Next Steps

- Set up Stripe webhooks for subscription events
- Create usage dashboard UI component
- Implement tiered pricing logic
- Add token-based billing for LLM margin model
