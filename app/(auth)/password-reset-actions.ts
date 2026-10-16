"use server";

import { headers } from "next/headers";
import type { AuthActionState } from "@/app/(auth)/action-state";
import { confirmationEmailSchema } from "@/lib/auth/email-verification";
import { getPasswordRecoveryUrl } from "@/lib/auth/site-url";
import { AUTH_RATE_LIMITS, createRateLimitKey, getRequestIp, recordAuthRateLimitAttempt } from "@/lib/auth/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requestPasswordResetAction(
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
    const redirectTo = getPasswordRecoveryUrl(formData.get("next"));
    const supabase = await createSupabaseServerClient();
    // Share the signup delivery budget, like the confirmation resend; the DB RPC already supports this scope.
    const limit = await recordAuthRateLimitAttempt(supabase, AUTH_RATE_LIMITS.registerIp,
      createRateLimitKey([AUTH_RATE_LIMITS.registerIp.scope, getRequestIp(await headers())]));
    if (limit.allowed) {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo });
      if (error) console.warn("Password reset email was not delivered", { code: error.code ?? "unknown" });
    }

    // Identical response for unknown addresses, delivery errors and throttling: no account enumeration.
    return {
      formSuccess: "If an account exists for this address, check your inbox for a link to reset your password. Check your spam folder too.",
      fieldErrors: {},
      fields,
    };
  } catch {
    return { formError: "Password reset is temporarily unavailable. Please try again later.", fieldErrors: {}, fields };
  }
}
