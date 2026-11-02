const express = require("express");
const pool = require("../database");

const router = express.Router();

const TIPOS = {
  ENTRADA: { db: "ENTRADA", etiqueta: "Entrada", suma: true },
  SALIDA: { db: "SALIDA", etiqueta: "Salida", suma: false },
  AVERIA: { db: "AJUSTE_NEGATIVO", etiqueta: "Avería", suma: false },
  DEVOLUCION_CLIENTE: {
    db: "AJUSTE_POSITIVO",
    etiqueta: "Devolución de cliente",
    suma: true,
  },
  DEVOLUCION_PROVEEDOR: {
    db: "AJUSTE_NEGATIVO",
    etiqueta: "Devolución a proveedor",
    suma: false,
  },
};

function tipoParaMostrar(movimiento) {
  if (movimiento.id_venta) return "VENTA";
  const observacion = movimiento.observacion || "";
  if (observacion.startsWith("AVERIA:")) return "AVERIA";
  if (observacion.startsWith("DEVOLUCION_CLIENTE:")) return "DEVOLUCION_CLIENTE";
  if (observacion.startsWith("DEVOLUCION_PROVEEDOR:")) return "DEVOLUCION_PROVEEDOR";
  return movimiento.tipo;
}

function mensajeError(res, estado, error) {
  return res.status(estado).json({ error });
}

