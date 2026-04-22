"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/app/(auth)/action-state";
import {
  loginAction,
} from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/auth/submit-button";

function fieldError(
  state: AuthActionState,
  name: string,
): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}

export function LoginForm() {
  const [state, formAction] = useActionState(
    loginAction,
    initialAuthActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[#f3fff7]">Email</span>
        <input
          name="email"
          type="email"
          defaultValue={state.fields?.email}
          placeholder="jane@company.com"
          className="w-full rounded-2xl border border-line bg-[#0a120f] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-[#6f8d80] focus:border-accent focus:bg-[#0d1713]"
        />
        {fieldError(state, "email") ? (
          <p className="text-sm text-red-700">{fieldError(state, "email")}</p>
        ) : null}
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[#f3fff7]">Password</span>
        <input
          name="password"
          type="password"
          placeholder="Your password"
          className="w-full rounded-2xl border border-line bg-[#0a120f] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-[#6f8d80] focus:border-accent focus:bg-[#0d1713]"
        />
        {fieldError(state, "password") ? (
          <p className="text-sm text-red-700">{fieldError(state, "password")}</p>
        ) : null}
      </label>

      {state.formError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.formError}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton idleLabel="Log in" pendingLabel="Logging in..." />
        <p className="text-sm text-muted">
          Need an account?{" "}
          <Link
            href="/register"
            className="font-semibold text-secondary hover:text-accent"
          >
            Register
          </Link>
        </p>
      </div>
    </form>
  );
}
