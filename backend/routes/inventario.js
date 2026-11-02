const express = require("express");
const {
  query,
  param,
  body,
  validationResult,
} = require("express-validator");
const pool = require("../database");

const router = express.Router();

const TIPOS = ["LENTE", "MONTURA", "ACCESORIO", "SERVICIO"];
const TIPOS_PRODUCTO = ["LENTE", "MONTURA", "ACCESORIO"];

const num = (v) => Number(v) || 0;

// Búsqueda sin importar mayúsculas ni tildes.
const sinTildes = (texto) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const sqlNorm = (col) =>
  `lower(translate(${col}, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))`;

const escaparLike = (texto) =>
  texto.replace(/[\\%_]/g, "\\$&");

// GET /api/privado/inventario?q=essilor&tipo=LENTE&pagina=1&limite=15
router.get(
  "/",
  [
    query("q").optional().isString().isLength({ max: 100 }),
    query("tipo").optional({ values: "falsy" }).isIn(TIPOS),
    query("pagina").optional().isInt({ min: 1 }).toInt(),
    query("limite").optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req, res, next) => {
    if (!validationResult(req).isEmpty()) {
      return res.status(400).json({
        error: "Parámetros de búsqueda inválidos.",
      });
    }

    const tenant = req.usuario.tenant_id;
    const tipo = req.query.tipo || "";
    const pagina = Number(req.query.pagina) || 1;
    const limite = Number(req.query.limite) || 15;
    const offset = (pagina - 1) * limite;

    const terminos = sinTildes((req.query.q || "").trim())
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((t) => `%${escaparLike(t.slice(0, 50))}%`);

    try {
      const kpis = await pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (
             WHERE stock > stock_minimo
           )::int AS disponibles,
           COUNT(*) FILTER (
             WHERE stock <= stock_minimo
           )::int AS stock_bajo,
           COALESCE(SUM(stock), 0)::int AS unidades
         FROM producto
         WHERE id_tenant = $1
           AND estado = 'ACTIVO'`,
        [tenant]
      );

      let filas;
      let total;

      // Inventario de servicios.
      if (tipo === "SERVICIO") {
        const params = [tenant];
        const where = [
          "s.id_tenant = $1",
          "s.activo = TRUE",
        ];

        for (const termino of terminos) {
          params.push(termino);
          const n = `$${params.length}`;

          where.push(
            `(
              ${sqlNorm("s.nombre")} LIKE ${n} ESCAPE '\\'
              OR ${sqlNorm("COALESCE(s.descripcion, '')")} LIKE ${n} ESCAPE '\\'
            )`
          );
        }

        const condicion = where.join(" AND ");

        const [lista, conteo] = await Promise.all([
          pool.query(
            `SELECT
               s.id_servicio AS id,
               s.nombre,
               s.costo,
               s.precio
             FROM servicio s
             WHERE ${condicion}
             ORDER BY s.nombre
             LIMIT $${params.length + 1}
             OFFSET $${params.length + 2}`,
            [...params, limite, offset]
          ),

          pool.query(
            `SELECT COUNT(*)::int AS total
             FROM servicio s
             WHERE ${condicion}`,
            params
          ),
        ]);

        total = conteo.rows[0].total;

        filas = lista.rows.map((f) => ({
          id: `S${f.id}`,
          codigo: null,
          nombre: f.nombre,
          tipo: "SERVICIO",
          referencia: null,
          laboratorio: null,
          stock: null,
          costo: num(f.costo),
          precio: num(f.precio),
          estado: "DISPONIBLE",
        }));
      } else {
        // Inventario de productos.
        const params = [tenant];
        const where = [
          "p.id_tenant = $1",
          "p.estado = 'ACTIVO'",
        ];

        if (tipo) {
          params.push(tipo);
          where.push(`p.tipo_producto = $${params.length}`);
        }

        for (const termino of terminos) {
          params.push(termino);
          const n = `$${params.length}`;

          where.push(
            `(
              ${sqlNorm("p.nombre")} LIKE ${n} ESCAPE '\\'
              OR ${sqlNorm("p.codigo")} LIKE ${n} ESCAPE '\\'
              OR ${sqlNorm("COALESCE(p.referencia, '')")} LIKE ${n} ESCAPE '\\'
              OR ${sqlNorm("COALESCE(pr.nombre, '')")} LIKE ${n} ESCAPE '\\'
              OR ${sqlNorm("p.tipo_producto")} LIKE ${n} ESCAPE '\\'
            )`
          );
        }

        const desde = `
          FROM producto p
          LEFT JOIN proveedor pr
            ON pr.id_tenant = p.id_tenant
           AND pr.id_prov = p.id_proveedor
          WHERE ${where.join(" AND ")}
        `;

        const [lista, conteo] = await Promise.all([
          pool.query(
            `SELECT
               p.id_producto AS id,
               p.codigo,
               p.nombre,
               p.tipo_producto AS tipo,
               p.referencia,
               pr.nombre AS laboratorio,
               p.stock,
               p.precio_compra AS costo,
               p.precio_venta AS precio,
               CASE
                 WHEN p.stock = 0 THEN 'AGOTADO'
                 WHEN p.stock <= p.stock_minimo THEN 'STOCK_BAJO'
                 ELSE 'DISPONIBLE'
               END AS estado
             ${desde}
             ORDER BY p.nombre, p.id_producto
             LIMIT $${params.length + 1}
             OFFSET $${params.length + 2}`,
            [...params, limite, offset]
          ),

          pool.query(
            `SELECT COUNT(*)::int AS total ${desde}`,
            params
          ),
        ]);

        total = conteo.rows[0].total;

        filas = lista.rows.map((f) => ({
          ...f,
          costo: num(f.costo),
          precio: num(f.precio),
        }));
      }

      return res.json({
        kpis: kpis.rows[0],
        productos: filas,
        paginacion: {
          pagina,
          limite,
          total,
          paginas: Math.max(1, Math.ceil(total / limite)),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/privado/inventario/:id
// Actualiza un producto del tenant autenticado.
router.put(
  "/:id",
  [
    param("id")
      .isInt({ min: 1 })
      .withMessage("Identificador inválido."),

    body("codigo")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 60 })
      .withMessage(
        "El código es obligatorio y debe tener máximo 60 caracteres."
      ),

    body("nombre")
      .isString()
      .trim()
      .notEmpty()
      .isLength({ max: 200 })
      .withMessage(
        "El nombre es obligatorio y debe tener máximo 200 caracteres."
      ),

    body("tipo_producto")
      .isIn(TIPOS_PRODUCTO)
      .withMessage("Selecciona un tipo de producto válido."),

    body("referencia")
      .optional({ nullable: true })
      .isString()
      .trim()
      .isLength({ max: 100 })
      .withMessage("La referencia debe tener máximo 100 caracteres."),

    body("stock")
      .isInt({ min: 0, max: 1000000 })
      .toInt()
      .withMessage(
        "El stock debe ser un número entero igual o mayor que cero."
      ),

    body("precio_compra")
      .isFloat({ min: 0 })
      .toFloat()
      .withMessage("El precio de compra no puede ser negativo."),

    body("precio_venta")
      .isFloat({ min: 0 })
      .toFloat()
      .withMessage("El precio de venta no puede ser negativo."),
  ],
  async (req, res, next) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Revisa los datos del producto.",
        campos: errores.array().map((e) => ({
          campo: e.path,
          mensaje: e.msg,
        })),
      });
    }

    const id = Number(req.params.id);
    const tenant = req.usuario.tenant_id;

    const {
      codigo,
      nombre,
      tipo_producto,
      referencia,
      stock,
      precio_compra,
      precio_venta,
    } = req.body;

    try {
      const resultado = await pool.query(
        `UPDATE producto
         SET codigo = $1,
             nombre = $2,
             tipo_producto = $3,
             referencia = $4,
             stock = $5,
             precio_compra = $6,
             precio_venta = $7
         WHERE id_producto = $8
           AND id_tenant = $9
           AND estado = 'ACTIVO'
         RETURNING
           id_producto AS id,
           codigo,
           nombre,
           tipo_producto AS tipo,
           referencia,
           stock,
           precio_compra AS costo,
           precio_venta AS precio`,
        [
          codigo.trim(),
          nombre.trim(),
          tipo_producto,
          referencia == null || referencia.trim() === ""
            ? null
            : referencia.trim(),
          Number(stock),
          Number(precio_compra),
          Number(precio_venta),
          id,
          tenant,
        ]
      );

      if (!resultado.rowCount) {
        return res.status(404).json({
          error: "No se encontró el producto para editar.",
        });
      }

      return res.json({
        mensaje: "Producto actualizado correctamente.",
        producto: resultado.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "Ese código ya está registrado en otro producto.",
        });
      }

      return next(error);
    }
  }
);

module.exports = router;
