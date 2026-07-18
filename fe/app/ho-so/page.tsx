import { fetchCommunes } from "@/lib/api";
import ProfileEditor from "@/components/resident/ProfileEditor";

export default async function ProfilePage() {
  let communes: Awaited<ReturnType<typeof fetchCommunes>> | null = null;
  try {
    communes = await fetchCommunes();
  } catch {
    communes = null;
  }

  if (!communes) {
    return (
      <div className="mx-5 mt-8 rounded-lg border border-border bg-surface-muted p-5 text-sm text-ink-muted">
        Chưa kết nối được máy chủ dữ liệu.
      </div>
    );
  }

  return <ProfileEditor communes={communes.communes} />;
}
