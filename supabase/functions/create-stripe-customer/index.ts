/**
 * Create Stripe Customer Edge Function
 * Called when a new user signs up to create a Stripe Customer
 */

import { serve } from "jsr:@supabase/functions-js/edge";
import { createClient } from "jsr:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.4.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    // Verify service role key for internal calls
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // For internal calls (from database trigger), verify service role
    if (authHeader && authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey!);

    // Parse request body
    const body = await req.json();
    const { user_id, email, name } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user already has a Stripe customer ID
    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user_id)
      .single();

    if (existingProfile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          success: true,
          stripe_customer_id: existingProfile.stripe_customer_id,
          message: "Customer already exists",
        }),
        {
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-12-18.acacia",
    });

    // Get user email from auth.users if not provided
    let userEmail = email;
    let userName = name;

    if (!userEmail || !userName) {
      const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
      if (authUser?.user) {
        userEmail = userEmail || authUser.user.email || undefined;
        userName = userName || authUser.user.user_metadata?.full_name || authUser.user.user_metadata?.name || undefined;
      }
    }

    // Create Stripe Customer
    const customer = await stripe.customers.create({
      email: userEmail,
      name: userName,
      metadata: {
        supabase_user_id: user_id,
      },
    });

    // Update user profile with Stripe customer ID
    const { error: updateError } = await supabase
      .from("user_profiles")
      .upsert({
        id: user_id,
        stripe_customer_id: customer.id,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error("Failed to update user profile:", updateError);
      // Still return success since Stripe customer was created
      // The customer ID can be manually synced later
    }

    return new Response(
      JSON.stringify({
        success: true,
        stripe_customer_id: customer.id,
      }),
      {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to create Stripe customer",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }
});
