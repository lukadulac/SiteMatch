import { useState } from "react";
import {
	providerExperienceOptions,
	providerServiceCategories,
	providerServiceCategoryLabels,
	providerTypeLabels,
	providerTypes,
} from "@/lib/auth/provider-profile";
import type { RegisterFieldErrors } from "@/components/auth/register/RegisterForm";
import { FieldError, FieldLabel, fieldClass, fieldError } from "@/components/auth/register/field-ui";

type ProviderFieldsProps = {
	errors?: RegisterFieldErrors;
};

export default function ProviderFields({ errors }: ProviderFieldsProps) {
	const [providerType, setProviderType] = useState("");
	const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

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
			<div className="grid gap-4 md:grid-cols-2">
				<div className="flex min-w-0 flex-col gap-2">
					<FieldLabel htmlFor="provider_type" required>Provider type</FieldLabel>
					<select
						id="provider_type"
						name="provider_type"
						value={providerType}
						onChange={(event) => setProviderType(event.target.value)}
						className={fieldClass(fieldError(errors, "provider_type"))}
						required
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
					<FieldError name="provider_type" errors={errors} />
				</div>

				{shouldShowTaxId ? (
					<div className="flex min-w-0 flex-col gap-2">
						<FieldLabel htmlFor="tax_id">Business registration ID</FieldLabel>
						<input
							id="tax_id"
							name="tax_id"
							type="text"
							className={fieldClass(fieldError(errors, "tax_id"))}
							placeholder="xxxxxxxx"
						/>
						<FieldError name="tax_id" errors={errors} />
					</div>
				) : null}

				<div className="flex min-w-0 flex-col gap-2">
					<FieldLabel htmlFor="years_of_experience">Years of experience</FieldLabel>
					<select
						id="years_of_experience"
						name="years_of_experience"
						className={fieldClass(fieldError(errors, "years_of_experience"))}
					>
						<option value="">
							Not specified
						</option>
						{providerExperienceOptions.map((option) => (
							<option value={option.value} key={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<FieldError name="years_of_experience" errors={errors} />
				</div>

				<div className="flex min-w-0 flex-col gap-2">
					<FieldLabel htmlFor="portfolio_url">Portfolio URL</FieldLabel>
					<input
						id="portfolio_url"
						name="portfolio_url"
						type="text"
						inputMode="url"
						autoComplete="url"
						className={fieldClass(fieldError(errors, "portfolio_url"))}
						placeholder="https://yourportfolio.com"
					/>
					<FieldError name="portfolio_url" errors={errors} />
				</div>

				<div className="flex min-w-0 flex-col gap-2">
					<FieldLabel htmlFor="social_link">Social link</FieldLabel>
					<input
						id="social_link"
						name="social_link"
						type="text"
						inputMode="url"
						autoComplete="url"
						className={fieldClass(fieldError(errors, "social_link"))}
						placeholder="https://linkedin.com/in/yourprofile"
					/>
					<FieldError name="social_link" errors={errors} />
				</div>
			</div>

			<fieldset className="mt-4">
				<legend className="flex w-full justify-between gap-2 font-semibold">Service categories <span className="text-xs font-semibold text-red-700">Required</span></legend>
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
				<FieldError name="service_categories" errors={errors} />
			</fieldset>

			{selectedCategories.includes("other") ? (
				<div className="flex flex-col gap-2 my-4">
					<FieldLabel htmlFor="service_category_other_text" required>Other service category</FieldLabel>
					<input
						id="service_category_other_text"
						name="service_category_other_text"
						type="text"
						className={fieldClass(fieldError(errors, "service_category_other_text"))}
						required
						placeholder="Tell us your service category"
					/>
					<FieldError name="service_category_other_text" errors={errors} />
				</div>
			) : null}

			<div className="flex flex-col gap-2 my-4">
				<FieldLabel htmlFor="about">About</FieldLabel>
				<textarea
					id="about"
					name="about"
					rows={5}
					className={fieldClass(fieldError(errors, "about"))}
					placeholder="Tell us about your experience, skills, and what makes you unique..."
				/>
				<FieldError name="about" errors={errors} />
			</div>
		</section>
	);
}
