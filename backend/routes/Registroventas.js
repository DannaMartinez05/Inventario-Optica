const express = require("express");
const { body, validationResult } = require("express-validator");
const pool = require("../database");
const { permitirRoles } = require("../middleware/authMiddleware");
const { codigoVenta, num } = require("../utils/ventas");
const { columnas, insertar } = require("../utils/esquema");

const router = express.Router();

const CATEGORIAS = ["MONTURA", "LENTE", "FILTRO", "PRODUCTO", "SERVICIO"];

class ErrorVenta extends Error {
  constructor(mensaje, estado = 400, campos = []) {
    super(mensaje);
    this.estado = estado;
    this.campos = campos;
  }
}

const aNumero = (v) => {
  if (v === undefined || v === null || String(v).trim() === "") return null;
  return Number(String(v).trim().replace(",", "."));
};

const CAMPOS_FORMULA = [
  ["odEsfera", "od_esfera", -30, 30, false],
  ["odCilindro", "od_cilindro", -10, 10, false],
  ["odEje", "od_eje", 0, 180, true],
  ["oiEsfera", "oi_esfera", -30, 30, false],
  ["oiCilindro", "oi_cilindro", -10, 10, false],
  ["oiEje", "oi_eje", 0, 180, true],
];

function leerFormula(f = {}) {
  const receta = {};
  const errores = [];

  for (const [campoFront, columna, min, max, entero] of CAMPOS_FORMULA) {
    const n = aNumero(f[campoFront]);

    if (n === null) continue;

    if (
      Number.isNaN(n) ||
      n < min ||
      n > max ||
      (entero && !Number.isInteger(n))
    ) {
      errores.push({
        campo: campoFront,
        mensaje: `Debe ser un número entre ${min} y ${max}.`,
      });
    } else {
      receta[columna] = n;
    }
  }

  const observaciones =
    String(f.observaciones || "").trim().slice(0, 1000) || null;

  return {
    receta,
    observaciones,
    errores,
    hayDatos: Object.keys(receta).length > 0,
  };
}

// Buscar clientes por nombre, cédula o NIT para autocompletar la venta.
router.get("/buscar-clientes", async (req, res, next) => {
  const tenant = req.usuario.tenant_id;
  const busqueda = String(req.query.q || "").trim().slice(0, 100);

  if (busqueda.length < 2) {
    return res.json({ clientes: [] });
  }

  const documento = busqueda.replace(/[^0-9a-z]/gi, "").toUpperCase();

  try {
    const resultado = await pool.query(
      `SELECT
         id_cliente AS id,
         nombre,
         tipo_documento,
         documento AS identificacion,
         telefono,
         direccion,
         correo
       FROM cliente
       WHERE id_tenant = $1
         AND (
           lower(COALESCE(nombre, '')) LIKE lower($2)
           OR (
             $3 <> ''
             AND regexp_replace(
               upper(COALESCE(documento, '')),
               '[^0-9A-Z]', '', 'g'
             ) LIKE '%' || $3 || '%'
           )
         )
       ORDER BY
         CASE
           WHEN lower(nombre) = lower($4) THEN 0
           WHEN $3 <> '' AND regexp_replace(
             upper(COALESCE(documento, '')),
             '[^0-9A-Z]', '', 'g'
           ) = $3 THEN 1
           ELSE 2
         END,
         nombre
       LIMIT 8`,
      [tenant, `%${busqueda}%`, documento, busqueda]
    );

    return res.json({ clientes: resultado.rows });
  } catch (error) {
    next(error);
  }
});

