const jwt = require("jsonwebtoken");
const pool = require("../database");

// Exige token Bearer válido y comprueba que el usuario y la óptica sigan activos.
async function autenticar(req, res, next) {
  const encabezado = req.headers.authorization || "";
  const [tipo, token] = encabezado.split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({ error: "Autenticación requerida. Envía Authorization: Bearer <token>." });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!payload.sub || !payload.tenant_id) {
      return res.status(401).json({ error: "Token inválido." });
    }

    const resultado = await pool.query(
      `SELECT u.id_user AS id, u.id_tenant AS tenant_id, u.nombre, u.correo, u.rol,
              u.estado AS usuario_estado, t.estado AS tenant_estado
       FROM usuario u
       JOIN tenant t ON t.id_tenant = u.id_tenant
       WHERE u.id_user = $1 AND u.id_tenant = $2
       LIMIT 1`,
      [payload.sub, payload.tenant_id]
    );
    const usuario = resultado.rows[0];

    if (!usuario || usuario.usuario_estado !== "activo" || usuario.tenant_estado !== "activa") {
      return res.status(403).json({ error: "Usuario u óptica inactivos o sin acceso." });
    }

    // La base de datos es la fuente de verdad para rol y tenant.
    req.usuario = {
      id: String(usuario.id),
      tenant_id: String(usuario.tenant_id),
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    };
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Token inválido o vencido. Inicia sesión nuevamente." });
    }
    next(error);
  }
}

function permitirRoles(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: "No tienes permisos para acceder a este recurso." });
    }
    next();
  };
}

module.exports = { autenticar, permitirRoles };
