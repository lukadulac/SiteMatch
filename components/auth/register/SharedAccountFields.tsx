import {
	getRegisterFieldValue,
	type RegisterFieldErrors,
	type RegisterFormFields,
} from "@/components/auth/register/RegisterForm";

type SharedAccountFieldsProps = {
	errors?: RegisterFieldErrors;
	fields?: RegisterFormFields;
};

function getError(errors: RegisterFieldErrors | undefined, name: string) {
	return errors?.[name]?.[0];
}

export default function SharedAccountFields({
	errors,
	fields,
}: SharedAccountFieldsProps) {
	return (
		<section className="p-2">
			<h3 className="font-semibold">Personal information</h3>
			<hr className="border-gray-400 mx-auto my-2" />
			<div className="flex flex-col gap-2 md:flex-row md:gap-4">
				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="full_name">Full name</label>
					<input
						className="border w-full rounded-2xl p-2.5  placeholder:pl-2"
						id="full_name"
						name="full_name"
						type="text"
						autoComplete="name"
						placeholder="Jhon Doe"
						defaultValue={getRegisterFieldValue(fields, "full_name")}
					/>
					{getError(errors, "full_name") ? (
						<p>{getError(errors, "full_name")}</p>
					) : null}
				</div>

				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="email">Email</label>
					<input
						className="border w-full rounded-2xl p-2.5 placeholder:pl-2"
						id="email"
						name="email"
						type="email"
						autoComplete="email"
						placeholder="youremail@example.com"
						defaultValue={getRegisterFieldValue(fields, "email")}
					/>
					{getError(errors, "email") ? (
						<p>{getError(errors, "email")}</p>
					) : null}
				</div>
			</div>
			<div className="flex flex-col gap-2 md:flex-row md:gap-4">
				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="phone">Phone</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						autoComplete="tel"
						className="border w-full rounded-2xl p-2.5 placeholder:pl-2"
						placeholder="1111111111"
						defaultValue={getRegisterFieldValue(fields, "phone")}
					/>
					{getError(errors, "phone") ? (
						<p>{getError(errors, "phone")}</p>
					) : null}
				</div>

				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="country">Country</label>
					<input
						id="country"
						name="country"
						type="text"
						autoComplete="country-name"
						className="border w-full rounded-2xl p-2.5 placeholder:pl-2"
						placeholder="Serbia"
						defaultValue={getRegisterFieldValue(fields, "country")}
					/>
					{getError(errors, "country") ? (
						<p>{getError(errors, "country")}</p>
					) : null}
				</div>
			</div>
			<div className="flex flex-col gap-2 md:flex-row md:gap-4">
				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="city">City</label>
					<input
						id="city"
						name="city"
						type="text"
						autoComplete="address-level2"
						className="border w-full rounded-2xl p-2.5 placeholder:pl-2"
						placeholder="Belgrade"
						defaultValue={getRegisterFieldValue(fields, "city")}
					/>
					{getError(errors, "city") ? <p>{getError(errors, "city")}</p> : null}
				</div>

				<div className="flex flex-col gap-2 my-2 w-full md:max-w-[50%]">
					<label htmlFor="password">Password</label>
					<input
						id="password"
						name="password"
						type="password"
						autoComplete="new-password"
						className="border w-full rounded-2xl p-2.5 placeholder:pl-2"
						placeholder="Min. 8 characters"
					/>
					{getError(errors, "password") ? (
						<p>{getError(errors, "password")}</p>
					) : null}
				</div>
			</div>
		</section>
	);
}
