"use client";

// ─── ProjectMembersPanel ────────────────────────────────────────────────────
//
// Wiederverwendbare Mitglieder-Verwaltung für ein Projekt. Holt sich alle
// Daten selbst über die Mitglieder-API — Integration von außen ist nur
// projectId + canManage. Kann in der Projekt-Detailseite, einem Drawer oder
// einer Settings-Seite eingebettet werden.
//
// UX:
// - Projekt-Manager steht immer oben, mit blauem "Manager"-Badge, nicht
//   editierbar/entfernbar. Er hat implizit Schreibrecht.
// - Reguläre Mitglieder mit Rollen-Badge (READ/WRITE) und bei canManage
//   einem Dropdown zum Ändern + X-Icon zum Entfernen.
// - Hinzufügen via Modal mit User-Dropdown (nur Kollegen aus derselben
//   Organisation, die noch nicht Mitglied sind) und Rolle (default WRITE).
// - Bestätigung beim Entfernen über ConfirmDialog, Feedback über Toast.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, UserMinus, Users, X } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

// ─── Types ──────────────────────────────────────────────────────────────────

type MemberRole = "READ" | "WRITE";

interface ApiMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    kuerzel: string | null;
    role: string;
  };
  role: MemberRole;
  createdAt: string;
}

interface ApiAddableUser {
  id: string;
  name: string;
  email: string;
  kuerzel: string | null;
  role: string;
}

interface ApiProject {
  id: string;
  name: string;
  managerId: string;
  manager: { id: string; name: string; email: string };
}

interface ProjectMembersPanelProps {
  projectId: string;
  canManage: boolean;
}

// ─── Avatar-Helper ──────────────────────────────────────────────────────────

const AVATAR_PALETTE: ReadonlyArray<{ bg: string; text: string }> = [
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700" },
  { bg: "bg-lime-100", text: "text-lime-700" },
];

