"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/app/(auth)/action-state";
import {
  registerAction,
} from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/auth/submit-button";

function fieldError(
  state: AuthActionState,
  name: string,
): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}

type TextFieldProps = {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  error?: string;
  placeholder?: string;
  min?: number;
  step?: number;
};

function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  error,
  placeholder,
  min,
  step,
}: TextFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[#f3fff7]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        min={min}
        step={step}
        className="w-full rounded-2xl border border-line bg-[#0a120f] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-[#6f8d80] focus:border-accent focus:bg-[#0d1713]"
      />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </label>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(
    registerAction,
    initialAuthActionState,
  );
  const [role, setRole] = useState(state.fields?.role || "client");
  const currentRole = role === "provider" ? "provider" : "client";

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-3 rounded-[1.5rem] border border-line bg-panel-soft/70 p-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setRole("client")}
          className={`rounded-[1.2rem] px-4 py-4 text-left transition ${
            currentRole === "client"
              ? "bg-accent text-accent-ink"
              : "bg-transparent text-muted hover:bg-white/4 hover:text-foreground"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">
            Client
          </p>
          <p className="mt-2 text-sm leading-6">
            Post projects and hire the right provider.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setRole("provider")}
          className={`rounded-[1.2rem] px-4 py-4 text-left transition ${
            currentRole === "provider"
              ? "bg-accent text-accent-ink"
              : "bg-transparent text-muted hover:bg-white/4 hover:text-foreground"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.18em]">
            Provider
          </p>
          <p className="mt-2 text-sm leading-6">
            Build a profile and get matched with clients.
          </p>
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Full name"
          name="full_name"
          defaultValue={state.fields?.full_name}
          error={fieldError(state, "full_name")}
          placeholder="Jane Doe"
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          defaultValue={state.fields?.email}
          error={fieldError(state, "email")}
          placeholder="jane@company.com"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Password"
          name="password"
          type="password"
          error={fieldError(state, "password")}
          placeholder="At least 8 characters"
        />

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">Account type</span>
          <select
            name="role"
            value={currentRole}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-2xl border border-line bg-[#0a120f] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="client">Client</option>
            <option value="provider">Provider</option>
          </select>
          {fieldError(state, "role") ? (
            <p className="text-sm text-red-700">{fieldError(state, "role")}</p>
          ) : null}
        </label>
      </div>

      {currentRole === "client" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Business name"
            name="business_name"
            defaultValue={state.fields?.business_name}
            error={fieldError(state, "business_name")}
            placeholder="Acme Inc."
          />
          <TextField
            label="Business type"
            name="business_type"
            defaultValue={state.fields?.business_type}
            error={fieldError(state, "business_type")}
            placeholder="SaaS, startup, local business"
          />
          <div className="sm:col-span-2">
            <TextField
              label="Preferred language"
              name="preferred_language"
              defaultValue={state.fields?.preferred_language}
              error={fieldError(state, "preferred_language")}
              placeholder="English"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#f3fff7]">Provider type</span>
            <select
              name="provider_type"
              defaultValue={state.fields?.provider_type || "freelancer"}
              className="w-full rounded-2xl border border-line bg-[#0a120f] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
            >
              <option value="freelancer">Freelancer</option>
              <option value="agency">Agency</option>
              <option value="studio">Studio</option>
            </select>
            {fieldError(state, "provider_type") ? (
              <p className="text-sm text-red-700">
                {fieldError(state, "provider_type")}
              </p>
            ) : null}
          </label>
          <TextField
            label="Years of experience"
            name="years_of_experience"
            type="number"
            min={0}
            step={1}
            defaultValue={state.fields?.years_of_experience}
            error={fieldError(state, "years_of_experience")}
            placeholder="5"
          />
          <div className="sm:col-span-2">
            <TextField
              label="Headline"
              name="headline"
              defaultValue={state.fields?.headline}
              error={fieldError(state, "headline")}
              placeholder="Conversion-focused web designer and developer"
            />
          </div>
          <label className="block space-y-2 sm:col-span-2">
            <span className="text-sm font-medium text-[#f3fff7]">Bio</span>
            <textarea
              name="bio"
              rows={5}
              defaultValue={state.fields?.bio}
              placeholder="Describe your experience, specialties, and the type of clients you help."
              className="w-full rounded-2xl border border-line bg-[#0a120f] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-[#6f8d80] focus:border-accent focus:bg-[#0d1713]"
            />
            {fieldError(state, "bio") ? (
              <p className="text-sm text-red-700">{fieldError(state, "bio")}</p>
            ) : null}
          </label>
          <div className="sm:col-span-2">
            <TextField
              label="Portfolio URL"
              name="portfolio_url"
              type="url"
              defaultValue={state.fields?.portfolio_url}
              error={fieldError(state, "portfolio_url")}
              placeholder="https://yourportfolio.com"
            />
          </div>
        </div>
      )}

      {state.formError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.formError}
        </div>
      ) : null}

      {state.formSuccess ? (
        <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-[#dfffd6]">
          {state.formSuccess}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton
          idleLabel="Create account"
          pendingLabel="Creating account..."
        />
        <p className="text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-secondary hover:text-accent">
            Log in
          </Link>
        </p>
      </div>
    </form>
  );
}
