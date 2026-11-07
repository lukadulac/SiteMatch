import type { PublicProviderServiceListing } from "@/lib/provider-services/service";

export function getServiceTypeLabel(service: PublicProviderServiceListing) {
	return service.service_type_text || service.service_type?.name || "Service";
}

export function getCategoryLabel(service: PublicProviderServiceListing) {
	return service.category_text || service.category?.name || "General";
}

export function priceTypeLabel(value: string) {
	switch (value) {
		case "fixed":
			return "Fixed";
		case "hourly":
			return "Hourly";
		case "starting_at":
			return "Starting at";
		case "negotiable":
			return "Negotiable";
		default:
			return "Price";
	}
}

export function formatProviderServicePrice(
	service: PublicProviderServiceListing,
) {
	if (service.price_type === "negotiable") {
		return "Negotiable";
	}

	if (service.starting_price == null) {
		return "Price not set";
	}

	const formattedPrice = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(service.starting_price);

	if (service.price_type === "hourly") {
		return `${formattedPrice}/hr`;
	}

	if (service.price_type === "starting_at") {
		return `Starting at ${formattedPrice}`;
	}

	return formattedPrice;
}

export function providerLocation(service: PublicProviderServiceListing) {
	return [service.provider?.city, service.provider?.country]
		.filter((value): value is string => Boolean(value))
		.join(", ");
}
