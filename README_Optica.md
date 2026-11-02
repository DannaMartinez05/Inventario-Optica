# Inventario Óptica

Aplicación web para apoyar la gestión de una óptica. El sistema está desarrollado con React y Vite en el frontend, Node.js y Express en el backend, y PostgreSQL como motor de base de datos.

## Cuentas registradas en la base original

La consulta realizada en la base `optica` identificó estas cuentas activas, ambas asociadas al `id_tenant = 1`:

| Rol | Correo | Estado |
|---|---|---|
| Administrador | `admin@ocadhas.com` | Activo |
| Empleado | `dayen5525@gmail.com` | Activo |

Las contraseñas no se publican en este repositorio. Su funcionamiento debe comprobarse mediante el inicio de sesión.

## Documentación

- **[Instalación y ejecución](README_INSTALACION.md):** requisitos, configuración local, conexión a PostgreSQL, ejecución y acceso de usuarios de prueba.
- **[Arquitectura y ambiente](README_ARQUITECTURA.md):** diagrama de capas y componentes, tecnologías, versiones, dependencias, variables de entorno y estructura de datos.

## Tecnologías principales

| Componente | Tecnología |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Base de datos | PostgreSQL |
| Acceso a datos | `pg` |
| Autenticación | JSON Web Token + bcryptjs |

Las versiones detalladas y dependencias están documentadas en Readme_Arquitectura_optica y en los archivos `package.json` / `package-lock.json`.

## Módulos identificados

Autenticación, inicio, productos, inventario, movimientos, clientes, ventas, crédito, cartera, costos, balance y configuración.

## Estado de despliegue

El sistema **no está desplegado en internet**. Actualmente se ejecuta de forma local en el equipo donde se configura. Las direcciones locales y los pasos para iniciarlo se encuentran en Readme_Instalacion_Optica

## Consideraciones

- La aplicación se conecta a PostgreSQL desde el backend; el frontend no se conecta directamente a la base de datos.
- No publicar archivos `.env`, contraseñas, tokens ni información personal de clientes.
- No ejecutar scripts de prueba o reinicialización sobre la base de datos original.
- Las funcionalidades deben considerarse validadas únicamente después de ejecutar y registrar sus pruebas.
