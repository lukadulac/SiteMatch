"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight, CircleAlert, LogOut, Plus, ShieldCheck, X } from "lucide-react";
import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent,
	type RefObject,
} from "react";

import { logoutAction } from "@/app/(auth)/actions";
import { Avatar } from "@/components/profile/avatar";
import type { HeaderUser } from "@/lib/navigation/header-state";
import { getBrowseItems, getWorkspaceItems, getWorkspaceLabel } from "@/lib/navigation/menu-items";
import { Logo } from "./logo";
import { BrowseRow, WorkspaceRow } from "./nav-row";

const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2";

// Rows fade in one after another; the delay stops growing after the eighth row.
const staggerClass =
	"motion-safe:animate-[row-in_200ms_ease-out_both] motion-safe:[animation-delay:calc(60ms+min(var(--i),7)*20ms)]";

function staggerStyle(index: number) {
	return { "--i": index } as CSSProperties;
}

/** Tracks whether the body has scrolled (top hairline) and has more below (footer shadow). */
function useScrollEdges(ref: RefObject<HTMLDivElement | null>) {
	const [edges, setEdges] = useState({ scrolled: false, more: false });

	const update = () => {
		const element = ref.current;
		if (!element) {
			return;
		}

		setEdges({
			scrolled: element.scrollTop > 0,
			more: element.scrollTop + element.clientHeight < element.scrollHeight - 1,
		});
	};

	useEffect(() => {
		const element = ref.current;
		if (!element) {
			return;
		}

		// Fires once on observe, then whenever the body or its content changes size.
		const observer = new ResizeObserver(update);
		observer.observe(element);
		if (element.firstElementChild) {
			observer.observe(element.firstElementChild);
		}

		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `update` only reads the ref.
	}, [ref]);

	return { ...edges, update };
}

function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
	const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
		"a[href], button:not([disabled])",
	);
	const first = focusable[0];
	const last = focusable[focusable.length - 1];

	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last?.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first?.focus();
	}
}

type MobileMenuProps = {
	user: HeaderUser | null;
	pathname: string;
	dataState: "open" | "closed";
	onClose: () => void;
	drawerRef: RefObject<HTMLDivElement | null>;
	closeButtonRef: RefObject<HTMLButtonElement | null>;
};

export function MobileMenu({
	user,
	pathname,
	dataState,
	onClose,
	drawerRef,
	closeButtonRef,
}: MobileMenuProps) {
	const bodyRef = useRef<HTMLDivElement>(null);
	const edges = useScrollEdges(bodyRef);
	const browseItems = getBrowseItems(pathname);
	const workspaceItems = user?.role ? getWorkspaceItems(user.role, pathname, user.counts) : [];

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		} else if (event.key === "Tab") {
			keepFocusInside(event);
		}
	};

	return (
		<div className="lg:hidden">
			{/* Closes on pointerdown and swallows the event so the page underneath never gets the tap. */}
			<div
				aria-hidden="true"
				data-state={dataState}
				onPointerDown={(event) => {
					event.preventDefault();
					onClose();
				}}
				className="fixed inset-0 z-60 bg-[#111]/40 backdrop-blur-sm transition-opacity data-[state=closed]:opacity-0 motion-safe:duration-[240ms] motion-safe:ease-out motion-safe:data-[state=closed]:duration-200 motion-safe:data-[state=closed]:ease-in motion-reduce:duration-150 motion-reduce:ease-linear"
			/>

			<div
				ref={drawerRef}
				id="mobile-menu"
				role="dialog"
				aria-modal="true"
				aria-label="Menu"
				data-state={dataState}
				onKeyDown={handleKeyDown}
				className="group fixed inset-y-0 right-0 z-60 flex w-[85vw] max-w-[400px] flex-col overflow-hidden rounded-l-2xl bg-white pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] text-[#111] shadow-[-16px_0_40px_rgba(17,17,17,.18)] motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)] motion-safe:data-[state=closed]:translate-x-full motion-safe:data-[state=closed]:duration-200 motion-safe:data-[state=closed]:ease-[cubic-bezier(.32,0,.67,0)] motion-reduce:transition-opacity motion-reduce:duration-150 motion-reduce:ease-linear motion-reduce:data-[state=closed]:opacity-0"
			>
				<div
					className={`flex h-14 shrink-0 items-center justify-between border-b pl-4 pr-1.5 transition-colors sm:h-16 sm:pr-6 ${
						edges.scrolled ? "border-black/[.08]" : "border-transparent"
					}`}
				>
					<Logo onNavigate={onClose} />
					<button
						ref={closeButtonRef}
						type="button"
						onClick={onClose}
						aria-label="Close menu"
						className={`grid size-11 place-items-center rounded-lg bg-zinc-100 text-[#111] transition-colors hover:bg-zinc-200 active:bg-zinc-300 ${focusRing}`}
					>
						<X
							aria-hidden="true"
							className="size-6 transition-[transform,opacity] duration-200 ease-out group-data-[state=closed]:-rotate-90 group-data-[state=closed]:opacity-0 motion-reduce:transition-none motion-reduce:group-data-[state=closed]:rotate-0"
						/>
					</button>
				</div>

				<div
					ref={bodyRef}
					onScroll={edges.update}
					className={`min-h-0 flex-1 overflow-y-auto overscroll-contain ${
						user ? "" : "pb-[env(safe-area-inset-bottom)]"
					}`}
				>
					<nav aria-label="Main" className="px-4 pt-2 pb-6">
						{user ? <AccountSummary user={user} onNavigate={onClose} /> : <GuestIntro onNavigate={onClose} />}

						<SectionLabel>Browse</SectionLabel>
						<ul className="space-y-0.5">
							{browseItems.map((item, index) => (
								<li key={item.href} className={staggerClass} style={staggerStyle(index)}>
									<BrowseRow {...item} onNavigate={onClose} />
								</li>
							))}
						</ul>

						{user?.role && workspaceItems.length > 0 ? (
							<>
								<SectionLabel>{getWorkspaceLabel(user.role)}</SectionLabel>
								<ul className="space-y-0.5">
									{workspaceItems.map((item, index) => (
										<li
											key={item.href}
											className={staggerClass}
											style={staggerStyle(browseItems.length + index)}
										>
											<WorkspaceRow {...item} onNavigate={onClose} />
										</li>
									))}
								</ul>
							</>
						) : null}
					</nav>
				</div>

				{user ? (
					<div
						className={`flex shrink-0 items-center border-t border-black/[.08] bg-white px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] transition-shadow ${
							edges.more ? "shadow-[0_-8px_16px_-8px_rgba(17,17,17,.12)]" : ""
						}`}
					>
						<form action={logoutAction}>
							<button
								type="submit"
								className={`-ml-3 flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-[#111] ${focusRing}`}
							>
								<LogOut aria-hidden="true" className="size-[18px]" />
								Log out
							</button>
						</form>
					</div>
				) : null}
			</div>
		</div>
	);
}

