"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
	initialProviderServiceActionState,
	type ProviderServiceActionState,
} from "@/app/dashboard/provider/services/action-state";
import { createProviderServiceListingAction } from "@/app/dashboard/provider/services/actions";
import type { Database } from "@/types/supabase";

type MetaOption = {
	id: string;
	name: string;
	description?: string | null;
};

type ProviderServiceFormProps = {
	serviceTypes: Database["public"]["Tables"]["service_types"]["Row"][];
	categories: Database["public"]["Tables"]["project_categories"]["Row"][];
	action?: (
		previousState: ProviderServiceActionState,
		formData: FormData,
	) => Promise<ProviderServiceActionState>;
	initialState?: ProviderServiceActionState;
	cancelHref?: string;
	submitMode?: "create" | "edit";
	listingStatus?: Database["public"]["Enums"]["provider_service_listing_status"];
};

function getFieldError(state: ProviderServiceActionState, name: string) {
	return state.fieldErrors?.[name]?.[0];
}

function getFieldValue(
	state: ProviderServiceActionState,
	name: string,
	fallback = "",
) {
	return state.fields?.[name] ?? fallback;
}

function inputClasses(error?: string) {
	return `w-full rounded-[1.1rem] border bg-white px-4 py-3 text-sm text-black outline-none transition placeholder:text-secondary/70 ${
		error
			? "border-red-400 focus:border-red-500"
			: "border-line-strong focus:border-black"
	}`;
}

function FieldShell({
	label,
	name,
	error,
	children,
}: {
	label: string;
	name: string;
	error?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-2">
			<label htmlFor={name} className="text-sm font-semibold text-black">
				{label}
			</label>
			{children}
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
		</div>
	);
}

function TextInput({
	label,
	name,
	state,
	placeholder,
	type = "text",
	min,
	step,
}: {
	label: string;
	name: string;
	state: ProviderServiceActionState;
	placeholder?: string;
	type?: string;
	min?: number;
	step?: number | "any";
}) {
	const error = getFieldError(state, name);

	return (
		<FieldShell label={label} name={name} error={error}>
			<input
				id={name}
				name={name}
				type={type}
				min={min}
				step={step}
				defaultValue={getFieldValue(state, name)}
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
	rows = 7,
}: {
	label: string;
	name: string;
	state: ProviderServiceActionState;
	placeholder?: string;
	rows?: number;
}) {
	const error = getFieldError(state, name);

	return (
		<FieldShell label={label} name={name} error={error}>
			<textarea
				id={name}
				name={name}
				rows={rows}
				defaultValue={getFieldValue(state, name)}
				placeholder={placeholder}
				aria-invalid={error ? "true" : "false"}
				className={inputClasses(error)}
			/>
		</FieldShell>
	);
}

function SelectWithOtherField({
	label,
	idName,
	textName,
	state,
	options,
	placeholder,
	otherPlaceholder,
}: {
	label: string;
	idName: string;
	textName: string;
	state: ProviderServiceActionState;
	options: MetaOption[];
	placeholder: string;
	otherPlaceholder: string;
}) {
	const existingText = getFieldValue(state, textName);
	const [choice, setChoice] = useState(
		existingText ? "__other__" : getFieldValue(state, idName),
	);
	const idError = getFieldError(state, idName);
	const textError = getFieldError(state, textName);
	const isOther = choice === "__other__";

	return (
		<div className="space-y-3">
			<FieldShell label={label} name={`${idName}_choice`} error={idError}>
				<select
					id={`${idName}_choice`}
					value={choice}
					onChange={(event) => setChoice(event.target.value)}
					aria-invalid={idError || textError ? "true" : "false"}
					className={inputClasses(idError || textError)}
				>
					<option value="">{placeholder}</option>
					{options.map((option) => (
						<option key={option.id} value={option.id}>
							{option.name}
						</option>
					))}
					<option value="__other__">Other</option>
				</select>
			</FieldShell>
			<input type="hidden" name={idName} value={isOther ? "" : choice} />
			{isOther ? (
				<TextInput
					label={`Custom ${label.toLowerCase()}`}
					name={textName}
					state={state}
					placeholder={otherPlaceholder}
				/>
			) : (
				<input type="hidden" name={textName} value="" />
			)}
		</div>
	);
}

