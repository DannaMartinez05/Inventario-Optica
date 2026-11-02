const express = require("express");
const { query, validationResult } = require("express-validator");
const pool = require("../database");

const router = express.Router();
const num = (v) => Number(v) || 0;

// GET /api/privado/balance?mes=2026-10
router.get(
  "/",
  [query("mes").optional().matches(/^\d{4}-(0[1-9]|1[0-2])$/)],
  async (req, res, next) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: "El mes debe tener el formato AAAA-MM." });
    }

    const hoy = new Date();
    const mes =
      req.query.mes ||
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    const inicioMes = `${mes}-01`;
    const tenant = req.usuario.tenant_id;

    try {
      const [balance, ventas, items, tendencia] = await Promise.all([
        pool.query(
          `SELECT ventas_total, ganancia_bruta, gastos_total, dinero_recibido,
                  saldo_pendiente, ganancia_neta
           FROM v_balance_mensual
           WHERE id_tenant = $1 AND mes = $2::date`,
          [tenant, inicioMes]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS num_ventas,
                  COALESCE(SUM(total) FILTER (WHERE modalidad = 'CONTADO'), 0) AS contado,
                  COALESCE(SUM(total) FILTER (WHERE modalidad = 'CREDITO'), 0) AS credito,
                  COALESCE(MAX(total), 0) AS mayor_venta,
                  COUNT(DISTINCT id_cliente)::int AS clientes
           FROM venta
           WHERE id_tenant = $1 AND date_trunc('month', fecha)::date = $2::date`,
          [tenant, inicioMes]
        ),
        pool.query(
          `SELECT COALESCE(SUM(d.cantidad) FILTER (WHERE d.id_producto IS NOT NULL), 0)::int AS productos,
                  COALESCE(SUM(d.cantidad * d.costo_unitario), 0) AS costo
           FROM venta_detalle d
           JOIN venta v ON v.id_tenant = d.id_tenant AND v.id_venta = d.id_venta
           WHERE v.id_tenant = $1 AND date_trunc('month', v.fecha)::date = $2::date`,
          [tenant, inicioMes]
        ),
        pool.query(
          `SELECT EXTRACT(MONTH FROM m.mes)::int AS mes_num,
                  COALESCE(b.ventas_total, 0) AS ventas,
                  COALESCE(b.ganancia_bruta, 0) AS ganancias,
                  COALESCE(b.ganancia_neta, 0) AS neta
           FROM generate_series(($2::date - INTERVAL '5 months')::timestamp, $2::date::timestamp, INTERVAL '1 month') AS m(mes)
           LEFT JOIN v_balance_mensual b ON b.id_tenant = $1 AND b.mes = m.mes::date
           ORDER BY m.mes`,
          [tenant, inicioMes]
        ),
      ]);

      const b = balance.rows[0] || {};
      const v = ventas.rows[0];
      const i = items.rows[0];

      const ventasTotal = num(b.ventas_total);
      const ganancias = num(b.ganancia_bruta);
      const gastos = num(b.gastos_total);
      const neta = num(b.ganancia_neta);
      const costo = num(i.costo);

      const serie = tendencia.rows.map((f) => ({
        mes: f.mes_num,
        ventas: num(f.ventas),
        ganancias: num(f.ganancias),
      }));

      const netaAnterior = num(tendencia.rows[tendencia.rows.length - 2]?.neta);
      const variacion =
        netaAnterior === 0 ? null : Math.round(((neta - netaAnterior) / Math.abs(netaAnterior)) * 100);

      res.json({
        mes,
        hayDatos: v.num_ventas > 0 || gastos > 0 || num(b.dinero_recibido) > 0,
        ventas: ventasTotal,
        ganancias,
        productos: i.productos,
        recibido: num(b.dinero_recibido),
        pendiente: num(b.saldo_pendiente),
        gastos,
        contado: num(v.contado),
        credito: num(v.credito),
        mayorVenta: num(v.mayor_venta),
        clientes: v.clientes,
        ticketPromedio: v.num_ventas > 0 ? Math.round(ventasTotal / v.num_ventas) : 0,
        costoMercancia: costo,
        margen: costo > 0 ? Math.round((ganancias / costo) * 100) : 0,
        gananciaNeta: neta,
        variacion,
        tendencia: serie,
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;