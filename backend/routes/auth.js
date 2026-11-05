const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../database");

const router = express.Router();

// INICIO DE SESIÓN
router.post(
  "/login",
  [
    // body("tenant_id").isInt({ min: 1 }),
    body("correo").trim().isEmail().normalizeEmail(),
    body("password").isString().notEmpty().isLength({ max: 72 }),
  ],
  async (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Datos inválidos",
      });
    }

    const { correo, password } = req.body;

    try {
     const resultado = await pool.query(
      `SELECT
          u.id_user AS id,
          u.id_tenant AS tenant_id,
          u.nombre,
          u.correo,
          u.password_hash,
          u.rol,
          u.estado,
          t.estado AS tenant_estado
      FROM usuario u
      INNER JOIN tenant t ON t.id_tenant = u.id_tenant
      WHERE LOWER(u.correo) = LOWER($1)
      LIMIT 1`,
      [correo]
    );

      const usuario = resultado.rows[0];

      if (
        !usuario ||
        usuario.estado !== "activo" ||
        usuario.tenant_estado !== "activa" ||
        !(await bcrypt.compare(password, usuario.password_hash))
      ) {
        return res.status(401).json({
          error: "Credenciales incorrectas o usuario inactivo",
        });
      }

      const token = jwt.sign(
        {
          sub: String(usuario.id),
          tenant_id: String(usuario.tenant_id),
          rol: usuario.rol,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h", algorithm: "HS256" }
      );

      return res.json({
        mensaje: "Inicio de sesión exitoso",
        token,
        usuario: {
          id: usuario.id,
          tenant_id: usuario.tenant_id,
          nombre: usuario.nombre,
          correo: usuario.correo,
          rol: usuario.rol,
        },
      });
    } catch (error) {
      console.error("Error al iniciar sesión:", error.message);
      return res.status(500).json({
        error: "No fue posible iniciar sesión",
      });
    }
  }
);
router.get("/health", (req, res) => {
  res.status(200).json({
    estado: "ok",
    mensaje: "Rutas de autenticación funcionando",
  });
});
module.exports = router;
