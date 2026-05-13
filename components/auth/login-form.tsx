"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
	initialAuthActionState,
	type AuthActionState,
} from "@/app/(auth)/action-state";
import { loginAction } from "@/app/(auth)/actions";

function fieldError(state: AuthActionState, name: string): string | undefined {
	return state.fieldErrors?.[name]?.[0];
}

export function LoginForm() {
	const [state, formAction] = useActionState(
		loginAction,
		initialAuthActionState,
	);

	return (
		<form action={formAction} className="max-w-112.5 mx-auto">
			<section className="p-2 ">
				<div className="flex flex-col gap-2">
					<div className="my-2 flex w-full flex-col gap-2">
						<label htmlFor="email">Email</label>
						<input
							id="email"
							name="email"
							type="email"
							defaultValue={state.fields?.email}
							placeholder="youremail@example.com"
							className="w-full rounded-2xl border p-2.5 placeholder:pl-2"
						/>
						{fieldError(state, "email") ? (
							<p>{fieldError(state, "email")}</p>
						) : null}
					</div>

					<div className="my-2 flex w-full flex-col gap-2">
						<label htmlFor="password">Password</label>
						<input
							id="password"
							name="password"
							type="password"
							placeholder="Your password"
							className="w-full rounded-2xl border p-2.5 placeholder:pl-2"
						/>
						{fieldError(state, "password") ? (
							<p>{fieldError(state, "password")}</p>
						) : null}
					</div>
				</div>
			</section>

			{state.formError ? (
				<div className="my-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
					{state.formError}
				</div>
			) : null}

			<div className="my-2 w-full">
				<button
					className="w-full cursor-pointer rounded-2xl bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 p-2.5 text-2xl text-white"
					type="submit"
				>
					Sign in
				</button>
					<p className="mt-4 text-center text-sm text-muted-foreground">
						Don&apos;t have an account?{" "}
					<Link href="/register" className="font-semibold text-black">
						Register
					</Link>
				</p>
			</div>
		</form>
	);
}
