import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.upsert({
    where: { id: "demo-branch" },
    update: {},
    create: {
      id: "demo-branch",
      name: "Sucursal Centro",
      address: "Av. Ejemplo 123",
    },
  });

  await prisma.terminal.upsert({
    where: { slug: "caja-01" },
    update: { branchId: branch.id },
    create: {
      id: "demo-terminal",
      name: "Caja 01",
      slug: "caja-01",
      branchId: branch.id,
    },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
