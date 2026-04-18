"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FlaskConical,
  Loader2,
  Check,
  AlertTriangle,
  Briefcase,
  CalendarCheck,
  FolderKanban,
  ListTree,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type MusterStatus = {
  active: boolean;
  counts: {
    tradeCategories: number;
    holidays: number;
    projects: number;
    scheduleItems: number;
  };
};

export default function MusterPage() {
  const [status, setStatus] = useState<MusterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const { toast } = useToast();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/muster");
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleApply() {
    setWorking(true);
    try {
      const res = await fetch("/api/muster", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        toast({
          title: "Musterdaten geladen",
          description: `${data.counts.tradeCategories} Gewerke, ${data.counts.holidays} Feiertage, ${data.counts.projects} Muster-Projekt mit ${data.counts.scheduleItems} Einträgen`,
          variant: "success",
        });
      } else {
        const body = await res.json().catch(() => ({ error: "Fehler" }));
        toast({ title: body.error ?? "Fehler", variant: "error" });
      }
    } finally {
      setWorking(false);
    }
  }

  async function handleRemove() {
    setConfirmRemove(false);
    setWorking(true);
    try {
      const res = await fetch("/api/muster", { method: "DELETE" });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        toast({ title: "Musterdaten entfernt", variant: "success" });
      } else {
        toast({ title: "Fehler beim Entfernen", variant: "error" });
      }
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  const active = status?.active ?? false;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-fuchsia-100 rounded-xl flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Musterdaten</h1>
          <p className="text-sm text-gray-500">
            Vordefinierte Gewerke, Feiertage und ein Muster-PV-Projekt zur
            Demonstration und zum Testen.
          </p>
        </div>
      </div>

      {/* Toggle Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-semibold text-gray-900">
                Musterdaten laden
              </h2>
              {active && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                  <Check className="w-3 h-3" />
                  aktiv
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Legt Gewerke, NRW-Feiertage 2025–2027 und ein vollständiges
              Muster-PV-Projekt mit realistischem Bauzeitenplan an. Alle
              Einträge sind als „Muster" markiert und können mit einem Klick
              wieder entfernt werden.
            </p>
            <div className="flex gap-2">
              {!active ? (
                <button
                  onClick={handleApply}
                  disabled={working}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {working && <Loader2 className="w-4 h-4 animate-spin" />}
                  Musterdaten laden
                </button>
              ) : (
                <button
                  onClick={() => setConfirmRemove(true)}
                  disabled={working}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {working && <Loader2 className="w-4 h-4 animate-spin" />}
                  Musterdaten entfernen
                </button>
              )}
            </div>
          </div>
          {/* Toggle Switch */}
          <button
            onClick={() => (active ? setConfirmRemove(true) : handleApply())}
            disabled={working}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors ${
              active ? "bg-emerald-600" : "bg-gray-300"
            } disabled:opacity-50`}
            aria-label="Musterdaten aktivieren"
          >
            <span
              className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                active ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Status Overview */}
      {active && status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatusCard
            icon={Briefcase}
            label="Gewerke"
            value={status.counts.tradeCategories}
            color="blue"
          />
          <StatusCard
            icon={CalendarCheck}
            label="Feiertage"
            value={status.counts.holidays}
            color="amber"
          />
          <StatusCard
            icon={FolderKanban}
            label="Projekte"
            value={status.counts.projects}
            color="emerald"
          />
          <StatusCard
            icon={ListTree}
            label="Arbeitspakete"
            value={status.counts.scheduleItems}
            color="violet"
          />
        </div>
      )}

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900">
          <p className="font-medium mb-1">Was wird angelegt?</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            <li>12 Muster-Gewerke (Projektmanagement, DC-Montage, AC-Montage, Tiefbau, …)</li>
            <li>NRW-Feiertage für die Jahre 2025 bis 2027</li>
            <li>
              Muster-PV-Projekt „Nottuln" mit 38 Arbeitspaketen in 4 Bauphasen
              (Detailplanung, Vorarbeiten, DC-Montage, AC-Vorbereitung)
            </li>
          </ul>
          <p className="mt-2 text-xs">
            Muster-Daten sind in der DB mit <code className="bg-amber-100 px-1 rounded">isSample=true</code>{" "}
            markiert. Eigene Daten bleiben unberührt.
          </p>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Musterdaten entfernen?"
        description="Das Muster-Projekt und seine Arbeitspakete werden gelöscht. Muster-Feiertage und -Gewerke werden entfernt, sofern sie nicht in eigenen Projekten verwendet werden."
        confirmLabel="Entfernen"
        destructive
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
