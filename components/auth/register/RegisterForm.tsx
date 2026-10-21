"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, type SubmitEvent } from "react";
import { initialAuthActionState } from "@/app/(auth)/action-state";
import { registerAction } from "@/app/(auth)/actions";
import ClientFields from "@/components/auth/register/ClientFields";
import ProviderFields from "@/components/auth/register/ProviderFields";
import RoleSelector from "@/components/auth/register/RoleSelector";
import SharedAccountFields from "@/components/auth/register/SharedAccountFields";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getLoginHref } from "@/lib/auth/return-url";
import { MAX_REGISTRATION_AVATAR_BYTES, setAvatarFormField } from "@/lib/profiles/avatar";
import { AvatarResizeError, resizeAvatar } from "@/lib/profiles/resize-avatar";

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

function RegisterSubmitButton({ label, pending }: { label: string; pending: boolean }) {
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

type PickedAvatar = { blob: Blob; previewUrl: string };

/**
 * Keeps the resized picture outside the form: React resets the form after each
 * submission, and a file input cannot be refilled from the returned state.
 */
function useRegistrationAvatar() {
	const [avatar, setAvatar] = useState<PickedAvatar | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		return () => {
			if (avatar) {
				URL.revokeObjectURL(avatar.previewUrl);
			}
		};
	}, [avatar]);

	async function onPick(file: File) {
		setBusy(true);
		setError(null);

		try {
			const blob = await resizeAvatar(file, MAX_REGISTRATION_AVATAR_BYTES);
			setAvatar({ blob, previewUrl: URL.createObjectURL(blob) });
		} catch (resizeError) {
			setError(
				resizeError instanceof AvatarResizeError
					? resizeError.message
					: "This image could not be used. Try another photo.",
			);
		} finally {
			setBusy(false);
		}
	}

	return {
		blob: avatar?.blob ?? null,
		field: {
			previewUrl: avatar?.previewUrl ?? null,
			busy,
			error,
			onPick,
			onRemove: () => {
				setAvatar(null);
				setError(null);
			},
		},
	};
}

export default function RegisterForm({ next }: { next?: string | null }) {
	const [state, formAction, isPending] = useActionState(
		registerAction,
		initialAuthActionState,
	);
	const [selectedRole, setSelectedRole] = useState<RegisterRole | null>(null);
	const avatar = useRegistrationAvatar();

	// Submitting through onSubmit rather than the form's action keeps React from
	// resetting the form afterwards, which would clear the password and uncheck
	// the controlled role radio while the page still shows it as selected.
	function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = setAvatarFormField(new FormData(event.currentTarget), avatar.blob);
		startTransition(() => formAction(formData));
	}

	if (state.verificationRequired) {
		return <VerifyEmailForm email={state.fields?.email} next={next} registered />;
	}

	return (
		<>
		<h1 className="text-4xl text-center font-semibold">
			Join Work<span className="bg-linear-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">Bridge</span>
		</h1>
		<p className="text-center mb-4 mt-2">Create your account and get started.</p>
		<form onSubmit={handleSubmit}>
			{next ? <input type="hidden" name="next" value={next} /> : null}
			<RoleSelector
				selectedRole={selectedRole}
				onRoleChange={setSelectedRole}
				error={state.fieldErrors?.role?.[0]}
			/>

			<SharedAccountFields errors={state.fieldErrors} fields={state.fields} avatar={avatar.field} />

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
				<RegisterSubmitButton
					label={selectedRole ? submitLabelByRole[selectedRole] : "Create account"}
					pending={isPending}
				/>
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
