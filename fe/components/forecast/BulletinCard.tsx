import clsx from "clsx";
import { IconAlertTriangle } from "@tabler/icons-react";
import SpeakButton from "@/components/ui/SpeakButton";
import Markdown from "@/components/ui/Markdown";
import type { Bulletin, DataQuality, DataSourceItem } from "@/lib/types";

export default function BulletinCard({
  bulletin,
  dataQuality,
  dataSources,
  disclaimer,
  source,
}: {
  bulletin: Bulletin | null;
  dataQuality: DataQuality;
  dataSources: DataSourceItem[];
  disclaimer: string;
  source: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {source === "advisory" ? "Bản tin AI (thời tiết + sạt lở NCHMF)" : "Bản tin tự động từ dữ liệu thô"}
        </p>
        {dataQuality.stale && (
          <span className="rounded-sm bg-risk-1/15 px-2 py-0.5 text-[11px] font-semibold text-risk-1">
            Dữ liệu cache cũ
          </span>
        )}
      </div>

      {bulletin?.text ? (
        <Markdown text={bulletin.text} className="mt-2" />
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-ink">Chưa có bản tin cho xã này.</p>
      )}

      {bulletin && (
        <div className="mt-3 flex flex-wrap gap-2">
          <SpeakButton text={bulletin.text} language="vietnamese" />
        </div>
      )}

      {dataQuality.warnings.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {dataQuality.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-ink-muted">
              <IconAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-risk-1" stroke={2} />
              {w}
            </li>
          ))}
        </ul>
      )}

      {dataSources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11px] text-ink-muted">
          {dataSources.map((s) => (
            <span key={s.id} className={clsx(s.official_warning_source && "font-semibold text-ink")}>
              {s.name}
              {s.official_warning_source && " (nguồn cảnh báo chính thức)"}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] italic text-ink-muted">{disclaimer}</p>
    </div>
  );
}
