// Shared TypeScript-DTOs für ToDos (generisches ToDo-System, entsteht v.a.
// aus Protokoll-Punkten oder direkt).

export type TodoStatus = "OPEN" | "IN_PROGRESS" | "DONE";

export type TodoDTO = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  assignedToId: string | null;
  assignedToText: string | null;
  dueDate: string | null; // ISO oder null
  status: TodoStatus;
  sourceMeetingItemId: string | null;
  sourceMeetingId: string | null;
  workPackageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTodoInput = {
  title: string;
  description?: string | null;
  assignedToId?: string | null;
  assignedToText?: string | null;
  dueDate?: string | null; // "YYYY-MM-DD"
  status?: TodoStatus;
  sourceMeetingItemId?: string | null;
  sourceMeetingId?: string | null;
  workPackageId?: string | null;
};

export type UpdateTodoInput = Partial<CreateTodoInput>;

export type TodoListFilter = {
  status?: TodoStatus;
  assignedToId?: string;
};

// Input für "Todo aus MeetingItem erzeugen". Das Service kopiert Felder
// aus dem Item; der Aufrufer kann einzelne Felder überschreiben.
export type CreateTodoFromMeetingItemInput = {
  meetingItemId: string;
  additionalFields?: {
    title?: string;
    description?: string | null;
    assignedToId?: string | null;
    assignedToText?: string | null;
    dueDate?: string | null;
    status?: TodoStatus;
    workPackageId?: string | null;
  };
};
