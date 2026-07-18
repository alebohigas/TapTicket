# TapTicket MVP

TapTicket entrega un ticket digital sin instalar una aplicación. Cada caja o
bomba tiene una URL pública fija codificada en una etiqueta NFC y en un QR. El
cajero activa una venta durante 60 segundos y el siguiente teléfono que abre la
URL la reclama de forma exclusiva.

## Flujo de la demostración

1. El cajero abre `http://localhost:5173/admin`.
2. Configura la sucursal y la terminal.
3. Captura el folio y los productos de una venta.
4. Activa el ticket. La API lo deja disponible durante 60 segundos.
5. El cliente acerca su teléfono al NFC o escanea el QR de respaldo.
6. La ruta fija `/t/:slug` intenta reclamar el ticket con un identificador local
   del dispositivo.
7. La API realiza una actualización condicional dentro de una transacción. Solo
   un dispositivo puede pasar el ticket de `ACTIVE` a `CLAIMED`.
8. El cliente ve el ticket, puede compartir su URL privada o descargar el PDF.

Para probar con un teléfono real, cambia `APP_URL` y `VITE_API_URL` por la IP
local de la computadora y asegúrate de que ambos dispositivos estén en la misma
red.

## Arquitectura

```text
TapTicket/
├─ apps/
│  ├─ api/
│  │  ├─ prisma/          # esquema y migraciones SQLite
│  │  └─ src/
│  │     ├─ lib/          # Prisma y utilidades
│  │     ├─ routes/       # API administrativa y pública
│  │     └─ services/     # PDF HTML y reglas de dominio
│  └─ web/
│     └─ src/
│        ├─ components/
│        ├─ pages/        # panel, reclamo y ticket
│        └─ lib/
├─ .env.example
└─ package.json           # workspaces y comandos raíz
```

El frontend y el backend son aplicaciones separadas para que el API pueda
desplegarse independientemente. Prisma aísla el acceso a datos; migrar a
PostgreSQL requiere cambiar el proveedor y revisar los tipos, sin reescribir las
rutas. SQLite es únicamente la base de desarrollo.

La base del dominio parte de `Merchant` (comercio), `Branch` (sucursal),
`Terminal`, `Ticket`, `TicketItem` y `TicketEvent`. `Branch` conserva ese nombre
interno para mantener compatibilidad con el código existente, pero representa
la entidad `Store` descrita en `PROJECT_CONTEXT.md`.

## Estados y seguridad del reclamo

- `DRAFT`: venta capturada, todavía privada.
- `ACTIVE`: disponible hasta `activationExpiresAt`.
- `CLAIMED`: asociada a un `deviceId` y a un token aleatorio.
- `EXPIRED`: estado lógico registrado cuando se intenta usar una activación
  vencida.
- `CANCELLED`: reservado para una cancelación posterior.

La URL fija de terminal nunca contiene el ticket. Al reclamar, el backend emite
un token aleatorio. El enlace compartible utiliza ese token, mientras que la
operación atómica evita dos reclamos simultáneos. Esto es apropiado para el MVP;
producción requerirá HTTPS, límites de solicitudes, rotación de secretos,
autenticación del panel y PostgreSQL.

## Ejecutar

Requiere Node.js 20 o superior.

```bash
copy apps\api\.env.example apps\api\.env
copy apps\web\.env.example apps\web\.env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Las pruebas del reclamo único y de expiración se ejecutan con:

```bash
npm run test -w @tapticket/api
```

Abre el panel en `http://localhost:5173/admin`. La API queda en
`http://localhost:4000` y expone `GET /health`.

## Decisiones del MVP

- Monorepo con npm workspaces para compartir un solo proceso de instalación.
- Identidad de dispositivo anónima guardada en `localStorage`; no se recopila
  información personal.
- El total se calcula siempre en el servidor a partir de cantidades y precios.
- Importes almacenados en centavos para evitar errores de punto flotante.
- Bitácora `TicketEvent` para creación, activación, reclamo, expiración,
  visualización, descarga y compartición.
- PDF renderizado desde HTML con Chromium mediante Puppeteer. En Windows se
  reutiliza Chrome o Edge instalado; `CHROME_PATH` permite indicar otra ruta.
- QR estático generado en el panel y listo para imprimirse junto a la etiqueta
  NFC.
- Tailwind CSS está integrado con Vite para las nuevas vistas; los estilos
  existentes permanecen en CSS mientras se completa la migración gradual.

## Estado de implementación

La Fase 1 cubre el monorepo, las aplicaciones web/API, Prisma con SQLite, la
migración inicial y un seed idempotente con un comercio, una sucursal y una
terminal. Las capacidades visibles que ya existen en el repositorio pertenecen
a fases posteriores y se conservan, pero no se amplían como parte de esta fase.

La Fase 3 usa como ruta pública canónica
`/tap/:storeCode/:terminalSlug`. El reclamo devuelve únicamente un token
aleatorio y la ruta permanente `/r/:claimToken`; nunca devuelve IDs internos ni
el identificador local del dispositivo. Un índice parcial de SQLite y una
actualización condicional dentro de una transacción garantizan un solo ticket
activo y un solo reclamo por terminal.

La Fase 4 completa el ticket móvil y mantiene el mismo contenido en el PDF:
comercio, sucursal, folio, fecha, productos, subtotal, impuestos, total y método
de pago. El panel genera el QR con la misma URL canónica del NFC. La URL
permanente puede compartirse mediante Web Share o copiarse al portapapeles; la
facturación se muestra únicamente como función futura.

La Fase 5 añade auditoría básica a los eventos públicos (origen QR/NFC, IP y
navegador), límites de solicitudes y encabezados HTTP de seguridad. El panel
muestra tickets creados y reclamados, porcentaje y tiempo promedio de reclamo,
descargas, compartidos y origen de entrega. Los endpoints administrativos
permiten consultar el resumen, tickets recientes y la secuencia de eventos de
un ticket. No se considera analítica avanzada.

## Limitaciones conocidas

No incluye login del cajero, CFDI, pagos, POS comercial, WhatsApp, aplicación
móvil ni hardware NFC dinámico. La demostración usa una sola organización local.
