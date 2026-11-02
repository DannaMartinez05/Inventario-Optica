# Instalación y ejecución — Inventario Óptica

Esta guía permite preparar el proyecto y ejecutarlo localmente en un equipo de desarrollo.

## 1. Requisitos previos

Instalar:

- Node.js, con una versión compatible con Vite 8 (se recomienda una versión LTS compatible; verificarla antes de instalar).
- npm (incluido con Node.js).
- PostgreSQL.
- Un navegador moderno.

Opcionales: Visual Studio Code y pgAdmin 4 o `psql`.

Comprobar desde PowerShell:

```powershell
node -v
npm -v
psql --version
```

Las versiones exactas usadas durante el desarrollo deben confirmarse en el equipo original; el repositorio no fija la versión de Node.js ni de PostgreSQL.

## 2. Preparar PostgreSQL y la base de datos

### Si se utiliza la base original de la óptica

Configurar el backend para conectarse a esa base existente. **No crear otra base para sustituirla, no restaurar un esquema encima de ella y no ejecutar datos ficticios, `DROP`, `TRUNCATE` ni scripts de reinicialización.**

Antes de cualquier cambio:
1. Realizar una copia de seguridad.
2. Revisar el script y las tablas afectadas.
3. Probar el cambio en una base de pruebas independiente.
4. Aplicarlo a la base original únicamente con autorización.

### Si se monta el sistema en un equipo nuevo

Se necesita el respaldo o script SQL oficial, compatible con esta versión del backend. El ZIP del proyecto revisado no incluía el script SQL, por lo que debe solicitarse al responsable y entregarse junto con esta documentación antes de intentar una instalación desde cero.

El esquema revisado utiliza, entre otras, las tablas `tenant` y `usuario`. El código de creación del administrador espera que exista un tenant con `id_tenant = 1`.

**No ejecutar `datos_prueba.sql` sobre la base original.** Ese archivo, si se utiliza, debe reservarse para una base de pruebas vacía e independiente.

## 3. Configurar el backend

Desde la carpeta raíz del proyecto:

```powershell
cd backend
npm ci
```

Crear `backend/.env` a partir de `backend/.env.example` (si el archivo de ejemplo aún no está en el repositorio, crearlo con las variables siguientes):

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=NOMBRE_DE_LA_BASE
DB_USER=USUARIO_POSTGRES
DB_PASSWORD=CONTRASENA_POSTGRES

JWT_SECRET=SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
```

Reemplazar los valores de ejemplo por los del entorno local. El backend exige `JWT_SECRET` con al menos 32 caracteres.

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend. Por defecto, `3000`. |
| `FRONTEND_URL` | Origen del frontend permitido por CORS. |
| `DB_HOST` | Host del servidor PostgreSQL. |
| `DB_PORT` | Puerto PostgreSQL; normalmente `5432`. |
| `DB_NAME` | Nombre exacto de la base que utilizará la aplicación. |
| `DB_USER` | Usuario de PostgreSQL. |
| `DB_PASSWORD` | Contraseña del usuario. |
| `JWT_SECRET` | Secreto privado para firmar los tokens JWT; mínimo 32 caracteres. |

No subir ni compartir el archivo `.env` real. El repositorio debe contener solo `.env.example` con valores ficticios.

## 4. Instalar dependencias del frontend

Abrir una segunda terminal desde la carpeta raíz:

```powershell
cd frontend
npm ci
```

`npm ci` instala las versiones definidas en `frontend/package-lock.json`.

## 5. Usuarios de prueba

El sistema dispone de cuentas de los roles **administrador** y **empleado** en el entorno actual. Para entregar el proyecto a otro equipo, registrar aquí los datos de las cuentas que se hayan verificado en la base de datos que acompañará la entrega.

| Rol | Correo de acceso | Contraseña |
|---|---|---|
| Administrador | `admin@ocadhas.com` | Entregar por canal privado, no publicar aquí |
| Empleado | `dayen5525@gmail.com` | Entregar por canal privado, no publicar aquí |

**Antes de entregar:** sustituir los correos por los usuarios reales que se hayan probado. No subir contraseñas reales al repositorio público ni incluirlas en archivos versionados. Si el repositorio es privado, igualmente es preferible compartir las contraseñas por un canal separado y seguro.

El frontend revisado envía `tenant_id: 1` en el inicio de sesión. Los usuarios de prueba deben pertenecer al tenant correspondiente a ese identificador, o el código debe configurarse para el tenant correcto.

## 6. Crear un administrador (solo si es necesario)

El proyecto incluye `backend/crearAdmin.js`. El script solicita nombre, correo y contraseña y crea un usuario con rol `admin` asociado a `id_tenant = 1`.

Ejecutarlo únicamente si se ha confirmado que:
- La base de datos está preparada y respaldada.
- Existe el tenant `id_tenant = 1`.
- El correo no está registrado.
- El responsable autorizó crear el usuario.

Desde `backend/`:

```powershell
node crearAdmin.js
```

El código exige una contraseña de entre 12 y 72 caracteres. No ejecutar este script si el administrador ya existe.

## 7. Iniciar la aplicación

Mantener dos terminales abiertas.

**Terminal 1 — Backend**

```powershell
cd backend
npm run dev
```

El backend inicia por defecto en `http://localhost:3000`. Para iniciarlo sin Nodemon:

