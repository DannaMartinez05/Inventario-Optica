import { useEffect, useState } from "react";
import { pedir } from "../api";
import {
  MESES,
  MESES_CORTOS,
  millones,
  pesos,
  entero,
} from "../utils";

/* ---------- Tarjeta de indicador ---------- */
function Tarjeta({ titulo, valor, color }) {
  return (
    <div className="kpi">
      <span
        className="kpi-punto"
        style={{ background: color }}
      />
      <div>
        <small>{titulo}</small>
        <strong>{valor}</strong>
      </div>
    </div>
  );
}

const porcentaje = (valor, maximo) =>
  maximo > 0 ? (valor / maximo) * 100 : 0;

/* ---------- BALANCE MENSUAL ---------- */
export default function Balance({ sesion, onSalir }) {
  const hoy = new Date();
  const anio = hoy.getFullYear();

  const [mes, setMes] = useState(hoy.getMonth());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    // Evita acceder a sesion.token si no hay sesión.
    if (!sesion?.token) {
      setError("No se encontró una sesión válida. Inicia sesión nuevamente.");
      setCargando(false);
      return;
    }

    const control = new AbortController();
    const clave = `${anio}-${String(mes + 1).padStart(2, "0")}`;

    setCargando(true);
    setError("");

    pedir(`/privado/balance?mes=${clave}`, {
      token: sesion.token,
      signal: control.signal,
    })
      .then((d) => {
        setDatos(d);
        setError("");
      })
      .catch((e) => {
        if (e.name === "AbortError") return;

        if (e.estado === 401) {
          onSalir?.();
          return;
        }

        setError(e.message || "No se pudo cargar el balance.");
      })
      .finally(() => {
        if (!control.signal.aborted) {
          setCargando(false);
        }
      });

    return () => control.abort();
  }, [anio, mes, intento, sesion?.token, onSalir]);

  const fecha = hoy.toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const b = datos;

  const barras = b
    ? [
        { texto: "Ventas", valor: b.ventas, clase: "azul" },
        { texto: "Ganancias", valor: b.ganancias, clase: "verde" },
        { texto: "Recibido", valor: b.recibido, clase: "violeta" },
        { texto: "Pendiente", valor: b.pendiente, clase: "naranja" },
        { texto: "Gastos", valor: b.gastos, clase: "rojo" },
      ]
    : [];

  const maximo = barras.length
    ? Math.max(...barras.map((x) => Number(x.valor) || 0))
    : 0;

  const maxTendencia =
    b?.tendencia?.length
      ? Math.max(...b.tendencia.map((t) => Number(t.ventas) || 0))
      : 0;

  return (
    <>
      <div className="dash-fecha">{fecha}</div>

      <header className="dash-header">
        <div>
          <h1>Balance mensual</h1>
          <p>Resumen financiero consolidado</p>
        </div>

        <div className="dash-acciones">
          <select
            aria-label="Mes del balance"
            value={mes}
            onChange={(e) => {
              setCargando(true);
              setMes(Number(e.target.value));
            }}
          >
            {MESES.map((m, i) => (
              <option key={m} value={i}>
                {m} {anio}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => window.print()}>
            Exportar PDF
          </button>
        </div>
      </header>

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>

          <button
            type="button"
            className="aviso-accion"
            onClick={() => {
              if (!sesion?.token) {
                onSalir?.();
                return;
              }

              setError("");
              setCargando(true);
              setIntento((n) => n + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      )}

      {!b && cargando && (
        <p className="estado-carga">Cargando balance…</p>
      )}

      {b && (
        <div
          aria-busy={cargando}
          className={cargando ? "cargando" : undefined}
        >
          {!b.hayDatos && (
            <div className="aviso aviso-info" role="status">
              <span>
                Aún no hay ventas ni gastos en {MESES[mes]} {anio}.
                Cuando los registres, el balance se llenará aquí.
              </span>
            </div>
          )}

          <section className="kpis">
            <Tarjeta
              titulo="Total de ventas"
              valor={millones(b.ventas)}
              color="#1f9d6b"
            />

            <Tarjeta
              titulo="Total de ganancias"
              valor={millones(b.ganancias)}
              color="#3b82f6"
            />

            <Tarjeta
              titulo="Productos vendidos"
              valor={`${entero(b.productos)} uds`}
              color="#e58a3c"
            />

            <Tarjeta
              titulo="Dinero recibido"
              valor={millones(b.recibido)}
              color="#16a34a"
            />

            <Tarjeta
              titulo="Dinero pendiente"
              valor={millones(b.pendiente)}
              color="#d4a017"
            />

            <Tarjeta
              titulo="Total de gastos"
              valor={millones(b.gastos)}
              color="#ef4444"
            />
          </section>

          <section className="dash-grid">
            <div className="panel">
              <h2>
                Comparativo gráfico — {MESES[mes]} {anio}
              </h2>

              <div className="barras">
                {barras.map((x) => (
                  <div className="barra-fila" key={x.texto}>
                    <span>{x.texto}</span>

                    <div className="barra-pista">
                      <div
                        className={`barra-relleno ${x.clase}`}
                        style={{
                          width: `${porcentaje(
                            Number(x.valor) || 0,
                            maximo
                          )}%`,
                        }}
                      >
                        {millones(x.valor)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3>Tendencia de ventas — últimos 6 meses</h3>

              <div className="tendencia">
                {(b.tendencia || []).map((t) => (
                  <div className="tendencia-col" key={t.mes}>
                    <div className="tendencia-barras">
                      <i
                        className="azul"
                        title={`Ventas: ${pesos(t.ventas)}`}
                        style={{
                          height: `${porcentaje(
                            Number(t.ventas) || 0,
                            maxTendencia
                          )}%`,
                        }}
                      />

                      <i
                        className="verde"
                        title={`Ganancias: ${pesos(t.ganancias)}`}
                        style={{
                          height: `${porcentaje(
                            Number(t.ganancias) || 0,
                            maxTendencia
                          )}%`,
                        }}
                      />
                    </div>

                    <span>
                      {MESES_CORTOS[t.mes - 1]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="leyenda">
                <span>
                  <i className="azul" /> Ventas
                </span>

                <span>
                  <i className="verde" /> Ganancias
                </span>
              </div>
            </div>

            <aside className="panel">
              <h2>Resumen ejecutivo</h2>

              <dl className="resumen">
                <div>
                  <dt>Ventas contado</dt>
                  <dd className="c-verde">{millones(b.contado)}</dd>
                </div>

                <div>
                  <dt>Ventas crédito</dt>
                  <dd className="c-naranja">{millones(b.credito)}</dd>
                </div>

                <div>
                  <dt>Mayor venta</dt>
                  <dd>{pesos(b.mayorVenta)}</dd>
                </div>

                <div>
                  <dt>Clientes atendidos</dt>
                  <dd className="c-violeta">{entero(b.clientes)}</dd>
                </div>

                <div>
                  <dt>Ticket promedio</dt>
                  <dd className="c-violeta">{pesos(b.ticketPromedio)}</dd>
                </div>

                <div>
                  <dt>Costo mercancía</dt>
                  <dd className="c-rojo">{millones(b.costoMercancia)}</dd>
                </div>

                <div>
                  <dt>Margen promedio</dt>
                  <dd className="c-verde">{b.margen}%</dd>
                </div>
              </dl>

              <div className="balance-neto">
                <small>BALANCE NETO DEL MES</small>

                <strong>{millones(b.gananciaNeta)}</strong>

                {b.variacion === null ? (
                  <span className="neutro">
                    Sin datos del mes anterior para comparar
                  </span>
                ) : (
                  <span className={b.variacion < 0 ? "baja" : undefined}>
                    {b.variacion < 0 ? "↓" : "↑"}{" "}
                    {Math.abs(b.variacion)}% vs. mes anterior
                  </span>
                )}
              </div>
            </aside>
          </section>
        </div>
      )}
    </>
  );
}
