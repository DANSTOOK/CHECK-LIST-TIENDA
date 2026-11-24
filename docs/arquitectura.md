# Arquitectura · Checklist Operativo OXXO

## 1. Análisis previo

### Proyecto de referencia (`planificador apertura`)
- HTML + CSS + JavaScript sin dependencias, datos en `localStorage`, publicado en GitHub Pages.
- Sistema visual propio en `styles.css` (≈1,250 líneas): tokens de color claro/oscuro, IBM Plex Sans/Mono, barra lateral, cuadros de tienda con brillo, paneles, KPIs, diálogos nativos `<dialog>`, aviso flotante, visor de imágenes, miniaturas, compresión de fotos en el navegador y correo `.eml` "Abrir en Outlook".
- Experiencia pensada para gente con poca práctica en portales: botones grandes, textos claros, consejos en pantalla.

### Formatos recibidos
| Archivo | Contenido | Uso en la app |
|---|---|---|
| `Evaluacion Tienda Completa.pdf/.pptx` | 5 reactivos de orden y limpieza con ejemplos fotográficos; "Anexa evidencia fotográfica del hallazgo y de acuerdo con tu calificación" | Checklist inicial (categoría **Limpieza**). Reactivos 1–4: foto obligatoria siempre; reactivo 5: foto obligatoria si no cumple. |
| `Manual de copiado de plantillas en conteos propios.pdf` | Procedimiento de soporte TI (XMonitor, Service API) | **No es un checklist**: no se cargó como preguntas. Si se quiere evaluar, se puede agregar en *Sistemas* desde Administración. |

### Riesgos técnicos detectados (y cómo se resolvieron)
| Riesgo | Impacto | Decisión |
|---|---|---|
| El proxy corporativo **bloquea la descarga de binarios** (motores de Prisma, `@next/swc-win32`, `.node`) | Prisma no se puede instalar en equipos FEMSA | Capa de datos con **Kysely** (TypeScript puro) + `node:sqlite` (integrado en Node 24) en local y `pg` en producción. Next.js usa el compilador **WASM** (`@next/swc-wasm-nodejs`). |
| No hay PostgreSQL/Docker en el equipo | No se puede probar localmente con Postgres | SQLite local con el **mismo código y migraciones**; PostgreSQL se activa solo cambiando `DATABASE_URL`. |
| La ruta de OneDrive contiene `&` | Rompe los atajos `.cmd` de `node_modules/.bin` | Los scripts de `package.json` llaman a `node <ruta del CLI>` directamente. |
| Fotos pesadas desde celular y señal débil en tienda | Subidas lentas o perdidas | Compresión en el teléfono (JPEG, máx. 1600 px, ~200–400 KB) y **autoguardado** de cada respuesta/foto. |
| Cambiar preguntas alteraría evaluaciones pasadas | Historial no confiable para auditoría | Cada respuesta guarda **copia** del texto, categoría, regla de foto y peso. Evaluación finalizada = solo lectura. |
| Graph requiere permisos de Entra ID que aún no existen | No se podría generar el borrador | Doble camino: `.eml` (Outlook Desktop, sin permisos) y Graph (borrador en el buzón) cuando se configure Entra ID. |
| WEBP no se puede incrustar en PDF | PDF sin fotos | El navegador convierte toda foto a JPEG antes de subirla. |

## 2. Arquitectura

```
 Celular / PC (navegador)
   │  React (Next.js App Router) · mismo CSS del planificador · Recharts
   ▼
 Next.js 15 (Node 24)
   ├─ Páginas de servidor: consultan la BD directo (dashboard, historial, seguimiento)
   ├─ API Routes /api/*: tiendas, evaluaciones, evidencias, PDF, correo, administración
   ├─ lib/auth   → Entra ID (next-auth) o modo local
   ├─ lib/db     → Kysely ─┬─ SQLite (node:sqlite)   [local / piloto]
   │                       └─ PostgreSQL (pg)         [producción]
   ├─ lib/storage→ disco local (./storage) o Azure Blob Storage
   ├─ lib/pdf    → pdf-lib (JS puro)
   └─ lib/mail   → .eml para Outlook Desktop  |  Microsoft Graph (borrador en Outlook)
```

**Por qué así**
- **Next.js + TypeScript**: un solo proyecto para interfaz y API, fácil de desplegar en Azure App Service.
- **Sin Tailwind/shadcn**: se pidió conservar la identidad del planificador; su CSS ya es un sistema de diseño completo. Se copió *sin cambios* (`src/app/base.css`) y lo nuevo vive en `src/app/ckl.css` con los mismos tokens. Agregar Tailwind/shadcn duplicaría estilos y cambiaría el aspecto.
- **Kysely en lugar de Prisma**: ver riesgos. Mantiene tipado fuerte y migraciones versionadas.
- **pdf-lib** en lugar de Chrome/Puppeteer: no requiere navegador en el servidor (otro binario bloqueado).

## 3. Estructura de carpetas

