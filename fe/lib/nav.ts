export const NAV_ITEMS = [
  { href: "/", label: "Trang chủ", icon: "home" as const },
  { href: "/du-bao", label: "Dự báo", icon: "map" as const },
  { href: "/thong-bao", label: "Thông báo", icon: "bell" as const },
  { href: "/chatbot", label: "Hỏi đáp", icon: "chat" as const },
  { href: "/ho-so", label: "Hồ sơ", icon: "user" as const },
];

export type NavIcon = (typeof NAV_ITEMS)[number]["icon"];
