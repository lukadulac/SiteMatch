"use client";

import { createContext, useContext, useState, type KeyboardEvent, type ReactNode } from "react";

/** Which side of the marketplace the landing page is talking to. */
export type Audience = "hiring" | "freelancer";

const audiences: Audience[] = ["hiring", "freelancer"];

type AudienceContextValue = {
	audience: Audience;
	setAudience: (audience: Audience) => void;
};

const AudienceContext = createContext<AudienceContextValue | null>(null);

function useAudience() {
	const value = useContext(AudienceContext);

	if (!value) {
		throw new Error("useAudience must be used inside <AudienceProvider>.");
	}

	return value;
}

/** The hero switch and the How it works tabs share this state, so both always match. */
export function AudienceProvider({ children }: { children: ReactNode }) {
	const [audience, setAudience] = useState<Audience>("hiring");

	return (
		<AudienceContext.Provider value={{ audience, setAudience }}>{children}</AudienceContext.Provider>
	);
}

/**
 * Renders both audiences' content and hides the other one, so the copy for both sides
 * is in the server HTML and the switch never waits on a round trip.
 */
export function ForAudience({
	audience,
	className,
	children,
}: {
	audience: Audience;
	className?: string;
	children: ReactNode;
}) {
	const { audience: current } = useAudience();

	return (
		<div hidden={audience !== current} className={className}>
			{children}
		</div>
	);
}

const segmentClass =
	"inline-flex rounded-xl bg-stone-200 p-1 max-md:grid max-md:grid-cols-2";

function segmentButtonClass(selected: boolean) {
	return `min-h-11 rounded-[9px] px-4 text-[15px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 max-md:px-1.5 ${
		selected ? "bg-white text-[#111] shadow-sm" : "text-zinc-600 hover:text-[#111]"
	}`;
}

const switchLabels: Record<Audience, string> = {
	hiring: "I'm hiring",
	freelancer: "I'm a freelancer",
};

/** The hero's two doors: a pair of toggle buttons, one pressed at a time. */
export function AudienceSwitch() {
	const { audience, setAudience } = useAudience();

	return (
		<div role="group" aria-label="Show WorkBridge for" className={segmentClass}>
			{audiences.map((option) => (
				<button
					key={option}
					type="button"
					aria-pressed={audience === option}
					onClick={() => setAudience(option)}
					className={segmentButtonClass(audience === option)}
				>
					{switchLabels[option]}
				</button>
			))}
		</div>
	);
}

const tabLabels: Record<Audience, string> = {
	hiring: "For clients",
	freelancer: "For freelancers",
};

/** How it works tabs: arrow keys move between them, as the ARIA tabs pattern expects. */
export function AudienceTabs({ panelId }: { panelId: string }) {
	const { audience, setAudience } = useAudience();

	function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
			return;
		}

		event.preventDefault();
		const next = audience === "hiring" ? "freelancer" : "hiring";
		setAudience(next);
		document.getElementById(`${panelId}-tab-${next}`)?.focus();
	}

	return (
		<div role="tablist" aria-label="How it works for" className={`${segmentClass} mb-6 md:mb-9`}>
			{audiences.map((option) => (
				<button
					key={option}
					id={`${panelId}-tab-${option}`}
					type="button"
					role="tab"
					aria-selected={audience === option}
					aria-controls={panelId}
					tabIndex={audience === option ? 0 : -1}
					onClick={() => setAudience(option)}
					onKeyDown={handleKeyDown}
					className={segmentButtonClass(audience === option)}
				>
					{tabLabels[option]}
				</button>
			))}
		</div>
	);
}

/** The tab panel, labelled by whichever tab is selected. */
export function AudienceTabPanel({ id, children }: { id: string; children: ReactNode }) {
	const { audience } = useAudience();

	return (
		<div id={id} role="tabpanel" aria-labelledby={`${id}-tab-${audience}`}>
			{children}
		</div>
	);
}
