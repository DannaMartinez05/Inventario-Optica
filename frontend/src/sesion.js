// Utilidades de sesión: leer, guardar y cerrar la sesión del usuario.
// El Login guarda el token en localStorage (si marcó "Recordarme") o en sessionStorage.

export const API = "http://localhost:3000/api";

export function leerSesion() {
  const almacen = localStorage.getItem("token")
    ? localStorage
    : sessionStorage.getItem("token")
      ? sessionStorage
      : null;

  if (!almacen) return null;

  let usuario = null;
  try {
    usuario = JSON.parse(almacen.getItem("usuario") || "null");
  } catch {
    usuario = null;
  }

  return { token: almacen.getItem("token"), usuario };
}

export function cerrarSesion() {
  for (const almacen of [localStorage, sessionStorage]) {
    almacen.removeItem("token");
    almacen.removeItem("usuario");
  }
}
