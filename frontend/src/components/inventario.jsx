import { useEffect, useRef, useState } from "react";
import "../css/inventario.css";
import { pedir } from "../api";
import { entero, pesos } from "../utils";
import Icono from "./icono";

const FILTROS_TIPO = [
  { valor: "", texto: "Todos los tipos" },
  { valor: "LENTE", texto: "Lente" },
  { valor: "MONTURA", texto: "Montura" },
  { valor: "ACCESORIO", texto: "Accesorio" },
  { valor: "SERVICIO", texto: "Servicio" },
];

const TEXTO_TIPO = {
  LENTE: "Lente",
  MONTURA: "Montura",
  ACCESORIO: "Accesorio",
  OTRO: "Otro",
  SERVICIO: "Servicio",
};

const ESTADOS = {
  DISPONIBLE: { texto: "Disponible", clase: "ok" },
  STOCK_BAJO: { texto: "Stock bajo", clase: "bajo" },
  AGOTADO: { texto: "Agotado", clase: "agotado" },
};

const POR_PAGINA = 15;
const RETRASO_BUSQUEDA_MS = 300;

function Indicador({ icono, clase, titulo, valor, detalle }) {
  return (
    <div className="inv-kpi">
      <span className={`inv-kpi-icono ${clase}`}>
        <Icono nombre={icono} tamano={22} />
      </span>

      <div>
        <small>{titulo}</small>
        <strong>{entero(valor)}</strong>
        <em>{detalle}</em>
      </div>
    </div>
  );
}

const vacio = (valor) =>
  valor || <span className="sin-dato">—</span>;

