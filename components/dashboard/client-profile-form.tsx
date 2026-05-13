"use client";

import { useActionState, useState } from "react";
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

function fieldValue(
  state: DashboardActionState,
  fallback: string | null | undefined,
  name: string,
) {
  return state.fields?.[name] ?? fallback ?? "";
}

function fieldValues(state: DashboardActionState, fallback: string[], name: string) {
  const value = state.fields?.[name];
  return value ? value.split("||").filter(Boolean) : fallback;
}

type InputProps = {
  label: string;
  name: string;
  defaultValue?: string | null;
  error?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
};

function InputField({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  placeholder,
  required = false,
}: InputProps) {
  return (
    <div className="my-2 flex w-full flex-col gap-2">
      <label htmlFor={name}>
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        aria-invalid={error ? "true" : "false"}
        className={`w-full rounded-2xl border p-2.5 placeholder:pl-2 outline-none transition ${
          error
            ? "border-red-500 focus:border-red-500"
            : "border-gray-300 focus:border-black"
        }`}
        required={required}
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
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
  const [businessType, setBusinessType] = useState(
    fieldValue(state, clientProfile?.business_type, "business_type"),
  );
  const [selectedSolutionTypes, setSelectedSolutionTypes] = useState<string[]>(
    fieldValues(
      state,
      clientProfile?.interested_solution_types ?? [],
      "interested_solution_types",
    ),
  );

  function handleSolutionTypeChange(type: string, checked: boolean) {
    setSelectedSolutionTypes((current) => {
      if (checked) {
        return [...current, type];
      }

      return current.filter((value) => value !== type);
    });
  }

  return (
    <form action={formAction}>
      <section className="p-2">
        <h3 className="font-semibold">Personal information</h3>
        <hr className="mx-auto my-2 border-gray-400" />
        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Full name"
              name="full_name"
              defaultValue={fieldValue(state, profile.full_name, "full_name")}
              error={fieldError(state, "full_name")}
              placeholder="John Doe"
              required
            />
          </div>
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Phone"
              name="phone"
              defaultValue={fieldValue(state, profile.phone, "phone")}
              error={fieldError(state, "phone")}
              placeholder="1111111111"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Country"
              name="country"
              defaultValue={fieldValue(state, profile.country, "country")}
              error={fieldError(state, "country")}
              placeholder="Serbia"
              required
            />
          </div>
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="City"
              name="city"
              defaultValue={fieldValue(state, profile.city, "city")}
              error={fieldError(state, "city")}
              placeholder="Belgrade"
              required
            />
          </div>
        </div>
      </section>

      <section className="p-2">
        <h3 className="font-semibold">Client details</h3>
        <hr className="mx-auto my-2 border-gray-400" />

        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Business name"
              name="business_name"
              defaultValue={fieldValue(
                state,
                clientProfile?.business_name,
                "business_name",
              )}
              error={fieldError(state, "business_name")}
              placeholder="Your Company Inc."
              required
            />
          </div>
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Business tax ID"
              name="business_tax_id"
              defaultValue={fieldValue(
                state,
                clientProfile?.business_tax_id,
                "business_tax_id",
              )}
              error={fieldError(state, "business_tax_id")}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="my-2 flex w-full flex-col gap-2">
          <label htmlFor="business_type">Business type</label>
          <select
            id="business_type"
            name="business_type"
            value={businessType}
            onChange={(event) => setBusinessType(event.target.value)}
            aria-invalid={fieldError(state, "business_type") ? "true" : "false"}
            className={`w-full rounded-2xl border p-2.5 outline-none transition ${
              fieldError(state, "business_type")
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-black"
            }`}
            required
          >
            <option value="" disabled>
              Select a business type
            </option>
            {clientBusinessTypes.map((option) => (
              <option key={option} value={option}>
                {clientBusinessTypeLabels[option]}
              </option>
            ))}
          </select>
          {fieldError(state, "business_type") ? (
            <p className="text-sm text-red-600">
              {fieldError(state, "business_type")}
            </p>
          ) : null}
        </div>

        {businessType === "other" ? (
          <InputField
            label="Other business type"
            name="business_type_text"
            defaultValue={fieldValue(
              state,
              clientProfile?.business_type_text,
              "business_type_text",
            )}
            error={fieldError(state, "business_type_text")}
            placeholder="Tell us your business type"
            required
          />
        ) : null}

        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Company size"
              name="company_size"
              defaultValue={fieldValue(
                state,
                clientProfile?.company_size,
                "company_size",
              )}
              error={fieldError(state, "company_size")}
              placeholder="1-10 employees"
            />
          </div>
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Website URL"
              name="website_url"
              type="url"
              defaultValue={fieldValue(
                state,
                clientProfile?.website_url,
                "website_url",
              )}
              error={fieldError(state, "website_url")}
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>

        <div className="my-2 flex w-full flex-col gap-2">
          <label htmlFor="project_idea">Project idea</label>
          <textarea
            id="project_idea"
            name="project_idea"
            rows={5}
            defaultValue={fieldValue(
              state,
              clientProfile?.project_idea,
              "project_idea",
            )}
            placeholder="Tell us about your project and what you're looking to build..."
            aria-invalid={fieldError(state, "project_idea") ? "true" : "false"}
            className={`w-full rounded-2xl border p-2.5 placeholder:pl-2 outline-none transition ${
              fieldError(state, "project_idea")
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-black"
            }`}
            required
          />
          {fieldError(state, "project_idea") ? (
            <p className="text-sm text-red-600">
              {fieldError(state, "project_idea")}
            </p>
          ) : null}
        </div>

        <fieldset className="mt-4">
          <h3 className="font-semibold">
            Interested solution types
            <span className="ml-1 text-red-600">*</span>
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            {clientSolutionTypes.map((option) => (
              <label
                key={option}
                className={`flex items-center gap-2 rounded-xl border p-3 ${
                  fieldError(state, "interested_solution_types")
                    ? "border-red-300"
                    : "border-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  name="interested_solution_types"
                  value={option}
                  defaultChecked={selectedSolutionTypes.includes(option)}
                  onChange={(event) =>
                    handleSolutionTypeChange(option, event.target.checked)
                  }
                />
                <span>{clientSolutionTypeLabels[option]}</span>
              </label>
            ))}
          </div>
          {fieldError(state, "interested_solution_types") ? (
            <p className="mt-2 text-sm text-red-600">
              {fieldError(state, "interested_solution_types")}
            </p>
          ) : null}
        </fieldset>

        {selectedSolutionTypes.includes("other") ? (
          <InputField
            label="Other solution type"
            name="interested_solution_other_text"
            defaultValue={fieldValue(
              state,
              clientProfile?.interested_solution_other_text,
              "interested_solution_other_text",
            )}
            error={fieldError(state, "interested_solution_other_text")}
            placeholder="Tell us your other interested solution type"
            required
          />
        ) : null}
      </section>

      {state.formError ? (
        <div className="my-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.formError}
        </div>
      ) : null}

      {state.formSuccess ? (
        <div className="my-4 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.formSuccess}
        </div>
      ) : null}

      <div className="mt-4">
        <FormSubmitButton
          idleLabel="Save client profile"
          pendingLabel="Saving..."
        />
      </div>
    </form>
  );
}
