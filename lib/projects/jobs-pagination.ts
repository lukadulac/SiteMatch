export const JOBS_PAGE_SIZE = 20;

export function parseJobsPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function getJobsPageHref(
  filters: { q: string; budget: string; scope: string; sort: string },
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.budget) params.set("budget", filters.budget);
  if (filters.scope) params.set("scope", filters.scope);
  if (filters.sort !== "newest") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/jobs?${search}` : "/jobs";
}
