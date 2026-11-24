# Checklist Operativo · Evaluación de tiendas OXXO

Aplicación web para realizar el checklist operativo en tienda desde el celular: respuesta **Cumple / No cumple / No aplica**, comentarios y **fotos de evidencia** por pregunta; historial, dashboard ejecutivo, seguimiento por tienda, **reporte PDF** y **correo** listo para Outlook.

Mantiene la identidad visual del *Planificador de aperturas* (mismo `styles.css`, barra lateral, cuadros de tienda, diálogos e íconos).

- Arquitectura, modelo de datos y decisiones: [docs/arquitectura.md](docs/arquitectura.md)
- Manual de usuario: [docs/manual-usuario.md](docs/manual-usuario.md)
- Scripts SQL PostgreSQL: [001_init.sql](database/postgres/001_init.sql), [002_tiendas_ro.sql](database/postgres/002_tiendas_ro.sql) (en orden)

## Demo en GitHub Pages (para pruebas)

Cada push a `main` publica una versión **demo** en GitHub Pages (`.github/workflows/pages.yml`):
**https://danstook.github.io/CHECK-LIST-TIENDA/**

- Es la misma app, compilada como sitio estático (`npm run build:demo`). Como Pages no ejecuta servidor, la API, la base de datos (SQLite en WebAssembly), las fotos y el PDF corren **dentro del navegador** en un *service worker* (`src/demo/sw.ts`), con los mismos route handlers y consultas que el servidor.
- Los datos se guardan **solo en el navegador de cada persona** (IndexedDB): cada quien ve sus propias pruebas. Empieza con el checklist de 5 preguntas y el catálogo de tiendas de `db/tiendas-region.json` (hoy: las 247 tiendas de **Plaza Playas** con su RO). Ese archivo es público junto con el repositorio.
- Funciona igual en el celular (cámara incluida). El correo se genera como `.eml` para Outlook Desktop; el borrador con Microsoft Graph solo existe en la versión con servidor.
- Probar localmente antes de publicar:
  ```bash
  npm run build:demo
  ```
  ```bash
  node scripts/serve-demo.mjs
  ```
  y abrir <http://localhost:3200/CHECK-LIST-TIENDA/>.
- Primera vez en el repositorio: **Settings › Pages › Source: GitHub Actions** (el workflow intenta activarlo solo).

---

## Manual de instalación

### Requisitos
- **Node.js 24 LTS** (incluye SQLite integrado). Verificar: `node -v`
- Acceso al registro de npm (el proxy corporativo lo permite).
- No se necesita PostgreSQL, Docker ni permisos de administrador para correrla localmente.

### 1. Instalación local (piloto)
```bash
npm install
```
```bash
npm run setup
```
`setup` crea la base `data/ckl.db`, aplica las migraciones y carga el checklist **Evaluación Tienda Completa** (5 preguntas) con sus categorías y un usuario *Administrador*.

```bash
npm run dev
```
Abrir <http://localhost:3100>, elegir **Administrador** e importar las tiendas en **Tiendas › Importar concentrado**.

Desde un celular en la misma red: `http://<IP de la PC>:3100` (la IP aparece al arrancar como *Network*).

> **Datos de demostración** (opcional): `npm run db:demo` crea 6 tiendas de ejemplo `Oxxo 001…006` con 6 meses de evaluaciones para ver el dashboard. Se quitan con `npm run db:demo -- --clear`.

### 2. Producción

#### Compilar y ejecutar
```bash
npm run build
```
```bash
npm start
```
Escucha en el puerto 3100 (cambiar en `package.json` o con un proxy inverso). En Azure App Service (Linux, Node 24): comando de inicio `npm start`.

#### Base de datos PostgreSQL
1. Crear la base (`ckl`) y un usuario con permisos sobre ella.
2. En `.env`:
   ```
   DATABASE_URL="postgresql://usuario:clave@servidor:5432/ckl?sslmode=require"
   ```
3. `npm run setup` (o que el DBA ejecute `database/postgres/001_init.sql` y luego `npm run db:seed`).

Si `DATABASE_URL` empieza con `postgres://` o `postgresql://` se usa PostgreSQL; si está vacío, SQLite.

