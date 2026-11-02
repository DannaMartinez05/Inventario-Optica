const express = require("express");
const { query, validationResult } = require("express-validator");
const pool = require("../database");
const { num } = require("../utils/ventas");

const router = express.Router();

// GET /api/privado/costos?mes=2026-10
// Rentabilidad real: usa el costo y el precio a los que se vendió cada producto o servicio en el mes.
router.get(
  "/",
  [query("mes").optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/)],
  async (req, res, next) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: "El mes debe tener el formato AAAA-MM." });
    }

    const hoy = new Date();
    const mes =
      req.query.mes || `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

    try {
      const r = await pool.query(
        `SELECT MAX(d.concepto) AS nombre,
                CASE WHEN d.id_producto IS NOT NULL THEN 'PRODUCTO' ELSE 'SERVICIO' END AS origen,
                SUM(d.cantidad)::int AS unidades,
                SUM(d.cantidad * d.costo_unitario) AS costo_total,
                SUM(d.subtotal) AS venta_total
         FROM venta_detalle d
         JOIN venta v ON v.id_tenant = d.id_tenant AND v.id_venta = d.id_venta
         WHERE v.id_tenant = $1 AND date_trunc('month', v.fecha)::date = $2::date
         GROUP BY d.id_producto, d.id_servicio
         ORDER BY SUM(d.subtotal) - SUM(d.cantidad * d.costo_unitario) DESC, MAX(d.concepto)`,
        [req.usuario.tenant_id, `${mes}-01`]
      );

      const filas = r.rows.map((f) => {
        const costo = Math.round(num(f.costo_total) / f.unidades);
        const precio = Math.round(num(f.venta_total) / f.unidades);
        const ganancia = precio - costo;
        return {
          nombre: f.nombre,
          origen: f.origen,
          unidades: f.unidades,
          costo,
          precio,
          ganancia,
          margen: costo > 0 ? Math.round((ganancia / costo) * 100) : null,
        };
      });

      const ventas = r.rows.reduce((s, f) => s + num(f.venta_total), 0);
      const costos = r.rows.reduce((s, f) => s + num(f.costo_total), 0);
      const mayor = (campo) =>
        filas.reduce((m, f) => (f[campo] !== null && (!m || f[campo] > m[campo]) ? f : m), null);
      const destacado = (f, campo) => (f ? { nombre: f.nombre, valor: f[campo] } : null);

      res.json({
        mes,
        kpis: {
          ventas,
          costos,
          ganancia: ventas - costos,
          margen: costos > 0 ? Math.round(((ventas - costos) / costos) * 100) : 0,
        },
        filas,
        destacados: {
          mayorGanancia: destacado(mayor("ganancia"), "ganancia"),
          mejorMargen: destacado(mayor("margen"), "margen"),
          masVendido: destacado(mayor("unidades"), "unidades"),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;