const express = require("express");
const { body, param, query, validationResult } = require("express-validator");
const pool = require("../database");
const { permitirRoles } = require("../middleware/authMiddleware");
const { sqlNorm, escaparLike, terminosDe } = require("../utils/busqueda");
const { numONull } = require("../utils/ventas");

const router = express.Router();

const hoy = () => new Date().toISOString().slice(0, 10);

function hayErrores(req, res) {
  const errores = validationResult(req);
  if (errores.isEmpty()) return false;
  res.status(400).json({
    error: "Revisa los campos del formulario.",
    campos: errores.array().map((e) => ({ campo: e.path, mensaje: e.msg })),
  });
  return true;
}

const COLUMNAS_CLIENTE = `c.id_cliente AS id, c.nombre, c.tipo_documento, c.documento, c.telefono,
  c.correo, to_char(c.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento, c.direccion,
  c.ocupacion, to_char(c.fecha_registro, 'YYYY-MM-DD') AS fecha_registro`;

// GET /api/privado/clientes?q=laura&pagina=1&limite=10
router.get(
  "/",
  [
    query("q").optional().isString().isLength({ max: 100 }),
    query("pagina").optional().isInt({ min: 1 }).toInt(),
    query("limite").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res, next) => {
    if (hayErrores(req, res)) return;

    const tenant = req.usuario.tenant_id;
    const pagina = req.query.pagina || 1;
    const limite = req.query.limite || 10;
    const params = [tenant];
    const where = ["c.id_tenant = $1"];

    // Cada palabra debe aparecer en el nombre, correo, documento o teléfono.
    for (const t of terminosDe(req.query.q)) {
      params.push(`%${escaparLike(t)}%`);
      const a = `$${params.length}`;
      const condiciones = [
        `${sqlNorm("c.nombre")} LIKE ${a}`,
        `${sqlNorm("COALESCE(c.correo, '')")} LIKE ${a}`,
      ];
      const alfanumerico = t.replace(/[^a-z0-9]/g, "");
      if (alfanumerico) {
        params.push(`%${alfanumerico}%`);
        const b = `$${params.length}`;
        condiciones.push(
          `lower(regexp_replace(COALESCE(c.documento, ''), '[^0-9A-Za-z]', '', 'g')) LIKE ${b}`,
          `regexp_replace(COALESCE(c.telefono, ''), '\\D', '', 'g') LIKE ${b}`
        );
      }
      where.push(`(${condiciones.join(" OR ")})`);
    }
    const condicion = where.join(" AND ");

    try {
      const [lista, conteo, registrados] = await Promise.all([
        pool.query(
          `SELECT c.id_cliente AS id, c.nombre, c.tipo_documento, c.documento, c.telefono, c.correo,
                  (SELECT to_char(MAX(r.fecha), 'YYYY-MM-DD') FROM receta r
                    WHERE r.id_tenant = c.id_tenant AND r.id_cliente = c.id_cliente) AS ultima_consulta
           FROM cliente c
           WHERE ${condicion}
           ORDER BY c.nombre, c.id_cliente
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limite, (pagina - 1) * limite]
        ),
        pool.query(`SELECT COUNT(*)::int AS total FROM cliente c WHERE ${condicion}`, params),
        pool.query("SELECT COUNT(*)::int AS total FROM cliente WHERE id_tenant = $1", [tenant]),
      ]);

      const total = conteo.rows[0].total;
      res.json({
        clientes: lista.rows,
        totalRegistrados: registrados.rows[0].total,
        paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/privado/clientes/:id  (datos + recetas)
router.get("/:id", [param("id").isInt({ min: 1 }).toInt()], async (req, res, next) => {
  if (hayErrores(req, res)) return;
  const tenant = req.usuario.tenant_id;

  try {
    const [cliente, recetas] = await Promise.all([
      pool.query(`SELECT ${COLUMNAS_CLIENTE} FROM cliente c WHERE c.id_tenant = $1 AND c.id_cliente = $2`, [
        tenant,
        req.params.id,
      ]),
      pool.query(
              `SELECT id_receta AS id, to_char(fecha, 'YYYY-MM-DD') AS fecha, optometrista,
                od_esfera, od_cilindro, od_eje, od_adicion,
                oi_esfera, oi_cilindro, oi_eje, oi_adicion, observaciones
         FROM receta
         WHERE id_tenant = $1 AND id_cliente = $2
         ORDER BY fecha DESC, id_receta DESC`,
        [tenant, req.params.id]
      ),
    ]);

    if (!cliente.rowCount) return res.status(404).json({ error: "Cliente no encontrado." });

    res.json({
      cliente: cliente.rows[0],
      recetas: recetas.rows.map((r) => ({
        id: r.id,
        fecha: r.fecha,
        optometrista: r.optometrista,
        observaciones: r.observaciones,
        od: { esfera: numONull(r.od_esfera), cilindro: numONull(r.od_cilindro), eje: r.od_eje, adicion: numONull(r.od_adicion) },
        oi: { esfera: numONull(r.oi_esfera), cilindro: numONull(r.oi_cilindro), eje: r.oi_eje, adicion: numONull(r.oi_adicion) },
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/privado/clientes   y   PUT /api/privado/clientes/:id
const opcional = { values: "falsy" };
const validacionesCliente = [
  body("nombre").trim().notEmpty().withMessage("Ingresa el nombre.").isLength({ max: 150 }),
  body("tipo_documento").optional(opcional).isIn(["CC", "CE", "TI", "PA", "NIT"]),
  body("documento").optional(opcional).isString().trim().isLength({ max: 30 }),
  body("telefono").optional(opcional).isString().trim().isLength({ max: 30 }),
  body("correo").optional(opcional).trim().isEmail().withMessage("Correo inválido.").isLength({ max: 150 }),
  body("fecha_nacimiento")
    .optional(opcional)
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage("Fecha inválida.")
    .custom((v) => v <= hoy())
    .withMessage("La fecha no puede ser futura."),
  body("direccion").optional(opcional).isString().trim().isLength({ max: 255 }),
  body("ocupacion").optional(opcional).isString().trim().isLength({ max: 120 }),
];

const valoresCliente = (d) => [
  d.nombre,
  d.tipo_documento || "CC",
  d.documento ? d.documento.replace(/[\s.]/g, "").toUpperCase() : null,
  d.telefono || null,
  d.correo || null,
  d.fecha_nacimiento || null,
  d.direccion || null,
  d.ocupacion || null,
];

function errorCliente(error, res, next) {
  if (error.code === "23505") {
    return res.status(409).json({
      error: "Ya existe un cliente con ese documento.",
      campos: [{ campo: "documento", mensaje: "Ya existe un cliente con ese documento." }],
    });
  }
  next(error);
}

router.post("/", validacionesCliente, async (req, res, next) => {
  if (hayErrores(req, res)) return;
  try {
    const r = await pool.query(
      `INSERT INTO cliente (id_tenant, nombre, tipo_documento, documento, telefono, correo,
                            fecha_nacimiento, direccion, ocupacion)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id_cliente AS id, nombre`,
      [req.usuario.tenant_id, ...valoresCliente(req.body)]
    );
    res.status(201).json({ mensaje: "Cliente registrado", cliente: r.rows[0] });
  } catch (error) {
    errorCliente(error, res, next);
  }
});

router.put("/:id", [param("id").isInt({ min: 1 }).toInt(), ...validacionesCliente], async (req, res, next) => {
  if (hayErrores(req, res)) return;
  try {
    const r = await pool.query(
      `UPDATE cliente
       SET nombre = $3, tipo_documento = $4, documento = $5, telefono = $6, correo = $7,
           fecha_nacimiento = $8, direccion = $9, ocupacion = $10
       WHERE id_tenant = $1 AND id_cliente = $2
       RETURNING id_cliente AS id, nombre`,
      [req.usuario.tenant_id, req.params.id, ...valoresCliente(req.body)]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Cliente no encontrado." });
    res.json({ mensaje: "Cliente actualizado", cliente: r.rows[0] });
  } catch (error) {
    errorCliente(error, res, next);
  }
});

// POST /api/privado/clientes/:id/recetas
const nulo = { values: "null" };
const medida = (campo, min, max, entero = false) =>
  body(campo)
    .optional(nulo)
    [entero ? "isInt" : "isFloat"]({ min, max })
    .withMessage(`Debe estar entre ${min} y ${max}.`)
    [entero ? "toInt" : "toFloat"]();

const CAMPOS_MEDIDA = [
  "od_esfera", "od_cilindro", "od_eje", "od_adicion",
  "oi_esfera", "oi_cilindro", "oi_eje", "oi_adicion",
];

router.post(
  "/:id/recetas",
  permitirRoles("admin", "optometrista"),
  [
    param("id").isInt({ min: 1 }).toInt(),
    body("fecha")
      .optional(opcional)
      .isISO8601({ strict: true, strictSeparator: true })
      .custom((v) => v <= hoy())
      .withMessage("La fecha no puede ser futura."),
    body("optometrista").optional(opcional).isString().trim().isLength({ max: 120 }),
    body("observaciones").optional(opcional).isString().trim().isLength({ max: 1000 }),
    medida("od_esfera", -30, 30), medida("od_cilindro", -10, 10),
    medida("od_eje", 0, 180, true), medida("od_adicion", 0, 5),
    medida("oi_esfera", -30, 30), medida("oi_cilindro", -10, 10),
    medida("oi_eje", 0, 180, true), medida("oi_adicion", 0, 5),
  ],
  async (req, res, next) => {
    if (hayErrores(req, res)) return;
    const d = req.body;
    const tenant = req.usuario.tenant_id;

    if (CAMPOS_MEDIDA.every((c) => d[c] === null || d[c] === undefined)) {
      return res.status(400).json({
        error: "Ingresa al menos un dato de la graduación.",
        campos: [{ campo: "od_esfera", mensaje: "Ingresa al menos un dato de la graduación." }],
      });
    }

    try {
      const cliente = await pool.query(
        "SELECT 1 FROM cliente WHERE id_tenant = $1 AND id_cliente = $2",
        [tenant, req.params.id]
      );
      if (!cliente.rowCount) return res.status(404).json({ error: "Cliente no encontrado." });

      const r = await pool.query(
        `INSERT INTO receta
           (id_tenant, id_cliente, id_usuario, fecha, optometrista,
            od_esfera, od_cilindro, od_eje, od_adicion,
            oi_esfera, oi_cilindro, oi_eje, oi_adicion, observaciones)
         VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5,
                 $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id_receta AS id`,
        [
          tenant, req.params.id, req.usuario.id, d.fecha || null,
          d.optometrista || req.usuario.nombre,
          ...CAMPOS_MEDIDA.map((c) => d[c] ?? null),
          d.observaciones || null,
        ]
      );
      res.status(201).json({ mensaje: "Receta registrada", receta: r.rows[0] });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;