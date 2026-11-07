import { clientBusinessTypeLabels } from "@/lib/auth/client-profile";
import {
	providerServiceCategoryLabels,
	providerTypeLabels,
} from "@/lib/auth/provider-profile";
import type {
	PublicClientProfile,
	PublicProfile,
	PublicProviderProfile,
} from "@/lib/profiles/public-profile";

const currency = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

export const availabilityMeta = {
	available: { label: "Available for work", tone: "emerald" },
	busy: { label: "Limited availability", tone: "amber" },
	unavailable: { label: "Not taking work", tone: "zinc" },
} as const;

/** The name shown in the hero: a provider's display name beats their legal name. */
export function getProfileDisplayName(profile: PublicProfile) {
	if (profile.role === "provider") {
		return profile.provider?.display_name?.trim() || profile.full_name;
	}

	return profile.full_name;
}

export function getProfileLocation(profile: PublicProfile) {
	return [profile.city, profile.country]
		.filter((value): value is string => Boolean(value?.trim()))
		.join(", ");
}

export function formatMemberSince(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		year: "numeric",
	}).format(new Date(value));
}

/** "$20 – $40", "From $20", "Up to $40", or null when neither end is set. */
export function formatMoneyRange(min: number | null, max: number | null) {
	if (min != null && max != null) {
		return min === max
			? currency.format(min)
			: `${currency.format(min)} – ${currency.format(max)}`;
	}

	if (min != null) {
		return `From ${currency.format(min)}`;
	}

	if (max != null) {
		return `Up to ${currency.format(max)}`;
	}

	return null;
}

export function formatProjectBudget(
	budgetType: string,
	budgetMin: number | null,
	budgetMax: number | null,
) {
	if (budgetType === "negotiable") {
		return "Negotiable";
	}

	const range = formatMoneyRange(budgetMin, budgetMax);

	if (budgetType === "fixed") {
		return range ? `Fixed: ${range}` : "Fixed budget";
	}

	return range ?? "Budget not set";
}

/** Free-text lists ("React, Next.js; Figma") as chips, without blanks or repeats. */
export function splitTextList(value: string | null) {
	const seen = new Set<string>();

	return (value ?? "")
		.split(/[,;\n]/)
		.map((item) => item.trim())
		.filter((item) => {
			const key = item.toLowerCase();

			if (!item || seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});
}

/** "Freelancer · Acme Studio" under a provider's name. */
export function getProviderRoleLine(profile: PublicProviderProfile) {
	const details = profile.provider;

	if (!details) {
		return "Provider";
	}

	return [providerTypeLabels[details.provider_type], details.company_name?.trim()]
		.filter(Boolean)
		.join(" · ");
}

export function getProviderDisciplines(profile: PublicProviderProfile) {
	const details = profile.provider;

	if (!details) {
		return [];
	}

	return details.service_categories.map((category) =>
		category === "other" && details.service_category_other_text?.trim()
			? details.service_category_other_text.trim()
			: providerServiceCategoryLabels[category],
	);
}

export function getProviderRates(profile: PublicProviderProfile) {
	const details = profile.provider;

	if (!details) {
		return [];
	}

	const hourly = formatMoneyRange(details.hourly_rate_min, details.hourly_rate_max);

	return [
		{
			label: "Hourly rate",
			value: hourly ? `${hourly}/hr` : null,
		},
		{
			label: "Fixed-price work",
			value: formatMoneyRange(details.fixed_price_min, details.fixed_price_max),
		},
		{
			label: "Typical project budget",
			value: formatMoneyRange(details.project_budget_min, details.project_budget_max),
		},
	].filter((rate): rate is { label: string; value: string } => rate.value !== null);
}

/** "SaaS / tech" or the client's own wording for "other". */
export function getClientBusinessType(profile: PublicClientProfile) {
	const details = profile.client;

	if (!details) {
		return null;
	}

	const ownWording = details.business_type_text?.trim() || null;

	if (details.business_type === "other" || !details.business_type) {
		return ownWording;
	}

	return (
		clientBusinessTypeLabels[
			details.business_type as keyof typeof clientBusinessTypeLabels
		] ?? ownWording
	);
}
