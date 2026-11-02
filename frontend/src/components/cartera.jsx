
import { useEffect, useRef, useState } from "react";
import "../css/pantallas.css";
import { pedir } from "../api";
import { entero, fechaCorta, millones, pesos } from "../utils";
import Icono from "./icono";

const FILTROS_ESTADO = [
  { valor: "", texto: "Todos los estados" },
  { valor: "PENDIENTE", texto: "Pendiente" },
  { valor: "AL_DIA", texto: "Al día" },
  { valor: "PAGADO", texto: "Pagado" },
];

const ESTADOS = {
  PENDIENTE: { texto: "Pendiente", clase: "agotado" },
  AL_DIA: { texto: "Al día", clase: "info" },
  PAGADO: { texto: "Pagado", clase: "ok" },
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
        <strong>{valor}</strong>
        <em>{detalle}</em>
      </div>
    </div>
  );
}

export default function Cartera({ sesion, onSalir }) {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  const enviada = useRef("");

  // Esperar antes de ejecutar la búsqueda.
  useEffect(() => {
    const limpio = texto.trim();

    const espera = setTimeout(() => {
      if (enviada.current === limpio) return;

      enviada.current = limpio;
      setPagina(1);
      setBusqueda(limpio);
      setCargando(true);
    }, RETRASO_BUSQUEDA_MS);

    return () => clearTimeout(espera);
  }, [texto]);

  // Consultar la cartera al cambiar los filtros o la página.
  useEffect(() => {
    const control = new AbortController();

    const params = new URLSearchParams({
      pagina: String(pagina),
      limite: String(POR_PAGINA),
    });

    if (busqueda) params.set("q", busqueda);
    if (estado) params.set("estado", estado);

    setCargando(true);
    setError("");

    pedir(`/privado/cartera?${params.toString()}`, {
      token: sesion.token,
      signal: control.signal,
    })
      .then((respuesta) => {
        setDatos(respuesta);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;

        if (e.estado === 401 || e.estado === 403) {
          onSalir();
          return;
        }

        setError(e.message || "No fue posible cargar la cartera.");
      })
      .finally(() => {
        if (!control.signal.aborted) {
          setCargando(false);
        }
      });

    return () => control.abort();
  }, [busqueda, estado, pagina, intento, sesion.token, onSalir]);

  // Restablecer búsqueda, filtros y paginación.
  function limpiarFiltros() {
    enviada.current = "";
    setTexto("");
    setBusqueda("");
    setEstado("");
    setPagina(1);
    setCargando(true);
  }

  function reintentar() {
    setError("");
    setCargando(true);
    setIntento((anterior) => anterior + 1);
  }

  const k = datos?.kpis;
  const filas = datos?.creditos ?? [];
  const pag = datos?.paginacion;
  const hayFiltros = Boolean(busqueda || estado);

  const mes = new Date()
    .toLocaleDateString("es-CO", { month: "short" })
    .replace(".", "");

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Cartera de clientes</h1>
          <p>Seguimiento de créditos y saldos pendientes</p>
        </div>
      </header>

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            className="aviso-accion"
            onClick={reintentar}
          >
            Reintentar
          </button>
        </div>
      )}

      <section className="inv-kpis" aria-label="Resumen de la cartera">
        <Indicador
          icono="wallet"
          clase="tono-azul"
          titulo="Total cartera"
          valor={millones(k?.totalCartera ?? 0)}
          detalle="Valor total créditos"
        />

        <Indicador
          icono="users"
          clase="tono-ambar"
          titulo="Clientes activos"
          valor={entero(k?.clientesActivos ?? 0)}
          detalle="Con saldo pendiente"
        />

        <Indicador
          icono="check"
          clase="tono-verde"
          titulo={`Pagos recibidos (${mes})`}
          valor={millones(k?.pagosMes ?? 0)}
          detalle="Mes en curso"
        />

        <Indicador
          icono="alert"
          clase="tono-rojo"
          titulo="Saldo pendiente"
          valor={millones(k?.saldoPendiente ?? 0)}
          detalle="Por recuperar"
        />
      </section>

      <section className="panel inv-panel">
        <div className="inv-barra">
          <h2>Detalle de cartera</h2>

          <div className="inv-filtros">
            <div className="inv-buscador">
              <Icono nombre="search" tamano={16} />

              <input
                type="text"
                value={texto}
                placeholder="Buscar cliente"
                aria-label="Buscar cliente"
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
                  onClick={() => setTexto("")}
                >
                  <Icono nombre="close" tamano={14} />
                </button>
              )}
            </div>

            <select
              aria-label="Filtrar por estado"
              value={estado}
              onChange={(e) => {
                setCargando(true);
                setPagina(1);
                setEstado(e.target.value);
              }}
            >
              {FILTROS_ESTADO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.texto}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="inv-conteo" role="status" aria-live="polite">
          {!pag
            ? "Cargando cartera…"
            : pag.total === 0
            ? "Sin resultados"
            : `${entero(pag.total)} ${
                pag.total === 1 ? "crédito" : "créditos"
              }`}
        </p>

        <div
          className={`inv-tabla-caja ${cargando ? "cargando" : ""}`}
          aria-busy={cargando}
        >
          <table className="inv-tabla">
            <caption className="sr-only">Detalle de cartera</caption>

            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Venta</th>
                <th scope="col">Fecha</th>
                <th scope="col" className="num">Valor total</th>
                <th scope="col" className="num">Total pagado</th>
                <th scope="col" className="num">Saldo pendiente</th>
                <th scope="col" className="num">Cuotas</th>
                <th scope="col">Próximo pago</th>
                <th scope="col">Estado</th>
              </tr>
            </thead>

            <tbody>
              {filas.map((credito) => {
                const estadoCredito = ESTADOS[credito.estado] ?? {
                  texto: credito.estado || "Sin estado",
                  clase: "info",
                };

                return (
                  <tr key={credito.idVenta}>
                    <td className="producto">{credito.cliente}</td>
                    <td className="codigo">{credito.venta}</td>
                    <td>{fechaCorta(credito.fecha)}</td>
                    <td className="num">{pesos(credito.total)}</td>
                    <td className="num c-verde">
                      {pesos(credito.pagado)}
                    </td>
                    <td
                      className={`num ${
                        credito.saldo > 0 ? "c-rojo" : "c-verde"
                      }`}
                    >
                      {pesos(credito.saldo)}
                    </td>
                    <td className="num">{credito.cuotas}</td>
                    <td>
                      {credito.proximoPago
                        ? fechaCorta(credito.proximoPago)
                        : <span className="sin-dato">—</span>}
                    </td>
                    <td>
                      <span className={`pill ${estadoCredito.clase}`}>
                        {estadoCredito.texto}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {datos && filas.length === 0 && !cargando && (
            <div className="inv-vacio">
              {hayFiltros ? (
                <>
                  <p>
                    No hay créditos que coincidan con tu búsqueda.
                  </p>

                  <button
                    type="button"
                    className="btn btn-secundario"
                    onClick={limpiarFiltros}
                  >
                    Limpiar búsqueda y filtros
                  </button>
                </>
              ) : (
                <p>
                  Aún no hay ventas a crédito. Cuando registres una,
                  aparecerá aquí con su saldo y sus cuotas.
                </p>
              )}
            </div>
          )}
        </div>

        {pag && pag.paginas > 1 && (
          <nav className="inv-paginas" aria-label="Paginación">
            <button
              type="button"
              className="btn btn-secundario"
              disabled={pag.pagina <= 1 || cargando}
              onClick={() => setPagina((anterior) => anterior - 1)}
            >
              Anterior
            </button>

            <span>
              Página {pag.pagina} de {pag.paginas}
            </span>

            <button
              type="button"
              className="btn btn-secundario"
              disabled={pag.pagina >= pag.paginas || cargando}
              onClick={() => setPagina((anterior) => anterior + 1)}
            >
              Siguiente
            </button>
          </nav>
        )}
      </section>
    </>
  );
}
