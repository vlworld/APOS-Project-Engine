"use client";

// EmailPreviewModal — zeigt den generierten E-Mail-Muster-Text an, mit
// "In Zwischenablage kopieren" und "Mit E-Mail-Programm oeffnen" (mailto).
// - Escape schliesst, Klick auf Backdrop schliesst, Body-Scroll-Lock.

import { useEffect, useMemo } from "react";
import { X, Copy, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import {
  addWorkdays,
  buildHolidaySet,
  toDateKey,
} from "@/lib/terminplan/workdays";
import type { MeetingDetailDTO } from "@/lib/meetings/types";

interface ApiHoliday {
  id: string;
  date: string; // ISO
  name: string;
}

interface Participant {
  userId: string | null;
  externalName: string | null;
  displayName: string;
}

interface EmailPreviewModalProps {
  open: boolean;
  meeting: MeetingDetailDTO | null;
  projectName: string;
  scribeName: string | null;
  participants: Participant[];
  holidays: ApiHoliday[];
  onClose: () => void;
}

function fmtDateDE(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function computeAcceptanceDate(
  meetingDateIso: string,
  holidays: ApiHoliday[],
): string {
  const base = new Date(meetingDateIso);
  if (isNaN(base.getTime())) return "";
  const holidaySet = buildHolidaySet(
    holidays.map((h) => ({ date: h.date })),
  );
  // addWorkdays zaehlt den Start-Tag nicht mit — genau das wollen wir hier:
  // "heute + 3 Werktage" ab Meeting-Datum
  const target = addWorkdays(base, 3, holidaySet);
  return fmtDateDE(toDateKey(target) + "T00:00:00");
}

function buildSalutation(participants: Participant[]): string {
  if (participants.length === 0) return "{Anrede_Teilnehmer}";
  return participants
    .map((p) => `Herr ${p.displayName}`)
    .join(", ");
}

function buildEmailBody(opts: {
  meetingDate: string;
  title: string;
  projectName: string;
  acceptanceDate: string;
  scribeName: string;
  salutation: string;
}): string {
  const {
    meetingDate,
    title,
    projectName,
    acceptanceDate,
    scribeName,
    salutation,
  } = opts;

  const safe = (v: string, placeholder: string) =>
    v && v.trim().length > 0 ? v : placeholder;

  return (
    `Guten Tag ${safe(salutation, "{Anrede_Teilnehmer}")},\n\n` +
    `anbei das Protokoll der Besprechung vom ${safe(meetingDate, "{Datum}")} zum Thema „${safe(title, "{Thema}")}".\n\n` +
    `Das Protokoll ist dieser E-Mail als PDF beigefuegt und wird\n` +
    `zusaetzlich im Datenraum des Projekts ${safe(projectName, "{Projekt_Name}")} abgelegt.\n\n` +
    `Bitte pruefen Sie das Dokument. Sofern bis zum ${safe(acceptanceDate, "{Akzeptanz_Datum}")}\n` +
    `(3 Werktage) keine Beanstandungen eingehen, gilt das Protokoll\n` +
    `als akzeptiert.\n\n` +
    `Bei Rueckfragen stehe ich gerne zur Verfuegung.\n\n` +
    `Mit freundlichen Gruessen\n` +
    `${safe(scribeName, "{Protokollant_Name}")}`
  );
}

export default function EmailPreviewModal({
  open,
  meeting,
  projectName,
  scribeName,
  participants,
  holidays,
  onClose,
}: EmailPreviewModalProps) {
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const { subject, body } = useMemo(() => {
    if (!meeting) return { subject: "", body: "" };
    const meetingDateFmt = fmtDateDE(meeting.meetingDate);
    const acceptance = computeAcceptanceDate(meeting.meetingDate, holidays);
    const salutation = buildSalutation(participants);
    const subj = `Protokoll vom ${meetingDateFmt} — ${meeting.title}`;
    const b = buildEmailBody({
      meetingDate: meetingDateFmt,
      title: meeting.title,
      projectName,
      acceptanceDate: acceptance,
      scribeName: scribeName ?? "",
      salutation,
    });
    return { subject: subj, body: b };
  }, [meeting, projectName, scribeName, participants, holidays]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(body);
      toast({ title: "In Zwischenablage kopiert", variant: "success" });
    } catch {
      toast({ title: "Kopieren fehlgeschlagen", variant: "error" });
    }
  }

  function mailtoHref() {
    const params = new URLSearchParams();
    params.set("subject", subject);
    params.set("body", body);
    return `mailto:?${params.toString()}`;
  }

  if (!open || !meeting) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              E-Mail-Vorschau
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              Betreff: {subject}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Schliessen"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex-1 overflow-y-auto">
          <textarea
            readOnly
            value={body}
            className="w-full h-80 p-3 text-sm font-mono border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            Platzhalter in geschweiften Klammern <code>{"{...}"}</code>{" "}
            bedeuten, dass ein Wert noch fehlt.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Schliessen
          </button>
          <a
            href={mailtoHref()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700"
          >
            <ExternalLink className="w-4 h-4" /> Mit E-Mail-Programm oeffnen
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
          >
            <Copy className="w-4 h-4" /> In Zwischenablage kopieren
          </button>
        </div>
      </div>
    </div>
  );
}
