"use client";

import { useActionState } from "react";
import {
  initialDashboardActionState,
  type DashboardActionState,
} from "@/app/dashboard/action-state";
import { updateAdminProfileAction } from "@/app/dashboard/actions";
import { FormSubmitButton } from "@/components/dashboard/form-submit-button";

type AdminProfileFormProps = {
  profile: {
    full_name: string;
    phone: string | null;
    country: string | null;
    city: string | null;
  };
};

function fieldError(
  state: DashboardActionState,
  name: string,
): string | undefined {
  return state.fieldErrors?.[name]?.[0];
}

export function AdminProfileForm({ profile }: AdminProfileFormProps) {
  const [state, formAction] = useActionState(
    updateAdminProfileAction,
    initialDashboardActionState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">Full name</span>
          <input
            name="full_name"
            defaultValue={profile.full_name}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          />
          {fieldError(state, "full_name") ? (
            <p className="text-sm text-red-300">{fieldError(state, "full_name")}</p>
          ) : null}
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">Phone</span>
          <input
            name="phone"
            defaultValue={profile.phone ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          />
          {fieldError(state, "phone") ? (
            <p className="text-sm text-red-300">{fieldError(state, "phone")}</p>
          ) : null}
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">Country</span>
          <input
            name="country"
            defaultValue={profile.country ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          />
          {fieldError(state, "country") ? (
            <p className="text-sm text-red-300">{fieldError(state, "country")}</p>
          ) : null}
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f3fff7]">City</span>
          <input
            name="city"
            defaultValue={profile.city ?? ""}
            className="w-full rounded-2xl border border-line bg-[#0d1425] px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent"
          />
          {fieldError(state, "city") ? (
            <p className="text-sm text-red-300">{fieldError(state, "city")}</p>
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
        idleLabel="Save admin profile"
        pendingLabel="Saving..."
      />
    </form>
  );
}
