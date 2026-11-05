# Instalación y ejecución — Inventario Óptica

Esta guía explica cómo preparar, configurar e iniciar el sistema Inventario Óptica en un equipo de desarrollo. Está dirigida tanto al equipo responsable del proyecto como a los equipos que realizarán el testing cruzado.

## 1. Requisitos previos

Para instalar y ejecutar el proyecto se necesitan los siguientes programas:

| Programa | Versión |
|---|---|
| Node.js | 22.19.0 |
| npm | Incluido con Node.js |
| PostgreSQL | 17.11 |
| Navegador | Chrome, Edge, Firefox u otro navegador moderno |
| Visual Studio Code | Opcional |
| pgAdmin 4 o psql | Opcional |

Las versiones de Node.js y PostgreSQL corresponden al entorno de desarrollo del proyecto.

Comprobar las versiones desde PowerShell:

```powershell
node -v
npm -v
psql --version
```

## 2. Ubicación del proyecto y del script SQL

El repositorio contiene el frontend, el backend, la documentación y el script SQL necesario para preparar la base de datos.

La estructura principal es:

```text
Inventario Optica React/
│
├── backend/
│   ├── .env.example
│   ├── crearAdmin.js
│   ├── database.js
│   ├── server.js
│   └── ...
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
│
├── crear_bd.sql
├── README_Optica.md
├── README_Instalacion_Optica.md
└── README_Arquitectura_Optica.md
```

**Importante:** el archivo `crear_bd.sql` se encuentra en la raíz del repositorio, no dentro de las carpetas `backend` o `frontend`.

Este archivo contiene el script SQL del proyecto y debe revisarse y ejecutarse en una base de datos nueva e independiente cuando se realice una instalación desde cero.

## 3. Preparar PostgreSQL y la base de datos

### 3.1. Crear una base de datos de pruebas

Para realizar una instalación en otro equipo o desarrollar el testing cruzado, se recomienda crear una base de datos independiente.

Por ejemplo, desde `psql`:

```sql
CREATE DATABASE inventario_optica;
```

También puede crearse desde pgAdmin 4.

### 3.2. Ejecutar el script SQL

El archivo que debe utilizarse es:

```text
crear_bd.sql
```

Se encuentra en la raíz del repositorio.

Desde PowerShell, ubicado en la raíz del proyecto, se puede ejecutar:

```powershell
psql -U postgres -d inventario_optica -f .\crear_bd.sql
```

Reemplazar `postgres` por el usuario correspondiente de PostgreSQL si es diferente.

Si se utiliza pgAdmin 4, abrir la base de datos de pruebas, ingresar al Query Tool, abrir el archivo `crear_bd.sql` y ejecutar el contenido.

Después de la ejecución, comprobar que se hayan creado las tablas y relaciones necesarias.

**Precauciones:**

- No ejecutar el script sobre la base original de la óptica.
- No utilizar datos reales de clientes para las pruebas.
- No ejecutar scripts de reinicialización sobre bases que contengan información importante.
- Si el script presenta errores, detener la instalación y revisar el mensaje antes de continuar.

La instalación desde cero debe validarse en una base independiente antes de considerar reproducible el procedimiento.

## 4. Configurar las variables de entorno del backend

El repositorio incluye el archivo:

```text
backend/.env.example
```

Este archivo es una plantilla con las variables necesarias para configurar la conexión con PostgreSQL y el funcionamiento del backend.

Para preparar el entorno local:

1. Abrir la carpeta `backend`.
2. Copiar el archivo `.env.example`.
3. Renombrar la copia como `.env`.
4. Modificar los valores según la configuración local.

Ejemplo:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173

DB_HOST=localhost
DB_PORT=5432
DB_NAME=inventario_optica
DB_USER=postgres
DB_PASSWORD=TU_CONTRASENA_LOCAL

JWT_SECRET=TU_SECRETO_ALEATORIO_DE_AL_MENOS_32_CARACTERES
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto del backend. Por defecto, 3000. |
| `FRONTEND_URL` | Dirección del frontend permitida por CORS. |
| `DB_HOST` | Dirección del servidor PostgreSQL. |
| `DB_PORT` | Puerto de PostgreSQL. Normalmente 5432. |
| `DB_NAME` | Nombre de la base de datos que utilizará el sistema. |
| `DB_USER` | Usuario de PostgreSQL. |
| `DB_PASSWORD` | Contraseña del usuario de PostgreSQL. |
| `JWT_SECRET` | Clave privada para firmar los tokens JWT. Debe tener al menos 32 caracteres. |

Cada equipo debe configurar su propio archivo `.env`.

