"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  initialListingsActionState,
  type ListingsActionState,
} from "@/app/oglasi/action-state";
import {
  createClientProjectAction,
  updateClientProjectAction,
} from "@/app/oglasi/actions";
import type { Database } from "@/types/supabase";

const MULTI_VALUE_SEPARATOR = "||";

type MetaOption = {
  id: string;
  name: string;
  description: string | null;
};

type ClientProjectFormProps = {
  meta: {
    serviceTypes: Database["public"]["Tables"]["service_types"]["Row"][];
    businessDomains: Database["public"]["Tables"]["business_domains"]["Row"][];
    projectGoals: Database["public"]["Tables"]["project_goals"]["Row"][];
    featureTags: Database["public"]["Tables"]["feature_tags"]["Row"][];
  };
  profileComplete: boolean;
  mode?: "create" | "edit";
  projectId?: string;
  initialValues?: {
    id: string;
    title: string;
    description: string;
    service_type_id: string;
    business_domain_id: string | null;
    business_domain_other_text: string | null;
    business_context_text: string | null;
    what_do_you_need_text: string;
    goal_other_text: string | null;
    budget_type: "fixed" | "range" | "negotiable";
    budget_min: number | null;
    budget_max: number | null;
    deadline_type: "specific_date" | "flexible" | "asap";
    deadline_date: string | null;
    desired_start_date: string | null;
    has_existing_website: boolean;
    existing_website_url: string | null;
    needs_design: boolean;
    needs_seo: boolean;
    needs_content_writing: boolean;
    is_remote_friendly: boolean;
    preferred_language: string | null;
    preferred_provider_type: "freelancer" | "agency" | "studio" | "any";
    goal_ids: string[];
    feature_ids: string[];
    status: string;
  };
};

type FieldProps = {
  label: string;
  name: string;
  state: ListingsActionState;
  placeholder?: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
  min?: number;
  step?: number | "any";
};

function getFieldError(state: ListingsActionState, name: string) {
  return state.fieldErrors?.[name]?.[0];
}

function getFieldValue(
  state: ListingsActionState,
  name: string,
  fallback = "",
) {
  return state.fields?.[name] ?? fallback;
}

function getFieldValues(
  state: ListingsActionState,
  name: string,
  fallback: string[] = [],
) {
  const value = state.fields?.[name];
  return value ? value.split(MULTI_VALUE_SEPARATOR).filter(Boolean) : fallback;
}

function isChecked(state: ListingsActionState, name: string, fallback = false) {
  const value = state.fields?.[name];
  return value == null ? fallback : value === "true";
}

