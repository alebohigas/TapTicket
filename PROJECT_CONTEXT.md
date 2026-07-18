# TapTicket — Contexto del Proyecto

## 1. Resumen

TapTicket es un sistema de tickets digitales para comercios con alto volumen de operaciones, como gasolineras, tiendas de conveniencia, estacionamientos, farmacias y restaurantes.

El objetivo es permitir que, después de completar una compra, el cliente elija recibir un ticket digital en lugar de uno impreso. Para obtenerlo, acerca su celular a una etiqueta NFC instalada en la caja, terminal o bomba. El NFC abre una página web móvil con el ticket correspondiente.

El cliente no debe instalar una aplicación.

---

## 2. Problema que resuelve

Los comercios imprimen grandes cantidades de tickets que:

- Consumen papel térmico.
- Generan basura.
- Requieren mantenimiento de impresoras.
- Se pierden fácilmente.
- Ralentizan algunas operaciones.
- Complican devoluciones, facturación y garantías.
- No crean una relación digital con el cliente.

TapTicket busca reducir la impresión y convertir el ticket en un punto de acceso digital para:

- Consultar la compra.
- Descargar el ticket.
- Compartirlo.
- Iniciar una factura.
- Facilitar devoluciones.
- Incorporar posteriormente lealtad, promociones y analítica.

---

## 3. Experiencia del usuario

### Flujo principal

1. El cliente realiza una compra.
2. El cajero pregunta si desea ticket físico o digital.
3. El cliente elige ticket digital.
4. El cajero activa el ticket digital desde el sistema.
5. La pantalla indica: “Acerca tu celular”.
6. El cliente acerca su teléfono al NFC.
7. El teléfono abre una URL en el navegador.
8. El servidor identifica el ticket activo de esa terminal.
9. El cliente reclama el ticket.
10. El ticket queda ligado a una URL única.
11. Otro dispositivo ya no puede reclamarlo.
12. El cliente puede consultar, descargar o compartir el ticket.

### Alternativa

Debe mostrarse un código QR junto al NFC para:

- Teléfonos sin NFC.
- NFC desactivado.
- Problemas con fundas.
- Usuarios que prefieren escanear.

---

## 4. Principio técnico principal

La etiqueta NFC no contiene el ticket.

La etiqueta NFC contiene únicamente una URL fija asociada a una terminal.

Ejemplo:

```text
https://ticket.example.com/tap/STORE-001/TERMINAL-03
```

El servidor determina qué ticket está activo en esa terminal.

Cuando el primer cliente abre la URL:

1. El servidor valida que exista un ticket disponible.
2. Verifica que no haya expirado.
3. Genera un token público no predecible.
4. Marca el ticket como reclamado.
5. Redirige al cliente a una URL permanente.

Ejemplo:

```text
https://ticket.example.com/r/7Jk29XmQp4
```

---

## 5. Alcance del MVP

El MVP debe incluir:

1. Panel de cajero.
2. Creación manual de una venta.
3. Administración básica de:
   - Comercio.
   - Sucursal.
   - Terminal.
4. Captura de:
   - Folio.
   - Fecha y hora.
   - Productos.
   - Cantidades.
   - Precios unitarios.
   - Subtotal.
   - Impuestos.
   - Total.
   - Método de pago.
5. Activación temporal del ticket.
6. Duración configurable, inicialmente 60 segundos.
7. URL fija por terminal.
8. Reclamo único del ticket.
9. Prevención de doble reclamo.
10. Página pública móvil del ticket.
11. Descarga en PDF.
12. Botón de compartir.
13. Código QR de respaldo.
14. Registro de eventos.
15. Estados del ticket.
16. Vista básica de métricas.

---

## 6. Fuera del alcance inicial

No implementar todavía:

- Aplicación móvil nativa.
- WhatsApp Business API.
- Envío automático por WhatsApp.
- Integraciones bancarias.
- Integración con terminales de pago.
- CFDI.
- Facturación automática.
- Programas de lealtad.
- Promociones.
- Wallet de Apple o Google.
- Hardware NFC dinámico.
- Pagos reales.
- Integraciones con POS comerciales.
- Multiidioma.
- Analítica avanzada.
- Publicidad.
- Inteligencia artificial.

---

## 7. Stack inicial

### Frontend

- React.
- TypeScript.
- Vite.
- Tailwind CSS.
- Diseño responsive.
- Enfoque mobile-first.

### Backend

- Node.js.
- TypeScript.
- Express.

### Base de datos

Para desarrollo:

- SQLite.

Preparar la arquitectura para migrar posteriormente a:

