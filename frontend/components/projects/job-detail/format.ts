import type { ApplicationStatus } from "@/lib/projects/application-status";

const currency = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

const longDate = new Intl.DateTimeFormat("en-US", {
	year: "numeric",
	month: "short",
	day: "numeric",
});

export function formatDate(value: string | null) {
	return value ? longDate.format(new Date(value)) : null;
}

export function formatMoney(value: number) {
	return currency.format(value);
}

export function formatBudget(
	budgetType: string,
	budgetMin: number | null,
	budgetMax: number | null,
) {
	if (budgetType === "negotiable") {
		return "Negotiable";
	}

	if (budgetType === "fixed") {
		const amount = budgetMin ?? budgetMax;
		return amount != null ? `Fixed: ${formatMoney(amount)}` : "Fixed budget";
	}

	if (budgetMin != null && budgetMax != null) {
		return `${formatMoney(budgetMin)} – ${formatMoney(budgetMax)}`;
	}

	if (budgetMin != null) {
		return `From ${formatMoney(budgetMin)}`;
	}

	if (budgetMax != null) {
		return `Up to ${formatMoney(budgetMax)}`;
	}

	return "Not specified";
}

export function formatDeadline(deadlineType: string, deadlineDate: string | null) {
	return deadlineType === "asap" ? "ASAP" : formatDate(deadlineDate);
}

const providerTypeLabels: Record<string, string> = {
	freelancer: "Freelancer",
	agency: "Agency",
	studio: "Studio",
	any: "Any",
};

const scopeLabels: Record<string, string> = {
	small: "Small",
	medium: "Medium",
	large: "Large",
};

const readinessLabels: Record<string, string> = {
	idea_only: "Idea only",
	need_guidance: "Needs guidance",
	content_ready: "Content ready",
	design_ready: "Design ready",
	spec_ready: "Spec ready",
};

export function providerTypeLabel(value: string | null) {
	return providerTypeLabels[value ?? "any"] ?? "Any";
}

export function scopeLabel(value: string | null) {
	return value ? (scopeLabels[value] ?? null) : null;
}

export function readinessLabel(value: string | null) {
	return value ? (readinessLabels[value] ?? null) : null;
}

/** "https://www.kineta-clinic.rs/about" → "kineta-clinic.rs"; null for anything unparseable. */
export function websiteHost(url: string) {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return null;
	}
}

/**
 * The shared status meta is written for the client ("Reviewed by you"); this page
 * is read by the provider who sent the proposal.
 */
export const providerStatusCopy: Record<ApplicationStatus, string> = {
	pending: "Sent. The client hasn't opened it yet.",
	viewed: "The client has opened your proposal.",
	shortlisted: "You're on the client's shortlist for this brief.",
	accepted: "The client accepted your proposal. Agree on next steps in messages.",
	rejected: "The client chose another proposal for this brief.",
	withdrawn: "You withdrew this proposal. The client can no longer see it.",
};

export const applicationStatusClasses: Record<ApplicationStatus, string> = {
	pending: "bg-zinc-100 text-zinc-700",
	viewed: "bg-blue-50 text-blue-800",
	shortlisted: "bg-violet-50 text-violet-800",
	accepted: "bg-emerald-50 text-emerald-800",
	rejected: "bg-red-50 text-red-800",
	withdrawn: "border border-line-strong bg-white text-secondary",
};
