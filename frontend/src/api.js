import { API } from "./sesion";

export class ErrorApi extends Error {
  constructor(mensaje, { estado = 0, campos = [] } = {}) {
    super(mensaje);
    this.estado = estado;
    this.campos = campos;
  }
}

export async function pedir(ruta, { token, metodo = "GET", cuerpo, signal } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${API}${ruta}`, {
      method: metodo,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(cuerpo ? { "Content-Type": "application/json" } : {}),
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ErrorApi("No se pudo conectar con el servidor.");
  }

  const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
    const mensaje = datos.detalle
      ? `${datos.error}: ${datos.detalle}`
      : datos.error || "Ocurrió un error inesperado.";
    throw new ErrorApi(mensaje, {
      estado: respuesta.status,
      campos: datos.campos || [],
    });
  }
  return datos;
}