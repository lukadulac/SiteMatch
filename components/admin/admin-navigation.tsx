"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard/admin", label: "Overview" },
  { href: "/dashboard/admin/users", label: "Users" },
  { href: "/dashboard/admin/services", label: "Service listings" },
  { href: "/dashboard/admin/projects", label: "Projects" },
  { href: "/dashboard/admin/audit", label: "Audit log" },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin navigation" className="lg:sticky lg:top-28 lg:self-start">
      <div className="overflow-x-auto border-b border-line pb-3 lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-5">
        <p className="hidden px-3 pb-3 text-xs font-semibold uppercase text-secondary lg:block">Administration</p>
        <ul className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center rounded-md px-3 py-2 text-sm font-medium transition lg:w-full ${
                    active ? "bg-violet-600 text-white" : "text-secondary hover:bg-zinc-100 hover:text-black"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
