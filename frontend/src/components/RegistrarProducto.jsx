
import { useEffect, useState } from "react";
import "../css/producto.css";
import { pedir } from "../api";
import { pesos } from "../utils";
import Icono from "./icono";

const TIPOS = [
  { valor: "MONTURA", texto: "Montura" },
  { valor: "LENTE", texto: "Lente" },
  { valor: "ACCESORIO", texto: "Accesorio" },
  { valor: "OTRO", texto: "Otro" },
];

const INICIAL = {
  codigo: "",
  nombre: "",
  tipo_producto: "MONTURA",
  referencia: "",
  laboratorio: "",
  cantidad_inicial: "",
  stock_minimo: "5",
  precio_compra: "",
  precio_venta: "",
  descripcion: "",
};

const soloDigitos = (v) => v.replace(/\D/g, "");

function validar(f) {
  const e = {};

  if (!f.codigo.trim()) {
    e.codigo = "Ingresa el código del producto.";
  } else if (!/^[A-Za-z0-9._\-/]+$/.test(f.codigo.trim())) {
    e.codigo = "Usa solo letras, números, guiones o puntos.";
  }

  if (!f.nombre.trim()) {
    e.nombre = "Ingresa el nombre del producto.";
  }

  if (!f.tipo_producto) {
    e.tipo_producto = "Selecciona el tipo de producto.";
  }

  if (f.cantidad_inicial === "") {
    e.cantidad_inicial = "Ingresa la cantidad inicial (puede ser 0).";
  }

  if (f.precio_compra === "") {
    e.precio_compra = "Ingresa el costo.";
  }

  if (f.precio_venta === "") {
    e.precio_venta = "Ingresa el precio de venta.";
  }

  return e;
}

function Campo({ id, etiqueta, requerido, error, ayuda, children }) {
  return (
    <div className={`campo ${error ? "con-error" : ""}`}>
      <label htmlFor={id}>
        {etiqueta}
        {requerido && <span aria-hidden="true"> *</span>}
      </label>

      {children}

      {ayuda && !error && (
        <small className="campo-ayuda">{ayuda}</small>
      )}

      {error && (
        <small
          id={`${id}-error`}
          className="campo-error"
          role="alert"
        >
          {error}
        </small>
      )}
    </div>
  );
}

