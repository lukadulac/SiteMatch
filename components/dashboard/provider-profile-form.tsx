"use client";

import { useActionState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { updateProviderProfileAction } from "@/app/dashboard/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type ProviderProfileFormProps = {
  profile: {
    full_name: string;
    phone: string | null;
    country: string | null;
    city: string | null;
    avatar_url: string | null;
  };
  providerProfile: {
    provider_type: "freelancer" | "agency" | "studio";
    headline: string | null;
    bio: string | null;
    years_of_experience: number | null;
    portfolio_url: string | null;
    hourly_rate_min: number | null;
    hourly_rate_max: number | null;
    fixed_price_min: number | null;
    fixed_price_max: number | null;
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

export function ProviderProfileForm({
  profile,
  providerProfile,
}: ProviderProfileFormProps) {
  const [state, formAction] = useActionState(
    updateProviderProfileAction,
    initialDashboardActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="Full name"
          name="full_name"
          defaultValue={profile.full_name}
          error={fieldError(state, "full_name")}
        />
        <InputField
          label="Phone"
          name="phone"
          defaultValue={profile.phone}
          error={fieldError(state, "phone")}
        />
        <InputField
          label="Country"
          name="country"
          defaultValue={profile.country}
          error={fieldError(state, "country")}
        />
        <InputField
          label="City"
          name="city"
          defaultValue={profile.city}
          error={fieldError(state, "city")}
        />
        <div className="sm:col-span-2">
          <InputField
            label="Avatar URL"
            name="avatar_url"
            type="url"
            defaultValue={profile.avatar_url}
            error={fieldError(state, "avatar_url")}
          />
        </div>
      </div>

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
          />
        </div>

        <label className="block space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-[#f3fff7]">Bio</span>
          <textarea
            name="bio"
            rows={5}
            defaultValue={providerProfile?.bio ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
          />
          {fieldError(state, "bio") ? (
            <p className="text-sm text-red-300">{fieldError(state, "bio")}</p>
          ) : null}
        </label>

        <InputField
          label="Years of experience"
          name="years_of_experience"
          type="number"
          min={0}
          step={1}
          defaultValue={providerProfile?.years_of_experience}
          error={fieldError(state, "years_of_experience")}
        />
        <InputField
          label="Portfolio URL"
          name="portfolio_url"
          type="url"
          defaultValue={providerProfile?.portfolio_url}
          error={fieldError(state, "portfolio_url")}
        />
        <InputField
          label="Hourly rate min"
          name="hourly_rate_min"
          type="number"
          min={0}
          step={0.01}
          defaultValue={providerProfile?.hourly_rate_min}
          error={fieldError(state, "hourly_rate_min")}
        />
        <InputField
          label="Hourly rate max"
          name="hourly_rate_max"
          type="number"
          min={0}
          step={0.01}
          defaultValue={providerProfile?.hourly_rate_max}
          error={fieldError(state, "hourly_rate_max")}
        />
        <InputField
          label="Fixed price min"
          name="fixed_price_min"
          type="number"
          min={0}
          step={0.01}
          defaultValue={providerProfile?.fixed_price_min}
          error={fieldError(state, "fixed_price_min")}
        />
        <InputField
          label="Fixed price max"
          name="fixed_price_max"
          type="number"
          min={0}
          step={0.01}
          defaultValue={providerProfile?.fixed_price_max}
          error={fieldError(state, "fixed_price_max")}
        />
      </div>

      {state.formError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.formError}
        </div>
      ) : null}

      {state.formSuccess ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {state.formSuccess}
        </div>
      ) : null}

      <FormSubmitButton
        idleLabel="Save provider profile"
        pendingLabel="Saving..."
      />
    </form>
  );
}
