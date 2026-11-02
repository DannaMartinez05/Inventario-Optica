import { useEffect, useRef } from "react";
import Icono from "./icono";

/* Ventana modal con <dialog>: foco atrapado, Escape y clic fuera para cerrar. */
export default function Modal({ titulo, onCerrar, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
    >
      <div className="modal-caja">
        <header className="modal-cabecera">
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="aviso-cerrar" aria-label="Cerrar" onClick={onCerrar}>
            <Icono nombre="close" tamano={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}