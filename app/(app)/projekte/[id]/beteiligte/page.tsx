import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  Users,
  User,
  Star,
  Building2,
  Mail,
  Phone,
  Smartphone,
  Crown,
  Shield,
  Truck,
  ArrowLeft,
  Info,
} from "lucide-react";

// ─── Typen ────────────────────────────────────────────────────────────────
// Auf dieser Seite aggregieren wir alle Personen-/Firmen-Bezüge eines
// Projekts. Da nur ein View gerendert wird, reichen lokale Typen — es gibt
// keine Form/Mutation, kein Service-Layer-Aufruf außer Prisma selbst.

type UserLite = {
  id: string;
  name: string;
  email: string;
  kuerzel: string | null;
  role: string;
  position: string | null;
  department: string | null;
};

type AvatarBadge = "manager" | "steering" | null;

// ─── Farbpalette / Helpers ────────────────────────────────────────────────
// Die Farben sind bewusst als vollständige Klassen-Strings aufgeführt, damit
// Tailwind sie beim Build nicht via Tree-Shaking wegwirft.

const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-purple-100", text: "text-purple-700" },
  { bg: "bg-pink-100", text: "text-pink-700" },
];

function initialsFromName(
  name: string | null | undefined,
  kuerzel?: string | null,
): string {
  if (kuerzel && kuerzel.trim()) {
    return kuerzel.trim().slice(0, 3).toUpperCase();
  }
  const source = (name || "").trim();
  if (!source) return "??";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function colorFromId(id: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function displayName(name: string | null | undefined, email: string): string {
  const n = (name || "").trim();
  return n.length > 0 ? n : email;
}

// ─── Badge-Konfigurationen ────────────────────────────────────────────────

const USER_ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  EMPLOYEE: { label: "Mitarbeiter", bg: "bg-gray-100", text: "text-gray-700" },
  MANAGER: { label: "Manager", bg: "bg-blue-100", text: "text-blue-700" },
  ADMIN: { label: "Admin", bg: "bg-purple-100", text: "text-purple-700" },
  DEVELOPER: { label: "Developer", bg: "bg-rose-100", text: "text-rose-700" },
};

const MEMBER_ROLE_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  READ: { label: "Leserecht", bg: "bg-gray-100", text: "text-gray-600" },
  WRITE: { label: "Schreibrecht", bg: "bg-emerald-100", text: "text-emerald-700" },
};

const CLASSIFICATION_BADGE: Record<
  string,
  { label: string; bg: string; text: string; star: boolean }
> = {
  STANDARD: { label: "Standard", bg: "bg-gray-100", text: "text-gray-700", star: false },
  IMPORTANT: { label: "Wichtig", bg: "bg-amber-100", text: "text-amber-700", star: true },
  STRATEGIC: { label: "Strategisch", bg: "bg-emerald-100", text: "text-emerald-700", star: true },
  WATCH: { label: "Beobachtung", bg: "bg-orange-100", text: "text-orange-700", star: false },
  BLOCKED: { label: "Gesperrt", bg: "bg-red-100", text: "text-red-700", star: false },
};

// ─── Sub-Komponenten (lokal, reine Presentation) ──────────────────────────

function Avatar({
  userId,
  name,
  kuerzel,
  badge,
}: {
  userId: string;
  name: string | null | undefined;
  kuerzel: string | null;
  badge: AvatarBadge;
}) {
  const color = colorFromId(userId);
  const initials = initialsFromName(name, kuerzel);
  return (
    <div className="relative shrink-0">
      <div
        className={`w-10 h-10 rounded-full ${color.bg} ${color.text} flex items-center justify-center font-semibold text-sm`}
        aria-hidden="true"
      >
        {initials}
      </div>
      {badge === "manager" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 ring-2 ring-white flex items-center justify-center"
          title="Projektleiter"
        >
          <Crown className="w-2.5 h-2.5 text-white" />
        </span>
      )}
      {badge === "steering" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-500 ring-2 ring-white flex items-center justify-center"
          title="Steuerkreis"
        >
          <Shield className="w-2.5 h-2.5 text-white" />
        </span>
      )}
    </div>
  );
}

