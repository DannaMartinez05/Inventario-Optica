
import { useState } from "react";
import "../css/Login.css";
import logo from "../assets/logo.png";

const API_URL = "http://localhost:3000/api/auth";

export default function Login({ onLogin }) {
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [recordarme, setRecordarme] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  async function iniciarSesion(e) {
    e.preventDefault();
    setError("");
    setExito("");
    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correo: correo.trim(),
          password,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          datos.error || datos.mensaje || "No fue posible iniciar sesión."
        );
      }

      if (!datos.token) {
        throw new Error("El servidor no devolvió un token.");
      }

      const destino = recordarme ? localStorage : sessionStorage;
      const otro = recordarme ? sessionStorage : localStorage;

      otro.removeItem("token");
      otro.removeItem("usuario");

      destino.setItem("token", datos.token);
      destino.setItem("usuario", JSON.stringify(datos.usuario));

      // Avisa a App que ya hay sesión: App muestra el dashboard.
      onLogin?.();

      setExito(
        `Bienvenido${datos.usuario?.nombre ? `, ${datos.usuario.nombre}` : ""}`
      );
      setPassword("");
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "No se pudo conectar con el servidor."
          : err.message
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-layout">
      <section className="login-showcase">
        <div className="showcase-overlay" />

        <div className="showcase-brand">
          <img
            src={logo}
            alt="Óptica Ocadhas"
            className="showcase-logo"
          />
        </div>
      </section>

      <section className="login-panel">
        <div className="login-form-container">
          <header className="login-brand-mobile">
            <img src={logo} alt="Óptica Ocadhas" />
            <span>SISTEMA DE GESTIÓN</span>
          </header>

          <div className="login-heading">
            <span className="login-eyebrow">BIENVENIDO DE NUEVO</span>
            <h1>Iniciar sesión</h1>
            <p>Ingresa a tu cuenta para continuar</p>
          </div>

          <form onSubmit={iniciarSesion}>
            <div className="login-input-group">
              <label htmlFor="correo">Correo electrónico</label>
              <div className="login-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m4 7 8 6 8-6" />
                </svg>
                <input
                  id="correo"
                  type="email"
                  placeholder="nombre@correo.com"
                  autoComplete="username"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="login-input-group">
              <label htmlFor="password">Contraseña</label>
              <div className="login-input">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  <path d="M12 14v3" />
                </svg>
                <input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  placeholder="Ingresa tu contraseña"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  aria-label={
                    mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  title={
                    mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.2 9.5 7-.4 1.1-1.2 2.3-2.3 3.4M6.2 6.2C3.9 7.7 2.7 9.7 2.5 12c.6 1.8 2.1 3.7 4.5 5.2A10 10 0 0 0 12 19c.8 0 1.6-.1 2.3-.3" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="login-options">
              <label className="remember-option">
                <input
                  type="checkbox"
                  checked={recordarme}
                  onChange={(e) => setRecordarme(e.target.checked)}
                />
                <span>Recordarme</span>
              </label>

              <button
                type="button"
                className="forgot-link"
                onClick={() =>
                  setError(
                    "Contacta al administrador para recuperar tu contraseña."
                  )
                }
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {error && (
              <div className="login-message login-error" role="alert">
                {error}
              </div>
            )}

            {exito && (
              <div className="login-message login-success" role="status">
                {exito}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={cargando}
            >
              <span>
                {cargando ? "Verificando acceso..." : "Iniciar sesión"}
              </span>
              {!cargando && (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </form>

          <footer className="login-footer">
            <span className="footer-status" />
            Acceso seguro al sistema de gestión
          </footer>
        </div>
      </section>
    </main>
  );
}