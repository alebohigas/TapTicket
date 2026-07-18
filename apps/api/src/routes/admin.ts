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

router.get(
  "/metrics",
  asyncRoute(async (_request, response) => {
    const [
      ticketsCreated,
      ticketsActivated,
      ticketsClaimed,
      ticketsExpired,
      pdfDownloads,
      shares,
      claimedTickets,
      claimEvents,
      ticketsByTerminal,
    ] = await Promise.all([
      prisma.ticket.count(),
      prisma.ticketEvent.count({ where: { type: "ACTIVATED" } }),
      prisma.ticket.count({ where: { status: "CLAIMED" } }),
      prisma.ticket.count({ where: { status: "EXPIRED" } }),
      prisma.ticketEvent.count({ where: { type: "PDF_DOWNLOADED" } }),
      prisma.ticketEvent.count({ where: { type: "SHARED" } }),
      prisma.ticket.findMany({
        where: {
          status: "CLAIMED",
          activatedAt: { not: null },
          claimedAt: { not: null },
        },
        select: { activatedAt: true, claimedAt: true },
      }),
      prisma.ticketEvent.findMany({
        where: { type: "CLAIMED" },
        select: { metadataJson: true },
      }),
      prisma.ticket.groupBy({
        by: ["terminalId"],
        _count: { _all: true },
      }),
    ]);

    const averageClaimSeconds =
      claimedTickets.length === 0
        ? null
        : Math.round(
            claimedTickets.reduce(
              (total, ticket) =>
                total +
                (ticket.claimedAt!.getTime() -
                  ticket.activatedAt!.getTime()) /
                  1_000,
              0,
            ) / claimedTickets.length,
          );
    const sources = claimEvents.reduce(
      (totals, event) => {
        try {
          const source: unknown = JSON.parse(
            event.metadataJson ?? "{}",
          ).source;
          if (source === "QR" || source === "NFC") totals[source] += 1;
          else totals.UNKNOWN += 1;
        } catch {
          totals.UNKNOWN += 1;
        }
        return totals;
      },
      { QR: 0, NFC: 0, UNKNOWN: 0 },
    );
    const terminalIds = ticketsByTerminal.map(({ terminalId }) => terminalId);
    const terminals = await prisma.terminal.findMany({
      where: { id: { in: terminalIds } },
      select: { id: true, name: true },
    });
    const terminalNames = new Map(
      terminals.map((terminal) => [terminal.id, terminal.name]),
    );

    response.json({
      ticketsCreated,
      ticketsActivated,
      ticketsClaimed,
      ticketsExpired,
      claimRate:
        ticketsActivated === 0
          ? 0
          : Math.round((ticketsClaimed / ticketsActivated) * 10_000) / 100,
      averageClaimSeconds,
      pdfDownloads,
      shares,
      sources,
      ticketsByTerminal: ticketsByTerminal.map((group) => ({
        terminalId: group.terminalId,
        terminalName: terminalNames.get(group.terminalId) ?? "Terminal",
        tickets: group._count._all,
      })),
    });
  }),
);

router.get(
  "/tickets",
  asyncRoute(async (request, response) => {
    const { limit } = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(25),
      })
      .parse(request.query);
    const tickets = await prisma.ticket.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        folio: true,
        status: true,
        totalCents: true,
        currency: true,
        createdAt: true,
        terminal: { select: { name: true } },
      },
    });
    response.json(tickets);
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
  taxCents: z.number().int().min(0).max(100_000_000).default(0),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]),
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
    const subtotalCents = items.reduce(
      (total, item) => total + item.lineTotalCents,
      0,
    );
    const totalCents = subtotalCents + data.taxCents;

    const ticket = await prisma.ticket.create({
      data: {
        folio: data.folio,
        status: "READY",
        subtotalCents,
        taxCents: data.taxCents,
        totalCents,
        paymentMethod: data.paymentMethod,
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

router.get(
  "/tickets/:id",
  asyncRoute(async (request, response) => {
    const ticketId = z.string().parse(request.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: ticketInclude,
    });
    if (!ticket) throw new HttpError(404, "Ticket no encontrado.");

    if (
      ticket.status === "ACTIVE" &&
      ticket.activationExpiresAt &&
      ticket.activationExpiresAt <= new Date()
    ) {
      const expired = await prisma.$transaction(async (tx) => {
        await tx.ticketEvent.create({
          data: { ticketId, type: "EXPIRED" },
        });
        return tx.ticket.update({
          where: { id: ticketId },
          data: { status: "EXPIRED" },
          include: ticketInclude,
        });
      });
      response.json(expired);
      return;
    }

    response.json(ticket);
  }),
);

router.get(
  "/tickets/:id/events",
  asyncRoute(async (request, response) => {
    const ticketId = z.string().parse(request.params.id);
    const exists = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!exists) throw new HttpError(404, "Ticket no encontrado.");
    const events = await prisma.ticketEvent.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      select: {
        type: true,
        metadataJson: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
      },
    });
    response.json(events);
  }),
);

const activationSchema = z.object({
  durationSeconds: z.number().int().min(15).max(300).default(60),
});

router.post(
  "/tickets/:id/activate",
  asyncRoute(async (request, response) => {
    const ticketId = z.string().parse(request.params.id);
    const { durationSeconds } = activationSchema.parse(request.body ?? {});
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new HttpError(404, "Ticket no encontrado.");
    if (ticket.status !== "READY" && ticket.status !== "EXPIRED") {
      throw new HttpError(409, "El ticket ya no se puede activar.");
    }

    const activationExpiresAt = new Date(
      Date.now() + durationSeconds * 1_000,
    );
    const activated = await prisma.$transaction(async (tx) => {
      await tx.ticket.updateMany({
        where: { terminalId: ticket.terminalId, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      });
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          type: "ACTIVATED",
          metadataJson: JSON.stringify({
            activationExpiresAt,
            durationSeconds,
          }),
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

router.post(
  "/tickets/:id/cancel",
  asyncRoute(async (request, response) => {
    const ticketId = z.string().parse(request.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) throw new HttpError(404, "Ticket no encontrado.");
    if (ticket.status !== "ACTIVE") {
      throw new HttpError(409, "Solo un ticket activo puede cancelarse.");
    }

    const cancelled = await prisma.$transaction(async (tx) => {
      await tx.ticketEvent.create({
        data: { ticketId, type: "CANCELLED" },
      });
      return tx.ticket.update({
        where: { id: ticketId },
        data: { status: "CANCELLED", activationExpiresAt: null },
        include: ticketInclude,
      });
    });
    response.json(cancelled);
  }),
);

export default router;
