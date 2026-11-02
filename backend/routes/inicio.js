const express = require("express");
const pool = require("../database");

const router = express.Router();

// GET /api/privado/inicio
// Panel operativo del día para la óptica de la sesión.
router.get("/", async (req, res, next) => {
  const tenant = req.usuario.tenant_id;

  try {
    const [
      ventasHoy,
      productosVendidos,
      stockBajo,
      listaStockBajo,
      ultimasVentas,
      movimientosRecientes,
    ] = await Promise.all([

      // 1. Total de ventas y cantidad de ventas de hoy.
      pool.query(
        `SELECT
           COUNT(*)::int AS cantidad,
           COALESCE(SUM(total), 0) AS total
         FROM venta
         WHERE id_tenant = $1
           AND fecha >= CURRENT_DATE
           AND fecha < CURRENT_DATE + INTERVAL '1 day'`,
        [tenant]
      ),

      // 2. Unidades de productos vendidos hoy.
      pool.query(
        `SELECT
           COALESCE(SUM(d.cantidad), 0)::int AS unidades
         FROM venta_detalle d
         JOIN venta v
           ON v.id_venta = d.id_venta
          AND v.id_tenant = d.id_tenant
         WHERE v.id_tenant = $1
           AND v.fecha >= CURRENT_DATE
           AND v.fecha < CURRENT_DATE + INTERVAL '1 day'
           AND d.id_producto IS NOT NULL`,
        [tenant]
      ),

      // 3. Cantidad de productos con stock bajo.
      pool.query(
        `SELECT COUNT(*)::int AS cantidad
         FROM producto
         WHERE id_tenant = $1
           AND estado = 'ACTIVO'
           AND stock <= stock_minimo`,
        [tenant]
      ),

      // 4. Productos que necesitan reposición.
      pool.query(
        `SELECT
           id_producto,
           codigo,
           nombre,
           stock,
           stock_minimo
         FROM producto
         WHERE id_tenant = $1
           AND estado = 'ACTIVO'
           AND stock <= stock_minimo
         ORDER BY stock ASC, nombre ASC
         LIMIT 8`,
        [tenant]
      ),

      // 5. Últimas cinco ventas.
      pool.query(
        `SELECT
           v.id_venta,
           v.fecha,
           v.total,
           v.modalidad,
           v.metodo_pago,
           c.nombre AS cliente
         FROM venta v
         LEFT JOIN cliente c
           ON c.id_cliente = v.id_cliente
          AND c.id_tenant = v.id_tenant
         WHERE v.id_tenant = $1
         ORDER BY v.fecha DESC, v.id_venta DESC
         LIMIT 5`,
        [tenant]
      ),

      // 6. Últimos cinco movimientos de inventario.
      pool.query(
        `SELECT
           m.id_movimiento,
           m.tipo,
           m.fecha,
           m.observacion,
           u.nombre AS usuario,
           COUNT(DISTINCT d.id_detalle)::int AS productos,
           COALESCE(SUM(d.cantidad), 0)::int AS unidades
         FROM movimiento m
         LEFT JOIN usuario u
           ON u.id_user = m.id_usuario
          AND u.id_tenant = m.id_tenant
         LEFT JOIN detalle_movimiento d
           ON d.id_movimiento = m.id_movimiento
          AND d.id_tenant = m.id_tenant
         WHERE m.id_tenant = $1
         GROUP BY
           m.id_movimiento,
           m.tipo,
           m.fecha,
           m.observacion,
           u.nombre
         ORDER BY m.fecha DESC, m.id_movimiento DESC
         LIMIT 5`,
        [tenant]
      ),
    ]);

    res.json({
      resumen: {
        ventas_hoy: Number(ventasHoy.rows[0].total) || 0,
        cantidad_ventas_hoy: ventasHoy.rows[0].cantidad,
        productos_vendidos: productosVendidos.rows[0].unidades,
        productos_stock_bajo: stockBajo.rows[0].cantidad,
      },

      productos_stock_bajo: listaStockBajo.rows,

      ultimas_ventas: ultimasVentas.rows,

      movimientos_recientes: movimientosRecientes.rows,
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;
