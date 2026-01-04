/**
 * Stripe Billing Service for Supabase Edge Functions
 * Handles reporting tool call usage to Stripe Meter Events API
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";

export interface ReportUsageParams {
  userId: string;
  toolName: string;
  serverId: string;
  metadata?: {
    model_name?: string;
    token_count?: number;
    [key: string]: unknown;
  };
}

/**
 * Get Stripe customer ID for a user from database
 */
async function getStripeCustomerId(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.stripe_customer_id || null;
}

/**
 * Log usage event to local database for audit trail
 */
async function logUsageEventToDatabase(
  supabase: ReturnType<typeof createClient>,
  params: ReportUsageParams & { stripeEventId?: string }
): Promise<void> {
  const eventName = Deno.env.get("STRIPE_METER_EVENT_NAME") || "tool_call_executed";

  const { error } = await supabase.from("billing_usage_events").insert({
    user_id: params.userId,
    stripe_event_id: params.stripeEventId || null,
    tool_name: params.toolName,
    server_id: params.serverId,
    event_name: eventName,
    value: 1,
    metadata: params.metadata || {},
  });

  if (error) {
    console.error("Failed to log usage event to database:", error);
    // Non-blocking - continue even if logging fails
  }
}

/**
 * Create meter event with exponential backoff retry
 */
async function createMeterEventWithRetry(
  stripe: Stripe,
  params: Stripe.Billing.MeterEventCreateParams,
  maxRetries = 3
): Promise<Stripe.Billing.MeterEvent> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await stripe.billing.meterEvents.create(params);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      // Don't retry on client errors (4xx)
      if (error instanceof Stripe.errors.StripeError && error.statusCode && error.statusCode < 500) {
        throw error;
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 100;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Failed to create meter event after retries");
}

/**
 * Report tool call usage to Stripe Meter Events API
 * This is non-blocking - failures are logged but don't throw errors
 */
export async function reportToolCallUsage(
  supabase: ReturnType<typeof createClient>,
  params: ReportUsageParams
): Promise<{ success: boolean; stripeEventId?: string; error?: string }> {
  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    console.warn("STRIPE_SECRET_KEY not configured. Billing events will not be reported to Stripe.");
    return { success: false, error: "Stripe not configured" };
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2024-12-18.acacia",
  });

  const eventName = Deno.env.get("STRIPE_METER_EVENT_NAME") || "tool_call_executed";
  const stripeCustomerId = await getStripeCustomerId(supabase, params.userId);

  if (!stripeCustomerId) {
    // User doesn't have a Stripe customer yet - this is OK for new users
    // The customer will be created on next signup trigger
    console.warn(`No Stripe customer ID found for user ${params.userId}. Skipping usage report.`);
    // Still log to database for audit trail
    await logUsageEventToDatabase(supabase, params);
    return { success: false, error: "No Stripe customer ID" };
  }

  try {
    // Log to database first (audit trail)
    await logUsageEventToDatabase(supabase, params);

    // Create meter event with retry logic
    const event = await createMeterEventWithRetry(stripe, {
      event_name: eventName,
      payload: {
        value: "1", // Increment by 1
        stripe_customer_id: stripeCustomerId,
      },
      identifier: `${params.userId}-${Date.now()}-${crypto.randomUUID()}`, // Unique identifier for idempotency
      timestamp: Math.floor(Date.now() / 1000),
      metadata: {
        tool_name: params.toolName,
        server_id: params.serverId,
        ...params.metadata,
      },
    });

    // Update database record with Stripe event ID
    const { error: updateError } = await supabase
      .from("billing_usage_events")
      .update({ stripe_event_id: event.id })
      .eq("user_id", params.userId)
      .eq("tool_name", params.toolName)
      .eq("server_id", params.serverId)
      .is("stripe_event_id", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (updateError) {
      console.warn("Failed to update usage event with Stripe event ID:", updateError);
    }

    return {
      success: true,
      stripeEventId: event.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to report usage to Stripe:", errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
