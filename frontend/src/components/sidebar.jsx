import { useState } from "react";
import Icono from "./icono";
import { iniciales } from "../utils";

const MENU = [
  { id: "inicio", texto: "Inicio", icono: "home", ok: true },
  { id: "venta", texto: "Registrar venta", icono: "cart", ok: true },
  {
    id: "productos",
    texto: "Productos",
    icono: "box",
    hijos: [
      {
        id: "inventario",
        texto: "Inventario",
        icono: "list",
        ok: true,
      },
      { id: "movimientos", texto: "Movimientos", icono: "swap", ok: true }
    ],
  },
  {
    id: "credito",
    texto: "Crédito y abonos",
    icono: "card",
    ok: true,
  },
  {
    id: "cartera",
    texto: "Cartera",
    icono: "wallet",
    ok: true,
  },
  {
    id: "clientes",
    texto: "Clientes",
    icono: "users",
    ok: true,
  },
  {
    id: "costos",
    texto: "Costos y ganancias",
    icono: "coin",
    ok: true,
  },
  {
    id: "balance",
    texto: "Balance mensual",
    icono: "chart",
    ok: true,
  },
  {
    id: "config",
    texto: "Configuración",
    icono: "gear",
    ok: true,
  },
];

const ROLES = {
  admin: "Administrador",
  optometrista: "Optometrista",
  empleado: "Empleado",
};
const MODULOS_EMPLEADO = ["venta", "inventario"];

export default function Sidebar({
  optica,
  logo,
  usuario,
  activo,
  onNavegar,
  onSalir,
})  {
  const [productosAbierto, setProductosAbierto] = useState(true);
  const esEmpleado = usuario?.rol === "empleado";

const menuVisible = MENU
  .map((item) => {
    if (!esEmpleado) return item;

    if (item.hijos) {
      const hijosPermitidos = item.hijos.filter((hijo) =>
        MODULOS_EMPLEADO.includes(hijo.id)
      );

      return hijosPermitidos.length > 0
        ? { ...item, hijos: hijosPermitidos }
        : null;
    }

    return MODULOS_EMPLEADO.includes(item.id) ? item : null;
  })
  .filter(Boolean);

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
    <span className="sidebar-brand-icon">
      {logo ? (
      <img
      src={logo}
      alt="Logo de la óptica"
      className="sidebar-brand-logo"
        />
      ) : (
    <Icono nombre="eye" tamano={20} />
  )}
    </span>

        <div>
          <strong>{optica || "Cargando..."}</strong>
          <small>Sistema de Gestión</small>
        </div>
      </div>

      <nav className="sidebar-menu" aria-label="Menú principal">
        {menuVisible.map((item) =>
          item.hijos ? (
            <div key={item.id} className="sidebar-grupo">
              <button
                type="button"
                className={`sidebar-item ${
                  item.hijos.some((hijo) => hijo.id === activo)
                    ? "grupo-activo"
                    : ""
                }`}
                aria-expanded={productosAbierto}
                onClick={() =>
                  setProductosAbierto((abierto) => !abierto)
                }
              >
                <Icono nombre={item.icono} />
                <span>{item.texto}</span>

                <span
                  className={`sidebar-chevron ${
                    productosAbierto ? "abierto" : ""
                  }`}
                >
                  <Icono nombre="chevron" tamano={14} />
                </span>
              </button>

              {productosAbierto && (
                <div className="sidebar-submenu">
                  {item.hijos.map((hijo) => (
                    <ItemMenu
                      key={hijo.id}
                      item={hijo}
                      activo={activo}
                      onNavegar={onNavegar}
                      sub
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <ItemMenu
              key={item.id}
              item={item}
              activo={activo}
              onNavegar={onNavegar}
            />
          )
        )}
      </nav>

      <div className="sidebar-user">
        <span className="sidebar-avatar">
          {iniciales(usuario?.nombre)}
        </span>

        <div className="sidebar-user-info">
          <strong>{usuario?.nombre || "Usuario"}</strong>
          <small>
            {ROLES[usuario?.rol] || usuario?.rol || ""}
          </small>
        </div>

        <button
          type="button"
          className="sidebar-salir"
          onClick={onSalir}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <Icono nombre="out" />
        </button>
      </div>
    </aside>
  );
}

function ItemMenu({ item, activo, onNavegar, sub = false }) {
  const esActivo = item.id === activo;

  return (
    <button
      type="button"
      className={`sidebar-item ${sub ? "sub" : ""} ${
        esActivo ? "activo" : ""
      }`}
      disabled={!item.ok}
      title={item.ok ? undefined : "Próximamente"}
      aria-current={esActivo ? "page" : undefined}
      onClick={() => onNavegar(item.id)}
    >
      <Icono nombre={item.icono} tamano={sub ? 16 : 18} />
      <span>{item.texto}</span>
    </button>
  );
}
