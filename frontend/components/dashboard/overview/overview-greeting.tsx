"use client";

import { useSyncExternalStore } from "react";

function subscribe() {
	return () => {};
}

function greetingForNow() {
	const hour = new Date().getHours();

	if (hour < 12) return "Good morning";
	if (hour < 18) return "Good afternoon";
	return "Good evening";
}

function todayLabel() {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
	}).format(new Date());
}

/**
 * The time of day and date come from the visitor's clock, not the server's,
 * so the server renders a neutral "Welcome back" and the browser fills in the rest.
 */
export function OverviewGreeting({ firstName }: { firstName: string }) {
	const greeting = useSyncExternalStore(subscribe, greetingForNow, () => "Welcome back");
	const today = useSyncExternalStore(subscribe, todayLabel, () => null);

	return (
		<div className="min-w-0">
			<h1 className="text-[1.375rem] leading-tight font-bold tracking-[-0.015em] wrap-break-word sm:text-3xl sm:tracking-[-0.02em]">
				{greeting}, {firstName}
			</h1>
			<p className="mt-0.5 min-h-5 text-[0.8125rem] text-secondary sm:mt-1 sm:min-h-6 sm:text-[0.9375rem]">
				{today}
			</p>
		</div>
	);
}
