import crypto from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http.js";

export const ticketInclude = {
  items: true,
  branch: true,
  terminal: true,
  events: { orderBy: { createdAt: "asc" as const } },
};

export async function claimTicket(slug: string, deviceId: string) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const terminal = await tx.terminal.findUnique({ where: { slug } });
    if (!terminal) throw new HttpError(404, "Terminal no encontrada.");

    await tx.ticket.updateMany({
      where: {
        terminalId: terminal.id,
        status: "ACTIVE",
        activationExpiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    const available = await tx.ticket.findFirst({
      where: {
        terminalId: terminal.id,
        status: "ACTIVE",
        activationExpiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!available) {
      throw new HttpError(404, "No hay un ticket disponible en esta terminal.");
    }

    const accessToken = crypto.randomBytes(32).toString("hex");
    const claimed = await tx.ticket.updateMany({
      where: {
        id: available.id,
        status: "ACTIVE",
        claimedAt: null,
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

    return tx.ticket.findUniqueOrThrow({
      where: { id: available.id },
      include: ticketInclude,
    });
  });
}

export function publicTicket<T extends {
  claimedDeviceId?: string | null;
  accessToken?: string | null;
}>(ticket: T) {
  const { claimedDeviceId: _deviceId, ...safe } = ticket;
  return safe;
}
