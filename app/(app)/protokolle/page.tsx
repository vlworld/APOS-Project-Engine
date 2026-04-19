"use client";

// Globale Protokoll-Listen-Seite analog /vob:
// - Projekt-Selector oben (useSelectedProject)
// - Liste der Protokolle des gewaehlten Projekts als Tabelle
// - "+ Neues Protokoll" oben rechts -> oeffnet ProtokollCreateModal
// - Klick auf Zeile -> /protokolle/[meetingId]

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  NotebookPen,
  Loader2,
  FolderKanban,
  ChevronRight,
  Users,
  ListChecks,
  GitBranch,
} from "lucide-react";
import { useSelectedProject } from "@/lib/hooks/useSelectedProject";
import type { MeetingSummaryDTO } from "@/lib/meetings/types";
import ProtokollCreateModal from "@/components/meetings/ProtokollCreateModal";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ProtokolleListPage() {
  const {
    selectedId: selectedProjectId,
    setSelectedId: setSelectedProjectId,
    projects,
  } = useSelectedProject();

  const [meetings, setMeetings] = useState<MeetingSummaryDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchMeetings = useCallback(async () => {
    if (!selectedProjectId) {
      setMeetings([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projekte/${selectedProjectId}/protokolle`,
      );
      if (res.ok) {
        const data = (await res.json()) as { meetings: MeetingSummaryDTO[] };
        setMeetings(data.meetings);
      } else {
        setMeetings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <NotebookPen className="w-5 h-5 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Protokolle</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
          >
            <option value="">Projekt waehlen...</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} — {p.name}
              </option>
            ))}
          </select>
          {selectedProjectId && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Neues Protokoll
            </button>
          )}
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <FolderKanban className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Bitte waehlen Sie ein Projekt</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : meetings.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <NotebookPen className="w-12 h-12 text-gray-300 mx-auto mb-4 opacity-60" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Noch keine Protokolle
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Lege das erste Protokoll fuer dieses Projekt an.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Erstes Protokoll anlegen
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Datum
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  Thema
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Teilnehmer
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="w-3.5 h-3.5" /> Punkte
                  </span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5" /> Rev.
                  </span>
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-gray-50 hover:bg-gray-50/50 cursor-pointer"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/protokolle/${m.id}`}
                      className="block text-gray-700"
                    >
                      {fmtDate(m.meetingDate)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/protokolle/${m.id}`}
                      className="block font-medium text-gray-900 hover:text-emerald-700"
                    >
                      {m.title}
                    </Link>
                    {m.location && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.location}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {m.participantCount}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.itemCount}</td>
                  <td className="px-4 py-3 text-gray-600">
                    Rev. {m.revisionNumber}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/protokolle/${m.id}`}
                      className="inline-flex text-gray-400 hover:text-gray-700"
                      aria-label="Oeffnen"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {selectedProjectId && (
        <ProtokollCreateModal
          open={showCreateModal}
          projectId={selectedProjectId}
          onClose={() => {
            setShowCreateModal(false);
            // nach Anlage wird ohnehin weitergeleitet; falls abgebrochen: refresh
            void fetchMeetings();
          }}
        />
      )}
    </div>
  );
}
