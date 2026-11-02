/* Etiqueta + control + mensaje de error/ayuda. El `id` debe coincidir con el del control. */
export default function Campo({ id, etiqueta, requerido, error, ayuda, children }) {
  return (
    <div className={`campo ${error ? "con-error" : ""}`}>
      <label htmlFor={id}>
        {etiqueta}
        {requerido && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {ayuda && !error && <small className="campo-ayuda">{ayuda}</small>}
      {error && (
        <small id={`${id}-error`} className="campo-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}