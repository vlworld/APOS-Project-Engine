"use client";

// Einzelner Balken / Meilenstein / Parent-Bar in der Timeline.
// Reine Präsentation — absolute positioniert innerhalb einer Zeile.
//
// Drag & Drop (wenn canEdit && onCommitMove && timelineWidthPx gesetzt):
//  - Linker Rand  (4 px, cursor ew-resize) → verändert startDate
//  - Mitte        (cursor grab/grabbing)   → verschiebt start+end
//  - Rechter Rand (4 px, cursor ew-resize) → verändert endDate
// Milestones: nur Move, kein Resize (1-Tag-Events).
// Escape bricht Drag ab. Shift beim Move → cascade-Hinweis.

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScheduleItemDTO, TradeCategoryDTO } from "@/lib/terminplan/types";
import { addDays, formatDateFull, pixelDeltaToDays, daysBetween } from "@/lib/terminplan/time";
import { toDateKey } from "@/lib/terminplan/workdays";
import { safeColor, type TerminplanColor } from "./TailwindColorSafelist";

const STATUS_LABEL: Record<ScheduleItemDTO["status"], string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Arbeit",
  DONE: "Erledigt",
};

type DragType = "move" | "resize-start" | "resize-end";

interface DragState {
  type: DragType;
  startX: number;
  initialStart: Date;
  initialEnd: Date;
  deltaDays: number;
  shift: boolean;
}

export interface GanttBarProps {
  item: ScheduleItemDTO;
  tradeCategory: TradeCategoryDTO | undefined;
  leftPercent: number;
  widthPercent: number;
  isParent: boolean;
  onClick: () => void;
  // Drag & Drop — optional, nur wenn alle gesetzt sind wird DnD aktiv.
  canEdit?: boolean;
  timelineWidthPx?: number;
  totalDays?: number;
  onCommitMove?: (
    itemId: string,
    newStart: string,
    newEnd: string,
    options?: { cascade?: boolean },
  ) => void | Promise<void>;
}

