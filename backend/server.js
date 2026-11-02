
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const pool = require("./database");
const authRoutes = require("./routes/auth");
const privadoRoutes = require("./routes/privado");
const { autenticar } = require("./middleware/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("Configura JWT_SECRET con al menos 32 caracteres.");
}

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "3mb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: (req) => req.path.startsWith("/privado"),
});

app.use("/api", limiter);

const limiterPrivado = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1500,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

app.use("/api/privado", limiterPrivado);

// Registrar las peticiones.
app.use((req, res, next) => {
  console.log("PETICIÓN:", req.method, req.originalUrl);
  next();
});

// Rutas públicas.
app.get("/api/health", (req, res) => {
  res.status(200).json({
    estado: "ok",
    mensaje: "API funcionando",
  });
});

app.use("/api/auth", authRoutes);

// Rutas protegidas.
app.use("/api/privado", privadoRoutes);

app.get("/api/health/db", autenticar, async (req, res, next) => {
  try {
    const resultado = await pool.query(
      "SELECT current_database() AS base_datos"
    );

    res.json({
      estado: "ok",
      baseDatos: resultado.rows[0].base_datos,
      mensaje: "Conexión autorizada",
    });
  } catch (error) {
    next(error);
  }
});

// Ruta no encontrada.
app.use((req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    ruta: req.originalUrl,
  });
});

// Manejador de errores: mostrar detalle en la terminal.
app.use((err, req, res, next) => {
  console.error("\n========== ERROR DEL BACKEND ==========");
  console.error("Ruta:", req.method, req.originalUrl);
  console.error("Mensaje:", err.message);
  console.error("Código PostgreSQL:", err.code || "N/A");
  console.error("Detalle:", err.detail || "N/A");
  console.error("Pila:", err.stack);
  console.error("=======================================\n");

  if (res.headersSent) {
    return next(err);
  }

    res.status(500).json({
    error: "Error interno del servidor",
    ...(process.env.NODE_ENV !== "production" && {
      detalle: err.message,
      codigo: err.code || null,
    }),
  });
});

// Iniciar servidor.
app.listen(PORT, () => {
  console.log(`API disponible en http://localhost:${PORT}`);
});
