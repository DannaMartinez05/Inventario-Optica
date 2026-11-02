// Búsqueda sin importar mayúsculas ni tildes: "optica" encuentra "Óptica".
const sinTildes = (texto) =>
  texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Mismo tratamiento del lado de SQL.
const sqlNorm = (col) =>
  `lower(translate(${col}, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))`;

// Escapa % _ \ para usarlos dentro de un LIKE.
const escaparLike = (texto) => texto.replace(/[\\%_]/g, "\\$&");

// "ana lópez" -> ["ana", "lopez"] (máx. 5 palabras)
const terminosDe = (q) =>
  sinTildes((q || "").trim()).split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 50));

module.exports = { sinTildes, sqlNorm, escaparLike, terminosDe };