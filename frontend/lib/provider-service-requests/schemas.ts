import z from "zod";

export const SERVICE_REQUEST_PAGE_SIZE = 10;
export const SERVICE_REQUEST_PREVIEW_LIMIT = 3;

export const createServiceRequestSchema = z.object({
	message: z
		.string()
		.trim()
		.min(10, "Message must be at least 10 characters long.")
		.max(2000, "Message must be 2000 characters or fewer."),
});

export type CreateServiceRequestInput = z.infer<
	typeof createServiceRequestSchema
>;

export type CreateServiceRequestFormFields = {
	message: string;
};

const serviceRequestStatusFilterSchema = z.enum([
	"all",
	"pending",
	"accepted",
	"rejected",
	"cancelled",
]);

type RawServiceRequestListQueryValue = string | string[] | undefined;

export type RawServiceRequestListQuery = {
	status?: RawServiceRequestListQueryValue;
	page?: RawServiceRequestListQueryValue;
};

export type ServiceRequestStatusFilter = z.infer<
	typeof serviceRequestStatusFilterSchema
>;

export type ServiceRequestListQuery = {
	status: ServiceRequestStatusFilter;
	page: number;
	pageSize: typeof SERVICE_REQUEST_PAGE_SIZE;
	offset: number;
	wasNormalized: boolean;
};

function firstQueryValue(value: RawServiceRequestListQueryValue) {
	if (Array.isArray(value)) {
		return value[0] ?? "";
	}

	return value ?? "";
}

function parsePositiveInteger(value: RawServiceRequestListQueryValue) {
	const trimmed = firstQueryValue(value).trim();

	if (!trimmed) {
		return { page: 1, wasNormalized: false };
	}

	const parsed = Number(trimmed);

	return Number.isInteger(parsed) && parsed > 0
		? { page: parsed, wasNormalized: false }
		: { page: 1, wasNormalized: true };
}

function parseStatusFilter(value: RawServiceRequestListQueryValue) {
	const rawStatus = firstQueryValue(value).trim();
	const parsed = serviceRequestStatusFilterSchema.safeParse(
		rawStatus || "all",
	);

	if (!parsed.success) {
		return { status: "all" as const, wasNormalized: true };
	}

	return {
		status: parsed.data,
		wasNormalized: rawStatus === "all",
	};
}

export function parseServiceRequestListQuery(
	query: RawServiceRequestListQuery = {},
): ServiceRequestListQuery {
	const pageResult = parsePositiveInteger(query.page);
	const statusResult = parseStatusFilter(query.status);

	return {
		status: statusResult.status,
		page: pageResult.page,
		pageSize: SERVICE_REQUEST_PAGE_SIZE,
		offset: (pageResult.page - 1) * SERVICE_REQUEST_PAGE_SIZE,
		wasNormalized: pageResult.wasNormalized || statusResult.wasNormalized,
	};
}
