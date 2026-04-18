import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CustomerClassification = "STANDARD" | "IMPORTANT" | "STRATEGIC" | "WATCH" | "BLOCKED";

export type CustomerContactDTO = {
  id: string;
  firstName: string | null;
  lastName: string;
  salutation: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
};

export type CustomerDTO = {
  id: string;
  companyName: string;
  legalForm: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  vatId: string | null;
  classification: CustomerClassification;
  notes: string | null;
  isSample: boolean;
  createdAt: string;
  updatedAt: string;
  contacts: CustomerContactDTO[];
  projectCount: number;
  totalVolumeEur: number | null;
  firstProjectAt: string | null;
  lastProjectAt: string | null;
};

export type CreateCustomerInput = {
  companyName: string;
  legalForm?: string;
  street?: string;
  zipCode?: string;
  city?: string;
  country?: string;
  website?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  vatId?: string;
  classification?: CustomerClassification;
  notes?: string;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export type CreateCustomerContactInput = {
  lastName: string;
  firstName?: string;
  salutation?: string;
  role?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  isPrimary?: boolean;
  notes?: string;
};

export type UpdateCustomerContactInput = Partial<CreateCustomerContactInput>;

function mapContact(c: {
  id: string;
  firstName: string | null;
  lastName: string;
  salutation: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}): CustomerContactDTO {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    salutation: c.salutation,
    role: c.role,
    email: c.email,
    phone: c.phone,
    mobile: c.mobile,
    isPrimary: c.isPrimary,
    notes: c.notes,
  };
}

function mapCustomer(c: {
  id: string;
  companyName: string;
  legalForm: string | null;
  street: string | null;
  zipCode: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  taxId: string | null;
  vatId: string | null;
  classification: string;
  notes: string | null;
  isSample: boolean;
  createdAt: Date;
  updatedAt: Date;
  contacts: Array<Parameters<typeof mapContact>[0]>;
  projects: Array<{ budget: number | null; startDate: Date | null; endDate: Date | null }>;
}): CustomerDTO {
  const projectCount = c.projects.length;
  const totalVolumeEur = c.projects.reduce((sum, p) => sum + (p.budget ?? 0), 0) || null;
  const starts = c.projects.map((p) => p.startDate).filter((d): d is Date => d !== null);
  const ends = c.projects.map((p) => p.endDate).filter((d): d is Date => d !== null);
  const firstProjectAt = starts.length > 0 ? new Date(Math.min(...starts.map((d) => d.getTime()))).toISOString() : null;
  const lastProjectAt = ends.length > 0 ? new Date(Math.max(...ends.map((d) => d.getTime()))).toISOString() : null;

  return {
    id: c.id,
    companyName: c.companyName,
    legalForm: c.legalForm,
    street: c.street,
    zipCode: c.zipCode,
    city: c.city,
    country: c.country,
    website: c.website,
    phone: c.phone,
    email: c.email,
    taxId: c.taxId,
    vatId: c.vatId,
    classification: (c.classification as CustomerClassification) ?? "STANDARD",
    notes: c.notes,
    isSample: c.isSample,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    contacts: c.contacts.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map(mapContact),
    projectCount,
    totalVolumeEur,
    firstProjectAt,
    lastProjectAt,
  };
}

export async function listCustomers(organizationId: string): Promise<CustomerDTO[]> {
  const customers = await prisma.customer.findMany({
    where: { organizationId },
    include: {
      contacts: true,
      projects: { select: { budget: true, startDate: true, endDate: true } },
    },
    orderBy: { companyName: "asc" },
  });
  return customers.map(mapCustomer);
}

export async function getCustomer(organizationId: string, id: string): Promise<CustomerDTO | null> {
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId },
    include: {
      contacts: true,
      projects: { select: { budget: true, startDate: true, endDate: true } },
    },
  });
  if (!customer) return null;
  return mapCustomer(customer);
}

export async function createCustomer(organizationId: string, input: CreateCustomerInput): Promise<CustomerDTO> {
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error("Firmenname darf nicht leer sein");

  const created = await prisma.customer.create({
    data: {
      organizationId,
      companyName,
      legalForm: input.legalForm ?? null,
      street: input.street ?? null,
      zipCode: input.zipCode ?? null,
      city: input.city ?? null,
      country: input.country ?? "Deutschland",
      website: input.website ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      taxId: input.taxId ?? null,
      vatId: input.vatId ?? null,
      classification: input.classification ?? "STANDARD",
      notes: input.notes ?? null,
    },
    include: {
      contacts: true,
      projects: { select: { budget: true, startDate: true, endDate: true } },
    },
  });
  return mapCustomer(created);
}

