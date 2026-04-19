import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  Layers,
  CalendarRange,
  ClipboardList,
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
  MapPin,
} from "lucide-react";
import { computeProjectHealth } from "@/lib/projekte/health";
import ProjectHealthBadge from "@/components/projekte/ProjectHealthBadge";
import DataRoomEditor from "@/components/projekte/DataRoomEditor";
import GoogleDriveIcon from "@/components/icons/GoogleDriveIcon";
import { HardDrive, ExternalLink } from "lucide-react";

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

function DateBlock({
  label,
  value,
  icon: Icon,
  danger,
}: {
  label: string;
  value: Date | null;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
}) {
  const hasValue = value !== null;
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        danger && hasValue
          ? "border-red-200 bg-red-50"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-0.5">
        {label}
      </div>
      <div
        className={`flex items-center gap-1.5 text-sm font-medium tabular-nums ${
          danger && hasValue ? "text-red-700" : "text-gray-900"
        }`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${
            danger && hasValue ? "text-red-500" : "text-gray-400"
          }`}
        />
        {hasValue ? formatDate(value) : "–"}
      </div>
    </div>
  );
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

  const project = await prisma.project.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      manager: { select: { id: true, name: true, email: true, kuerzel: true } },
      customer: { select: { id: true, companyName: true, city: true, classification: true } },
      bauherr: { select: { id: true, companyName: true, city: true, classification: true } },
      landowner: { select: { id: true, companyName: true, city: true, classification: true } },
    },
  });

  if (!project) notFound();

  const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.PLANNING;

  // Steuerkreis-User laden (falls gesetzt)
  const steeringUsers = project.steeringCommitteeUserIds.length > 0
    ? await prisma.user.findMany({
        where: {
          id: { in: project.steeringCommitteeUserIds },
          organizationId: session.user.organizationId,
        },
        select: { id: true, name: true, email: true, kuerzel: true },
      })
    : [];

  // Health-Badge (aus ScheduleItems berechnet)
  const health = await computeProjectHealth(project.id);

  const modules: ModuleCard[] = [
    {
      title: "Arbeitspakete",
      href: `/projekte/${id}/arbeitspakete`,
      icon: <Layers className="w-5 h-5" />,
      color: "text-blue-600 bg-blue-100",
      enabled: true,
    },
    {
      title: "Steckbrief",
      href: `/projekte/${id}/steckbrief`,
      icon: <ClipboardList className="w-5 h-5" />,
      color: "text-violet-600 bg-violet-100",
      enabled: true,
    },
    {
      title: "Bauzeitenplan",
      href: `/projekte/${id}/terminplan`,
      icon: <CalendarRange className="w-5 h-5" />,
      color: "text-purple-600 bg-purple-100",
      enabled: true,
    },
    {
      title: "Beteiligte",
      href: `/projekte/${id}/beteiligte`,
      icon: <Users className="w-5 h-5" />,
      color: "text-rose-600 bg-rose-100",
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

        {/* Verantwortlichkeiten */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
              Verantwortlicher Projektleiter
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <User className="w-4 h-4 text-gray-400" />
              <span>{project.manager?.name ?? project.manager?.email}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
              Steuerkreis
            </div>
            {steeringUsers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {steeringUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs"
                    title={u.email}
                  >
                    <User className="w-3 h-3" />
                    {u.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-400 italic">
                Noch kein Steuerkreis zugeordnet
              </span>
            )}
          </div>
        </div>

        {/* Daten-Grid: Projektstart / Baustart / Inbetriebnahme / Deadline */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <DateBlock
            label="Projektstart"
            value={project.startDate}
            icon={Calendar}
          />
          <DateBlock
            label="Geplanter Baustart"
            value={project.plannedConstructionStart}
            icon={Calendar}
          />
          <DateBlock
            label="Geplante Inbetriebnahme"
            value={project.plannedCommissioning}
            icon={Calendar}
          />
          <DateBlock
            label="Deadline"
            value={project.deadline}
            icon={Calendar}
            danger
          />
        </div>

        {/* Parteien + Adresse */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm pt-4 border-t border-gray-100">
          <PartyBlock
            label="Auftraggeber"
            customer={project.customer}
            fallbackText={project.clientName}
          />
          <PartyBlock label="Bauherr" customer={project.bauherr} />
          <PartyBlock label="Grundstückseigentümer" customer={project.landowner} />
        </div>

        {project.address && (
          <div className="text-sm pt-4 border-t border-gray-100 mt-4">
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
              Adresse
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="w-4 h-4 text-gray-400" />
              <span>{project.address}</span>
            </div>
          </div>
        )}

        {/* Datenräume */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm pt-4 border-t border-gray-100 mt-4">
          <DataRoomBlock
            label="Interner Datenraum"
            url={project.dataRoomUrl}
            placeholder="Google Drive / SharePoint Link einfügen"
            projectId={project.id}
            field="dataRoomUrl"
          />
          <DataRoomBlock
            label="Kunden-Datenraum"
            url={project.customerDataRoomUrl}
            placeholder="Optional: Datenraum-Link des Kunden"
            projectId={project.id}
            field="customerDataRoomUrl"
          />
        </div>
      </div>

      {/* Health-Badge */}
      <div className="mb-6">
        <ProjectHealthBadge health={health} variant="detailed" />
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

function DataRoomBlock({
  label,
  url,
  placeholder,
  projectId,
  field,
}: {
  label: string;
  url: string | null;
  placeholder: string;
  projectId: string;
  field: "dataRoomUrl" | "customerDataRoomUrl";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-1">
        <HardDrive className="w-3 h-3" /> {label}
      </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 hover:underline transition-colors text-sm group"
        >
          <GoogleDriveIcon className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-[260px]">{prettyUrl(url)}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100" />
        </a>
      ) : (
        <DataRoomEditor projectId={projectId} field={field} placeholder={placeholder} />
      )}
    </div>
  );
}

function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.host + u.pathname.replace(/\/+$/, "");
  } catch {
    return url;
  }
}

function PartyBlock({
  label,
  customer,
  fallbackText,
}: {
  label: string;
  customer: { id: string; companyName: string; city: string | null } | null;
  fallbackText?: string | null;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
        {label}
      </div>
      {customer ? (
        <Link
          href={`/kunden/${customer.id}`}
          className="inline-flex items-center gap-2 text-gray-800 hover:text-emerald-600 hover:underline transition-colors"
        >
          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-medium truncate">{customer.companyName}</span>
          {customer.city && (
            <span className="text-xs text-gray-500 shrink-0">· {customer.city}</span>
          )}
        </Link>
      ) : fallbackText ? (
        <div className="flex items-center gap-2 text-gray-700">
          <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
          <span>{fallbackText}</span>
          <span className="text-[10px] text-gray-400 italic">(nicht verknüpft)</span>
        </div>
      ) : (
        <span className="text-xs text-gray-400 italic">Nicht hinterlegt</span>
      )}
    </div>
  );
}

