
const express = require("express");
const { body, validationResult } = require("express-validator");
const pool = require("../database");
const { permitirRoles } = require("../middleware/authMiddleware");
const { insertar } = require("../utils/esquema");

const router = express.Router();

const TIPOS = ["MONTURA", "LENTE", "ACCESORIO", "OTRO"];

// GET /api/privado/productos/opciones
// Devuelve proveedores y el siguiente código sugerido.
router.get("/opciones", async (req, res, next) => {
  const tenant = req.usuario.tenant_id;

  try {
    const [proveedores, codigos] = await Promise.all([
      pool.query(
        `SELECT id_prov AS id, nombre
         FROM proveedor
         WHERE id_tenant = $1
         ORDER BY nombre`,
        [tenant]
      ),
      pool.query(
        `SELECT COALESCE(
           MAX(substring(codigo from '^PRD-(\\d+)$')::int),
           0
         ) AS ultimo
         FROM producto
         WHERE id_tenant = $1`,
        [tenant]
      ),
    ]);

    res.json({
      proveedores: proveedores.rows,
      siguienteCodigo: `PRD-${String(
        Number(codigos.rows[0].ultimo) + 1
      ).padStart(4, "0")}`,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/privado/productos
// Registra el producto y genera el movimiento del inventario inicial.
router.post(
  "/",
  permitirRoles("admin", "empleado"),
  [
    body("codigo")
      .isString()
      .trim()
      .matches(/^[A-Za-z0-9._\-/]+$/)
      .withMessage("Usa solo letras, números, guiones o puntos.")
      .isLength({ max: 50 }),

    body("nombre")
      .isString()
      .trim()
      .notEmpty()
      .withMessage("Ingresa el nombre del producto.")
      .isLength({ max: 150 }),

    body("tipo_producto")
      .isIn(TIPOS)
      .withMessage("Tipo de producto inválido."),

    body("referencia")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 100 }),

    body("laboratorio")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 150 }),

    body("cantidad_inicial")
      .isInt({ min: 0, max: 1000000 })
      .withMessage("Cantidad inválida.")
      .toInt(),

    body("stock_minimo")
      .optional({ values: "falsy" })
      .isInt({ min: 0, max: 1000000 })
      .toInt(),

    body("precio_compra")
      .isFloat({ min: 0, max: 9999999999 })
      .withMessage("Costo inválido.")
      .toFloat(),

    body("precio_venta")
      .isFloat({ min: 0, max: 9999999999 })
      .withMessage("Precio inválido.")
      .toFloat(),

    body("descripcion")
      .optional({ values: "falsy" })
      .isString()
      .trim()
      .isLength({ max: 1000 }),
  ],
  async (req, res, next) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Revisa los campos del formulario.",
        campos: errores.array().map((e) => ({
          campo: e.path || "general",
          mensaje: e.msg,
        })),
      });
    }

    const d = req.body;
    const tenant = req.usuario.tenant_id;
    const db = await pool.connect();

    try {
      await db.query("BEGIN");

      // Buscar el proveedor por nombre o crearlo si no existe.
      const nombreProv = d.laboratorio?.trim() || "Sin proveedor";

      let prov = await db.query(
        `SELECT id_prov
         FROM proveedor
         WHERE id_tenant = $1
           AND lower(nombre) = lower($2)
         LIMIT 1`,
        [tenant, nombreProv]
      );

      if (!prov.rowCount) {
        prov = await db.query(
          `INSERT INTO proveedor (id_tenant, nombre, tipo)
           VALUES ($1, $2, $3)
           RETURNING id_prov`,
          [
            tenant,
            nombreProv,
            d.tipo_producto === "LENTE" && d.laboratorio
              ? "LABORATORIO"
              : "OTRO",
          ]
        );
      }

      // Registrar el producto sin asignarle una categoría.
      const producto = await insertar(
        db,
        "producto",
        {
          id_tenant: tenant,
          id_categoria: null,
          id_proveedor: prov.rows[0].id_prov,
          tipo_producto: d.tipo_producto,
          codigo: d.codigo.trim(),
          nombre: d.nombre.trim(),
          descripcion: d.descripcion?.trim() || null,
          referencia: d.referencia?.trim() || null,
          precio_compra: d.precio_compra,
          precio_venta: d.precio_venta,
          stock_minimo: d.stock_minimo || 0,
        },
        "id_producto, codigo, nombre"
      );

      // El stock se actualiza mediante el movimiento de entrada.
      if (d.cantidad_inicial > 0) {
        const movimiento = await db.query(
          `INSERT INTO movimiento
             (id_tenant, id_usuario, tipo, observacion)
           VALUES ($1, $2, 'ENTRADA', 'Inventario inicial')
           RETURNING id_movimiento`,
          [tenant, req.usuario.id]
        );

        await db.query(
          `INSERT INTO detalle_movimiento
             (id_tenant, id_movimiento, id_producto, cantidad, costo_unitario)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            tenant,
            movimiento.rows[0].id_movimiento,
            producto.id_producto,
            d.cantidad_inicial,
            d.precio_compra,
          ]
        );
      }

      await db.query("COMMIT");

      res.status(201).json({
        mensaje: "Producto registrado",
        producto: {
          id: producto.id_producto,
          codigo: producto.codigo,
          nombre: producto.nombre,
        },
      });
    } catch (error) {
      await db.query("ROLLBACK").catch(() => {});

      if (error.code === "23505") {
        return res.status(409).json({
          error: "Ya existe un producto con ese código.",
          campos: [
            {
              campo: "codigo",
              mensaje: "Ya existe un producto con ese código.",
            },
          ],
        });
      }

      next(error);
    } finally {
      db.release();
    }
  }
);

module.exports = router;
