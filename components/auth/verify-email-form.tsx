"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { initialAuthActionState, type AuthActionState } from "@/app/(auth)/action-state";
import { resendConfirmationAction } from "@/app/(auth)/verification-actions";
import { getLoginHref } from "@/lib/auth/return-url";

type VerifyEmailFormProps = {
  email?: string;
  next?: string | null;
  registered?: boolean;
  invalidLink?: boolean;
};

export function VerifyEmailForm({ email = "", next, registered = false, invalidLink = false }: VerifyEmailFormProps) {
  const [cooldown, setCooldown] = useState(registered ? 60 : 0);
  const [state, formAction, pending] = useActionState(async (previous: AuthActionState, data: FormData) => {
    const result = await resendConfirmationAction(previous, data);
    if (result.resendAfter) setCooldown(Math.max(0, Math.ceil((result.resendAfter - Date.now()) / 1000)));
    return result;
  }, initialAuthActionState);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const emailError = state.fieldErrors?.email?.[0];

  return (
    <section className="mx-auto w-full max-w-md py-8">
      <h1 className="text-3xl font-semibold text-black">{registered ? "Check your inbox" : "Confirm your email"}</h1>
      <p className="mt-3 text-sm leading-6 text-secondary">
        {registered ? "Confirm your email address using the link in your inbox, then sign in to get started. Check your spam folder if you cannot find it." : "Enter the email address you used to register and we will send a new confirmation link if your account is awaiting confirmation."}
      </p>

      {invalidLink ? (
        <p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This link could not be completed. It may have expired, already been used, or been opened in a different browser. Try signing in, or request a new confirmation email below.
        </p>
      ) : null}

      <form action={formAction} className="mt-6 space-y-4">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="space-y-2">
          <label htmlFor="confirmation-email" className="block text-sm font-medium text-black">Email address <span className="text-red-700">*</span></label>
          <input id="confirmation-email" name="email" type="email" autoComplete="email" required maxLength={254}
            defaultValue={state.fields?.email ?? email} placeholder="you@example.com" aria-invalid={Boolean(emailError)} aria-describedby={emailError ? "confirmation-email-error" : undefined}
            className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-zinc-200" />
          {emailError ? <p id="confirmation-email-error" className="text-sm text-red-700">{emailError}</p> : null}
        </div>
        <button type="submit" disabled={pending || cooldown > 0}
          className="min-h-11 w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Sending..." : cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend confirmation email"}
        </button>
        {state.formSuccess ? <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{state.formSuccess}</p> : null}
        {state.formError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.formError}</p> : null}
      </form>
      <p className="mt-6 text-sm"><Link href={getLoginHref(next)} className="font-semibold text-black underline underline-offset-4">Back to sign in</Link></p>
    </section>
  );
}
