"use client";

import { useActionState } from "react";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { resetPasswordAction } from "@/app/(auth)/password-reset-actions";

const inputClass =
	"min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-zinc-200";

export function ResetPasswordForm({ next }: { next?: string | null }) {
	const [state, formAction, pending] = useActionState(resetPasswordAction, initialAuthActionState);
	const passwordError = state.fieldErrors?.password?.[0];
	const confirmError = state.fieldErrors?.confirmPassword?.[0];

	return (
		<section className="mx-auto w-full max-w-md py-8">
			<h1 className="text-3xl font-semibold text-black">Choose a new password</h1>
			<p className="mt-3 text-sm leading-6 text-secondary">
				Use at least 8 characters. After saving, you will be signed out everywhere and can sign in with the new password.
			</p>

			<form action={formAction} className="mt-6 space-y-4">
				{next ? <input type="hidden" name="next" value={next} /> : null}
				<div className="space-y-2">
					<label htmlFor="reset-password" className="block text-sm font-medium text-black">
						New password <span className="text-red-700">*</span>
					</label>
					<input
						id="reset-password"
						name="password"
						type="password"
						autoComplete="new-password"
						required
						minLength={8}
						maxLength={72}
						aria-invalid={Boolean(passwordError)}
						aria-describedby={passwordError ? "reset-password-error" : undefined}
						className={inputClass}
					/>
					{passwordError ? <p id="reset-password-error" className="text-sm text-red-700">{passwordError}</p> : null}
				</div>
				<div className="space-y-2">
					<label htmlFor="reset-password-confirm" className="block text-sm font-medium text-black">
						Confirm new password <span className="text-red-700">*</span>
					</label>
					<input
						id="reset-password-confirm"
						name="confirmPassword"
						type="password"
						autoComplete="new-password"
						required
						maxLength={72}
						aria-invalid={Boolean(confirmError)}
						aria-describedby={confirmError ? "reset-password-confirm-error" : undefined}
						className={inputClass}
					/>
					{confirmError ? <p id="reset-password-confirm-error" className="text-sm text-red-700">{confirmError}</p> : null}
				</div>
				<button
					type="submit"
					disabled={pending}
					className="min-h-11 w-full rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{pending ? "Saving..." : "Save new password"}
				</button>
				{state.formError ? (
					<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.formError}</p>
				) : null}
			</form>
		</section>
	);
}