function SectionLabel({ children }: { children: string }) {
	return (
		<h2 className="mt-6 mb-1 px-3 text-xs leading-4 font-semibold tracking-[0.06em] text-zinc-600 uppercase">
			{children}
		</h2>
	);
}

function AccountSummary({ user, onNavigate }: { user: HeaderUser; onNavigate: () => void }) {
	return (
		<>
			<Link
				href={user.profileHref}
				onClick={onNavigate}
				className={`flex items-center gap-3 rounded-xl bg-stone-50 p-3 text-[#111] ring-1 ring-black/[.08] transition-colors hover:bg-zinc-100 ${focusRing}`}
			>
				<Avatar name={user.name} avatarPath={user.avatarPath} size="md" />
				<span className="flex min-w-0 flex-1 flex-col gap-1">
					<span className="truncate text-[15px] leading-5 font-semibold">{user.name}</span>
					<span className="flex flex-wrap gap-1.5">
						{user.role ? (
							<span className="inline-flex h-[22px] items-center rounded-md bg-zinc-100 px-2 text-xs font-semibold text-zinc-700 capitalize ring-1 ring-black/[.08] ring-inset">
								{user.role}
							</span>
						) : null}
						{user.emailVerified ? (
							<span className="inline-flex h-[22px] items-center gap-1 rounded-md bg-green-50 pr-2 pl-1.5 text-xs font-semibold text-green-700">
								<BadgeCheck aria-hidden="true" className="size-3.5" />
								Verified
							</span>
						) : (
							<span className="inline-flex h-[22px] items-center gap-1 rounded-md bg-amber-50 pr-2 pl-1.5 text-xs font-semibold text-amber-700">
								<CircleAlert aria-hidden="true" className="size-3.5" />
								Email not verified
							</span>
						)}
					</span>
					<span className="text-[13px] leading-[18px] font-semibold text-violet-700">View profile</span>
				</span>
				<ChevronRight aria-hidden="true" className="size-5 shrink-0 text-zinc-500" />
			</Link>

			{user.cta ? (
				<Link
					href={user.cta.href}
					onClick={onNavigate}
					className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-linear-to-r from-brand-from to-brand-to text-[15px] font-semibold text-white transition hover:opacity-90 active:opacity-80 motion-safe:active:scale-[.98] ${focusRing}`}
				>
					{user.cta.icon === "shield" ? (
						<ShieldCheck aria-hidden="true" className="size-5" />
					) : (
						<Plus aria-hidden="true" className="size-5" />
					)}
					{user.cta.label}
				</Link>
			) : null}
		</>
	);
}

function GuestIntro({ onNavigate }: { onNavigate: () => void }) {
	return (
		<>
			<div className="px-1 pt-2">
				<p className="text-xl leading-7 font-semibold tracking-tight">Hire talent or find work. Free.</p>
				<p className="mt-1 text-sm leading-5 text-zinc-600">
					Small businesses post projects. Freelancers and agencies apply or offer services.
				</p>
			</div>
			<div className="mt-4 flex flex-col gap-2">
				<Link
					href="/register"
					onClick={onNavigate}
					className={`flex h-12 items-center justify-center rounded-lg bg-linear-to-r from-brand-from to-brand-to text-[15px] font-semibold text-white transition hover:opacity-90 ${focusRing}`}
				>
					Sign up
				</Link>
				<Link
					href="/login"
					onClick={onNavigate}
					className={`flex h-12 items-center justify-center rounded-lg bg-white text-[15px] font-semibold text-[#111] ring-1 ring-black/[.16] ring-inset transition-colors hover:bg-zinc-50 ${focusRing}`}
				>
					Log in
				</Link>
			</div>
		</>
	);
}