**Importante:** no subir el archivo `.env` real a GitHub. El repositorio debe conservar únicamente `.env.example`, sin contraseñas ni secretos personales.

## 5. Instalar las dependencias del backend

Abrir una terminal de PowerShell en la raíz del proyecto y ejecutar:

```powershell
cd backend
npm ci
```

Este comando instala las dependencias registradas en `backend/package-lock.json`.

## 6. Instalar las dependencias del frontend

Abrir una segunda terminal desde la raíz del proyecto y ejecutar:

```powershell
cd frontend
npm ci
```

Este comando instala las dependencias registradas en `frontend/package-lock.json`.

## 7. Crear una nueva óptica y su administrador

El proyecto permite registrar varias ópticas dentro de una misma base de datos mediante un sistema multi-tenant. Cada óptica tiene sus propios usuarios y su información se mantiene separada de las demás.

Para registrar una nueva óptica y crear su administrador, seguir estos pasos:

### Paso 1. Conectarse a PostgreSQL

Abrir PowerShell y ejecutar el siguiente comando:

```powershell
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d optica
```
Ingresar la contraseña del usuario de PostgreSQL cuando sea solicitada.

**Nota:** reemplazar `optica` por el nombre de la base de datos configurada en `backend/.env`.  si PostgreSQL está instalado en otra ubicación o versión, ajustar la ruta de `psql.exe`.

### Paso 2. Registrar la nueva óptica

Una vez conectado a la base de datos, ejecutar la siguiente consulta SQL:

```sql
INSERT INTO tenant (
    nombre,
    nit,
    correo,
    telefono,
    direccion,
    estado,
    moneda
)
VALUES (
    'Óptica de prueba',
    '900123456-1',
    'optica@correo.com',
    '3001234567',
    'Dirección de la óptica',
    'activa',
    'COP'
)
RETURNING id_tenant, nombre;
```

Reemplazar los datos de ejemplo por la información de la óptica que se desea registrar.

Al ejecutar la consulta, PostgreSQL devolverá el identificador (`id_tenant`) y el nombre de la óptica.

**Importante:** guardar el valor de `id_tenant`, porque será necesario para crear el administrador.

Para salir de PostgreSQL, ejecutar:

```sql
\q
```

### Paso 3. Crear el administrador

Abrir una terminal de PowerShell y ubicarse en la carpeta `backend` del proyecto:

```powershell
cd "C:\Users\USER\Desktop\Inventario Optica React\backend"
```
Importante: cambia la ruta de ejemplo de PowerShell si tienes el proyecto instalado en otra ubicación.

Ejecutar el siguiente comando:

```powershell
node crearAdmin.js
```

El programa solicitará los siguientes datos:

1. Nombre del administrador.
2. Correo electrónico.
3. Contraseña (mínimo 12 caracteres y máximo 72).
4. ID de la óptica (`tenant`).

Ingresar el `id_tenant` obtenido en el paso anterior.

El script verificará que la óptica exista y esté activa, comprobará que el correo no esté registrado y creará el usuario con el rol `admin`.

Si el proceso finaliza correctamente, aparecerá el mensaje:

```text
Administrador creado correctamente
```

### Paso 4. Iniciar sesión

Una vez creado el administrador:

1. Iniciar el backend.
2. Iniciar el frontend.
3. Abrir el sistema desde el navegador.
4. Ingresar con el correo y la contraseña del administrador creado.

El sistema identificará automáticamente la óptica a la que pertenece el administrador mediante su usuario.

### Paso 5. Crear empleados

Para registrar empleados dentro de la nueva óptica:

1. Iniciar sesión con el administrador.
2. Ingresar al módulo **Configuración**.
3. Seleccionar **Usuarios y permisos**.
4. Utilizar la opción para crear un empleado.
5. Completar los datos solicitados.

Los empleados quedarán asociados automáticamente a la óptica del administrador que inició sesión.

### Consideraciones importantes

- No es necesario crear una base de datos independiente para cada óptica.
- Cada óptica nueva debe registrarse en la tabla `tenant`.
- No es necesario volver a ejecutar el archivo de creación de tablas para registrar otra óptica.
- Cada administrador debe estar asociado al `id_tenant` correspondiente.
- Los empleados se asocian automáticamente al tenant del administrador.
- La información de cada óptica se mantiene separada mediante el identificador del tenant.
- El correo electrónico de cada usuario debe ser único en todo el sistema.
- Antes de ejecutar `crearAdmin.js`, verificar que el backend esté conectado a la base de datos correcta mediante el archivo `.env`.
- El archivo `crearAdmin.js` crea administradores, pero no registra ópticas. Por eso, primero se debe completar el registro de la óptica en PostgreSQL.

