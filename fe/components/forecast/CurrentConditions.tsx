import { IconNavigation } from "@tabler/icons-react";
import WeatherIcon from "@/components/ui/WeatherIcon";
import type { CurrentWeather } from "@/lib/types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-l border-border pl-3 first:border-l-0 first:pl-0">
      <span className="font-data text-sm font-semibold text-ink">{value}</span>
      <span className="text-[11px] text-ink-muted">{label}</span>
    </div>
  );
}

export default function CurrentConditions({ current }: { current: CurrentWeather | null }) {
  if (!current) {
    return <p className="text-sm text-ink-muted">Chưa có dữ liệu thời tiết hiện tại.</p>;
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <WeatherIcon iconKey={current.icon_key} className="h-9 w-9 text-primary" />
          <div>
            <p className="font-display text-2xl font-bold tabular-nums">
              {current.temperature_c != null ? Math.round(current.temperature_c) : "--"}°C
            </p>
            <p className="text-xs text-ink-muted">
              {current.condition} · cảm giác{" "}
              {current.apparent_temperature_c != null ? Math.round(current.apparent_temperature_c) : "--"}°C
            </p>
          </div>
        </div>
        {current.time && (
          <span className="font-data text-xs text-ink-muted">
            cập nhật {current.time.slice(11, 16)}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-y-3 sm:grid-cols-4">
        <Stat label="Độ ẩm" value={current.humidity_percent != null ? `${Math.round(current.humidity_percent)}%` : "—"} />
        <Stat label="Mây che phủ" value={current.cloud_cover_percent != null ? `${Math.round(current.cloud_cover_percent)}%` : "—"} />
        <Stat
          label="Tầm nhìn"
          value={current.visibility_m != null ? `${(current.visibility_m / 1000).toFixed(1)}km` : "—"}
        />
        <Stat
          label="Gió"
          value={current.wind_speed_kmh != null ? `${Math.round(current.wind_speed_kmh)}km/h` : "—"}
        />
      </div>

      {current.wind_direction_deg != null && (
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-ink-muted">
          <IconNavigation
            className="h-4 w-4 shrink-0 text-ink-muted"
            stroke={2}
            style={{ transform: `rotate(${current.wind_direction_deg}deg)` }}
          />
          <span>
            Hướng gió {Math.round(current.wind_direction_deg)}°
            {current.wind_gust_kmh != null && ` · giật tối đa ${Math.round(current.wind_gust_kmh)}km/h`}
          </span>
        </div>
      )}
    </div>
  );
}
