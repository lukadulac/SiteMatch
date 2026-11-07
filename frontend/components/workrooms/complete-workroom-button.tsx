"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { completeWorkroomAction } from "@/app/dashboard/workroom-actions";

type CompleteWorkroomButtonProps = {
	workroomId: string;
	label?: string;
	/** primary: the next-step card · bar: the mobile action bar · retry: inside the error notice */
	variant?: "primary" | "bar" | "retry";
};

const triggerClasses = {
	primary:
		"inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-black px-5 text-[0.9375rem] font-semibold text-white transition hover:bg-zinc-800 sm:w-auto",
	bar: "inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-black px-5 text-base font-semibold text-white",
	retry:
		"inline-flex min-h-10 items-center rounded-xl border border-red-900/25 bg-white px-4 text-sm font-semibold text-red-900 transition hover:bg-red-50",
};

function ConfirmButton() {
	const { pending } = useFormStatus();

	return (
		<button
			type="submit"
			disabled={pending}
			aria-busy={pending}
			className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-black px-5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60 sm:text-[0.9375rem]"
		>
			{pending ? "Completing..." : "Mark completed"}
		</button>
	);
}

/**
 * Opens a confirm dialog before completing, since completion can't be undone.
 * A bottom sheet on phones, a centered dialog from the sm breakpoint up.
 */
export function CompleteWorkroomButton({
	workroomId,
	label = "Mark as completed",
	variant = "primary",
}: CompleteWorkroomButtonProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const headingId = useId();
	const bodyId = useId();

	return (
		<>
			<button
				type="button"
				onClick={() => dialogRef.current?.showModal()}
				className={triggerClasses[variant]}
			>
				{label}
			</button>
			<dialog
				ref={dialogRef}
				aria-labelledby={headingId}
				aria-describedby={bodyId}
				onClick={(event) => {
					if (event.target === event.currentTarget) {
						event.currentTarget.close();
					}
				}}
				className="m-0 mt-auto w-full max-w-none rounded-t-[1.75rem] bg-white p-0 text-foreground shadow-[0_24px_64px_rgba(17,17,17,0.18)] backdrop:bg-black/30 sm:m-auto sm:max-w-md sm:rounded-[1.75rem]"
			>
				<div className="px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-7">
					<h2 id={headingId} className="text-xl font-semibold">
						Mark this workroom completed?
					</h2>
					<p id={bodyId} className="mt-2 text-[0.9375rem] leading-relaxed text-secondary">
						The client will see it as delivered. This can&apos;t be undone.
					</p>
					<form
						action={completeWorkroomAction.bind(null, workroomId)}
						className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end"
					>
						<input type="hidden" name="context" value="provider-workroom-detail" />
						<button
							type="button"
							onClick={() => dialogRef.current?.close()}
							className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line-strong bg-white px-5 text-base font-semibold transition hover:bg-black/3 sm:text-[0.9375rem]"
						>
							Cancel
						</button>
						<ConfirmButton />
					</form>
				</div>
			</dialog>
		</>
	);
}
