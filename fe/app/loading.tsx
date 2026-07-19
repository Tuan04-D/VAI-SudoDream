import { IconMountain } from "@tabler/icons-react";

export default function Loading() {
  return (
    <main className="min-h-[70vh] bg-bg px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center gap-3 text-primary-dark">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <IconMountain className="h-6 w-6" stroke={1.7} />
          </span>
          <div>
            <p className="font-display text-sm font-bold">Trạm Bản đang mở bản tin</p>
            <p className="text-xs text-ink-muted">Đang lấy dữ liệu mới nhất cho địa bàn…</p>
          </div>
        </div>
        <div className="skeleton h-64 rounded-lg sm:h-80" />
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
          <div className="skeleton h-24 rounded-lg" />
        </div>
      </div>
    </main>
  );
}
