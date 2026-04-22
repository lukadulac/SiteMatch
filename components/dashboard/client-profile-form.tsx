"use client";

import { useActionState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { updateClientProfileAction } from "@/app/dashboard/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type ClientProfileFormProps = {
  profile: {
    full_name: string;
    phone: string | null;
    country: string | null;
    city: string | null;
    avatar_url: string | null;
  };
  clientProfile: {
    business_name: string | null;
    business_type: string | null;
    business_description: string | null;
    website_url: string | null;
    company_size: string | null;
    preferred_language: string | null;
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
  defaultValue?: string | null;
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

export function ClientProfileForm({
  profile,
  clientProfile,
}: ClientProfileFormProps) {
  const [state, formAction] = useActionState(
    updateClientProfileAction,
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
        <InputField
          label="Business name"
          name="business_name"
          defaultValue={clientProfile?.business_name}
          error={fieldError(state, "business_name")}
        />
        <InputField
          label="Business type"
          name="business_type"
          defaultValue={clientProfile?.business_type}
          error={fieldError(state, "business_type")}
        />
        <InputField
          label="Company size"
          name="company_size"
          defaultValue={clientProfile?.company_size}
          error={fieldError(state, "company_size")}
        />
        <InputField
          label="Preferred language"
          name="preferred_language"
          defaultValue={clientProfile?.preferred_language}
          error={fieldError(state, "preferred_language")}
        />
        <div className="sm:col-span-2">
          <InputField
            label="Website URL"
            name="website_url"
            type="url"
            defaultValue={clientProfile?.website_url}
            error={fieldError(state, "website_url")}
          />
        </div>
        <label className="block space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-[#f3fff7]">
            Business description
          </span>
          <textarea
            name="business_description"
            rows={5}
            defaultValue={clientProfile?.business_description ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
          />
          {fieldError(state, "business_description") ? (
            <p className="text-sm text-red-300">
              {fieldError(state, "business_description")}
            </p>
          ) : null}
        </label>
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
        idleLabel="Save client profile"
        pendingLabel="Saving..."
      />
    </form>
  );
}
