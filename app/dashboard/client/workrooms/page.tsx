import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
	WorkroomCard,
	WorkroomNotice,
	WorkroomPagination,
	WorkroomStatusFilters,
} from "@/components/workrooms/workroom-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import {
	getClientWorkroomsPage,
} from "@/lib/service-workrooms/service";
import {
	parseWorkroomListQuery,
	type RawWorkroomListQuery,
} from "@/lib/service-workrooms/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ClientWorkroomsPageProps = {
	searchParams?: Promise<
		RawWorkroomListQuery & {
			workroomError?: string | string[];
			workroomStatus?: string | string[];
		}
	>;
};

function buildCanonicalListPath(status: string, page: number) {
	const params = new URLSearchParams();

	if (status !== "all") {
		params.set("status", status);
	}

	if (page > 1) {
		params.set("page", String(page));
	}

	const query = params.toString();

	return query
		? `/dashboard/client/workrooms?${query}`
		: "/dashboard/client/workrooms";
}

export default async function ClientWorkroomsPage({
	searchParams,
}: ClientWorkroomsPageProps) {
	const params = await searchParams;
	const workroomError =
		typeof params?.workroomError === "string" ? params.workroomError : null;
	const workroomStatus =
		typeof params?.workroomStatus === "string" ? params.workroomStatus : null;
	const listQuery = parseWorkroomListQuery(params);
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

	if (provisioned.role !== "client") {
		redirect(getDashboardPath(provisioned.role));
	}

	const [conversationsResult, workroomsResult] = await Promise.all([
		getUserConversations(supabase, user.id),
		getClientWorkroomsPage(supabase, user.id, listQuery),
	]);

	if (conversationsResult.error) {
		throw new Error(conversationsResult.error);
	}

	if (workroomsResult.error) {
		throw new Error(workroomsResult.error);
	}

	const pageData = workroomsResult.data;
	if (!pageData) {
		throw new Error("Workrooms could not be loaded.");
	}
	const canonicalPage =
		pageData.totalCount === 0
			? 1
			: Math.min(listQuery.page, pageData.totalPages);

	if (listQuery.wasNormalized || listQuery.page !== canonicalPage) {
		redirect(buildCanonicalListPath(listQuery.status, canonicalPage));
	}

	const unreadConversations =
		conversationsResult.data?.filter((conversation) => conversation.unread_count > 0) ??
		[];

	return (
		<DashboardShell
			title="Workrooms"
			subtitle="Follow accepted service work and keep the agreement summary in one place."
			actionHref="/find-talent"
			actionLabel="Find Talent"
			navItems={[
				{ href: "/dashboard/client", label: "Overview" },
				{ href: "/dashboard/client/projects", label: "Projects" },
				{ href: "/dashboard/client/service-requests", label: "Service Requests" },
				{
					href: "/dashboard/client/workrooms",
					label: "Workrooms",
					count: pageData.totalCount,
					active: true,
				},
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadConversations.length,
				},
				{ href: "/dashboard/client/profile", label: "Profile" },
			]}
		>
			<section className="space-y-5">
				<WorkroomNotice status={workroomStatus} error={workroomError} />
				<div className="flex flex-col gap-4 rounded-[1.75rem] border border-line bg-white/90 p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)] lg:flex-row lg:items-center lg:justify-between">
					<div>
						<h2 className="text-xl font-semibold text-black">
							Accepted services
						</h2>
						<p className="mt-1 text-sm text-secondary">
							{pageData.totalCount} workroom
							{pageData.totalCount === 1 ? "" : "s"} found
						</p>
					</div>
					<WorkroomStatusFilters
						basePath="/dashboard/client/workrooms"
						activeStatus={listQuery.status}
					/>
				</div>

				{pageData.workrooms.length > 0 ? (
					<div className="space-y-4">
						{pageData.workrooms.map((workroom) => (
							<WorkroomCard
								key={workroom.id}
								workroom={workroom}
								viewerRole="client"
								context="client-workrooms"
								status={listQuery.status}
								page={pageData.page}
							/>
						))}
					</div>
				) : (
					<div className="rounded-3xl border border-dashed border-line-strong bg-panel-soft p-8 text-center">
						<h2 className="text-2xl font-semibold text-black">
							No workrooms found
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
							{listQuery.status === "all"
								? "Accepted service requests will appear here."
								: "There are no workrooms in this status yet."}
						</p>
					</div>
				)}

				<WorkroomPagination
					basePath="/dashboard/client/workrooms"
					status={listQuery.status}
					page={pageData.page}
					totalPages={pageData.totalPages}
				/>
			</section>
		</DashboardShell>
	);
}
