import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { FolderKanban, Construction } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <FolderKanban className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Willkommen, {session?.user?.name}
          </h1>
          <p className="text-sm text-gray-500">APOS · Apricus Project OS · ProjectEngine</p>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1 ml-auto">
          <Construction className="w-3 h-3" />
          In Entwicklung
        </span>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <FolderKanban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Noch keine Projekte</h2>
        <p className="text-sm text-gray-500 mb-4">
          Erstellen Sie Ihr erstes Bauprojekt, um loszulegen.
        </p>
        <a
          href="/projekte"
          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          Zu den Projekten
        </a>
      </div>
    </div>
  );
}
