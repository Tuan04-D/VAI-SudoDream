import {
  IconCloud,
  IconCloudBolt,
  IconCloudFog,
  IconCloudQuestion,
  IconCloudRain,
  IconCloudSnow,
  IconSun,
} from "@tabler/icons-react";

function props(className?: string, style?: React.CSSProperties) {
  return {
    className,
    style,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function PartlyCloudy({ className }: { className?: string }) {
  return (
    <span className={className} style={{ position: "relative", display: "inline-block" }}>
      <IconCloud className="h-full w-full" stroke={2} />
      <IconSun className="absolute -top-[15%] -left-[15%] h-[55%] w-[55%]" stroke={2} />
    </span>
  );
}

/** Keyed by the real AI service's icon_key (fe/ai/app/tools/weather.py:weather_condition_ui). */
export default function WeatherIcon({ iconKey, className }: { iconKey: string | null; className?: string }) {
  switch (iconKey) {
    case "clear":
      return <IconSun className={className} stroke={2} />;
    case "partly_cloudy":
      return <PartlyCloudy className={className} />;
    case "cloudy":
      return <IconCloud className={className} stroke={2} />;
    case "fog":
      return <IconCloudFog className={className} stroke={2} />;
    case "rain":
      return <IconCloudRain className={className} stroke={2} />;
    case "heavy_rain":
      return <IconCloudRain className={className} stroke={2} />;
    case "snow":
      return <IconCloudSnow className={className} stroke={2} />;
    case "thunderstorm":
    case "hail":
      return <IconCloudBolt className={className} stroke={2} />;
    default:
      return <IconCloudQuestion className={className} stroke={2} />;
  }
}

export function LandslideIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props(className, style)}>
      <path d="M3 20 10 6l3 5 2-2 6 11Z" />
      <path d="m14 12 3 3.5" />
    </svg>
  );
}

export function FlashFloodIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props(className, style)}>
      <path d="M2 15c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" />
      <path d="M2 19c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0" />
      <path d="M12 3v8M12 11l-3.2-3.2M12 11l3.2-3.2" />
    </svg>
  );
}

export function HeavyRainIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props(className, style)}>
      <path d="M7 13.5a4.5 4.5 0 0 1 .9-8.9 5.5 5.5 0 0 1 10.4 1.5A4 4 0 0 1 17.5 14" />
      <path d="M7 16.5 6 20M11 16.5l-1 3.5M15 16.5l-1 3.5" />
    </svg>
  );
}

export function FrostIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props(className, style)}>
      <path d="M12 2.5v19M4.8 6.25l14.4 11.5M19.2 6.25 4.8 17.75" />
      <path d="M12 2.5 9.8 4.7M12 2.5l2.2 2.2M12 21.5l-2.2-2.2M12 21.5l2.2-2.2" />
      <path d="M4.8 6.25 5 9.1M4.8 6.25l2.85-.6M19.2 6.25 19 9.1M19.2 6.25l-2.85-.6" />
      <path d="M4.8 17.75 5 14.9M4.8 17.75l2.85.6M19.2 17.75 19 14.9M19.2 17.75l-2.85.6" />
    </svg>
  );
}

export function StrongWindIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props(className, style)}>
      <path d="M2.5 8h13a3 3 0 1 0-2.6-4.5" />
      <path d="M2.5 13h16.7a3 3 0 1 1-2.6 4.5" />
      <path d="M2.5 18h9a2.4 2.4 0 1 0-2.1-3.6" />
    </svg>
  );
}

export function ThunderstormIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg {...props(className, style)}>
      <path d="M7 13.5a4.5 4.5 0 0 1 .9-8.9 5.5 5.5 0 0 1 10.4 1.5A4 4 0 0 1 17.5 14" />
      <path d="m13 15-3 5h3l-2 4" />
    </svg>
  );
}
