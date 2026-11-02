import { useEffect, useMemo, useState } from "react";
import "../css/ventas.css";
import { pedir } from "../api";
import { leerSesion } from "../sesion";

/* Formato de pesos colombianos */
const dinero = (valor) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(valor) || 0);

/* Formatea números con separadores de miles */
const formatoNumero = (valor) => {
  const numero = String(valor ?? "").replace(/\D/g, "");
  if (!numero) return "";
  return Number(numero).toLocaleString("es-CO");
};

/* Convierte el valor mostrado a un número */
const numeroReal = (valor) => {
  const numero = String(valor ?? "").replace(/\D/g, "");
  return Number(numero) || 0;
};

/* Campo de dinero reutilizable */
function CampoDinero({ label, value, onChange, placeholder = "0", required = false }) {
  return (
    <label className="ventas-field">
      {label}
      <div className="ventas-input-dinero">
        <span>$</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatoNumero(value)}
          onChange={(e) => onChange(String(e.target.value).replace(/\D/g, ""))}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
        />
      </div>
    </label>
  );
}

/* Campo de porcentaje */
function CampoPorcentaje({ value, onChange }) {
  return (
    <label className="ventas-field">
      Descuento (opcional)
      <div className="ventas-input-dinero">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => {
            const numero = e.target.value.replace(/\D/g, "");
            onChange(numero === "" ? "" : String(Math.min(100, Number(numero))));
          }}
          placeholder="0"
          autoComplete="off"
        />
        <span>%</span>
      </div>
    </label>
  );
}

const nuevoConcepto = (tipo = "Producto") => ({
  id: `${Date.now()}-${Math.random()}`,
  tipo,
  nombre: "",
  referencia: "",
  cantidad: "1",
  precio: "",
});
const formulaInicial = {
  odEsfera: "",
  odCilindro: "",
  odEje: "",
  oiEsfera: "",
  oiCilindro: "",
  oiEje: "",
  observaciones: "",
};

