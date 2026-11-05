require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./database");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function preguntar(texto) {
  return new Promise((resolve) => {
    rl.question(texto, resolve);
  });
}

async function crearAdmin() {
  try {
    const nombre = await preguntar("Nombre del administrador: ");
    const correo = (
      await preguntar("Correo del administrador: ")
    ).trim().toLowerCase();
    const password = await preguntar(
      "Contraseña (mínimo 12 caracteres): "
    );

    if (!nombre.trim() || !correo.includes("@") || password.length < 12 || password.length > 72) {
      throw new Error("Datos inválidos. Revisa el nombre, correo y contraseña.");
    }

    const tenantId = Number(
    (await preguntar("ID de la óptica (tenant): ")).trim()
    );

    if (!Number.isInteger(tenantId) || tenantId < 1) {
      throw new Error("El ID de la óptica no es válido.");
    }

    const tenant = await pool.query(
      `SELECT id_tenant
      FROM tenant
      WHERE id_tenant = $1 AND estado = 'activa'`,
      [tenantId]
    );

    if (tenant.rowCount === 0) {
      throw new Error("La óptica no existe o está inactiva.");
    }

    const existente = await pool.query(
      "SELECT id_user FROM usuario WHERE LOWER(correo) = LOWER($1)",
      [correo]
    );

    if (existente.rowCount > 0) {
      throw new Error("Ya existe un usuario con ese correo.");
    }

    const hash = await bcrypt.hash(password, 12);

    const resultado = await pool.query(
      `INSERT INTO usuario
        (id_tenant, nombre, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'admin')
       RETURNING id_user AS id, id_tenant AS tenant_id, nombre, correo, rol, estado`,
      [tenantId, nombre.trim(), correo, hash]
    );

    console.log("\nAdministrador creado correctamente:");
    console.table(resultado.rows);
  } catch (error) {
    console.error("\nNo se pudo crear el administrador:", error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
    await pool.end();
  }
}

crearAdmin();
