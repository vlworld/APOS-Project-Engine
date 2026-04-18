/**
 * Service-Layer für den Bauzeitenplan (ScheduleItem + ScheduleDependency).
 *
 * Reine Server-Logik. Keine fetch/localStorage/Toast-Calls. Alle Queries sind
 * strikt auf `projectId` gescopt; die Organisations-Prüfung erfolgt durch die
 * aufrufende Route via `requireProjectAccess`.
 *
 * Derived Fields werden im Service berechnet (nicht in der DB gespeichert):
 *   - wbsCode ("1.2.3") aus Parent-Kette + orderIndex (1-basiert gerendert)
 *   - depth (0 = Top-Level)
 *   - hasChildren
 *   - durationWorkdays (Mo-Fr minus Feiertage; Milestone = 0)
 *   - isDelayed (endDate < heute && status !== DONE)
 *
 * Konvention für Datums-Strings: Input "YYYY-MM-DD" (lokales Datum);
 * Output als ISO-String (Prisma liefert DateTime → `.toISOString()`).
 */

import { Prisma, type ScheduleItem, type ScheduleDependency } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildHolidaySetForOrg } from "@/lib/feiertage/service";
import {
  addWorkdays,
  countWorkdays,
  toDateKey,
} from "@/lib/terminplan/workdays";
import { broadcast } from "@/lib/terminplan/realtime";
import type {
  ScheduleItemDTO,
  ScheduleDependencyDTO,
  TradeCategoryDTO,
  CreateScheduleItemInput,
  UpdateScheduleItemInput,
  MoveScheduleItemInput,
  ReorderScheduleItemInput,
  CreateDependencyInput,
  TerminplanResponseDTO,
  ScheduleItemStatus,
  DependencyType,
} from "@/lib/terminplan/types";

// ---------------------------------------------------------------------------
// Date-Helper
// ---------------------------------------------------------------------------

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}/;

/**
 * Parst "YYYY-MM-DD" (oder längeren ISO-String mit diesem Präfix) als lokale
 * Mitternacht. Niemals `new Date(s)` — das interpretiert "YYYY-MM-DD" als UTC
 * und verschiebt am Tagesrand.
 */
function parseDateInput(input: string): Date {
  if (!DATE_KEY_RE.test(input)) {
    throw new Error(`Ungültiges Datumsformat (erwartet YYYY-MM-DD): ${input}`);
  }
  const [y, m, d] = input.slice(0, 10).split("-").map((n) => Number(n));
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31
  ) {
    throw new Error(`Ungültiges Datum: ${input}`);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Heutiger Tag auf lokale Mitternacht. */
function todayAtMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Status- und Typ-Validierung
// ---------------------------------------------------------------------------

function isScheduleItemStatus(s: unknown): s is ScheduleItemStatus {
  return s === "OPEN" || s === "IN_PROGRESS" || s === "DONE";
}

function isDependencyType(s: unknown): s is DependencyType {
  return s === "FS" || s === "SS" || s === "FF";
}

// ---------------------------------------------------------------------------
// DTO-Mapping
// ---------------------------------------------------------------------------

type ScheduleItemRow = ScheduleItem;

type DerivedFields = {
  isDelayed: boolean;
  durationWorkdays: number;
  wbsCode: string;
  depth: number;
  hasChildren: boolean;
};

function toScheduleItemDTO(
  row: ScheduleItemRow,
  derived: DerivedFields,
): ScheduleItemDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    parentId: row.parentId,
    name: row.name,
    description: row.description,
    startDate: row.startDate.toISOString(),
    endDate: row.endDate.toISOString(),
    progress: row.progress,
    status: row.status as ScheduleItemStatus,
    tradeCategoryId: row.tradeCategoryId,
    isMilestone: row.isMilestone,
    color: row.color,
    orderIndex: row.orderIndex,
    assignedToId: row.assignedToId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    isDelayed: derived.isDelayed,
    durationWorkdays: derived.durationWorkdays,
    wbsCode: derived.wbsCode,
    depth: derived.depth,
    hasChildren: derived.hasChildren,
  };
}

function toDependencyDTO(row: ScheduleDependency): ScheduleDependencyDTO {
  return {
    id: row.id,
    fromId: row.fromId,
    toId: row.toId,
    type: row.type as DependencyType,
    lagDays: row.lagDays,
  };
}

// ---------------------------------------------------------------------------
// Derived-Field-Berechnung
// ---------------------------------------------------------------------------

