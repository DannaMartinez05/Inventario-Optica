import { useEffect, useState } from "react";
import "../css/pantallas.css";
import { pedir } from "../api";
import { MESES, entero, millones, pesos } from "../utils";
import Icono from "./icono";
import * as XLSX from "xlsx";

function Indicador({ icono, clase, titulo, valor, detalle }) {
  return (
    <div className="inv-kpi">
      <span className={`inv-kpi-icono ${clase}`}><Icono nombre={icono} tamano={22} /></span>
      <div>
        <small>{titulo}</small>
        <strong>{valor}</strong>
        <em>{detalle}</em>
      </div>
    </div>
  );
}

// Evita que Excel interprete un nombre como fórmula.
const celda = (v) => {
  const t = String(v ?? "");
  return `"${(/^[=+\-@]/.test(t) ? `'${t}` : t).replace(/"/g, '""')}"`;
};

function exportarExcel(filas, clave) {
  const datosExcel = filas.map((f) => ({
    "Producto / Servicio": f.nombre,
    "Unidades": f.unidades ?? 0,
    "Costo": Number(f.costo) || 0,
    "Precio de venta": Number(f.precio) || 0,
    "Ganancia": Number(f.ganancia) || 0,
    "Margen (%)": f.margen ?? "Sin dato",
  }));

  const hoja = XLSX.utils.json_to_sheet(datosExcel);

  hoja["!cols"] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 15 },
  ];

  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    libro,
    hoja,
    "Costos y ganancias"
  );

  XLSX.writeFile(
    libro,
    `Costos-y-ganancias-${clave}.xlsx`
  );
}

const claseMargen = (m) => (m === null ? "" : m < 0 ? "agotado" : m >= 150 ? "ok" : "info");

/* ------------------------------------------------------------------
   COSTOS Y GANANCIAS — rentabilidad real del mes (GET /api/privado/costos)
------------------------------------------------------------------- */
export default function Costos({ sesion, onSalir }) {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const [mes, setMes] = useState(hoy.getMonth());
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  const clave = `${anio}-${String(mes + 1).padStart(2, "0")}`;

  useEffect(() => {
    const control = new AbortController();

    pedir(`/privado/costos?mes=${clave}`, { token: sesion.token, signal: control.signal })
      .then((d) => { setDatos(d); setError(""); })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.estado === 401) return onSalir();
        setError(e.message);
      })
      .finally(() => { if (!control.signal.aborted) setCargando(false); });

    return () => control.abort();
  }, [clave, intento, sesion.token, onSalir]);

  const k = datos?.kpis;
  const filas = datos?.filas ?? [];
  const d = datos?.destacados;
  const maxGanancia = Math.max(0, ...filas.map((f) => f.ganancia));
  const etiquetaMes = `${MESES[mes].toLowerCase()} ${anio}`;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Costos y ganancias</h1>
          <p>Análisis de rentabilidad por producto — {etiquetaMes}</p>
        </div>
      </header>

      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
          <button type="button" className="aviso-accion" onClick={() => { setError(""); setCargando(true); setIntento((n) => n + 1); }}>
            Reintentar
          </button>
        </div>
      )}

      <section className="costos-kpis" aria-label="Resumen del mes">
        <Indicador icono="cart" clase="tono-azul" titulo="Ventas totales" valor={millones(k?.ventas ?? 0)} detalle={`${MESES[mes].slice(0, 3)} ${anio}`} />
        <Indicador icono="box" clase="tono-rojo" titulo="Costos totales" valor={millones(k?.costos ?? 0)} detalle="Costo de mercancía" />
        <Indicador icono="chart" clase="tono-verde" titulo="Ganancia bruta" valor={millones(k?.ganancia ?? 0)} detalle={`Margen promedio: ${k?.margen ?? 0}%`} />
      </section>

      <section className="panel inv-panel">
        <div className="inv-barra">
          <h2>Rentabilidad por producto/servicio</h2>
          <div className="inv-filtros">
            <select aria-label="Mes del análisis" value={mes}
              onChange={(e) => { setCargando(true); setMes(Number(e.target.value)); }}>
              {MESES.map((m, i) => <option key={m} value={i}>{m} {anio}</option>)}
            </select>
            <button  type="button"
              className="btn btn-secundario"
              disabled={filas.length === 0}
              title={filas.length === 0 ? "No hay datos para exportar" : undefined}
              onClick={() => exportarExcel(filas, clave)}
            >
              <Icono nombre="download" tamano={16} />
              Exportar Excel
             </button>
          </div>
        </div>

        <div className={`inv-tabla-caja ${cargando ? "cargando" : ""}`} aria-busy={cargando}>
          <table className="inv-tabla">
            <caption className="sr-only">Rentabilidad por producto o servicio en {etiquetaMes}</caption>
            <thead>
              <tr>
                <th scope="col">Producto / Servicio</th>
                <th scope="col" className="num">Costo</th>
                <th scope="col" className="num">Precio de venta</th>
                <th scope="col" className="num">Ganancia</th>
                <th scope="col">Margen %</th>
                <th scope="col">Visual</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={`${f.origen}-${f.nombre}`}>
                  <td className="producto">{f.nombre}</td>
                  <td className="num c-rojo">{pesos(f.costo)}</td>
                  <td className="num precio">{pesos(f.precio)}</td>
                  <td className={`num ${f.ganancia < 0 ? "c-rojo" : "c-verde"}`}><strong>{pesos(f.ganancia)}</strong></td>
                  <td>{f.margen === null ? <span className="sin-dato">—</span> : <span className={`pill ${claseMargen(f.margen)}`}>{f.margen}%</span>}</td>
                  <td>
                    <div className="barra-visual" aria-hidden="true">
                      <div style={{ width: `${maxGanancia > 0 ? Math.max(0, (f.ganancia / maxGanancia) * 100) : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {datos && filas.length === 0 && (
            <div className="inv-vacio">
              <p>No hay ventas registradas en {etiquetaMes}. Cuando vendas productos o servicios, verás aquí cuánto ganas con cada uno.</p>
            </div>
          )}
        </div>

        {d && filas.length > 0 && (
          <div className="destacados">
            <div>
              <Icono nombre="coin" tamano={18} />
              <span>Mayor ganancia</span>
              <strong>{d.mayorGanancia?.nombre ?? "—"}</strong>
              <em>{d.mayorGanancia ? `${pesos(d.mayorGanancia.valor)} por unidad` : ""}</em>
            </div>
            <div>
              <Icono nombre="chart" tamano={18} />
              <span>Mejor margen</span>
              <strong>{d.mejorMargen?.nombre ?? "—"}</strong>
              <em>{d.mejorMargen ? `${d.mejorMargen.valor}%` : "Sin costo para calcular"}</em>
            </div>
            <div>
              <Icono nombre="box" tamano={18} />
              <span>Más vendido</span>
              <strong>{d.masVendido?.nombre ?? "—"}</strong>
              <em>{d.masVendido ? `${entero(d.masVendido.valor)} uds` : ""}</em>
            </div>
          </div>
        )}
      </section>
    </>
  );
}