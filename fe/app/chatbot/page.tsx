import { fetchCommunes } from "@/lib/api";
import ChatView from "@/components/chat/ChatView";

async function loadData() {
  try {
    return await fetchCommunes();
  } catch {
    return null;
  }
}

export default async function ChatbotPage() {
  const data = await loadData();

  if (!data) {
    return (
      <main className="px-5 pt-10">
        <div className="rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
          Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
          <code className="font-data">localhost:8000</code>.
        </div>
      </main>
    );
  }

  return <ChatView communes={data.communes} defaultCommuneId={data.default_commune_id} />;
}
