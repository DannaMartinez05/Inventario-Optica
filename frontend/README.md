# Sistema de inventario para óptica

Aplicación web para apoyar la administración de una óptica. El proyecto está organizado en un frontend desarrollado con React y Vite, y un backend desarrollado con Node.js y Express que se conecta a PostgreSQL.


## 1. Tecnologías identificadas

Versiones/rangos declarados en los `package.json` incluidos en el proyecto:

| Componente | Tecnología | Versión declarada |
|---|---|---|
| Frontend | React | ^19.2.8 |
| Herramienta frontend | Vite | ^8.3.0 |
| Backend | Express | ^5.3.0 |
| Entorno backend | Node.js | Versión exacta no documentada; instalar una versión LTS compatible con Vite 8 y las dependencias del proyecto. |
| Base de datos | PostgreSQL | Versión exacta no declarada en el ZIP. El proyecto usa el controlador `pg` para conectarse. |
| Driver PostgreSQL | pg | ^8.23.1 |
| Autenticación | jsonwebtoken | ^9.0.3 |
| Hash de contraseñas | bcryptjs | ^3.0.3 |

El frontend también declara `react-dom`, ESLint y `@vitejs/plugin-react`. El backend declara `cors`, `dotenv`, `express-rate-limit`, `express-validator`, `helmet` y `nodemon` (desarrollo).

## 2. ¿Qué se debe instalar en el equipo nuevo?

Instalar únicamente si no está disponible:

1. **Node.js (versión LTS compatible)**. Incluye npm. Verificar en una terminal:
   ```bash
   node -v
   npm -v
   ```
2. **PostgreSQL** (servidor de base de datos). Durante la instalación, recordar la contraseña del usuario administrador y el puerto configurado (normalmente `5432`).
3. **pgAdmin 4**, opcional pero recomendado para administrar PostgreSQL gráficamente. También se puede utilizar `psql`.
4. **Visual Studio Code**, opcional, para editar el código.
5. **Git**, opcional, si se va a clonar o administrar el proyecto con un repositorio.
6. Un navegador moderno, por ejemplo Chrome o Edge o brave.

No es necesario instalar React, Vite, Express ni las demás librerías globalmente: npm las instala localmente a partir de los archivos `package.json` y `package-lock.json`.

## 3. Estructura del proyecto

```text
Inventario Optica React/
├── backend/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   ├── crearAdmin.js
│   ├── database.js
│   ├── server.js
│   ├── package.json
│   ├── package-lock.json
│   └── .env.example   (crear a partir de este README)
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   ├── css/
    │   ├── assets/
    │   ├── api.js
    │   └── sesion.js
    ├── package.json
    └── package-lock.json
```

## 4. Preparar la base de datos

1. Instalar e iniciar PostgreSQL.
2. Crear una base de datos para la aplicación. En la versión revisada, el nombre de la base configurada depende de `DB_NAME` en el archivo `.env`.
3. Ejecutar sobre esa base el **script SQL oficial del proyecto** para crear tablas, relaciones, restricciones e información inicial requerida.
4. Verificar que existan, como mínimo, las tablas `tenant` y `usuario`, utilizadas directamente por el código revisado. El proceso `crearAdmin.js` también espera que exista un tenant con `id_tenant = 1`.

**Pendiente obligatorio:** el ZIP revisado no contiene el script SQL. No se debe asumir que basta con crear una base vacía. Solicitar al equipo desarrollador el respaldo o script SQL correcto de la base de datos que utiliza la aplicación y documentar su versión.

## 5. Configurar las variables de entorno del backend

Dentro de `backend`, crear un archivo llamado `.env` a partir de este ejemplo. Sustituir los valores de ejemplo por los datos del equipo local:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
JWT_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
DB_HOST=localhost
DB_PORT=5432
DB_NAME=NOMBRE_DE_LA_BASE_DE_DATOS
DB_USER=USUARIO_POSTGRES
DB_PASSWORD=CONTRASENA_POSTGRES
```

- `JWT_SECRET` debe ser un secreto aleatorio propio, de al menos 32 caracteres. No reutilizar el valor de otro equipo.
- `DB_NAME`, `DB_USER` y `DB_PASSWORD` deben coincidir con PostgreSQL.
- `FRONTEND_URL` debe coincidir con la dirección donde se ejecuta Vite.
- No compartir ni subir el `.env` real. El repositorio debe contener únicamente un `.env.example` sin credenciales reales.

## 6. Instalar dependencias

Abrir una terminal en la carpeta raíz del proyecto.

**Backend**, en una primera terminal:

```bash
cd backend
npm ci
```

**Frontend**, en una segunda terminal:

```bash
cd frontend
npm ci
```

`npm ci` utiliza los archivos `package-lock.json` incluidos para instalar las dependencias declaradas.

## 7. Crear el usuario administrador

Después de preparar la base de datos y configurar `backend/.env`, desde la carpeta `backend` ejecutar:

```bash
node crearAdmin.js
```

El programa solicita nombre, correo y contraseña. El código exige una contraseña de mínimo 12 caracteres y máximo 72, y crea el administrador asociado al tenant con `id_tenant = 1`.

Antes de ejecutarlo, confirmar que ese tenant exista en la base de datos y que el correo no esté registrado. No incluir contraseñas reales en este documento.

## 8. Iniciar la aplicación

Mantener dos terminales abiertas.

**Terminal 1 — Backend:**

```bash
cd backend
npm run dev
```

El servidor utiliza el puerto definido en `PORT` (por defecto `3000`). Para iniciar sin modo de desarrollo:

```bash
npm start
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

