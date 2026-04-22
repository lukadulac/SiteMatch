"use client";

import { useActionState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { completeClientOnboardingAction } from "@/app/onboarding/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type ClientOnboardingFormProps = {
  clientProfile: {
    business_name: string | null;
    business_type: string | null;
    business_description: string | null;
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
  placeholder?: string;
};

function InputField({
  label,
  name,
  defaultValue,
  error,
  placeholder,
}: InputProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[#f3fff7]">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
      />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </label>
  );
}

export function ClientOnboardingForm({
  clientProfile,
}: ClientOnboardingFormProps) {
  const [state, formAction] = useActionState(
    completeClientOnboardingAction,
    initialDashboardActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <InputField
          label="Business name"
          name="business_name"
          defaultValue={clientProfile?.business_name}
          error={fieldError(state, "business_name")}
          placeholder="Acme Dental Studio"
        />
        <InputField
          label="Business type"
          name="business_type"
          defaultValue={clientProfile?.business_type}
          error={fieldError(state, "business_type")}
          placeholder="Local service business"
        />
        <InputField
          label="Preferred language"
          name="preferred_language"
          defaultValue={clientProfile?.preferred_language}
          error={fieldError(state, "preferred_language")}
          placeholder="English"
        />
        <div className="sm:col-span-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[#f3fff7]">
              Business description
            </span>
            <textarea
              name="business_description"
              rows={5}
              defaultValue={clientProfile?.business_description ?? ""}
              placeholder="Tell providers what your business does and what kind of website you need."
              className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-accent"
            />
            {fieldError(state, "business_description") ? (
              <p className="text-sm text-red-300">
                {fieldError(state, "business_description")}
              </p>
            ) : null}
          </label>
        </div>
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
