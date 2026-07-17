import type { HazardType } from "@/lib/types";

export default function HazardIcon({ type, className }: { type: HazardType; className?: string }) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "lu_quet":
      return (
        <svg {...props}>
          <path d="M2 16c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" />
          <path d="M2 20c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" />
          <path d="M12 3v9M12 12l-3.5-3.5M12 12l3.5-3.5" />
        </svg>
      );
    case "mua_lon":
      return (
        <svg {...props}>
          <path d="M7 15a5 5 0 0 1 1-9.9A6 6 0 0 1 19 8a4.5 4.5 0 0 1-1 8.9H7Z" />
          <path d="M8 19l-1.5 3M12.5 19 11 22M17 19l-1.5 3" />
        </svg>
      );
    case "ret_hai":
      return (
        <svg {...props}>
          <path d="M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11" />
          <path d="M12 2 9.5 4.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5" />
        </svg>
      );
    case "nang_nong":
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.3 2.3L16 10" />
        </svg>
      );
  }
}
