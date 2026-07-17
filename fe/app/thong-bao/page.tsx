import { fetchNotifications } from "@/lib/api";
import NotificationCard from "@/components/notifications/NotificationCard";
import GenerateButton from "@/components/notifications/GenerateButton";

export default async function NotificationsPage() {
  let items: Awaited<ReturnType<typeof fetchNotifications>> = [];
  let loadError = false;
  try {
    items = await fetchNotifications(30);
  } catch {
    loadError = true;
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-5 pt-6 lg:px-8 lg:pt-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold lg:text-2xl">Thông báo</h1>
          <p className="text-sm text-ink-muted">Cảnh báo gửi hàng ngày cho các xã có nguy cơ</p>
        </div>
        <GenerateButton />
      </header>

      {loadError ? (
        <div className="rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
          Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
          <code className="font-data">localhost:8000</code>.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-muted p-5 text-center text-sm text-ink-muted">
          Chưa có thông báo nào. Nhấn &ldquo;Tạo thông báo mới&rdquo; để chạy thử.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2">
          {items.map((item) => (
            <NotificationCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </main>
  );
}
