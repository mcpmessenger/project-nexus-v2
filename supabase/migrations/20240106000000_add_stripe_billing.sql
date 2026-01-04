-- Migration: Add Stripe Billing Infrastructure
-- Description: Creates tables and functions for Stripe metered billing integration

-- Add stripe_customer_id to auth.users metadata (via a public profile table)
-- Note: Supabase auth.users table exists but we'll create a profiles table for extensibility
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_stripe_customer ON user_profiles(stripe_customer_id);

-- RLS Policy for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own profile
CREATE POLICY "Users can only access their own profile"
  ON user_profiles FOR ALL
  USING (auth.uid() = id);

-- Billing Usage Events Table
-- Local audit trail for all usage events before reporting to Stripe
CREATE TABLE IF NOT EXISTS billing_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_event_id text,  -- Stripe's event ID after successful reporting
  tool_name text NOT NULL,
  server_id text NOT NULL,
  event_name text NOT NULL DEFAULT 'tool_call_executed',
  value numeric NOT NULL DEFAULT 1,
  metadata jsonb,  -- Store model_name, token_count, etc.
  created_at timestamptz DEFAULT now()
);

-- Indexes for billing_usage_events
CREATE INDEX IF NOT EXISTS idx_billing_usage_user_created ON billing_usage_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_billing_usage_stripe_event ON billing_usage_events(stripe_event_id);

-- RLS Policy for billing_usage_events
ALTER TABLE billing_usage_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own usage events
CREATE POLICY "Users can only access their own usage events"
  ON billing_usage_events FOR ALL
  USING (auth.uid() = user_id);

-- User Subscriptions Table
-- Foundation for future subscription management
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  plan_type text NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'premium', 'enterprise')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for user_subscriptions
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe_customer ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- RLS Policy for user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own subscriptions
CREATE POLICY "Users can only access their own subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_profiles
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_user_profiles_updated_at();

-- Function to update updated_at on user_subscriptions
CREATE OR REPLACE FUNCTION update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on user_subscriptions
CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_user_subscriptions_updated_at();

-- Function to create user profile on signup
-- This will be called by the database trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create Stripe customer via Edge Function
CREATE OR REPLACE FUNCTION create_stripe_customer_for_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
BEGIN
  -- Get Edge Function URL and service role key from environment
  edge_function_url := current_setting('app.edge_function_url', true);
  service_role_key := current_setting('app.service_role_key', true);
  
  IF edge_function_url IS NULL OR service_role_key IS NULL THEN
    -- Log warning but don't fail - customer can be created manually later
    RAISE WARNING 'Edge function URL or service role key not configured. Stripe customer creation skipped for user %', p_user_id;
    RETURN;
  END IF;
  
  -- Call Edge Function to create Stripe customer
  PERFORM net.http_post(
    url := edge_function_url || '/create-stripe-customer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'email', (SELECT email FROM auth.users WHERE id = p_user_id),
      'name', (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user_with_stripe()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user profile
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  
  -- Trigger Stripe customer creation (non-blocking)
  -- This will be called asynchronously via pg_net
  PERFORM create_stripe_customer_for_user(NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile and Stripe customer when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_with_stripe();

COMMENT ON TABLE user_profiles IS 'User profile extensions including Stripe customer ID';
COMMENT ON TABLE billing_usage_events IS 'Local audit trail for all billing usage events';
COMMENT ON TABLE user_subscriptions IS 'User subscription management for Stripe subscriptions';
COMMENT ON FUNCTION handle_new_user IS 'Creates user profile when new user signs up';
