import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateProviderServiceListingAction } from "@/app/dashboard/provider/services/actions";
import { ProviderServiceForm } from "@/components/provider-services/provider-service-form";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getProviderServiceListingForProvider } from "@/lib/provider-services/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EditProviderServicePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const provisioned = await ensureUserProfile(supabase, user);

	if (!provisioned.role) {
		await supabase.auth.signOut();
		redirect("/login");
	}

	if (provisioned.role !== "provider") {
		redirect(getDashboardPath(provisioned.role));
	}

	const [serviceTypesResult, categoriesResult, listingResult] =
		await Promise.all([
			supabase
				.from("service_types")
				.select("*")
				.eq("is_active", true)
				.order("sort_order", { ascending: true })
				.order("name", { ascending: true }),
			supabase.from("project_categories").select("*").order("name"),
			getProviderServiceListingForProvider(supabase, user.id, id),
		]);

	if (serviceTypesResult.error) {
		throw new Error(serviceTypesResult.error.message);
	}

	if (categoriesResult.error) {
		throw new Error(categoriesResult.error.message);
	}

	if (listingResult.error) {
		notFound();
	}

	const listing = listingResult.data;

	if (!listing) {
		notFound();
	}

	return (
		<section className="space-y-6 py-4 sm:py-8">
			<div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
				<div className="min-w-0">
					<div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-secondary">
						<Link
							href="/dashboard/provider"
							className="font-semibold text-black transition hover:opacity-70"
						>
							Dashboard
						</Link>
						<span>/</span>
						<Link
							href="/dashboard/provider/services"
							className="font-semibold text-black transition hover:opacity-70"
						>
							Services
						</Link>
						<span>/</span>
						<span>Edit Service</span>
					</div>
					<h1 className="wrap-break-word text-3xl font-semibold text-black sm:text-4xl">
						Edit Service
					</h1>
					<p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
						Update the offer clients will see when this service is published.
					</p>
				</div>
				<div className="flex flex-col-reverse gap-3 sm:flex-row">
					<Link
						href="/dashboard/provider/services"
						className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-line-strong bg-white px-5 text-sm font-semibold text-black transition hover:bg-black/3 sm:w-auto"
					>
						Back to Services
					</Link>
				</div>
			</div>

			<ProviderServiceForm
				action={updateProviderServiceListingAction.bind(null, listing.id)}
				serviceTypes={serviceTypesResult.data ?? []}
				categories={categoriesResult.data ?? []}
				cancelHref="/dashboard/provider/services"
				submitMode="edit"
				listingStatus={listing.status}
				initialState={{
					formError: undefined,
					formSuccess: undefined,
					fieldErrors: {},
					fields: {
						title: listing.title,
						description: listing.description,
						service_type_id: listing.service_type_id ?? "",
						service_type_text: listing.service_type_text ?? "",
						category_id: listing.category_id ?? "",
						category_text: listing.category_text ?? "",
						price_type: listing.price_type,
						starting_price:
							listing.starting_price === null
								? ""
								: String(listing.starting_price),
						delivery_estimate: listing.delivery_estimate ?? "",
					},
				}}
			/>
		</section>
	);
}
