/**
 * Stripe Billing Service for Next.js
 * Handles reporting tool call usage to Stripe Meter Events API
 */

import Stripe from "stripe";

// Initialize Stripe client (lazy initialization)
let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.warn("STRIPE_SECRET_KEY not configured. Billing events will not be reported to Stripe.");
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2024-12-18.acacia",
    });
  }

  return stripeClient;
}

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
 * Report tool call usage to Stripe Meter Events API
 * This is non-blocking - failures are logged but don't throw errors
 */
export async function reportToolCallUsage(
  params: ReportUsageParams
): Promise<{ success: boolean; stripeEventId?: string; error?: string }> {
  const stripe = getStripeClient();
  if (!stripe) {
    return { success: false, error: "Stripe not configured" };
  }

  const eventName = process.env.STRIPE_METER_EVENT_NAME || "tool_call_executed";
  const stripeCustomerId = await getStripeCustomerId(params.userId);

  if (!stripeCustomerId) {
    // User doesn't have a Stripe customer yet - this is OK for new users
    // The customer will be created on next signup trigger
    console.warn(`No Stripe customer ID found for user ${params.userId}. Skipping usage report.`);
    return { success: false, error: "No Stripe customer ID" };
  }

  try {
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

/**
 * Get Stripe customer ID for a user
 * This would typically query your database
 */
async function getStripeCustomerId(userId: string): Promise<string | null> {
  try {
    // In a real implementation, you'd query your database here
    // For now, we'll use an API call to get it
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?id=eq.${userId}&select=stripe_customer_id`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[0]?.stripe_customer_id || null;
  } catch (error) {
    console.error("Failed to get Stripe customer ID:", error);
    return null;
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
 * Log usage event to local database for audit trail
 * This should be called before reporting to Stripe
 */
export async function logUsageEventToDatabase(
  params: ReportUsageParams & { stripeEventId?: string }
): Promise<void> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/billing_usage_events`,
      {
        method: "POST",
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          user_id: params.userId,
          stripe_event_id: params.stripeEventId || null,
          tool_name: params.toolName,
          server_id: params.serverId,
          event_name: process.env.STRIPE_METER_EVENT_NAME || "tool_call_executed",
          value: 1,
          metadata: params.metadata || {},
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to log usage event to database:", await response.text());
    }
  } catch (error) {
    console.error("Error logging usage event to database:", error);
    // Non-blocking - continue even if logging fails
  }
}
