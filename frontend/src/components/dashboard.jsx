import Layout from "./Layout";
import "../css/dashboard.css";

export default function Dashboard({ sesion, onSalir }) {
  return (
    <Layout
      sesion={sesion}
      onSalir={onSalir}
    />
  );
}
