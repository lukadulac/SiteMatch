"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { registerAction } from "@/app/(auth)/actions";
import ClientFields from "@/components/auth/register/ClientFields";
import ProviderFields from "@/components/auth/register/ProviderFields";
import RoleSelector from "@/components/auth/register/RoleSelector";
import SharedAccountFields from "@/components/auth/register/SharedAccountFields";

export type RegisterRole = "client" | "provider";

export type RegisterFieldErrors = Record<string, string[] | undefined>;
export type RegisterFormFields = Record<string, string>;

const DEFAULT_ROLE: RegisterRole = "client";
export const MULTI_VALUE_SEPARATOR = "||";

const submitLabelByRole: Record<RegisterRole, string> = {
	client: "Create client account",
	provider: "Create provider account",
};

export function getRegisterFieldValue(
	fields: RegisterFormFields | undefined,
	name: string,
) {
	return fields?.[name] ?? "";
}

export function getRegisterFieldValues(
	fields: RegisterFormFields | undefined,
	name: string,
) {
	const value = getRegisterFieldValue(fields, name);

	return value === "" ? [] : value.split(MULTI_VALUE_SEPARATOR);
}

function RegisterSubmitButton({ label }: { label: string }) {
	const { pending } = useFormStatus();

	return (
		<button
			className="w-full cursor-pointer rounded-2xl bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 p-4 text-2xl text-white disabled:cursor-not-allowed disabled:opacity-70"
			type="submit"
			disabled={pending}
		>
			{pending ? "Creating account..." : label}
		</button>
	);
}

export default function RegisterForm() {
	const [state, formAction] = useActionState(
		registerAction,
		initialAuthActionState,
	);
	const [selectedRole, setSelectedRole] = useState<RegisterRole>(
		getRegisterFieldValue(state.fields, "role") === "provider"
			? "provider"
			: DEFAULT_ROLE,
	);

	return (
		<form action={formAction}>
			<RoleSelector
				selectedRole={selectedRole}
				onRoleChange={setSelectedRole}
			/>

			<input type="hidden" name="role" value={selectedRole} />

			<SharedAccountFields errors={state.fieldErrors} fields={state.fields} />

			{selectedRole === "client" ? (
				<ClientFields
					errors={state.fieldErrors}
					fields={state.fields}
					selectedSolutionTypes={getRegisterFieldValues(
						state.fields,
						"interested_solution_types",
					)}
				/>
			) : (
				<ProviderFields
					errors={state.fieldErrors}
					fields={state.fields}
					selectedServiceCategories={getRegisterFieldValues(
						state.fields,
						"service_categories",
					)}
				/>
			)}

			{state.formError ? (
				<div className="my-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
					{state.formError}
				</div>
			) : null}

			{state.formSuccess ? (
				<div className="my-4 rounded-2xl border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
					{state.formSuccess}
				</div>
			) : null}

			<div className="my-2 w-full">
				<RegisterSubmitButton label={submitLabelByRole[selectedRole]} />
				<p className="mt-4 text-center text-xl text-muted-foreground">
					Already have an account?{" "}
					<Link href="/login" className="font-semibold text-black">
						Sign in
					</Link>
				</p>
			</div>
		</form>
	);
}
