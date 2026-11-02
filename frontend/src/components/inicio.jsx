
import { useEffect, useState } from "react";
import "../css/inicio.css";
import { pedir } from "../api";
import { entero, pesos } from "../utils";
import Icono from "./icono";

function fechaActual() {
  return new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function hora(fecha) {
  if (!fecha) return "—";

  return new Date(fecha).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function Indicador({ icono, titulo, valor, clase, detalle }) {
  return (
    <article className={`inicio-indicador ${clase}`}>
      <span className="inicio-indicador-icono">
        <Icono nombre={icono} tamano={27} />
      </span>

      <div className="inicio-indicador-info">
        <small>{titulo}</small>
        <strong>{valor}</strong>
        {detalle && <span>{detalle}</span>}
      </div>
    </article>
  );
}

function EstadoVacio({ mensaje }) {
  return <p className="inicio-vacio">{mensaje}</p>;
}

export default function Inicio({ sesion, onSalir, onNavegar }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!sesion?.token) {
      setError("No se encontró una sesión válida.");
      setCargando(false);
      return;
    }

    const control = new AbortController();

    setCargando(true);
    setError("");

    pedir("/privado/inicio", {
      token: sesion.token,
      signal: control.signal,
    })
      .then((respuesta) => {
        setDatos(respuesta);
        setError("");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;

        if (e.estado === 401) {
          onSalir?.();
          return;
        }

        setError(e.message || "No se pudo cargar el panel de Inicio.");
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });

    return () => control.abort();
  }, [sesion?.token, onSalir, intento]);

  const resumen = datos?.resumen;

  return (
    <div className="inicio">
      <header className="inicio-cabecera">
        <div>
          <span className="inicio-etiqueta">PANEL DE CONTROL</span>
          <h1>¡Bienvenido!</h1>
          <p>Resumen general de tu óptica</p>
        </div>

        <div className="inicio-fecha">
          <Icono nombre="receta" tamano={18} />
          <span>{fechaActual()}</span>
        </div>
      </header>

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="aviso-accion"
            onClick={() => setIntento((n) => n + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      <section
        className={`inicio-indicadores ${cargando ? "cargando" : ""}`}
        aria-label="Resumen de hoy"
        aria-busy={cargando}
      >
        <Indicador
          icono="cart"
          clase="turquesa"
          titulo="Ventas de hoy"
          valor={resumen ? pesos(resumen.ventas_hoy) : "—"}
        />

        <Indicador
          icono="receta"
          clase="azul"
          titulo="Ventas realizadas"
          valor={resumen ? entero(resumen.cantidad_ventas_hoy) : "—"}
          detalle="Hoy"
        />

        <Indicador
          icono="box"
          clase="violeta"
          titulo="Unidades vendidas"
          valor={resumen ? `${entero(resumen.productos_vendidos)} uds` : "—"}
          detalle="Productos"
        />

        <Indicador
          icono="alert"
          clase="amarillo"
          titulo="Stock bajo"
          valor={
            resumen
              ? `${entero(resumen.productos_stock_bajo)} productos`
              : "—"
          }
          detalle="Requieren atención"
        />
      </section>

      <section className="inicio-atajos">
        <h2>Accesos rápidos</h2>

        <div className="inicio-atajos-grid">
          <button
            type="button"
            className="inicio-atajo"
            onClick={() => onNavegar("venta")}
          >
            <span className="inicio-atajo-icono">
              <Icono nombre="cart" tamano={25} />
            </span>
            <span className="inicio-atajo-texto">
              <strong>Nueva venta</strong>
              <small>Registrar una venta</small>
            </span>
            <Icono nombre="chevron" tamano={20} />
          </button>

          <button
            type="button"
            className="inicio-atajo"
            onClick={() => onNavegar("inventario")}
          >
            <span className="inicio-atajo-icono">
              <Icono nombre="box" tamano={25} />
            </span>
            <span className="inicio-atajo-texto">
              <strong>Inventario</strong>
              <small>Consultar productos</small>
            </span>
            <Icono nombre="chevron" tamano={20} />
          </button>

          <button
            type="button"
            className="inicio-atajo"
            onClick={() => onNavegar("producto-nuevo")}
          >
            <span className="inicio-atajo-icono">
              <Icono nombre="plus" tamano={25} />
            </span>
            <span className="inicio-atajo-texto">
              <strong>Nuevo producto</strong>
              <small>Agregar un producto</small>
            </span>
            <Icono nombre="chevron" tamano={20} />
          </button>
        </div>
      </section>

      <section className="inicio-paneles">
        <article className="panel inicio-panel">
          <header className="inicio-panel-cabecera">
            <div>
              <span className="inicio-panel-icono alerta">
                <Icono nombre="alert" tamano={20} />
              </span>
              <h2>Alertas de inventario</h2>
            </div>

            <span className="inicio-contador">
              {resumen ? entero(resumen.productos_stock_bajo) : "—"}
            </span>
          </header>

          <p className="inicio-descripcion">
            Productos que necesitan reposición.
          </p>

          <div className="inicio-lista">
            {!cargando &&
              (datos?.productos_stock_bajo || []).map((producto) => (
                <div className="inicio-fila-producto" key={producto.id_producto}>
                  <span className="inicio-producto-icono">
                    <Icono nombre="box" tamano={21} />
                  </span>

                  <div className="inicio-producto-datos">
                    <strong>{producto.codigo}</strong>
                    <span>{producto.nombre}</span>
                    <small>
                      Stock: {entero(producto.stock)} | Mínimo:{" "}
                      {entero(producto.stock_minimo)}
                    </small>
                  </div>

                  <span className="inicio-stock">
                    {entero(producto.stock)} uds
                  </span>
                </div>
              ))}

            {!cargando &&
              datos?.productos_stock_bajo?.length === 0 && (
                <EstadoVacio mensaje="¡Excelente! No hay productos con stock bajo." />
              )}

            {!datos && cargando && (
              <EstadoVacio mensaje="Cargando alertas de inventario..." />
            )}
          </div>

          <button
            type="button"
            className="inicio-ver-mas"
            onClick={() => onNavegar("inventario")}
          >
            Ver inventario completo
            <Icono nombre="swap" tamano={17} />
          </button>
        </article>

        <article className="panel inicio-panel">
          <header className="inicio-panel-cabecera">
            <div>
              <span className="inicio-panel-icono ventas">
                <Icono nombre="cart" tamano={20} />
              </span>
              <h2>Últimas ventas</h2>
            </div>
          </header>

          <p className="inicio-descripcion">
            Ventas registradas recientemente.
          </p>

          <div className="inicio-lista">
            {!cargando &&
              (datos?.ultimas_ventas || []).map((venta) => (
                <div className="inicio-fila-venta" key={venta.id_venta}>
                  <span className="inicio-cliente-icono">
                    <Icono nombre="users" tamano={20} />
                  </span>

                  <div className="inicio-venta-datos">
                    <strong>{venta.cliente || "Cliente general"}</strong>
                    <small>
                      Venta #{venta.id_venta} · {venta.modalidad || "—"}
                    </small>
                    <small>{hora(venta.fecha)}</small>
                  </div>

                  <strong className="inicio-venta-total">
                    {pesos(venta.total)}
                  </strong>
                </div>
              ))}

            {!cargando && datos?.ultimas_ventas?.length === 0 && (
              <EstadoVacio mensaje="Todavía no hay ventas registradas." />
            )}

            {!datos && cargando && (
              <EstadoVacio mensaje="Cargando últimas ventas..." />
            )}
          </div>

          <button
            type="button"
            className="inicio-ver-mas"
            onClick={() => onNavegar("venta")}
          >
            Ir a registrar ventas
            <Icono nombre="swap" tamano={17} />
          </button>
        </article>

        <article className="panel inicio-panel">
          <header className="inicio-panel-cabecera">
            <div>
              <span className="inicio-panel-icono movimientos">
                <Icono nombre="swap" tamano={20} />
              </span>
              <h2>Movimientos recientes</h2>
            </div>
          </header>

          <p className="inicio-descripcion">
            Últimos registros de inventario.
          </p>

          <div className="inicio-lista">
            {!cargando &&
              (datos?.movimientos_recientes || []).map((movimiento) => (
                <div
                  className="inicio-fila-movimiento"
                  key={movimiento.id_movimiento}
                >
                  <span
                    className={`inicio-movimiento-icono ${String(
                      movimiento.tipo
                    ).toLowerCase()}`}
                  >
                    <Icono nombre="swap" tamano={20} />
                  </span>

                  <div className="inicio-movimiento-datos">
                    <strong>{movimiento.tipo}</strong>
                    <small>
                      {movimiento.observacion || "Movimiento de inventario"}
                    </small>
                    <small>
                      {entero(movimiento.unidades)} unidades ·{" "}
                      {movimiento.usuario || "Usuario"}
                    </small>
                  </div>

                  <time>{hora(movimiento.fecha)}</time>
                </div>
              ))}

            {!cargando && datos?.movimientos_recientes?.length === 0 && (
              <EstadoVacio mensaje="Todavía no hay movimientos registrados." />
            )}

            {!datos && cargando && (
              <EstadoVacio mensaje="Cargando movimientos..." />
            )}
          </div>

          <button
            type="button"
            className="inicio-ver-mas"
            onClick={() => onNavegar("movimientos")}
          >
            Ver movimientos
            <Icono nombre="swap" tamano={17} />
          </button>
        </article>
      </section>
    </div>
  );
}
