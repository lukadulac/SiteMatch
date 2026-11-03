"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AuthActionState } from "@/app/(auth)/action-state";
import { confirmationEmailSchema, getVerificationReturnPath } from "@/lib/auth/email-verification";
import { passwordSchema } from "@/lib/auth/password";
import { RECOVERY_COOKIE, RECOVERY_COOKIE_PATH } from "@/lib/auth/recovery-cookie";
import { getLoginHref } from "@/lib/auth/return-url";
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

const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

/**
 * Sets the new password for the recovery session that /auth/recovery opened, then signs
 * out every session so a stolen one stops working, and sends the user to sign in again.
 */
export async function resetPasswordAction(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors, fields: {} };
  }

  const cookieStore = await cookies();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const marker = cookieStore.get(RECOVERY_COOKIE)?.value;

  if (!user || !marker || marker !== user.id) {
    redirect("/forgot-password?error=link");
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") {
      return { fieldErrors: { password: ["Choose a password you have not used before."] }, fields: {} };
    }
    if (error.code === "weak_password") {
      return { fieldErrors: { password: ["Choose a stronger password."] }, fields: {} };
    }
    return { formError: "Your password could not be changed. Request a new reset link and try again.", fieldErrors: {}, fields: {} };
  }

  cookieStore.delete({ name: RECOVERY_COOKIE, path: RECOVERY_COOKIE_PATH });
  await supabase.auth.signOut({ scope: "global" });

  const login = getLoginHref(getVerificationReturnPath(formData.get("next")));
  redirect(`${login}${login.includes("?") ? "&" : "?"}reset=1`);
}
