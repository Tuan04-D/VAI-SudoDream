import { fetchCommunes } from "@/lib/api";
import ResidentHome from "@/components/resident/ResidentHome";

export default async function HomePage() {
  let communes: Awaited<ReturnType<typeof fetchCommunes>> | null = null;
  try {
    communes = await fetchCommunes();
  } catch {
    communes = null;
  }

  if (!communes) {
    return (
      <div className="mx-5 mt-8 rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
        Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
        <code className="font-data">localhost:8000</code>.
      </div>
    );
  }

  return <ResidentHome communes={communes.communes} defaultCommuneId={communes.default_commune_id} />;
}
