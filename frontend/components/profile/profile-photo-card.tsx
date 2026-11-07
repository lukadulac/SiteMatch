"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AvatarPicker } from "@/components/profile/avatar-picker";
import { MAX_AVATAR_BYTES, setAvatarFormField } from "@/lib/profiles/avatar";
import { AvatarResizeError, resizeAvatar } from "@/lib/profiles/resize-avatar";

// The upload limit is 2 MB, but a 512 px avatar never needs that much.
const PROFILE_AVATAR_TARGET_BYTES = Math.min(MAX_AVATAR_BYTES, 200 * 1024);

type ProfilePhotoCardProps = {
  name: string;
  avatarPath: string | null;
};

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? "Your profile photo could not be saved.";
  } catch {
    return "Your profile photo could not be saved.";
  }
}

/** Uploads or removes the signed-in user's picture; changes save immediately. */
export function ProfilePhotoCard({ name, avatarPath }: ProfilePhotoCardProps) {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState(avatarPath);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // The resized picture, shown while it uploads and kept afterwards (it is the
  // same image), so the stored copy never has to load in after a change.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function save(
    request: () => Promise<Response>,
    label: string,
    done: string,
  ): Promise<boolean> {
    setBusyLabel(label);
    setError(null);
    setMessage(null);

    try {
      const response = await request();

      if (!response.ok) {
        setError(await readError(response));
        return false;
      }

      const body = (await response.json()) as { data: { avatarPath: string | null } };
      setCurrentPath(body.data.avatarPath);
      setMessage(done);
      router.refresh();
      return true;
    } catch {
      setError("Your profile photo could not be saved. Check your connection and try again.");
      return false;
    } finally {
      setBusyLabel(null);
    }
  }

  async function handlePick(file: File) {
    let blob: Blob;

    setBusyLabel("Processing...");
    setError(null);
    setMessage(null);

    try {
      blob = await resizeAvatar(file, PROFILE_AVATAR_TARGET_BYTES);
    } catch (resizeError) {
      setBusyLabel(null);
      setError(
        resizeError instanceof AvatarResizeError
          ? resizeError.message
          : "This image could not be used. Try another photo.",
      );
      return;
    }

    const form = setAvatarFormField(new FormData(), blob);
    setPreviewUrl(URL.createObjectURL(blob));

    const saved = await save(
      () => fetch("/api/profile/avatar", { method: "POST", body: form }),
      "Uploading...",
      "Profile photo updated.",
    );

    if (!saved) {
      // Show the stored picture again.
      setPreviewUrl(null);
    }
  }

  return (
    <div>
      <AvatarPicker
        name={name}
        avatarPath={currentPath}
        previewSrc={previewUrl}
        hasPhoto={Boolean(currentPath)}
        busy={busyLabel !== null}
        busyLabel={busyLabel ?? undefined}
        error={error}
        size="xl"
        onPick={handlePick}
        onRemove={async () => {
          const removed = await save(
            () => fetch("/api/profile/avatar", { method: "DELETE" }),
            "Removing...",
            "Profile photo removed.",
          );

          if (removed) {
            setPreviewUrl(null);
          }
        }}
      />
      <p className="mt-4 text-sm text-secondary" role="status">
        {message ?? "Your photo appears on your listings, applications and conversations."}
      </p>
    </div>
  );
}
