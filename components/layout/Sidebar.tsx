"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard, FolderKanban, Package, GanttChart, Scale,
  DollarSign, Truck, Users, Users2, ClipboardList, AlertTriangle,
  FileText, FileCheck, Mail, ExternalLink, CalendarCheck,
  Briefcase, FlaskConical, BarChart3, Contact, Settings,
  NotebookPen,
} from "lucide-react";

// Top-4, bleiben oben fix (User-Entscheidung 2026-04-19)
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projekte", icon: FolderKanban, label: "Projekte" },
  { href: "/kunden", icon: Contact, label: "Kunden (CRM)" },
  { href: "/arbeitspakete", icon: Package, label: "Arbeitspakete" },
];

// Module-Gruppen: Separator trennt die Gruppen, Hover zeigt Label.
// Reihenfolge der Gruppen innerhalb des Arrays = Reihenfolge in der Sidebar.
interface ModuleGroup {
  label: string;
  items: { href: string; icon: React.ComponentType<{ size?: number }>; label: string }[];
}

const moduleGroups: ModuleGroup[] = [
  {
    label: "Planung & Durchführung",
    items: [
      { href: "/terminplan", icon: GanttChart, label: "Terminplan" },
      { href: "/beschaffung", icon: Truck, label: "Beschaffung" },
      { href: "/budget", icon: DollarSign, label: "Budget" },
    ],
  },
  {
    label: "Dokumentation",
    items: [
      { href: "/protokolle", icon: NotebookPen, label: "Protokolle" },
      { href: "/dokumente", icon: FileText, label: "Dokumente" },
      { href: "/vob", icon: Scale, label: "VOB" },
      { href: "/uebergaben", icon: FileCheck, label: "Übergaben" },
    ],
  },
  {
    label: "Steuerung",
    items: [
      { href: "/stakeholder", icon: Users, label: "Stakeholder" },
      { href: "/entscheidungen", icon: ClipboardList, label: "Entscheidungen" },
      { href: "/risiken", icon: AlertTriangle, label: "Risiken" },
      { href: "/kommunikation", icon: Mail, label: "Kommunikation" },
    ],
  },
];

const settingsItems = [
  { href: "/einstellungen/benutzer", icon: Users2, label: "Benutzer" },
  { href: "/einstellungen/gewerke", icon: Briefcase, label: "Gewerke" },
  { href: "/einstellungen/feiertage", icon: CalendarCheck, label: "Feiertage" },
  { href: "/einstellungen/muster", icon: FlaskConical, label: "Musterdaten" },
];

// Nur für ADMIN / DEVELOPER sichtbar
const adminItems = [
  { href: "/admin/kpi", icon: BarChart3, label: "KPI Dashboard" },
];

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projekte\/([^/]+)/);
  if (match && match[1] !== "neu") return match[1];
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const projectId = extractProjectId(pathname);
  const { data: session } = useSession();
  const role = session?.user?.role;
  const showAdmin = role === "ADMIN" || role === "DEVELOPER";

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/projekte") return pathname === "/projekte" || (pathname.startsWith("/projekte/") && !!projectId);
    return pathname.startsWith(href);
  };

  const isModuleActive = (href: string) => {
    if (pathname.startsWith(href)) return true;
    if (projectId) {
      const slug = href.replace("/", "");
      return pathname.includes(`/projekte/${projectId}/${slug}`);
    }
    return false;
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-14 flex flex-col items-center py-3 z-50"
      style={{ backgroundColor: "var(--sidebar-bg)" }}
    >
      {/* Logo */}
      <Link href="/dashboard" className="mb-4">
        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
          <FolderKanban className="w-5 h-5 text-white" />
        </div>
      </Link>

      {/* Main nav */}
      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-1.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
              isActive(href)
                ? "bg-emerald-600 text-white"
                : "text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <Icon size={18} />
          </Link>
        ))}

        {/* Gruppen-Module — Separator vor jeder Gruppe; Gruppen-Label
            als Tooltip auf dem Separator (Hover: zeigt "Planung & …") */}
        {moduleGroups.map((group) => (
          <div
            key={group.label}
            className="w-full flex flex-col items-center gap-1"
          >
            <div
              className="w-6 h-px bg-gray-700 my-1 flex-shrink-0 relative group/sep"
              title={group.label}
            >
              {/* Label beim Hover über dem Separator */}
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-[10px] font-medium text-gray-400 opacity-0 group-hover/sep:opacity-100 pointer-events-none bg-gray-900 px-2 py-0.5 rounded transition-opacity">
                {group.label}
              </span>
            </div>
            {group.items.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                  isModuleActive(href)
                    ? "bg-emerald-600 text-white"
                    : "text-gray-500 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Icon size={16} />
              </Link>
            ))}
          </div>
        ))}

        {/* Separator */}
        <div className="w-6 h-px bg-gray-700 my-1 flex-shrink-0" />

        {/* Settings links */}
        {settingsItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
              pathname.startsWith(href)
                ? "bg-emerald-600 text-white"
                : "text-gray-500 hover:bg-gray-700 hover:text-white"
            }`}
          >
            <Icon size={16} />
          </Link>
        ))}

        {/* Admin-Sektion (nur für ADMIN/DEVELOPER) */}
        {showAdmin && (
          <>
            <div className="w-6 h-px bg-gray-700 my-1 flex-shrink-0" />
            {adminItems.map(({ href, icon: Icon, label }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${
                  pathname.startsWith(href)
                    ? "bg-emerald-600 text-white"
                    : "text-gray-500 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <Icon size={16} />
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Bottom: Settings + OOS-Link */}
      <div className="flex flex-col items-center gap-1 px-1.5">
        <Link
          href="/einstellungen"
          title="Einstellungen"
          className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            pathname === "/einstellungen"
              ? "bg-emerald-600 text-white"
              : "text-gray-500 hover:bg-gray-700 hover:text-white"
          }`}
        >
          <Settings size={16} />
        </Link>
        <a
          href={process.env.NEXT_PUBLIC_OOS_URL || "http://localhost:3000"}
          target="_blank"
          rel="noopener noreferrer"
          title="Zum OOS"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-700 hover:text-white transition-colors"
        >
          <ExternalLink size={16} />
        </a>
      </div>
    </aside>
  );
}