- PostgreSQL.

### ORM

- Prisma.

### PDF

Generar el ticket a partir de HTML.

Opciones aceptables:

- Puppeteer.
- Playwright.
- PDFKit.

Preferencia inicial:

- HTML a PDF para mantener la misma plantilla visual del ticket web.

### QR

Generar un QR con la misma URL fija del NFC.

### Repositorio

- Git.
- Commits pequeños.
- Cambios fáciles de revisar.

---

## 8. Entidades principales

### Merchant

Representa al comercio.

Campos sugeridos:

- id
- name
- legalName
- taxId
- status
- createdAt
- updatedAt

### Store

Representa una sucursal.

Campos sugeridos:

- id
- merchantId
- name
- code
- address
- status
- createdAt
- updatedAt

### Terminal

Representa una caja, bomba o punto físico.

Campos sugeridos:

- id
- storeId
- name
- code
- publicSlug
- status
- createdAt
- updatedAt

### Receipt

Representa el ticket.

Campos sugeridos:

- id
- terminalId
- folio
- status
- subtotal
- tax
- total
- paymentMethod
- activatedAt
- expiresAt
- claimedAt
- claimToken
- createdAt
- updatedAt

### ReceiptItem

Representa una línea del ticket.

Campos sugeridos:

- id
- receiptId
- description
- quantity
- unitPrice
- total

### ReceiptEvent

Registra cambios y acciones.

Campos sugeridos:

- id
- receiptId
- eventType
- metadata
- ipAddress
- userAgent
- createdAt

---

## 9. Estados del ticket

Estados iniciales:

```text
DRAFT
READY
ACTIVE
CLAIMED
EXPIRED
CANCELLED
```

### DRAFT

El ticket está en captura.

### READY

El ticket fue creado, pero todavía no está disponible para reclamar.

### ACTIVE

El ticket puede reclamarse desde el NFC o QR.

### CLAIMED

Un cliente ya obtuvo el ticket.

### EXPIRED

La ventana de reclamo terminó.

### CANCELLED

El ticket fue cancelado manualmente.

---

## 10. Reglas de negocio

1. Una terminal solo puede tener un ticket activo a la vez.
2. Un ticket activo debe tener una fecha de expiración.
3. Un ticket expirado no puede reclamarse.
4. Un ticket reclamado no puede reclamarse nuevamente.
5. El token público debe ser aleatorio y no predecible.
6. No usar folios consecutivos como URL pública.
7. No guardar datos completos de tarjetas bancarias.
8. No mostrar datos sensibles del cliente.
9. Registrar activaciones, reclamos, expiraciones y descargas.
10. El proceso de reclamo debe ser atómico para evitar condiciones de carrera.
11. El QR y el NFC deben apuntar a la misma ruta de terminal.
12. El ticket web debe funcionar sin cuenta.
13. El cliente no debe proporcionar teléfono o correo para ver el ticket.

---

## 11. Seguridad

Requisitos mínimos:

- HTTPS.
- Tokens aleatorios.
- Rate limiting.
- Validación de entradas.
- Sanitización de contenido.
- Protección contra inyección.
- Encabezados de seguridad.
- Registro de auditoría.
- Expiración de sesiones.
- No almacenar información bancaria sensible.
- No exponer IDs internos.
- No usar tokens secuenciales.
- Evitar que dos clientes reclamen el mismo ticket.

La operación de reclamo debe ejecutarse dentro de una transacción de base de datos.

---

## 12. Endpoints sugeridos

### Crear ticket

```http
POST /api/receipts
```

### Activar ticket

```http
POST /api/receipts/:receiptId/activate
```

### Cancelar ticket

```http
POST /api/receipts/:receiptId/cancel
```

### Consultar terminal

```http
GET /api/terminals/:terminalId
```

### Abrir NFC o QR

```http
GET /tap/:storeSlug/:terminalSlug
```

### Ver ticket reclamado

```http
GET /r/:claimToken
```

### Descargar PDF

```http
GET /r/:claimToken/pdf
```

### Consultar eventos

```http
GET /api/receipts/:receiptId/events
```

---

## 13. Ejemplo de creación de ticket

```json
{
  "merchantId": "MERCHANT-001",
  "storeId": "STORE-001",
  "terminalId": "TERMINAL-03",
  "folio": "A-00018492",
  "items": [
    {
      "description": "Gasolina Magna",
      "quantity": 32.45,
      "unitPrice": 24.19,
      "total": 784.57
    }
  ],
  "subtotal": 676.35,
  "tax": 108.22,
  "total": 784.57,
  "paymentMethod": "CARD"
}
```