function avatarColorsFor(seed: string): { bg: string; text: string } {
  // Stabile Farbe je User: Summe der Char-Codes mod Palette. Kein Hash-Lib
  // nötig, und Ergebnis ist deterministisch über Renderings hinweg.
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function initialsFor(name: string, kuerzel: string | null): string {
  if (kuerzel && kuerzel.trim().length > 0) return kuerzel.trim().slice(0, 3).toUpperCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, kuerzel }: { name: string; kuerzel: string | null }) {
  const colors = avatarColorsFor(name);
  return (
    <div
      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${colors.bg} ${colors.text}`}
      aria-hidden="true"
    >
      {initialsFor(name, kuerzel)}
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export default function ProjectMembersPanel({
  projectId,
  canManage,
}: ProjectMembersPanelProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [members, setMembers] = useState<ApiMember[]>([]);
  const [project, setProject] = useState<ApiProject | null>(null);

  // Aktionen in Flight (Rolle ändern / entfernen) — damit Buttons deaktivieren.
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Entfernen-Bestätigung
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<ApiMember | null>(
    null,
  );
  const [removing, setRemoving] = useState(false);

  // Hinzufügen-Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addableUsers, setAddableUsers] = useState<ApiAddableUser[] | null>(
    null,
  );
  const [addableLoading, setAddableLoading] = useState(false);
  const [addSelectedUserId, setAddSelectedUserId] = useState<string>("");
  const [addSelectedRole, setAddSelectedRole] = useState<MemberRole>("WRITE");
  const [adding, setAdding] = useState(false);

  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // ─── Daten laden ──────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [projectRes, membersRes] = await Promise.all([
        fetch(`/api/projekte/${projectId}`, { cache: "no-store" }),
        fetch(`/api/projekte/${projectId}/mitglieder`, { cache: "no-store" }),
      ]);

      if (!projectRes.ok) {
        throw new Error(`Projekt konnte nicht geladen werden (${projectRes.status})`);
      }
      if (!membersRes.ok) {
        throw new Error(`Mitglieder konnten nicht geladen werden (${membersRes.status})`);
      }

      const projectData = (await projectRes.json()) as ApiProject;
      const membersData = (await membersRes.json()) as { members: ApiMember[] };

      if (!mountedRef.current) return;
      setProject(projectData);
      setMembers(membersData.members);
    } catch (err) {
      if (!mountedRef.current) return;
      setLoadError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ─── Addable Users (lazy, wenn Add-Modal geöffnet wird) ───────────────────

  const loadAddable = useCallback(async () => {
    setAddableLoading(true);
    try {
      const res = await fetch(
        `/api/projekte/${projectId}/mitglieder/addable`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        throw new Error(`Liste konnte nicht geladen werden (${res.status})`);
      }
      const data = (await res.json()) as { users: ApiAddableUser[] };
      if (!mountedRef.current) return;
      setAddableUsers(data.users);
      setAddSelectedUserId(data.users[0]?.id ?? "");
    } catch (err) {
      if (!mountedRef.current) return;
      toast({
        title: "Fehler",
        description:
          err instanceof Error
            ? err.message
            : "Liste der hinzufügbaren Nutzer konnte nicht geladen werden.",
        variant: "error",
      });
      setAddableUsers([]);
    } finally {
      if (mountedRef.current) setAddableLoading(false);
    }
  }, [projectId, toast]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  async function handleRoleChange(member: ApiMember, newRole: MemberRole) {
    if (newRole === member.role) return;
    setPendingUserId(member.userId);
    try {
      const res = await fetch(
        `/api/projekte/${projectId}/mitglieder/${member.userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: newRole }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Update fehlgeschlagen (${res.status})`);
      }
      const data = (await res.json()) as { member: ApiMember };
      setMembers((prev) =>
        prev.map((m) => (m.userId === member.userId ? data.member : m)),
      );
      toast({
        title: "Rolle aktualisiert",
        description: `${member.user.name} ist jetzt ${
          newRole === "WRITE" ? "schreibberechtigt" : "nur lesend"
        }.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description:
          err instanceof Error ? err.message : "Rolle konnte nicht geändert werden.",
        variant: "error",
      });
    } finally {
      if (mountedRef.current) setPendingUserId(null);
    }
  }

  async function handleRemoveConfirmed() {
    if (!confirmRemoveUser) return;
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/projekte/${projectId}/mitglieder/${confirmRemoveUser.userId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Entfernen fehlgeschlagen (${res.status})`);
      }
      const removedName = confirmRemoveUser.user.name;
      setMembers((prev) =>
        prev.filter((m) => m.userId !== confirmRemoveUser.userId),
      );
      setConfirmRemoveUser(null);
      toast({
        title: "Mitglied entfernt",
        description: `${removedName} hat keinen Zugriff mehr auf dieses Projekt.`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: "Fehler",
        description:
          err instanceof Error ? err.message : "Mitglied konnte nicht entfernt werden.",
        variant: "error",
      });
    } finally {
      if (mountedRef.current) setRemoving(false);
    }
  }

  async function handleAddSubmit() {
    if (!addSelectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projekte/${projectId}/mitglieder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: addSelectedUserId,
          role: addSelectedRole,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Hinzufügen fehlgeschlagen (${res.status})`);
      }
      const data = (await res.json()) as { member: ApiMember };
      setMembers((prev) => [...prev, data.member]);
      toast({
        title: "Mitglied hinzugefügt",
        description: `${data.member.user.name} ist jetzt ${
          addSelectedRole === "WRITE" ? "schreibberechtigtes" : "lesendes"
        } Mitglied.`,
        variant: "success",
      });
      closeAddModal();
    } catch (err) {
      toast({
        title: "Fehler",
        description:
          err instanceof Error ? err.message : "Mitglied konnte nicht hinzugefügt werden.",
        variant: "error",
      });
    } finally {
      if (mountedRef.current) setAdding(false);
    }
  }

  function openAddModal() {
    setAddOpen(true);
    setAddSelectedRole("WRITE");
    setAddableUsers(null);
    setAddSelectedUserId("");
    void loadAddable();
  }

  function closeAddModal() {
    if (adding) return;
    setAddOpen(false);
  }

  // Escape schließt das Add-Modal.
  useEffect(() => {
    if (!addOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAddModal();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addOpen, adding]);

  // Body-Scroll sperren, solange das Add-Modal offen ist.
  useEffect(() => {
    if (!addOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [addOpen]);

  // ─── Rendering ────────────────────────────────────────────────────────────

  const memberCount = members.length + (project ? 1 : 0);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.user.name.localeCompare(b.user.name, "de")),
    [members],
  );

  return (
    <section
      className="bg-white rounded-2xl border border-gray-200 p-5"
      aria-label="Projekt-Mitglieder"
    >
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">
            Mitglieder
            {!loading && !loadError && (
              <span className="ml-2 text-xs text-gray-500 font-normal">
                ({memberCount})
              </span>
            )}
          </h3>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openAddModal}
            disabled={loading || !!loadError}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            Mitglied hinzufügen
          </button>
        )}
      </header>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Lade Mitglieder…
        </div>
      )}

      {!loading && loadError && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
          {loadError}
          <button
            type="button"
            onClick={() => void loadAll()}
            className="ml-2 underline hover:text-red-700"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !loadError && (
        <ul className="divide-y divide-gray-100">
          {project && (
            <li className="flex items-center gap-3 py-3">
              <Avatar name={project.manager.name} kuerzel={null} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {project.manager.name}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                    Manager
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700">
                    Schreibrecht
                  </span>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {project.manager.email}
                </div>
              </div>
            </li>
          )}

          {sortedMembers.map((m) => {
            const isPending = pendingUserId === m.userId;
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.user.name} kuerzel={m.user.kuerzel} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {m.user.name}
                    </span>
                    <RoleBadge role={m.role} />
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {m.user.email}
                  </div>
                </div>

                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={m.role}
                      onChange={(e) =>
                        void handleRoleChange(m, e.target.value as MemberRole)
                      }
                      disabled={isPending}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
                      aria-label={`Rolle von ${m.user.name} ändern`}
                    >
                      <option value="READ">Leserecht</option>
                      <option value="WRITE">Schreibrecht</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveUser(m)}
                      disabled={isPending}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      aria-label={`${m.user.name} entfernen`}
                      title="Entfernen"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserMinus className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </li>
            );
          })}

          {sortedMembers.length === 0 && (
            <li className="text-xs text-gray-500 py-3">
              {canManage
                ? "Noch keine weiteren Mitglieder. Füge Kolleg:innen über „Mitglied hinzufügen“ hinzu."
                : "Noch keine weiteren Mitglieder."}
            </li>
          )}
        </ul>
      )}

      {/* Bestätigung Entfernen */}
      <ConfirmDialog
        open={!!confirmRemoveUser}
        title="Mitglied entfernen?"
        description={
          confirmRemoveUser
            ? `${confirmRemoveUser.user.name} verliert den Zugriff auf dieses Projekt. Diese Aktion lässt sich jederzeit rückgängig machen, indem die Person erneut hinzugefügt wird.`
            : undefined
        }
        confirmLabel="Entfernen"
        destructive
        loading={removing}
        onCancel={() => {
          if (!removing) setConfirmRemoveUser(null);
        }}
        onConfirm={handleRemoveConfirmed}
      />

      {/* Hinzufügen-Modal */}
      {addOpen && (
        <AddMemberModal
          addableUsers={addableUsers}
          loading={addableLoading}
          adding={adding}
          selectedUserId={addSelectedUserId}
          selectedRole={addSelectedRole}
          onUserChange={setAddSelectedUserId}
          onRoleChange={setAddSelectedRole}
          onClose={closeAddModal}
          onSubmit={handleAddSubmit}
        />
      )}
    </section>
  );
}

