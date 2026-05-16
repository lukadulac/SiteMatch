"use client";

import { useActionState, useState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { updateProviderProfileAction } from "@/app/dashboard/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";
import {
  providerExperienceOptions,
  providerServiceCategories,
  providerServiceCategoryLabels,
  providerTypeLabels,
  providerTypes,
} from "@/lib/auth/provider-profile";

type ProviderProfileFormProps = {
  profile: {
    full_name: string;
    phone: string | null;
    country: string | null;
    city: string | null;
  };
  providerProfile: {
    provider_type: "freelancer" | "agency" | "company" | "studio" | "other";
    tax_id: string | null;
    years_of_experience: number | null;
    portfolio_url: string | null;
    social_link: string | null;
    service_categories: string[];
    service_category_other_text: string | null;
    about: string | null;
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
  fallback: string | number | null | undefined,
  name: string,
) {
  return state.fields?.[name] ?? (fallback != null ? String(fallback) : "");
}

function fieldValues(state: DashboardActionState, fallback: string[], name: string) {
  const value = state.fields?.[name];
  return value ? value.split("||").filter(Boolean) : fallback;
}

type InputProps = {
  label: string;
  name: string;
  defaultValue?: string | number | null;
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

export function ProviderProfileForm({
  profile,
  providerProfile,
}: ProviderProfileFormProps) {
  const [state, formAction] = useActionState(
    updateProviderProfileAction,
    initialDashboardActionState,
  );
  const [providerType, setProviderType] = useState<
    "freelancer" | "agency" | "company" | "studio" | "other"
  >(fieldValue(state, providerProfile?.provider_type, "provider_type") as
    | "freelancer"
    | "agency"
    | "company"
    | "studio"
    | "other");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    fieldValues(
      state,
      providerProfile?.service_categories ?? [],
      "service_categories",
    ),
  );

  function handleServiceCategoryChange(category: string, checked: boolean) {
    setSelectedCategories((current) => {
      if (checked) {
        return [...current, category];
      }

      return current.filter((value) => value !== category);
    });
  }

  const shouldShowTaxId =
    providerType === "agency" ||
    providerType === "company" ||
    providerType === "studio";

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
        <h3 className="font-semibold">Provider details</h3>
        <hr className="mx-auto my-2 border-gray-400" />

        <div className="my-2 flex w-full flex-col gap-2">
          <label htmlFor="provider_type">
            Provider type
            <span className="ml-1 text-red-600">*</span>
          </label>
          <select
            id="provider_type"
            name="provider_type"
            value={providerType}
            onChange={(event) =>
              setProviderType(
                event.target.value as
                  | "freelancer"
                  | "agency"
                  | "company"
                  | "studio"
                  | "other",
              )
            }
            aria-invalid={fieldError(state, "provider_type") ? "true" : "false"}
            className={`w-full rounded-2xl border p-2.5 outline-none transition ${
              fieldError(state, "provider_type")
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-black"
            }`}
            required
          >
            {providerTypes.map((type) => (
              <option key={type} value={type}>
                {providerTypeLabels[type]}
              </option>
            ))}
          </select>
          {fieldError(state, "provider_type") ? (
            <p className="text-sm text-red-600">
              {fieldError(state, "provider_type")}
            </p>
          ) : null}
        </div>

        {shouldShowTaxId ? (
          <InputField
            label="Tax ID"
            name="tax_id"
            defaultValue={fieldValue(state, providerProfile?.tax_id, "tax_id")}
            error={fieldError(state, "tax_id")}
            placeholder="12345678"
            required
          />
        ) : null}

        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <div className="w-full md:max-w-[50%]">
            <div className="my-2 flex w-full flex-col gap-2">
              <label htmlFor="years_of_experience">Years of experience</label>
              <select
                id="years_of_experience"
                name="years_of_experience"
                defaultValue={fieldValue(
                  state,
                  providerProfile?.years_of_experience,
                  "years_of_experience",
                )}
                aria-invalid={
                  fieldError(state, "years_of_experience") ? "true" : "false"
                }
                className={`w-full rounded-2xl border p-2.5 outline-none transition ${
                  fieldError(state, "years_of_experience")
                    ? "border-red-500 focus:border-red-500"
                    : "border-gray-300 focus:border-black"
                }`}
                required
              >
                <option value="" disabled>
                  Select range
                </option>
                {providerExperienceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {fieldError(state, "years_of_experience") ? (
                <p className="text-sm text-red-600">
                  {fieldError(state, "years_of_experience")}
                </p>
              ) : null}
            </div>
          </div>
          <div className="w-full md:max-w-[50%]">
            <InputField
              label="Portfolio URL"
              name="portfolio_url"
              type="url"
              defaultValue={fieldValue(
                state,
                providerProfile?.portfolio_url,
                "portfolio_url",
              )}
              error={fieldError(state, "portfolio_url")}
              placeholder="https://yourportfolio.com"
              required
            />
          </div>
        </div>

        <InputField
          label="Social link"
          name="social_link"
          type="url"
          defaultValue={fieldValue(state, providerProfile?.social_link, "social_link")}
          error={fieldError(state, "social_link")}
          placeholder="https://linkedin.com/in/yourprofile"
        />

        <fieldset className="mt-4">
          <h3 className="font-semibold">
            Service categories
            <span className="ml-1 text-red-600">*</span>
          </h3>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            {providerServiceCategories.map((category) => (
              <label
                key={category}
                className={`flex items-center gap-2 rounded-xl border p-3 ${
                  fieldError(state, "service_categories")
                    ? "border-red-300"
                    : "border-gray-500"
                }`}
              >
                <input
                  type="checkbox"
                  name="service_categories"
                  value={category}
                  defaultChecked={selectedCategories.includes(category)}
                  onChange={(event) =>
                    handleServiceCategoryChange(category, event.target.checked)
                  }
                />
                <span>{providerServiceCategoryLabels[category]}</span>
              </label>
            ))}
          </div>
          {fieldError(state, "service_categories") ? (
            <p className="mt-2 text-sm text-red-600">
              {fieldError(state, "service_categories")}
            </p>
          ) : null}
        </fieldset>

        {selectedCategories.includes("other") ? (
          <InputField
            label="Other service category"
            name="service_category_other_text"
            defaultValue={fieldValue(
              state,
              providerProfile?.service_category_other_text,
              "service_category_other_text",
            )}
            error={fieldError(state, "service_category_other_text")}
            placeholder="Tell us your service category"
            required
          />
        ) : null}

        <div className="my-2 flex w-full flex-col gap-2">
          <label htmlFor="about">About</label>
          <textarea
            id="about"
            name="about"
            rows={5}
            defaultValue={fieldValue(state, providerProfile?.about, "about")}
            placeholder="Tell clients about your experience, strengths, and the kind of work you do best."
            aria-invalid={fieldError(state, "about") ? "true" : "false"}
            className={`w-full rounded-2xl border p-2.5 placeholder:pl-2 outline-none transition ${
              fieldError(state, "about")
                ? "border-red-500 focus:border-red-500"
                : "border-gray-300 focus:border-black"
            }`}
          />
          {fieldError(state, "about") ? (
            <p className="text-sm text-red-600">{fieldError(state, "about")}</p>
          ) : null}
        </div>
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
          idleLabel="Save provider profile"
          pendingLabel="Saving..."
        />
      </div>
    </form>
  );
}