---

## 14. Pantallas del MVP

### Panel del cajero

Debe permitir:

- Seleccionar sucursal.
- Seleccionar terminal.
- Crear ticket.
- Agregar productos.
- Calcular total.
- Activar ticket.
- Mostrar tiempo restante.
- Ver estado.
- Cancelar activación.
- Confirmar que fue reclamado.

### Pantalla de espera

Debe mostrar:

- “Acerca tu celular”.
- Código QR.
- Tiempo restante.
- Folio.
- Total.
- Estado del ticket.

### Ticket público

Debe mostrar:

- Comercio.
- Sucursal.
- Folio.
- Fecha.
- Productos.
- Cantidades.
- Precios.
- Impuestos.
- Total.
- Método de pago en forma genérica.
- Botón para descargar PDF.
- Botón para compartir.
- Botón de facturación como placeholder.

### Panel administrativo

Para el MVP puede ser básico.

Debe permitir:

- Ver comercios.
- Ver sucursales.
- Ver terminales.
- Ver tickets.
- Ver estados.
- Ver eventos.
- Ver métricas simples.

---

## 15. Métricas iniciales

Registrar:

- Tickets creados.
- Tickets activados.
- Tickets reclamados.
- Tickets expirados.
- Porcentaje de reclamo.
- Tiempo promedio hasta el reclamo.
- Descargas de PDF.
- Uso del botón compartir.
- Uso de QR versus NFC, si es posible medirlo.
- Tickets por terminal.
- Tickets por sucursal.

---

## 16. Criterios de aceptación del MVP

El MVP se considera funcional cuando:

1. Un cajero puede crear un ticket manualmente.
2. Puede activarlo durante 60 segundos.
3. Una URL fija de terminal detecta el ticket activo.
4. El primer cliente puede reclamarlo.
5. El sistema genera una URL pública única.
6. Un segundo cliente no puede reclamar el mismo ticket.
7. El ticket se ve correctamente en celular.
8. Puede descargarse como PDF.
9. Puede compartirse mediante la función del navegador.
10. El cajero puede ver que fue reclamado.
11. Los eventos quedan registrados.
12. El proyecto puede ejecutarse localmente con instrucciones claras.

---

## 17. Prioridad de implementación

### Fase 1

- Inicializar monorepo.
- Configurar frontend.
- Configurar backend.
- Configurar Prisma.
- Crear esquema de base de datos.
- Crear datos de prueba.

### Fase 2

- Panel para crear ticket.
- Lista de productos.
- Cálculo de totales.
- Activación.

### Fase 3

- Ruta pública por terminal.
- Reclamo atómico.
- Token público.
- Expiración.

### Fase 4

- Página móvil del ticket.
- QR.
- PDF.
- Compartir.

### Fase 5

- Eventos.
- Métricas.
- Manejo de errores.
- Pruebas.

---

## 18. Estructura sugerida

```text
tapticket/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── database/
│   ├── shared/
│   └── ui/
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── product.md
├── .env.example
├── package.json
├── PROJECT_CONTEXT.md
└── README.md
```

---

## 19. Instrucciones para Codex

Trabajar con estas reglas:

1. No ampliar el alcance sin justificarlo.
2. Priorizar una demostración local funcional.
3. Mantener frontend y backend separados.
4. Usar TypeScript estricto.
5. Crear tipos compartidos cuando sea conveniente.
6. Mantener las funciones pequeñas.
7. Implementar validaciones.
8. Agregar manejo de errores.
9. Documentar variables de entorno.
10. No incluir secretos.
11. Crear datos de prueba.
12. Agregar pruebas para el reclamo único.
13. Trabajar con commits pequeños y descriptivos.
14. Explicar cómo ejecutar cada parte.
15. Actualizar el README al cambiar la arquitectura.

---

## 20. Primera tarea para Codex

Crear la primera versión local del proyecto.

Entregables:

1. Monorepo funcional.
2. Aplicación web.
3. API.
4. Base de datos SQLite con Prisma.
5. Esquema inicial.
6. Seed con un comercio, una sucursal y una terminal.
7. Pantalla para crear un ticket.
8. Botón para activarlo.
9. URL pública de terminal.
10. Reclamo único.
11. Vista móvil del ticket.
12. README con instrucciones.

Antes de implementar:

1. Revisar este documento.
2. Proponer la arquitectura final.
3. Identificar decisiones técnicas pendientes.
4. Crear un plan por etapas.
5. Implementar sin desviarse del alcance.