export default function Ventas() {
  const [tipoVenta, setTipoVenta] = useState("completa");
  const [cliente, setCliente] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [estadoCliente, setEstadoCliente] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("CC");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [clienteId, setClienteId] = useState(null);
  const [sugerencias, setSugerencias] = useState([]);
  const [campoBusqueda, setCampoBusqueda] = useState("");

  const [formula, setFormula] = useState(formulaInicial);
  const [tipoLente, setTipoLente] = useState("Monofocal");
  const [material, setMaterial] = useState("Policarbonato");
  const [filtros, setFiltros] = useState([]);

  const [valorLentes, setValorLentes] = useState("");
  const [valorMontura, setValorMontura] = useState("");
  const [valorFiltros, setValorFiltros] = useState("");
  const [referenciaMontura, setReferenciaMontura] = useState("");
  const [estadoMontura, setEstadoMontura] = useState("");
  const [monturaEncontrada, setMonturaEncontrada] = useState(null);

  const [conceptos, setConceptos] = useState([]);
  const [tipoPago, setTipoPago] = useState("Contado");
  const [metodoPago, setMetodoPago] = useState("EFECTIVO");
  const [numCuotas, setNumCuotas] = useState("1");
  const [observacionesPago, setObservacionesPago] = useState("");
  const [valorAbono, setValorAbono] = useState("");
  const [descuento, setDescuento] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [ventaPendiente, setVentaPendiente] = useState(null);
  const [mostrarConfirmacionFactura, setMostrarConfirmacionFactura] = useState(false);
  const [cargandoFactura, setCargandoFactura] = useState(false);
  const [factura, setFactura] = useState(null);
  const [errorFactura, setErrorFactura] = useState("");

  /* Valores numéricos para realizar los cálculos */
  const base = useMemo(() => {
    const gafas =
      tipoVenta === "completa"
        ? numeroReal(valorMontura) +
          numeroReal(valorLentes) +
          numeroReal(valorFiltros)
        : 0;

    const otros = conceptos.reduce(
      (suma, item) =>
        suma +
        Math.max(0, Number(item.cantidad) || 0) *
          numeroReal(item.precio),
      0
    );

    return Math.max(0, gafas + otros);
  }, [
    tipoVenta,
    valorMontura,
    valorLentes,
    valorFiltros,
    conceptos,
  ]);

  const descuentoValor = Math.round(
    (base * Math.min(100, numeroReal(descuento))) / 100
  );

  const total = Math.max(0, base - descuentoValor);
  const abono = numeroReal(valorAbono);
  const saldo = Math.max(0, total - abono);
  const cambio = Math.max(0, abono - total);

  // Busca clientes registrados por nombre, cédula o NIT.
  useEffect(() => {
    const termino = campoBusqueda.trim();

    if (termino.length < 2) {
      setSugerencias([]);
      return undefined;
    }

    const sesionActual = leerSesion();

    if (!sesionActual?.token) {
      setSugerencias([]);
      setEstadoCliente("Inicia sesión para buscar clientes.");
      return undefined;
    }

    let vigente = true;
    setSugerencias([]);
    setEstadoCliente("Buscando clientes...");

    const temporizador = setTimeout(async () => {
      try {
        const resultado = await pedir(
          `/privado/ventas/buscar-clientes?q=${encodeURIComponent(termino)}`,
          {
            token: sesionActual.token,
            metodo: "GET",
          }
        );

        if (!vigente) return;

        setSugerencias(resultado.clientes || []);
        setEstadoCliente(
          resultado.clientes?.length
            ? "Selecciona el cliente correcto de la lista."
            : "No encontramos coincidencias. Puedes completar los datos manualmente."
        );
      } catch (error) {
        if (!vigente) return;

        setSugerencias([]);
        setEstadoCliente(
          error.message || "No se pudo consultar los clientes."
        );
      }
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [campoBusqueda]);

  // Consultar el inventario por código o referencia exacta de la montura.
  // El precio sugerido siempre proviene de producto.precio_venta.
  useEffect(() => {
    const codigo = referenciaMontura.trim();

    if (codigo.length < 2) {
      setMonturaEncontrada(null);
      setEstadoMontura("");
      return undefined;
    }

    const sesionActual = leerSesion();
    if (!sesionActual?.token) {
      setMonturaEncontrada(null);
      setEstadoMontura("Inicia sesión para consultar el inventario.");
      return undefined;
    }

    let vigente = true;
    setEstadoMontura("Buscando montura en el inventario...");

    const temporizador = setTimeout(async () => {
      try {
        const resultado = await pedir(
          `/privado/ventas/buscar-producto?codigo=${encodeURIComponent(codigo)}`,
          { token: sesionActual.token, metodo: "GET" }
        );

        if (!vigente) return;

        const producto = resultado.producto;
        if (!resultado.encontrado || !producto) {
          setMonturaEncontrada(null);
          setValorMontura("");
          setEstadoMontura(
            "No encontramos esa referencia o código en el inventario. Verifica el dato."
          );
          return;
        }

        if (producto.tipo_producto && producto.tipo_producto !== "MONTURA") {
          setMonturaEncontrada(null);
          setValorMontura("");
          setEstadoMontura(
            "El código existe, pero el producto no está clasificado como montura."
          );
          return;
        }

        setMonturaEncontrada(producto);
        setValorMontura(String(Math.round(Number(producto.precio_venta) || 0)));
        setEstadoMontura(
          `Montura encontrada: ${producto.nombre}. Código: ${producto.codigo}. Precio de venta: ${dinero(producto.precio_venta)}. Stock disponible: ${producto.stock}.`
        );
      } catch (error) {
        if (!vigente) return;
        setMonturaEncontrada(null);
        setValorMontura("");
        setEstadoMontura(error.message || "No se pudo consultar el inventario.");
      }
    }, 350);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [referenciaMontura]);

  // Al cerrarse el diálogo de impresión, se finaliza la venta y se prepara el formulario.
  useEffect(() => {
    if (!factura) return undefined;

    const alTerminarImpresion = () => {
      const codigo = ventaPendiente?.codigo || factura.codigo;
      setFactura(null);
      setVentaPendiente(null);
      setMostrarConfirmacionFactura(false);
      setErrorFactura("");
      limpiarFormulario();
      setMensaje(`La venta ${codigo} quedó guardada. El formulario está listo para una nueva venta.`);
    };

    window.addEventListener("afterprint", alTerminarImpresion);
    return () => window.removeEventListener("afterprint", alTerminarImpresion);
  }, [factura, ventaPendiente]);

  function seleccionarCliente(c) {
    setCliente(c.nombre || "");
    setIdentificacion(c.identificacion || "");
    setTipoDocumento(String(c.tipo_documento || "CC").toUpperCase());
    setTelefono(c.telefono || "");
    setDireccion(c.direccion || "");
    setClienteId(c.id);
    setSugerencias([]);
    setCampoBusqueda("");
    setEstadoCliente(
      "Cliente encontrado. Puedes revisar o editar sus datos para esta venta."
    );
  }

  // Al escribir manualmente se conserva el otro campo: nombre y documento
  // son independientes para permitir registrar personas nuevas en la venta.
  function cambiarNombreCliente(valor) {
    setCliente(valor);
    setClienteId(null);
    setCampoBusqueda(valor);
    setSugerencias([]);
    setEstadoCliente("Puedes completar los datos de una persona nueva sin buscarla en Clientes.");
  }

  function cambiarIdentificacionCliente(valor) {
    setIdentificacion(valor);
    setClienteId(null);
    setCampoBusqueda(valor);
    setSugerencias([]);
    setEstadoCliente("Puedes completar los datos de una persona nueva sin buscarla en Clientes.");
  }

  function cambiarFormula(campo, valor) {
    setFormula((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  function agregarConcepto(tipo = "Producto") {
    setConceptos((anteriores) => [
      ...anteriores,
      nuevoConcepto(tipo),
    ]);
  }

  function actualizarConcepto(id, campo, valor) {
    setConceptos((anteriores) =>
      anteriores.map((item) =>
        item.id === id ? { ...item, [campo]: valor } : item
      )
    );
  }

  function eliminarConcepto(id) {
    setConceptos((anteriores) =>
      anteriores.filter((item) => item.id !== id)
    );
  }

  /* Al elegir Producto o Servicio se muestra su formulario automáticamente */
  function cambiarTipoVenta(valor) {
    setTipoVenta(valor);
    setMensaje("");

    if (valor === "producto" || valor === "servicio") {
      const tipo = valor === "servicio" ? "Servicio" : "Producto";

      setConceptos((anteriores) => {
        if (anteriores.length > 0) {
          return anteriores.map((item, indice) =>
            indice === 0 ? { ...item, tipo } : item
          );
        }

        return [nuevoConcepto(tipo)];
      });
    }
  }

  function limpiarFormulario() {
    setTipoVenta("completa");
    setCliente("");
    setIdentificacion("");
    setEstadoCliente("");
    setTipoDocumento("CC");
    setTelefono("");
    setDireccion("");
    setClienteId(null);
    setSugerencias([]);
    setCampoBusqueda("");
    setFormula({ ...formulaInicial });
    setTipoLente("Monofocal");
    setMaterial("Policarbonato");
    setFiltros([]);
    setValorLentes("");
    setValorMontura("");
    setValorFiltros("");
    setReferenciaMontura("");
    setEstadoMontura("");
    setMonturaEncontrada(null);
    setConceptos([]);
    setTipoPago("Contado");
    setMetodoPago("EFECTIVO");
    setNumCuotas("1");
    setObservacionesPago("");
    setValorAbono("");
    setDescuento("");
    setMensaje("");
  }


  function finalizarVentaSinImprimir() {
    const codigo = ventaPendiente?.codigo || "";
    setMostrarConfirmacionFactura(false);
    setFactura(null);
    setVentaPendiente(null);
    setErrorFactura("");
    limpiarFormulario();
    setMensaje(
      codigo
        ? `La venta ${codigo} quedó guardada. No se imprimió la factura. El formulario está listo para una nueva venta.`
        : "El formulario está listo para una nueva venta."
    );
  }

  async function abrirFactura() {
    if (!ventaPendiente?.id) return;

    const sesion = leerSesion();
    if (!sesion?.token) {
      setErrorFactura("Tu sesión ha expirado. Inicia sesión nuevamente para consultar la factura.");
      return;
    }

    setCargandoFactura(true);
    setErrorFactura("");
    try {
      const respuesta = await pedir(
        `/privado/ventas/${ventaPendiente.id}/factura`,
        { token: sesion.token, metodo: "GET" }
      );

      if (!respuesta.factura) {
        throw new Error("El servidor no devolvió los datos de la factura.");
      }

      setFactura(respuesta.factura);
      setMostrarConfirmacionFactura(false);
    } catch (error) {
      setErrorFactura(error.message || "No se pudo cargar la factura.");
    } finally {
      setCargandoFactura(false);
    }
  }

 function imprimirFactura() {
  const codigo = factura?.codigo || ventaPendiente?.codigo || "Factura";

  const tituloOriginal = document.title;
  document.title = `Factura-${codigo}`;

  const restaurarTitulo = () => {
    document.title = tituloOriginal;
    window.removeEventListener("afterprint", restaurarTitulo);
  };

  window.addEventListener("afterprint", restaurarTitulo);

  window.print();
}

  async function registrarVenta(e) {
  e.preventDefault();
  if (enviando || ventaPendiente || factura) return;
  setMensaje("");

  if (!cliente.trim()) {
    setMensaje("Ingresa el nombre del cliente.");
    return;
  }

  if (tipoVenta === "completa" && !referenciaMontura.trim()) {
    setMensaje("Ingresa la referencia de la montura del inventario.");
    return;
  }

  if (total <= 0) {
    setMensaje("Ingresa los precios de los conceptos vendidos.");
    return;
  }

  if (
    (tipoVenta === "producto" || tipoVenta === "servicio") &&
    conceptos.some(
      (item) =>
        !item.nombre.trim() ||
        numeroReal(item.precio) <= 0 ||
        !Number.isInteger(Number(item.cantidad)) ||
        Number(item.cantidad) < 1
    )
  ) {
    setMensaje("Completa el nombre, precio y cantidad de cada concepto.");
    return;
  }

  if (tipoPago === "Contado" && abono < total) {
    setMensaje("El pago recibido no cubre el total.");
    return;
  }

  if (tipoPago === "Crédito" && abono > total) {
    setMensaje("El abono no puede superar el total.");
    return;
  }

  const sesion = leerSesion();

  if (!sesion?.token) {
    setMensaje("Tu sesión ha expirado. Inicia sesión nuevamente.");
    return;
  }

  const items = [];

  if (tipoVenta === "completa") {
    if (numeroReal(valorMontura) > 0) {
      items.push({
        categoria: "MONTURA",
        nombre: "Montura",
        referencia: referenciaMontura.trim(),
        cantidad: 1,
        precio: numeroReal(valorMontura),
      });
    }

    if (numeroReal(valorLentes) > 0) {
      items.push({
        categoria: "LENTE",
        nombre: `Lentes ${tipoLente}`,
        detalle: `Material: ${material}. Filtros: ${
          filtros.length ? filtros.join(", ") : "Sin filtro"
        }`,
        cantidad: 1,
        precio: numeroReal(valorLentes),
      });
    }

    if (numeroReal(valorFiltros) > 0) {
      items.push({
        categoria: "FILTRO",
        nombre: filtros.filter((f) => f !== "Sin filtro").join(", ") ||
          "Filtros ópticos",
        cantidad: 1,
        precio: numeroReal(valorFiltros),
      });
    }
  }

  for (const item of conceptos) {
    items.push({
      categoria: item.tipo === "Servicio" ? "SERVICIO" : "PRODUCTO",
      nombre: item.nombre.trim(),
      referencia: item.referencia.trim(),
      cantidad: Number(item.cantidad),
      precio: numeroReal(item.precio),
    });
  }

  if (!items.length) {
    setMensaje("Agrega al menos un concepto con precio.");
    return;
  }

  const datos = {
    cliente: {
      id: clienteId || undefined,
      nombre: cliente.trim(),
      identificacion: identificacion.trim(),
      // En Colombia el RUT identifica tributariamente mediante NIT.
      tipo_documento: tipoDocumento === "RUT" ? "NIT" : tipoDocumento,
      telefono: telefono.trim(),
      direccion: direccion.trim(),
    },
    items,
    formula: tipoVenta === "completa" ? formula : undefined,
    descuento: numeroReal(descuento),
    modalidad: tipoPago === "Contado" ? "CONTADO" : "CREDITO",
    valor_recibido: abono,
    metodo_pago: metodoPago,
    num_cuotas: tipoPago === "Crédito" ? Number(numCuotas) : undefined,
    observacion_pago: observacionesPago.trim(),
  };

  setEnviando(true);
  try {
    const respuesta = await pedir("/privado/ventas", {
      token: sesion.token,
      metodo: "POST",
      cuerpo: datos,
    });

    // La venta ya quedó confirmada en PostgreSQL. No se vuelve a enviar el POST.
    setVentaPendiente(respuesta.venta);
    setMostrarConfirmacionFactura(true);
    setMensaje(
      `¡Venta registrada correctamente! Código: ${respuesta.venta.codigo}. Total: ${dinero(respuesta.venta.total)}. Saldo pendiente: ${dinero(respuesta.venta.saldo)}.`
    );
  } catch (error) {
    // Si falla el registro, se conservan todos los datos del formulario.
    setMensaje(error.message || "No se pudo registrar la venta.");
  } finally {
    setEnviando(false);
  }
}

  return (
    <div className="ventas-page">
      <header className="ventas-header">
        <div>
          <p className="ventas-eyebrow">GESTIÓN COMERCIAL</p>
          <h1>Registrar venta</h1>
          <p className="ventas-subtitle">
            Registra productos, gafas completas y servicios.
          </p>
        </div>
        <div className="ventas-header-icon">🧾</div>
      </header>

      <form onSubmit={registrarVenta} className="ventas-form">
        <section className="ventas-card">
          <div className="ventas-section-title">
            <span className="ventas-step">1</span>
            <div>
              <h2>Información del cliente</h2>
              <p>Datos de la persona que realiza la compra.</p>
            </div>
          </div>

          <div className="ventas-grid ventas-grid-2">
            <label className="ventas-field">
              Nombre completo o razón social *
              <input
                value={cliente}
                onChange={(e) => cambiarNombreCliente(e.target.value)}
                placeholder="Nombre de la persona o empresa"
                autoComplete="off"
                required
              />
            </label>

            <label className="ventas-field">
              Número de identificación
              <input
                value={identificacion}
                onChange={(e) => cambiarIdentificacionCliente(e.target.value)}
                placeholder="Cédula o número de NIT"
                autoComplete="off"
              />
            </label>

            <label className="ventas-field">
              Tipo de identificación
              <select
                value={tipoDocumento}
                onChange={(e) => {
                  setTipoDocumento(e.target.value);
                  setClienteId(null);
                }}
              >
                <option value="CC">Cédula de ciudadanía (CC)</option>
                <option value="CE">Cédula de extranjería (CE)</option>
                <option value="TI">Tarjeta de identidad (TI)</option>
                <option value="PA">Pasaporte (PA)</option>
                <option value="NIT">NIT / RUT</option>
              </select>
            </label>
          </div>
          <p className="ventas-help">
            Nombre, identificación y tipo de documento son campos independientes. Puedes registrar una persona nueva directamente en esta venta; no necesitas seleccionarla de Clientes.
          </p>

          {sugerencias.length > 0 && (
            <div className="ventas-clientes-sugerencias" role="listbox" aria-label="Clientes encontrados">
              {sugerencias.map((c) => (
                <button
                  type="button"
                  className="ventas-cliente-opcion"
                  key={c.id}
                  onClick={() => seleccionarCliente(c)}
                >
                  <span>
                    <strong>{c.nombre}</strong>
                    <small>{c.tipo_documento || "Documento"}: {c.identificacion || "Sin documento"}</small>
                    <small>{c.telefono || "Sin teléfono"} · {c.direccion || "Sin dirección"}</small>
                  </span>
                  <span className="ventas-cliente-elegir">Seleccionar</span>
                </button>
              ))}
            </div>
          )}

          <div className="ventas-grid ventas-grid-2 ventas-datos-cliente">
            <label className="ventas-field">
              Teléfono
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Teléfono del cliente"
              />
            </label>
            <label className="ventas-field ventas-direccion-cliente">
              Dirección
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección del cliente"
              />
            </label>
          </div>

          {estadoCliente && (
            <p className="ventas-help" role="status">
              {estadoCliente}
            </p>
          )}
          <p className="ventas-help">
            Puedes escribir los datos de una persona nueva sin seleccionar un cliente de la lista. La búsqueda es opcional.
          </p>
        </section>

        <section className="ventas-card">
          <div className="ventas-section-title">
            <span className="ventas-step">2</span>
            <div>
              <h2>Productos y servicios</h2>
              <p>Selecciona qué deseas incluir en la venta.</p>
            </div>
          </div>

          <div className="ventas-tipo-grid">
            {[
              {
                id: "completa",
                icono: "👓",
                titulo: "Gafas completas",
                detalle: "Montura, lentes y filtros",
              },
              {
                id: "producto",
                icono: "📦",
                titulo: "Producto",
                detalle: "Montura u otro producto",
              },
              {
                id: "servicio",
                icono: "🔧",
                titulo: "Servicio",
                detalle: "Reparación o arreglo",
              },
            ].map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                className={`ventas-tipo ${
                  tipoVenta === opcion.id ? "seleccionado" : ""
                }`}
                onClick={() => cambiarTipoVenta(opcion.id)}
              >
                <span className="ventas-tipo-icon">{opcion.icono}</span>
                <strong>{opcion.titulo}</strong>
                <small>{opcion.detalle}</small>
              </button>
            ))}
          </div>

          {tipoVenta === "completa" && (
            <div className="ventas-subsection">
              <h3>Montura</h3>
              <div className="ventas-grid ventas-grid-2">
                <label className="ventas-field">
                  Referencia de la montura
                  <input
                    value={referenciaMontura}
                    onChange={(e) => {
                      setReferenciaMontura(e.target.value);
                      setMonturaEncontrada(null);
                      setValorMontura("");
                      setEstadoMontura("");
                    }}
                    placeholder="Código interno o referencia de inventario"
                    autoComplete="off"
                  />
                </label>

                <CampoDinero
                  label="Precio de la montura *"
                  value={valorMontura}
                  onChange={setValorMontura}
                  placeholder="150.000"
                  required
                />
              </div>
              {estadoMontura && (
                <p className="ventas-help" role="status">
                  {estadoMontura}
                  {monturaEncontrada && " El precio se cargó automáticamente desde el inventario; puedes ajustarlo si tienes autorización."}
                </p>
              )}

              <h3>Características de los lentes</h3>
              <div className="ventas-grid ventas-grid-2">
                <label className="ventas-field">
                  Tipo de lente
                  <select
                    value={tipoLente}
                    onChange={(e) => setTipoLente(e.target.value)}
                  >
                    <option>Monofocal</option>
                    <option>Bifocal</option>
                    <option>Progresivo</option>
                    <option>Dúo</option>
                  </select>
                </label>

                <label className="ventas-field">
                  Material o calidad
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                  >
                    <option>Policarbonato</option>
                    <option>LCR</option>
                    <option>1.56</option>
                    <option>Otro</option>
                  </select>
                </label>
              </div>

              <h3>Fórmula óptica</h3>
              <p className="ventas-help">
                Registra la fórmula prescrita para cada ojo.
              </p>

              <div className="ventas-formula">
                <div className="ventas-formula-heading">
                  <strong>Ojo derecho (OD)</strong>
                </div>
                <div className="ventas-grid ventas-grid-3">
                  <label className="ventas-field">
                    Esfera (SPH)
                    <input
                      value={formula.odEsfera}
                      onChange={(e) =>
                        cambiarFormula("odEsfera", e.target.value)
                      }
                      placeholder="Ej. +0.25"
                    />
                  </label>
                  <label className="ventas-field">
                    Cilindro (CYL)
                    <input
                      value={formula.odCilindro}
                      onChange={(e) =>
                        cambiarFormula("odCilindro", e.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="ventas-field">
                    Eje
                    <input
                      value={formula.odEje}
                      onChange={(e) =>
                        cambiarFormula("odEje", e.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <div className="ventas-formula-heading">
                  <strong>Ojo izquierdo (OI)</strong>
                </div>
                <div className="ventas-grid ventas-grid-3">
                  <label className="ventas-field">
                    Esfera (SPH)
                    <input
                      value={formula.oiEsfera}
                      onChange={(e) =>
                        cambiarFormula("oiEsfera", e.target.value)
                      }
                      placeholder="Ej. +0.50"
                    />
                  </label>
                  <label className="ventas-field">
                    Cilindro (CYL)
                    <input
                      value={formula.oiCilindro}
                      onChange={(e) =>
                        cambiarFormula("oiCilindro", e.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="ventas-field">
                    Eje
                    <input
                      value={formula.oiEje}
                      onChange={(e) =>
                        cambiarFormula("oiEje", e.target.value)
                      }
                      placeholder="Opcional"
                    />
                  </label>
                </div>

                <label className="ventas-field">
                  Observaciones de la fórmula
                  <textarea
                    rows="2"
                    value={formula.observaciones}
                    onChange={(e) =>
                      cambiarFormula("observaciones", e.target.value)
                    }
                    placeholder="Adición, indicaciones u otros datos..."
                  />
                </label>
              </div>

              <h3>Filtros</h3>
              <div className="ventas-filtros">
                {[
                  "Antirreflejo",
                  "Fotocromático / Transition",
                  "Filtro azul",
                  "Otro",
                  "Sin filtro",
                ].map((filtro) => (
                  <label key={filtro} className="ventas-checkbox">
                    <input
                      type="checkbox"
                      checked={filtros.includes(filtro)}
                      onChange={() =>
                        setFiltros((anteriores) => {
                          if (filtro === "Sin filtro") {
                            return anteriores.includes(filtro)
                              ? []
                              : [filtro];
                          }

                          const sinExclusion = anteriores.filter(
                            (item) => item !== "Sin filtro"
                          );

                          return sinExclusion.includes(filtro)
                            ? sinExclusion.filter((item) => item !== filtro)
                            : [...sinExclusion, filtro];
                        })
                      }
                    />
                    {filtro}
                  </label>
                ))}
              </div>

              <div className="ventas-grid ventas-grid-2">
                <CampoDinero
                  label="Precio de los lentes según la fórmula *"
                  value={valorLentes}
                  onChange={setValorLentes}
                  placeholder="320.000"
                  required
                />
                <CampoDinero
                  label="Precio de los filtros"
                  value={valorFiltros}
                  onChange={setValorFiltros}
                  placeholder="25.000"
                />
              </div>
            </div>
          )}

          {(tipoVenta === "producto" || tipoVenta === "servicio") && (
            <div className="ventas-subsection">
              <div className="ventas-inline-heading">
                <div>
                  <h3>
                    {tipoVenta === "producto"
                      ? "Detalle del producto"
                      : "Detalle del servicio"}
                  </h3>
                  <p className="ventas-help">
                    Completa los datos para incluirlos en la venta.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="ventas-subsection">
            <div className="ventas-inline-heading">
              <div>
                <h3>
                  {tipoVenta === "servicio"
                    ? "Servicios o reparaciones"
                    : tipoVenta === "producto"
                    ? "Productos"
                    : "Conceptos adicionales"}
                </h3>
                <p className="ventas-help">
                  {tipoVenta === "completa"
                    ? "Agrega otros productos o servicios si hacen parte de la venta."
                    : "El formulario está disponible para registrar los conceptos de esta venta."}
                </p>
              </div>
              <button
                type="button"
                className="ventas-btn ventas-btn-secondary"
                onClick={() =>
                  agregarConcepto(
                    tipoVenta === "servicio" ? "Servicio" : "Producto"
                  )
                }
              >
                + Agregar otro
              </button>
            </div>

            {conceptos.length === 0 && (
              <div className="ventas-empty">
                Todavía no has agregado productos o servicios adicionales.
              </div>
            )}

            {conceptos.map((item) => (
              <div className="ventas-concepto" key={item.id}>
                <label className="ventas-field">
                  Tipo
                  <select
                    value={item.tipo}
                    onChange={(e) =>
                      actualizarConcepto(item.id, "tipo", e.target.value)
                    }
                  >
                    <option>Producto</option>
                    <option>Servicio</option>
                  </select>
                </label>

                <label className="ventas-field">
                  Nombre
                  <input
                    value={item.nombre}
                    onChange={(e) =>
                      actualizarConcepto(item.id, "nombre", e.target.value)
                    }
                    placeholder={
                      item.tipo === "Servicio"
                        ? "Ej. Soldadura"
                        : "Ej. Montura"
                    }
                  />
                </label>

                <label className="ventas-field">
                  Referencia
                  <input
                    value={item.referencia}
                    onChange={(e) =>
                      actualizarConcepto(item.id, "referencia", e.target.value)
                    }
                    placeholder="Opcional"
                  />
                </label>

                <label className="ventas-field">
                  Cantidad
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={item.cantidad}
                    onChange={(e) =>
                      actualizarConcepto(item.id, "cantidad", e.target.value)
                    }
                  />
                </label>

                <CampoDinero
                  label="Precio unitario"
                  value={item.precio}
                  onChange={(valor) =>
                    actualizarConcepto(item.id, "precio", valor)
                  }
                  placeholder="50.000"
                />

                <button
                  type="button"
                  className="ventas-remove"
                  onClick={() => eliminarConcepto(item.id)}
                  aria-label="Eliminar concepto"
                  title="Eliminar concepto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="ventas-card">
          <div className="ventas-section-title">
            <span className="ventas-step">3</span>
            <div>
              <h2>Resumen de venta</h2>
              <p>Verifica los valores antes de registrar el pago.</p>
            </div>
          </div>

          <div className="ventas-resumen">
            {tipoVenta === "completa" && (
              <>
                <div className="ventas-resumen-row">
                  <span>Montura</span>
                  <strong>{dinero(valorMontura && numeroReal(valorMontura))}</strong>
                </div>
                <div className="ventas-resumen-row">
                  <span>Lentes según fórmula</span>
                  <strong>{dinero(numeroReal(valorLentes))}</strong>
                </div>
                <div className="ventas-resumen-row">
                  <span>Filtros</span>
                  <strong>{dinero(numeroReal(valorFiltros))}</strong>
                </div>
              </>
            )}

            {conceptos.map((item) => (
              <div className="ventas-resumen-row" key={item.id}>
                <span>
                  {item.nombre || item.tipo} × {item.cantidad}
                </span>
                <strong>
                  {dinero(
                    (Number(item.cantidad) || 0) * numeroReal(item.precio)
                  )}
                </strong>
              </div>
            ))}

            <div className="ventas-resumen-row">
              <span>Subtotal</span>
              <strong>{dinero(base)}</strong>
            </div>

            <div className="ventas-resumen-row">
              <span>Descuento ({descuento || 0}%)</span>
              <strong>- {dinero(descuentoValor)}</strong>
            </div>

            <div className="ventas-total">
              <span>Total de la venta</span>
              <strong>{dinero(total)}</strong>
            </div>
          </div>

          <CampoPorcentaje value={descuento} onChange={setDescuento} />
        </section>

        <section className="ventas-card">
          <div className="ventas-section-title">
            <span className="ventas-step">4</span>
            <div>
              <h2>Información del pago</h2>
              <p>Registra cuánto paga el cliente y cuánto queda pendiente.</p>
            </div>
          </div>

          <div className="ventas-grid ventas-grid-2">
            <label className="ventas-field">
              Forma de pago
              <select
                value={tipoPago}
                onChange={(e) => setTipoPago(e.target.value)}
              >
                <option value="Contado">Contado</option>
                <option value="Crédito">Crédito</option>
              </select>
            </label>

            <label className="ventas-field">
              Método de pago
              <select
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
                required
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </label>

            {tipoPago === "Crédito" && (
              <label className="ventas-field">
                Número de cuotas *
                <select
                  value={numCuotas}
                  onChange={(e) => setNumCuotas(e.target.value)}
                  required
                >
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n} {n === 1 ? "cuota" : "cuotas"}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <CampoDinero
              label={tipoPago === "Contado" ? "Valor recibido" : "Abono inicial"}
              value={valorAbono}
              onChange={setValorAbono}
              placeholder="100.000"
            />
          </div>

          <label className="ventas-field">
            Observaciones del pago
            <textarea
              rows="3"
              value={observacionesPago}
              onChange={(e) => setObservacionesPago(e.target.value)}
              maxLength={1000}
              placeholder="Notas del pago, referencia de transferencia o acuerdo con el cliente..."
            />
          </label>

          <div className="ventas-pago-resumen">
            <div>
              <span>Abono</span>
              <strong>{dinero(abono)}</strong>
            </div>
            <div>
              <span>Saldo pendiente</span>
              <strong>{dinero(saldo)}</strong>
            </div>
            {tipoPago === "Contado" && cambio > 0 && (
              <div>
                <span>Cambio</span>
                <strong>{dinero(cambio)}</strong>
              </div>
            )}
          </div>
        </section>

        {mensaje && (
          <div className="ventas-mensaje" role="status">
            {mensaje}
          </div>
        )}

        <div className="ventas-acciones">
          <button
            type="button"
            className="ventas-btn ventas-btn-secondary"
            onClick={limpiarFormulario}
            disabled={enviando || Boolean(ventaPendiente) || Boolean(factura)}
          >
            Limpiar formulario
          </button>
          <button
            type="submit"
            className="ventas-btn ventas-btn-primary"
            disabled={enviando || Boolean(ventaPendiente) || Boolean(factura)}
          >
            {enviando ? "Guardando venta..." : "Validar venta"}
          </button>
        </div>
      </form>

      {mostrarConfirmacionFactura && ventaPendiente && (
        <div className="ventas-modal-fondo" role="presentation">
          <section className="ventas-modal" role="dialog" aria-modal="true" aria-labelledby="ventas-confirmacion-titulo">
            <div className="ventas-modal-icono" aria-hidden="true">✓</div>
            <h2 id="ventas-confirmacion-titulo">¡Venta registrada!</h2>
            <p>
              La venta <strong>{ventaPendiente.codigo}</strong> ya está guardada.
              ¿Deseas consultar e imprimir la factura?
            </p>
            {errorFactura && <p className="ventas-error-factura" role="alert">{errorFactura}</p>}
            <div className="ventas-modal-acciones">
              <button
                type="button"
                className="ventas-btn ventas-btn-secondary"
                onClick={finalizarVentaSinImprimir}
                disabled={cargandoFactura}
              >
                No, continuar
              </button>
              <button
                type="button"
                className="ventas-btn ventas-btn-primary"
                onClick={abrirFactura}
                disabled={cargandoFactura}
              >
                {cargandoFactura ? "Consultando factura..." : "Sí, ver factura"}
              </button>
            </div>
          </section>
        </div>
      )}

      {factura && (
        <div className="ventas-modal-fondo ventas-factura-fondo">
          <section className="ventas-factura-panel" role="dialog" aria-modal="true" aria-labelledby="ventas-factura-titulo">
            <div className="ventas-factura-documento">
              <header className="ventas-factura-encabezado">
                <div>
                  <p className="ventas-factura-etiqueta">FACTURA DE VENTA</p>
                  <h2 id="ventas-factura-titulo">{factura.optica_nombre || "Óptica"}</h2>
                  {factura.optica_nit && <p>NIT: {factura.optica_nit}</p>}
                  {factura.optica_telefono && <p>Teléfono: {factura.optica_telefono}</p>}
                  {factura.optica_correo && <p>{factura.optica_correo}</p>}
                  {factura.optica_direccion && <p>{factura.optica_direccion}</p>}
                </div>
                <div className="ventas-factura-numero">
                  <strong>{factura.codigo}</strong>
                  <span>Fecha: {factura.fecha ? new Date(`${factura.fecha}T00:00:00`).toLocaleDateString("es-CO") : "—"}</span>
                  <span>Modalidad: {factura.modalidad || "—"}</span>
                </div>
              </header>

              <div className="ventas-factura-cliente">
                <h3>Datos del cliente</h3>
                <p><strong>Nombre:</strong> {factura.cliente_nombre || "Cliente general"}</p>
                {(factura.cliente_tipo_documento || factura.cliente_documento) && (
                  <p><strong>Documento:</strong> {[factura.cliente_tipo_documento, factura.cliente_documento].filter(Boolean).join(" ")}</p>
                )}
                {factura.cliente_telefono && <p><strong>Teléfono:</strong> {factura.cliente_telefono}</p>}
                {factura.cliente_direccion && <p><strong>Dirección:</strong> {factura.cliente_direccion}</p>}
              </div>

              <div className="ventas-factura-tabla-contenedor">
                <table className="ventas-factura-tabla">
                  <thead>
                    <tr>
                      <th>Descripción</th>
                      <th>Cant.</th>
                      <th>Valor unitario</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(factura.detalles || []).map((item) => (
                      <tr key={item.id_detalle}>
                        <td>
                          <strong>{item.nombre || item.concepto}</strong>
                          {item.descripcion && item.descripcion !== item.nombre && (
                            <small>{item.descripcion}</small>
                          )}
                          {item.referencia && <small>Referencia: {item.referencia}</small>}
                        </td>
                        <td>{item.cantidad}</td>
                        <td>{dinero(item.precio_unitario)}</td>
                        <td>{dinero(item.subtotal)}</td>
                      </tr>
                    ))}
                    {(!factura.detalles || factura.detalles.length === 0) && (
                      <tr><td colSpan="4">No hay conceptos registrados en esta venta.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ventas-factura-resumen">
                <p><span>Total</span><strong>{dinero(factura.total)}</strong></p>
                <p><span>Valor pagado</span><strong>{dinero(factura.valor_pagado)}</strong></p>
                <p><span>Saldo pendiente</span><strong>{dinero(factura.saldo)}</strong></p>
              </div>

              {factura.abonos?.length > 0 && (
                <div className="ventas-factura-abonos">
                  <h3>Pagos registrados</h3>
                  {factura.abonos.map((abono, indice) => (
                    <p key={`${abono.fecha}-${indice}`}>
                      <span>{new Date(abono.fecha).toLocaleDateString("es-CO")} · {abono.metodo_pago || "Pago"}</span>
                      <strong>{dinero(abono.valor)}</strong>
                    </p>
                  ))}
                </div>
              )}

              {factura.vendedor && <p className="ventas-factura-vendedor">Atendido por: {factura.vendedor}</p>}
              {factura.observacion && <p className="ventas-factura-observacion"><strong>Observaciones:</strong> {factura.observacion}</p>}
              <footer className="ventas-factura-pie">Gracias por confiar en nosotros.</footer>
            </div>

            <div className="ventas-factura-acciones no-imprimir">
              <button type="button" className="ventas-btn ventas-btn-secondary" onClick={finalizarVentaSinImprimir}>
                Finalizar sin imprimir
              </button>
              <button type="button" className="ventas-btn ventas-btn-primary" onClick={imprimirFactura}>
                Imprimir factura
              </button>
            </div>
            <p className="ventas-factura-ayuda no-imprimir">
              Al cerrar el diálogo de impresión, el formulario se limpiará automáticamente. También puedes finalizar manualmente.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
