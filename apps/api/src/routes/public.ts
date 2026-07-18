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
import { eventAuditData, requestAudit } from "../lib/audit.js";
import { rateLimit } from "express-rate-limit";

const router = Router();
const claimLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Espera un momento." },
});

const terminalParamsSchema = z.object({
  storeCode: z.string().trim().min(1).max(80).optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

router.get(
  ["/terminals/:slug", "/terminals/:storeCode/:slug"],
  asyncRoute(async (request, response) => {
    const { storeCode, slug } = terminalParamsSchema.parse(request.params);
    const terminal = await prisma.terminal.findFirst({
      where: {
        slug,
        status: "ACTIVE",
        branch: {
          status: "ACTIVE",
          ...(storeCode ? { code: storeCode } : {}),
          merchant: { status: "ACTIVE" },
        },
      },
      select: {
        name: true,
        slug: true,
        branch: {
          select: {
            name: true,
            code: true,
            merchant: { select: { name: true } },
          },
        },
      },
    });
    if (!terminal) throw new HttpError(404, "Terminal no encontrada.");
    response.json(terminal);
  }),
);

router.post(
  ["/terminals/:slug/claim", "/terminals/:storeCode/:slug/claim"],
  claimLimiter,
  asyncRoute(async (request, response) => {
    const { storeCode, slug } = terminalParamsSchema.parse(request.params);
    const { deviceId, source } = z
      .object({
        deviceId: z
          .string()
          .uuid()
          .or(z.string().regex(/^[A-Za-z0-9_-]{16,120}$/)),
        source: z.enum(["NFC", "QR", "UNKNOWN"]).default("UNKNOWN"),
      })
      .parse(request.body);
    const { accessToken } = await claimTicket(
      { storeCode, terminalSlug: slug },
      deviceId,
      requestAudit(request, source),
    );
    response.json({
      claimToken: accessToken,
      receiptPath: `/r/${accessToken}`,
    });
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
      data: {
        ticketId: ticket.id,
        type: "VIEWED",
        ...eventAuditData(requestAudit(request)),
      },
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
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type,
        ...eventAuditData(requestAudit(request)),
      },
    });
    response.status(204).end();
  }),
);

router.get(
  "/tickets/:token/pdf",
  asyncRoute(async (request, response) => {
    const token = z.string().parse(request.params.token);
    const ticket = await prisma.ticket.findUnique({
      where: { accessToken: token },
      include: {
        items: true,
        branch: { include: { merchant: true } },
        terminal: true,
      },
    });
    if (!ticket || ticket.status !== "CLAIMED") {
      throw new HttpError(404, "Ticket no encontrado.");
    }
    const pdf = await renderTicketPdf(ticket);
    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        type: "PDF_DOWNLOADED",
        ...eventAuditData(requestAudit(request)),
      },
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
