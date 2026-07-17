import { fetchCommunes } from "@/lib/api";
import ForecastView from "@/components/forecast/ForecastView";

async function loadData(communeParam?: string) {
  try {
    const { communes, default_commune_id } = await fetchCommunes();
    const initialCommuneId =
      communeParam && communes.some((c) => c.id === communeParam) ? communeParam : default_commune_id;
    return { communes, initialCommuneId };
  } catch {
    return null;
  }
}

export default async function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ commune?: string }>;
}) {
  const { commune } = await searchParams;
  const data = await loadData(commune);

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

  return (
    <main className="flex flex-col gap-4 pt-6">
      <header className="px-5">
        <h1 className="font-display text-xl font-bold">Dự báo 5 ngày</h1>
        <p className="text-sm text-ink-muted">Nhiệt độ và lượng mưa đã hiệu chỉnh theo địa hình xã</p>
      </header>
      <ForecastView communes={data.communes} defaultCommuneId={data.initialCommuneId} />
    </main>
  );
}
