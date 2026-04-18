"use client";

// Einzelner Balken / Meilenstein / Parent-Bar in der Timeline.
// Reine Präsentation — absolute positioniert innerhalb einer Zeile.

import { useState } from "react";
import type { ScheduleItemDTO, TradeCategoryDTO } from "@/lib/terminplan/types";
import { formatDateFull } from "@/lib/terminplan/time";
import { safeColor, type TerminplanColor } from "./TailwindColorSafelist";

const STATUS_LABEL: Record<ScheduleItemDTO["status"], string> = {
  OPEN: "Offen",
  IN_PROGRESS: "In Arbeit",
  DONE: "Erledigt",
};

interface GanttBarProps {
  item: ScheduleItemDTO;
  tradeCategory: TradeCategoryDTO | undefined;
  leftPercent: number;
  widthPercent: number;
  isParent: boolean;
  onClick: () => void;
}

export default function GanttBar({
  item,
  tradeCategory,
  leftPercent,
  widthPercent,
  isParent,
  onClick,
}: GanttBarProps) {
  const [hovered, setHovered] = useState(false);

  // Farbe: item.color (Override) > tradeCategory.color > "blue"
  const color: TerminplanColor = safeColor(item.color ?? tradeCategory?.color);

  const left = `${Math.max(leftPercent, 0)}%`;

  // Milestone → Raute
  if (item.isMilestone) {
    return (
      <>
        <button
          type="button"
          onClick={onClick}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center group"
          style={{ left, transform: "translate(-50%, -50%)" }}
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

  // Parent-Bar (Phase): dünner grauer Balken mit Caps
  if (isParent) {
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
          {/* Linke Cap */}
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-gray-600 rounded-l-sm" />
          {/* Rechte Cap */}
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

  // Normaler Task-Balken
  const isTiny = widthPercent < 3;
  const safeWidth = `${Math.max(widthPercent, 0.5)}%`;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`absolute top-1/2 -translate-y-1/2 rounded-md overflow-hidden text-left transition-all hover:brightness-110 hover:shadow-md ${
          item.isDelayed ? "ring-1 ring-red-400" : ""
        }`}
        style={{
          left,
          width: safeWidth,
          height: 20,
          transform: "translateY(-50%)",
        }}
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
          <span className="absolute inset-0 flex items-center px-2">
            <span
              className={`text-[10px] font-medium truncate ${
                item.progress > 40 ? "text-white drop-shadow" : `text-${color}-700`
              }`}
            >
              {item.name}
            </span>
          </span>
        )}
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

// ------- Tooltip ------------------------------------------------------------

interface BarTooltipProps {
  item: ScheduleItemDTO;
  tradeCategory: TradeCategoryDTO | undefined;
  color: TerminplanColor;
  leftPercent: number;
}

function BarTooltip({ item, tradeCategory, color, leftPercent }: BarTooltipProps) {
  // Tooltip rechts vom Balken, außer am Ende → dann links
  const placeLeft = leftPercent > 70;
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
          {formatDateFull(new Date(item.startDate))}
          <span className="text-gray-400 ml-2">Ende:</span>{" "}
          {formatDateFull(new Date(item.endDate))}
        </div>
        <div>
          <span className="text-gray-400">Dauer:</span> {item.durationWorkdays}{" "}
          Arbeitstage
        </div>
        <div>
          <span className="text-gray-400">Fortschritt:</span> {item.progress} %
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
            <span className="text-gray-400">Gewerk:</span> {tradeCategory.name}
          </div>
        )}
      </div>
    </div>
  );
}
