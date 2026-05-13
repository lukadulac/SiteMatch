import { useState } from "react";
import {
	providerExperienceOptions,
	providerServiceCategories,
	providerServiceCategoryLabels,
	providerTypeLabels,
	providerTypes,
} from "@/lib/auth/provider-profile";
import {
	getRegisterFieldValue,
	type RegisterFieldErrors,
	type RegisterFormFields,
} from "@/components/auth/register/RegisterForm";

type ProviderFieldsProps = {
	errors?: RegisterFieldErrors;
	fields?: RegisterFormFields;
	selectedServiceCategories: string[];
};

function getError(errors: RegisterFieldErrors | undefined, name: string) {
	return errors?.[name]?.[0];
}

export default function ProviderFields({
	errors,
	fields,
	selectedServiceCategories,
}: ProviderFieldsProps) {
	const [providerType, setProviderType] = useState(
		getRegisterFieldValue(fields, "provider_type"),
	);
	const [selectedCategories, setSelectedCategories] = useState<string[]>(
		selectedServiceCategories,
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
		<section className="p-2">
			<h3 className="font-semibold">Provider details</h3>
			<hr className="border-gray-400 mx-auto my-2" />
			<div className="flex flex-col gap-2 md:flex-row">
				<div className="flex flex-col my-2">
					<label htmlFor="provider_type">Provider type</label>
					<select
						id="provider_type"
						name="provider_type"
						value={providerType}
						onChange={(event) => setProviderType(event.target.value)}
						className="border border-gray-500 p-2 my-2 rounded-2xl"
					>
						<option value="" disabled>
							Select a provider type
						</option>
						{providerTypes.map((type) => (
							<option key={type} value={type}>
								{providerTypeLabels[type]}
							</option>
						))}
					</select>
					{getError(errors, "provider_type") ? (
						<p>{getError(errors, "provider_type")}</p>
					) : null}
				</div>

				{shouldShowTaxId ? (
					<div className="flex flex-col">
						<label htmlFor="tax_id">Tax ID</label>
						<input
							id="tax_id"
							name="tax_id"
							type="text"
							className="border border-gray-500 p-2 rounded-2xl my-2"
							placeholder="xxxxxxxx"
							defaultValue={getRegisterFieldValue(fields, "tax_id")}
						/>
						{getError(errors, "tax_id") ? (
							<p>{getError(errors, "tax_id")}</p>
						) : null}
					</div>
				) : null}
			</div>
			<div className="flex flex-col gap-2  md:flex-row">
				<div className="flex flex-col my-2">
					<label htmlFor="years_of_experience">Years of experience</label>
					<select
						id="years_of_experience"
						name="years_of_experience"
						defaultValue={getRegisterFieldValue(fields, "years_of_experience")}
						className="border border-gray-500 p-2 my-2 rounded-2xl"
					>
						<option value="" disabled>
							Select range
						</option>
						{providerExperienceOptions.map((option) => (
							<option value={option.value} key={option.value}>
								{option.label}
							</option>
						))}
					</select>
					{getError(errors, "years_of_experience") ? (
						<p>{getError(errors, "years_of_experience")}</p>
					) : null}
				</div>

				<div className="flex flex-col gap-2">
					<label htmlFor="portfolio_url">Portfolio URL</label>
					<input
						id="portfolio_url"
						name="portfolio_url"
						type="url"
						className="border border-gray-500 p-2  rounded-2xl"
						placeholder="https://yourportfoliolnik.com"
						defaultValue={getRegisterFieldValue(fields, "portfolio_url")}
					/>
					{getError(errors, "portfolio_url") ? (
						<p>{getError(errors, "portfolio_url")}</p>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-2 my-4">
				<label htmlFor="social_link">Social link</label>
				<input
					id="social_link"
					name="social_link"
					type="url"
					className="border border-gray-500 p-2 rounded-2xl"
					placeholder="https://linkedin/com/in/yourprofile"
					defaultValue={getRegisterFieldValue(fields, "social_link")}
				/>
				{getError(errors, "social_link") ? (
					<p>{getError(errors, "social_link")}</p>
				) : null}
			</div>

			<fieldset className="mt-4">
				<h3 className="font-semibold">Service categories</h3>
				<div className="grid grid-cols-1 gap-3 mt-2 md:grid-cols-2">
					{providerServiceCategories.map((category) => (
						<label
							key={category}
							className="flex items-center gap-2 rounded-xl border border-gray-500 p-3"
						>
							<input
								type="checkbox"
								name="service_categories"
								value={category}
								checked={selectedCategories.includes(category)}
								onChange={(event) =>
									handleServiceCategoryChange(category, event.target.checked)
								}
							/>
							<span>{providerServiceCategoryLabels[category]}</span>
						</label>
					))}
				</div>
				{getError(errors, "service_categories") ? (
					<p>{getError(errors, "service_categories")}</p>
				) : null}
			</fieldset>

			{selectedCategories.includes("other") ? (
				<div className="flex flex-col gap-2 my-4">
					<label htmlFor="service_category_other_text">
						Other service category
					</label>
					<input
						id="service_category_other_text"
						name="service_category_other_text"
						type="text"
						className="border border-gray-500 p-2 rounded-2xl"
						placeholder="Tell us your service category"
						defaultValue={getRegisterFieldValue(
							fields,
							"service_category_other_text",
						)}
					/>
					{getError(errors, "service_category_other_text") ? (
						<p>{getError(errors, "service_category_other_text")}</p>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-2 my-4">
				<label htmlFor="about">About</label>
				<textarea
					id="about"
					name="about"
					rows={5}
					className="border w-full rounded-2xl p-2"
					placeholder="Tell us about your experience, skills, and what makes you unique..."
					defaultValue={getRegisterFieldValue(fields, "about")}
				/>
				{getError(errors, "about") ? <p>{getError(errors, "about")}</p> : null}
			</div>
		</section>
	);
}
