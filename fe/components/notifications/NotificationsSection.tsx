import type { NotificationItem } from "@/lib/types";
import NotificationCard from "./NotificationCard";
import GenerateButton from "./GenerateButton";

export default function NotificationsSection({
  items,
  loadError,
}: {
  items: NotificationItem[];
  loadError: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 lg:px-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold">Thông báo</h2>
          <p className="text-sm text-ink-muted">Cảnh báo gửi hàng ngày cho các xã có nguy cơ cao nhất</p>
        </div>
        <GenerateButton />
      </header>

      {loadError ? (
        <div className="rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
          Chưa kết nối được máy chủ dữ liệu.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-muted p-5 text-center text-sm text-ink-muted">
          Chưa có thông báo nào. Nhấn &ldquo;Tạo thông báo mới&rdquo; để chạy thử.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
