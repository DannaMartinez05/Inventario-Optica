// Lee (una sola vez) qué columnas existen de verdad en la base de datos, para que el
// registro de ventas solo escriba columnas reales y no generadas, aunque el SQL cambie.
const pool = require("../database");

const cache = new Map();

async function columnas(tabla) {
  if (!cache.has(tabla)) {
    const r = await pool.query(
      `SELECT column_name, is_generated, identity_generation
         FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1`,
      [tabla]
    );
    // Solo columnas que podemos escribir (no generadas ni GENERATED ALWAYS).
    const escribibles = new Set(
      r.rows
        .filter((c) => c.is_generated !== "ALWAYS" && c.identity_generation !== "ALWAYS")
        .map((c) => c.column_name)
    );
    cache.set(tabla, { todas: new Set(r.rows.map((c) => c.column_name)), escribibles });
  }
  return cache.get(tabla);
}

// Arma un INSERT solo con las columnas que existen y se pueden escribir.
// valores: { columna: valor }  (los undefined se omiten)
async function insertar(db, tabla, valores, retorno) {
  const { escribibles } = await columnas(tabla);
  const claves = Object.keys(valores).filter((k) => valores[k] !== undefined && escribibles.has(k));
  const marcas = claves.map((_, i) => `$${i + 1}`);
  const r = await db.query(
    `INSERT INTO ${tabla} (${claves.join(", ")}) VALUES (${marcas.join(", ")}) RETURNING ${retorno}`,
    claves.map((k) => valores[k])
  );
  return r.rows[0];
}

module.exports = { columnas, insertar };
