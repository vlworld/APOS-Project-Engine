/**
 * Critical-Path-Method (CPM) fuer den Bauzeitenplan.
 *
 * Reiner Algorithmus: keine Prisma-Imports, keine I/O, keine Seiteneffekte.
 * Rechnet in Arbeitstagen (Mo-Fr minus Feiertage) ueber `workdays.ts`.
 *
 * Eingabe: ScheduleItems mit Start/Ende + ScheduleDependencies (FS/SS/FF
 * mit lagDays). Ausgabe: Map<itemId, CpmResult> mit ES/EF/LS/LF, Slack
 * und Flag `onCriticalPath`.
 *
 * Konventionen:
 *   - Dauer eines Items = countWorkdays(start, end) (inkl. beider Endpunkte).
 *     Milestones haben duration 0.
 *   - EF = addWorkdays(ES, duration - 1), d. h. beide Endpunkte zaehlen.
 *     Fuer duration = 0 (Milestone) gilt EF = ES.
 *   - Slack in Arbeitstagen, 0 => kritischer Pfad.
 *   - Fehlt eine referenzierte Item-ID in `items`, wird die Dep ignoriert.
 *   - Zirkulaere Abhaengigkeiten werfen Error.
 */

import { countWorkdays, addWorkdays, toDateKey, fromDateKey } from "./workdays";

// ---------------------------------------------------------------------------
// Oeffentliche Typen
// ---------------------------------------------------------------------------

export type CpmDependencyType = "FS" | "SS" | "FF";

export type CpmInputItem = {
  id: string;
  startDate: Date;
  endDate: Date;
  isMilestone: boolean;
};

export type CpmInputDep = {
  fromId: string;
  toId: string;
  type: CpmDependencyType;
  lagDays: number;
};

export type CpmResult = {
  itemId: string;
  earliestStart: Date;
  earliestFinish: Date;
  latestStart: Date;
  latestFinish: Date;
  slackDays: number;
  onCriticalPath: boolean;
};

// ---------------------------------------------------------------------------
// Interne Hilfsstrukturen
// ---------------------------------------------------------------------------

type WorkingState = {
  id: string;
  duration: number; // Arbeitstage, Milestones = 0
  initialStart: Date; // geplanter Start (fuer Items ohne Vorgaenger)
  es: Date;
  ef: Date;
  ls: Date;
  lf: Date;
};

/**
 * Dauer eines Items in Arbeitstagen. Milestones per Definition 0.
 * Normale Items: countWorkdays(start, end) inkl. beider Endpunkte.
 */
function computeDuration(
  item: CpmInputItem,
  holidays: ReadonlySet<string>,
): number {
  if (item.isMilestone) return 0;
  return countWorkdays(item.startDate, item.endDate, holidays);
}

/**
 * EF aus ES + Dauer. Bei duration <= 0 (Milestone) gilt EF = ES.
 * Sonst EF = ES + (duration - 1) Arbeitstage (beide Endpunkte zaehlen mit).
 */
function finishFromStart(
  es: Date,
  duration: number,
  holidays: ReadonlySet<string>,
): Date {
  if (duration <= 0) return new Date(es.getTime());
  return addWorkdays(es, duration - 1, holidays);
}

/**
 * LS aus LF - Dauer. Umkehrung von finishFromStart.
 */
function startFromFinish(
  lf: Date,
  duration: number,
  holidays: ReadonlySet<string>,
): Date {
  if (duration <= 0) return new Date(lf.getTime());
  return addWorkdays(lf, -(duration - 1), holidays);
}

/**
 * Stabile Sortierung von Deps: erst fromId, dann toId, dann Typ. Macht die
 * gesamte Pipeline deterministisch, unabhaengig von der Aufrufer-Reihenfolge.
 */
function sortedDeps(deps: ReadonlyArray<CpmInputDep>): CpmInputDep[] {
  return [...deps].sort((a, b) => {
    if (a.fromId !== b.fromId) return a.fromId < b.fromId ? -1 : 1;
    if (a.toId !== b.toId) return a.toId < b.toId ? -1 : 1;
    if (a.type !== b.type) return a.type < b.type ? -1 : 1;
    return a.lagDays - b.lagDays;
  });
}

