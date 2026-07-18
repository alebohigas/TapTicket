import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Logo";
import { api, getDeviceId } from "../lib/api";
import type { ClaimResponse, PublicTerminal } from "../types";

export function ClaimPage() {
  const { slug = "" } = useParams();
  const { storeCode } = useParams();
  const navigate = useNavigate();
  const [terminal, setTerminal] = useState<PublicTerminal | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "claiming" | "empty">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    const terminalPath = storeCode
      ? `/api/public/terminals/${encodeURIComponent(storeCode)}/${slug}`
      : `/api/public/terminals/${slug}`;
    api<PublicTerminal>(terminalPath)
      .then((value) => {
        setTerminal(value);
        setState("ready");
      })
      .catch((error: Error) => {
        setMessage(error.message);
        setState("empty");
      });
  }, [slug, storeCode]);

  async function claim() {
    setState("claiming");
    try {
      const claimPath = storeCode
        ? `/api/public/terminals/${encodeURIComponent(storeCode)}/${slug}/claim`
        : `/api/public/terminals/${slug}/claim`;
      const claim = await api<ClaimResponse>(
        claimPath,
        {
          method: "POST",
          body: JSON.stringify({ deviceId: getDeviceId() }),
        },
      );
      localStorage.setItem(`tapticket:${slug}`, claim.claimToken);
      navigate(claim.receiptPath, { replace: true });
    } catch (error) {
      setMessage((error as Error).message);
      setState("empty");
    }
  }

  return (
    <main className="public-page">
      <Logo />
      <section className="public-card">
        {state === "loading" && <div className="pulse-icon">···</div>}
        {state === "ready" && (
          <>
            <div className="tap-icon">⌁</div>
            <p className="eyebrow">{terminal?.branch.merchant.name}</p>
            <h1>Tu ticket está listo</h1>
            <p>
              Reclama el ticket de {terminal?.branch.name}, {terminal?.name}.
              Solo este dispositivo podrá abrirlo primero.
            </p>
            <button className="button primary full large" onClick={claim}>
              Ver mi ticket
            </button>
            <small>La entrega es privada y no requiere instalar una app.</small>
          </>
        )}
        {state === "claiming" && (
          <>
            <div className="pulse-icon">T</div>
            <h1>Recuperando tu ticket</h1>
            <p>Espera un momento…</p>
          </>
        )}
        {state === "empty" && (
          <>
            <div className="empty-icon">✓</div>
            <h1>No hay un ticket disponible</h1>
            <p>{message}</p>
            <p className="muted">
              Pide al cajero que active el ticket y vuelve a acercar tu teléfono.
            </p>
            <button
              className="button secondary"
              onClick={() => window.location.reload()}
            >
              Intentar de nuevo
            </button>
          </>
        )}
      </section>
      <p className="public-footer">Entrega digital segura por TapTicket</p>
    </main>
  );
}
