"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/**
 * closed  → not rendered
 * opening → rendered with data-state="closed" for one frame, so the slide-in transitions
 * open    → data-state="open"
 * closing → data-state="closed" until the close transition ends, then unmounted
 */
type MenuPhase = "closed" | "opening" | "open" | "closing";

const CLOSE_MS = 200;
const CLOSE_REDUCED_MS = 150;
const DESKTOP_QUERY = "(min-width: 1024px)";

function prefersReducedMotion() {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Makes everything outside the drawer inert and stops the page behind it scrolling. */
function isolate(drawer: HTMLElement) {
	const html = document.documentElement;
	const previous = { overflow: html.style.overflow, gutter: html.style.scrollbarGutter };
	const inerted = Array.from(document.body.children).filter(
		(element): element is HTMLElement =>
			element instanceof HTMLElement && !element.contains(drawer) && !element.inert,
	);

	inerted.forEach((element) => {
		element.inert = true;
	});
	html.style.scrollbarGutter = "stable";
	html.style.overflow = "hidden";

	return () => {
		inerted.forEach((element) => {
			element.inert = false;
		});
		html.style.overflow = previous.overflow;
		html.style.scrollbarGutter = previous.gutter;
	};
}

export function useMobileMenu(): {
	isMounted: boolean;
	isOpen: boolean;
	dataState: "open" | "closed";
	open: () => void;
	close: () => void;
	triggerRef: RefObject<HTMLButtonElement | null>;
	drawerRef: RefObject<HTMLDivElement | null>;
	closeButtonRef: RefObject<HTMLButtonElement | null>;
} {
	const [phase, setPhase] = useState<MenuPhase>("closed");
	const triggerRef = useRef<HTMLButtonElement>(null);
	const drawerRef = useRef<HTMLDivElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const isMounted = phase !== "closed";

	const open = useCallback(() => setPhase("opening"), []);
	const close = useCallback(() => {
		setPhase((current) => (current === "opening" || current === "open" ? "closing" : current));
	}, []);

	useEffect(() => {
		if (phase === "opening") {
			const frame = requestAnimationFrame(() => setPhase("open"));
			return () => cancelAnimationFrame(frame);
		}

		if (phase === "closing") {
			const timer = window.setTimeout(
				() => setPhase("closed"),
				prefersReducedMotion() ? CLOSE_REDUCED_MS : CLOSE_MS,
			);
			return () => window.clearTimeout(timer);
		}
	}, [phase]);

	// Isolate the page and move focus in as soon as the drawer exists, before it animates.
	// Release it the moment closing starts so focus can go back to the menu button.
	// Driven by phase transitions rather than effect cleanup, so Strict Mode's double
	// run cannot leave the page isolated or focus stranded on an unmounting button.
	const releaseRef = useRef<(() => void) | null>(null);
	useLayoutEffect(() => {
		if (phase === "opening") {
			const drawer = drawerRef.current;
			if (drawer && !releaseRef.current) {
				releaseRef.current = isolate(drawer);
			}
			closeButtonRef.current?.focus();
		} else if (phase === "closing" && releaseRef.current) {
			releaseRef.current();
			releaseRef.current = null;
			triggerRef.current?.focus();
		}
	}, [phase]);

	useEffect(
		() => () => {
			releaseRef.current?.();
			releaseRef.current = null;
		},
		[],
	);

	const isActive = phase === "opening" || phase === "open";

	useEffect(() => {
		if (!isMounted) {
			return;
		}

		const desktop = window.matchMedia(DESKTOP_QUERY);
		const handleChange = (event: MediaQueryListEvent) => {
			if (event.matches) {
				close();
			}
		};

		desktop.addEventListener("change", handleChange);
		return () => desktop.removeEventListener("change", handleChange);
	}, [close, isMounted]);

	return {
		isMounted,
		isOpen: isActive,
		dataState: phase === "open" ? "open" : "closed",
		open,
		close,
		triggerRef,
		drawerRef,
		closeButtonRef,
	};
}
