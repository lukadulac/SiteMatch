"use client";

import { useEffect, useId, useRef } from "react";
import { Avatar } from "@/components/profile/avatar";

type AvatarPickerProps = {
  name: string | null | undefined;
  /** Id of the visible label naming this control group. */
  labelledBy?: string;
  avatarPath?: string | null;
  previewSrc?: string | null;
  hasPhoto: boolean;
  busy?: boolean;
  busyLabel?: string;
  error?: string | null;
  size?: "lg" | "xl";
  onPick: (file: File) => void;
  onRemove: () => void;
};

/** A picture (or initials) with Choose photo / Remove buttons. */
export function AvatarPicker({
  name,
  labelledBy,
  avatarPath,
  previewSrc,
  hasPhoto,
  busy = false,
  busyLabel = "Processing...",
  error,
  size = "lg",
  onPick,
  onRemove,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseRef = useRef<HTMLButtonElement>(null);
  const removeClickedRef = useRef(false);
  const hintId = useId();
  const errorId = useId();

  // Remove disappears once the photo is gone; keep keyboard focus in the group.
  useEffect(() => {
    if (!hasPhoto && !busy && removeClickedRef.current) {
      removeClickedRef.current = false;
      chooseRef.current?.focus();
    }
  }, [hasPhoto, busy]);

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
      aria-busy={busy}
      className="flex min-w-0 items-center gap-4"
    >
      <Avatar name={name} avatarPath={avatarPath} src={previewSrc} size={size} className="ring-1 ring-line" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={chooseRef}
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-semibold text-black transition hover:border-black focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? busyLabel : hasPhoto ? "Change photo" : "Choose photo"}
          </button>
          {hasPhoto ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                removeClickedRef.current = true;
                onRemove();
              }}
              className="min-h-10 rounded-lg px-3 text-sm font-semibold text-secondary transition hover:bg-zinc-100 hover:text-black focus-visible:ring-2 focus-visible:ring-zinc-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          ) : null}
        </div>
        <p id={hintId} className="mt-1.5 text-xs text-secondary">
          PNG, JPEG or WebP. Cropped to a square.
        </p>
        {error ? (
          <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Reset so picking the same file again still fires change.
          event.target.value = "";

          if (file) {
            onPick(file);
          }
        }}
      />
    </div>
  );
}
