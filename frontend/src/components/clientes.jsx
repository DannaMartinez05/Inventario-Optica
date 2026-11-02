import { useCallback, useEffect, useRef, useState } from "react";
import "../css/pantallas.css";
import { pedir } from "../api";
import {
  documentoFormateado, entero, fechaCorta, fechaLarga, hoyISO, iniciales, mesYAnio, signado,
} from "../utils";
import Campo from "./campo";
import Icono from "./icono";
import Modal from "./modal";

const POR_PAGINA = 10;
const RETRASO_BUSQUEDA_MS = 300;
const TIPOS_DOC = ["CC", "CE", "TI", "PA", "NIT"];
const ROLES_RECETA = ["admin", "optometrista"];

/* Muestra en el formulario los errores que devuelve el servidor. */
function mostrarErrorServidor(error, { onSalir, setErrores, setGeneral, prefijo }) {
  if (error.estado === 401) return onSalir();
  if (error.campos?.length) {
    const lista = {};
    for (const c of error.campos) lista[c.campo] = c.mensaje;
    setErrores(lista);
    const primero = Object.keys(lista)[0];
    document.getElementById(`${prefijo}-${primero}`)?.focus();
  }
  setGeneral(
    error.estado === 403 ? "Tu rol no tiene permiso para hacer esto." : error.message
  );
}