```powershell
npm start
```

**Terminal 2 — Frontend**

```powershell
cd frontend
npm run dev
```

Vite muestra la dirección local en la terminal. La configuración revisada utiliza normalmente:

```text
http://localhost:5173
```

Abrir esa dirección en el navegador.

## 8. Verificar el funcionamiento

- API: `http://localhost:3000/api/health`. Debe responder con estado `ok` y mensaje `API funcionando`.
- Conexión de base de datos: `GET /api/health/db`. Requiere un token válido y devuelve el nombre de la base conectada.
- Frontend: comprobar que aparece el inicio de sesión.
- Acceso: probar las cuentas de administrador y empleado documentadas arriba.
- Permisos: verificar que cada rol solo pueda acceder a las funciones autorizadas.

La ruta de salud confirma que la API responde, pero no demuestra que todos los módulos estén correctos. Ejecutar los casos de prueba funcionales.

## 9. Comandos útiles

| Carpeta | Comando | Función |
|---|---|---|
| `backend/` | `npm ci` | Instalar dependencias. |
| `backend/` | `npm run dev` | Iniciar backend en desarrollo. |
| `backend/` | `npm start` | Iniciar backend. |
| `backend/` | `node crearAdmin.js` | Crear administrador, si hace falta. |
| `frontend/` | `npm ci` | Instalar dependencias. |
| `frontend/` | `npm run dev` | Iniciar Vite. |
| `frontend/` | `npm run build` | Crear compilación de producción. |
| `frontend/` | `npm run preview` | Previsualizar compilación. |
| `frontend/` | `npm run lint` | Ejecutar ESLint. |

## 10. Problemas frecuentes

- **No conecta a PostgreSQL:** verificar que el servicio esté iniciado y revisar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.
- **Error de JWT:** revisar que `JWT_SECRET` exista y tenga al menos 32 caracteres.
- **Error de CORS:** comprobar que `FRONTEND_URL` coincida con el origen real de Vite.
- **No encuentra una tabla o columna:** comprobar que se restauró el SQL oficial correspondiente a esta versión. No ejecutar scripts desconocidos sobre la base original.
- **Puerto ocupado:** liberar el puerto o cambiarlo y actualizar la configuración correspondiente.
- **No carga el frontend:** ejecutar `npm ci` dentro de `frontend` y comprobar que Vite esté activo.

## 11. Estado de despliegue

El sistema no tiene actualmente una URL pública de producción. Se ejecuta localmente:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

Estas direcciones solo funcionan en el equipo donde se ejecutan los servicios (o desde equipos autorizados en la red, si se configura expresamente). No son enlaces públicos de internet.

## 12. Pendientes para una instalación reproducible

1. Entregar el script o respaldo SQL oficial y compatible.
2. Confirmar las versiones exactas de Node.js y PostgreSQL usadas en el equipo original.
3. Incorporar `backend/.env.example` sin secretos.
4. Completar los correos de las cuentas de prueba y verificar ambos accesos.
5. Probar la instalación completa en un segundo equipo.
6. Ejecutar los casos de prueba y documentar resultados.
