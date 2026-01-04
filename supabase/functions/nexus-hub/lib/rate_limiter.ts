/**
 * Rate Limiter
 * Handles rate limiting per server to prevent abuse
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Check if request is within rate limit
 * Returns true if within limit, false if exceeded
 */
export async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  serverId: string,
  userId: string,
  limitPerMinute: number
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_server_id: serverId,
      p_user_id: userId,
      p_limit_per_minute: limitPerMinute,
    });

    if (error) {
      // On error, allow request (fail open)
      console.error("Rate limit check failed:", error);
      return true;
    }

    return data === true;
  } catch (error) {
    // On exception, allow request (fail open)
    console.error("Rate limit check exception:", error);
    return true;
  }
}
