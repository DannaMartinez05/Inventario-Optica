const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const pool = require("../database");

const router = express.Router();

// REGISTRO
router.post(
  "/registro",
  [
    body("tenant_id").isInt({ min: 1 }),
    body("nombre").trim().notEmpty().isLength({ max: 120 }),
    body("correo").trim().isEmail().normalizeEmail(),
    body("password").isLength({ min: 12, max: 72 }),
    body("rol").optional().isIn([
      "admin",
      "optometrista",
      "empleado",
    ]),
  ],
  async (req, res) => {
    const errores = validationResult(req);

    if (!errores.isEmpty()) {
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: errores.array(),
      });
    }

    const { tenant_id, nombre, correo, password } = req.body;

    // El registro público nunca permite crear administradores.
    // Este endpoint se protegerá antes de habilitarlo en producción.
    const rol = "empleado";

    try {
      const tenant = await pool.query(
        "SELECT id FROM tenant WHERE id = $1 AND estado = 'activa'",
        [tenant_id]
      );

      if (tenant.rowCount === 0) {
        return res.status(400).json({
          error: "La óptica no existe o está inactiva",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const resultado = await pool.query(
        `INSERT INTO usuario
          (tenant_id, nombre, correo, password_hash, rol)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, tenant_id, nombre, correo, rol, estado`,
        [tenant_id, nombre, correo, passwordHash, rol]
      );

      return res.status(201).json({
        mensaje: "Usuario registrado",
        usuario: resultado.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "Ese correo ya está registrado en esta óptica",
        });
      }

      console.error("Error al registrar usuario:", error.message);
      return res.status(500).json({
        error: "No fue posible registrar el usuario",
      });
    }
  }
);

// INICIO DE SESIÓN
router.post(
  "/login",
  [
    body("tenant_id").isInt({ min: 1 }),
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

    const { tenant_id, correo, password } = req.body;

    try {
      const resultado = await pool.query(
        `SELECT id_user AS id, id_tenant AS tenant_id, nombre, correo,
                password_hash, rol, estado
         FROM usuario
         WHERE id_tenant = $1 AND LOWER(correo) = LOWER($2)
         LIMIT 1`,
        [tenant_id, correo]
      );

      const usuario = resultado.rows[0];

      if (
        !usuario ||
        usuario.estado !== "activo" ||
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