/**
 * Topologische Sortierung nach Kahn. Wirft Error mit den beteiligten IDs,
 * wenn ein Zyklus gefunden wird.
 *
 * Nur Deps beruecksichtigen, deren fromId UND toId in `knownIds` liegen —
 * referenzierte, aber unbekannte IDs werden verworfen (robust gegen
 * loeschte Items).
 */
function topoSort(
  itemIds: ReadonlyArray<string>,
  deps: ReadonlyArray<CpmInputDep>,
  knownIds: ReadonlySet<string>,
): string[] {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of itemIds) {
    indegree.set(id, 0);
    outgoing.set(id, []);
  }

  for (const d of deps) {
    if (!knownIds.has(d.fromId) || !knownIds.has(d.toId)) continue;
    indegree.set(d.toId, (indegree.get(d.toId) ?? 0) + 1);
    const list = outgoing.get(d.fromId);
    if (list) list.push(d.toId);
  }

  // Queue initial mit allen Nodes ohne eingehende Kante — sortiert fuer
  // Determinismus.
  const queue: string[] = [];
  for (const id of itemIds) {
    if ((indegree.get(id) ?? 0) === 0) queue.push(id);
  }
  queue.sort();

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    const successors = outgoing.get(id) ?? [];
    // Duplikate abfangen: erst Kanten einzeln zaehlen, dann abbauen.
    const nextBatch: string[] = [];
    for (const succ of successors) {
      const next = (indegree.get(succ) ?? 0) - 1;
      indegree.set(succ, next);
      if (next === 0) nextBatch.push(succ);
    }
    nextBatch.sort();
    for (const n of nextBatch) queue.push(n);
  }

  if (order.length !== itemIds.length) {
    const remaining = itemIds
      .filter((id) => (indegree.get(id) ?? 0) > 0)
      .sort();
    throw new Error(
      `Zirkulaere Abhaengigkeit erkannt: ${remaining.join(", ")}`,
    );
  }

  return order;
}

/**
 * Gruppiert Deps nach toId (eingehend) bzw. fromId (ausgehend) fuer
 * schnelle Lookups in Forward-/Backward-Pass.
 */
function groupDeps(
  deps: ReadonlyArray<CpmInputDep>,
  knownIds: ReadonlySet<string>,
): { incoming: Map<string, CpmInputDep[]>; outgoing: Map<string, CpmInputDep[]> } {
  const incoming = new Map<string, CpmInputDep[]>();
  const outgoing = new Map<string, CpmInputDep[]>();
  for (const d of deps) {
    if (!knownIds.has(d.fromId) || !knownIds.has(d.toId)) continue;
    const inc = incoming.get(d.toId) ?? [];
    inc.push(d);
    incoming.set(d.toId, inc);
    const out = outgoing.get(d.fromId) ?? [];
    out.push(d);
    outgoing.set(d.fromId, out);
  }
  return { incoming, outgoing };
}

/** Liefert das spaetere der beiden Daten. */
function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/** Liefert das fruehere der beiden Daten. */
function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

// ---------------------------------------------------------------------------
// Haupt-Funktion
// ---------------------------------------------------------------------------

/**
 * Berechnet ES/EF/LS/LF und den kritischen Pfad fuer einen Satz aus
 * Items und Dependencies.
 *
 * @throws Error bei zirkulaerer Abhaengigkeit.
 */