export default function RegistrarProducto({
  sesion,
  onSalir,
  onCancelar,
  onGuardado,
}) {
  const [f, setF] = useState(INICIAL);
  const [opciones, setOpciones] = useState(null);
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Cargar proveedores y código sugerido.
  useEffect(() => {
    const control = new AbortController();

    pedir("/privado/productos/opciones", {
      token: sesion.token,
      signal: control.signal,
    })
      .then((o) => {
        setOpciones(o);

        setF((actual) =>
          actual.codigo
            ? actual
            : {
                ...actual,
                codigo: o.siguienteCodigo || "",
              }
        );
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        if (e.estado === 401) return onSalir();

        setOpciones({
          proveedores: [],
          siguienteCodigo: "",
        });

        setErrorGeneral(
          `${e.message}. No pudimos cargar los proveedores ni el código sugerido.`
        );
      });

    return () => control.abort();
  }, [sesion.token, onSalir]);

  const cambiar = (campo) => (e) => {
    const valor = e.target.value;

    setF((actual) => ({
      ...actual,
      [campo]: valor,
    }));

    if (errores[campo]) {
      setErrores((actual) => ({
        ...actual,
        [campo]: undefined,
      }));
    }
  };

  const cambiarDinero = (campo) => (e) => {
    const digitos = soloDigitos(e.target.value).slice(0, 10);

    setF((actual) => ({
      ...actual,
      [campo]: digitos,
    }));

    if (errores[campo]) {
      setErrores((actual) => ({
        ...actual,
        [campo]: undefined,
      }));
    }
  };

  const cambiarEntero = (campo) => (e) => {
    const digitos = soloDigitos(e.target.value).slice(0, 7);

    setF((actual) => ({
      ...actual,
      [campo]: digitos,
    }));

    if (errores[campo]) {
      setErrores((actual) => ({
        ...actual,
        [campo]: undefined,
      }));
    }
  };

  const dinero = (v) =>
    v === "" ? "" : Number(v).toLocaleString("es-CO");

  const costo = Number(f.precio_compra);
  const venta = Number(f.precio_venta);
  const hayPrecios =
    f.precio_compra !== "" && f.precio_venta !== "";
  const ganancia = venta - costo;
  const margen =
    costo > 0 ? Math.round((ganancia / costo) * 100) : null;

  function enfocarPrimerError(lista) {
    const orden = [
      "codigo",
      "nombre",
      "tipo_producto",
      "referencia",
      "laboratorio",
      "cantidad_inicial",
      "stock_minimo",
      "precio_compra",
      "precio_venta",
      "descripcion",
    ];

    const primero = orden.find((c) => lista[c]);

    if (primero) {
      document.getElementById(`pf-${primero}`)?.focus();
    }
  }

  async function guardar(e) {
    e.preventDefault();

    if (guardando) return;

    setErrorGeneral("");

    const encontrados = validar(f);

    if (Object.keys(encontrados).length) {
      setErrores(encontrados);
      enfocarPrimerError(encontrados);
      return;
    }

    setGuardando(true);

    try {
      const respuesta = await pedir("/privado/productos", {
        token: sesion.token,
        metodo: "POST",
        cuerpo: {
          codigo: f.codigo.trim(),
          nombre: f.nombre.trim(),
          tipo_producto: f.tipo_producto,
          referencia: f.referencia.trim(),
          laboratorio: f.laboratorio.trim(),
          cantidad_inicial: Number(f.cantidad_inicial),
          stock_minimo: Number(f.stock_minimo || 0),
          precio_compra: Number(f.precio_compra),
          precio_venta: Number(f.precio_venta),
          descripcion: f.descripcion.trim(),
        },
      });

      onGuardado(respuesta.producto);
    } catch (error) {
      if (error.estado === 401) return onSalir();

      if (error.campos?.length) {
        const delServidor = {};

        for (const c of error.campos) {
          delServidor[c.campo] = c.mensaje;
        }

        setErrores(delServidor);
        enfocarPrimerError(delServidor);
      }

      setErrorGeneral(
        error.estado === 403
          ? "Tu rol no tiene permiso para registrar productos. Pídele a un administrador que lo haga."
          : error.message
      );
    } finally {
      setGuardando(false);
    }
  }

  const cargando = !opciones;

  return (
    <>
      <header className="dash-header">
        <div>
          <h1>Registrar producto</h1>
          <p>Ingresa la información del nuevo producto al inventario</p>
        </div>

        <div className="cabecera-acciones">
          <button
            type="button"
            className="btn btn-secundario"
            onClick={onCancelar}
            disabled={guardando}
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="form-producto"
            className="btn btn-primario"
            disabled={guardando || cargando}
          >
            <Icono nombre="save" tamano={16} />
            {guardando ? "Guardando…" : "Guardar producto"}
          </button>
        </div>
      </header>

      {errorGeneral && (
        <div className="aviso aviso-error" role="alert">
          <span>{errorGeneral}</span>
        </div>
      )}

      <form
        id="form-producto"
        className="panel producto-form"
        onSubmit={guardar}
        noValidate
      >
        <div className="producto-form-cabecera">
          <span className="producto-form-icono">
            <Icono nombre="box" tamano={20} />
          </span>

          <div>
            <h2>Información del producto</h2>
            <p>Los campos con * son obligatorios</p>
          </div>
        </div>

        <fieldset disabled={cargando} className="producto-fieldset">
          <div className="grid-3">
            <Campo
              id="pf-codigo"
              etiqueta="Código del producto"
              requerido
              error={errores.codigo}
            >
              <input
                id="pf-codigo"
                value={f.codigo}
                onChange={cambiar("codigo")}
                maxLength={50}
                aria-invalid={Boolean(errores.codigo)}
                aria-describedby={
                  errores.codigo ? "pf-codigo-error" : undefined
                }
              />
            </Campo>

            <Campo
              id="pf-nombre"
              etiqueta="Nombre del producto"
              requerido
              error={errores.nombre}
            >
              <input
                id="pf-nombre"
                value={f.nombre}
                onChange={cambiar("nombre")}
                maxLength={150}
                placeholder="Ej. Montura acetato premium"
                aria-invalid={Boolean(errores.nombre)}
                aria-describedby={
                  errores.nombre ? "pf-nombre-error" : undefined
                }
              />
            </Campo>

            <Campo
              id="pf-tipo_producto"
              etiqueta="Tipo de producto"
              requerido
              error={errores.tipo_producto}
            >
              <select
                id="pf-tipo_producto"
                value={f.tipo_producto}
                onChange={cambiar("tipo_producto")}
                aria-invalid={Boolean(errores.tipo_producto)}
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.texto}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo
              id="pf-referencia"
              etiqueta="Referencia"
              error={errores.referencia}
            >
              <input
                id="pf-referencia"
                value={f.referencia}
                onChange={cambiar("referencia")}
                maxLength={100}
                placeholder="Ej. ACE-TIT-4201-N"
              />
            </Campo>

            <Campo
              id="pf-laboratorio"
              etiqueta="Laboratorio / Proveedor"
              error={errores.laboratorio}
              ayuda="Si ya existe lo reutilizamos; si es nuevo lo creamos."
            >
              <input
                id="pf-laboratorio"
                value={f.laboratorio}
                onChange={cambiar("laboratorio")}
                maxLength={150}
                list="lista-proveedores"
                placeholder="Ej. Silhouette Óptica"
              />

              <datalist id="lista-proveedores">
                {opciones?.proveedores?.map((p) => (
                  <option key={p.id} value={p.nombre} />
                ))}
              </datalist>
            </Campo>
          </div>

          <div className="grid-4">
            <Campo
              id="pf-cantidad_inicial"
              etiqueta="Cantidad inicial"
              requerido
              error={errores.cantidad_inicial}
            >
              <input
                id="pf-cantidad_inicial"
                inputMode="numeric"
                value={f.cantidad_inicial}
                onChange={cambiarEntero("cantidad_inicial")}
                placeholder="0"
                aria-invalid={Boolean(errores.cantidad_inicial)}
              />
            </Campo>

            <Campo
              id="pf-stock_minimo"
              etiqueta="Stock mínimo"
              error={errores.stock_minimo}
              ayuda="Avisa “Stock bajo” desde esta cantidad."
            >
              <input
                id="pf-stock_minimo"
                inputMode="numeric"
                value={f.stock_minimo}
                onChange={cambiarEntero("stock_minimo")}
                placeholder="5"
              />
            </Campo>

            <Campo
              id="pf-precio_compra"
              etiqueta="Costo (COP)"
              requerido
              error={errores.precio_compra}
            >
              <div className="entrada-dinero">
                <span aria-hidden="true">$</span>
                <input
                  id="pf-precio_compra"
                  inputMode="numeric"
                  value={dinero(f.precio_compra)}
                  onChange={cambiarDinero("precio_compra")}
                  placeholder="0"
                  aria-invalid={Boolean(errores.precio_compra)}
                />
              </div>
            </Campo>

            <Campo
              id="pf-precio_venta"
              etiqueta="Precio de venta (COP)"
              requerido
              error={errores.precio_venta}
            >
              <div className="entrada-dinero">
                <span aria-hidden="true">$</span>
                <input
                  id="pf-precio_venta"
                  inputMode="numeric"
                  value={dinero(f.precio_venta)}
                  onChange={cambiarDinero("precio_venta")}
                  placeholder="0"
                  aria-invalid={Boolean(errores.precio_venta)}
                />
              </div>
            </Campo>
          </div>

          <Campo
            id="pf-descripcion"
            etiqueta="Descripción"
            error={errores.descripcion}
          >
            <textarea
              id="pf-descripcion"
              rows={3}
              maxLength={1000}
              value={f.descripcion}
              onChange={cambiar("descripcion")}
              placeholder="Materiales, colores disponibles, uso recomendado…"
            />
          </Campo>

          <div
            className={`margen ${hayPrecios && ganancia < 0 ? "perdida" : ""}`}
            role="status"
            aria-live="polite"
          >
            <Icono nombre="bulb" tamano={18} />

            {!hayPrecios ? (
              <span>
                Ingresa el costo y el precio de venta para ver el margen estimado.
              </span>
            ) : ganancia < 0 ? (
              <span>
                El precio de venta es menor que el costo: perderías{" "}
                <strong>{pesos(-ganancia)}</strong> por unidad.
              </span>
            ) : (
              <span>
                {margen !== null && (
                  <>
                    El margen de ganancia estimado es del{" "}
                    <strong>{margen}%</strong> —{" "}
                  </>
                )}
                Ganancia por unidad: <strong>{pesos(ganancia)}</strong>
              </span>
            )}
          </div>
        </fieldset>
      </form>
    </>
  );
}