// Buscar cliente por identificación
router.get("/buscar-cliente", async (req, res, next) => {
  const tenant = req.usuario.tenant_id;

  const identificacion = String(req.query.identificacion || "")
    .trim()
    .replace(/[\s.]/g, "")
    .toUpperCase();

  if (!identificacion) {
    return res.status(400).json({
      error: "Ingresa el número de identificación.",
    });
  }

  if (identificacion.length > 30) {
    return res.status(400).json({
      error: "La identificación no puede superar 30 caracteres.",
    });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         id_cliente AS id,
         nombre,
         documento AS identificacion,
         tipo_documento
       FROM cliente
       WHERE id_tenant = $1
         AND regexp_replace(upper(documento), '[[:space:].]', '', 'g') = $2
       LIMIT 1`,
      [tenant, identificacion]
    );

    if (resultado.rowCount === 0) {
      return res.json({
        encontrado: false,
        cliente: null,
      });
    }

    return res.json({
      encontrado: true,
      cliente: resultado.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Buscar producto por código interno, código de barras o referencia
router.get("/buscar-producto", async (req, res, next) => {
  const tenant = req.usuario.tenant_id;
  const codigo = String(req.query.codigo || "").trim();

  if (!codigo) {
    return res.status(400).json({
      error: "Escanea o ingresa un código de producto.",
    });
  }

  if (codigo.length > 100) {
    return res.status(400).json({
      error: "El código no puede superar 100 caracteres.",
    });
  }

  try {
    const resultado = await pool.query(
      `SELECT
         id_producto AS id,
         codigo,
         nombre,
         referencia,
         tipo_producto,
         precio_venta,
         stock
       FROM producto
       WHERE id_tenant = $1
         AND estado = 'ACTIVO'
         AND (
           lower(codigo) = lower($2)
           OR lower(COALESCE(referencia, '')) = lower($2)
         )
       ORDER BY (lower(codigo) = lower($2)) DESC
       LIMIT 1`,
      [tenant, codigo]
    );

    if (!resultado.rowCount) {
      return res.json({
        encontrado: false,
        producto: null,
      });
    }

    return res.json({
      encontrado: true,
      producto: resultado.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Recuperar una factura ya guardada. Esta consulta NO registra ventas ni modifica stock.
router.get("/:id/factura", async (req, res, next) => {
  const tenant = req.usuario.tenant_id;
  const idVenta = Number(req.params.id);

  if (!Number.isInteger(idVenta) || idVenta < 1) {
    return res.status(400).json({ error: "El identificador de la venta no es válido." });
  }

  try {
    const cabecera = await pool.query(
      `SELECT
         v.id_venta,
         to_char(v.fecha, 'YYYY-MM-DD') AS fecha,
         v.modalidad,
         v.total,
         v.valor_pagado,
         v.saldo,
         v.num_cuotas,
         v.observacion,
         v.metodo_pago,
         c.nombre AS cliente_nombre,
         c.tipo_documento AS cliente_tipo_documento,
         c.documento AS cliente_documento,
         c.telefono AS cliente_telefono,
         c.direccion AS cliente_direccion,
         t.nombre AS optica_nombre,
         t.nit AS optica_nit,
         t.correo AS optica_correo,
         t.telefono AS optica_telefono,
         t.direccion AS optica_direccion,
         u.nombre AS vendedor
       FROM venta v
       LEFT JOIN cliente c
         ON c.id_cliente = v.id_cliente AND c.id_tenant = v.id_tenant
       LEFT JOIN tenant t ON t.id_tenant = v.id_tenant
       LEFT JOIN usuario u ON u.id_user = v.id_usuario AND u.id_tenant = v.id_tenant
       WHERE v.id_tenant = $1 AND v.id_venta = $2
       LIMIT 1`,
      [tenant, idVenta]
    );

    if (!cabecera.rowCount) {
      return res.status(404).json({ error: "No se encontró la venta para generar la factura." });
    }

    const [detalles, abonos] = await Promise.all([
      pool.query(
        `SELECT
           vd.id_detalle,
           COALESCE(p.nombre, s.nombre, vd.concepto) AS nombre,
           vd.concepto AS descripcion,
           p.codigo,
           p.referencia,
           vd.cantidad,
           vd.precio_unitario,
           COALESCE(vd.subtotal, vd.cantidad * vd.precio_unitario) AS subtotal
         FROM venta_detalle vd
         LEFT JOIN producto p
           ON p.id_producto = vd.id_producto AND p.id_tenant = vd.id_tenant
         LEFT JOIN servicio s
           ON s.id_servicio = vd.id_servicio AND s.id_tenant = vd.id_tenant
         WHERE vd.id_tenant = $1 AND vd.id_venta = $2
         ORDER BY vd.id_detalle`,
        [tenant, idVenta]
      ),
      pool.query(
        `SELECT fecha, valor, metodo_pago, observacion
         FROM abono
         WHERE id_tenant = $1 AND id_venta = $2
         ORDER BY fecha, id_abono`,
        [tenant, idVenta]
      ),
    ]);

    const v = cabecera.rows[0];
    return res.json({
      factura: {
        ...v,
        codigo: codigoVenta(v.id_venta, v.fecha),
        total: num(v.total),
        valor_pagado: num(v.valor_pagado),
        saldo: num(v.saldo),
        detalles: detalles.rows.map((d) => ({
          ...d,
          cantidad: Number(d.cantidad) || 0,
          precio_unitario: num(d.precio_unitario),
          subtotal: num(d.subtotal),
        })),
        abonos: abonos.rows.map((a) => ({
          ...a,
          valor: num(a.valor),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Registrar venta
router.post(
  "/",
  permitirRoles("admin", "empleado"),
  [
    body("cliente.nombre")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Ingresa el nombre del cliente.")
      .isLength({ max: 150 }),

    body("cliente.identificacion")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 30 }),

    body("cliente.id").optional({ values: "falsy" }).isInt({ min: 1 }).toInt(),

    body("cliente.tipo_documento")
      .optional({ values: "falsy" })
      .isIn(["CC", "CE", "TI", "PA", "NIT"]),

    body("cliente.telefono")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 30 }),

    body("cliente.direccion")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 255 }),

    body("items")
      .isArray({ min: 1, max: 40 })
      .withMessage("Agrega al menos un concepto a la venta."),

    body("items.*.categoria").isIn(CATEGORIAS),

    body("items.*.nombre")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Cada concepto necesita nombre.")
      .isLength({ max: 200 }),

    body("items.*.detalle")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 120 }),

    body("items.*.referencia")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 60 }),

    body("items.*.cantidad")
      .isInt({ min: 1, max: 1000 })
      .withMessage("La cantidad debe ser al menos 1.")
      .toInt(),

    body("items.*.precio")
      .isInt({ min: 1, max: 9999999999 })
      .withMessage("Ingresa un precio mayor a cero.")
      .toInt(),

    body("descuento")
      .optional({ values: "falsy" })
      .isFloat({ min: 0, max: 100 })
      .withMessage("El descuento debe estar entre 0 y 100.")
      .toFloat(),

    body("modalidad").isIn(["CONTADO", "CREDITO"]),

    body("valor_recibido")
      .optional({ values: "falsy" })
      .isInt({ min: 0, max: 9999999999 })
      .toInt(),

    body("metodo_pago")
      .isIn(["EFECTIVO", "TRANSFERENCIA"])
      .withMessage("Selecciona efectivo o transferencia."),

    body("num_cuotas")
      .optional({ values: "falsy" })
      .isInt({ min: 1, max: 60 })
      .toInt(),

    body("observacion_pago")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage("La observación no puede superar 1000 caracteres."),
  ],
  async (req, res, next) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Revisa los datos de la venta.",
        campos: errores.array().map((e) => ({
          campo: e.path,
          mensaje: e.msg,
        })),
      });
    }

    const d = req.body;
    const tenant = req.usuario.tenant_id;
    const formula = leerFormula(d.formula);

    if (formula.errores.length) {
      return res.status(400).json({
        error: "Revisa la fórmula óptica.",
        campos: formula.errores,
      });
    }

    const factor = (100 - (d.descuento || 0)) / 100;
    const lineas = d.items.map((i) => ({
      ...i,
      precioNeto: Math.round(i.precio * factor * 100) / 100,
    }));

    const total =
      lineas.reduce(
        (s, i) => s + Math.round(i.cantidad * i.precioNeto * 100),
        0
      ) / 100;

    const recibido = d.valor_recibido || 0;
    const credito = d.modalidad === "CREDITO";

    if (
      credito &&
      (!Number.isInteger(Number(d.num_cuotas)) ||
        Number(d.num_cuotas) < 1 ||
        Number(d.num_cuotas) > 60)
    ) {
      return res.status(400).json({
        error: "Selecciona un número de cuotas entre 1 y 60.",
        campos: [
          {
            campo: "num_cuotas",
            mensaje: "Número de cuotas inválido.",
          },
        ],
      });
    }

    if (total <= 0) {
      return res.status(400).json({
        error: "El total de la venta debe ser mayor a cero.",
      });
    }

    if (!credito && recibido < Math.floor(total)) {
      return res.status(400).json({
        error:
          "El pago recibido no cubre el total. Completa el pago o selecciona Crédito.",
        campos: [
          {
            campo: "valor_recibido",
            mensaje: "No cubre el total.",
          },
        ],
      });
    }

    if (credito && recibido > Math.ceil(total)) {
      return res.status(400).json({
        error: "El abono no puede ser mayor que el total de la venta.",
        campos: [
          {
            campo: "valor_recibido",
            mensaje: "Supera el total.",
          },
        ],
      });
    }

    const db = await pool.connect();

    try {
      await db.query("BEGIN");

      let idCliente = null;

      // 1) Cliente elegido de la lista: se usa su id.
      if (d.cliente.id) {
        const c = await db.query(
          `SELECT id_cliente
           FROM cliente
           WHERE id_tenant = $1 AND id_cliente = $2`,
          [tenant, d.cliente.id]
        );
        idCliente = c.rows[0]?.id_cliente ?? null;
      }

      // 2) Si no, se busca por documento.
      const documento = d.cliente.identificacion
        ? d.cliente.identificacion.replace(/[\s.]/g, "").toUpperCase()
        : null;

      if (!idCliente && documento) {
        const c = await db.query(
          `SELECT id_cliente
           FROM cliente
           WHERE id_tenant = $1 AND documento = $2
           LIMIT 1`,
          [tenant, documento]
        );
        idCliente = c.rows[0]?.id_cliente ?? null;
      }

      // 3) Si no existe, se crea con todos sus datos.
      if (!idCliente) {
        const c = await db.query(
          `INSERT INTO cliente
             (id_tenant, nombre, tipo_documento, documento, telefono, direccion)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id_cliente`,
          [
            tenant,
            d.cliente.nombre,
            d.cliente.tipo_documento || "CC",
            documento,
            d.cliente.telefono || null,
            d.cliente.direccion || null,
          ]
        );
        idCliente = c.rows[0].id_cliente;
      }

      // Guardar fórmula óptica si se ingresaron datos
      if (formula.hayDatos) {
        await insertar(
          db,
          "receta",
          {
            id_tenant: tenant,
            id_cliente: idCliente,
            id_usuario: req.usuario.id,
            optometrista: req.usuario.nombre,
            observaciones: formula.observaciones,
            ...formula.receta,
          },
          "id_receta"
        );
      }

      // Crear cabecera de venta
      const venta = await insertar(
        db,
        "venta",
        {
          id_tenant: tenant,
          id_usuario: req.usuario.id,
          id_cliente: idCliente,
          modalidad: d.modalidad,
          num_cuotas: credito ? Number(d.num_cuotas || 1) : undefined,
          metodo_pago: d.metodo_pago || "EFECTIVO",
          observacion:
            String(d.observacion_pago || "").trim().slice(0, 1000) || null,
        },
        "id_venta, to_char(fecha, 'YYYY-MM-DD') AS fecha"
      );

      // Verificar si existe la columna referencia en producto
      const tieneReferencia = (await columnas("producto")).todas.has(
        "referencia"
      );

      // Guardar detalle de la venta
      for (const [n, item] of lineas.entries()) {
        let producto = null;
        let servicio = null;

        if (
          item.categoria === "MONTURA" ||
          item.categoria === "PRODUCTO"
        ) {
          const busqueda = item.referencia || item.nombre;

          const p = await db.query(
            `SELECT id_producto, nombre, precio_compra, stock
             FROM producto
             WHERE id_tenant = $1
               AND estado = 'ACTIVO'
               AND (
                 lower(codigo) = lower($2)
                 OR lower(nombre) = lower($2)
                 ${
                   tieneReferencia
                     ? "OR lower(COALESCE(referencia, '')) = lower($2)"
                     : ""
                 }
               )
             ORDER BY (lower(codigo) = lower($2)) DESC
             LIMIT 1
             FOR UPDATE`,
            [tenant, busqueda]
          );

          producto = p.rows[0] || null;

          if (!producto) {
            throw new ErrorVenta(
              `«${busqueda}» no está registrado en el inventario. Regístralo (con su stock) antes de venderlo.`,
              404,
              [
                {
                  campo: `items.${n}.referencia`,
                  mensaje: "No existe en el inventario.",
                },
              ]
            );
          }

          if (producto.stock < item.cantidad) {
            throw new ErrorVenta(
              `Stock insuficiente de «${producto.nombre}»: hay ${producto.stock} y pides ${item.cantidad}.`,
              409,
              [
                {
                  campo: `items.${n}.cantidad`,
                  mensaje: "Supera el stock disponible.",
                },
              ]
            );
          }
        } else {
          // Lentes, filtros y servicios se guardan como servicios
          const nombreServicio = item.nombre.slice(0, 150);

          const s = await db.query(
            `SELECT id_servicio, costo
             FROM servicio
             WHERE id_tenant = $1
               AND lower(nombre) = lower($2)
             LIMIT 1`,
            [tenant, nombreServicio]
          );

          servicio = s.rows[0];

          if (!servicio) {
            const nuevo = await db.query(
              `INSERT INTO servicio (id_tenant, nombre, costo, precio)
               VALUES ($1, $2, 0, $3)
               RETURNING id_servicio, costo`,
              [tenant, nombreServicio, item.precio]
            );

            servicio = nuevo.rows[0];
          }
        }

        const concepto = [item.nombre, item.detalle]
          .filter(Boolean)
          .join(": ");

        await db.query(
          `INSERT INTO venta_detalle
             (id_tenant, id_venta, id_producto, id_servicio, concepto,
              cantidad, costo_unitario, precio_unitario)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            tenant,
            venta.id_venta,
            producto?.id_producto ?? null,
            servicio?.id_servicio ?? null,
            concepto.slice(0, 150),
            item.cantidad,
            num(producto?.precio_compra ?? servicio?.costo),
            item.precioNeto,
          ]
        );
      }

      // Consultar total calculado por la base de datos
      const cab = await db.query(
        `SELECT total
         FROM venta
         WHERE id_tenant = $1 AND id_venta = $2`,
        [tenant, venta.id_venta]
      );

      const totalBD = num(cab.rows[0].total);

      if (credito) {
        // Registrar abono inicial, si lo hay
        const abonoInicial = Math.min(recibido, totalBD);

        if (abonoInicial > 0) {
          await db.query(
            `INSERT INTO abono
               (id_tenant, id_venta, id_usuario, valor, metodo_pago, observacion)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              tenant,
              venta.id_venta,
              req.usuario.id,
              abonoInicial,
              d.metodo_pago || "EFECTIVO",
              String(d.observacion_pago || "").trim().slice(0, 1000) ||
                "Abono inicial",
            ]
          );
        }

        // Crear cuotas mensuales; la última ajusta los centavos
        const n = Number(d.num_cuotas || 1);
        const centavos = Math.round(totalBD * 100);
        const base = Math.floor(centavos / n);

        for (let k = 1; k <= n; k++) {
          const valor =
            (k === n ? centavos - base * (n - 1) : base) / 100;

          await db.query(
            `INSERT INTO cuota
               (id_tenant, id_venta, numero, fecha_vencimiento, valor)
             VALUES (
               $1, $2, $3,
               (CURRENT_DATE + ($3::int * INTERVAL '1 month'))::date,
               $4
             )`,
            [tenant, venta.id_venta, k, valor]
          );
        }
      }

      // Consultar valores finales de la venta
      const final = await db.query(
        `SELECT total, valor_pagado, saldo
         FROM venta
         WHERE id_tenant = $1 AND id_venta = $2`,
        [tenant, venta.id_venta]
      );

      await db.query("COMMIT");

      const v = final.rows[0];

      return res.status(201).json({
        mensaje: "Venta registrada",
        venta: {
          id: venta.id_venta,
          codigo: codigoVenta(venta.id_venta, venta.fecha),
          total: num(v.total),
          pagado: num(v.valor_pagado),
          saldo: num(v.saldo),
          cambio: credito ? 0 : Math.max(0, recibido - num(v.total)),
        },
      });
    } catch (error) {
      await db.query("ROLLBACK").catch(() => {});

      if (error instanceof ErrorVenta) {
        return res.status(error.estado).json({
          error: error.message,
          campos: error.campos,
        });
      }

      if (["23514", "23502", "23503", "23505"].includes(error.code)) {
        console.error(
          "Venta rechazada por la BD:",
          error.message,
          error.detail || "",
          error.constraint || ""
        );

        return res.status(400).json({
          error: `No se pudo guardar la venta: ${error.message}`,
        });
      }

      next(error);
    } finally {
      db.release();
    }
  }
);

module.exports = router;