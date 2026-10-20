import {
	getRegisterFieldValue,
	type RegisterFieldErrors,
	type RegisterFormFields,
} from "@/components/auth/register/RegisterForm";
import { FieldError, FieldLabel, fieldClass, fieldError } from "@/components/auth/register/field-ui";
import { AvatarPicker } from "@/components/profile/avatar-picker";

export type RegistrationAvatarState = {
	previewUrl: string | null;
	busy: boolean;
	error: string | null;
	onPick: (file: File) => void;
	onRemove: () => void;
};

type SharedAccountFieldsProps = {
	errors?: RegisterFieldErrors;
	fields?: RegisterFormFields;
	avatar: RegistrationAvatarState;
};

const accountFields = [
	{ name: "full_name", label: "Full name", type: "text", autoComplete: "name", placeholder: "Jane Doe", required: true },
	{ name: "email", label: "Email", type: "email", autoComplete: "email", placeholder: "you@example.com", required: true },
	{ name: "phone", label: "Phone", type: "tel", autoComplete: "tel", placeholder: "+1 555 123 4567", required: false },
	{ name: "country", label: "Country", type: "text", autoComplete: "country-name", placeholder: "United States", required: false },
	{ name: "city", label: "City", type: "text", autoComplete: "address-level2", placeholder: "New York", required: false },
	{ name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "At least 8 characters", required: true },
] as const;

export default function SharedAccountFields({ errors, fields, avatar }: SharedAccountFieldsProps) {
	return (
		<section className="p-2">
			<h3 className="font-semibold">Personal information</h3>
			<hr className="mx-auto my-2 border-gray-400" />
			<div className="grid gap-4 md:grid-cols-2">
				{accountFields.map((field) => {
					const error = fieldError(errors, field.name);
					return (
						<div key={field.name} className="flex min-w-0 flex-col gap-2">
							<FieldLabel htmlFor={field.name} required={field.required}>{field.label}</FieldLabel>
							<input
								className={fieldClass(error)}
								id={field.name}
								name={field.name}
								type={field.type}
								autoComplete={field.autoComplete}
								placeholder={field.placeholder}
								required={field.required}
								aria-invalid={Boolean(error)}
								aria-describedby={error ? `${field.name}-error` : undefined}
								defaultValue={field.name === "password" ? undefined : getRegisterFieldValue(fields, field.name)}
							/>
							<FieldError name={field.name} errors={errors} />
						</div>
					);
				})}
				<div className="flex min-w-0 flex-col gap-2 md:col-span-2">
					<span className="flex items-baseline justify-between gap-2 text-sm font-medium text-black">
						<span id="avatar-label">Profile photo</span>
						<span className="text-xs font-normal text-secondary">Optional</span>
					</span>
					<AvatarPicker
						name={null}
						labelledBy="avatar-label"
						previewSrc={avatar.previewUrl}
						hasPhoto={Boolean(avatar.previewUrl)}
						busy={avatar.busy}
						error={avatar.error ?? fieldError(errors, "avatar")}
						onPick={avatar.onPick}
						onRemove={avatar.onRemove}
					/>
				</div>
			</div>
		</section>
	);
}
