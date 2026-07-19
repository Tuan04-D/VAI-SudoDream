"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "motion/react";
import {
  ADMIN_NAV_ITEMS,
  OFFICIAL_NAV_ITEMS,
  OFFICIAL_PRELOGIN_NAV_ITEMS,
  OFFICIAL_SECTION_IDS,
  RESIDENT_GUEST_NAV_ITEMS,
  RESIDENT_NAV_ITEMS,
} from "@/lib/nav";
import { useActiveSection } from "@/lib/useActiveSection";
import { useRole } from "@/lib/RoleProvider";
import NavIcon from "./NavIcon";

export default function BottomNav() {
  const pathname = usePathname();
  const { resident, official, admin } = useRole();
  const isAdminRoute = pathname.startsWith("/admin");
  const isOfficialRoute = pathname.startsWith("/quan-ly");
  const isOfficial = isOfficialRoute && !!official;
  const residentItems = resident ? RESIDENT_NAV_ITEMS : RESIDENT_GUEST_NAV_ITEMS;
  const items = admin || isAdminRoute
    ? ADMIN_NAV_ITEMS
    : !isOfficialRoute
      ? residentItems
      : official
        ? OFFICIAL_NAV_ITEMS
        : OFFICIAL_PRELOGIN_NAV_ITEMS;
  const activeSection = useActiveSection(isOfficial ? OFFICIAL_SECTION_IDS : []);

  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/90 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75 lg:hidden"
    >
      <div className="mx-auto flex max-w-xl items-stretch justify-between px-1">
        {items.map((item) => {
          const active =
            item.kind === "route" ? pathname === item.href : isOfficial && activeSection === item.href.split("#")[1];
          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute top-1 h-8 w-12 rounded-md bg-primary/10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <NavIcon
                name={item.icon}
                className={clsx(
                  "relative z-10 h-6 w-6 transition-colors",
                  active ? "text-primary" : "text-ink-muted"
                )}
              />
              <span className={clsx("relative z-10", active ? "text-primary" : "text-ink-muted")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)] bg-surface" />
    </nav>
  );
}
