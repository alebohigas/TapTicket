import { useEffect, useMemo, useState, type FormEvent } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Logo } from "../components/Logo";
import { api, money } from "../lib/api";
import type { Terminal, Ticket } from "../types";

type DraftItem = {
  name: string;
  quantity: number;
  unitPrice: string;
};

const blankItem = (): DraftItem => ({
  name: "",
  quantity: 1,
  unitPrice: "",
});

export function AdminPage() {
  const [terminal, setTerminal] = useState<Terminal | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [branchName, setBranchName] = useState("Sucursal Centro");
  const [branchAddress, setBranchAddress] = useState("");
  const [terminalName, setTerminalName] = useState("Caja 01");
  const [terminalSlug, setTerminalSlug] = useState("caja-01");
  const [folio, setFolio] = useState(`V-${Date.now().toString().slice(-6)}`);
  const [tax, setTax] = useState("0.00");
  const [paymentMethod, setPaymentMethod] =
    useState<Ticket["paymentMethod"]>("CARD");
  const [items, setItems] = useState<DraftItem[]>([
    { name: "Café americano", quantity: 1, unitPrice: "45.00" },
    { name: "Sándwich", quantity: 1, unitPrice: "72.00" },
  ]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api<Terminal | null>("/api/admin/config")
      .then((value) => {
        if (!value) {
          setConfigOpen(true);
          return;
        }
        setTerminal(value);
        setBranchName(value.branch.name);
        setBranchAddress(value.branch.address ?? "");
        setTerminalName(value.name);
        setTerminalSlug(value.slug);
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!ticket?.activationExpiresAt) return;
    const update = () =>
      setSeconds(
        Math.max(
          0,
          Math.ceil(
            (new Date(ticket.activationExpiresAt!).getTime() - Date.now()) /
              1000,
          ),
        ),
      );
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [ticket?.activationExpiresAt]);

  useEffect(() => {
    if (!ticket || ticket.status !== "ACTIVE") return;
    const refresh = () => {
      api<Ticket>(`/api/admin/tickets/${ticket.id}`)
        .then((updated) => {
          setTicket(updated);
          if (updated.status === "CLAIMED") {
            setMessage("Ticket reclamado correctamente por el cliente.");
          } else if (updated.status === "EXPIRED") {
            setMessage("La activación expiró sin ser reclamada.");
          }
        })
        .catch((error: Error) => setMessage(error.message));
    };
    const timer = window.setInterval(refresh, 1_000);
    return () => window.clearInterval(timer);
  }, [ticket?.id, ticket?.status]);

  const subtotalCents = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum +
          item.quantity *
            Math.round((Number.parseFloat(item.unitPrice) || 0) * 100),
        0,
      ),
    [items],
  );
  const taxCents = Math.max(
    0,
    Math.round((Number.parseFloat(tax) || 0) * 100),
  );
  const totalCents = subtotalCents + taxCents;

  const publicUrl = terminal
    ? `${window.location.origin}/t/${terminal.slug}`
    : "";

  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const value = await api<Terminal>("/api/admin/config", {
        method: "PUT",
        body: JSON.stringify({
          branchName,
          branchAddress,
          terminalName,
          terminalSlug,
        }),
      });
      setTerminal(value);
      setConfigOpen(false);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function createAndActivate(event: FormEvent) {
    event.preventDefault();
    if (!terminal) {
      setConfigOpen(true);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const created = await api<Ticket>("/api/admin/sales", {
        method: "POST",
        body: JSON.stringify({
          folio,
          terminalId: terminal.id,
          taxCents,
          paymentMethod,
          items: items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPriceCents: Math.round(Number.parseFloat(item.unitPrice) * 100),
          })),
        }),
      });
      const activated = await api<Ticket>(
        `/api/admin/tickets/${created.id}/activate`,
        {
          method: "POST",
          body: JSON.stringify({ durationSeconds: 60 }),
        },
      );
      setTicket(activated);
      setMessage("Ticket activo. Acerca el teléfono o escanea el QR.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function resetSale() {
    setTicket(null);
    setFolio(`V-${Date.now().toString().slice(-6)}`);
    setItems([blankItem()]);
    setTax("0.00");
    setPaymentMethod("CARD");
    setMessage("");
  }

  async function cancelActivation() {
    if (!ticket) return;
    setBusy(true);
    try {
      const cancelled = await api<Ticket>(
        `/api/admin/tickets/${ticket.id}/cancel`,
        { method: "POST" },
      );
      setTicket(cancelled);
      setMessage("Activación cancelada.");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ticketStatus = ticket?.status ?? "IDLE";
  const statusLabels: Record<string, string> = {
    IDLE: "Listo para activar",
    READY: "Ticket preparado",
    ACTIVE: "Esperando al cliente",
    CLAIMED: "Ticket reclamado",
    EXPIRED: "Activación expirada",
    CANCELLED: "Activación cancelada",
  };

  return (
    <div className="admin-shell">
      <header className="topbar">
        <Logo />
        <button className="button ghost" onClick={() => setConfigOpen(true)}>
          <span className="status-dot" />
          {terminal?.name ?? "Configurar terminal"}
        </button>
      </header>

      <main className="admin-main">
        <section className="page-heading">
          <div>
            <p className="eyebrow">Panel de cajero</p>
            <h1>Nueva venta</h1>
            <p>Captura la compra y entrega el ticket con un solo toque.</p>
          </div>
          <div className="branch-label">
            <span>Sucursal</span>
            <strong>{terminal?.branch.name ?? "Sin configurar"}</strong>
          </div>
        </section>

        <div className="admin-grid">
          <form className="card sale-card" onSubmit={createAndActivate}>
            <div className="field">
              <label htmlFor="folio">Folio de venta</label>
              <input
                id="folio"
                value={folio}
                onChange={(event) => setFolio(event.target.value)}
                required
              />
            </div>

            <div className="items-heading">
              <strong>Productos</strong>
              <span>{items.length} partidas</span>
            </div>
            <div className="item-labels">
              <span>Descripción</span>
              <span>Cant.</span>
              <span>Precio</span>
              <span />
            </div>
            <div className="item-list">
              {items.map((item, index) => (
                <div className="item-row" key={index}>
                  <input
                    aria-label={`Descripción del producto ${index + 1}`}
                    placeholder="Producto"
                    value={item.name}
                    onChange={(event) =>
                      updateItem(index, { name: event.target.value })
                    }
                    required
                  />
                  <input
                    aria-label={`Cantidad del producto ${index + 1}`}
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, {
                        quantity: Number(event.target.value),
                      })
                    }
                    required
                  />
                  <div className="money-input">
                    <span>$</span>
                    <input
                      aria-label={`Precio del producto ${index + 1}`}
                      inputMode="decimal"
                      placeholder="0.00"
                      value={item.unitPrice}
                      onChange={(event) =>
                        updateItem(index, { unitPrice: event.target.value })
                      }
                      required
                    />
                  </div>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Eliminar producto ${index + 1}`}
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              className="text-button"
              type="button"
              onClick={() => setItems((current) => [...current, blankItem()])}
            >
              + Agregar producto
            </button>

            <div className="sale-details">
              <div className="field">
                <label htmlFor="tax">Impuestos</label>
                <div className="money-input">
                  <span>$</span>
                  <input
                    id="tax"
                    inputMode="decimal"
                    value={tax}
                    onChange={(event) => setTax(event.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="payment-method">Método de pago</label>
                <select
                  id="payment-method"
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as Ticket["paymentMethod"],
                    )
                  }
                >
                  <option value="CASH">Efectivo</option>
                  <option value="CARD">Tarjeta</option>
                  <option value="TRANSFER">Transferencia</option>
                  <option value="OTHER">Otro</option>
                </select>
              </div>
            </div>

            <div className="totals">
              <div>
                <span>Subtotal</span>
                <strong>{money(subtotalCents)}</strong>
              </div>
              <div>
                <span>Impuestos</span>
                <strong>{money(taxCents)}</strong>
              </div>
              <div className="sale-total">
                <span>Total</span>
                <strong>{money(totalCents)}</strong>
              </div>
            </div>

            <button
              className="button primary full"
              disabled={busy || ticket?.status === "ACTIVE"}
            >
              {busy ? "Preparando…" : "Activar ticket por 60 segundos"}
            </button>
          </form>

          <aside className="card delivery-card">
            <div className="delivery-head">
              <div>
                <p className="eyebrow">Entrega digital</p>
                <h2>{statusLabels[ticketStatus] ?? ticketStatus}</h2>
              </div>
              <div className={`timer ${seconds > 0 ? "live" : ""}`}>
                {seconds}s
              </div>
            </div>

            {terminal ? (
              <>
                <div className="qr-wrap">
                  <QRCodeSVG
                    value={publicUrl}
                    size={190}
                    level="M"
                    marginSize={2}
                    fgColor="#10251f"
                  />
                </div>
                <p className="center">
                  Acerca el teléfono a la etiqueta NFC o escanea el código.
                </p>
                <div className="url-box">
                  <span>URL fija de la terminal</span>
                  <code>{publicUrl}</code>
                </div>
              </>
            ) : (
              <div className="empty-state">
                Configura una sucursal y una terminal para generar el QR.
              </div>
            )}

            {ticket && (
              <div className={`active-summary status-${ticket.status.toLowerCase()}`}>
                <span>Estado: {statusLabels[ticket.status] ?? ticket.status}</span>
                <strong>{ticket.folio}</strong>
                <strong>{money(ticket.totalCents)}</strong>
              </div>
            )}
            {ticket?.status === "ACTIVE" && (
              <button
                className="button danger full"
                disabled={busy}
                onClick={cancelActivation}
              >
                Cancelar activación
              </button>
            )}
            {ticket && ticket.status !== "ACTIVE" && (
              <button className="button secondary full" onClick={resetSale}>
                Capturar otra venta
              </button>
            )}
          </aside>
        </div>
        {message && <div className="toast">{message}</div>}
      </main>

      {configOpen && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal card" onSubmit={saveConfig}>
            <div>
              <p className="eyebrow">Configuración</p>
              <h2>Sucursal y terminal</h2>
            </div>
            <div className="field">
              <label htmlFor="branch-name">Nombre de sucursal</label>
              <input
                id="branch-name"
                value={branchName}
                onChange={(event) => setBranchName(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="branch-address">Dirección</label>
              <input
                id="branch-address"
                value={branchAddress}
                onChange={(event) => setBranchAddress(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="terminal-name">Nombre de terminal</label>
              <input
                id="terminal-name"
                value={terminalName}
                onChange={(event) => setTerminalName(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="terminal-slug">Identificador de URL</label>
              <input
                id="terminal-slug"
                value={terminalSlug}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                onChange={(event) =>
                  setTerminalSlug(
                    event.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9-]/g, "-"),
                  )
                }
                required
              />
              <small>Solo minúsculas, números y guiones.</small>
            </div>
            <div className="modal-actions">
              {terminal && (
                <button
                  className="button ghost"
                  type="button"
                  onClick={() => setConfigOpen(false)}
                >
                  Cancelar
                </button>
              )}
              <button className="button primary" disabled={busy}>
                Guardar configuración
              </button>
            </div>
            {message && <p className="error">{message}</p>}
          </form>
        </div>
      )}
    </div>
  );
}
