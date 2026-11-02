
const express = require("express");
const { body, validationResult } = require("express-validator");
const pool = require("../database");
const { permitirRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Consultar los datos del negocio.
router.get("/", permitirRoles("admin"), async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT id_tenant, nombre, nit, correo, telefono,
              direccion, moneda, logo_data
       FROM tenant
       WHERE id_tenant = $1`,
      [req.usuario.tenant_id]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({ error: "Negocio no encontrado." });
    }

    res.json({ negocio: resultado.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Actualizar los datos del negocio.
router.put(
  "/",
  permitirRoles("admin"),
  [
    body("nombre").trim().notEmpty(),
    body("correo")
      .optional({ values: "null" })
      .isEmail()
      .withMessage("El correo no es válido."),
    body("moneda").isIn(["COP", "USD", "EUR"]),
  ],
  async (req, res, next) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Revisa los datos ingresados.",
        campos: errores.array(),
      });
    }

    const {
      nombre, nit, correo, telefono, direccion, moneda, logo_data
    } = req.body;

    if (
      logo_data &&
      !/^data:image\/(png|jpeg|webp);base64,/.test(logo_data)
    ) {
      return res.status(400).json({
        error: "El logotipo debe ser PNG, JPG o WEBP."
      });
    }

    if (logo_data && logo_data.length > 2_000_000) {
      return res.status(400).json({
        error: "El logotipo supera el tamaño permitido."
      });
    }

    try {
      const resultado = await pool.query(
        `UPDATE tenant
         SET nombre = $1,
             nit = $2,
             correo = $3,
             telefono = $4,
             direccion = $5,
             moneda = $6,
             logo_data = $7,
             actualizado_en = NOW()
         WHERE id_tenant = $8
         RETURNING id_tenant, nombre, nit, correo, telefono,
                   direccion, moneda, logo_data`,
        [
          nombre,
          nit || null,
          correo || null,
          telefono || null,
          direccion || null,
          moneda,
          logo_data || null,
          req.usuario.tenant_id,
        ]
      );

      if (!resultado.rowCount) {
        return res.status(404).json({ error: "Negocio no encontrado." });
      }

      res.json({
        mensaje: "Configuración guardada correctamente.",
        negocio: resultado.rows[0],
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
