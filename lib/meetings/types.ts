// Shared TypeScript-DTOs für Protokolle (Meetings) und MeetingItems.
// Backend (Service + API) und Frontend importieren aus dieser Datei, damit
// der Contract konsistent bleibt.

export type MeetingItemStatus = "OPEN" | "IN_PROGRESS" | "DONE";

// Erlaubte Kategorien der PDF-Vorlage:
//   B = Beschluss, E = Empfehlung, F = Feststellung, I = Info, A = Arbeitsauftrag
export type MeetingItemCategory = "B" | "E" | "F" | "I" | "A";

// ─── DTOs (API-Response-Form; Dates als ISO-Strings) ────────────────────────

export type MeetingParticipantDTO = {
  id: string;
  meetingId: string;
  userId: string | null;
  externalName: string | null;
  roleText: string | null;
  orderIndex: number;
};

export type MeetingItemDTO = {
  id: string;
  meetingId: string;
  orderIndex: number;
  category: MeetingItemCategory | null;
  title: string | null;
  description: string;
  responsibleText: string | null;
  responsibleUserId: string | null;
  dueDate: string | null; // ISO-String oder null
  dueDateText: string | null;
  status: MeetingItemStatus;
  copiedFromItemId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MeetingSummaryDTO = {
  id: string;
  projectId: string;
  title: string;
  meetingDate: string; // ISO
  durationMinutes: number | null;
  location: string | null;
  area: string | null;
  isInternal: boolean;
  leaderId: string | null;
  scribeId: string | null;
  previousMeetingId: string | null;
  preparedByText: string | null;
  approvedByText: string | null;
  approvedAt: string | null;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  participantCount: number;
};

export type MeetingDetailDTO = MeetingSummaryDTO & {
  participants: MeetingParticipantDTO[];
  items: MeetingItemDTO[];
};

// ─── Input-Types ────────────────────────────────────────────────────────────

export type CreateMeetingInput = {
  projectId: string;
  title: string;
  meetingDate: string; // "YYYY-MM-DD"
  durationMinutes?: number | null;
  location?: string | null;
  area?: string | null;
  isInternal?: boolean;
  leaderId?: string | null;
  scribeId?: string | null;
  previousMeetingId?: string | null;
  preparedByText?: string | null;
  approvedByText?: string | null;
  approvedAt?: string | null; // ISO oder null
  revisionNumber?: number;
};

export type UpdateMeetingInput = Partial<Omit<CreateMeetingInput, "projectId">>;

export type CreateMeetingItemInput = {
  orderIndex?: number;
  category?: MeetingItemCategory | null;
  title?: string | null;
  description: string;
  responsibleText?: string | null;
  responsibleUserId?: string | null;
  dueDate?: string | null; // "YYYY-MM-DD" oder null
  dueDateText?: string | null;
  status?: MeetingItemStatus;
  copiedFromItemId?: string | null;
};

export type UpdateMeetingItemInput = Partial<CreateMeetingItemInput>;

export type ParticipantInput = {
  userId?: string | null;
  externalName?: string | null;
  roleText?: string | null;
  orderIndex?: number;
};
