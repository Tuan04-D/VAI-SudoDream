"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { IconChevronDown, IconLogout, IconUserCircle } from "@tabler/icons-react";
import clsx from "clsx";
import { motion } from "motion/react";
import {
  OFFICIAL_NAV_ITEMS,
  OFFICIAL_PRELOGIN_NAV_ITEMS,
  OFFICIAL_SECTION_IDS,
  RESIDENT_GUEST_NAV_ITEMS,
  RESIDENT_NAV_ITEMS,
} from "@/lib/nav";
import { useActiveSection } from "@/lib/useActiveSection";
import { useRole } from "@/lib/RoleProvider";
import NavIcon from "./NavIcon";

function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex shrink-0 items-center gap-2.5" aria-label="Trạm Bản - Trang chủ">
      <svg viewBox="0 0 72 44" className="h-8 w-13 text-primary" fill="currentColor" aria-hidden>
        <path opacity=".96" d="M0 41 17 16l8 10L37 6l18 23 6-8 11 20Z" />
        <path d="m13 41 12-15 7 8 5-7 11 14Z" fill="#fff" opacity=".22" />
      </svg>
      <span className="font-display hidden text-xl font-extrabold tracking-[-0.03em] text-primary-dark sm:inline">
        Trạm Bản
      </span>
    </Link>
  );
}

function OfficialHeader() {
  const router = useRouter();
  const { official, logout } = useRole();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1920px] items-center px-4 sm:px-6 lg:h-[74px] lg:px-7 2xl:px-9">
        <Brand href="/quan-ly" />
        <span className="ml-3 hidden rounded-sm bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-primary lg:inline">
          Cổng cán bộ xã
        </span>

        <details className="group relative ml-auto">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 transition hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-surface-muted text-ink-muted">
              <IconUserCircle className="h-7 w-7" stroke={1.5} />
            </span>
            <span className="hidden max-w-40 truncate text-sm font-semibold text-ink sm:block">
              {official?.display_name ?? "Cán bộ xã"}
            </span>
            <IconChevronDown className="h-4 w-4 text-ink-muted transition group-open:rotate-180" stroke={1.8} />
          </summary>

          <div className="card card-raised absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden p-1.5">
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-sm font-bold text-ink">{official?.display_name ?? "Cán bộ xã"}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">Tài khoản được quản trị viên cấp</p>
            </div>
            <button
              type="button"
              onClick={() => void logout().finally(() => router.replace("/quan-ly"))}
              className="mt-1 flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-risk-3 transition hover:bg-risk-3/10"
            >
              <IconLogout className="h-5 w-5" stroke={1.8} />
              Đăng xuất
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}

function DefaultHeader() {
  const pathname = usePathname();
  const { resident, official } = useRole();
  const isOfficialRoute = pathname.startsWith("/quan-ly");
  const items = !isOfficialRoute
    ? resident ? RESIDENT_NAV_ITEMS : RESIDENT_GUEST_NAV_ITEMS
    : official
      ? OFFICIAL_NAV_ITEMS
      : OFFICIAL_PRELOGIN_NAV_ITEMS;
  const activeSection = useActiveSection(isOfficialRoute && official ? OFFICIAL_SECTION_IDS : []);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-surface/85 backdrop-blur-md lg:block">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-3.5">
        <Brand />
        <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
          {items.map((item) => {
            const active = item.kind === "route"
              ? pathname === item.href
              : isOfficialRoute && activeSection === item.href.split("#")[1];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-2 px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {active && (
                  <motion.span
                    layoutId="top-nav-active"
                    className="absolute inset-0 rounded-md bg-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <NavIcon name={item.icon} className={clsx("relative z-10 h-4 w-4", active && "text-primary")} />
                <span className={clsx("relative z-10", active && "font-semibold text-primary")}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default function TopNav() {
  const pathname = usePathname();
  const { official } = useRole();
  return pathname.startsWith("/quan-ly") && official ? <OfficialHeader /> : <DefaultHeader />;
}