export function computeCriticalPath(
  items: ReadonlyArray<CpmInputItem>,
  deps: ReadonlyArray<CpmInputDep>,
  holidays: ReadonlySet<string>,
): Map<string, CpmResult> {
  const result = new Map<string, CpmResult>();
  if (items.length === 0) return result;

  // Deterministische Reihenfolge: Items nach ID, Deps auch.
  const sortedItems = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const itemIds = sortedItems.map((i) => i.id);
  const knownIds = new Set<string>(itemIds);
  const depsSorted = sortedDeps(deps);

  // Topologische Reihenfolge + Dep-Gruppen.
  const topo = topoSort(itemIds, depsSorted, knownIds);
  const { incoming, outgoing } = groupDeps(depsSorted, knownIds);

  // Working-State pro Item. initialStart ist der geplante Start des Items.
  // ES/EF/LS/LF werden iterativ gefuellt.
  const state = new Map<string, WorkingState>();
  for (const item of sortedItems) {
    const duration = computeDuration(item, holidays);
    const initialStart = new Date(
      item.startDate.getFullYear(),
      item.startDate.getMonth(),
      item.startDate.getDate(),
      0, 0, 0, 0,
    );
    state.set(item.id, {
      id: item.id,
      duration,
      initialStart,
      es: initialStart,
      ef: finishFromStart(initialStart, duration, holidays),
      ls: initialStart,
      lf: finishFromStart(initialStart, duration, holidays),
    });
  }

  // -------------------------------------------------------------------------
  // Forward-Pass: ES/EF in topo-Reihenfolge.
  // -------------------------------------------------------------------------
  for (const id of topo) {
    const node = state.get(id);
    if (!node) continue;
    const incs = incoming.get(id) ?? [];

    let es: Date = node.initialStart;

    for (const d of incs) {
      const pred = state.get(d.fromId);
      if (!pred) continue;

      let candidateStart: Date;
      if (d.type === "FS") {
        // to.start = pred.EF + lag Arbeitstage (next workday after pred.EF).
        candidateStart = addWorkdays(pred.ef, d.lagDays, holidays);
      } else if (d.type === "SS") {
        // to.start = pred.ES + lag Arbeitstage.
        candidateStart = addWorkdays(pred.es, d.lagDays, holidays);
      } else {
        // FF: to.end = pred.EF + lag → daraus to.start zurueckrechnen.
        const candidateFinish = addWorkdays(pred.ef, d.lagDays, holidays);
        candidateStart = startFromFinish(candidateFinish, node.duration, holidays);
      }
      es = maxDate(es, candidateStart);
    }

    node.es = es;
    node.ef = finishFromStart(es, node.duration, holidays);
  }

  // -------------------------------------------------------------------------
  // Projekt-Ende = max(EF). Grundwert fuer Items ohne Nachfolger.
  // -------------------------------------------------------------------------
  let projectFinish: Date | null = null;
  for (const node of state.values()) {
    projectFinish = projectFinish === null ? node.ef : maxDate(projectFinish, node.ef);
  }
  if (projectFinish === null) return result; // defensiv — items.length > 0 oben

  // -------------------------------------------------------------------------
  // Backward-Pass: LS/LF in umgekehrter topo-Reihenfolge.
  // -------------------------------------------------------------------------
  for (let i = topo.length - 1; i >= 0; i--) {
    const id = topo[i];
    if (id === undefined) continue;
    const node = state.get(id);
    if (!node) continue;
    const outs = outgoing.get(id) ?? [];

    let lf: Date;
    if (outs.length === 0) {
      // Blatt im DAG → Projekt-Ende als LF setzen, mindestens aber eigener EF.
      lf = maxDate(projectFinish, node.ef);
    } else {
      // Starte oben und minimiere ueber alle Nachfolger.
      let candidate: Date | null = null;
      for (const d of outs) {
        const succ = state.get(d.toId);
        if (!succ) continue;

        let candidateLF: Date;
        if (d.type === "FS") {
          // succ.LS = pred.LF + lag + 1 Arbeitstag → pred.LF = succ.LS - lag - 1.
          // Konsistent zu Forward (addWorkdays(pred.ef, lag) = succ.es):
          // fuer lag >= 0 heisst das: pred.LF liegt `lag + 1` Arbeitstage vor succ.LS.
          // Wir rechnen rueckwaerts: erst succ.LS - lag = "Ende" des Puffers,
          // dann minus 1 Arbeitstag = pred.LF.
          const afterLag = addWorkdays(succ.ls, -d.lagDays, holidays);
          candidateLF = addWorkdays(afterLag, -1, holidays);
        } else if (d.type === "SS") {
          // succ.LS = pred.LS + lag → pred.LS = succ.LS - lag, pred.LF = pred.LS + duration - 1.
          const candidateLS = addWorkdays(succ.ls, -d.lagDays, holidays);
          candidateLF = finishFromStart(candidateLS, node.duration, holidays);
        } else {
          // FF: succ.LF = pred.LF + lag → pred.LF = succ.LF - lag.
          candidateLF = addWorkdays(succ.lf, -d.lagDays, holidays);
        }

        candidate = candidate === null ? candidateLF : minDate(candidate, candidateLF);
      }
      // Falls alle Nachfolger ausgefiltert wurden, verhalte dich wie ein Blatt.
      lf = candidate ?? maxDate(projectFinish, node.ef);
    }

    node.lf = lf;
    node.ls = startFromFinish(lf, node.duration, holidays);
  }

  // -------------------------------------------------------------------------
  // Slack + kritischer Pfad. Slack wird als Arbeitstags-Differenz gerechnet,
  // damit Feiertage/Wochenenden sauber rausfallen.
  // -------------------------------------------------------------------------
  for (const node of state.values()) {
    let slack: number;
    if (node.ls.getTime() < node.es.getTime()) {
      // Kann bei sehr knappen Plaenen auftreten, wenn ES bereits nach LS liegt.
      // Negativer Slack = unmoeglich einzuhalten; wir normalisieren auf 0 nicht,
      // sondern geben die negative Zahl zurueck (Informationsgehalt).
      slack = -countWorkdays(node.ls, node.es, holidays) + 1;
      // countWorkdays liefert inkl. Endpunkte, daher "+1"-Korrektur fuer Differenz.
    } else if (node.ls.getTime() === node.es.getTime()) {
      slack = 0;
    } else {
      // ES < LS: countWorkdays(ES, LS) inkl. Endpunkte, Differenz ist -1.
      slack = countWorkdays(node.es, node.ls, holidays) - 1;
    }

    result.set(node.id, {
      itemId: node.id,
      earliestStart: node.es,
      earliestFinish: node.ef,
      latestStart: node.ls,
      latestFinish: node.lf,
      slackDays: slack,
      onCriticalPath: slack === 0,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Selbsttest (nur unter NODE_ENV=test aktiv). Kein Test-Runner noetig.
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === "test") {
  const assert = (cond: boolean, msg: string): void => {
    if (!cond) throw new Error(`critical-path self-test failed: ${msg}`);
  };

  const noHolidays: ReadonlySet<string> = new Set<string>();

  // 3 Items auf einem kritischen Pfad: A (Mo-Fr) → B (Mo-Fr) → C (Mo-Fr).
  // FS-Deps ohne Lag. Gesamtes Projekt = 3 Wochen, alle drei Items auf CP.
  const itemsLinear: CpmInputItem[] = [
    {
      id: "A",
      startDate: fromDateKey("2026-04-13"), // Mo
      endDate: fromDateKey("2026-04-17"),   // Fr
      isMilestone: false,
    },
    {
      id: "B",
      startDate: fromDateKey("2026-04-20"),
      endDate: fromDateKey("2026-04-24"),
      isMilestone: false,
    },
    {
      id: "C",
      startDate: fromDateKey("2026-04-27"),
      endDate: fromDateKey("2026-05-01"),
      isMilestone: false,
    },
  ];
  const depsLinear: CpmInputDep[] = [
    { fromId: "A", toId: "B", type: "FS", lagDays: 0 },
    { fromId: "B", toId: "C", type: "FS", lagDays: 0 },
  ];

  const resLinear = computeCriticalPath(itemsLinear, depsLinear, noHolidays);
  assert(resLinear.size === 3, "Ergebnis sollte 3 Items enthalten");
  const A = resLinear.get("A");
  const B = resLinear.get("B");
  const C = resLinear.get("C");
  assert(A !== undefined && B !== undefined && C !== undefined, "A/B/C muessen im Ergebnis sein");
  if (A && B && C) {
    assert(A.onCriticalPath === true, "A muss auf dem kritischen Pfad liegen");
    assert(B.onCriticalPath === true, "B muss auf dem kritischen Pfad liegen");
    assert(C.onCriticalPath === true, "C muss auf dem kritischen Pfad liegen");
    assert(
      toDateKey(B.earliestStart) === "2026-04-20",
      `B.ES sollte Mo 2026-04-20 sein, war ${toDateKey(B.earliestStart)}`,
    );
    assert(
      toDateKey(C.earliestStart) === "2026-04-27",
      `C.ES sollte Mo 2026-04-27 sein, war ${toDateKey(C.earliestStart)}`,
    );
    assert(A.slackDays === 0, `A.slack sollte 0 sein, war ${A.slackDays}`);
  }

  // Parallel-Zweig mit Puffer: A → B (5 Tage), A → D (1 Tag), B → C, D → C.
  // D hat Puffer, A/B/C bilden den kritischen Pfad.
  const itemsParallel: CpmInputItem[] = [
    {
      id: "A",
      startDate: fromDateKey("2026-04-13"),
      endDate: fromDateKey("2026-04-17"), // 5 AT
      isMilestone: false,
    },
    {
      id: "B",
      startDate: fromDateKey("2026-04-20"),
      endDate: fromDateKey("2026-04-24"), // 5 AT
      isMilestone: false,
    },
    {
      id: "D",
      startDate: fromDateKey("2026-04-20"),
      endDate: fromDateKey("2026-04-20"), // 1 AT → viel Puffer
      isMilestone: false,
    },
    {
      id: "C",
      startDate: fromDateKey("2026-04-27"),
      endDate: fromDateKey("2026-05-01"),
      isMilestone: false,
    },
  ];
  const depsParallel: CpmInputDep[] = [
    { fromId: "A", toId: "B", type: "FS", lagDays: 0 },
    { fromId: "A", toId: "D", type: "FS", lagDays: 0 },
    { fromId: "B", toId: "C", type: "FS", lagDays: 0 },
    { fromId: "D", toId: "C", type: "FS", lagDays: 0 },
  ];
  const resPar = computeCriticalPath(itemsParallel, depsParallel, noHolidays);
  const PA = resPar.get("A");
  const PB = resPar.get("B");
  const PD = resPar.get("D");
  const PC = resPar.get("C");
  assert(PA !== undefined && PB !== undefined && PD !== undefined && PC !== undefined, "alle Ergebnisse vorhanden");
  if (PA && PB && PD && PC) {
    assert(PA.onCriticalPath === true, "A (Parallel) muss auf CP liegen");
    assert(PB.onCriticalPath === true, "B (laengerer Zweig) muss auf CP liegen");
    assert(PC.onCriticalPath === true, "C (Parallel) muss auf CP liegen");
    assert(PD.onCriticalPath === false, `D muss Puffer haben (slack=${PD.slackDays})`);
    assert(PD.slackDays > 0, `D.slack sollte > 0 sein, war ${PD.slackDays}`);
  }

  // Zyklus-Erkennung.
  const itemsCycle: CpmInputItem[] = [
    { id: "X", startDate: fromDateKey("2026-04-13"), endDate: fromDateKey("2026-04-13"), isMilestone: false },
    { id: "Y", startDate: fromDateKey("2026-04-14"), endDate: fromDateKey("2026-04-14"), isMilestone: false },
  ];
  const depsCycle: CpmInputDep[] = [
    { fromId: "X", toId: "Y", type: "FS", lagDays: 0 },
    { fromId: "Y", toId: "X", type: "FS", lagDays: 0 },
  ];
  let threw = false;
  try {
    computeCriticalPath(itemsCycle, depsCycle, noHolidays);
  } catch (e) {
    threw = e instanceof Error && e.message.startsWith("Zirkulaere Abhaengigkeit");
  }
  assert(threw, "Zyklus muss Error werfen");
}
