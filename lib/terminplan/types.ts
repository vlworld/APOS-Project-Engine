// Shared TypeScript-DTOs für den Terminplan/Bauzeitenplan.
// Backend (Service + API) und Frontend (Gantt-UI) importieren aus dieser Datei,
// damit Contract konsistent bleibt.

export type ScheduleItemStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export type DependencyType = "FS" | "SS" | "FF";

// DTO wie es die API liefert (Dates als ISO-Strings, da JSON).
export type ScheduleItemDTO = {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  startDate: string; // ISO-String
  endDate: string;
  progress: number; // 0–100
  status: ScheduleItemStatus;
  tradeCategoryId: string | null;
  isMilestone: boolean;
  color: string | null;
  orderIndex: number;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;

  // Derived fields (im Service berechnet, nicht in DB):
  isDelayed: boolean; // endDate < today && status !== DONE
  durationWorkdays: number; // Arbeitstage (Mo-Fr minus Holidays)
  wbsCode: string; // z.B. "1.2.3" aus Hierarchie + orderIndex
  depth: number; // Einrückungstiefe (0 = Top-Level)
  hasChildren: boolean;
};

export type ScheduleDependencyDTO = {
  id: string;
  fromId: string;
  toId: string;
  type: DependencyType;
  lagDays: number;
};

export type TradeCategoryDTO = {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
  isSample: boolean;
};

// Input-Types (für POST/PATCH)
export type CreateScheduleItemInput = {
  parentId?: string | null;
  name: string;
  description?: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;
  progress?: number;
  status?: ScheduleItemStatus;
  tradeCategoryId?: string | null;
  isMilestone?: boolean;
  color?: string | null;
  orderIndex?: number;
  assignedToId?: string | null;
};

export type UpdateScheduleItemInput = Partial<CreateScheduleItemInput>;

export type MoveScheduleItemInput = {
  // Verschiebt startDate+endDate um X Arbeitstage (positive oder negative).
  deltaWorkdays: number;
  cascade?: boolean; // wenn true: alle Nachfolger über Dependencies auch verschieben
};

export type ReorderScheduleItemInput = {
  itemId: string;
  newParentId: string | null;
  newOrderIndex: number;
};

export type CreateDependencyInput = {
  fromId: string;
  toId: string;
  type?: DependencyType;
  lagDays?: number;
};

// Full-Tree-Response (GET /api/projekte/[id]/terminplan)
export type TerminplanResponseDTO = {
  items: ScheduleItemDTO[];
  dependencies: ScheduleDependencyDTO[];
  tradeCategories: TradeCategoryDTO[];
  projectStart: string; // Projekt-startDate oder min(items.startDate)
  projectEnd: string;
};

// SSE-Event-Types für Realtime
export type ScheduleEvent =
  | { type: "item.created"; payload: ScheduleItemDTO }
  | { type: "item.updated"; payload: ScheduleItemDTO }
  | { type: "item.deleted"; payload: { id: string } }
  | { type: "item.moved"; payload: { ids: string[] } } // mehrere IDs bei Cascade
  | { type: "dep.created"; payload: ScheduleDependencyDTO }
  | { type: "dep.deleted"; payload: { id: string } }
  | { type: "refetch"; payload: null }; // globaler Force-Refresh