function UserRoleBadge({ role }: { role: string }) {
  const cfg = USER_ROLE_BADGE[role] ?? USER_ROLE_BADGE.EMPLOYEE;
  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function MemberRoleBadge({ role }: { role: string }) {
  const cfg = MEMBER_ROLE_BADGE[role] ?? MEMBER_ROLE_BADGE.READ;
  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function ClassificationBadge({ classification }: { classification: string }) {
  const cfg = CLASSIFICATION_BADGE[classification] ?? CLASSIFICATION_BADGE.STANDARD;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
    >
      {cfg.star && <Star className="w-3 h-3" />}
      {cfg.label}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 mb-3">
      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
        {children}
      </h3>
    </div>
  );
}

function UserCard({
  user,
  badge,
  extraBadges,
}: {
  user: UserLite;
  badge: AvatarBadge;
  extraBadges?: React.ReactNode;
}) {
  const name = displayName(user.name, user.email);
  const metaParts = [user.position, user.department].filter(
    (v): v is string => !!v && v.trim().length > 0,
  );
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <Avatar
        userId={user.id}
        name={user.name}
        kuerzel={user.kuerzel}
        badge={badge}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{name}</div>
        {metaParts.length > 0 && (
          <div className="text-xs text-gray-500 truncate">
            {metaParts.join(" · ")}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <UserRoleBadge role={user.role} />
          {extraBadges}
          {user.email && (
            <a
              href={`mailto:${user.email}`}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
            >
              <Mail className="w-3 h-3" />
              {user.email}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
}: {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string;
    salutation: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    isPrimary: boolean;
  };
}) {
  const fullName = [contact.salutation, contact.firstName, contact.lastName]
    .filter((v): v is string => !!v && v.trim().length > 0)
    .join(" ");
  const color = colorFromId(contact.id);
  const initials = initialsFromName(
    `${contact.firstName ?? ""} ${contact.lastName}`.trim(),
    null,
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
      <div className="relative shrink-0">
        <div
          className={`w-10 h-10 rounded-full ${color.bg} ${color.text} flex items-center justify-center font-semibold text-sm`}
          aria-hidden="true"
        >
          {initials}
        </div>
        {contact.isPrimary && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 ring-2 ring-white flex items-center justify-center"
            title="Hauptansprechpartner"
          >
            <Star className="w-2.5 h-2.5 text-white" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900 truncate">{fullName}</div>
          {contact.isPrimary && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              Hauptansprechpartner
            </span>
          )}
        </div>
        {contact.role && (
          <div className="text-xs text-gray-500 truncate">{contact.role}</div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
            >
              <Mail className="w-3 h-3" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
            >
              <Phone className="w-3 h-3" />
              {contact.phone}
            </a>
          )}
          {contact.mobile && (
            <a
              href={`tel:${contact.mobile}`}
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline"
            >
              <Smartphone className="w-3 h-3" />
              {contact.mobile}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-dashed border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-400 italic">
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function ProjectBeteiligtePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
          kuerzel: true,
          role: true,
          position: true,
          department: true,
        },
      },
      customer: {
        include: {
          contacts: true,
        },
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              kuerzel: true,
              role: true,
              position: true,
              department: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  // Steuerkreis-User separat laden, da Prisma auf einem Scalar-Array
  // (steeringCommitteeUserIds) keine Relation auflösen kann. Wir filtern
  // zusätzlich auf die Organisation, um verwaiste IDs nicht einzuschleusen.
  const steeringUsers: UserLite[] =
    project.steeringCommitteeUserIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: project.steeringCommitteeUserIds },
            organizationId: session.user.organizationId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            kuerzel: true,
            role: true,
            position: true,
            department: true,
          },
          orderBy: { name: "asc" },
        })
      : [];

  // Hauptansprechpartner zuerst, dann nach Nachnamen.
  const contacts = [...(project.customer?.contacts ?? [])].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return (a.lastName || "").localeCompare(b.lastName || "", "de");
  });

  const total =
    1 + // Projektleiter
    steeringUsers.length +
    project.members.length +
    (project.customer ? 1 : 0) +
    contacts.length;

  return (
    <div className="max-w-5xl">
      {/* Back link */}
      <Link
        href={`/projekte/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zum Projekt
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
          <Users className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Beteiligte</h1>
          <p className="text-sm text-gray-500">
            {total} {total === 1 ? "Beteiligter" : "Beteiligte"} im Projekt
            „{project.name}"
          </p>
        </div>
      </div>

      {/* ─── Interne Beteiligte ─────────────────────────────────── */}
      <section className="mb-8">
        <SectionTitle>Intern</SectionTitle>

        {/* Projektleiter */}
        <div className="mb-5">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Projektleiter
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <UserCard user={project.manager} badge="manager" />
          </div>
        </div>

        {/* Steuerkreis */}
        <div className="mb-5">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Steuerkreis ({steeringUsers.length})
          </h4>
          {steeringUsers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {steeringUsers.map((u) => (
                <UserCard key={u.id} user={u} badge="steering" />
              ))}
            </div>
          ) : (
            <EmptyHint>Noch kein Steuerkreis zugeordnet.</EmptyHint>
          )}
        </div>

        {/* Team / Mitglieder */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Team · Mitglieder ({project.members.length})
          </h4>
          {project.members.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.members.map((m) => (
                <UserCard
                  key={m.id}
                  user={m.user}
                  badge={null}
                  extraBadges={<MemberRoleBadge role={m.role} />}
                />
              ))}
            </div>
          ) : (
            <EmptyHint>
              Noch keine Projekt-Mitglieder hinterlegt.
            </EmptyHint>
          )}
        </div>
      </section>

      {/* ─── Extern ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionTitle>Extern</SectionTitle>

        {/* Auftraggeber */}
        <div className="mb-5">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Auftraggeber
          </h4>
          {project.customer ? (
            <Link
              href={`/kunden/${project.customer.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md hover:border-gray-300 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {project.customer.companyName}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {[project.customer.city, project.customer.country]
                      .filter(
                        (v): v is string => !!v && v.trim().length > 0,
                      )
                      .join(" · ") || "Keine Adresse hinterlegt"}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ClassificationBadge
                      classification={project.customer.classification}
                    />
                    {project.customer.email && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Mail className="w-3 h-3" />
                        {project.customer.email}
                      </span>
                    )}
                    {project.customer.phone && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <Phone className="w-3 h-3" />
                        {project.customer.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ) : project.clientName ? (
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {project.clientName}
                </div>
                <div className="text-xs text-gray-400 italic">
                  Noch nicht mit einem Kunden-Datensatz verknüpft.
                </div>
              </div>
            </div>
          ) : (
            <EmptyHint>Kein Auftraggeber hinterlegt.</EmptyHint>
          )}
        </div>

        {/* Ansprechpartner beim Kunden */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            Ansprechpartner beim Kunden ({contacts.length})
          </h4>
          {contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contacts.map((c) => (
                <ContactCard key={c.id} contact={c} />
              ))}
            </div>
          ) : (
            <EmptyHint>
              Keine Ansprechpartner beim Kunden hinterlegt.
            </EmptyHint>
          )}
        </div>
      </section>

      {/* ─── Partner & Lieferanten (Platzhalter) ────────────────── */}
      {/* #fixme #earlystage — Es gibt aktuell noch kein ExternalParticipant-
         Model im Schema. Sobald wir eines haben (vsl. mit Feldern companyName,
         type: PARTNER | SUPPLIER | SUB_CONTRACTOR, contacts[]), wird dieser
         Block analog zu „Auftraggeber + Ansprechpartner" ausgebaut. Siehe
         docs/20260418_Apos_Kontext.md §4 Datenmodell. */}
      <section className="mb-6">
        <SectionTitle>Partner &amp; Lieferanten</SectionTitle>

        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <Info className="w-4 h-4" />
          </div>
          <div className="flex-1 text-sm text-sky-900">
            <div className="font-medium mb-0.5 flex items-center gap-2">
              <Truck className="w-4 h-4 text-sky-700" />
              Noch kein Partner- oder Lieferanten-Modell angelegt
            </div>
            <p className="text-xs text-sky-800/90 leading-relaxed">
              Externe Beteiligte wie Partner, Lieferanten und Nachunternehmer
              bekommen in einem späteren Schritt ein eigenes Model
              (<code className="px-1 py-0.5 rounded bg-sky-100 text-[11px]">ExternalParticipant</code>).
              Dann werden sie hier analog zu „Auftraggeber + Ansprechpartner"
              dargestellt. Siehe{" "}
              <code className="px-1 py-0.5 rounded bg-sky-100 text-[11px]">
                #fixme #earlystage
              </code>{" "}
              im Code.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
