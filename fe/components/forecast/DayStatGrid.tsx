import type { DayForecast } from "@/lib/types";

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="border-l border-border py-1 pl-3 first:border-l-0 first:pl-0">
      <p className="font-data text-lg font-semibold text-ink">
        {value}
        {unit && <span className="text-sm font-normal text-ink-muted"> {unit}</span>}
      </p>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

export default function DayStatGrid({ day }: { day: DayForecast }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile
        label="Nhiệt độ"
        value={
          day.temp_min_c != null && day.temp_max_c != null
            ? `${Math.round(day.temp_min_c)}–${Math.round(day.temp_max_c)}`
            : "—"
        }
        unit="°C"
      />
      <Tile label="Lượng mưa" value={day.rain_sum_mm != null ? day.rain_sum_mm.toFixed(1) : "—"} unit="mm" />
      <Tile
        label="Khả năng mưa"
        value={day.rain_probability_max_percent != null ? `${Math.round(day.rain_probability_max_percent)}` : "—"}
        unit="%"
      />
      <Tile
        label="Gió giật"
        value={day.wind_gust_max_kmh != null ? `${Math.round(day.wind_gust_max_kmh)}` : "—"}
        unit="km/h"
      />
    </div>
  );
}
