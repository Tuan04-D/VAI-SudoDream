import { fetchCommunes } from "@/lib/api";
import ResidentManagementDashboard from "@/components/officer/ResidentManagementDashboard";

export default async function RegisteredResidentsPage() {
  let data: Awaited<ReturnType<typeof fetchCommunes>> | null = null;
  try {
    data = await fetchCommunes();
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="mx-5 mt-8 rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
        Chưa kết nối được máy chủ dữ liệu.
      </div>
    );
  }

  return <ResidentManagementDashboard communes={data.communes} />;
}
