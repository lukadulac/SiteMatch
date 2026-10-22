"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
	applyToProjectAction,
	type JobApplicationActionState,
	type JobApplicationsFieldErrors,
} from "@/app/jobs/actions";

/** Mirrors createApplicationSchema's cover_message limit. */
const COVER_MESSAGE_MAX = 2000;

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

function boxClasses(error?: string) {
	return `rounded-[0.875rem] border bg-white transition focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-violet-500 ${
		error ? "border-red-700" : "border-line-strong"
	}`;
}

function FieldError({ id, error }: { id: string; error?: string }) {
	return error ? (
		<p id={id} className="mt-1.5 text-sm text-red-700">
			{error}
		</p>
	) : null;
}

export function ProviderApplicationForm({
	projectId,
}: ProviderApplicationFormProps) {
	const boundAction = applyToProjectAction.bind(null, projectId);
	const [state, formAction, isPending] = useActionState(
		boundAction,
		initialState,
	);
	const [coverLength, setCoverLength] = useState(
		state.fields?.cover_message?.length ?? 0,
	);
	const coverError = getFieldError(state, "cover_message");
	const priceError = getFieldError(state, "proposed_price");
	const daysError = getFieldError(state, "estimated_delivery_days");

	return (
		<form action={formAction} className="flex flex-col gap-4.5" noValidate>
			{state.formError ? (
				<div
					role="alert"
					className="flex items-start gap-2.5 rounded-[0.875rem] bg-red-50 px-3.5 py-3 text-sm leading-snug text-red-800"
				>
					<AlertCircle aria-hidden="true" className="mt-px size-4.5 shrink-0" />
					<span>{state.formError}</span>
				</div>
			) : null}

			<div>
				<div className="flex items-baseline justify-between">
					<label htmlFor="cover_message" className="text-sm font-semibold text-foreground">
						Cover message
					</label>
					<span
						id="cover_message-count"
						className={`text-xs ${coverError ? "text-red-700" : "text-secondary"}`}
					>
						{coverLength} / {COVER_MESSAGE_MAX}
					</span>
				</div>
				<textarea
					id="cover_message"
					name="cover_message"
					defaultValue={state.fields?.cover_message}
					onChange={(event) => setCoverLength(event.target.value.length)}
					maxLength={COVER_MESSAGE_MAX}
					rows={6}
					aria-invalid={coverError ? true : undefined}
					aria-describedby={`cover_message-count${coverError ? " cover_message-error" : ""}`}
					className={`${boxClasses(coverError)} mt-2 block min-h-37 w-full resize-y px-3.5 py-3 text-[0.9375rem] leading-normal text-foreground outline-none placeholder:text-secondary/70`}
					placeholder="How would you approach this project? Mention similar work you've done."
				/>
				<FieldError id="cover_message-error" error={coverError} />
			</div>

			<div className="flex flex-wrap gap-3">
				<div className="min-w-35 flex-1">
					<label htmlFor="proposed_price" className="text-sm font-semibold text-foreground">
						Proposed price
					</label>
					<div className={`${boxClasses(priceError)} mt-2 flex h-12 items-center gap-1.5 px-3.5`}>
						<span aria-hidden="true" className="text-[0.9375rem] text-secondary">
							$
						</span>
						<input
							id="proposed_price"
							name="proposed_price"
							type="number"
							inputMode="numeric"
							min="0"
							step="1"
							defaultValue={state.fields?.proposed_price}
							aria-invalid={priceError ? true : undefined}
							aria-describedby={priceError ? "proposed_price-error" : undefined}
							className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-secondary/70"
							placeholder="3500"
						/>
					</div>
					<FieldError id="proposed_price-error" error={priceError} />
				</div>

				<div className="min-w-35 flex-1">
					<label htmlFor="estimated_delivery_days" className="text-sm font-semibold text-foreground">
						Estimated delivery
					</label>
					<div className={`${boxClasses(daysError)} mt-2 flex h-12 items-center gap-1.5 px-3.5`}>
						<input
							id="estimated_delivery_days"
							name="estimated_delivery_days"
							type="number"
							inputMode="numeric"
							min="1"
							max="365"
							step="1"
							defaultValue={state.fields?.estimated_delivery_days}
							aria-invalid={daysError ? true : undefined}
							aria-describedby={daysError ? "estimated_delivery_days-error" : undefined}
							className="min-w-0 flex-1 bg-transparent text-[0.9375rem] text-foreground outline-none placeholder:text-secondary/70"
							placeholder="30"
						/>
						<span aria-hidden="true" className="text-sm text-secondary">
							days
						</span>
					</div>
					<FieldError id="estimated_delivery_days-error" error={daysError} />
				</div>
			</div>

			<button
				type="submit"
				disabled={isPending}
				className="inline-flex min-h-13 w-full items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 px-5 text-base font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isPending ? "Submitting…" : "Submit proposal"}
			</button>
		</form>
	);
}
