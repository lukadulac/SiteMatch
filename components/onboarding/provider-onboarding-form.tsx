"use client";

import { useActionState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { completeProviderOnboardingAction } from "@/app/onboarding/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type ProviderOnboardingFormProps = {
  providerProfile: {
    provider_type: "freelancer" | "agency" | "studio";
    headline: string | null;
    bio: string | null;
    years_of_experience: number | null;
    portfolio_url: string | null;
    availability: "available" | "busy" | "unavailable";
  } | null;
};

function fieldError(
  state: DashboardActionState,
  name: string,
): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}

type InputProps = {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  error?: string;
  type?: string;
  placeholder?: string;
  min?: number;
  step?: number;
};

function InputField({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  placeholder,
  min,
  step,
}: InputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[#f3fff7]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        min={min}
        step={step}
        className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </label>
  );
}

export function ProviderOnboardingForm({
  providerProfile,
}: ProviderOnboardingFormProps) {
  const [state, formAction] = useActionState(
    completeProviderOnboardingAction,
    initialDashboardActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">
            Provider type
          </span>
          <select
            name="provider_type"
            defaultValue={providerProfile?.provider_type ?? "freelancer"}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="freelancer">Freelancer</option>
            <option value="agency">Agency</option>
            <option value="studio">Studio</option>
          </select>
          {fieldError(state, "provider_type") ? (
            <p className="text-sm text-red-300">
              {fieldError(state, "provider_type")}
            </p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">
            Availability
          </span>
          <select
            name="availability"
            defaultValue={providerProfile?.availability ?? "available"}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="unavailable">Unavailable</option>
          </select>
          {fieldError(state, "availability") ? (
            <p className="text-sm text-red-300">
              {fieldError(state, "availability")}
            </p>
          ) : null}
        </label>

        <div className="sm:col-span-2">
          <InputField
            label="Headline"
            name="headline"
            defaultValue={providerProfile?.headline}
            error={fieldError(state, "headline")}
            placeholder="Web designer focused on small business sites"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#f3fff7]">Bio</span>
            <textarea
              name="bio"
              rows={5}
              defaultValue={providerProfile?.bio ?? ""}
              placeholder="Explain what you do, who you help, and the type of projects you take on."
              className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
            />
            {fieldError(state, "bio") ? (
              <p className="text-sm text-red-300">{fieldError(state, "bio")}</p>
            ) : null}
          </label>
        </div>

        <InputField
          label="Years of experience"
          name="years_of_experience"
          type="number"
          min={0}
          step={1}
          defaultValue={providerProfile?.years_of_experience}
          error={fieldError(state, "years_of_experience")}
          placeholder="5"
        />
        <InputField
          label="Portfolio URL"
          name="portfolio_url"
          type="url"
          defaultValue={providerProfile?.portfolio_url}
          error={fieldError(state, "portfolio_url")}
          placeholder="https://yourportfolio.com"
        />
      </div>

      {state.formError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.formError}
        </div>
      ) : null}

      <FormSubmitButton
        idleLabel="Finish onboarding"
        pendingLabel="Saving..."
      />
    </form>
  );
}
