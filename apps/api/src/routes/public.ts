import { Router } from "express";
import { z } from "zod";
import { asyncRoute, HttpError } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";
import {
  claimTicket,
  publicTicket,
  ticketInclude,
} from "../services/ticket.js";
import { renderTicketPdf } from "../services/pdf.js";

const router = Router();

router.get(
  "/terminals/:slug",
  asyncRoute(async (request, response) => {
    const slug = z.string().parse(request.params.slug);
    const terminal = await prisma.terminal.findUnique({
      where: { slug },
      include: { branch: true },
    });
    if (!terminal) throw new HttpError(404, "Terminal no encontrada.");
    response.json(terminal);
  }),
);

router.post(
  "/terminals/:slug/claim",
  asyncRoute(async (request, response) => {
    const slug = z.string().parse(request.params.slug);
    const { deviceId } = z
      .object({ deviceId: z.string().min(16).max(120) })
      .parse(request.body);
    const ticket = await claimTicket(slug, deviceId);
    response.json(publicTicket(ticket));
  }),
);

router.get(
  "/tickets/:token",
  asyncRoute(async (request, response) => {
    const token = z.string().parse(request.params.token);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: token },
      include: ticketInclude,
    });
    if (!ticket || ticket.status !== "CLAIMED") {
      throw new HttpError(404, "Ticket no encontrado.");
    }
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, type: "VIEWED" },
    });
    response.json(publicTicket(ticket));
  }),
);

router.post(
  "/tickets/:token/events",
  asyncRoute(async (request, response) => {
    const token = z.string().parse(request.params.token);
    const { type } = z
      .object({ type: z.enum(["SHARED"]) })
      .parse(request.body);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: token },
      select: { id: true },
    });
    if (!ticket) throw new HttpError(404, "Ticket no encontrado.");
    await prisma.ticketEvent.create({ data: { ticketId: ticket.id, type } });
    response.status(204).end();
  }),
);

router.get(
  "/tickets/:token/pdf",
  asyncRoute(async (request, response) => {
    const token = z.string().parse(request.params.token);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: token },
      include: { items: true, branch: true, terminal: true },
    });
    if (!ticket || ticket.status !== "CLAIMED") {
      throw new HttpError(404, "Ticket no encontrado.");
    }
    const pdf = await renderTicketPdf(ticket);
    await prisma.ticketEvent.create({
      data: { ticketId: ticket.id, type: "PDF_DOWNLOADED" },
    });
    response
      .status(200)
      .set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="ticket-${ticket.folio}.pdf"`,
        "Content-Length": String(pdf.length),
      })
      .send(pdf);
  }),
);

export default router;
