export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const MESES_CORTOS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const pesos = (n) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);

export const millones = (n) =>
  Math.abs(n) >= 1_000_000 ? `$ ${(n / 1_000_000).toFixed(2)}M` : pesos(n);

export const entero = (n) => new Intl.NumberFormat("es-CO").format(n || 0);

export function iniciales(nombre = "") {
  return (
    nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"
  );
}
/* ---------- Fechas (llegan del servidor como "AAAA-MM-DD") ---------- */

const MES_MIN = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const partes = (texto) => texto.split("-").map(Number);

// 12 ago 2026
export function fechaCorta(texto) {
  if (!texto) return "—";
  const [a, m, d] = partes(texto);
  return `${d} ${MES_MIN[m - 1]} ${a}`;
}

// 28 agosto 2026
export function fechaLarga(texto) {
  if (!texto) return "—";
  const [a, m, d] = partes(texto);
  return `${d} ${MESES[m - 1].toLowerCase()} ${a}`;
}

// febrero de 2023
export function mesYAnio(texto) {
  if (!texto) return "";
  const [a, m] = partes(texto);
  return `${MESES[m - 1].toLowerCase()} de ${a}`;
}

export function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// CC 1.020.481.234
export function documentoFormateado(tipo, documento) {
  if (!documento) return "—";
  const f = /^\d+$/.test(documento) ? documento.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : documento;
  return `${tipo || "CC"} ${f}`;
}

// +1.50 / -2.25
export const signado = (n) =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}`;