import { useCallback, useEffect, useRef, useState } from "react";
import "../css/configuracion.css";
import { pedir } from "../api";
import Icono from "./icono";

const datosIniciales = {
  nombre: "",
  nit: "",
  direccion: "",
  telefono: "",
  correo: "",
  moneda: "COP",
  logo_data: "",
};

export default function Configuracion({ sesion, onSalir }) {
  const [pestana, setPestana] = useState("negocio");
  const [datos, setDatos] = useState(datosIniciales);
  const [original, setOriginal] = useState(datosIniciales);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const archivoRef = useRef(null);
  // Administración de usuarios
  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: "",
    correo: "",
    password: "",
  });

  useEffect(() => {
    const control = new AbortController();

    pedir("/privado/configuracion", {
      token: sesion.token,
      signal: control.signal,
    })
      .then((respuesta) => {
        const negocio = { ...datosIniciales, ...respuesta.negocio };
        setDatos(negocio);
        setOriginal(negocio);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;

        if (e.estado === 401 || e.estado === 403) {
          onSalir();
          return;
        }

        setError(e.message || "No se pudo cargar la configuración.");
      })
      .finally(() => setCargando(false));

    return () => control.abort();
  }, [sesion.token, onSalir]);

  function cambiar(campo, valor) {
    setDatos((actual) => ({ ...actual, [campo]: valor }));
    setMensaje("");
  }
  const cargarUsuarios = useCallback(async () => {
    setCargandoUsuarios(true);
    setError("");

    try {
      const respuesta = await pedir("/privado/usuarios", {
        token: sesion.token,
      });

      setUsuarios(respuesta.usuarios || []);
    } catch (e) {
      if (e.estado === 401 || e.estado === 403) {
        onSalir();
        return;
      }

      setError(e.message || "No se pudieron cargar los usuarios.");
    } finally {
      setCargandoUsuarios(false);
    }
  }, [sesion.token, onSalir]);

  // Cargar usuarios al abrir la pestaña correspondiente.
  useEffect(() => {
    if (pestana === "usuarios") {
      cargarUsuarios();
    }
  }, [pestana, cargarUsuarios]);

  async function crearUsuario(evento) {
    evento.preventDefault();
    setGuardandoUsuario(true);
    setError("");
    setMensaje("");

    try {
      await pedir("/privado/usuarios", {
        token: sesion.token,
        metodo: "POST",
        cuerpo: nuevoUsuario,
      });

      setNuevoUsuario({ nombre: "", correo: "", password: "" });
      setMostrarPassword(false);
      setMostrarFormulario(false);
      setMensaje("Empleado creado correctamente.");
      await cargarUsuarios();
    } catch (e) {
      if (e.estado === 401 || e.estado === 403) {
        onSalir();
        return;
      }

      setError(e.message || "No se pudo crear el empleado.");
    } finally {
      setGuardandoUsuario(false);
    }
  }



  function cargarLogo(evento) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type)) {
      setError("Selecciona una imagen PNG, JPG o WEBP.");
      evento.target.value = "";
      return;
    }

    if (archivo.size > 1.4 * 1024 * 1024) {
      setError("La imagen debe pesar máximo 1,4 MB.");
      evento.target.value = "";
      return;
    }

    const lector = new FileReader();

    lector.onload = () => {
      cambiar("logo_data", lector.result);
      setError("");
    };

    lector.onerror = () => setError("No se pudo leer la imagen.");
    lector.readAsDataURL(archivo);
    evento.target.value = "";
  }

  async function guardar() {
    setGuardando(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await pedir("/privado/configuracion", {
        token: sesion.token,
        metodo: "PUT",
        cuerpo: datos,
      });

      const negocio = { ...datosIniciales, ...respuesta.negocio };
      setDatos(negocio);
      setOriginal(negocio);
      setMensaje("Los cambios se guardaron correctamente.");
    } catch (e) {
      if (e.estado === 401 || e.estado === 403) {
        onSalir();
        return;
      }

      setError(e.message || "No se pudieron guardar los cambios.");
    } finally {
      setGuardando(false);
    }
  }

  function cancelar() {
    setDatos(original);
    setError("");
    setMensaje("");
  }

  if (cargando) {
    return <div className="config-cargando">Cargando configuración...</div>;
  }

  return (
    <section className="configuracion">
      <header className="config-header">
        <div>
          <h1>Configuración</h1>
          <p>Administra la información de tu óptica.</p>
        </div>
      </header>

      <nav className="config-tabs">
        <button
          className={pestana === "negocio" ? "seleccionada" : ""}
          onClick={() => setPestana("negocio")}
        >
          <Icono nombre="box" /> Datos del negocio
        </button>

        <button
          className={pestana === "usuarios" ? "seleccionada" : ""}
          onClick={() => setPestana("usuarios")}
        >
          <Icono nombre="users" /> Usuarios y permisos
        </button>

        <button
          className={pestana === "preferencias" ? "seleccionada" : ""}
          onClick={() => setPestana("preferencias")}
        >
          <Icono nombre="gear" /> Preferencias
        </button>
      </nav>

      {error && <div className="config-alerta error">{error}</div>}
      {mensaje && <div className="config-alerta exito">{mensaje}</div>}

      {pestana === "negocio" && (
        <>
          <div className="config-contenido">
            <div className="config-card">
              <h2>Información del negocio</h2>

              <label>
                Nombre del negocio *
                <input
                  value={datos.nombre}
                  onChange={(e) => cambiar("nombre", e.target.value)}
                  placeholder="Nombre de la óptica"
                />
              </label>

              <label>
                NIT / RUT
                <input
                  value={datos.nit || ""}
                  onChange={(e) => cambiar("nit", e.target.value)}
                  placeholder="Identificación tributaria"
                />
              </label>

              <label>
                Dirección
                <input
                  value={datos.direccion || ""}
                  onChange={(e) => cambiar("direccion", e.target.value)}
                  placeholder="Dirección del establecimiento"
                />
              </label>

              <div className="config-dos-columnas">
                <label>
                  Teléfono
                  <input
                    value={datos.telefono || ""}
                    onChange={(e) => cambiar("telefono", e.target.value)}
                    placeholder="Teléfono"
                  />
                </label>

                <label>
                  Correo electrónico
                  <input
                    type="email"
                    value={datos.correo || ""}
                    onChange={(e) => cambiar("correo", e.target.value)}
                    placeholder="Correo"
                  />
                </label>
              </div>

              <label>
                Moneda
                <select
                  value={datos.moneda}
                  onChange={(e) => cambiar("moneda", e.target.value)}
                >
                  <option value="COP">Peso colombiano (COP)</option>
                  <option value="USD">Dólar estadounidense (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                </select>
              </label>
            </div>

            <div className="config-columna-derecha">
              <div className="config-card">
                <h2>Logotipo del negocio</h2>
                <p>Sube el logo que identificará a tu óptica.</p>

                <div className="config-vista-logo">
                  {datos.logo_data ? (
                    <img src={datos.logo_data} alt="Logo de la óptica" />
                  ) : (
                    <div className="config-logo-vacio">
                      <Icono nombre="eye" tamano={42} />
                      <span>Sin logotipo</span>
                    </div>
                  )}
                </div>

                <input
                  ref={archivoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={cargarLogo}
                />

                <div className="config-botones-logo">
                  <button
                    type="button"
                    className="config-btn-secundario"
                    onClick={() => archivoRef.current?.click()}
                  >
                    Subir / cambiar logo
                  </button>

                  <button
                    type="button"
                    className="config-btn-claro"
                    onClick={() => cambiar("logo_data", "")}
                    disabled={!datos.logo_data}
                  >
                    Quitar logo
                  </button>
                </div>
              </div>

              <div className="config-card">
                <h2>Sucursal</h2>
                <div className="config-sede">
                  <strong>Sede principal</strong>
                  <span>Activa</span>
                </div>
                <p>Actualmente el sistema trabaja con una sola sede.</p>
              </div>
            </div>
          </div>

          <div className="config-acciones">
            <button className="config-btn-claro" onClick={cancelar}>
              Cancelar
            </button>

            <button
              className="config-btn-guardar"
              onClick={guardar}
              disabled={guardando}
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </>
      )}

      {pestana === "usuarios" && (
        <div className="config-card config-seccion">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2>Usuarios y permisos</h2>
              <p>Administra los usuarios que pueden acceder a tu óptica.</p>
            </div>

            <button
              type="button"
              className={
                mostrarFormulario
                  ? "config-btn-cancelar-usuario"
                  : "config-btn-crear-usuario"
              }
              onClick={() => {
                setMostrarFormulario((actual) => {
                  const siguiente = !actual;
                  if (!siguiente) {
                    setNuevoUsuario({ nombre: "", correo: "", password: "" });
                    setMostrarPassword(false);
                  }
                  return siguiente;
                });
                setError("");
                setMensaje("");
              }}
              disabled={guardandoUsuario}
            >
              {mostrarFormulario ? "Cancelar" : "+ Crear empleado"}
            </button>
          </div>

          {mostrarFormulario && (
            <form onSubmit={crearUsuario} style={{ marginTop: "22px" }}>
              <h3>Registrar empleado</h3>

              <label>
                Nombre completo *
                <input
                  type="text"
                  value={nuevoUsuario.nombre}
                  onChange={(e) =>
                    setNuevoUsuario((actual) => ({
                      ...actual,
                      nombre: e.target.value,
                    }))
                  }
                  maxLength={120}
                  required
                  placeholder="Nombre del empleado"
                />
              </label>

              <label>
                Correo electrónico *
                <input
                  type="email"
                  value={nuevoUsuario.correo}
                  onChange={(e) =>
                    setNuevoUsuario((actual) => ({
                      ...actual,
                      correo: e.target.value,
                    }))
                  }
                  required
                  placeholder="empleado@correo.com"
                />
              </label>

              <label className="config-password-label">
                Contraseña *
                <div className="config-password-contenedor">
                  <input
                    type={mostrarPassword ? "text" : "password"}
                    value={nuevoUsuario.password}
                    onChange={(e) =>
                      setNuevoUsuario((actual) => ({
                        ...actual,
                        password: e.target.value,
                      }))
                    }
                    minLength={12}
                    maxLength={72}
                    required
                    placeholder="Mínimo 12 caracteres"
                  />

                  <button
                    type="button"
                    className="config-password-toggle"
                    onClick={() => setMostrarPassword((actual) => !actual)}
                    aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <Icono nombre={mostrarPassword ? "eye-off" : "eye"} />
                  </button>
                </div>
              </label>

              <p className="config-nota">
                El rol de empleado y la óptica se asignan automáticamente.
              </p>

              <button
                type="submit"
                className="config-btn-crear-usuario"
                disabled={guardandoUsuario}
              >
                {guardandoUsuario ? "Creando..." : "Guardar empleado"}
              </button>
            </form>
          )}

          <div style={{ marginTop: "25px" }}>
            <h3>Usuarios registrados</h3>

            {cargandoUsuarios ? (
              <p>Cargando usuarios...</p>
            ) : usuarios.length === 0 ? (
              <p>No hay usuarios registrados.</p>
            ) : (
              usuarios.map((usuario) => (
                <div className="config-rol config-usuario-card" key={usuario.id}>
                  <strong>{usuario.nombre}</strong>
                  <span>{usuario.correo}</span>
                  <span>
                    Rol: {usuario.rol === "admin" ? "Administrador" : usuario.rol}
                  </span>
                  <span>Estado: {usuario.estado}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {pestana === "preferencias" && (
        <div className="config-card config-seccion">
          <h2>Preferencias del sistema</h2>
          <p>
            La moneda se configura en Datos del negocio. Por ahora se trabaja
            con una única sede principal.
          </p>
        </div>
      )}
    </section>
  );
}