export async function updateCustomer(
  organizationId: string,
  id: string,
  input: UpdateCustomerInput,
): Promise<CustomerDTO | null> {
  const existing = await prisma.customer.findFirst({ where: { id, organizationId } });
  if (!existing) return null;

  const data: Prisma.CustomerUpdateInput = {};
  if (input.companyName !== undefined) data.companyName = input.companyName.trim();
  if (input.legalForm !== undefined) data.legalForm = input.legalForm ?? null;
  if (input.street !== undefined) data.street = input.street ?? null;
  if (input.zipCode !== undefined) data.zipCode = input.zipCode ?? null;
  if (input.city !== undefined) data.city = input.city ?? null;
  if (input.country !== undefined) data.country = input.country ?? null;
  if (input.website !== undefined) data.website = input.website ?? null;
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.email !== undefined) data.email = input.email ?? null;
  if (input.taxId !== undefined) data.taxId = input.taxId ?? null;
  if (input.vatId !== undefined) data.vatId = input.vatId ?? null;
  if (input.classification !== undefined) data.classification = input.classification;
  if (input.notes !== undefined) data.notes = input.notes ?? null;

  const updated = await prisma.customer.update({
    where: { id },
    data,
    include: {
      contacts: true,
      projects: { select: { budget: true, startDate: true, endDate: true } },
    },
  });
  return mapCustomer(updated);
}

export async function deleteCustomer(organizationId: string, id: string): Promise<boolean> {
  const result = await prisma.customer.deleteMany({ where: { id, organizationId } });
  return result.count > 0;
}

export async function addContact(
  organizationId: string,
  customerId: string,
  input: CreateCustomerContactInput,
): Promise<CustomerContactDTO | null> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId } });
  if (!customer) return null;

  if (input.isPrimary) {
    await prisma.customerContact.updateMany({ where: { customerId }, data: { isPrimary: false } });
  }

  const created = await prisma.customerContact.create({
    data: {
      customerId,
      lastName: input.lastName.trim(),
      firstName: input.firstName ?? null,
      salutation: input.salutation ?? null,
      role: input.role ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      mobile: input.mobile ?? null,
      isPrimary: input.isPrimary ?? false,
      notes: input.notes ?? null,
    },
  });
  return mapContact(created);
}

export async function updateContact(
  organizationId: string,
  customerId: string,
  contactId: string,
  input: UpdateCustomerContactInput,
): Promise<CustomerContactDTO | null> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId } });
  if (!customer) return null;

  if (input.isPrimary) {
    await prisma.customerContact.updateMany({
      where: { customerId, NOT: { id: contactId } },
      data: { isPrimary: false },
    });
  }

  const data: Prisma.CustomerContactUpdateInput = {};
  if (input.lastName !== undefined) data.lastName = input.lastName.trim();
  if (input.firstName !== undefined) data.firstName = input.firstName ?? null;
  if (input.salutation !== undefined) data.salutation = input.salutation ?? null;
  if (input.role !== undefined) data.role = input.role ?? null;
  if (input.email !== undefined) data.email = input.email ?? null;
  if (input.phone !== undefined) data.phone = input.phone ?? null;
  if (input.mobile !== undefined) data.mobile = input.mobile ?? null;
  if (input.isPrimary !== undefined) data.isPrimary = input.isPrimary;
  if (input.notes !== undefined) data.notes = input.notes ?? null;

  const updated = await prisma.customerContact.update({ where: { id: contactId }, data });
  return mapContact(updated);
}

export async function deleteContact(
  organizationId: string,
  customerId: string,
  contactId: string,
): Promise<boolean> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, organizationId } });
  if (!customer) return false;
  const result = await prisma.customerContact.deleteMany({
    where: { id: contactId, customerId },
  });
  return result.count > 0;
}

export async function getCustomerProjects(organizationId: string, customerId: string) {
  return prisma.project.findMany({
    where: { customerId, organizationId },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      name: true,
      projectNumber: true,
      status: true,
      budget: true,
      startDate: true,
      endDate: true,
    },
  });
}
