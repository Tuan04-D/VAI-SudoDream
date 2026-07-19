import { fetchCommunes, fetchForecast } from "@/lib/api";
import ResidentHome from "@/components/resident/ResidentHome";

export const revalidate = 120;

export default async function HomePage() {
  let communes: Awaited<ReturnType<typeof fetchCommunes>> | null = null;
  let initialForecast: Awaited<ReturnType<typeof fetchForecast>> | null = null;
  try {
    communes = await fetchCommunes();
    initialForecast = await fetchForecast(communes.default_commune_id, 5);
  } catch {
    communes = null;
    initialForecast = null;
  }

  if (!communes || !initialForecast) {
    return (
      <div className="mx-5 mt-8 rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
        Chưa kết nối được máy chủ dữ liệu. Hãy chắc chắn server chính đang chạy ở{" "}
        <code className="font-data">localhost:8000</code>.
      </div>
    );
  }

  return (
    <ResidentHome
      communes={communes.communes}
      defaultCommuneId={communes.default_commune_id}
      initialForecast={initialForecast}
    />
  );
}
