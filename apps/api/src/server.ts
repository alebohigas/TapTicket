import "dotenv/config";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import { ZodError } from "zod";
import adminRoutes from "./routes/admin.js";
import publicRoutes from "./routes/public.js";
import { HttpError } from "./lib/http.js";

const app = express();
const port = Number(process.env.API_PORT ?? 4000);

app.use(
  cors({
    origin: process.env.APP_URL ?? "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "256kb" }));

app.get("/health", ((_request, response) => {
  response.json({ ok: true, service: "tapticket-api" });
}) satisfies RequestHandler);

app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);

app.use(((request, response) => {
  response.status(404).json({ error: `Ruta no encontrada: ${request.path}` });
}) satisfies RequestHandler);

app.use(((error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: "Datos inválidos.",
      details: error.issues,
    });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: error.message });
    return;
  }
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    error.code === "P2002"
  ) {
    response.status(409).json({ error: "El folio o identificador ya existe." });
    return;
  }
  console.error(error);
  response.status(500).json({ error: "Error interno del servidor." });
}) satisfies ErrorRequestHandler);

app.listen(port, () => {
  console.log(`TapTicket API disponible en http://localhost:${port}`);
});
