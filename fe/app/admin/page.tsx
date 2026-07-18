import AdminDashboard from "@/features/admin/AdminDashboard";
import { fetchCommunes } from "@/features/forecast/api";


export default async function AdminPage() {
  const data = await fetchCommunes().catch(() => null);
  if (!data) return <p className="p-8 text-ink-muted">Không kết nối được backend.</p>;
  return <AdminDashboard communes={data.communes} />;
}
