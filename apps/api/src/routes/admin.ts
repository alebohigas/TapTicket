import { Router } from "express";
import { z } from "zod";
import { asyncRoute, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import { ticketInclude } from "../services/ticket.js";

const router = Router();

const configSchema = z.object({
  branchName: z.string().trim().min(2).max(100),
  branchAddress: z.string().trim().max(200).optional(),
  terminalName: z.string().trim().min(2).max(100),
  terminalSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

router.get(
  "/config",
  asyncRoute(async (_request, response) => {
    const terminal = await prisma.terminal.findFirst({
      include: { branch: true },
      orderBy: { createdAt: "asc" },
    });
    response.json(terminal);
  }),
);

router.put(
  "/config",
  asyncRoute(async (request, response) => {
    const data = configSchema.parse(request.body);
    const current = await prisma.terminal.findFirst({
      include: { branch: true },
      orderBy: { createdAt: "asc" },
    });

    const terminal = await prisma.$transaction(async (tx) => {
      const merchant = current
        ? await tx.merchant.findFirstOrThrow({
            where: { branches: { some: { id: current.branchId } } },
          })
        : await tx.merchant.create({
            data: {
              name: data.branchName,
              status: "ACTIVE",
            },
          });

      const branch = current
        ? await tx.branch.update({
            where: { id: current.branchId },
            data: { name: data.branchName, address: data.branchAddress },
          })
        : await tx.branch.create({
            data: {
              merchantId: merchant.id,
              name: data.branchName,
              code: "STORE-001",
              address: data.branchAddress,
            },
          });

      return current
        ? tx.terminal.update({
            where: { id: current.id },
            data: { name: data.terminalName, slug: data.terminalSlug },
            include: { branch: true },
          })
        : tx.terminal.create({
            data: {
              name: data.terminalName,
              code: "TERMINAL-01",
              slug: data.terminalSlug,
              branchId: branch.id,
            },
            include: { branch: true },
          });
    });

    response.json(terminal);
  }),
);

const saleSchema = z.object({
  folio: z.string().trim().min(1).max(60),
  terminalId: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(150),
        quantity: z.number().int().min(1).max(999),
        unitPriceCents: z.number().int().min(0).max(100_000_000),
      }),
    )
    .min(1),
});

router.post(
  "/sales",
  asyncRoute(async (request, response) => {
    const data = saleSchema.parse(request.body);
    const terminal = await prisma.terminal.findUnique({
      where: { id: data.terminalId },
    });
    if (!terminal) throw new HttpError(404, "Terminal no encontrada.");

    const items = data.items.map((item) => ({
      ...item,
      lineTotalCents: item.quantity * item.unitPriceCents,
    }));
    const totalCents = items.reduce(
      (total, item) => total + item.lineTotalCents,
      0,
    );

    const ticket = await prisma.ticket.create({
      data: {
        folio: data.folio,
        subtotalCents: totalCents,
        totalCents,
        branchId: terminal.branchId,
        terminalId: terminal.id,
        items: { create: items },
        events: { create: { type: "CREATED" } },
      },
      include: ticketInclude,
    });
    response.status(201).json(ticket);
  }),
);

router.post(
  "/tickets/:id/activate",
  asyncRoute(async (request, response) => {
    const ticketId = z.string().parse(request.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new HttpError(404, "Ticket no encontrado.");
    if (ticket.status !== "DRAFT" && ticket.status !== "EXPIRED") {
      throw new HttpError(409, "El ticket ya no se puede activar.");
    }

    const activationExpiresAt = new Date(Date.now() + 60_000);
    const activated = await prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { terminalId: ticket.terminalId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: "ACTIVATED",
          metadataJson: JSON.stringify({ activationExpiresAt }),
        },
      });
      return tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: "ACTIVE",
          activatedAt: new Date(),
          activationExpiresAt,
        },
        include: ticketInclude,
      });
    });
    response.json(activated);
  }),
);

export default router;