function FieldShell({
  label,
  name,
  error,
  required,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-black">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function inputClasses(error?: string) {
  return `w-full rounded-[1.25rem] border bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-secondary/70 ${
    error
      ? "border-red-400 focus:border-red-500"
      : "border-line-strong focus:border-black"
  }`;
}

function TextInput({
  label,
  name,
  state,
  placeholder,
  required = false,
  type = "text",
  defaultValue = "",
  min,
  step,
}: FieldProps) {
  const error = getFieldError(state, name);

  return (
    <FieldShell label={label} name={name} error={error} required={required}>
      <input
        id={name}
        name={name}
        type={type}
        min={min}
        step={step}
        required={required}
        defaultValue={getFieldValue(state, name, defaultValue)}
        placeholder={placeholder}
        aria-invalid={error ? "true" : "false"}
        className={inputClasses(error)}
      />
    </FieldShell>
  );
}

function TextArea({
  label,
  name,
  state,
  placeholder,
  required = false,
  rows = 5,
  defaultValue = "",
}: FieldProps & { rows?: number }) {
  const error = getFieldError(state, name);

  return (
    <FieldShell label={label} name={name} error={error} required={required}>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={getFieldValue(state, name, defaultValue)}
        placeholder={placeholder}
        aria-invalid={error ? "true" : "false"}
        className={inputClasses(error)}
      />
    </FieldShell>
  );
}

function SelectField({
  label,
  name,
  state,
  options,
  required = false,
  placeholder = "Select an option",
  defaultValue = "",
}: FieldProps & {
  options: MetaOption[];
}) {
  const error = getFieldError(state, name);

  return (
    <FieldShell label={label} name={name} error={error} required={required}>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={getFieldValue(state, name, defaultValue)}
        aria-invalid={error ? "true" : "false"}
        className={inputClasses(error)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

function ChoiceCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-[0_14px_34px_rgba(17,17,17,0.04)]">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-black">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-secondary">{description}</p>
      </div>
      {children}
    </div>
  );
}

function ChecklistGroup({
  title,
  description,
  name,
  options,
  selectedValues,
}: {
  title: string;
  description: string;
  name: string;
  options: MetaOption[];
  selectedValues: string[];
}) {
  return (
    <ChoiceCard title={title} description={description}>
      <div className="grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className="flex gap-3 rounded-[1.25rem] border border-line bg-panel-soft px-4 py-3"
          >
            <input
              type="checkbox"
              name={name}
              value={option.id}
              defaultChecked={selectedValues.includes(option.id)}
              className="mt-1 h-4 w-4 rounded border-line-strong"
            />
            <span>
              <span className="block text-sm font-semibold text-black">
                {option.name}
              </span>
              {option.description ? (
                <span className="mt-1 block text-sm leading-5 text-secondary">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </ChoiceCard>
  );
}

function StatusSubmitButton({
  value,
  idleLabel,
  pendingLabel,
  variant,
  disabled,
}: {
  value: "draft" | "published";
  idleLabel: string;
  pendingLabel: string;
  variant: "secondary" | "primary";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name="status"
      value={value}
      disabled={pending || disabled}
      className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        variant === "primary"
          ? "bg-linear-to-r from-violet-500 to-pink-500 text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] hover:opacity-90"
          : "border border-line-strong bg-white text-black hover:bg-black/3"
      }`}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}

export function ClientProjectForm({
  meta,
  profileComplete,
  mode = "create",
  projectId,
  initialValues,
}: ClientProjectFormProps) {
  const action =
    mode === "edit" && projectId
      ? updateClientProjectAction.bind(null, projectId)
      : createClientProjectAction;
  const [state, formAction] = useActionState(action, initialListingsActionState);
  const [budgetType, setBudgetType] = useState(
    getFieldValue(state, "budget_type", initialValues?.budget_type ?? "range"),
  );
  const [deadlineType, setDeadlineType] = useState(
    getFieldValue(
      state,
      "deadline_type",
      initialValues?.deadline_type ?? "flexible",
    ),
  );
  const [hasExistingWebsite, setHasExistingWebsite] = useState(
    isChecked(state, "has_existing_website", initialValues?.has_existing_website),
  );
  const [selectedDomain, setSelectedDomain] = useState(
    getFieldValue(
      state,
      "business_domain_id",
      initialValues?.business_domain_id ?? "",
    ),
  );

  const selectedGoals = getFieldValues(
    state,
    "goal_ids",
    initialValues?.goal_ids ?? [],
  );
  const selectedFeatures = getFieldValues(
    state,
    "feature_ids",
    initialValues?.feature_ids ?? [],
  );

  return (
    <form action={formAction} className="space-y-8">
      <section className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary">
              Brief setup
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-black sm:text-4xl">
              {mode === "edit" ? "Edit your listing" : "Create a client listing"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
              {mode === "edit"
                ? "Refine the brief, update the scope, and republish changes when needed."
                : "Capture the essentials first. The goal is a clear brief providers can understand without a follow-up call."}
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-panel-soft px-5 py-4 text-sm text-secondary">
            Drafts stay private. Publishing makes the listing visible to providers.
          </div>
        </div>
      </section>

      {!profileComplete ? (
        <section className="rounded-4xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-900 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
          Your client profile is not complete yet. You can fill the form, but the
          backend will block publishing or saving until profile setup is finished in
          the dashboard profile section.
        </section>
      ) : null}

      {state.formError ? (
        <section className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {state.formError}
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <ChoiceCard
            title="Project basics"
            description="Start with the public-facing summary of the work."
          >
            <div className="space-y-5">
              <TextInput
                label="Listing title"
                name="title"
                state={state}
                required
                defaultValue={initialValues?.title}
                placeholder="Example: Need a conversion-focused website for a local clinic"
              />

              <SelectField
                label="Service type"
                name="service_type_id"
                state={state}
                required
                options={meta.serviceTypes.map((item) => ({
                  id: item.id,
                  name: item.name,
                  description: item.description,
                }))}
                placeholder="Choose the primary service"
                defaultValue={initialValues?.service_type_id}
              />

              <TextArea
                label="Short project summary"
                name="description"
                state={state}
                required
                rows={6}
                defaultValue={initialValues?.description}
                placeholder="Describe the business, the challenge, and the kind of outcome you expect."
              />
            </div>
          </ChoiceCard>

          <ChoiceCard
            title="Business context"
            description="Give providers enough context to judge fit and approach."
          >
            <div className="space-y-5">
              <FieldShell
                label="Business domain"
                name="business_domain_id"
                error={getFieldError(state, "business_domain_id")}
                required={!selectedDomain}
              >
                <select
                  id="business_domain_id"
                  name="business_domain_id"
                  value={selectedDomain}
                  onChange={(event) => setSelectedDomain(event.target.value)}
                  aria-invalid={getFieldError(state, "business_domain_id") ? "true" : "false"}
                  className={inputClasses(getFieldError(state, "business_domain_id"))}
                >
                  <option value="">Select a business domain</option>
                  {meta.businessDomains.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </FieldShell>

              {!selectedDomain ? (
                <TextInput
                  label="Custom business domain"
                  name="business_domain_other_text"
                  state={state}
                  defaultValue={initialValues?.business_domain_other_text ?? ""}
                  placeholder="Type your industry if it is not listed above"
                />
              ) : null}

              <TextArea
                label="Business context"
                name="business_context_text"
                state={state}
                rows={5}
                defaultValue={initialValues?.business_context_text ?? ""}
                placeholder="What does the company do, who are you serving, and what is changing now?"
              />
            </div>
          </ChoiceCard>

          <ChoiceCard
            title="What needs to be done"
            description="This is the core brief. Keep it concrete and outcome-oriented."
          >
            <TextArea
              label="What do you need built?"
              name="what_do_you_need_text"
              state={state}
              required
              rows={7}
              defaultValue={initialValues?.what_do_you_need_text}
              placeholder="Be specific about deliverables, structure, flows, pages, integrations, or internal needs."
            />
          </ChoiceCard>

          <ChecklistGroup
            title="Project goals"
            description="Select the outcomes that matter most."
            name="goal_ids"
            options={meta.projectGoals.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
            }))}
            selectedValues={selectedGoals}
          />

          <TextInput
            label="Other goal"
            name="goal_other_text"
            state={state}
            defaultValue={initialValues?.goal_other_text ?? ""}
            placeholder="Optional custom goal"
          />

          <ChecklistGroup
            title="Requested features"
            description="Mark the capabilities you already know you need."
            name="feature_ids"
            options={meta.featureTags.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
            }))}
            selectedValues={selectedFeatures}
          />
        </div>

        <div className="space-y-6">
          <ChoiceCard
            title="Budget and timing"
            description="This helps providers qualify themselves early."
          >
            <div className="space-y-5">
              <FieldShell
                label="Budget model"
                name="budget_type"
                error={getFieldError(state, "budget_type")}
                required
              >
                <select
                  id="budget_type"
                  name="budget_type"
                  value={budgetType}
                  onChange={(event) => setBudgetType(event.target.value)}
                  className={inputClasses(getFieldError(state, "budget_type"))}
                >
                  <option value="range">Budget range</option>
                  <option value="fixed">Fixed budget</option>
                  <option value="negotiable">Negotiable</option>
                </select>
              </FieldShell>

              {budgetType === "range" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextInput
                    label="Minimum budget"
                    name="budget_min"
                    state={state}
                    type="number"
                    min={0}
                    step="any"
                    required
                    defaultValue={initialValues?.budget_min?.toString()}
                    placeholder="1000"
                  />
                  <TextInput
                    label="Maximum budget"
                    name="budget_max"
                    state={state}
                    type="number"
                    min={0}
                    step="any"
                    required
                    defaultValue={initialValues?.budget_max?.toString()}
                    placeholder="5000"
                  />
                </div>
              ) : null}

              {budgetType === "fixed" ? (
                <TextInput
                  label="Fixed budget"
                  name="budget_min"
                  state={state}
                  type="number"
                  min={0}
                  step="any"
                  required
                  defaultValue={
                    initialValues?.budget_min?.toString() ??
                    initialValues?.budget_max?.toString()
                  }
                  placeholder="3000"
                />
              ) : null}

              <FieldShell
                label="Deadline"
                name="deadline_type"
                error={getFieldError(state, "deadline_type")}
                required
              >
                <select
                  id="deadline_type"
                  name="deadline_type"
                  value={deadlineType}
                  onChange={(event) => setDeadlineType(event.target.value)}
                  className={inputClasses(getFieldError(state, "deadline_type"))}
                >
                  <option value="flexible">Flexible</option>
                  <option value="asap">ASAP</option>
                  <option value="specific_date">Specific date</option>
                </select>
              </FieldShell>

              {deadlineType === "specific_date" ? (
                <TextInput
                  label="Deadline date"
                  name="deadline_date"
                  state={state}
                  type="date"
                  required
                  defaultValue={initialValues?.deadline_date ?? ""}
                />
              ) : null}

              <TextInput
                label="Preferred start date"
                name="desired_start_date"
                state={state}
                type="date"
                defaultValue={initialValues?.desired_start_date ?? ""}
              />
            </div>
          </ChoiceCard>

          <ChoiceCard
            title="Provider preferences"
            description="A few constraints help attract better-matched providers."
          >
            <div className="space-y-5">
              <FieldShell
                label="Preferred provider type"
                name="preferred_provider_type"
                error={getFieldError(state, "preferred_provider_type")}
              >
                <select
                  id="preferred_provider_type"
                  name="preferred_provider_type"
                  defaultValue={getFieldValue(
                    state,
                    "preferred_provider_type",
                    initialValues?.preferred_provider_type ?? "any",
                  )}
                  className={inputClasses(getFieldError(state, "preferred_provider_type"))}
                >
                  <option value="any">Any</option>
                  <option value="freelancer">Freelancer</option>
                  <option value="agency">Agency</option>
                  <option value="studio">Studio</option>
                </select>
              </FieldShell>

              <TextInput
                label="Preferred language"
                name="preferred_language"
                state={state}
                defaultValue={initialValues?.preferred_language ?? ""}
                placeholder="Optional"
              />
            </div>
          </ChoiceCard>

          <ChoiceCard
            title="Website and delivery setup"
            description="Only keep the details that affect the first qualification pass."
          >
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-[1.25rem] border border-line bg-panel-soft px-4 py-3">
                <input
                  type="checkbox"
                  name="has_existing_website"
                  defaultChecked={hasExistingWebsite}
                  onChange={(event) => setHasExistingWebsite(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-line-strong"
                />
                <span>
                  <span className="block text-sm font-semibold text-black">
                    We already have a website
                  </span>
                  <span className="mt-1 block text-sm text-secondary">
                    Useful when redesign, migration, or SEO work is part of the brief.
                  </span>
                </span>
              </label>

              {hasExistingWebsite ? (
                <TextInput
                  label="Existing website URL"
                  name="existing_website_url"
                  state={state}
                  placeholder="https://example.com"
                  type="url"
                  required
                  defaultValue={initialValues?.existing_website_url ?? ""}
                />
              ) : null}

              {[
                {
                  name: "needs_design",
                  title: "Need design support",
                  description: "Branding, layout direction, or visual system is needed.",
                },
                {
                  name: "needs_seo",
                  title: "Need SEO support",
                  description: "Search visibility or technical SEO is part of the scope.",
                },
                {
                  name: "needs_content_writing",
                  title: "Need content writing",
                  description: "Copywriting, content structure, or page content is needed.",
                },
                {
                  name: "is_remote_friendly",
                  title: "Remote friendly",
                  description: "You are open to working fully remote.",
                },
              ].map((item) => (
                <label
                  key={item.name}
                  className="flex items-start gap-3 rounded-[1.25rem] border border-line bg-panel-soft px-4 py-3"
                >
                  <input
                    type="checkbox"
                    name={item.name}
                    defaultChecked={isChecked(
                      state,
                      item.name,
                      item.name === "needs_design"
                        ? (initialValues?.needs_design ?? false)
                        : item.name === "needs_seo"
                          ? (initialValues?.needs_seo ?? false)
                          : item.name === "needs_content_writing"
                            ? (initialValues?.needs_content_writing ?? false)
                            : (initialValues?.is_remote_friendly ?? true),
                    )}
                    className="mt-1 h-4 w-4 rounded border-line-strong"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-black">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm text-secondary">
                      {item.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </ChoiceCard>
        </div>
      </section>

      <section className="sticky bottom-4 rounded-4xl border border-line bg-white/95 p-5 shadow-[0_20px_60px_rgba(17,17,17,0.12)] backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-black">Ready to save the brief?</p>
            <p className="mt-1 text-sm text-secondary">
              Save a private draft first, or publish immediately when the brief is
              complete.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <StatusSubmitButton
              value="draft"
              idleLabel={mode === "edit" ? "Save draft changes" : "Save as draft"}
              pendingLabel={mode === "edit" ? "Saving changes..." : "Saving draft..."}
              variant="secondary"
              disabled={!profileComplete}
            />
            <StatusSubmitButton
              value="published"
              idleLabel={mode === "edit" ? "Save and publish" : "Publish listing"}
              pendingLabel={mode === "edit" ? "Publishing changes..." : "Publishing..."}
              variant="primary"
              disabled={!profileComplete}
            />
          </div>
        </div>
      </section>
    </form>
  );
}
