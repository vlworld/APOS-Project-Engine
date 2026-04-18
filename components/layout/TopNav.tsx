"use client";

import { useSession } from "next-auth/react";
import { FolderKanban } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";

export default function TopNav() {
  const { data: session } = useSession();

  return (
    <header
      className="fixed top-0 left-14 right-0 h-14 flex items-center px-6 z-40 border-b"
      style={{
        backgroundColor: "var(--topnav-bg)",
        borderColor: "var(--topnav-border)",
      }}
    >
      <div className="flex items-center gap-2">
        <FolderKanban className="w-4 h-4 text-emerald-600" />
        <span className="text-sm font-semibold text-gray-900">APOS</span>
        <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
          ProjectEngine
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {session?.user && (
          <span className="text-xs text-gray-500">
            {session.user.name}
          </span>
        )}
      </div>
    </header>
  );
}