```
CKL/
├─ .env / .env.example        Configuración (BD, almacenamiento, Entra ID)
├─ db/
│  ├─ cli.ts                  npm run setup | db:migrate | db:seed | db:demo
│  ├─ migrations.ts           Migraciones (SQLite y PostgreSQL)
│  ├─ seed.ts                 Checklist inicial (5 preguntas del PPTX) y categorías
│  └─ demo.ts                 Tiendas de ejemplo Oxxo 001…006 para probar tableros
├─ database/postgres/001_init.sql   Script SQL puro para el DBA
├─ docs/                      Arquitectura, manual de usuario
├─ public/img/                tienda.png (del planificador) · logo.png (opcional, para el PDF)
├─ storage/evidencias/CR/AAAA/MM/   Fotos (modo local)
└─ src/
   ├─ app/
   │  ├─ base.css             Sistema visual del planificador (copia sin cambios)
   │  ├─ ckl.css              Estilos nuevos con los mismos tokens
   │  ├─ layout.tsx           Barra lateral + acceso
   │  ├─ page.tsx             Dashboard
   │  ├─ tiendas/             Catálogo, importación y seguimiento por tienda ([cr])
   │  ├─ evaluaciones/        Historial; [id] = ejecución (Runner) o resultado
   │  ├─ admin/               Preguntas, destinatarios, usuarios
   │  └─ api/                 Endpoints REST
   ├─ components/             ui.tsx (Icon, Dialog, Toast, Lightbox…), Sidebar, Login, Charts
   └─ lib/                    db, auth, storage, score, evaluaciones, stats, pdf, mail, format
```

## 4. Modelo de datos

```mermaid
erDiagram
  usuarios ||--o{ evaluaciones : "evalúa"
  tiendas ||--o{ evaluaciones : "recibe"
  checklist ||--o{ preguntas : "contiene"
  checklist ||--o{ evaluaciones : "formato"
  categorias ||--o{ preguntas : "agrupa"
  categorias ||--o{ destinatarios_correo : "área"
  evaluaciones ||--|{ respuestas : "tiene"
  preguntas ||--o{ respuestas : "origen (copia)"
  respuestas ||--o{ evidencias : "fotos"
  evaluaciones ||--o{ evidencias : "folio"
  usuarios ||--o{ evidencias : "tomó"

  tiendas { varchar id PK; varchar cr UK; varchar nombre; varchar ciudad; varchar plaza; varchar estado; varchar region; varchar ro; bool activa }
  usuarios { varchar id PK; varchar nombre; varchar email UK; varchar rol; bool activo }
  checklist { varchar id PK; varchar nombre; bool activo }
  categorias { varchar id PK; varchar nombre UK; varchar color; int orden }
  preguntas { varchar id PK; varchar checklist_id FK; varchar categoria_id FK; text texto; text ayuda; varchar evidencia; int peso; int orden; bool activa }
  evaluaciones { varchar id PK; varchar folio UK; varchar tienda_id FK; varchar evaluador_id FK; timestamptz fecha; varchar estado; int cumple; int no_cumple; int no_aplica; numeric porcentaje }
  respuestas { varchar id PK; varchar evaluacion_id FK; varchar pregunta_id FK; varchar categoria; text texto; varchar resultado; text comentario; int peso }
  evidencias { varchar id PK; varchar respuesta_id FK; varchar evaluacion_id FK; varchar tienda_cr; varchar usuario_id FK; varchar ruta; varchar mime; int bytes; timestamptz created_at }
  destinatarios_correo { varchar id PK; varchar nombre; varchar email; varchar tipo; varchar categoria_id FK; varchar plaza; bool activo }
```

**Reglas de cálculo**
- % de cumplimiento = Σ peso de *Cumple* ÷ Σ peso de (*Cumple* + *No cumple*). *No aplica* no cuenta.
- Hallazgo = respuesta *No cumple* (requiere comentario).
- Tendencia: ↑ mejoró / ↓ empeoró / = se mantuvo (diferencia < 0.5 pts) contra la evaluación finalizada anterior de la misma tienda.
- Semáforo: ≥ 90 % verde, 75–89 % ámbar, < 75 % rojo.

## 5. Componentes reutilizados del planificador

| Planificador | En esta app |
|---|---|
| `styles.css` completo (tokens, tema claro/oscuro) | `src/app/base.css` (copia exacta) |
| Barra lateral `.sidebar/.brand/.nav/.side-store/.user-btn` | `components/Sidebar.tsx` (checklists en curso en lugar de aperturas) |
| Íconos SVG `ICONS` | `components/icons.ts` (+ cámara, gráfica, historial, PDF…) |
| Cuadros de tienda `.store-tile` con brillo y `tienda.png` | Catálogo de tiendas (cumplimiento y última visita) |
| `.home-head/.hs/.search/.seg/.kpis/.panel/.table` | Tiendas, dashboard, historial, seguimiento |
| Diálogos `<dialog>`, `.field`, `.grid-2/3` | `components/ui.tsx → Dialog` y todos los formularios |
| Aviso flotante `.toast`, visor `.lightbox`, miniaturas `.thumb` | `useToast`, `Lightbox`, evidencias |
| `compressImage()` | `comprimir()` en el checklist (JPEG para el PDF) |
| "Abrir en Outlook" (`.eml` con `X-Unsent: 1`) | Correo con PDF y fotos adjuntos |
| "¿Quién está actualizando?" | Acceso en modo local |
| Tema guardado en `localStorage` sin parpadeo | Igual (`ckl-theme`) |

## 6. Oportunidades de mejora (siguientes fases)
1. **Modo sin conexión (PWA)**: guardar respuestas y fotos en el teléfono y sincronizar al recuperar señal.
2. **Planes de acción**: asignar cada hallazgo a un responsable con fecha compromiso y cerrarlo con foto (reutilizando el esquema de estatus del planificador).
3. **Calificación por escala** (1–5) si el negocio la requiere; hoy es Cumple / No cumple / No aplica.
4. **Envío automático** con Graph `/sendMail` una vez validado el flujo de borradores.
5. **Varios formatos de checklist** (la tabla `checklist` ya lo permite).
6. Importar directamente `.xlsx` del concentrado (hoy: pegar desde Excel o CSV).
