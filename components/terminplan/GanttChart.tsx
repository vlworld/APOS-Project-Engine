"use client";

// Root-Component des Gantt-Charts.
// Lädt /api/projekte/[id]/terminplan, verwaltet Zoom/Filter/Expand-State,
// synchronisiert Scroll zwischen Tabelle und Timeline.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { Loader2, CalendarRange, AlertCircle } from "lucide-react";
import type {
  ScheduleItemDTO,
  TerminplanResponseDTO,
  TradeCategoryDTO,
} from "@/lib/terminplan/types";
import { computeTimelineRange } from "@/lib/terminplan/time";
import { useToast } from "@/components/ui/Toast";
import GanttToolbar from "./GanttToolbar";
import GanttTable from "./GanttTable";
import GanttTimeline from "./GanttTimeline";
import GanttLegend from "./GanttLegend";
import ScheduleItemModal from "./ScheduleItemModal";
import TailwindColorSafelist from "./TailwindColorSafelist";
import type { GanttView, TimelineContext, ZoomLevel } from "./types";

interface GanttChartProps {
  projectId: string;
  canEdit: boolean;
  /** Wenn true: nimmt die volle Höhe des Parent-Containers (für Fullscreen). */
  fullHeight?: boolean;
}

const HEADER_HEIGHT = 56;
const ROW_HEIGHT = 40;
const TABLE_WIDTH = 720;

// Pixel pro Tag je nach Zoom-Stufe (initialer Richtwert — Timeline wird
// aber auf mindestens diese Breite gestreckt).
const PX_PER_DAY: Record<ZoomLevel, number> = {
  DAY: 28,
  WEEK: 14,
  MONTH: 5,
};

