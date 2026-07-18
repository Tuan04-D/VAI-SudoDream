export type NavItem = {
  href: string;
  label: string;
  icon: "home" | "map" | "bell" | "chat" | "user";
  kind: "route" | "anchor";
};

export const RESIDENT_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", icon: "home", kind: "route" },
  { href: "/ho-so", label: "Hồ sơ", icon: "user", kind: "route" },
  { href: "/quan-ly", label: "Cán bộ xã", icon: "map", kind: "route" },
];

/** Shown at /quan-ly before an official has logged in — no section anchors
 * yet, since the dashboard body (and its #du-bao/#thong-bao/#chatbot
 * sections) hasn't rendered. */
export const OFFICIAL_PRELOGIN_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Người dân", icon: "user", kind: "route" },
];

export const OFFICIAL_NAV_ITEMS: NavItem[] = [
  { href: "/quan-ly#top", label: "Tổng quan", icon: "home", kind: "anchor" },
  { href: "/quan-ly#du-bao", label: "Dự báo", icon: "map", kind: "anchor" },
  { href: "/quan-ly#thong-bao", label: "Thông báo", icon: "bell", kind: "anchor" },
  { href: "/quan-ly#chatbot", label: "Hỏi đáp", icon: "chat", kind: "anchor" },
  { href: "/ho-so", label: "Hồ sơ", icon: "user", kind: "route" },
  { href: "/", label: "Người dân", icon: "user", kind: "route" },
];

export type NavIcon = NavItem["icon"];

export const OFFICIAL_SECTION_IDS = ["top", "du-bao", "thong-bao", "chatbot"];
