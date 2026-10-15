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
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getLoginHref } from "@/lib/auth/return-url";

export type RegisterRole = "client" | "provider";

export type RegisterFieldErrors = Record<string, string[] | undefined>;
export type RegisterFormFields = Record<string, string>;

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

export default function RegisterForm({ next }: { next?: string | null }) {
	const [state, formAction] = useActionState(
		registerAction,
		initialAuthActionState,
	);
	const [selectedRole, setSelectedRole] = useState<RegisterRole | null>(null);
	if (state.verificationRequired) {
		return <VerifyEmailForm email={state.fields?.email} next={next} registered />;
	}

	return (
		<>
		<h1 className="text-4xl text-center font-semibold">
			Join Work<span className="bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">Bridge</span>
		</h1>
		<p className="text-center mb-4 mt-2">Create your account and get started.</p>
		<form action={formAction}>
			{next ? <input type="hidden" name="next" value={next} /> : null}
			<RoleSelector
				selectedRole={selectedRole}
				onRoleChange={setSelectedRole}
				error={state.fieldErrors?.role?.[0]}
			/>

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
			) : selectedRole === "provider" ? (
				<ProviderFields
					errors={state.fieldErrors}
					fields={state.fields}
					selectedServiceCategories={getRegisterFieldValues(
						state.fields,
						"service_categories",
					)}
				/>
			) : null}

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
				<RegisterSubmitButton label={selectedRole ? submitLabelByRole[selectedRole] : "Create account"} />
				<p className="mt-4 text-center text-xl text-muted-foreground">
					Already have an account?{" "}
					<Link href={getLoginHref(next)} className="font-semibold text-black">
						Sign in
					</Link>
				</p>
			</div>
		</form>
		</>
	);
}
