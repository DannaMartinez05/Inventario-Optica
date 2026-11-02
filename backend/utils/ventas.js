
 // Código visible de una venta: VTA-2026-0332

const codigoVenta = (id, fecha) =>
  `VTA-${String(fecha).slice(0, 4)}-${String(id).padStart(4, "0")}`;

const num = (v) => Number(v) || 0;

const numONull = (v) =>
  v === null || v === undefined ? null : Number(v);

module.exports = {
  codigoVenta,
  num,
  numONull,
};
