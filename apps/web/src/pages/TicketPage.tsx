import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { API_URL, api, money } from "../lib/api";
import type { Ticket } from "../types";

export function TicketPage() {
  const { token = "" } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [shared, setShared] = useState(false);

  useEffect(() => {
    api<Ticket>(`/api/public/tickets/${token}`)
      .then(setTicket)
      .catch((reason: Error) => setError(reason.message));
  }, [token]);

  async function share() {
    const shareData = {
      title: `Ticket ${ticket?.folio ?? ""}`,
      text: `Ticket digital de ${ticket?.branch.name ?? "tu compra"}`,
      url: window.location.href,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(window.location.href);
      setShared(true);
    }
    await api(`/api/public/tickets/${token}/events`, {
      method: "POST",
      body: JSON.stringify({ type: "SHARED" }),
    });
  }

  if (error) {
    return (
      <main className="public-page">
        <Logo />
        <section className="public-card">
          <div className="empty-icon">!</div>
          <h1>Ticket no disponible</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="public-page">
        <Logo />
        <section className="public-card">
          <div className="pulse-icon">T</div>
          <p>Cargando ticket…</p>
        </section>
      </main>
    );
  }

  return (
    <main className="ticket-page">
      <div className="ticket-top">
        <Logo />
        <span className="secure-badge">✓ Ticket reclamado</span>
      </div>
      <article className="receipt">
        <header className="receipt-header">
          <div className="store-mark">{ticket.branch.name.charAt(0)}</div>
          <div>
            <h1>{ticket.branch.name}</h1>
            <p>{ticket.branch.address}</p>
          </div>
        </header>

        <div className="receipt-meta">
          <div>
            <span>Folio</span>
            <strong>{ticket.folio}</strong>
          </div>
          <div>
            <span>Fecha</span>
            <strong>
              {new Date(ticket.createdAt).toLocaleDateString("es-MX", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </strong>
          </div>
          <div>
            <span>Terminal</span>
            <strong>{ticket.terminal.name}</strong>
          </div>
        </div>

        <div className="receipt-items">
          {ticket.items.map((item, index) => (
            <div className="receipt-item" key={`${item.name}-${index}`}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} × {money(item.unitPriceCents, ticket.currency)}
                </span>
              </div>
              <strong>{money(item.lineTotalCents, ticket.currency)}</strong>
            </div>
          ))}
        </div>

        <div className="receipt-total">
          <span>Total</span>
          <strong>{money(ticket.totalCents, ticket.currency)}</strong>
        </div>
        <div className="paid-badge">✓ Ticket digital emitido</div>
        <footer>Gracias por tu compra</footer>
      </article>

      <div className="ticket-actions">
        <a
          className="button primary"
          href={`${API_URL}/api/public/tickets/${token}/pdf`}
        >
          Descargar PDF
        </a>
        <button className="button secondary" onClick={share}>
          {shared ? "Enlace copiado" : "Compartir"}
        </button>
      </div>
      <p className="public-footer">
        Guarda este enlace. Es privado y da acceso a tu ticket.
      </p>
    </main>
  );
}
