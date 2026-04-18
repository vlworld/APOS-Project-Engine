"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, FolderKanban, Package, Calendar, Scale,
  DollarSign, Truck, Users, ClipboardList, AlertTriangle,
  FileText, FileCheck, Mail, ExternalLink,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/projekte", icon: FolderKanban, label: "Projekte" },
];

const moduleItems = [
  { href: "/arbeitspakete", icon: Package, label: "Arbeitspakete" },
  { href: "/terminplan", icon: Calendar, label: "Terminplan" },
  { href: "/vob", icon: Scale, label: "VOB" },
  { href: "/budget", icon: DollarSign, label: "Budget" },
  { href: "/beschaffung", icon: Truck, label: "Beschaffung" },
  { href: "/stakeholder", icon: Users, label: "Stakeholder" },
  { href: "/entscheidungen", icon: ClipboardList, label: "Entscheidungen" },
  { href: "/risiken", icon: AlertTriangle, label: "Risiken" },
  { href: "/dokumente", icon: FileText, label: "Dokumente" },
  { href: "/uebergaben", icon: FileCheck, label: "Übergaben" },
  { href: "/kommunikation", icon: Mail, label: "Kommunikation" },
];

function extractProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/projekte\/([^/]+)/);
  if (match && match[1] !== "neu") return match[1];
  return null;
}

export default function Sidebar() {
  const pathname = usePathname();
  const projectId = extractProjectId(pathname);

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

        {/* Separator */}
        <div className="w-6 h-px bg-gray-700 my-1 flex-shrink-0" />

        {/* Module links */}
        {moduleItems.map(({ href, icon: Icon, label }) => (
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
      </nav>

      {/* Bottom: link to OOS */}
      <div className="flex flex-col items-center gap-1 px-1.5">
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
