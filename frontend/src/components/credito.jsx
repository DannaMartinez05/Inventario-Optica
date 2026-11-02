import { useCallback, useEffect, useState } from "react";
import "../css/pantallas.css";
import { pedir } from "../api";
import { fechaCorta, hoyISO, pesos } from "../utils";
import Campo from "./campo";
import Icono from "./icono";

const METODOS = [
  { valor: "EFECTIVO", texto: "Efectivo" },
  { valor: "TRANSFERENCIA", texto: "Transferencia" },
  { valor: "TARJETA", texto: "Tarjeta" },
  { valor: "OTRO", texto: "Otro" },
];

const dinero = (v) => (v === "" ? "" : Number(v).toLocaleString("es-CO"));

/* ------------------------------------------------------------------
   VENTA A CRÉDITO — información del crédito y registro de abonos
   Datos de /api/privado/credito (pendientes, ventas/:id y abonos).
------------------------------------------------------------------- */
export default function Credito({ sesion, onSalir }) {
  const [clientes, setClientes] = useState(null); // clientes con saldo pendiente
  const [clienteId, setClienteId] = useState("");
  const [ventaId, setVentaId] = useState("");
  const [ficha, setFicha] = useState(null);
  const [f, setF] = useState({ fecha: hoyISO(), valor: "", metodo_pago: "EFECTIVO", observacion: "" });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(false);

  const fallo = useCallback(
    (e) => {
      if (e.estado === 401) onSalir();
      else setError(e.message);
    },
    [onSalir]
  );

  // Abre la ficha de una venta y propone el valor de una cuota como abono.
  const elegirVenta = useCallback(
    async (id) => {
      setVentaId(String(id));
      try {
        const d = await pedir(`/privado/credito/ventas/${id}`, { token: sesion.token });
        setFicha(d);
        const sugerido = Math.min(d.valorCuota || d.saldo, d.saldo);
        setF((a) => ({ ...a, valor: String(sugerido) }));
        setErrores({});
      } catch (e) {
        fallo(e);
      }
    },
    [sesion.token, fallo]
  );

  // Muestra la lista de clientes con saldo y deja elegida `preferida` (o la primera venta).
  const aplicarPendientes = useCallback(
    async (d, preferida) => {
      setClientes(d.clientes);
      setError("");
      const cliente = d.clientes.find((c) => c.ventas.some((v) => v.id === preferida)) ?? d.clientes[0];
      if (!cliente) {
        setClienteId("");
        setVentaId("");
        setFicha(null);
        return;
      }
      setClienteId(String(cliente.id));
      await elegirVenta((cliente.ventas.find((v) => v.id === preferida) ?? cliente.ventas[0]).id);
    },
    [elegirVenta]
  );

  const cargarPendientes = useCallback(
    async (preferida) => {
      try {
        const d = await pedir("/privado/credito/pendientes", { token: sesion.token });
        await aplicarPendientes(d, preferida);
      } catch (e) {
        setClientes((actual) => actual ?? []);
        fallo(e);
      }
    },
    [sesion.token, aplicarPendientes, fallo]
  );

  useEffect(() => {
    const control = new AbortController();

    pedir("/privado/credito/pendientes", { token: sesion.token, signal: control.signal })
      .then((d) => aplicarPendientes(d))
      .catch((e) => {
        if (e.name === "AbortError") return;
        setClientes((actual) => actual ?? []);
        fallo(e);
      });

    return () => control.abort();
  }, [sesion.token, aplicarPendientes, fallo]);

  const cliente = clientes?.find((c) => String(c.id) === clienteId);
  const abono = Number(f.valor) || 0;
  const nuevoSaldo = ficha ? ficha.saldo - abono : 0;

  function cambiarCliente(e) {
    const c = clientes.find((x) => String(x.id) === e.target.value);
    setClienteId(e.target.value);
    setAviso("");
    if (c) elegirVenta(c.ventas[0].id);
  }

  async function registrar(e) {
    e.preventDefault();
    if (guardando || !ficha) return;
    setError("");
    setAviso("");

    const nuevos = {};
    if (!abono || abono <= 0) nuevos.valor = "Ingresa el valor del abono.";
    else if (abono > ficha.saldo) nuevos.valor = `El abono supera el saldo pendiente (${pesos(ficha.saldo)}).`;
    if (!f.fecha) nuevos.fecha = "Elige la fecha del abono.";
    else if (f.fecha > hoyISO()) nuevos.fecha = "La fecha no puede ser futura.";
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      document.getElementById(`ab-${Object.keys(nuevos)[0]}`)?.focus();
      return;
    }

    setGuardando(true);
    try {
      const r = await pedir("/privado/credito/abonos", {
        token: sesion.token,
        metodo: "POST",
        cuerpo: {
          id_venta: Number(ventaId),
          valor: abono,
          fecha: f.fecha,
          metodo_pago: f.metodo_pago,
          observacion: f.observacion.trim(),
        },
      });
      setAviso(
        r.saldo === 0
          ? `Abono registrado. ${ficha.codigo} quedó pagada por completo.`
          : `Abono registrado. Nuevo saldo de ${ficha.codigo}: ${pesos(r.saldo)}.`
      );
      setF((a) => ({ ...a, observacion: "" }));
      await cargarPendientes(Number(ventaId));
    } catch (err) {
      if (err.campos?.length) {
        const lista = {};
        for (const c of err.campos) lista[c.campo] = c.mensaje;
        setErrores(lista);
      }
      setError(err.estado === 403 ? "Tu rol no tiene permiso para registrar abonos." : err.message);
      if (err.estado === 401) onSalir();
    } finally {
      setGuardando(false);
    }
  }

  const cambiar = (campo) => (e) => {
    setF((a) => ({ ...a, [campo]: e.target.value }));
    if (errores[campo]) setErrores((a) => ({ ...a, [campo]: undefined }));
  };

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Venta a crédito</h1>
          <p>Gestión de crédito y registro de abonos</p>
        </div>
      </header>

      {aviso && (
        <div className="aviso aviso-exito" role="status">
          <span>{aviso}</span>
          <button type="button" className="aviso-cerrar" onClick={() => setAviso("")} aria-label="Cerrar aviso">
            <Icono nombre="close" tamano={16} />
          </button>
        </div>
      )}
      {error && (
        <div className="aviso aviso-error" role="alert">
          <span>{error}</span>
          <button type="button" className="aviso-accion" onClick={() => { setError(""); cargarPendientes(Number(ventaId) || undefined); }}>
            Reintentar
          </button>
        </div>
      )}

      {clientes === null && <p className="estado-carga">Cargando créditos…</p>}

      {clientes && clientes.length === 0 && (
        <section className="panel pantalla-vacia">
          <Icono nombre="card" tamano={30} />
          <h2>No hay ventas a crédito con saldo pendiente</h2>
          <p>
            Cuando registres una venta a crédito, aquí verás su información y podrás cobrar los abonos.
          </p>
        </section>
      )}

      {clientes && clientes.length > 0 && ficha && (
        <div className="cred-layout">
          <div className="cred-columna">
            <section className="panel">
              <h2 className="titulo-icono"><Icono nombre="card" tamano={16} /> Información del crédito</h2>
              <dl className="info-lista">
                <div><dt>Cliente</dt><dd>{ficha.cliente}</dd></div>
                <div><dt>Documento</dt><dd>{ficha.documento || "—"}</dd></div>
                <div><dt>Fecha de venta</dt><dd>{fechaCorta(ficha.fecha)}</dd></div>
                <div><dt>Valor total</dt><dd>{pesos(ficha.total)}</dd></div>
                <div><dt>Valor recibido</dt><dd>{pesos(ficha.pagado)}</dd></div>
                <div><dt>Número de cuotas</dt><dd>{ficha.numCuotas ?? "—"}</dd></div>
                <div><dt>Valor por cuota</dt><dd>{ficha.valorCuota ? pesos(ficha.valorCuota) : "—"}</dd></div>
                <div><dt>Próximo pago</dt><dd>{fechaCorta(ficha.proximoPago)}</dd></div>
              </dl>

              <div className="saldo-caja">
                <span>Saldo pendiente</span>
                <strong>{pesos(ficha.saldo)}</strong>
                <small>
                  {ficha.cuotasRestantes} {ficha.cuotasRestantes === 1 ? "cuota restante" : "cuotas restantes"}
                  {ficha.venceUltima && ` · Vence ${fechaCorta(ficha.venceUltima)}`}
                </small>
              </div>
            </section>

            <section className="panel">
              <h3 className="progreso-titulo">Progreso de pago</h3>
              <div className="progreso" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                aria-valuenow={ficha.porcentajePagado} aria-label="Porcentaje pagado del crédito">
                <div style={{ width: `${ficha.porcentajePagado}%` }} />
              </div>
              <div className="progreso-datos">
                <span>Pagado: {pesos(ficha.pagado)} ({ficha.porcentajePagado}%)</span>
                <span>Restante: {pesos(ficha.saldo)} ({100 - ficha.porcentajePagado}%)</span>
              </div>
            </section>
          </div>

          <section className="panel">
            <h2 className="titulo-icono"><Icono nombre="coin" tamano={16} /> Registrar abono</h2>

            <form onSubmit={registrar} noValidate className="form-abono">
              <Campo id="ab-cliente" etiqueta="Cliente" requerido>
                <select id="ab-cliente" value={clienteId} onChange={cambiarCliente}>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>

              <Campo id="ab-venta" etiqueta="Venta de referencia" requerido>
                <select id="ab-venta" value={ventaId} onChange={(e) => { setAviso(""); elegirVenta(e.target.value); }}>
                  {cliente?.ventas.map((v) => (
                    <option key={v.id} value={v.id}>{v.codigo} — Saldo {pesos(v.saldo)}</option>
                  ))}
                </select>
              </Campo>

              <div className="grid-2">
                <Campo id="ab-fecha" etiqueta="Fecha del abono" requerido error={errores.fecha}>
                  <input id="ab-fecha" type="date" max={hoyISO()} value={f.fecha} onChange={cambiar("fecha")}
                    aria-invalid={Boolean(errores.fecha)} aria-describedby={errores.fecha ? "ab-fecha-error" : undefined} />
                </Campo>
                <Campo id="ab-valor" etiqueta="Valor del abono (COP)" requerido error={errores.valor}>
                  <div className="entrada-dinero">
                    <span aria-hidden="true">$</span>
                    <input id="ab-valor" inputMode="numeric" value={dinero(f.valor)} placeholder="0"
                      onChange={(e) => {
                        setF((a) => ({ ...a, valor: e.target.value.replace(/\D/g, "").slice(0, 10) }));
                        if (errores.valor) setErrores((a) => ({ ...a, valor: undefined }));
                      }}
                      aria-invalid={Boolean(errores.valor)} aria-describedby={errores.valor ? "ab-valor-error" : undefined} />
                  </div>
                </Campo>
              </div>

              <div className="resumen-abono" role="status" aria-live="polite">
                <div><span>Saldo anterior</span><strong className="c-rojo">{pesos(ficha.saldo)}</strong></div>
                <div><span>Abono</span><strong className="c-verde">− {pesos(abono)}</strong></div>
                <div className="total">
                  <span>Nuevo saldo</span>
                  <strong className={nuevoSaldo < 0 ? "c-rojo" : "c-naranja"}>
                    {nuevoSaldo < 0 ? "El abono supera el saldo" : pesos(nuevoSaldo)}
                  </strong>
                </div>
              </div>

              <Campo id="ab-metodo_pago" etiqueta="Forma de pago">
                <select id="ab-metodo_pago" value={f.metodo_pago} onChange={cambiar("metodo_pago")}>
                  {METODOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
                </select>
              </Campo>

              <Campo id="ab-observacion" etiqueta="Nota">
                <input id="ab-observacion" value={f.observacion} onChange={cambiar("observacion")} maxLength={300}
                  placeholder="Ej. Cuota 2 de 6, pagada en caja" autoComplete="off" />
              </Campo>

              <button type="submit" className="btn btn-primario ancho" disabled={guardando}>
                <Icono nombre="save" tamano={16} />
                {guardando ? "Registrando…" : "Registrar abono"}
              </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}