export default function GanttChart({ projectId, canEdit, fullHeight }: GanttChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TerminplanResponseDTO | null>(null);

  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("WEEK");
  const [view, setView] = useState<GanttView>("GANTT");
  const [selectedTradeIds, setSelectedTradeIds] = useState<Set<string>>(
    new Set(),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [modalOpen, setModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<ScheduleItemDTO | null>(null);
  const [modalParentId, setModalParentId] = useState<string | null>(null);

  const { toast } = useToast();

  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef<"none" | "table" | "timeline">("none");

  // --- Fetch ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projekte/${projectId}/terminplan`, {
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 501) {
          setError(
            "Die Terminplan-API ist noch nicht implementiert (501). Die UI steht, sobald das Backend antwortet.",
          );
        } else {
          setError(`Fehler ${res.status} beim Laden.`);
        }
        setData(null);
        return;
      }
      const body = (await res.json()) as TerminplanResponseDTO;
      // Defensive Fallbacks
      setData({
        items: Array.isArray(body.items) ? body.items : [],
        dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
        tradeCategories: Array.isArray(body.tradeCategories)
          ? body.tradeCategories
          : [],
        projectStart: body.projectStart ?? new Date().toISOString(),
        projectEnd: body.projectEnd ?? new Date().toISOString(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Anfangs-Expand: alle Top-Level aufklappen ---
  useEffect(() => {
    if (!data) return;
    setExpandedIds((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const it of data.items) {
        if (it.hasChildren) next.add(it.id);
      }
      return next;
    });
    // Gewerk-Filter: initial alle ausgewählt
    setSelectedTradeIds((prev) => {
      if (prev.size > 0) return prev;
      return new Set(data.tradeCategories.map((tc) => tc.id));
    });
  }, [data]);

  // --- Trade-Filter Handlers ---
  const toggleTrade = useCallback((id: string) => {
    setSelectedTradeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const resetTrades = useCallback(() => {
    if (!data) return;
    setSelectedTradeIds(new Set(data.tradeCategories.map((tc) => tc.id)));
  }, [data]);

  // --- Expand / Collapse ---
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- Sichtbare Items berechnen (Flat-Liste gemäß Hierarchie + Expand) ---
  const { items, tradeCategoriesById } = useMemo(() => {
    const tcs = new Map<string, TradeCategoryDTO>();
    for (const tc of data?.tradeCategories ?? []) tcs.set(tc.id, tc);
    return {
      items: data?.items ?? [],
      tradeCategoriesById: tcs,
    };
  }, [data]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, ScheduleItemDTO[]>();
    for (const it of items) {
      const key = it.parentId ?? null;
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    return map;
  }, [items]);

  const visibleItems = useMemo(() => {
    const tradeFilterActive =
      selectedTradeIds.size > 0 &&
      data !== null &&
      selectedTradeIds.size !== data.tradeCategories.length;

    const passesTradeFilter = (it: ScheduleItemDTO): boolean => {
      if (!tradeFilterActive) return true;
      // Items ohne Trade → immer anzeigen
      if (!it.tradeCategoryId) return true;
      return selectedTradeIds.has(it.tradeCategoryId);
    };

    const out: ScheduleItemDTO[] = [];
    function walk(parentId: string | null) {
      const kids = childrenByParent.get(parentId) ?? [];
      for (const it of kids) {
        if (!passesTradeFilter(it)) {
          // Parent mit allen Kindern überspringen? — wir zeigen Parents
          // trotzdem, wenn sie Kinder haben, die passen. Wir prüfen
          // zuerst die Kinder, und nehmen den Parent nur, wenn mind. ein
          // Kind passt ODER Parent selbst passt.
          if (it.hasChildren) {
            const before = out.length;
            if (expandedIds.has(it.id)) {
              walk(it.id);
            } else {
              // Kollabierte Parents, die nicht selbst passen, werden nicht
              // gezeigt — sonst versteckt sich relevanter Inhalt.
              // Wir rekursieren trotzdem in Tiefe (hidden), um zu schauen,
              // ob irgendwas passt:
              const hadChild = hasMatchingDescendant(
                it,
                childrenByParent,
                passesTradeFilter,
              );
              if (hadChild) {
                out.push(it);
              }
              continue;
            }
            if (out.length > before) {
              // mind. ein Kind hat's rein geschafft → Parent mitnehmen
              out.splice(before, 0, it);
            }
          }
          continue;
        }
        out.push(it);
        if (it.hasChildren && expandedIds.has(it.id)) {
          walk(it.id);
        }
      }
    }
    walk(null);
    return out;
  }, [childrenByParent, expandedIds, selectedTradeIds, data]);

  // --- Timeline-Range & Kontext ---
  const timelineCtx: TimelineContext | null = useMemo(() => {
    if (!data) return null;
    // Items mit Daten-Objekten
    const itemsForRange = data.items.map((it) => ({
      startDate: new Date(it.startDate),
      endDate: new Date(it.endDate),
    }));
    const range = computeTimelineRange(itemsForRange, {
      padStartDays: 7,
      padEndDays: 14,
      minDurationDays: 30,
    });
    const pxPerDay = PX_PER_DAY[zoomLevel];
    const timelineWidthPx = Math.max(range.totalDays * pxPerDay, 800);
    return {
      rangeStart: range.start,
      rangeEnd: range.end,
      totalDays: range.totalDays,
      zoomLevel,
      pixelPerDay: pxPerDay,
      timelineWidthPx,
      rowHeight: ROW_HEIGHT,
    };
  }, [data, zoomLevel]);

  // --- Scroll-Sync (vertikal): table ↔ timeline ---
  const handleTableScroll = (e: UIEvent<HTMLDivElement>) => {
    if (syncingScrollRef.current === "timeline") {
      syncingScrollRef.current = "none";
      return;
    }
    if (timelineScrollRef.current) {
      syncingScrollRef.current = "table";
      timelineScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };
  const handleTimelineScroll = (e: UIEvent<HTMLDivElement>) => {
    if (syncingScrollRef.current === "table") {
      syncingScrollRef.current = "none";
      return;
    }
    if (tableScrollRef.current) {
      syncingScrollRef.current = "timeline";
      tableScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // --- Modal-Handling ---
  function openCreateTop() {
    setModalItem(null);
    setModalParentId(null);
    setModalOpen(true);
  }
  function openCreateChild(parent: ScheduleItemDTO) {
    setModalItem(null);
    setModalParentId(parent.id);
    setModalOpen(true);
  }
  function openEditItem(item: ScheduleItemDTO) {
    setModalItem(item);
    setModalParentId(null);
    setModalOpen(true);
  }
  function onSaved() {
    fetchData();
    toast({ title: "Aktualisiert", variant: "success" });
  }

  // --- Drag & Drop: Commit-Handler ---
  // Wird vom GanttBar beim Loslassen aufgerufen. Wir aktualisieren den State
  // optimistisch (damit der Balken sofort an der neuen Stelle sitzt), feuern
  // den PATCH (oder POST /move bei Cascade) und rollen bei Fehler zurück.
  const handleCommitMove = useCallback(
    async (
      itemId: string,
      newStart: string,
      newEnd: string,
      options?: { cascade?: boolean },
    ): Promise<void> => {
      if (!data) return;

      // Original-Item für Rollback merken
      const original = data.items.find((it) => it.id === itemId);
      if (!original) return;

      // ISO-Strings aus YYYY-MM-DD (lokal Mitternacht → ISO)
      const toIso = (ymd: string): string => {
        const parts = ymd.split("-");
        const y = Number(parts[0]);
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
        return dt.toISOString();
      };

      // Optimistisches Update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((it) =>
            it.id === itemId
              ? { ...it, startDate: toIso(newStart), endDate: toIso(newEnd) }
              : it,
          ),
        };
      });

      try {
        const res = await fetch(
          `/api/projekte/${projectId}/terminplan/${itemId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ startDate: newStart, endDate: newEnd }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof (body as { error: unknown }).error === "string"
              ? (body as { error: string }).error
              : `Fehler ${res.status}`;
          throw new Error(msg);
        }

        // Bei Cascade zusätzlich alle Nachfolger über move-Endpoint verschieben.
        // Wir berechnen das delta in Kalendertagen zwischen alt und neu-Start.
        // (Der move-Endpoint erwartet Arbeitstage — für Cascade reichen hier
        //  auch Arbeitstag-Deltas, siehe /move-Route. Wir liefern Kalendertage
        //  als Näherung, da frontseitig keine Feiertagsliste vorliegt.)
        if (options?.cascade) {
          const oldStart = new Date(original.startDate);
          const newStartDt = new Date(toIso(newStart));
          const deltaDays = Math.round(
            (newStartDt.getTime() - oldStart.getTime()) / 86_400_000,
          );
          if (deltaDays !== 0) {
            await fetch(
              `/api/projekte/${projectId}/terminplan/${itemId}/move`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  deltaWorkdays: deltaDays,
                  cascade: true,
                }),
              },
            ).catch(() => undefined);
          }
        }

        toast({ title: "Termin angepasst", variant: "success" });
        // Full-Refetch, um abgeleitete Felder (wbsCode, durationWorkdays,
        // isDelayed, ggf. Cascade-Nachzüge) konsistent zu bekommen.
        await fetchData();
      } catch (err) {
        // Rollback
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            items: prev.items.map((it) =>
              it.id === itemId ? original : it,
            ),
          };
        });
        const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
        toast({
          title: "Verschieben fehlgeschlagen",
          description: msg,
          variant: "error",
        });
      }
    },
    [data, fetchData, projectId, toast],
  );

  // --- Render ---

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Bauzeitenplan konnte nicht geladen werden
        </h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">{error}</p>
      </div>
    );
  }

  const isEmpty = !data || data.items.length === 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* JIT-Safelist */}
      <TailwindColorSafelist />

      {/* Toolbar */}
      <GanttToolbar
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        view={view}
        onViewChange={setView}
        tradeCategories={data?.tradeCategories ?? []}
        selectedTradeIds={selectedTradeIds}
        onToggleTrade={toggleTrade}
        onResetTrades={resetTrades}
        canEdit={canEdit}
        onAddClick={openCreateTop}
      />

      {isEmpty ? (
        <div className="p-12 text-center">
          <CalendarRange className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Noch keine Arbeitspakete
          </h2>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Legen Sie das erste Arbeitspaket an, um den Bauzeitenplan zu
            starten.
          </p>
          {canEdit && (
            <button
              type="button"
              onClick={openCreateTop}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Erstes Arbeitspaket anlegen
            </button>
          )}
        </div>
      ) : (
        <>
          {view === "GANTT" && timelineCtx ? (
            /*
             * Gemeinsamer Scroll-Container für Tabelle + Timeline.
             * Ein einziger overflow-auto div, Tabelle ist sticky left-0
             * beim horizontalen Scroll. Vertikaler Scroll wirkt auf beide
             * Seiten synchron, weil sie demselben Parent angehören.
             */
            <div
              className="overflow-auto"
              style={{ height: fullHeight ? "100%" : "calc(100vh - 360px)", minHeight: 400 }}
            >
              <div
                className="flex"
                style={{ minWidth: TABLE_WIDTH + 400 }}
              >
                {/* Table Side */}
                <div
                  className="shrink-0 sticky left-0 bg-white z-20 border-r border-gray-200"
                  style={{ width: TABLE_WIDTH }}
                >
                  <GanttTable
                    visibleItems={visibleItems}
                    tradeCategoriesById={tradeCategoriesById}
                    expandedIds={expandedIds}
                    canEdit={canEdit}
                    onToggleExpand={toggleExpand}
                    onEditItem={openEditItem}
                    onAddChild={openCreateChild}
                    headerHeight={HEADER_HEIGHT}
                    rowHeight={ROW_HEIGHT}
                    width={TABLE_WIDTH}
                  />
                </div>

                {/* Timeline Side */}
                <div className="flex-1 relative min-w-0">
                  <GanttTimeline
                    items={items}
                    visibleItems={visibleItems}
                    dependencies={data.dependencies}
                    tradeCategoriesById={tradeCategoriesById}
                    timelineCtx={timelineCtx}
                    headerHeight={HEADER_HEIGHT}
                    onEditItem={openEditItem}
                    canEdit={canEdit}
                    onCommitMove={handleCommitMove}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Listen-Ansicht: nur Tabelle, volle Breite */
            <div
              className="overflow-auto"
              style={{ maxHeight: fullHeight ? "100%" : "calc(100vh - 360px)" }}
            >
              <GanttTable
                visibleItems={visibleItems}
                tradeCategoriesById={tradeCategoriesById}
                expandedIds={expandedIds}
                canEdit={canEdit}
                onToggleExpand={toggleExpand}
                onEditItem={openEditItem}
                onAddChild={openCreateChild}
                headerHeight={HEADER_HEIGHT}
                rowHeight={ROW_HEIGHT}
                fullWidth
              />
            </div>
          )}
        </>
      )}

      {/* Legend */}
      {!isEmpty && <GanttLegend />}

      {/* Fehler-Banner (Daten geladen, aber vielleicht nicht perfekt) */}
      {error && data && (
        <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Modal */}
      <ScheduleItemModal
        open={modalOpen}
        item={modalItem}
        parentId={modalParentId}
        projectId={projectId}
        tradeCategories={data?.tradeCategories ?? []}
        onClose={() => setModalOpen(false)}
        onSaved={onSaved}
      />
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------

function hasMatchingDescendant(
  item: ScheduleItemDTO,
  childrenByParent: Map<string | null, ScheduleItemDTO[]>,
  passes: (it: ScheduleItemDTO) => boolean,
): boolean {
  const kids = childrenByParent.get(item.id) ?? [];
  for (const k of kids) {
    if (passes(k)) return true;
    if (k.hasChildren && hasMatchingDescendant(k, childrenByParent, passes)) {
      return true;
    }
  }
  return false;
}