/* ------------------------------------------------------------------
   FORMULARIO DE CLIENTE (nuevo / editar)
------------------------------------------------------------------- */
function FormCliente({ cliente, sesion, onSalir, onCerrar, onGuardado }) {
  const [f, setF] = useState(() => ({
    nombre: cliente?.nombre || "",
    tipo_documento: cliente?.tipo_documento || "CC",
    documento: cliente?.documento || "",
    telefono: cliente?.telefono || "",
    correo: cliente?.correo || "",
    fecha_nacimiento: cliente?.fecha_nacimiento || "",
    direccion: cliente?.direccion || "",
    ocupacion: cliente?.ocupacion || "",
  }));
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    setF((a) => ({ ...a, [campo]: e.target.value }));
    if (errores[campo]) setErrores((a) => ({ ...a, [campo]: undefined }));
  };

  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    setGeneral("");

    const nuevos = {};
    if (!f.nombre.trim()) nuevos.nombre = "Ingresa el nombre del cliente.";
    if (f.correo.trim() && !/^\S+@\S+\.\S+$/.test(f.correo.trim())) nuevos.correo = "Escribe un correo válido.";
    if (f.fecha_nacimiento && f.fecha_nacimiento > hoyISO()) nuevos.fecha_nacimiento = "La fecha no puede ser futura.";
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      document.getElementById(`cl-${Object.keys(nuevos)[0]}`)?.focus();
      return;
    }

    setGuardando(true);
    try {
      const cuerpo = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()]));
      const r = cliente
        ? await pedir(`/privado/clientes/${cliente.id}`, { token: sesion.token, metodo: "PUT", cuerpo })
        : await pedir("/privado/clientes", { token: sesion.token, metodo: "POST", cuerpo });
      onGuardado(r.cliente.id, cliente ? "actualizado" : "registrado");
    } catch (error) {
      mostrarErrorServidor(error, { onSalir, setErrores, setGeneral, prefijo: "cl" });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Modal titulo={cliente ? "Editar cliente" : "Nuevo cliente"} onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate>
        {general && <div className="aviso aviso-error" role="alert"><span>{general}</span></div>}

        <div className="grid-2">
          <Campo id="cl-nombre" etiqueta="Nombre completo" requerido error={errores.nombre}>
            <input id="cl-nombre" value={f.nombre} onChange={cambiar("nombre")} maxLength={150}
              autoComplete="off" aria-invalid={Boolean(errores.nombre)}
              aria-describedby={errores.nombre ? "cl-nombre-error" : undefined} />
          </Campo>

          <div className="doc-fila">
            <Campo id="cl-tipo_documento" etiqueta="Tipo">
              <select id="cl-tipo_documento" value={f.tipo_documento} onChange={cambiar("tipo_documento")}>
                {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo id="cl-documento" etiqueta="Documento" error={errores.documento}>
              <input id="cl-documento" value={f.documento} onChange={cambiar("documento")} maxLength={30}
                inputMode="numeric" autoComplete="off" />
            </Campo>
          </div>

          <Campo id="cl-telefono" etiqueta="Teléfono" error={errores.telefono}>
            <input id="cl-telefono" type="tel" value={f.telefono} onChange={cambiar("telefono")} maxLength={30} />
          </Campo>

          <Campo id="cl-correo" etiqueta="Correo electrónico" error={errores.correo}>
            <input id="cl-correo" type="email" value={f.correo} onChange={cambiar("correo")} maxLength={150}
              aria-invalid={Boolean(errores.correo)} aria-describedby={errores.correo ? "cl-correo-error" : undefined} />
          </Campo>

          <Campo id="cl-fecha_nacimiento" etiqueta="Fecha de nacimiento" error={errores.fecha_nacimiento}>
            <input id="cl-fecha_nacimiento" type="date" max={hoyISO()} value={f.fecha_nacimiento}
              onChange={cambiar("fecha_nacimiento")} />
          </Campo>

          <Campo id="cl-ocupacion" etiqueta="Ocupación" error={errores.ocupacion}>
            <input id="cl-ocupacion" value={f.ocupacion} onChange={cambiar("ocupacion")} maxLength={120} />
          </Campo>
        </div>

        <div className="campo-suelto">
          <Campo id="cl-direccion" etiqueta="Dirección" error={errores.direccion}>
            <input id="cl-direccion" value={f.direccion} onChange={cambiar("direccion")} maxLength={255} />
          </Campo>
        </div>

        <div className="modal-pie">
          <button type="button" className="btn btn-secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? "Guardando…" : cliente ? "Guardar cambios" : "Registrar cliente"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------
   FORMULARIO DE RECETA (graduación)
------------------------------------------------------------------- */
const RANGOS = {
  esfera: [-30, 30, "Esfera"],
  cilindro: [-10, 10, "Cilindro"],
  eje: [0, 180, "Eje"],
  adicion: [0, 5, "Adición"],
};

const aNumero = (v) => {
  const t = String(v).trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

function FormReceta({ cliente, sesion, onSalir, onCerrar, onGuardada }) {
  const [f, setF] = useState({
    fecha: hoyISO(),
    optometrista: sesion.usuario?.rol === "optometrista" ? sesion.usuario.nombre : "",
    od_esfera: "", od_cilindro: "", od_eje: "", od_adicion: "",
    oi_esfera: "", oi_cilindro: "", oi_eje: "", oi_adicion: "",
    observaciones: "",
  });
  const [errores, setErrores] = useState({});
  const [general, setGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (e) => {
    setF((a) => ({ ...a, [campo]: e.target.value }));
    if (errores[campo]) setErrores((a) => ({ ...a, [campo]: undefined }));
  };

  async function guardar(e) {
    e.preventDefault();
    if (guardando) return;
    setGeneral("");

    const nuevos = {};
    const medidas = {};
    for (const ojo of ["od", "oi"]) {
      for (const [campo, [min, max, nombre]] of Object.entries(RANGOS)) {
        const clave = `${ojo}_${campo}`;
        const n = aNumero(f[clave]);
        if (Number.isNaN(n)) nuevos[clave] = `${nombre}: escribe un número, por ejemplo -2.25.`;
        else if (n !== null && (n < min || n > max)) nuevos[clave] = `${nombre}: entre ${min} y ${max}.`;
        else if (campo === "eje" && n !== null && !Number.isInteger(n)) nuevos[clave] = "El eje es un número entero.";
        medidas[clave] = n;
      }
    }
    if (!Object.keys(nuevos).length && Object.values(medidas).every((v) => v === null)) {
      nuevos.od_esfera = "Ingresa al menos un dato de la graduación.";
    }
    if (f.fecha > hoyISO()) nuevos.fecha = "La fecha no puede ser futura.";
    if (Object.keys(nuevos).length) {
      setErrores(nuevos);
      document.getElementById(`rx-${Object.keys(nuevos)[0]}`)?.focus();
      return;
    }

    setGuardando(true);
    try {
      await pedir(`/privado/clientes/${cliente.id}/recetas`, {
        token: sesion.token,
        metodo: "POST",
        cuerpo: {
          fecha: f.fecha,
          optometrista: f.optometrista.trim(),
          observaciones: f.observaciones.trim(),
          ...medidas,
        },
      });
      onGuardada();
    } catch (error) {
      mostrarErrorServidor(error, { onSalir, setErrores, setGeneral, prefijo: "rx" });
    } finally {
      setGuardando(false);
    }
  }

  const fila = (ojo, titulo) => (
    <fieldset className="rx-ojo">
      <legend>{titulo}</legend>
      <div className="grid-4">
        {Object.entries(RANGOS).map(([campo, [, , nombre]]) => {
          const clave = `${ojo}_${campo}`;
          return (
            <Campo key={clave} id={`rx-${clave}`} etiqueta={nombre} error={errores[clave]}>
              <input id={`rx-${clave}`} inputMode="decimal" value={f[clave]} onChange={cambiar(clave)}
                placeholder={campo === "eje" ? "0–180" : "0.00"} autoComplete="off"
                aria-invalid={Boolean(errores[clave])}
                aria-describedby={errores[clave] ? `rx-${clave}-error` : undefined} />
            </Campo>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <Modal titulo={`Nueva receta · ${cliente.nombre}`} onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate>
        {general && <div className="aviso aviso-error" role="alert"><span>{general}</span></div>}

        <div className="grid-2">
          <Campo id="rx-fecha" etiqueta="Fecha de la consulta" error={errores.fecha}>
            <input id="rx-fecha" type="date" max={hoyISO()} value={f.fecha} onChange={cambiar("fecha")} />
          </Campo>
          <Campo id="rx-optometrista" etiqueta="Optometrista" ayuda="Si lo dejas vacío usamos tu nombre.">
            <input id="rx-optometrista" value={f.optometrista} onChange={cambiar("optometrista")} maxLength={120} />
          </Campo>
        </div>

        {fila("od", "Ojo derecho (OD)")}
        {fila("oi", "Ojo izquierdo (OI)")}

        <Campo id="rx-observaciones" etiqueta="Observaciones">
          <textarea id="rx-observaciones" rows={3} maxLength={1000} value={f.observaciones}
            onChange={cambiar("observaciones")} placeholder="Tipo de lente recomendado, control en 12 meses…" />
        </Campo>

        <div className="modal-pie">
          <button type="button" className="btn btn-secundario" onClick={onCerrar} disabled={guardando}>Cancelar</button>
          <button type="submit" className="btn btn-primario" disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar receta"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Una receta del historial ---------- */
function RecetaTarjeta({ receta, vigente }) {
  const fila = (clase, etiqueta, m) => (
    <tr>
      <th scope="row" className={clase}>{etiqueta}</th>
      <td>{signado(m.esfera)}</td>
      <td>{signado(m.cilindro)}</td>
      <td>{m.eje === null ? "—" : `${m.eje}°`}</td>
      <td>{signado(m.adicion)}</td>
    </tr>
  );

  return (
    <article className={`rx-tarjeta ${vigente ? "vigente" : ""}`}>
      <header>
        <div>
          <strong>{fechaLarga(receta.fecha)}</strong>
          {receta.optometrista && <span>{receta.optometrista}</span>}
        </div>
        {vigente && <span className="pill vigente">Vigente</span>}
      </header>
      <table className="rx-tabla">
        <thead>
          <tr><th scope="col">Ojo</th><th scope="col">Esfera</th><th scope="col">Cilindro</th><th scope="col">Eje</th><th scope="col">Adición</th></tr>
        </thead>
        <tbody>
          {fila("od", "OD", receta.od)}
          {fila("oi", "OI", receta.oi)}
        </tbody>
      </table>
      {receta.observaciones && (
        <p className="rx-obs"><strong>Observaciones:</strong> {receta.observaciones}</p>
      )}
    </article>
  );
}

const DATOS_CONTACTO = (c) => [
  ["Documento", c.documento ? documentoFormateado(c.tipo_documento, c.documento) : null],
  ["Teléfono", c.telefono],
  ["Correo", c.correo],
  ["Fecha de nacimiento", c.fecha_nacimiento ? fechaLarga(c.fecha_nacimiento) : null],
  ["Dirección", c.direccion],
  ["Ocupación", c.ocupacion],
];

/* ------------------------------------------------------------------
   CLIENTES
------------------------------------------------------------------- */
export default function Clientes({ sesion, onSalir }) {
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [seleccionado, setSeleccionado] = useState(null);
  const [detalle, setDetalle] = useState(null); // { cliente, recetas }
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [modal, setModal] = useState(null); // "nuevo" | "editar" | "receta"
  const [aviso, setAviso] = useState("");
  const [verTodas, setVerTodas] = useState(false);
  const enviada = useRef("");
  const turnoDetalle = useRef(0);
  const haySeleccion = useRef(false);

  const puedeReceta = ROLES_RECETA.includes(sesion.usuario?.rol);

  // Carga la ficha (datos + recetas) de un cliente. Devuelve la ficha o null.
  const cargarDetalle = useCallback(
    async (id) => {
      const turno = ++turnoDetalle.current;
      haySeleccion.current = true;
      setSeleccionado(id);
      setCargandoDetalle(true);
      try {
        const d = await pedir(`/privado/clientes/${id}`, { token: sesion.token });
        if (turno !== turnoDetalle.current) return null;
        setDetalle(d);
        setVerTodas(false);
        return d;
      } catch (e) {
        if (turno !== turnoDetalle.current) return null;
        if (e.estado === 401) onSalir();
        else setError(e.message);
        return null;
      } finally {
        if (turno === turnoDetalle.current) setCargandoDetalle(false);
      }
    },
    [sesion.token, onSalir]
  );

  // Espera a que se deje de escribir antes de consultar.
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
    const params = new URLSearchParams({ pagina, limite: POR_PAGINA });
    if (busqueda) params.set("q", busqueda);

    pedir(`/privado/clientes?${params}`, { token: sesion.token, signal: control.signal })
      .then((d) => {
        setDatos(d);
        setError("");
        // La primera vez se abre la ficha del primer cliente.
        if (!haySeleccion.current && d.clientes[0]) cargarDetalle(d.clientes[0].id);
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
  }, [busqueda, pagina, intento, sesion.token, onSalir, cargarDetalle]);

  function recargarLista(limpiarBusqueda = false) {
    if (limpiarBusqueda) {
      enviada.current = "";
      setTexto("");
      setBusqueda("");
      setPagina(1);
    }
    setCargando(true);
    setIntento((n) => n + 1);
  }

  async function clienteGuardado(id, accion) {
    setModal(null);
    setAviso(`Cliente ${accion} correctamente.`);
    await cargarDetalle(id);
    recargarLista(accion === "registrado");
  }

  async function recetaGuardada() {
    setModal(null);
    setAviso("Receta registrada correctamente.");
    await cargarDetalle(detalle.cliente.id);
    recargarLista();
  }

  // Abre el formulario de editar o de receta para un cliente de la lista.
  async function abrirPara(id, tipo) {
    if (detalle?.cliente.id !== id) {
      const d = await cargarDetalle(id);
      if (!d) return;
    }
    setAviso("");
    setModal(tipo);
  }

  const lista = datos?.clientes ?? [];
  const pag = datos?.paginacion;
  const c = detalle?.cliente;
  const recetas = detalle?.recetas ?? [];
  const visibles = verTodas ? recetas : recetas.slice(0, 2);
  const completo = c && DATOS_CONTACTO(c).every(([, valor]) => valor);
  const desde = pag && pag.total > 0 ? (pag.pagina - 1) * pag.limite + 1 : 0;
  const hasta = pag ? Math.min(pag.pagina * pag.limite, pag.total) : 0;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Clientes</h1>
          <p>Consulta datos de contacto, recetas y graduaciones de tus clientes</p>
        </div>
        <button type="button" className="btn btn-primario" onClick={() => { setAviso(""); setModal("nuevo"); }}>
          <Icono nombre="plus" tamano={16} />
          Nuevo cliente
        </button>
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
          <button type="button" className="aviso-accion" onClick={() => { setError(""); recargarLista(); }}>
            Reintentar
          </button>
        </div>
      )}

      <div className="panel cli-busqueda">
        <div className="inv-buscador">
          <Icono nombre="search" tamano={16} />
          <input
            type="text"
            value={texto}
            placeholder="Buscar por nombre, número de documento o teléfono"
            aria-label="Buscar cliente"
            autoComplete="off"
            maxLength={100}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setTexto(""); }}
          />
          {texto && (
            <button type="button" className="inv-buscador-limpiar" aria-label="Borrar búsqueda" onClick={() => setTexto("")}>
              <Icono nombre="close" tamano={14} />
            </button>
          )}
        </div>
      </div>

      <div className="cli-layout">
        {/* ---------- Directorio ---------- */}
        <section className="panel cli-directorio">
          <h2 className="cli-titulo">
            Directorio de clientes
            <small>{entero(datos?.totalRegistrados)} registrados</small>
          </h2>

          <div className={`inv-tabla-caja ${cargando ? "cargando" : ""}`} aria-busy={cargando}>
            <table className="inv-tabla cli-tabla">
              <caption className="sr-only">Directorio de clientes</caption>
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Documento</th>
                  <th scope="col">Teléfono</th>
                  <th scope="col">Correo electrónico</th>
                  <th scope="col">Última consulta</th>
                  <th scope="col">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id} className={f.id === seleccionado ? "fila-activa" : undefined}>
                    <td>
                      <button type="button" className="cli-nombre" onClick={() => cargarDetalle(f.id)}
                        aria-pressed={f.id === seleccionado}>
                        <span className={`cli-avatar ${f.id === seleccionado ? "activo" : ""}`}>{iniciales(f.nombre)}</span>
                        <strong>{f.nombre}</strong>
                      </button>
                    </td>
                    <td className="codigo">{f.documento ? documentoFormateado(f.tipo_documento, f.documento) : <span className="sin-dato">—</span>}</td>
                    <td className="num-texto">{f.telefono || <span className="sin-dato">—</span>}</td>
                    <td>{f.correo || <span className="sin-dato">—</span>}</td>
                    <td className="num-texto">{f.ultima_consulta ? fechaCorta(f.ultima_consulta) : <span className="sin-dato">—</span>}</td>
                    <td>
                      <div className="cli-acciones">
                        <button type="button" className="icono-btn" title="Ver ficha" aria-label={`Ver ficha de ${f.nombre}`} onClick={() => cargarDetalle(f.id)}>
                          <Icono nombre="eye" tamano={15} />
                        </button>
                        <button type="button" className="icono-btn editar" title="Editar" aria-label={`Editar a ${f.nombre}`} onClick={() => abrirPara(f.id, "editar")}>
                          <Icono nombre="edit" tamano={15} />
                        </button>
                        {puedeReceta && (
                          <button type="button" className="icono-btn" title="Nueva receta" aria-label={`Nueva receta para ${f.nombre}`} onClick={() => abrirPara(f.id, "receta")}>
                            <Icono nombre="receta" tamano={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {datos && lista.length === 0 && (
              <div className="inv-vacio">
                {busqueda ? (
                  <>
                    <p>No encontramos clientes para «{busqueda}».</p>
                    <button type="button" className="btn btn-secundario" onClick={() => setTexto("")}>Limpiar búsqueda</button>
                  </>
                ) : (
                  <>
                    <p>Todavía no tienes clientes registrados. Registra el primero para guardar sus datos y recetas.</p>
                    <button type="button" className="btn btn-primario" onClick={() => setModal("nuevo")}>
                      <Icono nombre="plus" tamano={16} />
                      Nuevo cliente
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {pag && pag.total > 0 && (
            <div className="cli-pie">
              <span role="status" aria-live="polite">Mostrando {desde}–{hasta} de {entero(pag.total)} clientes</span>
              {pag.paginas > 1 && (
                <nav className="cli-paginas" aria-label="Paginación">
                  <button type="button" className="btn btn-secundario" disabled={pag.pagina <= 1}
                    onClick={() => { setCargando(true); setPagina((n) => n - 1); }}>Anterior</button>
                  <span>{pag.pagina} / {pag.paginas}</span>
                  <button type="button" className="btn btn-secundario" disabled={pag.pagina >= pag.paginas}
                    onClick={() => { setCargando(true); setPagina((n) => n + 1); }}>Siguiente</button>
                </nav>
              )}
            </div>
          )}
        </section>

        {/* ---------- Ficha del cliente ---------- */}
        <aside className={`cli-detalle ${cargandoDetalle ? "cargando" : ""}`} aria-busy={cargandoDetalle} aria-label="Ficha del cliente">
          {!c ? (
            <div className="cli-detalle-vacio">
              <Icono nombre="users" tamano={28} />
              <p>{datos && datos.totalRegistrados === 0
                ? "Cuando registres un cliente, aquí verás sus datos de contacto y su historial de recetas."
                : "Selecciona un cliente para ver sus datos y recetas."}</p>
            </div>
          ) : (
            <>
              <header className="cli-detalle-cab">
                <span className="cli-avatar activo grande">{iniciales(c.nombre)}</span>
                <div>
                  <h2>{c.nombre}</h2>
                  <small>Cliente desde {mesYAnio(c.fecha_registro)}</small>
                </div>
                <button type="button" className="icono-btn editar" title="Editar cliente" aria-label="Editar cliente" onClick={() => { setAviso(""); setModal("editar"); }}>
                  <Icono nombre="edit" tamano={15} />
                </button>
              </header>

              <section className="cli-bloque">
                <div className="cli-bloque-titulo">
                  <h3>Datos de contacto</h3>
                  <span className={`pill ${completo ? "ok" : "bajo"}`}>
                    {completo ? "Información completa" : "Información incompleta"}
                  </span>
                </div>
                <dl className="cli-datos">
                  {DATOS_CONTACTO(c).map(([etiqueta, valor]) => (
                    <div key={etiqueta}>
                      <dt>{etiqueta}</dt>
                      <dd>{valor || <span className="sin-dato">Sin registrar</span>}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="cli-bloque">
                <div className="cli-bloque-titulo">
                  <div>
                    <h3>Historial de recetas</h3>
                    <small>
                      {recetas.length === 0
                        ? "Sin graduaciones registradas"
                        : `${recetas.length} graduaci${recetas.length === 1 ? "ón registrada" : "ones registradas"}`}
                    </small>
                  </div>
                  {puedeReceta && (
                    <button type="button" className="btn btn-primario" onClick={() => { setAviso(""); setModal("receta"); }}>
                      <Icono nombre="plus" tamano={14} />
                      Nueva receta
                    </button>
                  )}
                </div>

                {recetas.length === 0 ? (
                  <p className="cli-sin-recetas">
                    {puedeReceta
                      ? "Este cliente aún no tiene recetas. Registra su primera graduación con “Nueva receta”."
                      : "Este cliente aún no tiene recetas. Las registra un optometrista o un administrador."}
                  </p>
                ) : (
                  <>
                    {visibles.map((r, i) => <RecetaTarjeta key={r.id} receta={r} vigente={i === 0} />)}
                    {recetas.length > 2 && (
                      <button type="button" className="btn btn-secundario ancho" onClick={() => setVerTodas((v) => !v)}>
                        {verTodas ? "Mostrar solo las últimas 2" : "Consultar historial completo"}
                      </button>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </aside>
      </div>

      {modal === "nuevo" && (
        <FormCliente sesion={sesion} onSalir={onSalir} onCerrar={() => setModal(null)} onGuardado={clienteGuardado} />
      )}
      {modal === "editar" && c && (
        <FormCliente cliente={c} sesion={sesion} onSalir={onSalir} onCerrar={() => setModal(null)} onGuardado={clienteGuardado} />
      )}
      {modal === "receta" && c && (
        <FormReceta cliente={c} sesion={sesion} onSalir={onSalir} onCerrar={() => setModal(null)} onGuardada={recetaGuardada} />
      )}
    </>
  );
}