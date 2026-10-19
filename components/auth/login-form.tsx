"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
	initialAuthActionState,
	type AuthActionState,
} from "@/app/(auth)/action-state";
import { loginAction } from "@/app/(auth)/actions";
import { getForgotPasswordHref, getRegistrationHref, getVerificationHref } from "@/lib/auth/email-verification";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

function fieldError(state: AuthActionState, name: string): string | undefined {
	return state.fieldErrors?.[name]?.[0];
}

type LoginFormProps = {
	next?: string | null;
};

function LoginSubmitButton() {
	const { pending } = useFormStatus();
	return (
		<button
			className="min-h-11 w-full rounded-lg bg-linear-to-r from-violet-500 to-pink-500 px-4 text-base font-semibold text-white disabled:cursor-wait disabled:opacity-60"
			type="submit"
			disabled={pending}
			aria-busy={pending}
		>
			{pending ? "Signing in..." : "Sign in"}
		</button>
	);
}

export function LoginForm({ next }: LoginFormProps) {
	const [state, formAction] = useActionState(
		loginAction,
		initialAuthActionState,
	);
	if (state.verificationRequired) {
		return <VerifyEmailForm email={state.fields?.email} next={next} />;
	}

	return (
		<form action={formAction} className="max-w-112.5 mx-auto">
			{next ? <input type="hidden" name="next" value={next} /> : null}
			<section className="p-2 ">
				<div className="flex flex-col gap-2">
					<div className="my-2 flex w-full flex-col gap-2">
						<label htmlFor="email">Email</label>
						<input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							defaultValue={state.fields?.email}
							required
							aria-invalid={Boolean(fieldError(state, "email"))}
							aria-describedby={fieldError(state, "email") ? "login-email-error" : undefined}
							placeholder="youremail@example.com"
							className="w-full rounded-2xl border p-2.5 placeholder:pl-2"
						/>
						{fieldError(state, "email") ? (
							<p id="login-email-error" role="alert" className="text-sm text-red-700">{fieldError(state, "email")}</p>
						) : null}
					</div>

					<div className="my-2 flex w-full flex-col gap-2">
						<label htmlFor="password">Password</label>
						<input
							id="password"
							name="password"
							type="password"
							autoComplete="current-password"
							required
							aria-invalid={Boolean(fieldError(state, "password"))}
							aria-describedby={fieldError(state, "password") ? "login-password-error" : undefined}
							placeholder="Your password"
							className="w-full rounded-2xl border p-2.5 placeholder:pl-2"
						/>
						{fieldError(state, "password") ? (
							<p id="login-password-error" role="alert" className="text-sm text-red-700">{fieldError(state, "password")}</p>
						) : null}
						<Link href={getForgotPasswordHref(next)} className="self-end text-sm font-semibold text-black underline underline-offset-4">
							Forgot password?
						</Link>
					</div>
				</div>
			</section>

			{state.formError ? (
				<div role="alert" className="my-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
					{state.formError}
				</div>
			) : null}
			<p className="my-3 text-sm text-secondary">
				Email not confirmed? <Link href={getVerificationHref(next)} className="font-semibold text-black underline underline-offset-4">Resend confirmation</Link>
			</p>

			<div className="my-2 w-full">
				<LoginSubmitButton />
					<p className="mt-4 text-center text-sm text-muted-foreground">
						Don&apos;t have an account?{" "}
					<Link href={getRegistrationHref(next)} className="font-semibold text-black">
						Register
					</Link>
				</p>
			</div>
		</form>
	);
}
