import puppeteer from "puppeteer";

type PrintableTicket = {
  folio: string;
  createdAt: Date;
  totalCents: number;
  currency: string;
  branch: { name: string; address: string | null };
  terminal: { name: string };
  items: Array<{
    name: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character];
  });

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
  }).format(cents / 100);

export function ticketHtml(ticket: PrintableTicket) {
  const rows = ticket.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}<small>${item.quantity} × ${money(item.unitPriceCents, ticket.currency)}</small></td>
          <td>${money(item.lineTotalCents, ticket.currency)}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: 80mm auto; margin: 8mm; }
        body { color: #17231f; font: 12px Arial, sans-serif; margin: 0; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .muted { color: #63736d; }
        .rule { border-top: 1px dashed #9aa7a2; margin: 16px 0; }
        table { border-collapse: collapse; width: 100%; }
        td { padding: 7px 0; vertical-align: top; }
        td:last-child { text-align: right; white-space: nowrap; }
        small { color: #63736d; display: block; margin-top: 2px; }
        .total { font-size: 18px; font-weight: bold; }
        footer { margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(ticket.branch.name)}</h1>
      <div class="muted">${escapeHtml(ticket.branch.address ?? "")}</div>
      <div class="rule"></div>
      <div>Folio <strong>${escapeHtml(ticket.folio)}</strong></div>
      <div class="muted">${ticket.terminal.name} · ${ticket.createdAt.toLocaleString("es-MX")}</div>
      <div class="rule"></div>
      <table>${rows}</table>
      <div class="rule"></div>
      <table><tr class="total"><td>Total</td><td>${money(ticket.totalCents, ticket.currency)}</td></tr></table>
      <footer>Gracias por tu compra<br><span class="muted">Ticket digital por TapTicket</span></footer>
    </body>
  </html>`;
}

export async function renderTicketPdf(ticket: PrintableTicket) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(ticketHtml(ticket), { waitUntil: "networkidle0" });
    return Buffer.from(
      await page.pdf({
        width: "80mm",
        printBackground: true,
        margin: { top: "8mm", right: "6mm", bottom: "8mm", left: "6mm" },
      }),
    );
  } finally {
    await browser.close();
  }
}
