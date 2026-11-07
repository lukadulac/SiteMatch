"use server";

import { headers } from "next/headers";
import type { AuthActionState } from "@/app/(auth)/action-state";
import { confirmationEmailSchema } from "@/lib/auth/email-verification";
import { getEmailConfirmationUrl } from "@/lib/auth/site-url";
import { AUTH_RATE_LIMITS, createRateLimitKey, getRequestIp, recordAuthRateLimitAttempt } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function resendConfirmationAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const rawEmail = formData.get("email");
  const parsed = confirmationEmailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { fieldErrors: { email: ["Enter a valid email address."] }, fields: { email: typeof rawEmail === "string" ? rawEmail : "" } };
  }

  const fields = { email: parsed.data };
  try {
    const emailRedirectTo = getEmailConfirmationUrl(formData.get("next"));
    const supabase = await createSupabaseServerClient();
    // Share the existing signup delivery budget; the DB RPC already supports this scope.
    const limit = await recordAuthRateLimitAttempt(supabase, AUTH_RATE_LIMITS.registerIp,
      createRateLimitKey([AUTH_RATE_LIMITS.registerIp.scope, getRequestIp(await headers())]));
    if (limit.allowed) {
      const { error } = await supabase.auth.resend({ type: "signup", email: parsed.data, options: { emailRedirectTo } });
      if (error) console.warn("Confirmation resend was not delivered", { code: error.code ?? "unknown" });
    }

    // Identical response for unknown/confirmed addresses, delivery errors and throttling.
    return {
      formSuccess: "If this address has an account awaiting confirmation, a new email will arrive shortly. Check your spam folder too.",
      fieldErrors: {},
      fields,
      resendAfter: Date.now() + Math.max(60, limit.retryAfterSeconds) * 1000,
    };
  } catch {
    return { formError: "Email confirmation is temporarily unavailable. Please try again later.", fieldErrors: {}, fields };
  }
}
