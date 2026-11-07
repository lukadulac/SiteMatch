"use client";

import Link from "next/link";
import { useActionState } from "react";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { requestPasswordResetAction } from "@/app/(auth)/password-reset-actions";
import { getLoginHref } from "@/lib/auth/return-url";

type ForgotPasswordFormProps = {
	next?: string | null;
	invalidLink?: boolean;
};

export function ForgotPasswordForm({ next, invalidLink = false }: ForgotPasswordFormProps) {
	const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialAuthActionState);
	const emailError = state.fieldErrors?.email?.[0];

	return (
		<section className="mx-auto w-full max-w-md py-8">
			<h1 className="text-3xl font-semibold text-black">Reset your password</h1>
			<p className="mt-3 text-sm leading-6 text-secondary">
				Enter the email address you registered with and we will send you a link to choose a new password.
			</p>

			{invalidLink ? (
				<p role="alert" className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
					This reset link could not be used. It may have expired or already been used. Request a new one below.
				</p>
			) : null}

			<form action={formAction} className="mt-6 space-y-4">
				{next ? <input type="hidden" name="next" value={next} /> : null}
				<div className="space-y-2">
					<label htmlFor="forgot-password-email" className="block text-sm font-medium text-black">
						Email address <span className="text-red-700">*</span>
					</label>
					<input
						id="forgot-password-email"
						name="email"
						type="email"
						autoComplete="email"
						required
						maxLength={254}
						defaultValue={state.fields?.email ?? ""}
						placeholder="you@example.com"
						aria-invalid={Boolean(emailError)}
						aria-describedby={emailError ? "forgot-password-email-error" : undefined}
						className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-zinc-200"
					/>
					{emailError ? (
						<p id="forgot-password-email-error" className="text-sm text-red-700">{emailError}</p>
					) : null}
				</div>
				<button
					type="submit"
					disabled={pending}
					className="min-h-11 w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{pending ? "Sending..." : "Send reset link"}
				</button>
				{state.formSuccess ? (
					<p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{state.formSuccess}</p>
				) : null}
				{state.formError ? (
					<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.formError}</p>
				) : null}
			</form>
			<p className="mt-6 text-sm">
				<Link href={getLoginHref(next)} className="font-semibold text-black underline underline-offset-4">Back to sign in</Link>
			</p>
		</section>
	);
}
