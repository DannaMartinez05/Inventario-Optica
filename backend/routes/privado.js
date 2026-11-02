
const express = require("express");
const pool = require("../database");
const {
  autenticar,
  permitirRoles,
} = require("../middleware/authMiddleware");

const bcrypt = require("bcryptjs");
const router = express.Router();

// Todas las rutas requieren una sesión válida.
router.use(autenticar);

// ==========================================
// MÓDULOS PERMITIDOS PARA ADMINISTRADOR
// Y EMPLEADO
// ==========================================

router.use(
  "/inventario",
  permitirRoles("admin", "empleado"),
  require("./inventario")
);

router.use(
  "/ventas",
  permitirRoles("admin", "empleado"),
  require("./Registroventas")
);

// ==========================================
// MÓDULOS EXCLUSIVOS DEL ADMINISTRADOR
// ==========================================

router.use(
  "/balance",
  permitirRoles("admin"),
  require("./balance")
);

router.use(
  "/inicio",
  permitirRoles("admin"),
  require("./inicio")
);

router.use(
  "/clientes",
  permitirRoles("admin"),
  require("./clientes")
);

router.use(
  "/cartera",
  permitirRoles("admin"),
  require("./cartera")
);

router.use(
  "/credito",
  permitirRoles("admin"),
  require("./credito")
);

router.use(
  "/costos",
  permitirRoles("admin"),
  require("./costos")
);

router.use(
  "/productos",
  permitirRoles("admin"),
  require("./productos")
);

router.use(
  "/movimientos",
  permitirRoles("admin"),
  require("./movimientos")
);

router.use(
  "/configuracion",
  permitirRoles("admin"),
  require("./configuracion")
);

// ==========================================
// PERFIL
// ==========================================

router.get("/perfil", (req, res) => {
  res.json({
    mensaje: "Acceso autorizado",
    usuario: req.usuario,
  });
});

// ==========================================
// CONSULTAR USUARIOS (SOLO ADMIN)
// ==========================================

router.get(
  "/usuarios",
  permitirRoles("admin"),
  async (req, res, next) => {
    try {
      const resultado = await pool.query(
        `SELECT
          id_user AS id,
          id_tenant AS tenant_id,
          nombre,
          correo,
          rol,
          estado,
          creado_en
         FROM usuario
         WHERE id_tenant = $1
         ORDER BY id_user`,
        [req.usuario.tenant_id]
      );

      res.json({ usuarios: resultado.rows });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// CREAR EMPLEADOS (SOLO ADMIN)
// ==========================================

router.post(
  "/usuarios",
  permitirRoles("admin"),
  async (req, res, next) => {
    try {
      const { nombre, correo, password } = req.body;

      if (
        typeof nombre !== "string" ||
        !nombre.trim() ||
        nombre.trim().length > 120 ||
        typeof correo !== "string" ||
        typeof password !== "string"
      ) {
        return res.status(400).json({
          error: "Ingresa un nombre, correo y contraseña válidos.",
        });
      }

      const correoNormalizado = correo.trim().toLowerCase();

      const correoValido =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoNormalizado);

      if (!correoValido) {
        return res.status(400).json({
          error: "El correo electrónico no es válido.",
        });
      }

      if (password.length < 12 || password.length > 72) {
        return res.status(400).json({
          error: "La contraseña debe tener entre 12 y 72 caracteres.",
        });
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const resultado = await pool.query(
        `INSERT INTO usuario
          (id_tenant, nombre, correo, password_hash, rol, estado)
         VALUES ($1, $2, $3, $4, 'empleado', 'activo')
         RETURNING
          id_user AS id,
          id_tenant AS tenant_id,
          nombre,
          correo,
          rol,
          estado,
          creado_en`,
        [
          req.usuario.tenant_id,
          nombre.trim(),
          correoNormalizado,
          passwordHash,
        ]
      );

      return res.status(201).json({
        mensaje: "Empleado creado correctamente.",
        usuario: resultado.rows[0],
      });
    } catch (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "Ese correo ya está registrado.",
        });
      }

      next(error);
    }
  }
);

// ==========================================
// INFORMACIÓN DE LA ÓPTICA
// ==========================================

router.get("/optica", async (req, res, next) => {
  try {
    const resultado = await pool.query(
      `SELECT
        id_tenant AS id,
        nombre,
        nit,
        correo,
        telefono AS tel,
        direccion AS dir,
        estado,
        logo_data
       FROM tenant
       WHERE id_tenant = $1
       LIMIT 1`,
      [req.usuario.tenant_id]
    );

    if (!resultado.rowCount) {
      return res.status(404).json({
        error: "Óptica no encontrada.",
      });
    }

    res.json({ optica: resultado.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
