import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  Layers,
  CalendarRange,
  FileText,
  Wallet,
  ShoppingCart,
  Users,
  Scale,
  AlertTriangle,
  FolderOpen,
  ArrowLeftRight,
  ArrowLeft,
  User,
  Hash,
  Calendar,
  Building2,
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  PLANNING: { label: "Planung", bg: "bg-blue-100", text: "text-blue-700" },
  ACTIVE: { label: "Aktiv", bg: "bg-emerald-100", text: "text-emerald-700" },
  ON_HOLD: { label: "Pausiert", bg: "bg-amber-100", text: "text-amber-700" },
  COMPLETED: { label: "Abgeschlossen", bg: "bg-gray-100", text: "text-gray-600" },
  ARCHIVED: { label: "Archiviert", bg: "bg-gray-100", text: "text-gray-500" },
};

function formatDate(d: Date | null) {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface ModuleCard {
  title: string;
  href: string;
  icon: React.ReactNode;
  color: string;
  enabled: boolean;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  // TODO(apos-extract): Once schema is expanded, use prisma.project with _count of sub-models.
  // Currently using minimal schema — sub-model counts are stubbed out.
  const project = await prisma.project.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      manager: { select: { id: true, name: true, email: true } },
    },
  });

  if (!project) notFound();

  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;

  const modules: ModuleCard[] = [
    {
      title: "Arbeitspakete",
      href: `/projekte/${id}/arbeitspakete`,
      icon: <Layers className="w-5 h-5" />,
      color: "text-blue-600 bg-blue-100",
      enabled: true,
    },
    {
      title: "Terminplan",
      href: `/projekte/${id}/terminplan`,
      icon: <CalendarRange className="w-5 h-5" />,
      color: "text-purple-600 bg-purple-100",
      enabled: true,
    },
    {
      title: "VOB / Nachträge",
      href: `/projekte/${id}/vob`,
      icon: <Scale className="w-5 h-5" />,
      color: "text-orange-600 bg-orange-100",
      enabled: false,
    },
    {
      title: "Budget",
      href: `/projekte/${id}/budget`,
      icon: <Wallet className="w-5 h-5" />,
      color: "text-emerald-600 bg-emerald-100",
      enabled: false,
    },
    {
      title: "Beschaffung",
      href: `/projekte/${id}/beschaffung`,
      icon: <ShoppingCart className="w-5 h-5" />,
      color: "text-cyan-600 bg-cyan-100",
      enabled: false,
    },
    {
      title: "Stakeholder",
      href: `/projekte/${id}/stakeholder`,
      icon: <Users className="w-5 h-5" />,
      color: "text-indigo-600 bg-indigo-100",
      enabled: false,
    },
    {
      title: "Entscheidungen",
      href: `/projekte/${id}/entscheidungen`,
      icon: <FileText className="w-5 h-5" />,
      color: "text-teal-600 bg-teal-100",
      enabled: false,
    },
    {
      title: "Risiken",
      href: `/projekte/${id}/risiken`,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: "text-red-600 bg-red-100",
      enabled: false,
    },
    {
      title: "Dokumente",
      href: `/projekte/${id}/dokumente`,
      icon: <FolderOpen className="w-5 h-5" />,
      color: "text-amber-600 bg-amber-100",
      enabled: false,
    },
    {
      title: "Übergaben",
      href: `/projekte/${id}/uebergaben`,
      icon: <ArrowLeftRight className="w-5 h-5" />,
      color: "text-gray-600 bg-gray-100",
      enabled: false,
    },
  ];

  return (
    <div className="max-w-6xl">
      {/* Back link */}
      <Link
        href="/projekte"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Alle Projekte
      </Link>

      {/* Project Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Hash className="w-3 h-3" />
                  {project.projectNumber}
                </span>
              </div>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
            {status.label}
          </span>
        </div>

        {project.description && (
          <p className="text-sm text-gray-600 mb-4">{project.description}</p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-500">
            <User className="w-4 h-4" />
            <span>{project.manager?.name || project.manager?.email}</span>
          </div>
          {project.startDate && (
            <div className="flex items-center gap-2 text-gray-500">
              <Calendar className="w-4 h-4" />
              <span>{formatDate(project.startDate)} — {formatDate(project.endDate)}</span>
            </div>
          )}
          {/* TODO(apos-extract): clientName and budget — extend schema when ready */}
          <div className="flex items-center gap-2 text-gray-500">
            <Building2 className="w-4 h-4" />
            <span className="text-gray-400 italic text-xs">Auftraggeber (TODO)</span>
          </div>
        </div>
      </div>

      {/* Module Cards */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Module</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {modules.map((m) => {
          const content = (
            <div
              className={`bg-white border border-gray-200 rounded-2xl p-4 transition-all ${
                m.enabled
                  ? "hover:shadow-md hover:border-gray-300 cursor-pointer"
                  : "opacity-50 cursor-not-allowed"
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${m.color}`}>
                {m.icon}
              </div>
              <h3 className="text-sm font-medium text-gray-900">{m.title}</h3>
              {!m.enabled && (
                <span className="text-[10px] text-gray-400 mt-1 block">Bald verfügbar</span>
              )}
            </div>
          );

          if (m.enabled) {
            return (
              <Link key={m.title} href={m.href}>
                {content}
              </Link>
            );
          }

          return <div key={m.title}>{content}</div>;
        })}
      </div>
    </div>
  );
}
