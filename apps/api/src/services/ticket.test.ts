import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { claimTicket } from "./ticket.js";

test("solo un dispositivo puede reclamar un ticket activo", async () => {
  const suffix = randomUUID();
  const merchantId = `test-merchant-${suffix}`;
  const branchId = `test-branch-${suffix}`;
  const terminalId = `test-terminal-${suffix}`;
  const ticketId = `test-ticket-${suffix}`;
  const storeCode = `TEST-${suffix}`;
  const terminalSlug = `test-${suffix}`;

  await prisma.merchant.create({
    data: {
      id: merchantId,
      name: "Comercio de prueba",
      branches: {
        create: {
          id: branchId,
          name: "Sucursal de prueba",
          code: storeCode,
          terminals: {
            create: {
              id: terminalId,
              name: "Terminal de prueba",
              code: "TERMINAL-TEST",
              slug: terminalSlug,
            },
          },
        },
      },
    },
  });
  await prisma.ticket.create({
    data: {
      id: ticketId,
      folio: `F-${suffix}`,
      status: "ACTIVE",
      subtotalCents: 1000,
      totalCents: 1000,
      branchId,
      terminalId,
      activatedAt: new Date(),
      activationExpiresAt: new Date(Date.now() + 60_000),
    },
  });

  try {
    const attempts = await Promise.allSettled([
      claimTicket({ storeCode, terminalSlug }, randomUUID(), {
        source: "QR",
        ipAddress: "127.0.0.1",
        userAgent: "TapTicket test",
      }),
      claimTicket({ storeCode, terminalSlug }, randomUUID(), {
        source: "NFC",
      }),
    ]);
    const fulfilled = attempts.filter(
      (attempt) => attempt.status === "fulfilled",
    );
    const rejected = attempts.filter(
      (attempt) => attempt.status === "rejected",
    );

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(
      rejected[0].reason instanceof HttpError,
      "el segundo reclamo debe producir un error HTTP controlado",
    );

    const claimed = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { events: { where: { type: "CLAIMED" } } },
    });
    assert.equal(claimed.status, "CLAIMED");
    assert.ok(claimed.accessToken);
    assert.equal(claimed.events.length, 1);
    const winningIndex = attempts.findIndex(
      (attempt) => attempt.status === "fulfilled",
    );
    const expectedSource = winningIndex === 0 ? "QR" : "NFC";
    assert.equal(
      JSON.parse(claimed.events[0].metadataJson ?? "{}").source,
      expectedSource,
    );
    assert.equal(
      claimed.events[0].ipAddress,
      winningIndex === 0 ? "127.0.0.1" : null,
    );
  } finally {
    await prisma.ticketEvent.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.terminal.deleteMany({ where: { id: terminalId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  }
});

test("un ticket vencido se marca como expirado y no puede reclamarse", async () => {
  const suffix = randomUUID();
  const merchantId = `expired-merchant-${suffix}`;
  const branchId = `expired-branch-${suffix}`;
  const terminalId = `expired-terminal-${suffix}`;
  const ticketId = `expired-ticket-${suffix}`;
  const storeCode = `EXPIRED-${suffix}`;
  const terminalSlug = `expired-${suffix}`;

  await prisma.merchant.create({
    data: {
      id: merchantId,
      name: "Comercio expirado",
      branches: {
        create: {
          id: branchId,
          name: "Sucursal expirada",
          code: storeCode,
          terminals: {
            create: {
              id: terminalId,
              name: "Terminal expirada",
              code: "TERMINAL-EXPIRED",
              slug: terminalSlug,
            },
          },
        },
      },
    },
  });
  await prisma.ticket.create({
    data: {
      id: ticketId,
      folio: `E-${suffix}`,
      status: "ACTIVE",
      subtotalCents: 1000,
      totalCents: 1000,
      branchId,
      terminalId,
      activatedAt: new Date(Date.now() - 120_000),
      activationExpiresAt: new Date(Date.now() - 60_000),
    },
  });

  try {
    await assert.rejects(
      claimTicket({ storeCode, terminalSlug }, randomUUID()),
      (error) => error instanceof HttpError && error.status === 404,
    );
    const expired = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticketId },
      include: { events: { where: { type: "EXPIRED" } } },
    });
    assert.equal(expired.status, "EXPIRED");
    assert.equal(expired.events.length, 1);
  } finally {
    await prisma.ticketEvent.deleteMany({ where: { ticketId } });
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
    await prisma.terminal.deleteMany({ where: { id: terminalId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  }
});