// GET /privado/movimientos
router.get("/", async (req, res, next) => {
  try {
    const tenantId = Number(req.usuario.tenant_id);
    const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
    const limite = Math.min(100, Math.max(1, Number.parseInt(req.query.limite, 10) || 20));
    const offset = (pagina - 1) * limite;
    const tipo = String(req.query.tipo || "").trim().toUpperCase();
    const q = String(req.query.q || "").trim();

    const condiciones = ["m.id_tenant = $1"];
    const valores = [tenantId];

    if (tipo && tipo !== "TODOS") {
      if (tipo === "VENTA") {
        condiciones.push("m.id_venta IS NOT NULL");
      } else if (TIPOS[tipo]) {
        valores.push(TIPOS[tipo].db);
        condiciones.push(`m.tipo = $${valores.length}`);
        if (tipo !== "ENTRADA" && tipo !== "SALIDA") {
          valores.push(`${tipo}:%`);
          condiciones.push(`m.observacion LIKE $${valores.length}`);
        }
      } else if (["ENTRADA", "SALIDA", "AJUSTE_POSITIVO", "AJUSTE_NEGATIVO"].includes(tipo)) {
        valores.push(tipo);
        condiciones.push(`m.tipo = $${valores.length}`);
      }
    }

    if (req.query.desde) {
      valores.push(req.query.desde);
      condiciones.push(`m.fecha >= $${valores.length}::date`);
    }
    if (req.query.hasta) {
      valores.push(req.query.hasta);
      condiciones.push(`m.fecha < ($${valores.length}::date + INTERVAL '1 day')`);
    }
    if (q) {
      valores.push(`%${q}%`);
      const p = `$${valores.length}`;
      condiciones.push(`(
        m.observacion ILIKE ${p}
        OR u.nombre ILIKE ${p}
        OR EXISTS (
          SELECT 1
          FROM detalle_movimiento dx
          JOIN producto px ON px.id_producto = dx.id_producto
          WHERE dx.id_movimiento = m.id_movimiento
            AND dx.id_tenant = m.id_tenant
            AND (px.nombre ILIKE ${p} OR px.codigo ILIKE ${p} OR px.referencia ILIKE ${p})
        )
      )`);
    }

    const where = condiciones.join(" AND ");
    const conteo = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM movimiento m
       JOIN usuario u ON u.id_user = m.id_usuario AND u.id_tenant = m.id_tenant
       WHERE ${where}`,
      valores
    );

    const consultaValores = [...valores, limite, offset];
    const resultado = await pool.query(
      `SELECT
          m.id_movimiento,
          m.id_venta,
          m.tipo,
          m.fecha,
          m.observacion,
          u.nombre AS usuario_nombre,
          COUNT(DISTINCT d.id_producto)::int AS cantidad_productos,
          COALESCE(SUM(d.cantidad), 0)::int AS unidades
       FROM movimiento m
       JOIN usuario u ON u.id_user = m.id_usuario AND u.id_tenant = m.id_tenant
       LEFT JOIN detalle_movimiento d
         ON d.id_movimiento = m.id_movimiento AND d.id_tenant = m.id_tenant
       WHERE ${where}
       GROUP BY m.id_movimiento, u.nombre
       ORDER BY m.fecha DESC, m.id_movimiento DESC
       LIMIT $${consultaValores.length - 1}
       OFFSET $${consultaValores.length}`,
      consultaValores
    );

    const movimientos = resultado.rows.map((m) => ({
      ...m,
      tipo_ui: tipoParaMostrar(m),
    }));

    res.json({
      movimientos,
      paginacion: {
        pagina,
        limite,
        total: conteo.rows[0].total,
        paginas: Math.ceil(conteo.rows[0].total / limite),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /privado/movimientos/:id
router.get("/:id", async (req, res, next) => {
  try {
    const tenantId = Number(req.usuario.tenant_id);
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return mensajeError(res, 400, "El identificador del movimiento no es válido.");
    }

    const cabecera = await pool.query(
      `SELECT m.id_movimiento, m.id_venta, m.tipo, m.fecha, m.observacion,
              u.nombre AS usuario_nombre
       FROM movimiento m
       JOIN usuario u ON u.id_user = m.id_usuario AND u.id_tenant = m.id_tenant
       WHERE m.id_movimiento = $1 AND m.id_tenant = $2
       LIMIT 1`,
      [id, tenantId]
    );

    if (!cabecera.rowCount) {
      return mensajeError(res, 404, "No se encontró el movimiento.");
    }

    const detalles = await pool.query(
      `SELECT d.id_detalle, d.id_producto, d.cantidad, d.costo_unitario,
              p.codigo, p.nombre, p.referencia
       FROM detalle_movimiento d
       JOIN producto p
         ON p.id_producto = d.id_producto AND p.id_tenant = d.id_tenant
       WHERE d.id_movimiento = $1 AND d.id_tenant = $2
       ORDER BY d.id_detalle`,
      [id, tenantId]
    );

    const movimiento = cabecera.rows[0];
    res.json({
      movimiento: { ...movimiento, tipo_ui: tipoParaMostrar(movimiento) },
      productos: detalles.rows,
    });
  } catch (error) {
    next(error);
  }
});

// POST /privado/movimientos
router.post("/", async (req, res, next) => {
  const cliente = await pool.connect();
  try {
    const tenantId = Number(req.usuario.tenant_id);
    const usuarioId = Number(req.usuario.id);
    const tipo = String(req.body.tipo || "").trim().toUpperCase();
    const observacion = String(req.body.observacion || "").trim();
    const productos = req.body.productos;

    if (!TIPOS[tipo]) {
      return mensajeError(res, 400, "Selecciona un tipo de movimiento válido.");
    }
    if (!Array.isArray(productos) || productos.length === 0) {
      return mensajeError(res, 400, "Agrega por lo menos un producto al movimiento.");
    }
    if (productos.length > 100) {
      return mensajeError(res, 400, "Puedes registrar hasta 100 productos por operación.");
    }
    if (observacion.length > 900) {
      return mensajeError(res, 400, "La observación no puede superar 900 caracteres.");
    }

    const normalizados = [];
    const vistos = new Set();
    for (const item of productos) {
      const idProducto = Number(item.id_producto);
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(idProducto) || idProducto <= 0 ||
          !Number.isInteger(cantidad) || cantidad <= 0) {
        return mensajeError(res, 400, "Revisa los productos y sus cantidades. Deben ser valores enteros mayores que cero.");
      }
      if (vistos.has(idProducto)) {
        return mensajeError(res, 400, "No repitas un producto. Modifica la cantidad en la misma línea.");
      }
      vistos.add(idProducto);
      normalizados.push({ idProducto, cantidad });
    }

    await cliente.query("BEGIN");

    const ids = normalizados.map((p) => p.idProducto);
    const productosDb = await cliente.query(
      `SELECT id_producto, nombre, stock, precio_compra
       FROM producto
       WHERE id_tenant = $1 AND id_producto = ANY($2::int[])
       ORDER BY id_producto
       FOR UPDATE`,
      [tenantId, ids]
    );

    if (productosDb.rowCount !== normalizados.length) {
      await cliente.query("ROLLBACK");
      return mensajeError(res, 400, "Uno o más productos no existen o no pertenecen a esta óptica.");
    }

    const porId = new Map(productosDb.rows.map((p) => [Number(p.id_producto), p]));
    if (!TIPOS[tipo].suma) {
      for (const item of normalizados) {
        const producto = porId.get(item.idProducto);
        if (Number(producto.stock) < item.cantidad) {
          await cliente.query("ROLLBACK");
          return mensajeError(
            res,
            400,
            `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}; solicitado: ${item.cantidad}.`
          );
        }
      }
    }

    const prefijo = tipo === "AVERIA" || tipo === "DEVOLUCION_CLIENTE" ||
      tipo === "DEVOLUCION_PROVEEDOR" ? `${tipo}: ` : "";
    const observacionFinal = `${prefijo}${observacion}`.trim() || null;

    const encabezado = await cliente.query(
      `INSERT INTO movimiento (id_tenant, id_usuario, tipo, observacion)
       VALUES ($1, $2, $3, $4)
       RETURNING id_movimiento, fecha`,
      [tenantId, usuarioId, TIPOS[tipo].db, observacionFinal]
    );
    const idMovimiento = encabezado.rows[0].id_movimiento;

    for (const item of normalizados) {
      const producto = porId.get(item.idProducto);
      await cliente.query(
        `INSERT INTO detalle_movimiento
          (id_tenant, id_movimiento, id_producto, cantidad, costo_unitario)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          tenantId,
          idMovimiento,
          item.idProducto,
          item.cantidad,
          Number(producto.precio_compra || 0),
        ]
      );
    }

    await cliente.query("COMMIT");
    res.status(201).json({
      mensaje: "Movimiento registrado correctamente.",
      id_movimiento: idMovimiento,
      fecha: encabezado.rows[0].fecha,
    });
  } catch (error) {
    try { await cliente.query("ROLLBACK"); } catch (_) {}
    if (error.code === "23514") {
      return mensajeError(res, 400, "La operación no se pudo completar porque dejaría un stock inválido.");
    }
    if (error.code === "23503") {
      return mensajeError(res, 400, "No se pudo registrar el movimiento porque uno de los datos relacionados no es válido.");
    }
    next(error);
  } finally {
    cliente.release();
  }
});

module.exports = router;
