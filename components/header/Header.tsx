"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { headerTheme } from "@/theme/header-theme";

const CLOSE_ANIMATION_MS = 260;

export default function Header() {
	const [isOpen, setIsOpen] = useState(false);
	const [isMenuMounted, setIsMenuMounted] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	const openMenu = () => {
		setIsMenuMounted(true);
		requestAnimationFrame(() => {
			setIsOpen(true);
		});
	};

	const closeMenu = () => {
		setIsOpen(false);
	};

	const toggleMenu = () => {
		if (isOpen) {
			closeMenu();
			return;
		}

		openMenu();
	};

	useEffect(() => {
		if (isOpen) {
			setIsMenuMounted(true);
			return;
		}

		if (!isMenuMounted) {
			return;
		}

		const closeTimer = window.setTimeout(() => {
			setIsMenuMounted(false);
		}, CLOSE_ANIMATION_MS);

		return () => {
			window.clearTimeout(closeTimer);
		};
	}, [isMenuMounted, isOpen]);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(min-width: 1024px)");

		const handleChange = (event: MediaQueryListEvent) => {
			if (event.matches) {
				closeMenu();
			}
		};

		mediaQuery.addEventListener("change", handleChange);

		return () => {
			mediaQuery.removeEventListener("change", handleChange);
		};
	}, []);

	useEffect(() => {
		if (!isMenuMounted) {
			return;
		}

		const handlePointerDown = (event: MouseEvent | TouchEvent) => {
			const target = event.target as Node | null;

			if (!target) {
				return;
			}

			if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) {
				return;
			}

			closeMenu();
		};

		document.addEventListener("mousedown", handlePointerDown, true);
		document.addEventListener("touchstart", handlePointerDown, true);

		return () => {
			document.removeEventListener("mousedown", handlePointerDown, true);
			document.removeEventListener("touchstart", handlePointerDown, true);
		};
	}, [isMenuMounted]);

	return (
		<header
			className="sticky top-0 z-50 border-b bg-white lg:relative"
			style={{ borderColor: headerTheme.border }}
		>
			<div className="mx-auto flex max-w-300 items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
				<Link href="/" className="shrink-0" onClick={closeMenu}>
					<img
						src="/images/workbridge-logo.png"
						alt="WorkBridge"
						className="h-16 w-auto object-contain sm:h-16 lg:h-20"
					/>
				</Link>

				<nav className="hidden lg:block" aria-label="Desktop navigation">
					<ul className="flex items-center gap-6">
						<li>
							<Link
								href="/"
								className="text-[16px] font-semibold transition hover:opacity-70"
								style={{ color: headerTheme.muted }}
							>
								Find Talent
							</Link>
						</li>
						<li>
							<Link
								href="/"
								className="text-[16px] font-semibold transition hover:opacity-70"
								style={{ color: headerTheme.muted }}
							>
								Find Work
							</Link>
						</li>
						<li>
							<Link
								href="/"
								className="text-[16px] font-semibold transition hover:opacity-70"
								style={{ color: headerTheme.muted }}
							>
								How It Works
							</Link>
						</li>
						<li>
							<Link
								href="/"
								className="text-[16px] font-semibold transition hover:opacity-70"
								style={{ color: headerTheme.muted }}
							>
								Enterprise
							</Link>
						</li>
					</ul>
				</nav>

				<div className="hidden items-center gap-4 lg:flex">
					<Link
						href="/login"
						className="text-[16px] font-semibold transition hover:opacity-70"
						style={{ color: headerTheme.text }}
					>
						Log In
					</Link>
					<Link
						href="/register"
						className="rounded-full px-6 py-3 text-[16px] font-semibold text-white transition hover:opacity-90"
						style={{
							background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
						}}
					>
						Sign Up
					</Link>
				</div>

				<button
					ref={buttonRef}
					type="button"
					onClick={toggleMenu}
					className="relative flex h-10 w-10 items-center justify-center rounded-md lg:hidden"
					aria-expanded={isOpen}
					aria-label={isOpen ? "Close menu" : "Open menu"}
				>
					<img
						src="/icons/mobile-menu-icon.svg"
						alt=""
						aria-hidden="true"
						className={`absolute h-5 w-5 transition-all duration-300 ${
							isOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 scale-100 opacity-100"
						}`}
						style={{ pointerEvents: "none" }}
					/>
					<img
						src="/icons/close-icon.svg"
						alt=""
						aria-hidden="true"
						className={`absolute h-5 w-5 transition-all duration-300 ${
							isOpen ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-75 opacity-0"
						}`}
						style={{ pointerEvents: "none" }}
					/>
				</button>
			</div>

			{isMenuMounted ? (
				<div
					ref={menuRef}
					className={`absolute inset-x-0 top-full border-t bg-white transition-all duration-300 ease-in-out lg:hidden ${
						isOpen ? "translate-y-0 opacity-100" : "-translate-y-3 opacity-0"
					}`}
					style={{ borderColor: headerTheme.border }}
				>
					<nav className="mx-auto max-w-300 px-4 py-4 sm:px-6" aria-label="Mobile navigation">
						<ul className="space-y-1">
							<li>
								<Link
									href="/"
									onClick={closeMenu}
									className="block py-2 text-[16px] font-semibold"
									style={{ color: headerTheme.muted }}
								>
									Find Talent
								</Link>
							</li>
							<li>
								<Link
									href="/"
									onClick={closeMenu}
									className="block py-2 text-[16px] font-semibold"
									style={{ color: headerTheme.muted }}
								>
									Find Work
								</Link>
							</li>
							<li>
								<Link
									href="/"
									onClick={closeMenu}
									className="block py-2 text-[16px] font-semibold"
									style={{ color: headerTheme.muted }}
								>
									How It Works
								</Link>
							</li>
							<li>
								<Link
									href="/"
									onClick={closeMenu}
									className="block py-2 text-[16px] font-semibold"
									style={{ color: headerTheme.muted }}
								>
									Enterprise
								</Link>
							</li>
							<li className="pt-3">
								<Link
									href="/login"
									onClick={closeMenu}
									className="block py-2 text-[16px] font-semibold"
									style={{ color: headerTheme.text }}
								>
									Log In
								</Link>
							</li>
							<li>
								<Link
									href="/register"
									onClick={closeMenu}
									className="block rounded-full px-6 py-3 text-center text-[16px] font-semibold text-white"
									style={{
										background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
									}}
								>
									Sign Up
								</Link>
							</li>
						</ul>
					</nav>
				</div>
			) : null}
		</header>
	);
}
