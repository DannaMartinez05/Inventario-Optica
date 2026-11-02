import { useCallback, useEffect, useMemo, useState } from "react";
import "../css/movimientos.css";
import { pedir } from "../api";

const TIPOS = [
  { value: "ENTRADA", label: "Entrada" },
  { value: "SALIDA", label: "Salida" },
  { value: "AVERIA", label: "Avería" },
  { value: "DEVOLUCION_CLIENTE", label: "Devolución de cliente" },
  { value: "DEVOLUCION_PROVEEDOR", label: "Devolución a proveedor" },
];

const ETIQUETAS = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AVERIA: "Avería",
  DEVOLUCION_CLIENTE: "Devolución de cliente",
  DEVOLUCION_PROVEEDOR: "Devolución a proveedor",
  VENTA: "Venta",
  AJUSTE_POSITIVO: "Ajuste positivo",
  AJUSTE_NEGATIVO: "Ajuste negativo",
};

function fechaBonita(valor) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function numero(valor) {
  return new Intl.NumberFormat("es-CO").format(Number(valor || 0));
}

export default function Movimientos({ sesion }) {
  const [movimientos, setMovimientos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [filtro, setFiltro] = useState("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalDetalle, setModalDetalle] = useState(false);
  const [detalle, setDetalle] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [tipo, setTipo] = useState("ENTRADA");
  const [observacion, setObservacion] = useState("");
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [lineas, setLineas] = useState([]);

  const cargarMovimientos = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const params = new URLSearchParams({
        pagina: String(pagina),
        limite: "20",
        tipo: filtro,
        q: busqueda.trim(),
      });
      const datos = await pedir(`/privado/movimientos?${params.toString()}`, {
        token: sesion.token,
      });
      setMovimientos(datos.movimientos || []);
      setPaginas(datos.paginacion?.paginas || 1);
    } catch (e) {
      setError(e.message || "No fue posible cargar los movimientos.");
    } finally {
      setCargando(false);
    }
  }, [sesion.token, pagina, filtro, busqueda]);

  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true);
    try {
      const datos = await pedir("/privado/inventario?pagina=1&limite=100", {
        token: sesion.token,
      });
      setProductos(datos.productos || []);
    } catch (e) {
      setError(e.message || "No fue posible cargar los productos.");
    } finally {
      setCargandoProductos(false);
    }
  }, [sesion.token]);

  useEffect(() => { cargarMovimientos(); }, [cargarMovimientos]);
  useEffect(() => { cargarProductos(); }, [cargarProductos]);

  const productoSeleccionado = useMemo(
    () => productos.find((p) => String(p.id_producto ?? p.id) === String(productoId)),
    [productos, productoId]
  );

  function agregarProducto() {
    const id = Number(productoId);
    const unidades = Number(cantidad);
    if (!id || !Number.isInteger(unidades) || unidades <= 0) {
      setError("Selecciona un producto e indica una cantidad entera mayor que cero.");
      return;
    }
    const producto = productos.find((p) => Number(p.id_producto ?? p.id) === id);
    if (!producto) {
      setError("No se encontró el producto seleccionado.");
      return;
    }
    setLineas((actuales) => {
      const existe = actuales.find((x) => x.id_producto === id);
      if (existe) {
        return actuales.map((x) => x.id_producto === id
          ? { ...x, cantidad: x.cantidad + unidades }
          : x);
      }
      return [...actuales, {
        id_producto: id,
        nombre: producto.nombre,
        codigo: producto.codigo,
        stock: Number(producto.stock || 0),
        cantidad: unidades,
      }];
    });
    setProductoId("");
    setCantidad("1");
    setError("");
  }

  function cambiarCantidad(id, valor) {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) return;
    setLineas((actuales) => actuales.map((x) =>
      x.id_producto === id ? { ...x, cantidad: n } : x
    ));
  }

  async function guardarMovimiento(evento) {
    evento.preventDefault();
    if (!lineas.length) {
      setError("Agrega por lo menos un producto.");
      return;
    }
    setGuardando(true);
    setError("");
    try {
      await pedir("/privado/movimientos", {
        token: sesion.token,
        metodo: "POST",
        cuerpo: {
          tipo,
          observacion: observacion.trim(),
          productos: lineas.map(({ id_producto, cantidad }) => ({ id_producto, cantidad })),
        },
      });
      setModalNuevo(false);
      setLineas([]);
      setObservacion("");
      setTipo("ENTRADA");
      setAviso("El movimiento se registró correctamente y el stock fue actualizado.");
      setPagina(1);
      await cargarMovimientos();
      await cargarProductos();
    } catch (e) {
      setError(e.message || "No fue posible guardar el movimiento.");
    } finally {
      setGuardando(false);
    }
  }

  async function abrirDetalle(id) {
    setError("");
    try {
      const datos = await pedir(`/privado/movimientos/${id}`, { token: sesion.token });
      setDetalle(datos);
      setModalDetalle(true);
    } catch (e) {
      setError(e.message || "No fue posible consultar el detalle.");
    }
  }

  function abrirNuevo() {
    setError("");
    setAviso("");
    setLineas([]);
    setObservacion("");
    setTipo("ENTRADA");
    setModalNuevo(true);
  }

  return (
    <section className="mov-page">
      <header className="mov-header">
        <div>
          <span className="mov-eyebrow">INVENTARIO</span>
          <h1>Movimientos</h1>
          <p>Registra entradas y salidas y consulta el historial de operaciones.</p>
        </div>
        <button className="mov-primary" onClick={abrirNuevo}>＋ Nuevo movimiento</button>
      </header>

      {aviso && <div className="mov-alert mov-success">{aviso}<button onClick={() => setAviso("")}>×</button></div>}
      {error && !modalNuevo && <div className="mov-alert mov-error">{error}<button onClick={() => setError("")}>×</button></div>}

      <div className="mov-toolbar">
        <label className="mov-search">
          <span>⌕</span>
          <input value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} placeholder="Buscar por producto, código u observación..." />
        </label>
        <select
          value={filtro}
          onChange={(e) => {
            setFiltro(e.target.value);
            setPagina(1);
          }}
        >
          <option value="TODOS">Todos los movimientos</option>
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mov-table-wrap">
        <table className="mov-table">
          <thead><tr>
            <th>Operación</th><th>Tipo</th><th>Fecha</th><th>Productos</th><th>Unidades</th><th>Responsable</th><th></th>
          </tr></thead>
          <tbody>
            {cargando ? <tr><td colSpan="7" className="mov-empty">Cargando movimientos...</td></tr>
              : movimientos.length === 0 ? <tr><td colSpan="7" className="mov-empty">Todavía no hay movimientos para mostrar.</td></tr>
              : movimientos.map((m) => (
                <tr key={m.id_movimiento}>
                  <td className="mov-id">MOV-{String(m.id_movimiento).padStart(5, "0")}</td>
                  <td><span className={`mov-tag mov-tag-${String(m.tipo_ui).toLowerCase()}`}>{ETIQUETAS[m.tipo_ui] || m.tipo_ui}</span></td>
                  <td>{fechaBonita(m.fecha)}</td>
                  <td>{numero(m.cantidad_productos)}</td>
                  <td>{numero(m.unidades)}</td>
                  <td>{m.usuario_nombre || "—"}</td>
                  <td><button className="mov-link" onClick={() => abrirDetalle(m.id_movimiento)}>Ver detalle</button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <footer className="mov-pagination">
        <span>Página {pagina} de {paginas}</span>
        <div>
          <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</button>
        </div>
      </footer>

      {modalNuevo && <div className="mov-overlay" role="presentation">
        <form className="mov-modal mov-modal-wide" onSubmit={guardarMovimiento}>
          <div className="mov-modal-head">
            <div><span className="mov-eyebrow">INVENTARIO</span><h2>Registrar movimiento</h2></div>
            <button type="button" className="mov-close" onClick={() => setModalNuevo(false)}>×</button>
          </div>
          {error && <div className="mov-alert mov-error">{error}</div>}
          <label className="mov-field">Tipo de operación
            <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <div className="mov-add-row">
            <label className="mov-field mov-grow">Producto
              <select value={productoId} onChange={(e) => setProductoId(e.target.value)} disabled={cargandoProductos}>
                <option value="">{cargandoProductos ? "Cargando productos..." : "Selecciona un producto"}</option>
                {productos.map((p) => <option key={p.id_producto ?? p.id} value={p.id_producto ?? p.id}>
                  {p.nombre} {p.codigo ? `— ${p.codigo}` : ""}
                </option>)}
              </select>
            </label>
            <label className="mov-field mov-qty">Cantidad
              <input type="number" min="1" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </label>
            <button type="button" className="mov-secondary mov-add-button" onClick={agregarProducto}>Agregar</button>
          </div>
          {productoSeleccionado && <p className="mov-stock-hint">Stock actual: {numero(productoSeleccionado.stock)}</p>}
          <div className="mov-lines">
            <div className="mov-lines-title"><strong>Productos de esta operación</strong><span>{lineas.length} agregado(s)</span></div>
            {lineas.length === 0 ? <p className="mov-empty-inline">Agrega los productos que forman parte de este movimiento.</p>
              : lineas.map((linea) => (
                <div className="mov-line" key={linea.id_producto}>
                  <div><strong>{linea.nombre}</strong><small>{linea.codigo || "Sin código"} · Stock actual: {numero(linea.stock)}</small></div>
                  <label>Cantidad <input aria-label={`Cantidad de ${linea.nombre}`} type="number" min="1" step="1" value={linea.cantidad} onChange={(e) => cambiarCantidad(linea.id_producto, e.target.value)} /></label>
                  <button type="button" className="mov-remove" onClick={() => setLineas((xs) => xs.filter((x) => x.id_producto !== linea.id_producto))}>Quitar</button>
                </div>
              ))}
          </div>
          <label className="mov-field">Observación <span className="mov-optional">(opcional)</span>
            <textarea rows="3" maxLength="900" value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Escribe el motivo o una nota de la operación..." />
          </label>
          <p className="mov-note">Al confirmar, el sistema actualizará las existencias automáticamente. Las salidas no pueden superar el stock disponible.</p>
          <div className="mov-actions">
            <button type="button" className="mov-secondary" onClick={() => setModalNuevo(false)}>Cancelar</button>
            <button type="submit" className="mov-primary" disabled={guardando || !lineas.length}>{guardando ? "Guardando..." : "Confirmar movimiento"}</button>
          </div>
        </form>
      </div>}

      {modalDetalle && detalle && <div className="mov-overlay" role="presentation">
        <div className="mov-modal">
          <div className="mov-modal-head">
            <div><span className="mov-eyebrow">HISTORIAL</span><h2>Movimiento MOV-{String(detalle.movimiento.id_movimiento).padStart(5, "0")}</h2></div>
            <button className="mov-close" onClick={() => setModalDetalle(false)}>×</button>
          </div>
          <div className="mov-detail-grid">
            <div><small>Tipo</small><strong>{ETIQUETAS[detalle.movimiento.tipo_ui] || detalle.movimiento.tipo_ui}</strong></div>
            <div><small>Fecha</small><strong>{fechaBonita(detalle.movimiento.fecha)}</strong></div>
            <div><small>Responsable</small><strong>{detalle.movimiento.usuario_nombre}</strong></div>
            <div><small>Venta asociada</small><strong>{detalle.movimiento.id_venta || "No aplica"}</strong></div>
          </div>
          <h3 className="mov-subtitle">Productos incluidos</h3>
          <div className="mov-detail-products">
            {(detalle.productos || []).map((p) => <div className="mov-detail-product" key={p.id_detalle}>
              <div><strong>{p.nombre}</strong><small>{p.codigo || "Sin código"} {p.referencia ? `· ${p.referencia}` : ""}</small></div>
              <strong>× {numero(p.cantidad)}</strong>
            </div>)}
          </div>
          {detalle.movimiento.observacion && <div className="mov-observation"><small>Observación</small><p>{detalle.movimiento.observacion.replace(/^(AVERIA|DEVOLUCION_CLIENTE|DEVOLUCION_PROVEEDOR):\s*/, "")}</p></div>}
          <div className="mov-actions"><button className="mov-secondary" onClick={() => setModalDetalle(false)}>Cerrar</button></div>
        </div>
      </div>}
    </section>
  );
}