export default function Inventario({
  sesion,
  onSalir,
  onNuevo,
  aviso,
  onCerrarAviso,
  foco,
}) {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  const [productoEditar, setProductoEditar] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState("");
  const [exitoEdicion, setExitoEdicion] = useState("");

  const buscador = useRef(null);
  const enviada = useRef("");

  useEffect(() => {
    if (foco) buscador.current?.focus();
  }, [foco]);

  useEffect(() => {
    const limpio = texto.trim();

    const espera = setTimeout(() => {
      if (enviada.current === limpio) return;

      enviada.current = limpio;
      setCargando(true);
      setPagina(1);
      setBusqueda(limpio);
    }, RETRASO_BUSQUEDA_MS);

    return () => clearTimeout(espera);
  }, [texto]);

  useEffect(() => {
    const control = new AbortController();

    const params = new URLSearchParams({
      pagina: String(pagina),
      limite: String(POR_PAGINA),
    });

    if (busqueda) params.set("q", busqueda);
    if (tipo) params.set("tipo", tipo);

    pedir(`/privado/inventario?${params}`, {
      token: sesion.token,
      signal: control.signal,
    })
      .then((d) => {
        setDatos(d);
        setError("");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.estado === 401) return onSalir();
        setError(e.message);
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });

    return () => control.abort();
  }, [busqueda, tipo, pagina, intento, sesion.token, onSalir]);

  function limpiarFiltros() {
    enviada.current = "";
    setTexto("");
    setBusqueda("");
    setTipo("");
    setPagina(1);
    setCargando(true);
    buscador.current?.focus();
  }

  function abrirEdicion(p) {
    if (p.tipo === "SERVICIO") return;

    setProductoEditar({
      id: p.id,
      codigo: p.codigo || "",
      nombre: p.nombre || "",
      tipo_producto: p.tipo || "LENTE",
      referencia: p.referencia || "",
      stock: String(p.stock ?? 0),
      precio_compra: String(p.costo ?? 0),
      precio_venta: String(p.precio ?? 0),
    });

    setErrorEdicion("");
    setExitoEdicion("");
  }

  async function guardarEdicion(e) {
    e.preventDefault();

    if (!productoEditar || guardandoEdicion) return;

    const stock = Number(productoEditar.stock);
    const precioCompra = Number(productoEditar.precio_compra);
    const precioVenta = Number(productoEditar.precio_venta);

    if (
      !productoEditar.codigo.trim() ||
      !productoEditar.nombre.trim() ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      !Number.isFinite(precioCompra) ||
      precioCompra < 0 ||
      !Number.isFinite(precioVenta) ||
      precioVenta < 0
    ) {
      setErrorEdicion(
        "Revisa el código, el nombre, el stock y los precios."
      );
      return;
    }

    setGuardandoEdicion(true);
    setErrorEdicion("");
    setExitoEdicion("");

    try {
      // IMPORTANTE: api.js utiliza "metodo" y "cuerpo".
      await pedir(`/privado/inventario/${productoEditar.id}`, {
        token: sesion.token,
        metodo: "PUT",
        cuerpo: {
          codigo: productoEditar.codigo.trim(),
          nombre: productoEditar.nombre.trim(),
          tipo_producto: productoEditar.tipo_producto,
          referencia: productoEditar.referencia.trim() || null,
          stock,
          precio_compra: precioCompra,
          precio_venta: precioVenta,
        },
      });

      setProductoEditar(null);
      setExitoEdicion("Producto actualizado correctamente.");
      setCargando(true);
      setIntento((n) => n + 1);
    } catch (e) {
      if (e.estado === 401) {
        onSalir();
        return;
      }

      setErrorEdicion(
        e.message || "No se pudo actualizar el producto."
      );
    } finally {
      setGuardandoEdicion(false);
    }
  }

  const kpis = datos?.kpis;
  const filas = datos?.productos ?? [];
  const pag = datos?.paginacion;
  const hayFiltros = Boolean(busqueda || tipo);

  const desde =
    pag && pag.total > 0
      ? (pag.pagina - 1) * pag.limite + 1
      : 0;

  const hasta = pag
    ? Math.min(pag.pagina * pag.limite, pag.total)
    : 0;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Inventario de productos</h1>
          <p>Vista general del stock disponible</p>
        </div>

        <button
          type="button"
          className="btn btn-primario"
          onClick={onNuevo}
        >
          <Icono nombre="plus" tamano={16} />
          Nuevo producto
        </button>
      </header>

      {aviso && (
        <div className="aviso aviso-exito" role="status">
          <span>{aviso}</span>
          <button
            type="button"
            className="aviso-cerrar"
            onClick={onCerrarAviso}
            aria-label="Cerrar aviso"
          >
            <Icono nombre="close" tamano={16} />
          </button>
        </div>
      )}

      {exitoEdicion && (
        <div className="aviso aviso-exito" role="status">
          <span>{exitoEdicion}</span>
          <button
            type="button"
            className="aviso-cerrar"
            onClick={() => setExitoEdicion("")}
            aria-label="Cerrar aviso"
          >
            <Icono nombre="close" tamano={16} />
          </button>
        </div>
      )}

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="aviso-accion"
            onClick={() => {
              setError("");
              setCargando(true);
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      <section
        className="inv-kpis"
        aria-label="Resumen del inventario"
      >
        <Indicador
          icono="box"
          clase="tono-azul"
          titulo="Total productos"
          valor={kpis?.total}
          detalle="SKUs registrados"
        />
        <Indicador
          icono="check"
          clase="tono-verde"
          titulo="Disponibles"
          valor={kpis?.disponibles}
          detalle="Con stock suficiente"
        />
        <Indicador
          icono="alert"
          clase="tono-ambar"
          titulo="Stock bajo"
          valor={kpis?.stock_bajo}
          detalle="Requieren reposición"
        />
        <Indicador
          icono="layers"
          clase="tono-violeta"
          titulo="Unidades totales"
          valor={kpis?.unidades}
          detalle="En inventario"
        />
      </section>

      <section className="panel inv-panel">
        <div className="inv-barra">
          <h2>Lista de productos</h2>

          <div className="inv-filtros">
            <div className="inv-buscador">
              <Icono nombre="search" tamano={16} />

              <input
                ref={buscador}
                type="text"
                value={texto}
                placeholder="Buscar por nombre, código, referencia o laboratorio"
                aria-label="Buscar producto"
                autoComplete="off"
                maxLength={100}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setTexto("");
                }}
              />

              {texto && (
                <button
                  type="button"
                  className="inv-buscador-limpiar"
                  aria-label="Borrar búsqueda"
                  onClick={() => {
                    setTexto("");
                    buscador.current?.focus();
                  }}
                >
                  <Icono nombre="close" tamano={14} />
                </button>
              )}
            </div>

            <select
              aria-label="Filtrar por tipo"
              value={tipo}
              onChange={(e) => {
                setCargando(true);
                setPagina(1);
                setTipo(e.target.value);
              }}
            >
              {FILTROS_TIPO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.texto}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p
          className="inv-conteo"
          role="status"
          aria-live="polite"
        >
          {!pag
            ? "Cargando inventario…"
            : pag.total === 0
              ? "Sin resultados"
              : `Mostrando ${desde}–${hasta} de ${entero(pag.total)}${
                  busqueda ? ` para «${busqueda}»` : ""
                }`}
        </p>

        <div
          className={`inv-tabla-caja ${cargando ? "cargando" : ""}`}
          aria-busy={cargando}
        >
          <table className="inv-tabla">
            <caption className="sr-only">
              Lista de productos del inventario
            </caption>

            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Producto</th>
                <th scope="col">Tipo</th>
                <th scope="col">Categoría</th>
                <th scope="col">Referencia</th>
                <th scope="col">Laboratorio</th>
                <th scope="col" className="num">Stock</th>
                <th scope="col" className="num">Costo</th>
                <th scope="col" className="num">Precio venta</th>
                <th scope="col">Estado</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {filas.map((p) => {
                const estado =
                  ESTADOS[p.estado] || ESTADOS.DISPONIBLE;

                return (
                  <tr
                    key={p.id}
                    className={
                      p.estado === "DISPONIBLE"
                        ? undefined
                        : `fila-${estado.clase}`
                    }
                  >
                    <td className="codigo">
                      {vacio(p.codigo)}
                    </td>
                    <td className="producto">{p.nombre}</td>
                    <td>{TEXTO_TIPO[p.tipo] || p.tipo}</td>
                    <td>{vacio(p.categoria)}</td>
                    <td>{vacio(p.referencia)}</td>
                    <td>{vacio(p.laboratorio)}</td>
                    <td className={`num stock ${estado.clase}`}>
                      {p.stock === null ? (
                        <span className="sin-dato">—</span>
                      ) : (
                        p.stock
                      )}
                    </td>
                    <td className="num">{pesos(p.costo)}</td>
                    <td className="num precio">
                      {pesos(p.precio)}
                    </td>
                    <td>
                      <span className={`pill ${estado.clase}`}>
                        {estado.texto}
                      </span>
                    </td>
                    <td>
                      {p.tipo !== "SERVICIO" && (
                        <button
                          type="button"
                          className="btn btn-secundario inv-btn-editar"
                          onClick={() => abrirEdicion(p)}
                          aria-label={`Editar ${p.nombre}`}
                        >
                          <Icono nombre="edit" tamano={15} />
                          Editar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {datos && filas.length === 0 && (
            <div className="inv-vacio">
              {hayFiltros ? (
                tipo === "SERVICIO" && !busqueda ? (
                  <p>Todavía no hay servicios registrados.</p>
                ) : (
                  <>
                    <p>
                      No encontramos productos
                      {busqueda ? ` para «${busqueda}»` : ""}
                      {tipo
                        ? ` en el tipo ${(
                            TEXTO_TIPO[tipo] || tipo
                          ).toLowerCase()}`
                        : ""}.
                    </p>

                    <button
                      type="button"
                      className="btn btn-secundario"
                      onClick={limpiarFiltros}
                    >
                      Limpiar búsqueda y filtros
                    </button>
                  </>
                )
              ) : (
                <>
                  <p>
                    Tu inventario está vacío. Registra el primer
                    producto para empezar.
                  </p>

                  <button
                    type="button"
                    className="btn btn-primario"
                    onClick={onNuevo}
                  >
                    <Icono nombre="plus" tamano={16} />
                    Registrar producto
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {pag && pag.paginas > 1 && (
          <nav className="inv-paginas" aria-label="Paginación">
            <button
              type="button"
              className="btn btn-secundario"
              disabled={pag.pagina <= 1}
              onClick={() => {
                setCargando(true);
                setPagina((n) => n - 1);
              }}
            >
              Anterior
            </button>

            <span>
              Página {pag.pagina} de {pag.paginas}
            </span>

            <button
              type="button"
              className="btn btn-secundario"
              disabled={pag.pagina >= pag.paginas}
              onClick={() => {
                setCargando(true);
                setPagina((n) => n + 1);
              }}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>

      {productoEditar && (
        <div
          className="inv-modal-fondo"
          onMouseDown={(e) => {
            if (
              e.target === e.currentTarget &&
              !guardandoEdicion
            ) {
              setProductoEditar(null);
            }
          }}
        >
          <section
            className="inv-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-editar-producto"
          >
            <div className="inv-modal-cabecera">
              <div>
                <h2 id="titulo-editar-producto">
                  Editar producto
                </h2>
                <p>
                  Modifica la información y guarda los cambios.
                </p>
              </div>

              <button
                type="button"
                className="inv-modal-cerrar"
                onClick={() => setProductoEditar(null)}
                disabled={guardandoEdicion}
                aria-label="Cerrar ventana"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarEdicion}>
              <div className="inv-modal-campos">
                <label>
                  Código
                  <input
                    required
                    maxLength={60}
                    value={productoEditar.codigo}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        codigo: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Nombre del producto
                  <input
                    required
                    maxLength={200}
                    value={productoEditar.nombre}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        nombre: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Tipo de producto
                  <select
                    required
                    value={productoEditar.tipo_producto}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        tipo_producto: e.target.value,
                      })
                    }
                  >
                    <option value="LENTE">Lente</option>
                    <option value="MONTURA">Montura</option>
                    <option value="ACCESORIO">Accesorio</option>
                  </select>
                </label>

                <label>
                  Referencia
                  <input
                    maxLength={100}
                    value={productoEditar.referencia}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        referencia: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Stock
                  <input
                    required
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    value={productoEditar.stock}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        stock: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Precio de compra
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={productoEditar.precio_compra}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        precio_compra: e.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Precio de venta
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={productoEditar.precio_venta}
                    onChange={(e) =>
                      setProductoEditar({
                        ...productoEditar,
                        precio_venta: e.target.value,
                      })
                    }
                  />
                </label>
              </div>

              {errorEdicion && (
                <div className="aviso aviso-error" role="alert">
                  {errorEdicion}
                </div>
              )}

              <div className="inv-modal-acciones">
                <button
                  type="button"
                  className="btn btn-secundario"
                  disabled={guardandoEdicion}
                  onClick={() => setProductoEditar(null)}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primario"
                  disabled={guardandoEdicion}
                >
                  {guardandoEdicion
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
