import { useState } from "react";
import {
	clientBusinessTypeLabels,
	clientBusinessTypes,
	clientSolutionTypeLabels,
	clientSolutionTypes,
} from "@/lib/auth/client-profile";
import type { RegisterFieldErrors } from "@/components/auth/register/RegisterForm";
import { FieldLabel, fieldClass, fieldError } from "@/components/auth/register/field-ui";

type ClientFieldsProps = {
	errors?: RegisterFieldErrors;
};

function getError(errors: RegisterFieldErrors | undefined, name: string) {
	return errors?.[name]?.[0];
}

export default function ClientFields({ errors }: ClientFieldsProps) {
	const [businessType, setBusinessType] = useState("");
	const [selectedSolutions, setSelectedSolutions] = useState<string[]>([]);

	function handleSolutionTypeChange(type: string, checked: boolean) {
		setSelectedSolutions((current) => {
			if (checked) {
				return [...current, type];
			}

			return current.filter((value) => value !== type);
		});
	}

	return (
		<section className="p-2">
			<h3 className="font-semibold">Client details</h3>
			<hr className="border-gray-400 mx-auto my-2" />
			<div className="flex flex-col gap-2 md:flex-row md:gap-4">
				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<FieldLabel htmlFor="business_name" required>Business or personal name</FieldLabel>
					<input
						id="business_name"
						name="business_name"
						type="text"
						className={fieldClass(fieldError(errors, "business_name"))}
						required
						aria-invalid={Boolean(getError(errors, "business_name"))}
						placeholder="Your Company Inc."
					/>
					{getError(errors, "business_name") ? (
						<p>{getError(errors, "business_name")}</p>
					) : null}
				</div>

				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<FieldLabel htmlFor="business_tax_id">Business registration ID</FieldLabel>
					<input
						id="business_tax_id"
						name="business_tax_id"
						type="text"
						className={fieldClass(fieldError(errors, "business_tax_id"))}
						placeholder="123456"
					/>
					{getError(errors, "business_tax_id") ? (
						<p>{getError(errors, "business_tax_id")}</p>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-2 my-2 w-full md:max-w[50%]">
				<FieldLabel htmlFor="business_type">Business type</FieldLabel>
				<select
						id="business_type"
						name="business_type"
						value={businessType}
						onChange={(event) => setBusinessType(event.target.value)}
					className={fieldClass(fieldError(errors, "business_type"))}
				>
					<option value="">
						Not specified
					</option>
					{clientBusinessTypes.map((type) => (
						<option key={type} value={type}>
							{clientBusinessTypeLabels[type]}
						</option>
					))}
				</select>
				{getError(errors, "business_type") ? (
					<p>{getError(errors, "business_type")}</p>
				) : null}
			</div>

			{businessType === "other" ? (
				<div className="flex flex-col gap-2 my-2 w-full">
					<FieldLabel htmlFor="business_type_text" required>Other business type</FieldLabel>
					<input
						id="business_type_text"
						name="business_type_text"
						type="text"
						className={fieldClass(fieldError(errors, "business_type_text"))}
						required
						placeholder="Describe your business type"
					/>
					{getError(errors, "business_type_text") ? (
						<p>{getError(errors, "business_type_text")}</p>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-2 my-2 w-full md:max-w[50%]">
				<FieldLabel htmlFor="project_idea">Project idea</FieldLabel>
				<textarea
					id="project_idea"
					name="project_idea"
					rows={5}
					className={fieldClass(fieldError(errors, "project_idea"))}
					placeholder="Tell us about your project and what you're looking to build..."
				/>
				{getError(errors, "project_idea") ? (
					<p>{getError(errors, "project_idea")}</p>
				) : null}
			</div>

			<fieldset className="mt-4">
				<legend className="flex w-full justify-between gap-2 font-semibold">Interested solution types <span className="text-xs font-normal text-secondary">Optional</span></legend>
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-2">
					{clientSolutionTypes.map((type) => (
						<label
							key={type}
							className="flex items-center gap-2 rounded-xl border border-gray-500 p-3"
						>
							<input
								type="checkbox"
								name="interested_solution_types"
								value={type}
								checked={selectedSolutions.includes(type)}
								onChange={(event) =>
									handleSolutionTypeChange(type, event.target.checked)
								}
							/>
							<span>{clientSolutionTypeLabels[type]}</span>
						</label>
					))}
				</div>
				{getError(errors, "interested_solution_types") ? (
					<p>{getError(errors, "interested_solution_types")}</p>
				) : null}
			</fieldset>

			{selectedSolutions.includes("other") ? (
				<div className="flex flex-col gap-2 my-2">
					<FieldLabel htmlFor="interested_solution_other_text" required>Other solution type</FieldLabel>
					<input
						id="interested_solution_other_text"
						name="interested_solution_other_text"
						type="text"
						className={fieldClass(fieldError(errors, "interested_solution_other_text"))}
						required
						placeholder="Tell us your other interested solution type"
					/>
					{getError(errors, "interested_solution_other_text") ? (
						<p>{getError(errors, "interested_solution_other_text")}</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
