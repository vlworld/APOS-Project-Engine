// ─── Service-Layer: Projektsteckbrief ──────────────────────────────────────
// Gemäß CONVENTIONS.md: Logik in lib/<domain>/service.ts, API-Routes halten
// sich dünn. Der Service kapselt Prisma und die JSON-Serialisierung der
// Nächste-Schritte-Checkliste (als Json gespeichert, in TypeScript typisiert).

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type ChecklistItem = {
  id: string;
  text: string;
  verantwortlich: string | null;
  done: boolean;
  doneAt?: string | null;
};

export type ProjectBriefingDTO = {
  id: string;
  projectId: string;

  // Grundinformationen
  akquisiteur: string | null;
  groesseKwp: number | null;
  verantwortlichkeit: string | null;
  prioritaet: string | null;
  richtlinie: string | null;
  anlagentyp: string | null;
  projektbeschreibung: string | null;
  vorhandeneUnterlagen: string | null;

  // Betriebswirtschaftlich
  stakeholder: string | null;
  ansprechpartner: string | null;
  auftragsvolumenEur: number | null;
  bwMeilensteine: string | null;

  // Technisch
  netzgebiet: string | null;
  technischeAnnahmen: string | null;
  monteurplanung: string | null;

  // Projektabwicklung
  herausforderungen: string | null;
  absehbareProbleme: string | null;
  informationsIntervall: string | null;
  ersteTodos: string | null;
  offeneTodosVorStart: string | null;
  erwartungenKunde: string | null;
  ausserordentlicheAbspr: string | null;
  sonstigeAnmerkungen: string | null;

  // Checkliste
  naechsteSchritte: ChecklistItem[];

  // Meta
  version: string;
  uebergebenAm: Date | null;
  uebergebenVonId: string | null;
  uebernommenVonId: string | null;

  createdAt: Date;
  updatedAt: Date;
};

export type UpsertBriefingInput = Partial<
  Omit<ProjectBriefingDTO, "id" | "projectId" | "createdAt" | "updatedAt">
>;

// ─── Intern: Row → DTO ─────────────────────────────────────────────────────

type BriefingRow = Prisma.ProjectBriefingGetPayload<Record<string, never>>;

function parseChecklist(raw: Prisma.JsonValue | null): ChecklistItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  const items: ChecklistItem[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const obj = entry as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : null;
    const text = typeof obj.text === "string" ? obj.text : null;
    if (!id || !text) continue;
    const verantwortlich =
      typeof obj.verantwortlich === "string" && obj.verantwortlich.trim().length > 0
        ? obj.verantwortlich
        : null;
    const done = obj.done === true;
    const doneAt = typeof obj.doneAt === "string" ? obj.doneAt : null;
    items.push({ id, text, verantwortlich, done, doneAt });
  }
  return items;
}

function rowToDto(row: BriefingRow): ProjectBriefingDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    akquisiteur: row.akquisiteur,
    groesseKwp: row.groesseKwp,
    verantwortlichkeit: row.verantwortlichkeit,
    prioritaet: row.prioritaet,
    richtlinie: row.richtlinie,
    anlagentyp: row.anlagentyp,
    projektbeschreibung: row.projektbeschreibung,
    vorhandeneUnterlagen: row.vorhandeneUnterlagen,
    stakeholder: row.stakeholder,
    ansprechpartner: row.ansprechpartner,
    auftragsvolumenEur: row.auftragsvolumenEur,
    bwMeilensteine: row.bwMeilensteine,
    netzgebiet: row.netzgebiet,
    technischeAnnahmen: row.technischeAnnahmen,
    monteurplanung: row.monteurplanung,
    herausforderungen: row.herausforderungen,
    absehbareProbleme: row.absehbareProbleme,
    informationsIntervall: row.informationsIntervall,
    ersteTodos: row.ersteTodos,
    offeneTodosVorStart: row.offeneTodosVorStart,
    erwartungenKunde: row.erwartungenKunde,
    ausserordentlicheAbspr: row.ausserordentlicheAbspr,
    sonstigeAnmerkungen: row.sonstigeAnmerkungen,
    naechsteSchritte: parseChecklist(row.naechsteSchritte),
    version: row.version,
    uebergebenAm: row.uebergebenAm,
    uebergebenVonId: row.uebergebenVonId,
    uebernommenVonId: row.uebernommenVonId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Normalisierung ────────────────────────────────────────────────────────

function normString(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normNumber(v: unknown): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normDate(v: unknown): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (trimmed.length === 0) return null;
    const [y, m, d] = trimmed.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return undefined;
}

