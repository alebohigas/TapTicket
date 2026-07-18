-- Una terminal no puede tener más de un ticket activo.
CREATE UNIQUE INDEX "Ticket_single_active_per_terminal"
ON "Ticket"("terminalId")
WHERE "status" = 'ACTIVE';
