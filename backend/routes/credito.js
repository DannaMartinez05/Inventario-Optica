const express = require("express");
const { body, param, validationResult } = require("express-validator");
const pool = require("../database");
const { permitirRoles } = require("../middleware/authMiddleware");
const { codigoVenta, num } = require("../utils/ventas");

const router = express.Router();

// GET /api/privado/credito/pendientes
// Clientes con ventas a crédito que todavía deben saldo (para elegir a quién cobrar).
router.get("/pendientes", async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT v.id_venta AS id, v.id_cliente, c.nombre, c.tipo_documento, c.documento,
              to_char(v.fecha, 'YYYY-MM-DD') AS fecha, v.total, v.valor_pagado, v.saldo
       FROM venta v
       JOIN cliente c ON c.id_tenant = v.id_tenant AND c.id_cliente = v.id_cliente
       WHERE v.id_tenant = $1 AND v.modalidad = 'CREDITO' AND v.saldo > 0
       ORDER BY c.nombre, v.fecha DESC, v.id_venta DESC`,
      [req.usuario.tenant_id]
    );

    const clientes = new Map();
    for (const f of r.rows) {
      if (!clientes.has(f.id_cliente)) {
        clientes.set(f.id_cliente, {
          id: f.id_cliente,
          nombre: f.nombre,
          documento: f.documento ? `${f.tipo_documento} ${f.documento}` : null,
          ventas: [],
        });
      }
      clientes.get(f.id_cliente).ventas.push({
        id: f.id,
        codigo: codigoVenta(f.id, f.fecha),
        fecha: f.fecha,
        total: num(f.total),
        pagado: num(f.valor_pagado),
        saldo: num(f.saldo),
      });
    }

    res.json({ clientes: [...clientes.values()] });
  } catch (error) {
    next(error);
  }
});

// GET /api/privado/credito/ventas/:id  -> ficha del crédito
router.get("/ventas/:id", [param("id").isInt({ min: 1 }).toInt()], async (req, res, next) => {
  if (!validationResult(req).isEmpty()) return res.status(400).json({ error: "Venta inválida." });
  const tenant = req.usuario.tenant_id;

  try {
    const [venta, cuotas] = await Promise.all([
      pool.query(
        `SELECT v.id_venta AS id, c.nombre, c.tipo_documento, c.documento,
                to_char(v.fecha, 'YYYY-MM-DD') AS fecha, v.total, v.valor_pagado, v.saldo, v.num_cuotas
         FROM venta v
         JOIN cliente c ON c.id_tenant = v.id_tenant AND c.id_cliente = v.id_cliente
         WHERE v.id_tenant = $1 AND v.id_venta = $2 AND v.modalidad = 'CREDITO'`,
        [tenant, req.params.id]
      ),
      pool.query(
        `SELECT numero, to_char(fecha_vencimiento, 'YYYY-MM-DD') AS vence, valor, pagada
         FROM v_cuotas WHERE id_tenant = $1 AND id_venta = $2 ORDER BY numero`,
        [tenant, req.params.id]
      ),
    ]);

    if (!venta.rowCount) return res.status(404).json({ error: "Venta a crédito no encontrada." });

    const v = venta.rows[0];
    const total = num(v.total);
    const pagado = num(v.valor_pagado);
    const saldo = num(v.saldo);
    const plan = cuotas.rows;
    const pendientes = plan.filter((q) => !q.pagada);
    const numCuotas = v.num_cuotas || plan.length || null;
    const valorCuota = plan.length ? num(plan[0].valor) : numCuotas ? Math.round(total / numCuotas) : null;

    res.json({
      id: v.id,
      codigo: codigoVenta(v.id, v.fecha),
      cliente: v.nombre,
      documento: v.documento ? `${v.tipo_documento} ${v.documento}` : null,
      fecha: v.fecha,
      total,
      pagado,
      saldo,
      porcentajePagado: total > 0 ? Math.round((pagado / total) * 100) : 0,
      numCuotas,
      valorCuota,
      proximoPago: pendientes[0]?.vence ?? null,
      cuotasRestantes: plan.length ? pendientes.length : valorCuota ? Math.ceil(saldo / valorCuota) : 0,
      venceUltima: plan.length ? plan[plan.length - 1].vence : null,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/privado/credito/abonos
router.post(
  "/abonos",
  permitirRoles("admin", "empleado"),
  [
    body("id_venta").isInt({ min: 1 }).toInt(),
    body("valor").isFloat({ gt: 0, max: 9_999_999_999 }).withMessage("Ingresa un valor mayor a cero.").toFloat(),
    body("fecha")
      .optional({ values: "falsy" })
      .isISO8601({ strict: true, strictSeparator: true })
      .custom((v) => v <= new Date().toISOString().slice(0, 10))
      .withMessage("La fecha del abono no puede ser futura."),
    body("metodo_pago").isIn(["EFECTIVO", "TRANSFERENCIA", "TARJETA", "OTRO"]),
    body("observacion").optional({ values: "falsy" }).isString().trim().isLength({ max: 300 }),
  ],
  async (req, res, next) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Revisa los datos del abono.",
        campos: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
      });
    }

    const d = req.body;
    const tenant = req.usuario.tenant_id;

    try {
      const venta = await pool.query(
        "SELECT modalidad, saldo FROM venta WHERE id_tenant = $1 AND id_venta = $2",
        [tenant, d.id_venta]
      );
      if (!venta.rowCount) return res.status(404).json({ error: "La venta no existe." });
      if (venta.rows[0].modalidad !== "CREDITO") {
        return res.status(400).json({ error: "Solo se pueden registrar abonos en ventas a crédito." });
      }
      if (d.valor > num(venta.rows[0].saldo)) {
        return res.status(400).json({
          error: "El abono supera el saldo pendiente.",
          campos: [{ campo: "valor", mensaje: "El abono supera el saldo pendiente." }],
        });
      }

      const abono = await pool.query(
        `INSERT INTO abono (id_tenant, id_venta, id_usuario, fecha, valor, metodo_pago, observacion)
         VALUES ($1, $2, $3,
                 CASE WHEN $4::date IS NULL OR $4::date = CURRENT_DATE THEN NOW() ELSE $4::date END,
                 $5, $6, $7)
         RETURNING id_abono AS id`,
        [tenant, d.id_venta, req.usuario.id, d.fecha || null, d.valor, d.metodo_pago, d.observacion || null]
      );

      const nuevo = await pool.query(
        "SELECT saldo FROM venta WHERE id_tenant = $1 AND id_venta = $2",
        [tenant, d.id_venta]
      );

      res.status(201).json({
        mensaje: "Abono registrado",
        abono: abono.rows[0],
        saldo: num(nuevo.rows[0].saldo),
      });
    } catch (error) {
      // El trigger de la base de datos también protege el saldo.
      if (error.code === "23514") return res.status(400).json({ error: error.message });
      next(error);
    }
  }
);

module.exports = router;