function buildUpdateData(input: UpsertBriefingInput): Prisma.ProjectBriefingUpdateInput {
  const data: Prisma.ProjectBriefingUpdateInput = {};

  const stringFields = [
    "akquisiteur",
    "verantwortlichkeit",
    "prioritaet",
    "richtlinie",
    "anlagentyp",
    "projektbeschreibung",
    "vorhandeneUnterlagen",
    "stakeholder",
    "ansprechpartner",
    "bwMeilensteine",
    "netzgebiet",
    "technischeAnnahmen",
    "monteurplanung",
    "herausforderungen",
    "absehbareProbleme",
    "informationsIntervall",
    "ersteTodos",
    "offeneTodosVorStart",
    "erwartungenKunde",
    "ausserordentlicheAbspr",
    "sonstigeAnmerkungen",
    "uebergebenVonId",
    "uebernommenVonId",
  ] as const;

  for (const key of stringFields) {
    if (key in input) {
      const v = normString((input as Record<string, unknown>)[key]);
      if (v !== undefined) {
        (data as Record<string, unknown>)[key] = v;
      }
    }
  }

  if ("groesseKwp" in input) {
    const v = normNumber(input.groesseKwp);
    if (v !== undefined) data.groesseKwp = v;
  }
  if ("auftragsvolumenEur" in input) {
    const v = normNumber(input.auftragsvolumenEur);
    if (v !== undefined) data.auftragsvolumenEur = v;
  }
  if ("uebergebenAm" in input) {
    const v = normDate(input.uebergebenAm);
    if (v !== undefined) data.uebergebenAm = v;
  }
  if ("version" in input) {
    const v = normString(input.version);
    if (v !== undefined && v !== null) data.version = v;
  }
  if ("naechsteSchritte" in input && Array.isArray(input.naechsteSchritte)) {
    data.naechsteSchritte = input.naechsteSchritte as unknown as Prisma.InputJsonValue;
  }

  return data;
}

function buildCreateData(
  projectId: string,
  input: UpsertBriefingInput,
): Prisma.ProjectBriefingUncheckedCreateInput {
  const updateData = buildUpdateData(input);
  const create: Prisma.ProjectBriefingUncheckedCreateInput = {
    projectId,
  };
  // Nur Update-Felder übernehmen, die unchecked create ebenfalls kennt.
  Object.assign(create, updateData);
  return create;
}

// ─── Public API ────────────────────────────────────────────────────────────

export async function getBriefing(projectId: string): Promise<ProjectBriefingDTO | null> {
  const row = await prisma.projectBriefing.findUnique({ where: { projectId } });
  return row ? rowToDto(row) : null;
}

export async function upsertBriefing(
  projectId: string,
  input: UpsertBriefingInput,
): Promise<ProjectBriefingDTO> {
  const row = await prisma.projectBriefing.upsert({
    where: { projectId },
    create: buildCreateData(projectId, input),
    update: buildUpdateData(input),
  });
  return rowToDto(row);
}

function genId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function loadOrCreateChecklist(projectId: string): Promise<ChecklistItem[]> {
  const current = await prisma.projectBriefing.findUnique({
    where: { projectId },
    select: { naechsteSchritte: true },
  });
  if (!current) return [];
  return parseChecklist(current.naechsteSchritte);
}

async function writeChecklist(
  projectId: string,
  items: ChecklistItem[],
): Promise<ProjectBriefingDTO> {
  const jsonValue = items as unknown as Prisma.InputJsonValue;
  const row = await prisma.projectBriefing.upsert({
    where: { projectId },
    create: { projectId, naechsteSchritte: jsonValue },
    update: { naechsteSchritte: jsonValue },
  });
  return rowToDto(row);
}

export async function addChecklistItem(
  projectId: string,
  item: Omit<ChecklistItem, "id">,
): Promise<ProjectBriefingDTO> {
  const items = await loadOrCreateChecklist(projectId);
  const text = typeof item.text === "string" ? item.text.trim() : "";
  if (!text) throw new Error("Text ist erforderlich");
  const verantwortlich =
    typeof item.verantwortlich === "string" && item.verantwortlich.trim().length > 0
      ? item.verantwortlich.trim()
      : null;
  const newItem: ChecklistItem = {
    id: genId(),
    text,
    verantwortlich,
    done: item.done === true,
    doneAt: item.done === true ? new Date().toISOString() : null,
  };
  items.push(newItem);
  return writeChecklist(projectId, items);
}

export async function toggleChecklistItem(
  projectId: string,
  itemId: string,
  done: boolean,
): Promise<ProjectBriefingDTO> {
  const items = await loadOrCreateChecklist(projectId);
  const next = items.map((it) =>
    it.id === itemId
      ? { ...it, done, doneAt: done ? new Date().toISOString() : null }
      : it,
  );
  return writeChecklist(projectId, next);
}

export async function removeChecklistItem(
  projectId: string,
  itemId: string,
): Promise<ProjectBriefingDTO> {
  const items = await loadOrCreateChecklist(projectId);
  const next = items.filter((it) => it.id !== itemId);
  return writeChecklist(projectId, next);
}
