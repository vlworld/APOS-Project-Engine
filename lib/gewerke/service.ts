import { prisma } from "@/lib/prisma";
import type { TradeCategory } from "@prisma/client";

export type CreateTradeCategoryInput = {
  name: string;
  color: string;
};

export type UpdateTradeCategoryInput = {
  name?: string;
  color?: string;
  orderIndex?: number;
};

export async function listTradeCategories(
  organizationId: string,
): Promise<TradeCategory[]> {
  return prisma.tradeCategory.findMany({
    where: { organizationId },
    orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
  });
}

export async function createTradeCategory(
  organizationId: string,
  input: CreateTradeCategoryInput,
): Promise<TradeCategory> {
  const name = input.name.trim();
  if (!name) throw new Error("Name darf nicht leer sein");
  if (!input.color) throw new Error("Farbe ist pflicht");

  const lastOrder = await prisma.tradeCategory.aggregate({
    where: { organizationId },
    _max: { orderIndex: true },
  });
  const nextOrder = (lastOrder._max.orderIndex ?? -1) + 1;

  try {
    return await prisma.tradeCategory.create({
      data: {
        organizationId,
        name,
        color: input.color,
        orderIndex: nextOrder,
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      throw new Error("Ein Gewerk mit diesem Namen existiert bereits");
    }
    throw err;
  }
}

export async function updateTradeCategory(
  organizationId: string,
  id: string,
  input: UpdateTradeCategoryInput,
): Promise<TradeCategory | null> {
  const existing = await prisma.tradeCategory.findFirst({
    where: { id, organizationId },
  });
  if (!existing) return null;

  try {
    return await prisma.tradeCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name.trim() }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      throw new Error("Ein Gewerk mit diesem Namen existiert bereits");
    }
    throw err;
  }
}

export async function deleteTradeCategory(
  organizationId: string,
  id: string,
): Promise<boolean> {
  const result = await prisma.tradeCategory.deleteMany({
    where: { id, organizationId },
  });
  return result.count > 0;
}

export async function bulkImportSampleTradeCategories(
  organizationId: string,
  samples: ReadonlyArray<{ name: string; color: string; orderIndex: number }>,
): Promise<number> {
  const result = await prisma.tradeCategory.createMany({
    data: samples.map((s) => ({
      organizationId,
      name: s.name,
      color: s.color,
      orderIndex: s.orderIndex,
      isSample: true,
    })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function deleteAllSampleTradeCategories(
  organizationId: string,
): Promise<number> {
  const result = await prisma.tradeCategory.deleteMany({
    where: { organizationId, isSample: true },
  });
  return result.count;
}
