"use client";

/**
 * Benutzer-Verwaltung (Einstellungen).
 *
 * Aus dem OOS portiert und vereinfacht. Entfernt wurden die OOS-Features
 * Onboarding, OnboardingPlan, RoleCards und Onboarding-Progress. Dafür
 * sind die APOS-Access-Flags (`hasAposAccess`, `hasOosAccess`) hier
 * steuerbar.
 *
 * UX-Konformität (siehe UX_DESIGN_REGELN.md):
 *  - ConfirmDialog statt window.confirm/alert
 *  - Toast-Feedback nach jeder Aktion
 *  - Escape schließt Modals, Ctrl/Cmd+S speichert
 *  - Light-first Tailwind, keine manuellen dark: Klassen
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  Loader2,
  X,
  Search,
  Shield,
  Mail,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

// ---------- Types ----------------------------------------------------------

type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "DEVELOPER";

interface UserEntry {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  kuerzel: string | null;
  position: string | null;
  department: string | null;
  isExternal: boolean;
  isDisabled: boolean;
  hasOosAccess: boolean;
  hasAposAccess: boolean;
  mobileClockInAllowed: boolean;
  reasonRequiredOnShift: boolean;
  isReportRequired: boolean;
  betaMode: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

interface CreateForm {
  name: string;
  email: string;
  role: UserRole;
  kuerzel: string;
  position: string;
  department: string;
  password: string;
}

interface EditForm {
  name: string;
  email: string;
  role: UserRole;
  kuerzel: string;
  position: string;
  department: string;
  isDisabled: boolean;
  isExternal: boolean;
  hasAposAccess: boolean;
  hasOosAccess: boolean;
}

// ---------- Role-Badge ------------------------------------------------------

const ROLE_CONFIG: Record<UserRole, { label: string; classes: string }> = {
  EMPLOYEE: { label: "Mitarbeiter", classes: "bg-gray-100 text-gray-700" },
  MANAGER: { label: "Manager", classes: "bg-blue-100 text-blue-700" },
  ADMIN: { label: "Admin", classes: "bg-purple-100 text-purple-700" },
  DEVELOPER: { label: "Developer", classes: "bg-rose-100 text-rose-700" },
};

const ROLE_OPTIONS: ReadonlyArray<UserRole> = [
  "EMPLOYEE",
  "MANAGER",
  "ADMIN",
  "DEVELOPER",
];

// ---------- Avatar-Farben (deterministisch via Hash) -----------------------

const AVATAR_PALETTE = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
  "bg-violet-500",
  "bg-teal-500",
] as const;

function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function avatarInitials(user: UserEntry): string {
  if (user.kuerzel) return user.kuerzel;
  const parts = user.name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ---------- Helper ----------------------------------------------------------

const EMPTY_CREATE: CreateForm = {
  name: "",
  email: "",
  role: "EMPLOYEE",
  kuerzel: "",
  position: "",
  department: "",
  password: "",
};

function isUserRole(role: string): role is UserRole {
  return (ROLE_OPTIONS as ReadonlyArray<string>).includes(role);
}

// ---------- Page ------------------------------------------------------------

export default function BenutzerPage() {
  const { data: session } = useSession();
  const { toast } = useToast();

  const currentUserId = session?.user?.id;
  const currentRole = (session?.user?.role ?? "EMPLOYEE") as UserRole;
  const canManage = currentRole === "ADMIN" || currentRole === "DEVELOPER";
  const canEdit = canManage || currentRole === "MANAGER";

  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");
  const [onlyActive, setOnlyActive] = useState(false);

  // Create-Modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);

  // Edit-Modal
  const [editUser, setEditUser] = useState<UserEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Password-Reset
  const [resetUser, setResetUser] = useState<UserEntry | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetSaving, setResetSaving] = useState(false);

  // Delete
  const [confirmDelete, setConfirmDelete] = useState<UserEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ---------- Data Fetch ---------------------------------------------------

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen/benutzer");
      if (res.ok) {
        const data = (await res.json()) as UserEntry[];
        setUsers(data);
      } else {
        toast({
          variant: "error",
          title: "Laden fehlgeschlagen",
          description: "Benutzerliste konnte nicht geladen werden.",
        });
      }
    } catch {
      toast({
        variant: "error",
        title: "Netzwerkfehler",
        description: "Bitte später erneut versuchen.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ---------- Filter -------------------------------------------------------

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (onlyActive && u.isDisabled) return false;
      if (q) {
        const hay = `${u.name} ${u.email} ${u.position ?? ""} ${u.department ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, onlyActive]);

  // ---------- Create -------------------------------------------------------

  const openCreate = useCallback(() => {
    setCreateForm(EMPTY_CREATE);
    setShowCreate(true);
  }, []);

  const closeCreate = useCallback(() => {
    if (creating) return;
    setShowCreate(false);
    setCreateForm(EMPTY_CREATE);
  }, [creating]);

  const submitCreate = useCallback(async () => {
    if (creating) return;
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast({
        variant: "error",
        title: "Pflichtfelder fehlen",
        description: "Name und E-Mail sind erforderlich.",
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/einstellungen/benutzer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          role: createForm.role,
          kuerzel: createForm.kuerzel.trim() || undefined,
          position: createForm.position.trim() || undefined,
          department: createForm.department.trim() || undefined,
          password: createForm.password.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast({
          variant: "success",
          title: "Benutzer angelegt",
          description: createForm.password.trim()
            ? "Mit gesetztem Passwort."
            : "Passwort: Passwort123! (bitte ändern)",
        });
        setShowCreate(false);
        setCreateForm(EMPTY_CREATE);
        await fetchUsers();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          variant: "error",
          title: "Anlegen fehlgeschlagen",
          description: err.error ?? "Bitte erneut versuchen.",
        });
      }
    } finally {
      setCreating(false);
    }
  }, [createForm, creating, fetchUsers, toast]);

  // ---------- Edit ---------------------------------------------------------

  const openEdit = useCallback((u: UserEntry) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      kuerzel: u.kuerzel ?? "",
      position: u.position ?? "",
      department: u.department ?? "",
      isDisabled: u.isDisabled,
      isExternal: u.isExternal,
      hasAposAccess: u.hasAposAccess,
      hasOosAccess: u.hasOosAccess,
    });
  }, []);

  const closeEdit = useCallback(() => {
    if (editSaving) return;
    setEditUser(null);
    setEditForm(null);
  }, [editSaving]);

  const submitEdit = useCallback(async () => {
    if (!editUser || !editForm || editSaving) return;
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast({
        variant: "error",
        title: "Pflichtfelder fehlen",
        description: "Name und E-Mail sind erforderlich.",
      });
      return;
    }

    setEditSaving(true);
    try {
      // Selbst-Edit: Nur eigene Basis-Daten senden. Manager+: alles, außer
      // wenn nicht Admin — dann keine Rolle/Access-Flags (die Route lehnt
      // das ohnehin ab, wir schicken sie dann gar nicht erst).
      const isSelf = editUser.id === currentUserId;
      const body: Record<string, unknown> = {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        kuerzel: editForm.kuerzel.trim(),
        position: editForm.position.trim(),
        department: editForm.department.trim(),
      };

      if (canManage) {
        body.role = editForm.role;
        body.isExternal = editForm.isExternal;
        body.hasAposAccess = editForm.hasAposAccess;
        body.hasOosAccess = editForm.hasOosAccess;
      }
      if (!isSelf && canEdit) {
        body.isDisabled = editForm.isDisabled;
      }

      const res = await fetch(
        `/api/einstellungen/benutzer/${editUser.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (res.ok) {
        toast({ variant: "success", title: "Benutzer aktualisiert" });
        setEditUser(null);
        setEditForm(null);
        await fetchUsers();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          variant: "error",
          title: "Speichern fehlgeschlagen",
          description: err.error ?? "Bitte erneut versuchen.",
        });
      }
    } finally {
      setEditSaving(false);
    }
  }, [editUser, editForm, editSaving, canManage, canEdit, currentUserId, fetchUsers, toast]);

  // ---------- Password Reset ----------------------------------------------

  const openReset = useCallback((u: UserEntry) => {
    setResetUser(u);
    setResetPw("");
  }, []);

  const closeReset = useCallback(() => {
    if (resetSaving) return;
    setResetUser(null);
    setResetPw("");
  }, [resetSaving]);

  const submitReset = useCallback(async () => {
    if (!resetUser || resetSaving) return;
    if (!resetPw.trim() || resetPw.trim().length < 6) {
      toast({
        variant: "error",
        title: "Passwort zu kurz",
        description: "Mindestens 6 Zeichen.",
      });
      return;
    }
    setResetSaving(true);
    try {
      const res = await fetch(
        `/api/einstellungen/benutzer/${resetUser.id}/password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: resetPw.trim() }),
        },
      );
      if (res.ok) {
        toast({ variant: "success", title: "Passwort aktualisiert" });
        setResetUser(null);
        setResetPw("");
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          variant: "error",
          title: "Passwort-Reset fehlgeschlagen",
          description: err.error ?? "Bitte erneut versuchen.",
        });
      }
    } finally {
      setResetSaving(false);
    }
  }, [resetUser, resetSaving, resetPw, toast]);

  // ---------- Delete -------------------------------------------------------

  const handleDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/einstellungen/benutzer/${confirmDelete.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        toast({
          variant: "success",
          title: `Benutzer "${confirmDelete.name}" gelöscht`,
        });
        setConfirmDelete(null);
        await fetchUsers();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({
          variant: "error",
          title: "Löschen fehlgeschlagen",
          description: err.error ?? "Bitte erneut versuchen.",
        });
      }
    } finally {
      setDeleting(false);
    }
  }, [confirmDelete, fetchUsers, toast]);

  // ---------- Keyboard-Shortcuts ------------------------------------------

  useEffect(() => {
    if (!showCreate && !editUser && !resetUser) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showCreate) closeCreate();
        else if (editUser) closeEdit();
        else if (resetUser) closeReset();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (showCreate) void submitCreate();
        else if (editUser) void submitEdit();
        else if (resetUser) void submitReset();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    showCreate,
    editUser,
    resetUser,
    closeCreate,
    closeEdit,
    closeReset,
    submitCreate,
    submitEdit,
    submitReset,
  ]);

  // ---------- Render -------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Benutzer</h1>
            <p className="text-sm text-gray-500">
              {users.length} {users.length === 1 ? "Benutzer" : "Benutzer"}
            </p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Benutzer anlegen
          </button>
        )}
      </div>

      {/* Filter-Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name oder E-Mail suchen..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            const v = e.target.value;
            setRoleFilter(v === "ALL" ? "ALL" : (v as UserRole));
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
        >
          <option value="ALL">Alle Rollen</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {ROLE_CONFIG[r].label}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyActive}
            onChange={(e) => setOnlyActive(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
          />
          Nur aktive
        </label>
      </div>

      {/* Tabelle */}
      {filteredUsers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Keine Benutzer gefunden
          </h2>
          <p className="text-sm text-gray-500">
            Passe die Filter an oder lege einen neuen Benutzer an.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[auto_2fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200 items-center">
            <div className="w-8" />
            <div>Name / E-Mail</div>
            <div>Rolle</div>
            <div>Position</div>
            <div className="pl-2">Zugriff</div>
            <div className="pl-2">Status</div>
            <div className="pl-2 pr-1">Aktionen</div>
          </div>
          {filteredUsers.map((u) => {
            const cfg = ROLE_CONFIG[u.role];
            const isSelf = u.id === currentUserId;
            return (
              <div
                key={u.id}
                className="grid grid-cols-[auto_2fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-3 items-center border-t border-gray-100 hover:bg-gray-50 transition-colors first:border-t-0"
              >
                {/* Avatar */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold ${avatarColor(u.id)}`}
                  title={u.name}
                >
                  {avatarInitials(u)}
                </div>

                {/* Name + E-Mail */}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate flex items-center gap-2">
                    {u.name}
                    {isSelf && (
                      <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                        Du
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {u.email}
                  </div>
                </div>

                {/* Rolle */}
                <div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${cfg.classes}`}
                  >
                    <Shield className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>

                {/* Position */}
                <div className="text-xs text-gray-600 truncate">
                  {u.position ?? "—"}
                </div>

                {/* Zugriff */}
                <div className="flex items-center gap-1">
                  {u.hasAposAccess && (
                    <span className="text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">
                      APOS
                    </span>
                  )}
                  {u.hasOosAccess && (
                    <span className="text-[10px] font-medium bg-blue-100 text-blue-700 rounded px-1.5 py-0.5">
                      OOS
                    </span>
                  )}
                </div>

                {/* Status */}
                <div>
                  {u.isDisabled ? (
                    <span className="text-[11px] font-medium bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                      Deaktiviert
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5">
                      Aktiv
                    </span>
                  )}
                </div>

                {/* Aktionen */}
                <div className="flex items-center gap-1 pr-1">
                  {(canEdit || isSelf) && (
                    <button
                      onClick={() => openEdit(u)}
                      title="Bearbeiten"
                      className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 flex items-center justify-center transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => openReset(u)}
                      title="Passwort zurücksetzen"
                      className="w-8 h-8 rounded-lg text-gray-400 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center transition-colors"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && !isSelf && (
                    <button
                      onClick={() => setConfirmDelete(u)}
                      title="Löschen"
                      className="w-8 h-8 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- Create-Modal ---------- */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeCreate}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                Benutzer anlegen
              </h2>
              <button
                onClick={closeCreate}
                disabled={creating}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitCreate();
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Vorname Nachname"
                    autoFocus
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-Mail *
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="name@apricus-solar.de"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rolle
                  </label>
                  <select
                    value={createForm.role}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (isUserRole(v)) {
                        setCreateForm((f) => ({ ...f, role: v }));
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                  >
                    {ROLE_OPTIONS.map((r) => {
                      // DEVELOPER nur für DEVELOPER verfügbar
                      if (r === "DEVELOPER" && currentRole !== "DEVELOPER") {
                        return null;
                      }
                      return (
                        <option key={r} value={r}>
                          {ROLE_CONFIG[r].label}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kürzel (max 3)
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={createForm.kuerzel}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        kuerzel: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase"
                    placeholder="ABC"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <input
                    type="text"
                    value={createForm.position}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, position: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Projektleiter"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abteilung
                  </label>
                  <input
                    type="text"
                    value={createForm.department}
                    onChange={(e) =>
                      setCreateForm((f) => ({
                        ...f,
                        department: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Bauleitung"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Passwort (optional)
                  </label>
                  <input
                    type="text"
                    value={createForm.password}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Wenn leer: Passwort123!"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Leer lassen für Standard-Passwort „Passwort123!".
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeCreate}
                  disabled={creating}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  Anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Edit-Modal ---------- */}
      {editUser && editForm && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeEdit}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">
                Benutzer bearbeiten
              </h2>
              <button
                onClick={closeEdit}
                disabled={editSaving}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitEdit();
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, name: e.target.value } : f))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-Mail *
                  </label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm((f) => (f ? { ...f, email: e.target.value } : f))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required
                  />
                </div>
                {canManage && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rolle
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (isUserRole(v)) {
                          setEditForm((f) => (f ? { ...f, role: v } : f));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                    >
                      {ROLE_OPTIONS.map((r) => {
                        if (r === "DEVELOPER" && currentRole !== "DEVELOPER") {
                          return null;
                        }
                        return (
                          <option key={r} value={r}>
                            {ROLE_CONFIG[r].label}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kürzel (max 3)
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={editForm.kuerzel}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, kuerzel: e.target.value.toUpperCase() } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <input
                    type="text"
                    value={editForm.position}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, position: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Abteilung
                  </label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((f) =>
                        f ? { ...f, department: e.target.value } : f,
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              {canManage && (
                <div className="pt-4 border-t border-gray-100 space-y-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Zugriff & Flags
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editForm.hasAposAccess}
                      onChange={(e) =>
                        setEditForm((f) =>
                          f ? { ...f, hasAposAccess: e.target.checked } : f,
                        )
                      }
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    APOS-Zugriff
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editForm.hasOosAccess}
                      onChange={(e) =>
                        setEditForm((f) =>
                          f ? { ...f, hasOosAccess: e.target.checked } : f,
                        )
                      }
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    OOS-Zugriff
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={editForm.isExternal}
                      onChange={(e) =>
                        setEditForm((f) =>
                          f ? { ...f, isExternal: e.target.checked } : f,
                        )
                      }
                      className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Externer Mitarbeiter
                  </label>
                  {editUser.id !== currentUserId && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editForm.isDisabled}
                        onChange={(e) =>
                          setEditForm((f) =>
                            f ? { ...f, isDisabled: e.target.checked } : f,
                          )
                        }
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      Deaktiviert (kein Login möglich)
                    </label>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={editSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Password-Reset-Modal ---------- */}
      {resetUser && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={closeReset}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Passwort zurücksetzen
              </h2>
              <button
                onClick={closeReset}
                disabled={resetSaving}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                aria-label="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitReset();
              }}
              className="p-6 space-y-4"
            >
              <p className="text-sm text-gray-600">
                Neues Passwort für{" "}
                <span className="font-semibold">{resetUser.name}</span> setzen.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Neues Passwort *
                </label>
                <input
                  type="text"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Mindestens 6 Zeichen"
                  autoFocus
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeReset}
                  disabled={resetSaving}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {resetSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Setzen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Delete-Confirm ---------- */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Benutzer löschen?"
        description={
          confirmDelete
            ? `Benutzer „${confirmDelete.name}" wird unwiderruflich gelöscht.`
            : undefined
        }
        confirmLabel="Löschen"
        destructive
        loading={deleting}
        onCancel={() => {
          if (!deleting) setConfirmDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
