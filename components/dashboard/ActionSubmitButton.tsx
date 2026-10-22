"use client";

import { useId, useRef } from "react";
import { useFormStatus } from "react-dom";

type ActionSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  /** "Question? Explanation." The question becomes the dialog title, the rest its body. */
  confirmMessage?: string;
  /** Red confirm button, for actions that remove or decline something. */
  destructive?: boolean;
  className: string;
};

function splitConfirmMessage(message: string) {
  const end = message.indexOf("?");

  if (end === -1) {
    return { title: message, body: null };
  }

  return {
    title: message.slice(0, end + 1),
    body: message.slice(end + 1).trim() || null,
  };
}

function ConfirmSubmitButton({
  label,
  pendingLabel,
  destructive,
}: {
  label: string;
  pendingLabel: string;
  destructive: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex min-h-12 items-center justify-center rounded-2xl px-5 text-base font-semibold text-white transition disabled:cursor-wait disabled:opacity-60 sm:text-[0.9375rem] ${
        destructive ? "bg-red-700 hover:bg-red-800" : "bg-black hover:bg-zinc-800"
      }`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Submits the surrounding form. With a confirmMessage it first asks in a
 * dialog: a bottom sheet on phones, centered from the sm breakpoint up.
 */
export function ActionSubmitButton({
  label,
  pendingLabel,
  confirmMessage,
  destructive = false,
  className,
}: ActionSubmitButtonProps) {
  const { pending } = useFormStatus();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const bodyId = useId();

  if (!confirmMessage) {
    return (
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={`${className} disabled:cursor-wait disabled:opacity-60`}
      >
        {pending ? pendingLabel : label}
      </button>
    );
  }

  const { title, body } = splitConfirmMessage(confirmMessage);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={() => dialogRef.current?.showModal()}
        className={`${className} disabled:cursor-wait disabled:opacity-60`}
      >
        {pending ? pendingLabel : label}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={headingId}
        aria-describedby={body ? bodyId : undefined}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
        className="m-0 mt-auto w-full max-w-none rounded-t-[1.75rem] bg-white p-0 text-foreground shadow-[0_24px_64px_rgba(17,17,17,0.18)] backdrop:bg-black/30 sm:m-auto sm:max-w-md sm:rounded-[1.75rem]"
      >
        <div className="px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:p-7">
          <h2 id={headingId} className="text-xl font-semibold">
            {title}
          </h2>
          {body ? (
            <p id={bodyId} className="mt-2 text-[0.9375rem] leading-relaxed text-secondary">
              {body}
            </p>
          ) : null}
          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line-strong bg-white px-5 text-base font-semibold transition hover:bg-black/3 sm:text-[0.9375rem]"
            >
              Go back
            </button>
            <ConfirmSubmitButton label={label} pendingLabel={pendingLabel} destructive={destructive} />
          </div>
        </div>
      </dialog>
    </>
  );
}
