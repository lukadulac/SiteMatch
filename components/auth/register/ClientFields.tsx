import { useState } from "react";
import {
	clientBusinessTypeLabels,
	clientBusinessTypes,
	clientSolutionTypeLabels,
	clientSolutionTypes,
} from "@/lib/auth/client-profile";
import {
	getRegisterFieldValue,
	type RegisterFieldErrors,
	type RegisterFormFields,
} from "@/components/auth/register/RegisterForm";

type ClientFieldsProps = {
	errors?: RegisterFieldErrors;
	fields?: RegisterFormFields;
	selectedSolutionTypes: string[];
};

function getError(errors: RegisterFieldErrors | undefined, name: string) {
	return errors?.[name]?.[0];
}

export default function ClientFields({
	errors,
	fields,
	selectedSolutionTypes,
}: ClientFieldsProps) {
	const [businessType, setBusinessType] = useState(
		getRegisterFieldValue(fields, "business_type"),
	);
	const [selectedSolutions, setSelectedSolutions] = useState<string[]>(
		selectedSolutionTypes,
	);

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
					<label htmlFor="business_name">Business name</label>
					<input
						id="business_name"
						name="business_name"
						type="text"
						className="border w-full rounded-2xl p-2.5  placeholder:pl-2"
						placeholder="Your Company Inc."
						defaultValue={getRegisterFieldValue(fields, "business_name")}
					/>
					{getError(errors, "business_name") ? (
						<p>{getError(errors, "business_name")}</p>
					) : null}
				</div>

				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="business_tax_id">Business tax ID</label>
					<input
						id="business_tax_id"
						name="business_tax_id"
						type="text"
						className="border w-full rounded-2xl p-2.5  placeholder:pl-2"
						placeholder="123456"
						defaultValue={getRegisterFieldValue(fields, "business_tax_id")}
					/>
					{getError(errors, "business_tax_id") ? (
						<p>{getError(errors, "business_tax_id")}</p>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-2 my-2 w-full md:max-w[50%]">
				<label htmlFor="business_type">Business type</label>
				<select
						id="business_type"
						name="business_type"
						value={businessType}
						onChange={(event) => setBusinessType(event.target.value)}
					className="border w-full rounded-2xl p-2.5  placeholder:pl-2"
				>
					<option value="" disabled>
						Select a business type
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
					<label htmlFor="business_type_text">Other business type</label>
					<input
						id="business_type_text"
						name="business_type_text"
						type="text"
						className="border w-full rounded-2xl p-2.5  placeholder:pl-2"
						placeholder="Tell us your bussiness type"
						defaultValue={getRegisterFieldValue(fields, "business_type_text")}
					/>
					{getError(errors, "business_type_text") ? (
						<p>{getError(errors, "business_type_text")}</p>
					) : null}
				</div>
			) : null}

			<div className="flex flex-col gap-2 my-2 w-full md:max-w[50%]">
				<label htmlFor="project_idea">Project idea</label>
				<textarea
					id="project_idea"
					name="project_idea"
					rows={5}
					className="border w-full rounded-2xl p-2.5  placeholder:pl-2"
					placeholder="Tell us about your project and what you're looking to build..."
					defaultValue={getRegisterFieldValue(fields, "project_idea")}
				/>
				{getError(errors, "project_idea") ? (
					<p>{getError(errors, "project_idea")}</p>
				) : null}
			</div>

			<fieldset className="mt-4">
				<h3 className="font-semibold">Interested solution types</h3>
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
					<label htmlFor="interested_solution_other_text">
						Other solution type
					</label>
					<input
						id="interested_solution_other_text"
						name="interested_solution_other_text"
						type="text"
						className="border border-gray-500 w-full rounded-xl p-3"
						placeholder="Tell us your other interested solution type"
						defaultValue={getRegisterFieldValue(
							fields,
							"interested_solution_other_text",
						)}
					/>
					{getError(errors, "interested_solution_other_text") ? (
						<p>{getError(errors, "interested_solution_other_text")}</p>
					) : null}
				</div>
			) : null}
		</section>
	);
}
