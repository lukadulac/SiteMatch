import Link from "next/link";
import type { ReactNode } from "react";
import { WorkspaceRow } from "@/components/header/nav-row";
import {
  completeDashboardNavigation,
  type DashboardNavItem,
} from "@/lib/navigation/menu-items";

export { completeDashboardNavigation, type DashboardNavItem };

type DashboardShellProps = {
  /** Leave out when the page renders its own heading, as the workroom detail does. */
  title?: string;
  subtitle?: string;
  actionHref?: string;
  actionLabel?: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  actionHref,
  actionLabel,
  navItems,
  children,
}: DashboardShellProps) {
  const navigation = completeDashboardNavigation(navItems);

  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0 max-w-full lg:sticky lg:top-28 lg:self-start">
        <DashboardSidebar label="Your workspace" items={navigation} />
      </aside>

      <div className="min-w-0 max-w-full space-y-6 overflow-hidden">
        {title ? (
          <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold text-black sm:text-3xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
                  {subtitle}
                </p>
              ) : null}
            </div>
            {actionHref && actionLabel ? (
              <Link
                href={actionHref}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg bg-black px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto"
              >
                {actionLabel}
              </Link>
            ) : null}
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );
}

type StatCardProps = {
  value: string;
  label: string;
  detail: string;
};

export function DashboardStatCard({ value, label, detail }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-white p-5">
      <p className="break-words text-2xl font-semibold text-black sm:text-3xl">
        {value}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-black">{label}</p>
      <p className="mt-1 break-words text-sm text-secondary">{detail}</p>
    </div>
  );
}

type DashboardPanelProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DashboardPanel({
  title,
  action,
  children,
}: DashboardPanelProps) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-white/90 p-5 sm:p-6">
      <div className="mb-6 flex min-w-0 items-center justify-between gap-4">
        <h2 className="min-w-0 break-words text-lg font-semibold text-black">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

type DashboardSidebarProps = {
  label: string;
  items: DashboardNavItem[];
};

/**
 * Workspace links in the drawer's row style: a scrolling strip below `lg`, a labelled
 * column beside the page from `lg` up.
 */
export function DashboardSidebar({ label, items }: DashboardSidebarProps) {
  return (
    <nav aria-label={label} className="max-w-full overflow-hidden rounded-lg border border-line bg-white p-1">
      <p className="hidden px-4 pt-3 pb-1 text-xs leading-4 font-semibold tracking-[0.06em] text-zinc-600 uppercase lg:block">
        {label}
      </p>
      {/* The padding keeps focus rings inside the scrolling strip. */}
      <ul className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain p-1 lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {items.map((item) => (
          <li key={item.href} className="shrink-0 lg:shrink">
            <WorkspaceRow {...item} dense />
          </li>
        ))}
      </ul>
    </nav>
  );
}
