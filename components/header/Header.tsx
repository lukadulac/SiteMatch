"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { createPortal } from "react-dom";

import type { HeaderUser } from "@/lib/navigation/header-state";
import { getBrowseItems } from "@/lib/navigation/menu-items";
import { DesktopActions } from "./desktop-actions";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";
import { useMobileMenu } from "./use-mobile-menu";

type HeaderProps = {
	user: HeaderUser | null;
};

export default function Header({ user }: HeaderProps) {
	const pathname = usePathname();
	const { isMounted, isOpen, dataState, open, close, triggerRef, drawerRef, closeButtonRef } =
		useMobileMenu();
	const browseItems = getBrowseItems(pathname);
	const hasActivity = Boolean(
		user && user.counts.unreadMessages + user.counts.pendingServiceRequests > 0,
	);

	return (
		<header className="sticky top-0 z-50 border-b border-black/8 bg-white pt-[env(safe-area-inset-top)] lg:relative">
			<div className="mx-auto flex h-14 max-w-300 items-center gap-8 pr-1.5 pl-4 sm:h-16 sm:px-6 lg:px-8">
				<Logo />

				<nav aria-label="Main" className="hidden self-stretch lg:flex">
					<ul className="flex gap-2">
						{browseItems.map((item) => (
							<li key={item.href} className="flex">
								<Link
									href={item.href}
									aria-current={item.active ? "page" : undefined}
									className={`relative flex items-center px-3 text-[15px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-inset ${
										item.active ? "font-semibold text-[#111]" : "font-medium text-zinc-600 hover:text-[#111]"
									}`}
								>
									{item.label}
									{item.active ? (
										<span
											aria-hidden="true"
											className="absolute right-3 -bottom-px left-3 h-0.5 rounded-full bg-violet-600"
										/>
									) : null}
								</Link>
							</li>
						))}
					</ul>
				</nav>

				<DesktopActions user={user} />

				<button
					ref={triggerRef}
					type="button"
					onClick={open}
					aria-expanded={isOpen}
					aria-controls="mobile-menu"
					aria-label={hasActivity ? "Open menu, new activity" : "Open menu"}
					className="relative ml-auto grid size-11 place-items-center rounded-lg text-[#111] transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 lg:hidden"
				>
					<Menu
						aria-hidden="true"
						className={`size-6 transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none ${
							isOpen ? "rotate-90 opacity-0 motion-reduce:rotate-0" : ""
						}`}
					/>
					{hasActivity && !isOpen ? (
						<span
							aria-hidden="true"
							className="absolute top-[9px] right-2 size-2 rounded-full bg-violet-600 ring-2 ring-white"
						/>
					) : null}
				</button>
			</div>

			{isMounted
				? createPortal(
						<MobileMenu
							user={user}
							pathname={pathname}
							dataState={dataState}
							onClose={close}
							drawerRef={drawerRef}
							closeButtonRef={closeButtonRef}
						/>,
						document.body,
					)
				: null}
		</header>
	);
}