#### Evidencias en Azure Blob Storage
```
STORAGE_DRIVER="azure"
AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=…"
AZURE_STORAGE_CONTAINER="evidencias"
```
El contenedor puede ser **privado**: las fotos se entregan a través de la app, que valida la sesión. Estructura: `evidencias/CR/AAAA/MM/<folio>_<uuid>.jpg`.

En modo local (`STORAGE_DRIVER="local"`) las fotos quedan en `STORAGE_DIR` (por defecto `./storage`). Respaldar esa carpeta junto con la base.

#### Microsoft Entra ID (inicio de sesión) y Microsoft Graph (borrador en Outlook)
1. Portal de Azure › **Microsoft Entra ID › Registros de aplicaciones › Nuevo registro**.
   - URI de redirección (Web): `https://<tu-dominio>/api/auth/callback/azure-ad`
2. **Certificados y secretos** › nuevo secreto de cliente.
3. **Permisos de API** › Microsoft Graph › *Delegados*: `openid`, `profile`, `email`, `offline_access`, `User.Read`, **`Mail.ReadWrite`** › *Conceder consentimiento de administrador*.
4. En `.env`:
   ```
   NEXTAUTH_URL="https://<tu-dominio>"
   NEXTAUTH_SECRET="<cadena aleatoria de 32+ caracteres>"
   AZURE_AD_CLIENT_ID="<Id. de aplicación>"
   AZURE_AD_CLIENT_SECRET="<secreto>"
   AZURE_AD_TENANT_ID="<Id. de directorio>"
   ```
5. Reiniciar. Cada persona entra con su cuenta corporativa y se registra sola como *Evaluador*. Un administrador le cambia el rol en **Usuarios** (el primer administrador: asignar su correo al usuario *Administrador* antes de activar Entra ID, o actualizar `rol='admin'` en la tabla `usuarios`).

Con Entra ID activo aparece el botón **Crear borrador en Outlook**: el correo con PDF y fotos queda en *Borradores* del buzón (Outlook Web y Desktop). Sin Entra ID se usa **Abrir en Outlook Desktop** (archivo `.eml`), que no requiere permisos.

#### Logo en el PDF
Colocar el logo oficial autorizado en `public/img/logo.png` (o `.jpg`). Si no existe, el PDF sale sin logo.

### Variables de entorno

| Variable | Descripción | Predeterminado |
|---|---|---|
| `DATABASE_URL` | Cadena PostgreSQL; vacía = SQLite | vacío |
| `SQLITE_PATH` | Archivo SQLite | `./data/ckl.db` |
| `STORAGE_DRIVER` | `local` o `azure` | `local` |
| `STORAGE_DIR` | Carpeta de evidencias (local) | `./storage` |
| `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_CONTAINER` | Blob Storage | — |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `AZURE_AD_*` | Entra ID | — (modo local) |
| `NEXT_PUBLIC_APP_TZ` | Zona horaria para fechas | `America/Tijuana` |

### Notas para equipos FEMSA
- El proxy bloquea binarios nativos de npm: por eso **no se usa Prisma** y Next.js compila con **WebAssembly** (`@next/swc-wasm-nodejs`). Al iniciar, Next intenta descargar el compilador nativo y, al no poder, usa el WASM automáticamente (mensaje *Downloading swc package…*; es normal).
- La carpeta está en OneDrive y su nombre tiene `&`: los scripts llaman a `node node_modules/...` directamente. Usa siempre `npm run <script>`, no `npx`.
- Para producción conviene que el código viva fuera de OneDrive (OneDrive bloquea archivos de `node_modules` al sincronizar).

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo en el puerto 3100 |
| `npm run build` / `npm start` | Compilar y ejecutar en producción |
| `npm run setup` | Migraciones + checklist inicial |
| `npm run db:migrate` | Solo migraciones |
| `npm run db:seed` | Checklist, categorías y preguntas iniciales (no duplica) |
| `npm run db:tiendas` | Carga/actualiza el catálogo de `db/tiendas-region.json` |
| `npm run db:demo` | Datos de demostración (`-- --clear` para quitarlos) |
| `npm run typecheck` | Revisión de tipos TypeScript |
| `npm run build:demo` | Versión demo estática para GitHub Pages (en `out/`) |
