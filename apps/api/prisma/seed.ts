import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const merchant = await prisma.merchant.upsert({
    where: { id: "demo-merchant" },
    update: {},
    create: {
      id: "demo-merchant",
      name: "Comercio Demo",
      legalName: "Comercio Demo, S.A. de C.V.",
      taxId: "TAP010101DE0",
      status: "ACTIVE",
    },
  });

  const branch = await prisma.branch.upsert({
    where: { id: "demo-branch" },
    update: { merchantId: merchant.id },
    create: {
      id: "demo-branch",
      merchantId: merchant.id,
      name: "Sucursal Centro",
      code: "STORE-001",
      address: "Av. Ejemplo 123",
      status: "ACTIVE",
    },
  });

  await prisma.terminal.upsert({
    where: { slug: "caja-01" },
    update: { branchId: branch.id },
    create: {
      id: "demo-terminal",
      name: "Caja 01",
      code: "TERMINAL-01",
      slug: "caja-01",
      branchId: branch.id,
      status: "ACTIVE",
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
