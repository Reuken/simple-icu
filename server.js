// server.js - Versión con sistema de permisos
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const fs = require('fs');
const { pool, testConnection } = require('./config/database');
const { Usuario, SistemaUsuarios, Facultad, Comision } = require('./models/User');
const DocumentController = require('./controllers/DocumentController');
const ReportController = require('./controllers/ReportController');
const { iniciarCronJobs } = require('./services/cronService');

require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;

app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'icu-sskey',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, 
    sameSite: 'lax'
  }
}));

// Middlewares básicos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const appRoutes = require('./routes/index');
app.use('/', appRoutes);

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Usuario: ${req.session.usuario?.nombre || 'Anónimo'}`);
  next();
});

// =================== RUTAS ===================
// Montamos todas las rutas que extrajimos
app.use('/', appRoutes);

// =================== MANEJO DE ERRORES GLOBALES ===================
app.use((req, res) => {
  res.status(404).send(`
    <html><head><title>Página no encontrada</title><link rel="stylesheet" href="/estilos.css"></head>
    <body><div class="container"><h1>404 - Página no encontrada</h1><a href="/dashboard" class="cta-button">Volver al dashboard</a></div></body></html>
  `);
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).send(`
    <html><head><title>Error del servidor</title><link rel="stylesheet" href="/estilos.css"></head>
    <body><div class="container"><h1>Error interno del servidor</h1><a href="/dashboard" class="cta-button">Volver al dashboard</a></div></body></html>
  `);
});

// Iniciar servidor
async function startServer() {
  try {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se puede conectar a PostgreSQL');
    }

    app.listen(port, () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
      console.log(`📊 Dashboard: http://localhost:${port}/dashboard`);
      console.log(`👥 Usuarios: http://localhost:${port}/usuarios`);
      console.log(`📄 Documentos: http://localhost:${port}/documentos`);
      console.log(`🏛️ Comisiones: http://localhost:${port}/comisiones`);
      console.log(`📊 Reportes: http://localhost:${port}/reportes`);
      console.log(`🎓 Facultades: http://localhost:${port}/facultades`);
      
      console.log('\n=== PERMISOS DEL SISTEMA ===');
      console.log('👑 Administrativos: Acceso total');
      console.log('👁️  Consejeros: Solo lectura');
      
      console.log('\n✅ Sistema ICU iniciado');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

startServer();