export default function GanttBar({
  item,
  tradeCategory,
  leftPercent,
  widthPercent,
  isParent,
  onClick,
  canEdit = false,
  timelineWidthPx,
  totalDays,
  onCommitMove,
}: GanttBarProps) {
  const [hovered, setHovered] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  // RAF-throttled mousemove — wir speichern den letzten ClientX und verwerten
  // ihn in einem requestAnimationFrame. Verhindert UI-Thrashing bei 120 Hz.
  const rafRef = useRef<number | null>(null);
  const latestClientXRef = useRef<number>(0);
  const latestShiftRef = useRef<boolean>(false);

  // Verhindert dass nach einem Drag das onClick-Event noch das Modal öffnet.
  // Wird nach mouseup auf true gesetzt und nach 250ms wieder freigegeben.
  const justDraggedRef = useRef<boolean>(false);

  // Wrapper für onClick: blockt wenn gerade gedragged wurde.
  const handleClick = useCallback(() => {
    if (justDraggedRef.current) return;
    onClick();
  }, [onClick]);

  // Farbe: item.color (Override) > tradeCategory.color > "blue"
  const color: TerminplanColor = safeColor(item.color ?? tradeCategory?.color);

  // Ist Drag & Drop grundsätzlich möglich?
  const dndEnabled =
    canEdit === true &&
    typeof onCommitMove === "function" &&
    typeof timelineWidthPx === "number" &&
    timelineWidthPx > 0 &&
    typeof totalDays === "number" &&
    totalDays > 0;

  // Milestones können nur verschoben werden — kein Resize.
  const canMove = dndEnabled && !isParent;
  const canResize = dndEnabled && !isParent && !item.isMilestone;

  // --- Drag lifecycle --------------------------------------------------------

  const commitDrag = useCallback(
    (state: DragState) => {
      if (!onCommitMove) return;
      const initialStart = state.initialStart;
      const initialEnd = state.initialEnd;
      let newStart = initialStart;
      let newEnd = initialEnd;
      const d = state.deltaDays;

      if (state.type === "move") {
        newStart = addDays(initialStart, d);
        newEnd = addDays(initialEnd, d);
      } else if (state.type === "resize-start") {
        newStart = addDays(initialStart, d);
        // Nicht hinter Ende rutschen
        if (newStart.getTime() > initialEnd.getTime()) {
          newStart = initialEnd;
        }
      } else if (state.type === "resize-end") {
        newEnd = addDays(initialEnd, d);
        // Nicht vor Start rutschen
        if (newEnd.getTime() < initialStart.getTime()) {
          newEnd = initialStart;
        }
      }

      if (d === 0) return; // nichts zu tun

      const startKey = toDateKey(newStart);
      const endKey = toDateKey(newEnd);
      void onCommitMove(item.id, startKey, endKey, {
        cascade: state.type === "move" && state.shift,
      });
    },
    [item.id, onCommitMove],
  );

  const endDrag = useCallback(
    (commit: boolean) => {
      // Aktuellen Drag-State zwischenspeichern. Der setState-Updater darf
      // keine externen Seiteneffekte auslösen — sonst triggert commitDrag
      // → onCommitMove → setData in GanttChart *während* GanttBar noch im
      // Update-Zyklus ist ("Cannot update a component while rendering a
      // different component").
      // Wrapper-Objekt statt `let`, damit TS die Zuweisung im Callback
      // nicht als Control-Flow-narrow verliert.
      const snapshot: { value: DragState | null } = { value: null };
      setDrag((prev) => {
        snapshot.value = prev;
        return null;
      });

      // Seiteneffekte nach dem State-Reset ausführen
      const finalState = snapshot.value;
      if (finalState) {
        if (Math.abs(finalState.deltaDays) > 0) {
          // Click-Event der nächsten 250ms unterdrücken, damit nach Drag
          // nicht versehentlich das Modal aufgeht.
          justDraggedRef.current = true;
          window.setTimeout(() => {
            justDraggedRef.current = false;
          }, 250);
        }
        if (commit) commitDrag(finalState);
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [commitDrag],
  );

  // Global listeners während Drag
  useEffect(() => {
    if (!drag) return;

    const onMouseMove = (ev: MouseEvent): void => {
      latestClientXRef.current = ev.clientX;
      latestShiftRef.current = ev.shiftKey;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        setDrag((prev) => {
          if (!prev) return prev;
          if (
            typeof timelineWidthPx !== "number" ||
            typeof totalDays !== "number"
          ) {
            return prev;
          }
          const deltaPx = latestClientXRef.current - prev.startX;
          const deltaDays = pixelDeltaToDays(
            deltaPx,
            timelineWidthPx,
            totalDays,
          );
          if (
            deltaDays === prev.deltaDays &&
            latestShiftRef.current === prev.shift
          ) {
            return prev;
          }
          return { ...prev, deltaDays, shift: latestShiftRef.current };
        });
      });
    };

    const onMouseUp = (): void => {
      endDrag(true);
    };

    const onKeyDown = (ev: KeyboardEvent): void => {
      if (ev.key === "Escape") {
        endDrag(false);
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drag, endDrag, timelineWidthPx, totalDays]);

  const startDrag = useCallback(
    (type: DragType, ev: React.MouseEvent): void => {
      if (!dndEnabled) return;
      if (type !== "move" && !canResize) return;
      if (type === "move" && !canMove) return;
      // Nur linke Maustaste
      if (ev.button !== 0) return;
      ev.preventDefault();
      ev.stopPropagation();
      setDrag({
        type,
        startX: ev.clientX,
        initialStart: new Date(item.startDate),
        initialEnd: new Date(item.endDate),
        deltaDays: 0,
        shift: ev.shiftKey,
      });
    },
    [dndEnabled, canMove, canResize, item.startDate, item.endDate],
  );

  // Aktueller (previewter) Start/End während Drag — für Tooltip & Geometrie
  const previewStart = drag
    ? drag.type === "resize-end"
      ? drag.initialStart
      : addDays(drag.initialStart, drag.deltaDays)
    : null;
  const previewEnd = drag
    ? drag.type === "resize-start"
      ? drag.initialEnd
      : drag.type === "move"
        ? addDays(drag.initialEnd, drag.deltaDays)
        : addDays(drag.initialEnd, drag.deltaDays)
    : null;

  // Pixel-Offset für visuelles Feedback (nur während Drag).
  // Wir schieben/verbreitern rein per style, ohne Layout-Änderung.
  const dragPxDelta =
    drag && typeof timelineWidthPx === "number" && typeof totalDays === "number"
      ? (drag.deltaDays / totalDays) * timelineWidthPx
      : 0;

  const left = `${Math.max(leftPercent, 0)}%`;

  // --- Milestone ------------------------------------------------------------

  if (item.isMilestone) {
    const translateX = drag ? `${dragPxDelta}px` : "0px";
    return (
      <>
        <button
          type="button"
          onClick={drag ? undefined : handleClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onMouseDown={canMove ? (e) => startDrag("move", e) : undefined}
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center group ${
            canMove ? (drag ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
          style={{
            left,
            transform: `translate(calc(-50% + ${translateX}), -50%)`,
            opacity: drag ? 0.7 : 1,
          }}
          aria-label={`Meilenstein ${item.name}`}
        >
          <span
            className={`w-3 h-3 rotate-45 shadow-sm transition-transform group-hover:scale-125 ${
              item.isDelayed
                ? "bg-red-600 ring-1 ring-red-400"
                : `bg-${color}-600`
            }`}
          />
        </button>
        {(hovered || drag) && (
          <BarTooltip
            item={item}
            tradeCategory={tradeCategory}
            color={color}
            leftPercent={leftPercent}
            previewStart={previewStart}
            previewEnd={previewEnd}
            dragType={drag?.type}
            shift={drag?.shift ?? false}
          />
        )}
      </>
    );
  }

  // --- Zeitraum (isTimeRange) ------------------------------------------------
  // Fuzzy-Bereich mit diskreten Events. Gestrichelter Rahmen, halbtransparent.
  // Events als kleine Kästchen innerhalb, Status-farbig:
  //   PLANNED   → grau, dashed (noch zu terminieren)
  //   SCHEDULED → kräftige Gewerk-Farbe (abgestimmt)
  //   DONE      → emerald (erledigt)
  if (item.isTimeRange) {
    const rangeStart = new Date(item.startDate);
    const rangeEnd = new Date(item.endDate);
    const rangeDays = Math.max(1, daysBetween(rangeStart, rangeEnd));
    const trSafeWidth = `${Math.max(widthPercent, 0.5)}%`;
    const trIsTiny = widthPercent < 3;
    return (
      <>
        <div
          className={`absolute top-1/2 rounded-md border-2 border-dashed bg-${color}-100 border-${color}-400`}
          style={{
            left,
            width: trSafeWidth,
            height: 22,
            transform: "translateY(-50%)",
            opacity: 0.85,
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={handleClick}
          role="button"
          aria-label={`Zeitraum ${item.name}`}
          title={`Zeitraum: ${item.name}`}
        >
          {/* Label */}
          {!trIsTiny && (
            <span className="absolute inset-0 flex items-center px-2 pointer-events-none">
              <span className={`text-[10px] font-medium truncate text-${color}-800`}>
                {item.name}
              </span>
            </span>
          )}
          {/* Events als Kästchen */}
          {item.events.map((ev) => {
            const eventDate = new Date(ev.date);
            const offset = daysBetween(rangeStart, eventDate);
            if (offset < 0 || offset > rangeDays) return null;
            const leftPct = (offset / rangeDays) * 100;
            const eventLabel = ev.label
              ? `${ev.label} — ${formatDateFull(eventDate)}`
              : formatDateFull(eventDate);
            const statusLabel =
              ev.status === "SCHEDULED"
                ? "Abgestimmt"
                : ev.status === "DONE"
                  ? "Erledigt"
                  : "Geplant";
            return (
              <div
                key={ev.id}
                className="absolute top-1/2 -translate-y-1/2 pointer-events-auto"
                style={{ left: `${leftPct}%` }}
                title={`${eventLabel} (${statusLabel})`}
              >
                <span
                  className={`block w-2.5 h-3.5 -translate-x-1/2 rounded-sm border ${
                    ev.status === "SCHEDULED"
                      ? `bg-${color}-600 border-${color}-800`
                      : ev.status === "DONE"
                        ? "bg-emerald-500 border-emerald-700"
                        : "bg-gray-200 border-gray-500 border-dashed"
                  }`}
                />
              </div>
            );
          })}
        </div>
        {hovered && (
          <BarTooltip
            item={item}
            tradeCategory={tradeCategory}
            color={color}
            leftPercent={leftPercent}
          />
        )}
      </>
    );
  }

  // --- Parent-Bar -----------------------------------------------------------

  if (isParent) {
    // Parents werden nicht ge-dragged — Hierarchie-Rollups sind abgeleitet.
    return (
      <>
        <button
          type="button"
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="absolute top-1/2 -translate-y-1/2"
          style={{
            left,
            width: `${Math.max(widthPercent, 0.5)}%`,
            height: 12,
            transform: "translateY(-50%)",
          }}
          aria-label={`Phase ${item.name}`}
        >
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-gray-400 rounded-sm" />
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-gray-600 rounded-l-sm" />
          <span className="absolute right-0 top-0 bottom-0 w-1 bg-gray-600 rounded-r-sm" />
        </button>
        {hovered && (
          <BarTooltip
            item={item}
            tradeCategory={tradeCategory}
            color={color}
            leftPercent={leftPercent}
          />
        )}
      </>
    );
  }

  // --- Normaler Task-Balken -------------------------------------------------

  const isTiny = widthPercent < 3;
  const safeWidth = `${Math.max(widthPercent, 0.5)}%`;

  // Während Drag: visuell verschieben / verbreitern über extra styles
  // (wir lassen left/width in % stehen und arbeiten additiv mit Pixeln).
  let dragWrapperStyle: React.CSSProperties = {};
  if (drag) {
    if (drag.type === "move") {
      dragWrapperStyle = {
        transform: `translate(${dragPxDelta}px, -50%)`,
      };
    } else if (drag.type === "resize-end") {
      dragWrapperStyle = {
        // Breite additiv anpassen über calc; left bleibt gleich
        width: `calc(${safeWidth} + ${dragPxDelta}px)`,
      };
    } else if (drag.type === "resize-start") {
      // links rein / raus: left anpassen und Breite gegengleich
      dragWrapperStyle = {
        left: `calc(${left} + ${dragPxDelta}px)`,
        width: `calc(${safeWidth} - ${dragPxDelta}px)`,
      };
    }
  }

  return (
    <>
      {/* Wrapper für den Balken — Click-Layer + Resize-Handles */}
      <div
        className={`absolute top-1/2 rounded-md overflow-visible ${
          item.isDelayed ? "ring-1 ring-red-400" : ""
        }`}
        style={{
          left,
          width: safeWidth,
          height: 20,
          transform: "translateY(-50%)",
          opacity: drag ? 0.7 : 1,
          ...dragWrapperStyle,
          zIndex: drag ? 15 : "auto",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Haupt-Button: Click + Move-Drag */}
        <button
          type="button"
          onClick={drag ? undefined : handleClick}
          onMouseDown={canMove ? (e) => startDrag("move", e) : undefined}
          className={`absolute inset-0 rounded-md overflow-hidden text-left transition-[filter] hover:brightness-110 hover:shadow-md ${
            canMove
              ? drag && drag.type === "move"
                ? "cursor-grabbing"
                : "cursor-grab"
              : ""
          }`}
          aria-label={item.name}
        >
          {/* Background */}
          <span
            className={`absolute inset-0 ${
              item.isDelayed ? "bg-red-100" : `bg-${color}-100`
            }`}
          />
          {/* Progress fill */}
          <span
            className={`absolute inset-y-0 left-0 ${
              item.isDelayed ? "bg-red-500" : `bg-${color}-600`
            } opacity-80`}
            style={{ width: `${Math.max(0, Math.min(100, item.progress))}%` }}
          />
          {/* Outline */}
          <span
            className={`absolute inset-0 rounded-md border ${
              item.isDelayed ? "border-red-400" : `border-${color}-500`
            } opacity-60 pointer-events-none`}
          />
          {/* Label */}
          {!isTiny && (
            <span className="absolute inset-0 flex items-center px-2 pointer-events-none">
              <span
                className={`text-[10px] font-medium truncate ${
                  item.progress > 40
                    ? "text-white drop-shadow"
                    : `text-${color}-700`
                }`}
              >
                {item.name}
              </span>
            </span>
          )}
        </button>

        {/* Resize-Handle LEFT */}
        {canResize && (
          <div
            onMouseDown={(e) => startDrag("resize-start", e)}
            className="absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize z-10 hover:bg-black/20"
            aria-label="Startdatum verschieben"
            role="separator"
          />
        )}
        {/* Resize-Handle RIGHT */}
        {canResize && (
          <div
            onMouseDown={(e) => startDrag("resize-end", e)}
            className="absolute top-0 bottom-0 right-0 w-1 cursor-ew-resize z-10 hover:bg-black/20"
            aria-label="Enddatum verschieben"
            role="separator"
          />
        )}
      </div>

      {/* --- Puffer-Balken --------------------------------------------------
          Wenn bufferDays > 0: schraffierter, halbhoher Bereich direkt hinter
          dem Kern-Balken. Arbeitstage werden über den Faktor 7/5 grob in
          Kalendertage umgerechnet — exakt genug fürs Visual (Positionierung
          per Prozent, kein Tag-genaues Snap).
          Während Drag wird der Puffer ausgeblendet, damit er nicht mit
          resize-end-Griffen kollidiert; nach dem Drag erscheint er wieder. */}
      {item.bufferDays > 0 &&
        typeof totalDays === "number" &&
        totalDays > 0 &&
        !drag && (() => {
          const bufferCalendarDays = Math.max(1, Math.ceil((item.bufferDays * 7) / 5));
          const bufferWidthPercent = (bufferCalendarDays / totalDays) * 100;
          return (
            <div
              className="absolute top-1/2 pointer-events-none"
              style={{
                left: `calc(${left} + ${safeWidth})`,
                width: `${bufferWidthPercent}%`,
                height: 12,
                transform: "translateY(-50%)",
              }}
              aria-label={`Puffer ${item.bufferDays} Arbeitstag${item.bufferDays === 1 ? "" : "e"}`}
              title={`Puffer: ${item.bufferDays} Arbeitstag${item.bufferDays === 1 ? "" : "e"}`}
            >
              {/* Helle Basis in gleicher Farbe wie der Kern-Balken */}
              <span
                className={`absolute inset-0 rounded-sm bg-${color}-100 border border-dashed border-${color}-400 opacity-80`}
              />
              {/* Schraffur via currentColor-Trick */}
              <span
                className={`absolute inset-0 rounded-sm text-${color}-400`}
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, currentColor 0, currentColor 2px, transparent 2px, transparent 6px)",
                  opacity: 0.45,
                }}
              />
            </div>
          );
        })()}

      {(hovered || drag) && (
        <BarTooltip
          item={item}
          tradeCategory={tradeCategory}
          color={color}
          leftPercent={leftPercent}
          previewStart={previewStart}
          previewEnd={previewEnd}
          dragType={drag?.type}
          shift={drag?.shift ?? false}
        />
      )}
    </>
  );
}

// ------- Tooltip ------------------------------------------------------------

interface BarTooltipProps {
  item: ScheduleItemDTO;
  tradeCategory: TradeCategoryDTO | undefined;
  color: TerminplanColor;
  leftPercent: number;
  previewStart?: Date | null;
  previewEnd?: Date | null;
  dragType?: DragType;
  shift?: boolean;
}

function BarTooltip({
  item,
  tradeCategory,
  color,
  leftPercent,
  previewStart,
  previewEnd,
  dragType,
  shift,
}: BarTooltipProps) {
  // Tooltip rechts vom Balken, außer am Ende → dann links
  const placeLeft = leftPercent > 70;
  const displayStart = previewStart ?? new Date(item.startDate);
  const displayEnd = previewEnd ?? new Date(item.endDate);
  const isDragging = dragType !== undefined;

  return (
    <div
      className={`absolute bottom-full mb-2 z-40 pointer-events-none bg-gray-900 text-white text-xs rounded-lg shadow-lg px-3 py-2 min-w-[220px] max-w-[320px] ${
        placeLeft ? "right-0" : ""
      }`}
      style={placeLeft ? {} : { left: `${Math.max(leftPercent, 0)}%` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full bg-${color}-500 shrink-0`} />
        <span className="font-mono text-[10px] text-gray-400">{item.wbsCode}</span>
        <span className="font-semibold truncate">{item.name}</span>
      </div>
      <div className="space-y-0.5 text-gray-300 leading-snug">
        <div>
          <span className="text-gray-400">Start:</span>{" "}
          {formatDateFull(displayStart)}
          <span className="text-gray-400 ml-2">Ende:</span>{" "}
          {formatDateFull(displayEnd)}
        </div>
        {!isDragging && (
          <>
            <div>
              <span className="text-gray-400">Dauer:</span>{" "}
              {item.durationWorkdays} Arbeitstage
              {item.bufferDays > 0 && (
                <>
                  <span className="text-gray-400 ml-2">+ Puffer:</span>{" "}
                  <span className="text-amber-300">
                    {item.bufferDays} AT
                  </span>
                </>
              )}
            </div>
            <div>
              <span className="text-gray-400">Fortschritt:</span> {item.progress}{" "}
              %
            </div>
            <div>
              <span className="text-gray-400">Status:</span>{" "}
              {STATUS_LABEL[item.status]}
              {item.isDelayed && (
                <span className="ml-2 text-red-300 font-medium">Verspätet</span>
              )}
            </div>
            {tradeCategory && (
              <div>
                <span className="text-gray-400">Gewerk:</span>{" "}
                {tradeCategory.name}
              </div>
            )}
          </>
        )}
        {isDragging && (
          <div className="pt-1 mt-1 border-t border-gray-700">
            <div className="text-[10px] text-amber-300">
              {dragType === "move"
                ? shift
                  ? "Verschieben (Shift = Nachfolger mit)"
                  : "Verschieben — Shift = Nachfolger mitnehmen"
                : dragType === "resize-start"
                  ? "Startdatum ziehen"
                  : "Enddatum ziehen"}
            </div>
            <div className="text-[10px] text-gray-400">
              Esc bricht ab
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
