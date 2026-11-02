import { useCallback, useState } from "react";
import Login from "./components/Login";
import Dashboard from "./components/dashboard";
import { leerSesion, cerrarSesion } from "./sesion";
import "./App.css";

function App() {
  const [sesion, setSesion] = useState(() => leerSesion());

  const salir = useCallback(() => {
    cerrarSesion();
    setSesion(null);
  }, []);

  if (!sesion) {
    return <Login onLogin={() => setSesion(leerSesion())} />;
  }

  return <Dashboard sesion={sesion} onSalir={salir} />;
}

export default App;
