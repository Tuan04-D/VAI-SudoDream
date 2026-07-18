"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "motion/react";
import { ADMIN_NAV_ITEMS, OFFICIAL_NAV_ITEMS, OFFICIAL_PRELOGIN_NAV_ITEMS, OFFICIAL_SECTION_IDS, RESIDENT_NAV_ITEMS } from "@/lib/nav";
import { useActiveSection } from "@/lib/useActiveSection";
import { useRole } from "@/lib/RoleProvider";
import NavIcon from "./NavIcon";

export default function TopNav() {
  const pathname = usePathname();
  const { official, admin } = useRole();
  const isAdminRoute = pathname.startsWith("/admin");
  const isOfficialRoute = pathname.startsWith("/quan-ly");
  const isOfficial = isOfficialRoute && !!official;
  const items = admin || isAdminRoute ? ADMIN_NAV_ITEMS : !isOfficialRoute ? RESIDENT_NAV_ITEMS : official ? OFFICIAL_NAV_ITEMS : OFFICIAL_PRELOGIN_NAV_ITEMS;
  const activeSection = useActiveSection(isOfficial ? OFFICIAL_SECTION_IDS : []);

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-surface/85 backdrop-blur-md lg:block">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 64 40" className="h-8 w-12 text-primary" fill="currentColor">
            <path d="M0 40 14 18l7 8 9-16 12 18 6-8 16 20Z" />
          </svg>
          <div className="leading-tight">
            <p className="font-display text-lg font-extrabold tracking-tight text-primary">Trạm Bản</p>
          </div>
        </Link>

        <nav aria-label="Điều hướng chính" className="flex items-center gap-1">
          {items.map((item) => {
            const active =
              item.kind === "route" ? pathname === item.href : isOfficial && activeSection === item.href.split("#")[1];
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
                <NavIcon
                  name={item.icon}
                  className={clsx("relative z-10 h-4 w-4", active ? "text-primary" : "")}
                />
                <span className={clsx("relative z-10", active && "font-semibold text-primary")}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
