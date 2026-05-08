"use client";

import { useActionState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { updateClientProfileAction } from "@/app/dashboard/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";
import {
  clientBusinessTypeLabels,
  clientBusinessTypes,
  clientSolutionTypeLabels,
  clientSolutionTypes,
} from "@/lib/auth/client-profile";

type ClientProfileFormProps = {
  profile: {
    full_name: string;
    phone: string | null;
    country: string | null;
    city: string | null;
  };
  clientProfile: {
    business_name: string | null;
    business_tax_id: string | null;
    business_type: string | null;
    business_type_text: string | null;
    project_idea: string | null;
    website_url: string | null;
    company_size: string | null;
    interested_solution_types: string[];
    interested_solution_other_text: string | null;
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
          name="business_tax_id"
          defaultValue={clientProfile?.business_tax_id}
          error={fieldError(state, "business_tax_id")}
          placeholder="Optional"
        />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">
            Business category
          </span>
          <select
            name="business_type"
            defaultValue={clientProfile?.business_type ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="" disabled>
              Choose category
            </option>
            {clientBusinessTypes.map((option) => (
              <option key={option} value={option}>
                {clientBusinessTypeLabels[option]}
              </option>
            ))}
          </select>
          {fieldError(state, "business_type") ? (
            <p className="text-sm text-red-300">{fieldError(state, "business_type")}</p>
          ) : null}
        </label>
        <InputField
          label="Company size"
          name="company_size"
          defaultValue={clientProfile?.company_size}
          error={fieldError(state, "company_size")}
        />
        <InputField
          label="Other business category"
          name="business_type_text"
          defaultValue={clientProfile?.business_type_text}
          error={fieldError(state, "business_type_text")}
          placeholder="Only if you selected Other"
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
            Project idea
          </span>
          <textarea
            name="project_idea"
            rows={5}
            defaultValue={clientProfile?.project_idea ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
          />
          {fieldError(state, "project_idea") ? (
            <p className="text-sm text-red-300">
              {fieldError(state, "project_idea")}
            </p>
          ) : null}
        </label>
        <fieldset className="space-y-3 sm:col-span-2">
          <legend className="text-sm font-medium text-[#f3fff7]">
            Digital solution types
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {clientSolutionTypes.map((option) => {
              const isChecked =
                clientProfile?.interested_solution_types?.includes(option) ?? false;

              return (
                <label
                  key={option}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground"
                >
                  <input
                    type="checkbox"
                    name="interested_solution_types"
                    value={option}
                    defaultChecked={isChecked}
                    className="h-4 w-4"
                  />
                  <span>{clientSolutionTypeLabels[option]}</span>
                </label>
              );
            })}
          </div>
          {fieldError(state, "interested_solution_types") ? (
            <p className="text-sm text-red-300">
              {fieldError(state, "interested_solution_types")}
            </p>
          ) : null}
        </fieldset>
        <div className="sm:col-span-2">
          <InputField
            label="Other solution type"
            name="interested_solution_other_text"
            defaultValue={clientProfile?.interested_solution_other_text}
            error={fieldError(state, "interested_solution_other_text")}
            placeholder="Only if you selected Other"
          />
        </div>
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