// ─── RoleBadge ──────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: MemberRole }) {
  const config: Record<MemberRole, { label: string; bg: string; text: string }> =
    {
      READ: {
        label: "Leserecht",
        bg: "bg-gray-100",
        text: "text-gray-600",
      },
      WRITE: {
        label: "Schreibrecht",
        bg: "bg-emerald-100",
        text: "text-emerald-700",
      },
    };
  const c = config[role];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}

// ─── Add-Member-Modal ───────────────────────────────────────────────────────

interface AddMemberModalProps {
  addableUsers: ApiAddableUser[] | null;
  loading: boolean;
  adding: boolean;
  selectedUserId: string;
  selectedRole: MemberRole;
  onUserChange: (id: string) => void;
  onRoleChange: (role: MemberRole) => void;
  onClose: () => void;
  onSubmit: () => void | Promise<void>;
}

function AddMemberModal({
  addableUsers,
  loading,
  adding,
  selectedUserId,
  selectedRole,
  onUserChange,
  onRoleChange,
  onClose,
  onSubmit,
}: AddMemberModalProps) {
  const canSubmit = !!selectedUserId && !adding && !loading;

  function handleOverlayClick() {
    if (!adding) onClose();
  }

  function handleCardClick(e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      role="presentation"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between mb-4">
          <h3
            id="add-member-title"
            className="text-lg font-semibold text-gray-900"
          >
            Mitglied hinzufügen
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="add-member-user"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Nutzer
            </label>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Lade Nutzerliste…
              </div>
            )}
            {!loading && addableUsers && addableUsers.length === 0 && (
              <div className="text-sm text-gray-500 py-2">
                Alle Kolleg:innen sind bereits Mitglied dieses Projekts.
              </div>
            )}
            {!loading && addableUsers && addableUsers.length > 0 && (
              <select
                id="add-member-user"
                value={selectedUserId}
                onChange={(e) => onUserChange(e.target.value)}
                disabled={adding}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-50"
              >
                {addableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.email}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label
              htmlFor="add-member-role"
              className="block text-xs font-medium text-gray-700 mb-1"
            >
              Rolle
            </label>
            <select
              id="add-member-role"
              value={selectedRole}
              onChange={(e) => onRoleChange(e.target.value as MemberRole)}
              disabled={adding}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:opacity-50"
            >
              <option value="WRITE">Schreibrecht (bearbeiten)</option>
              <option value="READ">Leserecht (nur ansehen)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={adding}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!canSubmit}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors inline-flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {adding && <Loader2 className="w-4 h-4 animate-spin" />}
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
