import { prisma } from "@/lib/prisma";
import {
  SAMPLE_PV_PROJECT,
  SAMPLE_TRADE_CATEGORIES,
  getSampleHolidaysNRW,
} from "@/lib/terminplan/samples";
import { bulkImportSampleTradeCategories, deleteAllSampleTradeCategories } from "@/lib/gewerke/service";
import { bulkImportHolidays } from "@/lib/feiertage/service";

export type MusterStatus = {
  active: boolean;
  counts: {
    tradeCategories: number;
    holidays: number;
    projects: number;
    scheduleItems: number;
  };
};

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

export async function getMusterStatus(organizationId: string): Promise<MusterStatus> {
  const [tradeCats, holidays, projects] = await Promise.all([
    prisma.tradeCategory.count({ where: { organizationId, isSample: true } }),
    prisma.holiday.count({ where: { organizationId, isSample: true } }),
    prisma.project.findMany({
      where: { organizationId, isSample: true },
      select: { id: true, _count: { select: { scheduleItems: true } } },
    }),
  ]);

  const scheduleItems = projects.reduce((sum, p) => sum + p._count.scheduleItems, 0);
  const active = tradeCats > 0 || holidays > 0 || projects.length > 0;

  return {
    active,
    counts: {
      tradeCategories: tradeCats,
      holidays: holidays,
      projects: projects.length,
      scheduleItems,
    },
  };
}

export async function applyMusterData(
  organizationId: string,
  managerId: string,
): Promise<MusterStatus> {
  // 1. Gewerke importieren (skipDuplicates)
  await bulkImportSampleTradeCategories(organizationId, SAMPLE_TRADE_CATEGORIES);

  // 2. Feiertage NRW 2025-2027 importieren
  const holidays = getSampleHolidaysNRW([2025, 2026, 2027]);
  await bulkImportHolidays(organizationId, holidays, true);

  // 3. Muster-Projekt finden oder anlegen
  let project = await prisma.project.findFirst({
    where: { organizationId, isSample: true, projectNumber: SAMPLE_PV_PROJECT.project.projectNumber },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        name: SAMPLE_PV_PROJECT.project.name,
        projectNumber: `${SAMPLE_PV_PROJECT.project.projectNumber}-${Date.now().toString(36)}`,
        description: SAMPLE_PV_PROJECT.project.description,
        clientName: SAMPLE_PV_PROJECT.project.clientName,
        address: SAMPLE_PV_PROJECT.project.address,
        status: SAMPLE_PV_PROJECT.project.status,
        startDate: parseLocalDate(SAMPLE_PV_PROJECT.project.startDate),
        endDate: parseLocalDate(SAMPLE_PV_PROJECT.project.endDate),
        isSample: true,
        organizationId,
        managerId,
      },
    });
  }

  // 4. Gewerke-Lookup (Name → id)
  const tradeCats = await prisma.tradeCategory.findMany({
    where: { organizationId },
  });
  const tradeCatByName = new Map(tradeCats.map((t) => [t.name, t.id]));

  // 5. ScheduleItems nur einfügen, wenn Projekt noch keine hat
  const existingItems = await prisma.scheduleItem.count({
    where: { projectId: project.id },
  });

  if (existingItems === 0) {
    // tempId → echte id Mapping (Parents vor Children einfügen)
    const tempToId = new Map<string, string>();

    // Sortiere Items so, dass Parents vor Children kommen
    const sorted = [...SAMPLE_PV_PROJECT.items].sort((a, b) => {
      if (!a.parentTempId && b.parentTempId) return -1;
      if (a.parentTempId && !b.parentTempId) return 1;
      return 0;
    });

    // Topological: mehrfach durchlaufen, bis alle ohne Parent oder mit gemapptem Parent eingefügt
    const remaining = new Set(sorted.map((s) => s.tempId));
    while (remaining.size > 0) {
      const progressBefore = remaining.size;
      for (const tempId of Array.from(remaining)) {
        const item = sorted.find((s) => s.tempId === tempId)!;
        const parentId = item.parentTempId ? tempToId.get(item.parentTempId) : null;
        if (item.parentTempId && !parentId) continue; // parent not yet inserted

        const created = await prisma.scheduleItem.create({
          data: {
            projectId: project.id,
            parentId: parentId ?? null,
            name: item.name,
            description: item.description ?? null,
            startDate: parseLocalDate(item.startDate),
            endDate: parseLocalDate(item.endDate),
            isMilestone: item.isMilestone,
            progress: item.progress,
            status: item.status,
            orderIndex: item.orderIndex,
            tradeCategoryId: tradeCatByName.get(item.tradeCategoryName) ?? null,
          },
        });
        tempToId.set(tempId, created.id);
        remaining.delete(tempId);
      }
      if (remaining.size === progressBefore) {
        // Nothing inserted in this pass — broken references, bail out
        break;
      }
    }
  }

  return getMusterStatus(organizationId);
}

export async function removeMusterData(organizationId: string): Promise<MusterStatus> {
  // 1. Schedule-Items der Muster-Projekte werden via onDelete: Cascade mit gelöscht
  await prisma.project.deleteMany({
    where: { organizationId, isSample: true },
  });

  // 2. Feiertage (nur Sample)
  await prisma.holiday.deleteMany({
    where: { organizationId, isSample: true },
  });

  // 3. Gewerke (nur Sample, aber NUR wenn keine aktiven Items mehr zugeordnet sind)
  // Die SAMPLE-Gewerke werden via scheduleItem.tradeCategoryId verwiesen.
  // Da die Schedule-Items der Muster-Projekte weg sind, sollten die Sample-Gewerke
  // frei sein, aber User könnte sie auch für eigene Projekte benutzen.
  // Wir löschen nur die Sample-Gewerke, die in KEINEM echten Projekt verwendet werden.
  const sampleCats = await prisma.tradeCategory.findMany({
    where: { organizationId, isSample: true },
    include: { _count: { select: { scheduleItems: true } } },
  });

  const deletableIds = sampleCats.filter((c) => c._count.scheduleItems === 0).map((c) => c.id);
  if (deletableIds.length > 0) {
    await prisma.tradeCategory.deleteMany({
      where: { id: { in: deletableIds } },
    });
  }

  return getMusterStatus(organizationId);
}

// Bei „Harte Bereinigung": auch Sample-Gewerke löschen, die noch in echten Projekten benutzt werden.
// Tasks verlieren dann ihre Kategorie (tradeCategoryId wird null via ON DELETE SET NULL).
export async function forceRemoveAllSampleData(organizationId: string): Promise<MusterStatus> {
  await prisma.project.deleteMany({
    where: { organizationId, isSample: true },
  });
  await prisma.holiday.deleteMany({
    where: { organizationId, isSample: true },
  });
  await deleteAllSampleTradeCategories(organizationId);
  return getMusterStatus(organizationId);
}
