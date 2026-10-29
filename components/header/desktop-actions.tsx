import Link from "next/link";
import { MessageSquare, Plus, ShieldCheck } from "lucide-react";

import { logoutAction } from "@/app/(auth)/actions";
import { Avatar } from "@/components/profile/avatar";
import type { HeaderUser } from "@/lib/navigation/header-state";
import { CountBadge } from "./nav-row";

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2";

const ghostButton = `flex h-10 items-center rounded-lg px-4 text-[15px] font-semibold text-[#111] transition-colors hover:bg-zinc-100 ${focusRing}`;

/** Right side of the desktop header: guest sign-up, or the role CTA, messages and account. */
export function DesktopActions({ user }: { user: HeaderUser | null }) {
	if (!user) {
		return (
			<div className="ml-auto hidden items-center gap-2 lg:flex">
				<Link href="/login" className={ghostButton}>
					Log in
				</Link>
				<Link
					href="/register"
					className={`flex h-10 items-center rounded-lg bg-linear-to-r from-brand-from to-brand-to px-[18px] text-[15px] font-semibold text-white transition hover:opacity-90 ${focusRing}`}
				>
					Sign up
				</Link>
			</div>
		);
	}

	const unread = user.counts.unreadMessages;

	return (
		<div className="ml-auto hidden items-center gap-2 lg:flex">
			{user.cta ? (
				<Link
					href={user.cta.href}
					className={`flex h-10 items-center gap-2 rounded-lg bg-linear-to-r from-brand-from to-brand-to pr-4 pl-3 text-[15px] font-semibold text-white transition hover:opacity-90 active:opacity-80 ${focusRing}`}
				>
					{user.cta.icon === "shield" ? (
						<ShieldCheck aria-hidden="true" className="size-[18px]" />
					) : (
						<Plus aria-hidden="true" className="size-[18px]" />
					)}
					{user.cta.label}
				</Link>
			) : null}

			{user.role === "client" || user.role === "provider" ? (
				<Link
					href="/dashboard/messages"
					aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
					className={`relative grid size-11 place-items-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-[#111] ${focusRing}`}
				>
					<MessageSquare aria-hidden="true" className="size-[22px]" />
					{unread > 0 ? (
						<span className="absolute top-1 right-0.5 rounded-full ring-2 ring-white">
							<CountBadge count={unread} kind="unread" />
						</span>
					) : null}
				</Link>
			) : null}

			<Link
				href={user.profileHref}
				aria-label={`Account: ${user.name}${user.role ? `, ${user.role}` : ""}`}
				className={`grid size-11 place-items-center rounded-full ${focusRing}`}
			>
				<Avatar name={user.name} avatarPath={user.avatarPath} size="sm" />
			</Link>

			<form action={logoutAction}>
				<button type="submit" className={`${ghostButton} text-zinc-600 hover:text-[#111]`}>
					Log out
				</button>
			</form>
		</div>
	);
}
