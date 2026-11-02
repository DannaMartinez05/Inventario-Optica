const express = require("express");
const { query, validationResult } = require("express-validator");
const pool = require("../database");
const { sqlNorm, escaparLike, terminosDe } = require("../utils/busqueda");
const { codigoVenta, num } = require("../utils/ventas");

const router = express.Router();

// Estado de cada crédito:
//   PAGADO     saldo en cero
//   PENDIENTE  tiene alguna cuota vencida sin pagar
//   AL_DIA     debe saldo, pero sin cuotas vencidas
const ESTADOS = ["PENDIENTE", "AL_DIA", "PAGADO"];

// GET /api/privado/cartera?q=laura&estado=PENDIENTE&pagina=1&limite=15
router.get(
  "/",
  [
    query("q").optional().isString().isLength({ max: 100 }),
    query("estado").optional({ values: "falsy" }).isIn(ESTADOS),
    query("pagina").optional().isInt({ min: 1 }).toInt(),
    query("limite").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res, next) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({ error: "Parámetros inválidos." });
    }

    const tenant = req.usuario.tenant_id;
    const pagina = req.query.pagina || 1;
    const limite = req.query.limite || 15;

    const params = [tenant];
    const where = ["TRUE"];
    if (req.query.estado) {
      params.push(req.query.estado);
      where.push(`estado = $${params.length}`);
    }
    for (const t of terminosDe(req.query.q)) {
      params.push(`%${escaparLike(t)}%`);
      where.push(`${sqlNorm("cliente")} LIKE $${params.length}`);
    }
    const condicion = where.join(" AND ");

    const base = `
      WITH cred AS (
        SELECT v.id_venta, v.fecha AS fecha_ts, c.nombre AS cliente,
               v.total, v.valor_pagado, v.saldo,
               (SELECT COUNT(*) FROM v_cuotas q
                 WHERE q.id_tenant = v.id_tenant AND q.id_venta = v.id_venta AND NOT q.pagada)::int AS cuotas,
               (SELECT to_char(MIN(q.fecha_vencimiento), 'YYYY-MM-DD') FROM v_cuotas q
                 WHERE q.id_tenant = v.id_tenant AND q.id_venta = v.id_venta AND NOT q.pagada) AS proximo_pago,
               EXISTS (SELECT 1 FROM v_cuotas q
                 WHERE q.id_tenant = v.id_tenant AND q.id_venta = v.id_venta AND q.vencida) AS en_mora
        FROM venta v
        JOIN cliente c ON c.id_tenant = v.id_tenant AND c.id_cliente = v.id_cliente
        WHERE v.id_tenant = $1 AND v.modalidad = 'CREDITO'
      ),
      t AS (
        SELECT cred.*,
               CASE WHEN saldo = 0 THEN 'PAGADO' WHEN en_mora THEN 'PENDIENTE' ELSE 'AL_DIA' END AS estado
        FROM cred
      )`;

    try {
      const [kpis, pagos, lista, conteo] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(total), 0) AS total_cartera,
                  COALESCE(SUM(saldo), 0) AS saldo_pendiente,
                  COUNT(DISTINCT id_cliente) FILTER (WHERE saldo > 0)::int AS clientes_activos
           FROM venta WHERE id_tenant = $1 AND modalidad = 'CREDITO'`,
          [tenant]
        ),
        pool.query(
          `SELECT COALESCE(SUM(valor), 0) AS pagos_mes
           FROM abono
           WHERE id_tenant = $1 AND date_trunc('month', fecha) = date_trunc('month', now())`,
          [tenant]
        ),
        pool.query(
          `${base}
           SELECT id_venta, to_char(fecha_ts, 'YYYY-MM-DD') AS fecha, cliente, total, valor_pagado,
                  saldo, cuotas, proximo_pago, estado
           FROM t WHERE ${condicion}
           ORDER BY CASE estado WHEN 'PENDIENTE' THEN 0 WHEN 'AL_DIA' THEN 1 ELSE 2 END,
                    fecha_ts DESC, id_venta DESC
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limite, (pagina - 1) * limite]
        ),
        pool.query(`${base} SELECT COUNT(*)::int AS total FROM t WHERE ${condicion}`, params),
      ]);

      const k = kpis.rows[0];
      const total = conteo.rows[0].total;

      res.json({
        kpis: {
          totalCartera: num(k.total_cartera),
          clientesActivos: k.clientes_activos,
          pagosMes: num(pagos.rows[0].pagos_mes),
          saldoPendiente: num(k.saldo_pendiente),
        },
        creditos: lista.rows.map((f) => ({
          idVenta: f.id_venta,
          venta: codigoVenta(f.id_venta, f.fecha),
          cliente: f.cliente,
          fecha: f.fecha,
          total: num(f.total),
          pagado: num(f.valor_pagado),
          saldo: num(f.saldo),
          cuotas: f.cuotas,
          proximoPago: f.proximo_pago,
          estado: f.estado,
        })),
        paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;