import z from "zod";

export const WORKROOM_PAGE_SIZE = 10;
export const WORKROOM_PREVIEW_LIMIT = 3;

export const workroomStatusFilterSchema = z.enum([
	"all",
	"active",
	"completed",
]);

type RawWorkroomListQueryValue = string | string[] | undefined;

export type RawWorkroomListQuery = {
	status?: RawWorkroomListQueryValue;
	page?: RawWorkroomListQueryValue;
};

export type WorkroomStatusFilter = z.infer<typeof workroomStatusFilterSchema>;

export type WorkroomListQuery = {
	status: WorkroomStatusFilter;
	page: number;
	pageSize: typeof WORKROOM_PAGE_SIZE;
	offset: number;
	wasNormalized: boolean;
};

function firstQueryValue(value: RawWorkroomListQueryValue) {
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}

	return value ?? "";
}

function parsePositiveInteger(value: RawWorkroomListQueryValue) {
	const trimmed = firstQueryValue(value).trim();

	if (!trimmed) {
		return { page: 1, wasNormalized: false };
	}

	const parsed = Number(trimmed);

	return Number.isInteger(parsed) && parsed > 0
		? { page: parsed, wasNormalized: false }
		: { page: 1, wasNormalized: true };
}

function parseStatusFilter(value: RawWorkroomListQueryValue) {
	const rawStatus = firstQueryValue(value).trim();
	const parsed = workroomStatusFilterSchema.safeParse(rawStatus || "all");

	if (!parsed.success) {
		return { status: "all" as const, wasNormalized: true };
	}

	return {
		status: parsed.data,
		wasNormalized: rawStatus === "all",
	};
}

export function parseWorkroomListQuery(
	query: RawWorkroomListQuery = {},
): WorkroomListQuery {
	const pageResult = parsePositiveInteger(query.page);
	const statusResult = parseStatusFilter(query.status);

	return {
		status: statusResult.status,
		page: pageResult.page,
		pageSize: WORKROOM_PAGE_SIZE,
		offset: (pageResult.page - 1) * WORKROOM_PAGE_SIZE,
		wasNormalized: pageResult.wasNormalized || statusResult.wasNormalized,
	};
}
