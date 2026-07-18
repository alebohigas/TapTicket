import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";

export const ticketInclude = {
  items: true,
  branch: true,
  terminal: true,
  events: { orderBy: { createdAt: "asc" as const } },
};

type TerminalAddress = {
  storeCode?: string;
  terminalSlug: string;
};

export async function claimTicket(
  address: TerminalAddress,
  deviceId: string,
) {
  const now = new Date();

  try {
    return await prisma.$transaction(async (tx) => {
      const terminal = await tx.terminal.findFirst({
        where: {
          slug: address.terminalSlug,
          status: "ACTIVE",
          branch: {
            status: "ACTIVE",
            ...(address.storeCode ? { code: address.storeCode } : {}),
            merchant: { status: "ACTIVE" },
          },
        },
      });
      if (!terminal) throw new HttpError(404, "Terminal no encontrada.");

      const expired = await tx.ticket.findMany({
        where: {
          terminalId: terminal.id,
          status: "ACTIVE",
          activationExpiresAt: { lte: now },
        },
        select: { id: true },
      });
      if (expired.length > 0) {
        await tx.ticket.updateMany({
          where: { id: { in: expired.map(({ id }) => id) }, status: "ACTIVE" },
          data: { status: "EXPIRED" },
        });
        await tx.ticketEvent.createMany({
          data: expired.map(({ id }) => ({
            ticketId: id,
            type: "EXPIRED",
          })),
        });
      }

      const available = await tx.ticket.findFirst({
        where: {
          terminalId: terminal.id,
          status: "ACTIVE",
          activationExpiresAt: { gt: now },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!available) {
        throw new HttpError(
          404,
          "No hay un ticket disponible en esta terminal.",
        );
      }

      const accessToken = crypto.randomBytes(32).toString("base64url");
      const claimed = await tx.ticket.updateMany({
        where: {
          id: available.id,
          status: "ACTIVE",
          claimedAt: null,
          activationExpiresAt: { gt: now },
        },
        data: {
          status: "CLAIMED",
          claimedAt: now,
          claimedDeviceId: deviceId,
          accessToken,
        },
      });

      if (claimed.count !== 1) {
        throw new HttpError(409, "Este ticket acaba de ser reclamado.");
      }

      await tx.ticketEvent.create({
        data: { ticketId: available.id, type: "CLAIMED", deviceId },
      });

      return { accessToken };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1008", "P2034"].includes(error.code)
    ) {
      throw new HttpError(409, "Este ticket acaba de ser reclamado.");
    }
    throw error;
  }
}

type TicketWithRelations = Prisma.TicketGetPayload<{
  include: typeof ticketInclude;
}>;

export function publicTicket(ticket: TicketWithRelations) {
  return {
    folio: ticket.folio,
    status: ticket.status,
    subtotalCents: ticket.subtotalCents,
    taxCents: ticket.taxCents,
    totalCents: ticket.totalCents,
    currency: ticket.currency,
    paymentMethod: ticket.paymentMethod,
    claimedAt: ticket.claimedAt,
    createdAt: ticket.createdAt,
    branch: {
      name: ticket.branch.name,
      address: ticket.branch.address,
    },
    terminal: {
      name: ticket.terminal.name,
    },
    items: ticket.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}
