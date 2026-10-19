import Link from "next/link";

export const DASHBOARD_LIST_PAGE_SIZE = 10;

export function parseDashboardPage(value: string | string[] | undefined) {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function parseDashboardStatus<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? value as T
    : allowed[0];
}

export function dashboardListHref(basePath: string, status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

export function DashboardStatusFilters<T extends string>({
  basePath,
  status,
  options,
}: {
  basePath: string;
  status: T;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <nav aria-label="Status filters" className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          key={option.value}
          href={dashboardListHref(basePath, option.value, 1)}
          aria-current={status === option.value ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-lg border px-3 text-sm font-semibold ${
            status === option.value
              ? "border-black bg-black text-white"
              : "border-line bg-white text-secondary hover:text-black"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

export function DashboardListPagination({
  basePath,
  status,
  page,
  totalPages,
}: {
  basePath: string;
  status: string;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Results pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <p className="text-sm text-secondary">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={dashboardListHref(basePath, status, page - 1)} aria-label="Go to previous page" className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-black">Previous</Link>
        ) : <span aria-disabled="true" className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm text-secondary/60">Previous</span>}
        {page < totalPages ? (
          <Link href={dashboardListHref(basePath, status, page + 1)} aria-label="Go to next page" className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-black">Next</Link>
        ) : <span aria-disabled="true" className="inline-flex min-h-10 items-center rounded-lg border border-line px-4 text-sm text-secondary/60">Next</span>}
      </div>
    </nav>
  );
}