Vite mostrará en la terminal la dirección local. En la configuración revisada, el frontend se comunica con `http://localhost:3000/api` y el origen permitido por CORS se define mediante `FRONTEND_URL`.

Abrir en el navegador la dirección que indique Vite, normalmente:

```text
http://localhost:5173
```

## 9. Verificación básica

- Backend: abrir `http://localhost:3000/api/health`. Debe responder con estado `ok` y el mensaje `API funcionando`.
- Base de datos: la ruta `GET /api/health/db` está protegida y requiere un token de sesión válido; permite comprobar la conexión autorizada y devuelve el nombre de la base de datos.
- Frontend: comprobar que carga la pantalla de inicio de sesión y que puede comunicarse con el backend.

La respuesta de salud del backend no demuestra por sí sola que todas las tablas, módulos o procesos estén correctos. Ejecutar los casos de prueba del proyecto para verificar las funcionalidades.

## 10. Módulos identificados en el código

El backend registra rutas para autenticación y módulos privados de balance, inicio, inventario, clientes, cartera, crédito, costos, ventas, productos, movimientos y configuración. La autorización por rol se aplica en las rutas privadas: el código revisado permite `admin` y `empleado` en inventario y ventas, mientras que los demás módulos listados están restringidos a `admin`.

La disponibilidad y el comportamiento completo de cada funcionalidad deben validarse ejecutando la aplicación y sus casos de prueba.

## 11. Comandos útiles

| Ubicación | Comando | Uso |
|---|---|---|
| `backend/` | `npm ci` | Instalar dependencias del backend. |
| `backend/` | `npm run dev` | Iniciar backend en desarrollo con nodemon. |
| `backend/` | `npm start` | Iniciar backend. |
| `backend/` | `node crearAdmin.js` | Crear el usuario administrador inicial. |
| `frontend/` | `npm ci` | Instalar dependencias del frontend. |
| `frontend/` | `npm run dev` | Iniciar servidor de desarrollo Vite. |
| `frontend/` | `npm run build` | Generar compilación de producción. |
| `frontend/` | `npm run preview` | Previsualizar la compilación localmente. |
| `frontend/` | `npm run lint` | Ejecutar ESLint. |

## 12. Problemas frecuentes

- **No se puede conectar a PostgreSQL:** comprobar que el servicio esté iniciado, que el puerto, usuario, contraseña y nombre de base de datos coincidan con `.env`.
- **Error de autenticación o JWT:** comprobar que `JWT_SECRET` esté configurado y tenga al menos 32 caracteres. Volver a iniciar sesión después de cambiarlo.
- **Error de CORS:** comprobar que `FRONTEND_URL` coincida exactamente con el origen donde se ejecuta el frontend.
- **No se encuentra una tabla o columna:** comprobar que se ejecutó el script SQL correspondiente a la versión del backend. El ZIP entregado no incluye ese script.
- **Puerto ocupado:** cerrar el proceso que utiliza el puerto o configurar otro puerto y actualizar la configuración relacionada.
- **No carga el frontend:** verificar que se ejecutó `npm ci` dentro de `frontend` y que Vite está activo.

## 13. Seguridad y entrega a otro equipo

- No entregar el archivo `backend/.env` con contraseñas o secretos reales.
- Entregar `backend/.env.example` con nombres de variables y valores ficticios.
- No es necesario incluir las carpetas `node_modules`; se reconstruyen con `npm ci`.
- Mantener los `package-lock.json` para instalar versiones consistentes.
- Entregar el script SQL y documentar cómo restaurarlo; actualmente falta en el ZIP revisado.
- Crear credenciales nuevas para cada instalación y no publicar contraseñas.
- Realizar una copia de seguridad de la base de datos antes de migraciones o cambios estructurales.

## 14. Pendientes antes de considerar la instalación reproducible

1. Incorporar el script SQL completo y probado de la base de datos.
2. Confirmar y documentar la versión exacta de Node.js y PostgreSQL utilizada en desarrollo.
3. Crear y entregar `backend/.env.example` sin secretos.
4. Probar la instalación desde cero en un segundo equipo siguiendo este README.
5. Ejecutar los casos de prueba y registrar resultados reales.
6. Confirmar que los permisos por rol y el aislamiento de datos por óptica funcionan correctamente.

---

**Documento:** README del Sistema de inventario para óptica  
**Versión del documento:** 1.0 (borrador técnico basado en el ZIP revisado)  
**Fecha de elaboración:** 2026-11-01  
**Nota:** actualizar este documento cuando se incorpore el script SQL y se complete la prueba de instalación en otro equipo.
