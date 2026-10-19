"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { moderationSchema } from "@/lib/admin/schemas";
import {
  moderationChoices,
  type ModerationDecision,
  type ModerationTarget,
} from "@/lib/admin/ui";

type Props = {
  targetType: ModerationTarget;
  targetId: string;
  title: string;
  status: string;
  retryDeletion?: boolean;
};

export function ModerationDialog({ targetType, targetId, title, status, retryDeletion = false }: Props) {
  const choices = moderationChoices(targetType, status, retryDeletion);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const router = useRouter();
  const [decision, setDecision] = useState<ModerationDecision>(choices[0] ?? "delete");
  const [reason, setReason] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (choices.length === 0) return null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (decision === "delete" && !confirmed) {
      setError("Confirm permanent deletion before continuing.");
      return;
    }
    const date = decision === "suspend" ? new Date(suspendedUntil) : null;
    const input = {
      targetType, targetId, decision, reason: reason.trim(),
      ...(date && Number.isFinite(date.getTime()) ? { suspendedUntil: date.toISOString() } : {}),
    };
    const parsed = moderationSchema.safeParse(input);
    if (!parsed.success) {
      setError("Enter a reason of 10-2000 characters and, for suspension, a future date.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/moderation", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error : "Moderation failed. Please try again.";
        setError(message);
        if (response.status === 503) router.refresh();
        return;
      }
      setSuccess(`${decision.charAt(0).toUpperCase()}${decision.slice(1)} completed.`);
      setReason("");
      setConfirmed(false);
      dialog.current?.close();
      router.refresh();
    } catch {
      setError("Network error. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setError(""); setDecision(choices[0]); dialog.current?.showModal(); }} className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-violet-700 hover:border-violet-400">
        Manage
      </button>
      {success && <span role="status" className="ml-2 block text-xs text-emerald-700">{success}</span>}
      <dialog
        ref={dialog}
        aria-labelledby={headingId}
        onCancel={(event) => { if (busy) event.preventDefault(); }}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-md border border-line bg-white p-0 text-black shadow-xl backdrop:bg-black/45"
      >
        <form onSubmit={submit} className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={headingId} className="text-xl font-semibold">Moderate {targetType}</h2>
              <p className="mt-1 wrap-break-word text-sm text-secondary">{title}</p>
            </div>
            <button type="button" onClick={() => dialog.current?.close()} disabled={busy} aria-label="Close dialog" title="Close dialog" className="text-2xl leading-none text-secondary hover:text-black">&times;</button>
          </div>

          <label className="block space-y-1 text-sm font-medium">
            <span>Decision</span>
            <select value={decision} onChange={(event) => { setDecision(event.target.value as ModerationDecision); setError(""); }} disabled={busy} className="min-h-11 w-full rounded-md border border-line bg-white px-3 capitalize">
              {choices.map((choice) => <option key={choice} value={choice}>{choice === "delete" && retryDeletion ? "Retry deletion" : choice}</option>)}
            </select>
          </label>

          {decision === "suspend" && (
            <label className="block space-y-1 text-sm font-medium">
              <span>Suspended until</span>
              <input type="datetime-local" value={suspendedUntil} onChange={(event) => setSuspendedUntil(event.target.value)} required disabled={busy} className="min-h-11 w-full rounded-md border border-line px-3" />
            </label>
          )}

          <label className="block space-y-1 text-sm font-medium">
            <span>Reason</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={2000} required rows={4} disabled={busy} className="w-full rounded-md border border-line p-3" />
            <span className="block text-xs font-normal text-secondary">10-2000 characters. This decision is recorded in the audit log.</span>
          </label>

          {decision === "delete" && (
            <label className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required className="mt-1" />
              <span>I understand this deletion is permanent. Related history may be retained where required.</span>
            </label>
          )}

          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => dialog.current?.close()} disabled={busy} className="min-h-11 rounded-md border border-line px-4 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={busy} className={`min-h-11 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-60 ${decision === "delete" ? "bg-red-700" : "bg-violet-700"}`}>
              {busy ? "Saving..." : `Confirm ${decision}`}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
