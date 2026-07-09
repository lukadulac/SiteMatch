"use client";

import { useActionState } from "react";
import {
	applyToProjectAction,
	type JobApplicationActionState,
	type JobApplicationsFieldErrors,
} from "@/app/jobs/actions";

type ProviderApplicationFormProps = {
	projectId: string;
};
const initialState: JobApplicationActionState = {
	fieldErrors: {},
	fields: {},
};

function getFieldError(
	state: JobApplicationActionState,
	field: keyof JobApplicationsFieldErrors,
) {
	return state.fieldErrors?.[field]?.[0];
}

function inputClasses(error?: string) {
	return `w-full rounded-[1.25rem] border bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-secondary/70 ${
		error
			? "border-red-400 focus:border-red-500"
			: "border-line-strong focus:border-black"
	}`;
}

function FieldShell({
	label,
	name,
	error,
	description,
	children,
}: {
	label: string;
	name: string;
	error?: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<div className="flex flex-col gap-1">
				<label htmlFor={name} className="text-sm font-semibold text-black">
					{label}
				</label>
				{description ? (
					<p className="text-sm leading-5 text-secondary">{description}</p>
				) : null}
			</div>
			{children}
			{error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
		</div>
	);
}

export function ProviderApplicationForm({
	projectId,
}: ProviderApplicationFormProps) {
	const boundAction = applyToProjectAction.bind(null, projectId);
	const [state, formAction, isPending] = useActionState(
		boundAction,
		initialState,
	);

	return (
		<form action={formAction} className="space-y-6">
			{state.formError ? (
				<div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
					{state.formError}
				</div>
			) : null}

			<FieldShell
				label="Proposal approach"
				name="cover_message"
				error={getFieldError(state, "cover_message")}
			>
				<textarea
					id="cover_message"
					name="cover_message"
					defaultValue={state.fields?.cover_message}
					rows={8}
					className={`${inputClasses(
						getFieldError(state, "cover_message"),
					)} min-h-48 resize-y leading-6`}
					placeholder="Represent your approach to the project, your experience, and why you are a good fit for this opportunity."
				/>
			</FieldShell>

			<div className="grid gap-5 sm:grid-cols-2">
				<FieldShell
					label="Proposed price"
					name="proposed_price"
					error={getFieldError(state, "proposed_price")}
					description="Enter your proposed price."
				>
					<div className="relative">
						<span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-secondary">
							$
						</span>
						<input
							id="proposed_price"
							name="proposed_price"
							type="number"
							min="0"
							step="1"
							defaultValue={state.fields?.proposed_price}
							className={`${inputClasses(
								getFieldError(state, "proposed_price"),
							)} pl-8`}
							placeholder="2500"
						/>
					</div>
				</FieldShell>

				<FieldShell
					label="Delivery estimate"
					name="estimated_delivery_days"
					error={getFieldError(state, "estimated_delivery_days")}
					description="Optional estimate in calendar days."
				>
					<div className="relative">
						<input
							id="estimated_delivery_days"
							name="estimated_delivery_days"
							type="number"
							min="1"
							step="1"
							defaultValue={state.fields?.estimated_delivery_days}
							className={`${inputClasses(
								getFieldError(state, "estimated_delivery_days"),
							)} pr-16`}
							placeholder="30"
						/>
						<span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-secondary">
							days
						</span>
					</div>
				</FieldShell>
			</div>

			<div className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-sm leading-6 text-secondary">
					Your proposal is sent to the client with your profile details.
				</p>
				<button
					type="submit"
					disabled={isPending}
					className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{isPending ? "Submitting..." : "Submit proposal"}
				</button>
			</div>
		</form>
	);
}