/**
 * Berechnet für alle Items eines Projekts die abgeleiteten Felder (wbsCode,
 * depth, hasChildren, durationWorkdays, isDelayed). Die Berechnung ist
 * reihenfolge-stabil: Geschwister werden nach `orderIndex` (dann `createdAt`)
 * sortiert, damit der wbsCode deterministisch ist.
 */
function computeDerivedFields(
  items: ReadonlyArray<ScheduleItemRow>,
  holidaySet: ReadonlySet<string>,
): Map<string, DerivedFields> {
  const today = todayAtMidnight();

  // Kinder-Indizes pro parentId (null = Top-Level).
  const childrenByParent = new Map<string | null, ScheduleItemRow[]>();
  for (const it of items) {
    const key = it.parentId;
    const list = childrenByParent.get(key) ?? [];
    list.push(it);
    childrenByParent.set(key, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  const hasChildrenSet = new Set<string>();
  for (const [parentId, kids] of childrenByParent.entries()) {
    if (parentId !== null && kids.length > 0) {
      hasChildrenSet.add(parentId);
    }
  }

  // WBS-Code + depth rekursiv vom Top-Level-Ebene herunter.
  const wbsByItem = new Map<string, string>();
  const depthByItem = new Map<string, number>();

  const walk = (parentId: string | null, prefix: string, depth: number): void => {
    const kids = childrenByParent.get(parentId) ?? [];
    kids.forEach((kid, idx) => {
      const code = prefix === "" ? String(idx + 1) : `${prefix}.${idx + 1}`;
      wbsByItem.set(kid.id, code);
      depthByItem.set(kid.id, depth);
      walk(kid.id, code, depth + 1);
    });
  };
  walk(null, "", 0);

  // Fallback für Items ohne ermittelten wbsCode (Schutz gegen verwaiste
  // parentId-Referenzen, die nicht in `items` enthalten sind).
  const result = new Map<string, DerivedFields>();
  for (const it of items) {
    const duration = it.isMilestone
      ? 0
      : countWorkdays(it.startDate, it.endDate, holidaySet);

    const endMid = new Date(
      it.endDate.getFullYear(),
      it.endDate.getMonth(),
      it.endDate.getDate(),
      0, 0, 0, 0,
    );
    const isDelayed = endMid.getTime() < today.getTime() && it.status !== "DONE";

    result.set(it.id, {
      isDelayed,
      durationWorkdays: duration,
      wbsCode: wbsByItem.get(it.id) ?? "?",
      depth: depthByItem.get(it.id) ?? 0,
      hasChildren: hasChildrenSet.has(it.id),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Load-Terminplan
// ---------------------------------------------------------------------------

/**
 * Lädt alle ScheduleItems + Dependencies + TradeCategories für ein Projekt.
 * Organizations-Scope: TradeCategories werden aus `organizationId` geladen,
 * Items/Deps strikt aus `projectId`. Der Caller stellt sicher, dass das
 * Projekt zur Organisation gehört (via `requireProjectAccess`).
 */
export async function loadTerminplan(
  projectId: string,
  organizationId: string,
): Promise<TerminplanResponseDTO> {
  const [items, deps, tradeCategories, project, holidaySet] = await Promise.all([
    prisma.scheduleItem.findMany({
      where: { projectId },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
    }),
    prisma.scheduleDependency.findMany({
      where: {
        OR: [
          { from: { projectId } },
          { to: { projectId } },
        ],
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tradeCategory.findMany({
      where: { organizationId },
      orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
    }),
    prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { startDate: true, endDate: true },
    }),
    buildHolidaySetForOrg(organizationId),
  ]);

  const derived = computeDerivedFields(items, holidaySet);
  const itemDTOs: ScheduleItemDTO[] = items.map((it) => {
    const d = derived.get(it.id);
    if (!d) {
      // Defensive: sollte nie passieren, da computeDerivedFields ALLE Items abdeckt.
      return toScheduleItemDTO(it, {
        isDelayed: false,
        durationWorkdays: 0,
        wbsCode: "?",
        depth: 0,
        hasChildren: false,
      });
    }
    return toScheduleItemDTO(it, d);
  });

  // Projekt-Start/-Ende: bevorzugt aus Project-Entity, sonst aus Items.
  let projectStart: Date | null = project?.startDate ?? null;
  let projectEnd: Date | null = project?.endDate ?? null;
  if (projectStart === null || projectEnd === null) {
    for (const it of items) {
      if (projectStart === null || it.startDate.getTime() < projectStart.getTime()) {
        projectStart = it.startDate;
      }
      if (projectEnd === null || it.endDate.getTime() > projectEnd.getTime()) {
        projectEnd = it.endDate;
      }
    }
  }
  if (projectStart === null) projectStart = todayAtMidnight();
  if (projectEnd === null) projectEnd = projectStart;

  const tradeCategoryDTOs: TradeCategoryDTO[] = tradeCategories.map((tc) => ({
    id: tc.id,
    name: tc.name,
    color: tc.color,
    orderIndex: tc.orderIndex,
    isSample: tc.isSample,
  }));

  return {
    items: itemDTOs,
    dependencies: deps.map(toDependencyDTO),
    tradeCategories: tradeCategoryDTOs,
    projectStart: projectStart.toISOString(),
    projectEnd: projectEnd.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Single-Item-Helper (intern) — mit Derived-Feldern hydrieren
// ---------------------------------------------------------------------------

async function hydrateItem(
  projectId: string,
  organizationId: string,
  itemId: string,
): Promise<ScheduleItemDTO | null> {
  const items = await prisma.scheduleItem.findMany({
    where: { projectId },
    orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
  });
  const target = items.find((i) => i.id === itemId);
  if (!target) return null;
  const holidaySet = await buildHolidaySetForOrg(organizationId);
  const derived = computeDerivedFields(items, holidaySet);
  const d = derived.get(itemId);
  if (!d) return null;
  return toScheduleItemDTO(target, d);
}

// ---------------------------------------------------------------------------
// Create / Update / Delete
// ---------------------------------------------------------------------------

function validateProgress(p: number | undefined): number | undefined {
  if (p === undefined) return undefined;
  if (!Number.isFinite(p)) throw new Error("Fortschritt muss eine Zahl sein");
  if (p < 0 || p > 100) throw new Error("Fortschritt muss zwischen 0 und 100 liegen");
  return Math.round(p);
}

function validateDates(startInput: string, endInput: string): { start: Date; end: Date } {
  const start = parseDateInput(startInput);
  const end = parseDateInput(endInput);
  if (end.getTime() < start.getTime()) {
    throw new Error("Enddatum darf nicht vor dem Startdatum liegen");
  }
  return { start, end };
}

export async function createScheduleItem(
  projectId: string,
  input: CreateScheduleItemInput,
): Promise<ScheduleItemDTO> {
  const name = input.name?.trim();
  if (!name) throw new Error("Name darf nicht leer sein");

  const { start, end } = validateDates(input.startDate, input.endDate);

  const status: ScheduleItemStatus = isScheduleItemStatus(input.status)
    ? input.status
    : "OPEN";

  const progress = validateProgress(input.progress) ?? 0;

  // Parent-Check: wenn gesetzt, muss parent im selben Projekt liegen.
  if (input.parentId) {
    const parent = await prisma.scheduleItem.findFirst({
      where: { id: input.parentId, projectId },
      select: { id: true },
    });
    if (!parent) {
      throw new Error("Parent-Item nicht gefunden oder gehört nicht zum Projekt");
    }
  }

  // TradeCategory-Check (nur bei gesetzter ID).
  if (input.tradeCategoryId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Projekt nicht gefunden");
    const tc = await prisma.tradeCategory.findFirst({
      where: { id: input.tradeCategoryId, organizationId: project.organizationId },
      select: { id: true },
    });
    if (!tc) {
      throw new Error("Gewerk nicht gefunden oder gehört nicht zur Organisation");
    }
  }

  // orderIndex: wenn nicht gesetzt, ans Ende der Geschwister-Liste.
  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const lastOrder = await prisma.scheduleItem.aggregate({
      where: { projectId, parentId: input.parentId ?? null },
      _max: { orderIndex: true },
    });
    orderIndex = (lastOrder._max.orderIndex ?? -1) + 1;
  }

  const created = await prisma.scheduleItem.create({
    data: {
      projectId,
      parentId: input.parentId ?? null,
      name,
      description: input.description?.trim() || null,
      startDate: start,
      endDate: end,
      progress,
      status,
      tradeCategoryId: input.tradeCategoryId ?? null,
      isMilestone: input.isMilestone ?? false,
      color: input.color ?? null,
      orderIndex,
      assignedToId: input.assignedToId ?? null,
    },
  });

  // Für DTO-Derived-Felder brauchen wir die Geschwister-Struktur + Holidays.
  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) throw new Error("Projekt nicht gefunden");

  const hydrated = await hydrateItem(projectId, project.organizationId, created.id);
  if (!hydrated) {
    // Extrem defensiv — gerade gespeicherte ID muss in der Liste sein.
    throw new Error("Item konnte nach dem Erstellen nicht geladen werden");
  }
  broadcast(projectId, { type: "item.created", payload: hydrated });
  return hydrated;
}

export async function updateScheduleItem(
  projectId: string,
  itemId: string,
  input: UpdateScheduleItemInput,
): Promise<ScheduleItemDTO | null> {
  const existing = await prisma.scheduleItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!existing) return null;

  const data: Prisma.ScheduleItemUpdateInput = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("Name darf nicht leer sein");
    data.name = trimmed;
  }

  if (input.description !== undefined) {
    data.description = input.description?.trim() || null;
  }

  // Dates: wenn mind. ein Date angegeben ist, gegen den jeweils anderen
  // (neuen oder bestehenden) prüfen.
  if (input.startDate !== undefined || input.endDate !== undefined) {
    const start = input.startDate !== undefined
      ? parseDateInput(input.startDate)
      : existing.startDate;
    const end = input.endDate !== undefined
      ? parseDateInput(input.endDate)
      : existing.endDate;
    if (end.getTime() < start.getTime()) {
      throw new Error("Enddatum darf nicht vor dem Startdatum liegen");
    }
    if (input.startDate !== undefined) data.startDate = start;
    if (input.endDate !== undefined) data.endDate = end;
  }

  if (input.progress !== undefined) {
    const p = validateProgress(input.progress);
    if (p !== undefined) data.progress = p;
  }

  if (input.status !== undefined) {
    if (!isScheduleItemStatus(input.status)) {
      throw new Error("Ungültiger Status");
    }
    data.status = input.status;
  }

  if (input.tradeCategoryId !== undefined) {
    if (input.tradeCategoryId === null) {
      data.tradeCategory = { disconnect: true };
    } else {
      const project = await prisma.project.findFirst({
        where: { id: projectId },
        select: { organizationId: true },
      });
      if (!project) throw new Error("Projekt nicht gefunden");
      const tc = await prisma.tradeCategory.findFirst({
        where: { id: input.tradeCategoryId, organizationId: project.organizationId },
        select: { id: true },
      });
      if (!tc) {
        throw new Error("Gewerk nicht gefunden oder gehört nicht zur Organisation");
      }
      data.tradeCategory = { connect: { id: input.tradeCategoryId } };
    }
  }

  if (input.isMilestone !== undefined) data.isMilestone = input.isMilestone;
  if (input.color !== undefined) data.color = input.color;
  if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;

  if (input.assignedToId !== undefined) {
    data.assignedToId = input.assignedToId;
  }

  if (input.parentId !== undefined) {
    if (input.parentId === null) {
      data.parent = { disconnect: true };
    } else {
      if (input.parentId === itemId) {
        throw new Error("Item kann nicht sein eigener Parent sein");
      }
      const parent = await prisma.scheduleItem.findFirst({
        where: { id: input.parentId, projectId },
        select: { id: true },
      });
      if (!parent) {
        throw new Error("Parent-Item nicht gefunden oder gehört nicht zum Projekt");
      }
      // Zyklus-Schutz: neuer Parent darf kein Nachkomme des Items sein.
      const allItems = await prisma.scheduleItem.findMany({
        where: { projectId },
        select: { id: true, parentId: true },
      });
      if (isDescendant(allItems, input.parentId, itemId)) {
        throw new Error("Zirkuläre Hierarchie erkannt");
      }
      data.parent = { connect: { id: input.parentId } };
    }
  }

  await prisma.scheduleItem.update({
    where: { id: itemId },
    data,
  });

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) return null;

  const hydrated = await hydrateItem(projectId, project.organizationId, itemId);
  if (hydrated) broadcast(projectId, { type: "item.updated", payload: hydrated });
  return hydrated;
}

/** Prüft, ob `candidate` (neuer Parent) ein Nachkomme von `rootId` (aktuellem Item) ist. */
function isDescendant(
  items: ReadonlyArray<{ id: string; parentId: string | null }>,
  candidate: string,
  rootId: string,
): boolean {
  // Traversiere Elternkette von `candidate` nach oben. Wenn wir auf `rootId`
  // stoßen, wäre candidate ein Nachkomme von rootId → Zyklus.
  const byId = new Map(items.map((it) => [it.id, it.parentId]));
  let cursor: string | null | undefined = candidate;
  const visited = new Set<string>();
  while (cursor !== null && cursor !== undefined) {
    if (cursor === rootId) return true;
    if (visited.has(cursor)) return false; // bestehender Zyklus — brechen.
    visited.add(cursor);
    cursor = byId.get(cursor) ?? null;
  }
  return false;
}

export async function deleteScheduleItem(
  projectId: string,
  itemId: string,
): Promise<boolean> {
  const result = await prisma.scheduleItem.deleteMany({
    where: { id: itemId, projectId },
  });
  if (result.count > 0) {
    broadcast(projectId, { type: "item.deleted", payload: { id: itemId } });
  }
  return result.count > 0;
}

// ---------------------------------------------------------------------------
// Move (inkl. Cascade)
// ---------------------------------------------------------------------------

type InternalItem = {
  id: string;
  startDate: Date;
  endDate: Date;
};

/**
 * Verschiebt ein Item um N Arbeitstage. Bei cascade=true werden alle über
 * Dependencies verbundenen Nachfolger entsprechend mitgezogen.
 *
 * Semantik der Dep-Typen (bei Cascade):
 *   FS: succ.startDate = addWorkdays(pred.endDate, 1 + lagDays)
 *   SS: succ.startDate = addWorkdays(pred.startDate, lagDays)
 *   FF: succ.endDate   = addWorkdays(pred.endDate, lagDays)
 *
 * Die ursprüngliche relative Dauer eines Nachfolgers (endDate - startDate in
 * Arbeitstagen) bleibt erhalten — wir rechnen die fehlende Seite mit
 * `addWorkdays` um die Duration-1 neu aus.
 *
 * Konflikte: Wenn ein Successor einen ANDEREN Predecessor hätte, der nicht
 * mitgezogen wird und dessen Constraint durch die Verschiebung verletzt wäre
 * (neues startDate wäre zu früh relativ zum nicht-bewegten Predecessor),
 * wird ein Conflict-Eintrag gesetzt. Die Verschiebung selbst wird trotzdem
 * durchgeführt.
 */
export async function moveScheduleItem(
  projectId: string,
  organizationId: string,
  itemId: string,
  input: MoveScheduleItemInput,
): Promise<{ movedIds: string[]; conflicts: Array<{ id: string; reason: string }> }> {
  const delta = Math.trunc(input.deltaWorkdays);
  if (!Number.isFinite(delta)) {
    throw new Error("deltaWorkdays muss eine Zahl sein");
  }
  const cascade = input.cascade ?? false;

  const [root, allItems, allDeps, holidaySet] = await Promise.all([
    prisma.scheduleItem.findFirst({ where: { id: itemId, projectId } }),
    prisma.scheduleItem.findMany({ where: { projectId } }),
    prisma.scheduleDependency.findMany({
      where: {
        OR: [
          { from: { projectId } },
          { to: { projectId } },
        ],
      },
    }),
    buildHolidaySetForOrg(organizationId),
  ]);

  if (!root) {
    throw new Error("Item nicht gefunden");
  }

  // Working-Copy der Items, by id.
  const working = new Map<string, InternalItem>();
  for (const it of allItems) {
    working.set(it.id, {
      id: it.id,
      startDate: new Date(
        it.startDate.getFullYear(),
        it.startDate.getMonth(),
        it.startDate.getDate(),
        0, 0, 0, 0,
      ),
      endDate: new Date(
        it.endDate.getFullYear(),
        it.endDate.getMonth(),
        it.endDate.getDate(),
        0, 0, 0, 0,
      ),
    });
  }

  // Dependency-Gruppen nach fromId (für Successor-Lookup) und toId (für
  // Predecessor-Lookup bei Konflikt-Erkennung).
  const outgoing = new Map<string, ScheduleDependency[]>();
  const incoming = new Map<string, ScheduleDependency[]>();
  for (const d of allDeps) {
    const out = outgoing.get(d.fromId) ?? [];
    out.push(d);
    outgoing.set(d.fromId, out);
    const inc = incoming.get(d.toId) ?? [];
    inc.push(d);
    incoming.set(d.toId, inc);
  }

  const movedIds = new Set<string>();
  const conflicts: Array<{ id: string; reason: string }> = [];

  /** Verschiebt ein Item um `delta` Arbeitstage (in-place auf working). */
  const shiftBy = (id: string, d: number): void => {
    const it = working.get(id);
    if (!it) return;
    if (d === 0) {
      movedIds.add(id);
      return;
    }
    it.startDate = addWorkdays(it.startDate, d, holidaySet);
    it.endDate = addWorkdays(it.endDate, d, holidaySet);
    movedIds.add(id);
  };

  /** Duration eines Items in Arbeitstagen (>= 1 bei gültigen Dates). */
  const duration = (it: InternalItem): number => {
    return countWorkdays(it.startDate, it.endDate, holidaySet);
  };

  // Root direkt verschieben.
  shiftBy(itemId, delta);

  if (cascade) {
    // BFS über ausgehende Dependencies. Ein Nachfolger wird neu positioniert
    // gemäß Dep-Typ; seine ursprüngliche Dauer bleibt erhalten.
    const queue: string[] = [itemId];
    const inQueue = new Set<string>(queue);

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (currentId === undefined) break;
      inQueue.delete(currentId);

      const current = working.get(currentId);
      if (!current) continue;

      const outs = outgoing.get(currentId) ?? [];
      for (const dep of outs) {
        const succ = working.get(dep.toId);
        if (!succ) continue;

        const succDur = duration(succ);
        const depType = (dep.type as DependencyType) ?? "FS";
        const lag = dep.lagDays;

        let newStart: Date = succ.startDate;
        let newEnd: Date = succ.endDate;

        if (depType === "FS") {
          // Nachfolger startet `1 + lag` Arbeitstage NACH dem Vorgänger-Ende.
          newStart = addWorkdays(current.endDate, 1 + lag, holidaySet);
          newEnd = succDur <= 0
            ? new Date(newStart.getTime())
            : addWorkdays(newStart, succDur - 1, holidaySet);
        } else if (depType === "SS") {
          newStart = addWorkdays(current.startDate, lag, holidaySet);
          newEnd = succDur <= 0
            ? new Date(newStart.getTime())
            : addWorkdays(newStart, succDur - 1, holidaySet);
        } else {
          // FF: Nachfolger-Ende = Vorgänger-Ende + lag; Start zurückrechnen.
          newEnd = addWorkdays(current.endDate, lag, holidaySet);
          newStart = succDur <= 0
            ? new Date(newEnd.getTime())
            : addWorkdays(newEnd, -(succDur - 1), holidaySet);
        }

        // Konflikt-Check: hat der Nachfolger noch ANDERE Predecessors, die
        // nicht (mit)verschoben werden, und wird deren Constraint verletzt?
        const incs = incoming.get(dep.toId) ?? [];
        for (const otherInc of incs) {
          if (otherInc.id === dep.id) continue;
          const otherPred = working.get(otherInc.fromId);
          if (!otherPred) continue;
          if (movedIds.has(otherPred.id)) continue; // wird/wurde mitgezogen

          const otherType = (otherInc.type as DependencyType) ?? "FS";
          const otherLag = otherInc.lagDays;

          let minStart: Date | null = null;
          let requiredEnd: Date | null = null;
          if (otherType === "FS") {
            minStart = addWorkdays(otherPred.endDate, 1 + otherLag, holidaySet);
          } else if (otherType === "SS") {
            minStart = addWorkdays(otherPred.startDate, otherLag, holidaySet);
          } else {
            requiredEnd = addWorkdays(otherPred.endDate, otherLag, holidaySet);
          }

          if (minStart && newStart.getTime() < minStart.getTime()) {
            conflicts.push({
              id: succ.id,
              reason: `Verletzt ${otherType}-Constraint zu ${otherPred.id} (Lag ${otherLag}); erforderlicher Start ${toDateKey(minStart)}`,
            });
          }
          if (requiredEnd && newEnd.getTime() < requiredEnd.getTime()) {
            conflicts.push({
              id: succ.id,
              reason: `Verletzt FF-Constraint zu ${otherPred.id} (Lag ${otherLag}); erforderliches Ende ${toDateKey(requiredEnd)}`,
            });
          }
        }

        const changed =
          succ.startDate.getTime() !== newStart.getTime() ||
          succ.endDate.getTime() !== newEnd.getTime();

        succ.startDate = newStart;
        succ.endDate = newEnd;
        movedIds.add(succ.id);

        if (changed && !inQueue.has(succ.id)) {
          queue.push(succ.id);
          inQueue.add(succ.id);
        }
      }
    }
  }

  // Jetzt persistieren: alle Items, deren Dates sich geändert haben.
  const toPersist: InternalItem[] = [];
  for (const id of movedIds) {
    const updated = working.get(id);
    const original = allItems.find((a) => a.id === id);
    if (!updated || !original) continue;
    const startChanged = updated.startDate.getTime() !== new Date(
      original.startDate.getFullYear(),
      original.startDate.getMonth(),
      original.startDate.getDate(),
      0, 0, 0, 0,
    ).getTime();
    const endChanged = updated.endDate.getTime() !== new Date(
      original.endDate.getFullYear(),
      original.endDate.getMonth(),
      original.endDate.getDate(),
      0, 0, 0, 0,
    ).getTime();
    if (startChanged || endChanged) {
      toPersist.push(updated);
    }
  }

  if (toPersist.length > 0) {
    await prisma.$transaction(
      toPersist.map((it) =>
        prisma.scheduleItem.update({
          where: { id: it.id },
          data: { startDate: it.startDate, endDate: it.endDate },
        }),
      ),
    );
    broadcast(projectId, {
      type: "item.moved",
      payload: { ids: toPersist.map((i) => i.id) },
    });
  }

  return {
    movedIds: toPersist.map((i) => i.id),
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// Reorder (Parent/OrderIndex)
// ---------------------------------------------------------------------------

/**
 * Ändert parentId und orderIndex eines Items. Reindexiert die Geschwister
 * (alter und ggf. neuer Parent) lückenlos ab 0.
 */
export async function reorderScheduleItem(
  projectId: string,
  input: ReorderScheduleItemInput,
): Promise<ScheduleItemDTO> {
  const { itemId, newParentId, newOrderIndex } = input;
  if (typeof itemId !== "string" || !itemId) {
    throw new Error("itemId ist erforderlich");
  }
  if (!Number.isFinite(newOrderIndex) || newOrderIndex < 0) {
    throw new Error("newOrderIndex muss >= 0 sein");
  }
  if (newParentId === itemId) {
    throw new Error("Item kann nicht sein eigener Parent sein");
  }

  const existing = await prisma.scheduleItem.findFirst({
    where: { id: itemId, projectId },
  });
  if (!existing) throw new Error("Item nicht gefunden");

  if (newParentId) {
    const parent = await prisma.scheduleItem.findFirst({
      where: { id: newParentId, projectId },
      select: { id: true },
    });
    if (!parent) {
      throw new Error("Parent-Item nicht gefunden oder gehört nicht zum Projekt");
    }
    const allItems = await prisma.scheduleItem.findMany({
      where: { projectId },
      select: { id: true, parentId: true },
    });
    if (isDescendant(allItems, newParentId, itemId)) {
      throw new Error("Zirkuläre Hierarchie erkannt");
    }
  }

  const oldParentId = existing.parentId;
  const sameParent = oldParentId === (newParentId ?? null);

  // Transaktion: Item updaten + Geschwister reindexieren.
  await prisma.$transaction(async (tx) => {
    // 1) Item in Zielposition setzen (parentId + orderIndex). Wir setzen
    //    orderIndex temporär auf einen hohen Wert, um Kollisionen zu
    //    vermeiden — Reindex vergibt gleich darunter.
    await tx.scheduleItem.update({
      where: { id: itemId },
      data: {
        parentId: newParentId ?? null,
        orderIndex: 1_000_000,
      },
    });

    // 2) Alten Parent reindexieren (ohne das Item).
    if (!sameParent) {
      const oldSiblings = await tx.scheduleItem.findMany({
        where: { projectId, parentId: oldParentId, NOT: { id: itemId } },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      for (let i = 0; i < oldSiblings.length; i++) {
        const sib = oldSiblings[i];
        if (!sib) continue;
        await tx.scheduleItem.update({
          where: { id: sib.id },
          data: { orderIndex: i },
        });
      }
    }

    // 3) Neuen Parent reindexieren: Item an newOrderIndex einfügen.
    const newSiblings = await tx.scheduleItem.findMany({
      where: { projectId, parentId: newParentId ?? null, NOT: { id: itemId } },
      orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });

    const targetIndex = Math.min(newOrderIndex, newSiblings.length);
    const orderedIds: string[] = [];
    for (let i = 0; i < targetIndex; i++) {
      const s = newSiblings[i];
      if (s) orderedIds.push(s.id);
    }
    orderedIds.push(itemId);
    for (let i = targetIndex; i < newSiblings.length; i++) {
      const s = newSiblings[i];
      if (s) orderedIds.push(s.id);
    }

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (!id) continue;
      await tx.scheduleItem.update({
        where: { id },
        data: { orderIndex: i },
      });
    }
  });

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (!project) throw new Error("Projekt nicht gefunden");

  const hydrated = await hydrateItem(projectId, project.organizationId, itemId);
  if (!hydrated) {
    throw new Error("Item konnte nach dem Reorder nicht geladen werden");
  }
  broadcast(projectId, { type: "refetch", payload: null });
  return hydrated;
}

// ---------------------------------------------------------------------------
// Dependencies: Create / List / Delete
// ---------------------------------------------------------------------------

/**
 * Erzeugt eine neue Dependency (FS/SS/FF mit lagDays). Prüft:
 *   - fromId/toId gehören zum selben Projekt
 *   - from != to
 *   - keine zirkuläre Abhängigkeit (DFS)
 */
export async function createDependency(
  projectId: string,
  input: CreateDependencyInput,
): Promise<ScheduleDependencyDTO> {
  const { fromId, toId } = input;
  if (!fromId || !toId) throw new Error("fromId und toId sind erforderlich");
  if (fromId === toId) {
    throw new Error("Ein Item kann nicht von sich selbst abhängen");
  }

  const type: DependencyType = isDependencyType(input.type) ? input.type : "FS";
  const lag = Number.isFinite(input.lagDays) ? Math.trunc(input.lagDays as number) : 0;

  const [from, to] = await Promise.all([
    prisma.scheduleItem.findFirst({ where: { id: fromId, projectId }, select: { id: true } }),
    prisma.scheduleItem.findFirst({ where: { id: toId, projectId }, select: { id: true } }),
  ]);
  if (!from || !to) {
    throw new Error("fromId und toId müssen im selben Projekt existieren");
  }

  // Zyklen-Check: gibt es bereits einen Pfad von toId zurück zu fromId?
  const existingDeps = await prisma.scheduleDependency.findMany({
    where: {
      OR: [
        { from: { projectId } },
        { to: { projectId } },
      ],
    },
    select: { fromId: true, toId: true },
  });
  if (wouldCreateCycle(existingDeps, fromId, toId)) {
    throw new Error("Zirkuläre Abhängigkeit");
  }

  try {
    const created = await prisma.scheduleDependency.create({
      data: { fromId, toId, type, lagDays: lag },
    });
    const dto = toDependencyDTO(created);
    broadcast(projectId, { type: "dep.created", payload: dto });
    return dto;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("Abhängigkeit existiert bereits");
    }
    throw err;
  }
}

/**
 * DFS-Zyklenprüfung: würde eine Dep fromId→toId einen Kreis schließen?
 * Check: existiert ein Pfad von toId zurück zu fromId in den bestehenden
 * Deps? Falls ja, würde die neue Kante toId→(…)→fromId→toId einen Zyklus
 * bilden.
 */
function wouldCreateCycle(
  existing: ReadonlyArray<{ fromId: string; toId: string }>,
  newFromId: string,
  newToId: string,
): boolean {
  // Adjacency-Liste: fromId → [toId]
  const adj = new Map<string, string[]>();
  for (const d of existing) {
    const list = adj.get(d.fromId) ?? [];
    list.push(d.toId);
    adj.set(d.fromId, list);
  }

  // DFS ab newToId; erreicht er newFromId, ist ein Zyklus garantiert.
  const stack: string[] = [newToId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) break;
    if (node === newFromId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    const nexts = adj.get(node) ?? [];
    for (const n of nexts) stack.push(n);
  }
  return false;
}

export async function listDependencies(
  projectId: string,
): Promise<ScheduleDependencyDTO[]> {
  const rows = await prisma.scheduleDependency.findMany({
    where: {
      OR: [
        { from: { projectId } },
        { to: { projectId } },
      ],
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toDependencyDTO);
}

export async function deleteDependency(
  projectId: string,
  depId: string,
): Promise<boolean> {
  // Scope über die relationale Verbindung: Dep muss zu einem Item im Projekt
  // gehören. `deleteMany` mit relation-Filter ist die sauberste Form.
  const result = await prisma.scheduleDependency.deleteMany({
    where: {
      id: depId,
      from: { projectId },
    },
  });
  if (result.count > 0) {
    broadcast(projectId, { type: "dep.deleted", payload: { id: depId } });
  }
  return result.count > 0;
}
