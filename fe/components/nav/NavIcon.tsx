import { IconBell, IconHome, IconMap, IconMessage, IconUser } from "@tabler/icons-react";
import type { NavIcon as NavIconName } from "@/lib/nav";

const ICONS: Record<NavIconName, typeof IconHome> = {
  home: IconHome,
  map: IconMap,
  bell: IconBell,
  chat: IconMessage,
  user: IconUser,
};

export default function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  if (!Icon) return null;
  return <Icon className={className} stroke={1.8} />;
}
