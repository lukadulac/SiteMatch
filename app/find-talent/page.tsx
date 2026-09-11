import Link from "next/link";
import {
	getDefaultFindTalentQuery,
	parseFindTalentQuery,
	type RawFindTalentQuery,
} from "@/lib/provider-services/find-talent-query";
import {
	formatProviderServicePrice,
	getCategoryLabel,
	getServiceTypeLabel,
	priceTypeLabel,
	providerLocation,
} from "@/lib/provider-services/formatters";
import { getPublicPublishedProviderServices } from "@/lib/provider-services/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headerTheme } from "@/theme/header-theme";

type FindTalentPageProps = {
	searchParams: Promise<RawFindTalentQuery>;
};

function getServiceExcerpt(description: string) {
	const trimmedDescription = description.trim().replace(/\s+/g, " ");

	if (trimmedDescription.length <= 150) {
		return trimmedDescription;
	}

	return `${trimmedDescription.slice(0, 150).trimEnd()}...`;
}

export default async function FindTalentPage({
	searchParams,
}: FindTalentPageProps) {
	const supabase = await createSupabaseServerClient();
	const query = await searchParams;
	const parsedQuery = parseFindTalentQuery(query);
	const filters = parsedQuery.data ?? getDefaultFindTalentQuery();
	const filterError = parsedQuery.error
		? "Some filters were invalid and were ignored."
		: null;
	const q = filters.q ?? "";
	const price = filters.priceType ?? "";
	const sort = filters.sort;

	const servicesResult = await getPublicPublishedProviderServices(
		supabase,
		filters,
	);

	if (servicesResult.error) {
		throw new Error(servicesResult.error);
	}

	const services = servicesResult.data?.services ?? [];
	const preservedFilterInputs = [
		["category", filters.categorySlug],
		["serviceType", filters.serviceTypeSlug],
		["minPrice", filters.minPrice],
		["maxPrice", filters.maxPrice],
		["delivery", filters.deliveryBucket],
		["pageSize", filters.pageSize],
	].filter((input): input is [string, string | number] => {
		const value = input[1];

		return value !== undefined && value !== "";
	});
	const activeFilters = [
		q ? `Search: ${q}` : null,
		price ? priceTypeLabel(price) : null,
	].filter((filter): filter is string => Boolean(filter));

	return (
		<section className="space-y-7 py-4 sm:py-8">
			<div className="space-y-6">
				{filterError ? (
					<div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
						{filterError}
					</div>
				) : null}

				<div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
							WorkBridge talent
						</p>
						<h1 className="mt-3 text-3xl font-semibold text-black sm:text-4xl">
							Find services from freelance providers
						</h1>
						<p className="mt-3 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
							Browse published service offers from providers. Service request
							and messaging actions will be added after the marketplace listing
							flow is stable.
						</p>
					</div>
				</div>

				<form
					action="/find-talent"
					className="rounded-[1.75rem] border border-line bg-white/90 p-4 shadow-[0_16px_45px_rgba(17,17,17,0.05)]"
				>
					<div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_170px_auto]">
						<label className="sr-only" htmlFor="talent-search">
							Search services
						</label>
						{preservedFilterInputs.map(([name, value]) => (
							<input
								key={name}
								type="hidden"
								name={name}
								value={String(value)}
							/>
						))}
						<input
							id="talent-search"
							name="q"
							type="search"
							defaultValue={q}
							placeholder="Search services, skills, categories, or outcomes..."
							className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm text-black outline-none transition placeholder:text-secondary/70 focus:border-black"
						/>

						<label className="sr-only" htmlFor="price-filter">
							Price type
						</label>
						<select
							id="price-filter"
							name="priceType"
							defaultValue={price}
							className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold text-black outline-none transition focus:border-black"
						>
							<option value="">Any price</option>
							<option value="starting_at">Starting at</option>
							<option value="fixed">Fixed</option>
							<option value="hourly">Hourly</option>
							<option value="negotiable">Negotiable</option>
						</select>

						<label className="sr-only" htmlFor="sort-filter">
							Sort
						</label>
						<select
							id="sort-filter"
							name="sort"
							defaultValue={sort}
							className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold text-black outline-none transition focus:border-black"
						>
							<option value="newest">Newest</option>
							<option value="oldest">Oldest</option>
							<option value="price_desc">Price high</option>
							<option value="price_asc">Price low</option>
						</select>

						<button
							type="submit"
							className="min-h-11 rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
							style={{
								background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
							}}
						>
							Filter
						</button>
					</div>

					{activeFilters.length > 0 ? (
						<div className="mt-4 flex flex-wrap items-center gap-2">
							<span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
								Active
							</span>
							{activeFilters.map((filter) => (
								<span
									key={filter}
									className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
								>
									{filter}
								</span>
							))}
							<Link
								href="/find-talent"
								className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-black transition hover:bg-black/3"
							>
								Clear all
							</Link>
						</div>
					) : null}
				</form>
			</div>

			<div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h2 className="text-xl font-semibold text-black">
						Published Services
					</h2>
					<p className="mt-1 text-sm text-secondary">
						{services.length} result{services.length === 1 ? "" : "s"} available
					</p>
				</div>
				<p className="text-sm font-semibold text-secondary">
					Sorted by{" "}
					<span className="text-black">
						{sort === "oldest"
							? "oldest"
							: sort === "price_desc"
								? "highest price"
								: sort === "price_asc"
									? "lowest price"
									: "newest"}
					</span>
				</p>
			</div>

			<div className="grid min-w-0 gap-5 lg:grid-cols-2">
				{services.length > 0 ? (
					services.map((service) => {
						const location = providerLocation(service);

						return (
							<article
								key={service.id}
								className="flex min-w-0 flex-col rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-6"
							>
								<div className="flex min-w-0 flex-wrap items-center gap-2">
									<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
										Available
									</span>
									<span className="min-w-0 wrap-break-word text-xs font-medium text-secondary">
										{getServiceTypeLabel(service)} · {getCategoryLabel(service)}
									</span>
								</div>

								<h3 className="mt-4 line-clamp-2 wrap-break-word text-xl font-semibold leading-7 text-black">
									{service.title}
								</h3>

								<p className="mt-5 line-clamp-3 break-all text-lg leading-7 text-black sm:wrap-break-word sm:text-xl sm:leading-8">
									{getServiceExcerpt(service.description)}
								</p>

								<div className="mt-6 grid gap-3 text-sm text-secondary sm:grid-cols-2">
									<p>
										<span className="font-semibold text-black">Provider:</span>{" "}
										{service.provider?.full_name ?? "Provider"}
									</p>
									<p>
										<span className="font-semibold text-black">Price:</span>{" "}
										{formatProviderServicePrice(service)}
									</p>
									<p>
										<span className="font-semibold text-black">Delivery:</span>{" "}
										{service.delivery_estimate ?? "Flexible"}
									</p>
									<p>
										<span className="font-semibold text-black">Location:</span>{" "}
										{location || "Remote"}
									</p>
								</div>

								<div className="mt-5 flex min-w-0 flex-wrap gap-2">
									<span className="max-w-full truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
										{priceTypeLabel(service.price_type)}
									</span>
									<span className="max-w-full truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
										{getServiceTypeLabel(service)}
									</span>
									<span className="max-w-full truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
										{getCategoryLabel(service)}
									</span>
								</div>

								<div className="mt-auto pt-6">
									<Link
										href={`/find-talent/${service.id}`}
										className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
										style={{
											background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
										}}
									>
										View more
									</Link>
								</div>
							</article>
						);
					})
				) : (
					<div className="rounded-4xl border border-dashed border-line-strong bg-white/80 p-10 text-center shadow-[0_16px_40px_rgba(17,17,17,0.03)] lg:col-span-2">
						<h2 className="text-2xl font-semibold text-black">
							No matching services
						</h2>
						<p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
							Try clearing filters or checking back when more providers publish
							service offers.
						</p>
						<Link
							href="/find-talent"
							className="mt-6 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
							style={{
								background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
							}}
						>
							Clear filters
						</Link>
					</div>
				)}
			</div>
		</section>
	);
}
