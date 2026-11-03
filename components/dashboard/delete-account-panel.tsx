"use client";

import { useActionState, useState } from "react";
import { deleteAccountAction, type DeleteAccountState } from "@/app/dashboard/account-actions";

const inputClass =
	"min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-zinc-200";

/** The last panel on both profile pages. Closed by default so nobody deletes by accident. */
export function DeleteAccountPanel({ email }: { email: string }) {
	const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(deleteAccountAction, {});
	const [open, setOpen] = useState(false);
	const emailError = state.fieldErrors?.email?.[0];
	const passwordError = state.fieldErrors?.password?.[0];

	return (
		<section aria-labelledby="delete-account-heading" className="min-w-0 rounded-lg border border-red-200 bg-white p-5 sm:p-6">
			<h2 id="delete-account-heading" className="text-lg font-semibold text-black">Delete account</h2>
			<p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
				Your profile, published services and open briefs are removed, and you can no longer sign in. People you
				worked with keep their conversations, where you appear as &ldquo;Deleted user&rdquo;. This cannot be undone.
			</p>

			{open ? (
				<form action={formAction} className="mt-5 max-w-md space-y-4">
					<div className="space-y-2">
						<label htmlFor="delete-account-email" className="block text-sm font-medium text-black">
							Type your email <span className="font-normal text-secondary">({email})</span>
						</label>
						<input
							id="delete-account-email"
							name="email"
							type="email"
							autoComplete="off"
							required
							maxLength={254}
							aria-invalid={Boolean(emailError)}
							aria-describedby={emailError ? "delete-account-email-error" : undefined}
							className={inputClass}
						/>
						{emailError ? <p id="delete-account-email-error" className="text-sm text-red-700">{emailError}</p> : null}
					</div>
					<div className="space-y-2">
						<label htmlFor="delete-account-password" className="block text-sm font-medium text-black">
							Your password
						</label>
						<input
							id="delete-account-password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
							maxLength={72}
							aria-invalid={Boolean(passwordError)}
							aria-describedby={passwordError ? "delete-account-password-error" : undefined}
							className={inputClass}
						/>
						{passwordError ? <p id="delete-account-password-error" className="text-sm text-red-700">{passwordError}</p> : null}
					</div>
					{state.formError ? (
						<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{state.formError}</p>
					) : null}
					<div className="flex flex-wrap gap-3">
						<button
							type="submit"
							disabled={pending}
							className="min-h-11 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white transition hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
						>
							{pending ? "Deleting..." : "Delete my account"}
						</button>
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="min-h-11 rounded-lg border border-line-strong px-4 text-sm font-semibold text-black transition hover:bg-zinc-50"
						>
							Cancel
						</button>
					</div>
				</form>
			) : (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="mt-5 min-h-11 rounded-lg border border-red-300 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
				>
					Delete my account…
				</button>
			)}
		</section>
	);
}
