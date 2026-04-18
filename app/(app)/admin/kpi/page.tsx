import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/api-helpers";
import KpiDashboard from "@/components/admin/KpiDashboard";

export default async function AdminKpiPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isAdmin(session.user.role)) redirect("/dashboard");

  // FIX ME: echte KPI-Daten aus DB laden (aktuell Mock im Client)
  return <KpiDashboard />;
}