function SubmitButton({
	intent,
	children,
	variant,
}: {
	intent: "draft" | "published";
	children: React.ReactNode;
	variant: "secondary" | "primary";
}) {
	const { pending } = useFormStatus();

	return (
		<button
			type="submit"
			name="intent"
			value={intent}
			disabled={pending}
			className={`inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
				variant === "primary"
					? "bg-linear-to-r from-violet-500 to-pink-500 text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] hover:opacity-90"
					: "border border-line-strong bg-white text-black hover:bg-black/3"
			}`}
		>
			{pending ? "Saving..." : children}
		</button>
	);
}

function SectionBlock({
	number,
	title,
	description,
	children,
}: {
	number: string;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section className="border-b border-line pb-7 last:border-b-0 last:pb-0">
			<div className="mb-5">
				<h2 className="text-base font-semibold text-black">
					{number}. {title}
				</h2>
				<p className="mt-1 text-sm leading-6 text-secondary">{description}</p>
			</div>
			{children}
		</section>
	);
}

export function ProviderServiceForm({
	serviceTypes,
	categories,
	action = createProviderServiceListingAction,
	initialState = initialProviderServiceActionState,
	cancelHref = "/dashboard/provider/services",
	submitMode = "create",
	listingStatus = "draft",
}: ProviderServiceFormProps) {
	const [state, formAction] = useActionState(action, initialState);
	const [priceType, setPriceType] = useState(
		getFieldValue(state, "price_type", "starting_at"),
	);
	const secondaryIntent = listingStatus === "published" ? "published" : "draft";
	const secondaryLabel =
		submitMode === "edit" && listingStatus === "published"
			? "Save Changes"
			: "Save Draft";
	const primaryLabel =
		submitMode === "edit" && listingStatus === "published"
			? "Update Published"
			: "Publish Service";

	const selectedServiceType = useMemo(
		() =>
			serviceTypes.find(
				(option) => option.id === getFieldValue(state, "service_type_id"),
			),
		[serviceTypes, state],
	);
	const selectedCategory = useMemo(
		() =>
			categories.find(
				(option) => option.id === getFieldValue(state, "category_id"),
			),
		[categories, state],
	);
	const title = getFieldValue(state, "title");
	const description = getFieldValue(state, "description");
	const startingPrice = getFieldValue(state, "starting_price");
	const deliveryEstimate = getFieldValue(state, "delivery_estimate");
	const customServiceType = getFieldValue(state, "service_type_text");
	const customCategory = getFieldValue(state, "category_text");
	const priceLabel =
		priceType === "negotiable"
			? "Negotiable"
			: startingPrice
				? `$${Number(startingPrice).toLocaleString()}`
				: "$-";

	return (
		<form action={formAction} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
			<div className="space-y-7 rounded-3xl border border-line bg-white p-5 shadow-[0_20px_60px_rgba(17,17,17,0.05)] sm:p-7">
				{state.formError ? (
					<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
						{state.formError}
					</div>
				) : null}

				<SectionBlock
					number="1"
					title="Service Basics"
					description="Set the foundational identity of what you are offering to prospective clients."
				>
					<div className="grid gap-4">
						<TextInput
							label="Service Title"
							name="title"
							state={state}
							placeholder="e.g. I will design a high-converting landing page for your SaaS product"
						/>
						<div className="grid gap-4 sm:grid-cols-2">
							<SelectWithOtherField
								label="Service Type"
								idName="service_type_id"
								textName="service_type_text"
								state={state}
								options={serviceTypes}
								placeholder="Select type..."
								otherPlaceholder="e.g. Contract review, video editing, financial modelling"
							/>
							<SelectWithOtherField
								label="Category"
								idName="category_id"
								textName="category_text"
								state={state}
								options={categories}
								placeholder="Select category..."
								otherPlaceholder="e.g. Legal consulting"
							/>
						</div>
					</div>
				</SectionBlock>

				<SectionBlock
					number="2"
					title="Description & Process"
					description="Provide comprehensive details on how you execute this offer and what the client gets."
				>
					<TextArea
						label="Service Description"
						name="description"
						state={state}
						placeholder="Describe your delivery flow, tools you use, final file types, and standard revisions included..."
					/>
					<p className="mt-2 text-xs leading-5 text-secondary">
						Explain what you deliver, who it is for, and what is included.
					</p>
				</SectionBlock>

				<SectionBlock
					number="3"
					title="Pricing & Delivery"
					description="Choose how clients will pay for this service and when you expect to deliver standard outcomes."
				>
					<div className="space-y-4">
						<div className="space-y-2">
							<p className="text-sm font-semibold text-black">Price Type</p>
							<div className="grid overflow-hidden rounded-[1.1rem] border border-line-strong bg-white text-sm font-semibold text-secondary sm:grid-cols-4">
								{[
									["starting_at", "Starting at"],
									["fixed", "Fixed"],
									["hourly", "Hourly"],
									["negotiable", "Negotiable"],
								].map(([value, label]) => (
									<label
										key={value}
										className={`cursor-pointer px-4 py-3 text-center transition ${
											priceType === value
												? "bg-violet-100 text-violet-700"
												: "hover:bg-black/3"
										}`}
									>
										<input
											type="radio"
											name="price_type"
											value={value}
											defaultChecked={priceType === value}
											onChange={() => setPriceType(value)}
											className="sr-only"
										/>
										{label}
									</label>
								))}
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							<TextInput
								label="Starting Price"
								name="starting_price"
								state={state}
								type="number"
								min={0}
								step="any"
								placeholder="250"
							/>
							<TextInput
								label="Delivery Estimate"
								name="delivery_estimate"
								state={state}
								placeholder="e.g. 3-5 days"
							/>
						</div>
					</div>
				</SectionBlock>

				<div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
					<Link
						href={cancelHref}
						className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-line-strong bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/3 sm:w-auto"
					>
						Cancel
					</Link>
					<SubmitButton intent={secondaryIntent} variant="secondary">
						{secondaryLabel}
					</SubmitButton>
					<SubmitButton intent="published" variant="primary">
						{primaryLabel}
					</SubmitButton>
				</div>
			</div>

			<aside className="space-y-4 xl:sticky xl:top-28 xl:self-start">
				<section className="rounded-3xl border border-line bg-white p-5 shadow-[0_20px_60px_rgba(17,17,17,0.05)]">
					<div className="mb-4 flex items-center justify-between gap-3">
						<p className="text-xs font-bold uppercase tracking-wide text-secondary">
							Listing Preview
						</p>
						<span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
							{listingStatus === "published" ? "Published" : "Draft"}
						</span>
					</div>
					<div className="mb-4 flex h-28 items-center justify-center rounded-[1.1rem] bg-linear-to-br from-violet-100 via-white to-pink-100 text-3xl font-semibold text-violet-600">
						W
					</div>
					<h3 className="wrap-break-word text-lg font-semibold text-black">
						{title || "Untitled Service"}
					</h3>
					<p className="mt-2 line-clamp-3 text-sm leading-6 text-secondary">
						{description ||
							"A brief description of your service will appear here once you start typing."}
					</p>
					<div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
						<div>
							<p className="text-xs font-bold uppercase text-secondary">Price</p>
							<p className="mt-1 font-semibold text-black">{priceLabel}</p>
						</div>
						<div>
							<p className="text-xs font-bold uppercase text-secondary">
								Delivery
							</p>
							<p className="mt-1 font-semibold text-black">
								{deliveryEstimate || "-"}
							</p>
						</div>
					</div>
					<div className="mt-4 flex flex-wrap gap-2">
						{selectedServiceType ? (
							<span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
								{selectedServiceType.name}
							</span>
						) : customServiceType ? (
							<span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
								{customServiceType}
							</span>
						) : null}
						{selectedCategory ? (
							<span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
								{selectedCategory.name}
							</span>
						) : customCategory ? (
							<span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
								{customCategory}
							</span>
						) : null}
					</div>
				</section>

				<section className="rounded-3xl border border-line bg-white p-5 shadow-[0_20px_60px_rgba(17,17,17,0.05)]">
					<p className="text-xs font-bold uppercase tracking-wide text-secondary">
						Listing Tips
					</p>
					<ul className="mt-4 space-y-3 text-sm text-secondary">
						{[
							"Define the client outcome clearly.",
							"List specific deliverables.",
							"Set realistic pricing.",
							"Use a conservative delivery estimate.",
						].map((tip) => (
							<li key={tip} className="flex gap-3">
								<span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
								<span>{tip}</span>
							</li>
						))}
					</ul>
				</section>
			</aside>
		</form>
	);
}
