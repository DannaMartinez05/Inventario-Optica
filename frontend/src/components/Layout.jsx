
import { useCallback, useEffect, useState } from "react";
import "../css/dashboard.css";
import { pedir } from "../api";
import Sidebar from "./Sidebar";
import Balance from "./balance";
import Inventario from "./inventario";
import RegistrarProducto from "./RegistrarProducto";
import Ventas from "./Ventas";
import Clientes from "./clientes";
import Credito from "./credito";
import Cartera from "./cartera";
import Costos from "./costos";
import Movimientos from "./movimientos";
import Inicio from "./inicio";
import Configuracion from "./configuracion";


// Identificadores de las pantallas disponibles.
const VISTAS_MENU = [
  "inicio",
  "balance",
  "inventario",
  "movimientos",
  "clientes",
  "credito",
  "cartera",
  "costos",
  "config",
];

export default function Layout({ sesion, onSalir }) {
  const [optica, setOptica] = useState("");
  const [logo, setLogo] = useState(null);
  const esEmpleado = sesion.usuario?.rol === "empleado";

  const [vista, setVista] = useState(
      esEmpleado ? "venta" : "inicio"
    );
  const [aviso, setAviso] = useState("");
  const [ventaAbierta, setVentaAbierta] = useState(
  sesion.usuario?.rol === "empleado"
  );
  const [foco, setFoco] = useState(0);

  // Consultar el nombre de la óptica.
  useEffect(() => {
    const control = new AbortController();

    pedir("/privado/optica", {
      token: sesion.token,
      signal: control.signal,
    })
      .then((datos) => {
        setOptica(datos.optica?.nombre || "");
        setLogo(datos.optica?.logo_data || null);
      })
      .catch((error) => {
        if (error.name === "AbortError") return;

        if (error.estado === 401 || error.estado === 403) {
          onSalir();
          return;
        }

        setOptica("Sin conexión");
      });

    return () => control.abort();
  }, [sesion.token, onSalir]);

  // Cambiar de pantalla desde el menú lateral.
  const navegar = useCallback((id) => {
    setAviso("");
    if (
    sesion.usuario?.rol === "empleado" &&
    !["venta", "inventario"].includes(id)
  ) {
    return;
  }

   if (id === "inicio") {
   if (sesion.usuario?.rol === "empleado") return;

    setVista("inicio");
    return;
  }

    if (VISTAS_MENU.includes(id)) {
      setVista(id);
      return;
    }

    if (id === "venta") {
      setVentaAbierta(true);
      setVista("venta");
      return;
    }

    if (id === "buscar") {
      setVista("inventario");
      setFoco((anterior) => anterior + 1);
    }
  }, []);

  // Mostrar confirmación cuando se registra un producto.
  const productoGuardado = useCallback((producto) => {
    setAviso(
      `Producto «${producto.nombre}» registrado con el código ${producto.codigo}.`
    );
    setVista("inventario");
  }, [sesion.usuario?.rol]);

  // Mantener resaltada la opción correcta del menú.
 const activo =
  vista === "producto-nuevo"
    ? "inventario"
    : vista;

  return (
    <div className="dash-layout">
      <Sidebar
        optica={optica}
        logo={logo}
        usuario={sesion.usuario}
        activo={activo}
        onNavegar={navegar}
        onSalir={onSalir}
      />

      <main className="dash-main">
         {vista === "inicio" && (
          <Inicio
            sesion={sesion}
            onSalir={onSalir}
            onNavegar={navegar}
          />
        )}
        
          {vista === "balance" && (
            <Balance sesion={sesion} onSalir={onSalir} />
          )}

        {ventaAbierta && (
          <div style={{ display: vista === "venta" ? "block" : "none" }}>
            <Ventas sesion={sesion} onSalir={onSalir} />
          </div>
        )}

        {vista === "inventario" && (
          <Inventario
            sesion={sesion}
            onSalir={onSalir}
            onNuevo={() => {
              setAviso("");
              setVista("producto-nuevo");
            }}
            aviso={aviso}
            onCerrarAviso={() => setAviso("")}
            foco={foco}
          />
        )}
        {vista === "movimientos" && (
          <Movimientos sesion={sesion} onSalir={onSalir} />
        )}

        {vista === "producto-nuevo" && (
          <RegistrarProducto
            sesion={sesion}
            onSalir={onSalir}
            onCancelar={() => setVista("inventario")}
            onGuardado={productoGuardado}
          />
        )}

        {vista === "clientes" && (
          <Clientes sesion={sesion} onSalir={onSalir} />
        )}

        {vista === "credito" && (
          <Credito sesion={sesion} onSalir={onSalir} />
        )}

        {vista === "cartera" && (
          <Cartera sesion={sesion} onSalir={onSalir} />
        )}

        {vista === "costos" && (
          <Costos sesion={sesion} onSalir={onSalir} />
        )}
        {vista === "config" && (
          <Configuracion sesion={sesion} onSalir={onSalir} />
        )}
      </main>
    </div>
  );
}