## 8. Iniciar la aplicación

Para ejecutar el sistema se necesitan dos terminales abiertas.

### Terminal 1: iniciar el backend

Desde la raíz del proyecto:

```powershell
cd backend
npm run dev
```

El backend utiliza normalmente:

```text
http://localhost:3000
```

También puede iniciarse sin Nodemon mediante:

```powershell
npm start
```

### Terminal 2: iniciar el frontend

Desde la raíz del proyecto:

```powershell
cd frontend
npm run dev
```

Vite utiliza normalmente:

```text
http://localhost:5173
```

Abrir esa dirección en el navegador para acceder al sistema.

## 9. Verificar el funcionamiento

Una vez iniciados los servicios, realizar las siguientes comprobaciones:

| Comprobación | Resultado esperado |
|---|---|
| Backend | El servidor inicia sin errores. |
| API | `http://localhost:3000/api/health` responde con estado correcto. |
| Base de datos | El backend puede conectarse a PostgreSQL. |
| Frontend | Se muestra la pantalla de inicio de sesión. |
| Administrador | Puede iniciar sesión con la cuenta de pruebas creada. |
| Permisos | El administrador puede acceder a las funciones autorizadas. |

La ruta de verificación de conexión a la base de datos es:

```text
GET /api/health/db
```

Esta ruta requiere un token válido.

También se recomienda probar el acceso con un usuario de rol empleado y comprobar que los permisos correspondan a su perfil.

## 10. Comandos útiles

| Carpeta | Comando | Función |
|---|---|---|
| `backend/` | `npm ci` | Instalar dependencias. |
| `backend/` | `npm run dev` | Iniciar backend en desarrollo. |
| `backend/` | `npm start` | Iniciar backend. |
| `backend/` | `node crearAdmin.js` | Crear administrador de pruebas. |
| `frontend/` | `npm ci` | Instalar dependencias. |
| `frontend/` | `npm run dev` | Iniciar frontend. |
| `frontend/` | `npm run build` | Generar compilación de producción. |
| `frontend/` | `npm run preview` | Previsualizar compilación. |
| `frontend/` | `npm run lint` | Ejecutar ESLint. |

## 11. Problemas frecuentes

**Error de conexión con PostgreSQL**

- Verificar que el servicio PostgreSQL esté iniciado.
- Revisar `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.
- Comprobar que la base de datos exista.

**Error de JWT**

- Revisar que `JWT_SECRET` esté configurado.
- Verificar que tenga al menos 32 caracteres.

**Error de CORS**

- Comprobar que `FRONTEND_URL` coincida con la dirección del frontend.

**Error de tabla o columna inexistente**

- Verificar que se haya ejecutado correctamente `crear_bd.sql`.
- Comprobar que el backend esté conectado a la base de datos correcta.

**Error al iniciar sesión**

- Comprobar que el usuario exista y esté activo.
- Verificar que pertenezca al tenant correspondiente.
- Confirmar que el correo y la contraseña sean correctos.

**Puerto ocupado**

- Comprobar si otro proceso está utilizando el puerto.
- Si se modifica el puerto, actualizar la configuración correspondiente.

## 12. Estado de despliegue

El sistema se ejecuta actualmente en un entorno local de desarrollo. No cuenta con una URL pública de producción.

Direcciones habituales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

Las direcciones `localhost` corresponden al equipo donde se ejecutan los servicios. Para acceder desde otro equipo se necesita una configuración de red y permisos adecuada.

## 13. Consideraciones para el testing cruzado

El otro equipo debe realizar la instalación utilizando el repositorio y sus propios datos de prueba.

Se recomienda verificar los siguientes puntos:

1. Descargar o clonar el repositorio.
2. Instalar Node.js y PostgreSQL en las versiones indicadas.
3. Crear una base de datos de pruebas independiente.
4. Ejecutar `crear_bd.sql`, ubicado en la raíz del repositorio.
5. Configurar `backend/.env` a partir de `backend/.env.example`.
6. Instalar las dependencias del backend y frontend.
7. Crear un administrador de pruebas.
8. Iniciar ambos servicios.
9. Comprobar el inicio de sesión.
10. Probar los módulos y permisos del sistema.

Los resultados del testing deben registrar los casos ejecutados, los resultados obtenidos y los errores encontrados.

La instalación se considera reproducible cuando otro equipo puede preparar su propio entorno, iniciar el sistema e ingresar con sus cuentas de prueba sin depender de la base de datos original de la óptica.
