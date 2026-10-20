"use client";

import { UserRound } from "lucide-react";
import { useCallback, useState } from "react";
import { getAvatarUrl } from "@/lib/profiles/avatar";

const sizeClasses = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-11 text-sm",
  xl: "size-24 text-2xl",
} as const;

export type AvatarSize = keyof typeof sizeClasses;

export function getInitials(name: string | null | undefined) {
  return (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();
}

type AvatarProps = {
  name: string | null | undefined;
  /** profiles.avatar_url: an object path in the avatars bucket. */
  avatarPath?: string | null;
  /** A ready URL (e.g. a local preview); wins over avatarPath. */
  src?: string | null;
  size?: AvatarSize;
  className?: string;
};

/**
 * A person's profile picture, or their initials when there is none or it fails
 * to load. Decorative: the name is always shown next to it.
 */
export function Avatar({ name, avatarPath, src, size = "md", className = "" }: AvatarProps) {
  const imageUrl = src ?? getAvatarUrl(avatarPath);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // A server-rendered image can fail before hydration attaches onError.
  const detectEarlyFailure = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && image.naturalWidth === 0 && imageUrl) {
        setFailedUrl(imageUrl);
      }
    },
    [imageUrl],
  );
  const classes = `${sizeClasses[size]} shrink-0 overflow-hidden rounded-full ${className}`;

  if (imageUrl && imageUrl !== failedUrl) {
    return (
      // Avatars are small, already resized and served from Storage, so next/image
      // (which would need the Supabase host configured) adds nothing.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        ref={detectEarlyFailure}
        onError={() => setFailedUrl(imageUrl)}
        className={`${classes} bg-zinc-100 object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${classes} flex items-center justify-center bg-violet-50 font-semibold text-violet-800`}
    >
      {getInitials(name) || <UserRound className="size-1/2" />}
    </span>
  );
}
