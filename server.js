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
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/documents/';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// Configurar sesiones con PostgreSQL
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'icu-secret-key-2024-super-secure',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de autenticación
function requireAuth(req, res, next) {
  if (req.session.usuario) {
    next();
  } else {
    res.redirect('/login.html?error=auth_required');
  }
}

// Middleware de autorización por rol
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (roles.includes(req.session.usuario.tipo_usuario) || roles.includes(req.session.usuario.rol)) {
      next();
    } else {
      res.redirect('/dashboard');
  }
  };
}

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Usuario: ${req.session.usuario?.nombre || 'Anónimo'}`);
  next();
});

// Ruta de inicio
app.get('/', async (req, res, next) => {
  try {
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('No se puede conectar a la base de datos');
    }
    next();
  } catch (error) {
    res.status(500).send(`
      <html>
      <head>
        <title>Error del Sistema</title>
        <link rel="stylesheet" href="estilos.css">
      </head>
      <body>
        <div class="container">
          <h1>Error del Sistema</h1>
          <p>No se puede conectar a la base de datos. Por favor, contacte al administrador.</p>
          <p><strong>Error:</strong> ${error.message}</p>
        </div>
      </body>
      </html>
    `);
  }
}, express.static(path.join(__dirname, 'public')));

// Ruta de login
app.post('/login', async (req, res) => {
  try {
    const { codigo, contrasena } = req.body;
    
    if (!codigo || !contrasena) {
      return res.status(400).send(`
        <html>
        <head>
          <title>Error de Login</title>
          <link rel="stylesheet" href="estilos.css">
        </head>
        <body>
          <div class="container">
            <h1>Error de Validación</h1>
            <p>Por favor, complete todos los campos.</p>
            <a href="/login.html" class="cta-button">Intentar de nuevo</a>
          </div>
        </body>
        </html>
      `);
    }

    const usuario = await Usuario.authenticate(parseInt(codigo), contrasena);
    
    if (usuario) {
      const datosCompletos = await usuario.getCompleteData();
      const comisiones = await usuario.getComisiones();

      req.session.usuario = {
        id: datosCompletos.id,
        codigo: datosCompletos.codigo,
        nombre: datosCompletos.nombre,
        email: datosCompletos.email,
        rol: datosCompletos.rol,
        descripcion_rol: datosCompletos.descripcion_rol,
        tipo_usuario: datosCompletos.tipo_usuario,
        comisiones: comisiones,
        login_time: new Date().toISOString(),
        permisos: getPermisos(datosCompletos.tipo_usuario, datosCompletos.rol)
      };

      console.log(`✅ Login exitoso: ${datosCompletos.nombre} (${datosCompletos.codigo})`);
      res.redirect('/dashboard');
    } else {
      console.log(`❌ Login fallido para código: ${codigo}`);
      res.status(401).send(`
        <html>
        <head>
          <title>Error de Login</title>
          <link rel="stylesheet" href="estilos.css">
        </head>
        <body>
          <div class="container">
            <h1>Error de Autenticación</h1>
            <p>Código o contraseña incorrectos.</p>
            <a href="/login.html" class="cta-button">Intentar de nuevo</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).send(`
      <html>
      <head>
        <title>Error del Sistema</title>
        <link rel="stylesheet" href="estilos.css">
      </head>
      <body>
        <div class="container">
          <h1>Error del Sistema</h1>
          <p>Ocurrió un error interno. Por favor, intente más tarde.</p>
          <a href="/login.html" class="cta-button">Volver al Login</a>
        </div>
      </body>
      </html>
    `);
  }
});

// Función para obtener permisos según el rol
function getPermisos(tipo_usuario, rol) {
  const permisos = {
    ver_usuarios: false,
    crear_usuarios: false,
    ver_documentos: false,
    subir_documentos: false,
    ver_comisiones: false,
    gestionar_comisiones: false,
    ver_reportes: false,
    generar_reportes: false,
    ver_facultades: false,
    gestionar_facultades: false,
    ver_mi_espacio: false
  };

  if (tipo_usuario === 'administrativo') {
    // Administrativos tienen todos los permisos
    Object.keys(permisos).forEach(key => {
      permisos[key] = true;
    });
  } else if (tipo_usuario === 'consejero') {
    // Consejeros solo pueden ver, no gestionar
    permisos.ver_documentos = true;
    permisos.ver_comisiones = true;
    permisos.ver_facultades = true;
    permisos.ver_mi_espacio = true;
  }

  return permisos;
}

// Dashboard con permisos
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const stats = await SistemaUsuarios.getStats();
    const permisos = usuario.permisos;
    
    // Generar tarjetas según permisos
    let accionesHtml = '';
    
    if (permisos.ver_usuarios) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/usuarios'">
          <h4>👥 Usuarios</h4>
          <p>Gestionar usuarios del sistema</p>
          ${permisos.crear_usuarios ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}
        </div>
      `;
    }

    if (permisos.ver_documentos) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/documentos'">
          <h4>📄 Documentos</h4>
          <p>Gestionar documentos del ICU</p>
          ${permisos.subir_documentos ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}
        </div>
      `;
    }

    if (permisos.ver_comisiones) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/comisiones'">
          <h4>🏛️ Comisiones</h4>
          <p>Ver todas las comisiones</p>
          <span class="perm-badge view-only">👁️ Solo lectura</span>
        </div>
      `;
    }

    if (permisos.ver_reportes) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/reportes'">
          <h4>📊 Reportes</h4>
          <p>Ver reportes y análisis NLP</p>
          ${permisos.generar_reportes ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}
        </div>
      `;
    }

    if (permisos.ver_facultades) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/facultades'">
          <h4>🎓 Facultades</h4>
          <p>Información de facultades y miembros</p>
          <span class="perm-badge view-only">👁️ Solo lectura</span>
        </div>
      `;
    }

    if (permisos.ver_mi_espacio) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/mi_espacio'">
          <h4>👔 Mi espacio ICU-ADM</h4>
          <p>Pagina con informacion importante</p>
          <span class="perm-badge">✏️ Gestión completa</span>
        </div>
      `;
    }


    // Generar comisiones HTML
    let comisionesHtml = '';
    if (usuario.comisiones && usuario.comisiones.length > 0) {
      comisionesHtml = usuario.comisiones.map(comision => `
        <div class="comision-card">
          <h4>${comision.nombre}</h4>
          <p>${comision.descripcion || 'Sin descripción'}</p>
          <small>Asignado: ${new Date(comision.fecha_asignacion).toLocaleDateString()}</small>
        </div>
      `).join('');
    } else {
      comisionesHtml = '<p>Es administrativo o no está asignado a ninguna comisión actualmente.</p>';
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dashboard ICU - ${usuario.nombre}</title>
          <link rel="stylesheet" href="estilos.css">
          <style>
              .perm-badge {
                  font-size: 0.8rem;
                  padding: 0.25rem 0.5rem;
                  border-radius: 12px;
                  font-weight: bold;
                  display: inline-block;
                  margin-top: 0.5rem;
              }
              .perm-badge {
                  background-color: #28a745;
                  color: white;
              }
              .perm-badge.view-only {
                  background-color: #6c757d;
                  color: white;
              }
              .dashboard-container {
                  max-width: 1200px;
                  margin: 2rem auto;
                  padding: 0 1rem;
              }
              .welcome-card {
                  background: linear-gradient(135deg, #007BFF, #0056b3);
                  color: white;
                  padding: 2rem;
                  border-radius: 12px;
                  margin-bottom: 2rem;
                  text-align: center;
                  box-shadow: 0 8px 32px rgba(0, 123, 255, 0.3);
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 1rem;
                  margin-bottom: 2rem;
              }
              .stat-card {
                  background: white;
                  padding: 1.5rem;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  text-align: center;
                  border-left: 4px solid #007BFF;
              }
              .stat-number {
                  font-size: 2rem;
                  font-weight: bold;
                  color: #007BFF;
              }
              .quick-actions {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 1rem;
                  margin-top: 2rem;
              }
              .action-card {
                  background-color: #ffffff;
                  border: 2px solid #e9ecef;
                  border-radius: 8px;
                  padding: 1.5rem;
                  text-align: center;
                  transition: all 0.3s ease;
                  cursor: pointer;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .action-card:hover {
                  border-color: #007BFF;
                  transform: translateY(-2px);
                  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
              }
              .user-info, .comisiones-section {
                  background-color: #f8f9fa;
                  padding: 1.5rem;
                  border-radius: 8px;
                  margin-bottom: 2rem;
                  border: 1px solid #dee2e6;
              }
              .comision-card {
                  background: white;
                  padding: 1rem;
                  border-radius: 6px;
                  margin: 0.5rem 0;
                  border-left: 3px solid #007BFF;
              }
              .role-badge {
                  background-color: #28a745;
                  color: white;
                  padding: 0.5rem 1rem;
                  border-radius: 25px;
                  font-weight: bold;
                  display: inline-block;
                  margin: 0.5rem 0;
              }
              .logout-btn {
                  background-color: #007BFF;
                  color: black;
                  padding: 0.5rem 1rem;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  text-decoration: none;
                  display: inline-block;
                  transition: background-color 0.3s ease;
              }
              .logout-btn:hover {
                  background-color: #dee2e6;
              }
          </style>
      </head>
      <body>
          <nav>
              <a href="/dashboard" class="logo">ICU Dashboard</a>
              <div class="nav-links">
                  <a href="/dashboard">Dashboard</a>
                  <span class="user-info-nav">👤 ${usuario.nombre} (${usuario.descripcion_rol})</span>
                  <a href="/logout" class="logout-btn">Cerrar Sesión</a>
              </div>
          </nav>

          <div class="dashboard-container">
              <div class="welcome-card">
                  <h1>¡Bienvenido ${usuario.nombre}!</h1>
                  <span class="role-badge">${usuario.rol.replace('_', ' ').toUpperCase()}</span>
              </div>

              <div class="user-info">
                  <h3>📋 Información del Usuario</h3>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                      <div><strong>ID:</strong> ${usuario.id}</div>
                      <div><strong>Código:</strong> ${usuario.codigo}</div>
                  </div>
              </div>

              <div class="comisiones-section">
                  <h3>🏛️ Mis Comisiones</h3>
                  ${comisionesHtml}
              </div>

              <h3>⚡ Módulos Disponibles</h3>
              <div class="quick-actions">
                  ${accionesHtml}
              </div>
          </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// =================== RUTA DE REPORTES/OCR ===================
app.get('/api/reportes/calidad-ocr', ReportController.getCalidadOCR);


// =================== RUTAS DE USUARIOS ===================
app.get('/usuarios', requireAuth, requireRole(['administrativo']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    if (req.headers.accept === 'application/json') {
      const resultado = await SistemaUsuarios.getAllUsers(page, limit);
      res.json(resultado);
    } else {
      // Renderizar página HTML de usuarios
      const resultado = await SistemaUsuarios.getAllUsers(page, limit);
      const facultades = await Facultad.getAll();
      
      res.send(generateUsersPage(resultado, facultades, req.session.usuario));
    }
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/usuarios', requireAuth, requireRole(['administrativo']), async (req, res) => {
  try {
    const nuevoUsuario = await Usuario.create(req.body);
    res.json({ success: true, usuario: nuevoUsuario });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error creando usuario', details: error.message });
  }
});

// =================== RUTAS DE DOCUMENTOS ===================
app.get('/documentos', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.getDocumentosPage(req, res);
});

app.get('/api/documentos', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.getDocumentos(req, res);
});

app.post('/api/documentos', requireAuth, requireRole(['administrativo']), upload.single('archivo'), (req, res) => {
  DocumentController.uploadDocumento(req, res);
});

app.get('/api/documentos/:id/download', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.downloadDocumento(req, res);
});

// =================== RUTAS DE COMISIONES ===================
app.get('/comisiones', requireAuth, requireRole(['administrativo', 'consejero']), async (req, res) => {
  try {
    const comisiones = await Comision.getAll();
    const comisionesConDetalles = await Promise.all(
      comisiones.map(async (comision) => {
        // Obtener miembros
        const miembrosResult = await pool.query(`
          SELECT u.nombre, u.id FROM usuarios u
          JOIN usuario_comisiones uc ON u.id = uc.usuario_id
          WHERE uc.comision_id = $1 AND uc.es_activo = true
        `, [comision.id]);
        
        // Obtener documentos
        const docsResult = await pool.query(`
          SELECT id, titulo FROM documentos WHERE comision_id = $1 ORDER BY fecha_ingreso DESC
        `, [comision.id]);
        
        return { 
          ...comision, 
          miembros: miembrosResult.rows,
          documentos: docsResult.rows,
        };
      })
    );
    res.send(generateComisionesPage(comisionesConDetalles));
  } catch (error) {
    console.error('Error al obtener comisiones:', error);
    res.status(500).send('Error al cargar la página de comisiones.');
  }
});

// =================== RUTAS DE REPORTES ===================
app.get('/reportes', requireAuth, requireRole(['administrativo']), (req, res) => {
  ReportController.getReportesPage(req, res);
});

app.get('/api/reportes/resumen', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getResumenGeneral(req, res);
});

app.get('/api/reportes/temporal', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getAnalisisTemporal(req, res);
});

app.get('/api/reportes/comisiones', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getDistribucionComisiones(req, res);
});

app.get('/api/reportes/palabras-clave', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getPalabrasClave(req, res);
});

app.get('/api/reportes/nlp', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getAnalisisNLP(req, res);
});

app.get('/api/reportes/recientes', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getDocumentosRecientes(req, res);
});

app.get('/api/reportes/documentos', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getDocumentosReport(req, res);
});

// Ruta auxiliar para obtener comisiones (necesaria para filtros)
app.get('/api/comisiones', requireAuth, requireRole(['administrativo', 'consejero']), async (req, res) => {
  try {
    const comisiones = await Comision.getAll();
    res.json(comisiones);
  } catch (error) {
    console.error('Error obteniendo comisiones:', error);
    res.status(500).json({ error: 'Error obteniendo comisiones' });
  }
});

// =================== RUTAS DE FACULTADES ===================
app.get('/facultades', requireAuth, requireRole(['administrativo', 'consejero']), async (req, res) => {
    try {
        // Esta llamada ahora usa el nuevo y optimizado método
        const facultadesData = await Facultad.obtenerTodasConConsejeros();
        res.send(generateFacultadesPage(facultadesData));
    } catch (error) {
        console.error('Error al obtener facultades:', error);
        res.status(500).send("Error al obtener la información de las facultades.");
    }
});

// Logout
app.get('/logout', (req, res) => {
  const userName = req.session.usuario ? req.session.usuario.nombre : 'Usuario';
  req.session.destroy((err) => {
    if (err) {
      console.log('Error al cerrar sesión:', err);
    }
    console.log(`🚪 Logout: ${userName}`);
    res.redirect('/?logout=success');
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const stats = await SistemaUsuarios.getStats();
    
    res.json({
      status: 'OK',
      database: dbConnected ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// =================== RUTAS A MI ESPACIO ===================
app.get('/mi_espacio', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  res.send(generateMiEspacioPage(req.session.usuario));
});

// Pagina Usuarios

function generateUsersPage(resultado, facultades, usuario) {
  
  const usuarios = resultado.rows || [];
  const permisos = usuario.permisos;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Usuarios - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .users-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .users-table {
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                margin-top: 2rem;
            }
            .table-header {
                background: #007BFF;
                color: white;
                padding: 1rem;
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr 120px;
                gap: 1rem;
                align-items: center;
                font-weight: bold;
            }
            .table-row {
                padding: 1rem;
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr 120px;
                gap: 1rem;
                align-items: center;
                border-bottom: 1px solid #eee;
                transition: background-color 0.3s ease;
                overflow-wrap: break-word;
            }
            .table-row:hover {
                background-color: #f8f9fa;
            }
            .status-badge {
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
                text-align: center;
            }
            .status-active {
                background-color: #d4edda;
                color: #155724;
            }
            .status-inactive {
                background-color: #f8d7da;
                color: #721c24;
            }
            .user-type {
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.8rem;
                text-transform: capitalize;
            }
            .type-administrativo {
                background-color: #e3f2fd;
                color: #1565c0;
            }
            .type-docente {
                background-color: #f3e5f5;
                color: #7b1fa2;
            }
            .type-estudiante {
                background-color: #e8f5e8;
                color: #2e7d32;
            }
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                font-size: 0.9rem;
                transition: background-color 0.3s ease;
            }
            .btn-primary {
                background-color: #007BFF;
                color: white;
            }
            .btn-success {
                background-color: #28a745;
                color: white;
            }
            .btn-warning {
                background-color: #ffc107;
                color: #212529;
            }
            .btn-info {
                background-color: #17a2b8;
                color: white;
            }
            .btn-small {
                padding: 0.25rem 0.5rem;
                font-size: 0.8rem;
                margin: 0 0.25rem;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .form-control {
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
            }
            .stats-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            .stat-number {
                font-size: 2rem;
                font-weight: bold;
                color: #007BFF;
            }
            .stat-label {
                color: #666;
                margin-top: 0.5rem;
            }
            .no-users {
                text-align: center;
                padding: 3rem;
                color: #666;
            }
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 2rem;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                position: relative;
            }
            .close {
                position: absolute;
                right: 1rem;
                top: 1rem;
                font-size: 1.5rem;
                cursor: pointer;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
            @media (max-width: 768px) {
                .table-header, .table-row {
                    grid-template-columns: 1fr;
                    text-align: left;
                }
                .search-section {
                    flex-direction: column;
                    align-items: stretch;
                }
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios" class="active">👥 Usuarios</a>
                <a href="/facultades">🏛️ Facultades</a>
                <a href="/comisiones">📋 Comisiones</a>
                <a href="/documentos">📄 Documentos</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="users-container">
            <div class="welcome-card">
                <h1>👥 Gestión de Usuarios</h1>
                <p>Modulo de gestion de consejeros del ICU</p>
            </div>

            <!-- Búsqueda y filtros -->
            <div class="search-section">
                <input type="text" id="searchInput" placeholder="🔍 Buscar usuarios..." class="form-control" style="flex: 1; min-width: 200px;">
                <select id="tipoFilter" class="form-control" style="width: 150px;">
                    <option value="">Todos los tipos</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="docente">Docente</option>
                    <option value="estudiante">Estudiante</option>
                </select>
                <select id="estadoFilter" class="form-control" style="width: 120px;">
                    <option value="">Todos</option>
                    <option value="activo">Activos</option>
                    <option value="inactivo">Inactivos</option>
                </select>
            </div>

            <!-- Tabla de usuarios -->
            ${resultado.usuarios.length > 0 ? `
            <div class="users-table">
                <div class="table-header">
                    <span>👤 Usuario</span>
                    <span>📧 Email</span>
                    <span>🏷️ Tipo</span>
                    <span>🏛️ Facultad</span>
                    <span>📊 Estado</span>
                    <span>⚙️ Acciones</span>
                </div>
                ${resultado.usuarios.map(u => `
                <div class="table-row" data-tipo="${u.tipo_usuario}" data-activo="${u.es_activo}">
                    <div>
                        <strong>${u.nombre}</strong>
                    </div>
                    <div>${u.email}</div>
                    <div>
                        <span class="user-type type-${u.tipo_usuario}">${u.tipo_usuario}</span>
                    </div>
                    <div>${u.nombre_facultad || 'Sin asignar o administrativo'}</div>
                    <div>
                        <span class="status-badge ${u.es_activo ? 'status-active' : 'status-inactive'}">
                            ${u.es_activo ? '✅ Activo' : '❌ Inactivo'}
                        </span>
                    </div>
                    <div>
                        ${permisos.cambiar_estado_usuarios ? `
                        <button onclick="toggleUserStatus(${u.id}, ${u.es_activo})" 
                                class="btn ${u.es_activo ? 'btn-warning' : 'btn-success'} btn-small">
                            ${u.es_activo ? '⏸️' : '▶️'}
                        </button>
                        ` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `
            `}
        </div>

        <!-- Modal para crear/editar usuario -->
        <div id="userModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal()">&times;</span>
                <h3 id="modalTitle">➕ Nuevo Usuario</h3>
                <form id="userForm">
                    <input type="hidden" id="userId" name="id">
                    
                    <div class="form-group">
                        <label for="nombre">Nombre:</label>
                        <input type="text" id="nombre" name="nombre" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="apellido">Apellido:</label>
                        <input type="text" id="apellido" name="apellido" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="tipo_usuario">Tipo de Usuario:</label>
                        <select id="tipo_usuario" name="tipo_usuario" class="form-control" required>
                            <option value="">Seleccionar...</option>
                            <option value="administrativo">Administrativo</option>
                            <option value="docente">Docente</option>
                            <option value="estudiante">Estudiante</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="facultad_id">Facultad:</label>
                        <select id="facultad_id" name="facultad_id" class="form-control">
                            <option value="">Sin asignar</option>
                            ${facultades.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group" id="passwordGroup">
                        <label for="password">Contraseña:</label>
                        <input type="password" id="password" name="password" class="form-control">
                        <small>Dejar vacío para mantener la contraseña actual (solo en edición)</small>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                        <button type="button" onclick="closeModal()" class="btn" style="background: #6c757d; color: white;">Cancelar</button>
                        <button type="submit" class="btn btn-success">💾 Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            // Variables globales
            let currentUsers = [];
            
            const resultado = await SistemaUsuarios.getAllUsers();
            const usuarios = resultado.usuarios; // Extraer el array

            // Para enlazar usuarios con facultad

            const resultadoFac = await Facultad.getMiembros();
            const usuariosFac = resultadoFac.usuarios; // Extraer el array

            // Inicializar
            document.addEventListener('DOMContentLoaded', function() {
                currentUsers = ${JSON.stringify(usuarios)};
                setupEventListeners();
            });
            
            function setupEventListeners() {
                // Búsqueda en tiempo real
                document.getElementById('searchInput').addEventListener('input', filterUsers);
                document.getElementById('tipoFilter').addEventListener('change', filterUsers);
                document.getElementById('estadoFilter').addEventListener('change', filterUsers);
                
                // Form submit
                document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
            }
            
            function filterUsers() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const tipoFilter = document.getElementById('tipoFilter').value;
                const estadoFilter = document.getElementById('estadoFilter').value;
                
                const rows = document.querySelectorAll('.table-row');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    const tipo = row.dataset.tipo;
                    const activo = row.dataset.activo === 'true';
                    
                    let show = true;
                    
                    // Filtro de texto
                    if (searchTerm && !text.includes(searchTerm)) {
                        show = false;
                    }
                    
                    // Filtro de tipo
                    if (tipoFilter && tipo !== tipoFilter) {
                        show = false;
                    }
                    
                    // Filtro de estado
                    if (estadoFilter === 'activo' && !activo) {
                        show = false;
                    } else if (estadoFilter === 'inactivo' && activo) {
                        show = false;
                    }
                    
                    row.style.display = show ? 'grid' : 'none';
                });
            }
            
            function openCreateModal() {
                document.getElementById('modalTitle').textContent = '➕ Nuevo Usuario';
                document.getElementById('userForm').reset();
                document.getElementById('userId').value = '';
                document.getElementById('passwordGroup').querySelector('input').required = true;
                document.getElementById('userModal').style.display = 'block';
            }
            
            function editUser(id) {
                const user = currentUsers.find(u => u.id === id);
                if (!user) return;
                
                document.getElementById('modalTitle').textContent = '✏️ Editar Usuario';
                document.getElementById('userId').value = user.id;
                document.getElementById('nombre').value = user.nombre;
                document.getElementById('apellido').value = user.apellido;
                document.getElementById('email').value = user.email;
                document.getElementById('tipo_usuario').value = user.tipo_usuario;
                document.getElementById('facultad_id').value = user.facultad_id || '';
                document.getElementById('password').value = '';
                document.getElementById('passwordGroup').querySelector('input').required = false;
                document.getElementById('userModal').style.display = 'block';
            }
            
            function closeModal() {
                document.getElementById('userModal').style.display = 'none';
            }
            
            async function handleUserSubmit(e) {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const userData = Object.fromEntries(formData.entries());
                
                const isEdit = userData.id !== '';
                const url = isEdit ? \`/api/usuarios/\${userData.id}\` : '/api/usuarios';
                const method = isEdit ? 'PUT' : 'POST';
                
                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(userData)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        alert(\`✅ Usuario \${isEdit ? 'actualizado' : 'creado'} exitosamente\`);
                        closeModal();
                        location.reload(); // Recargar para ver cambios
                    } else {
                        alert('❌ Error: ' + result.error);
                    }
                } catch (error) {
                    alert('❌ Error de conexión: ' + error.message);
                }
            }
            
            async function toggleUserStatus(userId, currentStatus) {
                const action = currentStatus ? 'desactivar' : 'activar';
                
                if (!confirm(\`¿Estás seguro de que quieres \${action} este usuario?\`)) {
                    return;
                }
                
                try {
                    const response = await fetch(\`/api/usuarios/\${userId}/toggle-status\`, {
                        method: 'PATCH'
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        alert(\`✅ Usuario \${action}do exitosamente\`);
                        location.reload();
                    } else {
                        alert('❌ Error: ' + result.error);
                    }
                } catch (error) {
                    alert('❌ Error de conexión: ' + error.message);
                }
            }
            
            // Cerrar modal al hacer click fuera
            window.onclick = function(event) {
                const modal = document.getElementById('userModal');
                if (event.target === modal) {
                    closeModal();
                }
            }
        </script>
    </body>
    </html>
  `;
}

//Pagina de Informacion comisiones 
 
function generateComisionesPage(comisiones) {
  let comisionesHtml = comisiones.map(c => `
    <div class="comision-card">
      <h3>${c.nombre}</h3>
      <p>${c.descripcion}</p>
      <div class="card-details">
        <strong>👥 Miembros de la comisión:</strong>
        <ul>${c.miembros.length > 0 ? c.miembros.map(m => `<li>${m.nombre}</li>`).join('') : '<li>No hay miembros asignados.</li>'}</ul>
        <strong>📄 N° de documentos de la comisión : (${c.documentos.length})</strong>
   <!-- Comentado <ul>${c.documentos.length > 0 ? c.documentos.map(d => `<li><a href="/api/documentos/${d.id}/download">${d.titulo}</a></li>`).join('') : '<li>No hay documentos asociados.</li>'}</ul> -->
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Comisiones</title><link rel="stylesheet" href="/estilos.css"></head>
    <body>
      <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios" class="active">👥 Usuarios</a>
                <a href="/facultades">🏛️ Facultades</a>
                <a href="/comisiones">📋 Comisiones</a>
                <a href="/documentos">📄 Documentos</a>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>
      <main><div class="comision-grid-container">
      <h1>📋 Comisiones</h1>
      ${comisionesHtml}
      </div>
      </main>
    </body></html>`;
}


//Pagina de Facultades

function generateFacultadesPage(facultades) {
  let facultadesHtml = facultades.map(f => `
        <div class="comision-card">
            <h3>${f.nombre}</h3>
            <div class="card-details">
                <hr>
                <p><strong>👨‍🎓 Delegados estudiantes:</strong></p>
                <ul>${f.delegados_estudiantes.length > 0 ? f.delegados_estudiantes.map(d => `<li>${d.nombre}</li>`).join('') : '<li>No hay delegados estudiantes registrados.</li>'}</ul>
                <p><strong>👨‍🏫 Delegados docentes:</strong></p>
                <ul>${f.delegados_docentes.length > 0 ? f.delegados_docentes.map(d => `<li>${d.nombre}</li>`).join('') : '<li>No hay delegados docentes registrados.</li>'}</ul>
            </div>
        </div>
    `).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Facultades - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios">👥 Usuarios</a>
                <a href="/facultades" class="active">🏛️ Facultades</a>
                <a href="/comisiones">📋 Comisiones</a>
                <a href="/documentos">📄 Documentos</a>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <main><div class="comision-grid-container">
            <h1>🏛️ Facultades</h1>
                ${facultadesHtml}
                </div>
        </main>
       
  
    </body>
    </html>
  `;
}

function generateMiEspacioPage(usuario) {

  const { nombre, comisiones, descripcion_rol } = usuario;
  const comisionesHtml = comisiones.map(c => c.nombre).join(', ') || 'Ninguna asignada';

   // Datos estáticos de la próxima sesión (un admin podría cambiar esto en el futuro)
    const proximaSesion = {
        tipo: 'Ordinaria',
        lugar: 'Sala de Conferencias - Edificio Central',
        fecha: '17/09/2025',
        hora: '15:00 PM',
        temas: [
            'Revisión del presupuesto para la gestión 2026',
            'Aprobación de la nueva malla curricular de Ingeniería Informática',
            'Análisis de solicitudes de año sabático'
        ],
        documentos: [ // Esto se podría hacer dinámico en el futuro
            { id: 1, titulo: 'Propuesta Presupuesto 2026.pdf' },
            { id: 2, titulo: 'Malla Curricular Ing. Inf. - Propuesta Final.pdf' }
        ],
        reglamentos: [
            'Reglamento de Año Sabático',
            'Reglamento de Aprobación Curricular'
        ]
    };

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">  
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inicio - Mi espacio - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
        <style>
            //CSS
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <section class="hero">
        <main class="comision-grid-container">
                <div class="comision-card">
                    <p><strong>Nombre:</strong> ${nombre}</p>
                    <p><strong>Comisiones:</strong> ${comisionesHtml}</p>
                    <p><strong>Rol:</strong> ${descripcion_rol}</p>
                </div>

                <div class="comision-card">
                    <h3>Próxima Sesión del ICU</h3>
                    <div class="session-details">
                        <p><strong>Tipo:</strong> <span class="badge">${proximaSesion.tipo}</span></p>
                        <p><strong>Lugar:</strong> ${proximaSesion.lugar}</p>
                        <p><strong>Fecha y Hora:</strong> ${proximaSesion.fecha} a las ${proximaSesion.hora}</p>
                    </div>
                    <h4>Temas a Tratar:</h4>
                    <ul>${proximaSesion.temas.map(t => `<li>${t}</li>`).join('')}</ul>
                    <hr>
                    <h4>Documentos para la Sesión:</h4>
                    <ul>${proximaSesion.documentos.map(d => `<li><a href="/api/documentos/${d.id}/download">${d.titulo}</a></li>`).join('')}</ul>
                    <h4>Reglamentos a Revisar:</h4>
                    <ul>${proximaSesion.reglamentos.map(r => `<li>${r}</li>`).join('')}</ul>
                </div>
            </main>
        </section>
    </body>
    </html>
  `;
}



// Manejo de errores
app.use((req, res) => {
  res.status(404).send(`
    <html>
    <head>
      <title>Página no encontrada</title>
      <link rel="stylesheet" href="estilos.css">
    </head>
    <body>
      <div class="container">
        <h1>404 - Página no encontrada</h1>
        <p>La página que busca no existe.</p>
        <a href="/dashboard" class="cta-button">Volver al dashboard</a>
      </div>
    </body>
    </html>
  `);
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).send(`
    <html>
    <head>
      <title>Error del servidor</title>
      <link rel="stylesheet" href="estilos.css">
    </head>
    <body>
      <div class="container">
        <h1>Error interno del servidor</h1>
        <p>Ocurrió un error inesperado. Por favor, contacte al administrador.</p>
        <a href="/dashboard" class="cta-button">Volver al dashboard</a>
      </div>
    </body>
    </html>
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
      console.log(`🏛️  Comisiones: http://localhost:${port}/comisiones`);
      console.log(`📊 Reportes: http://localhost:${port}/reportes`);
      console.log(`🎓 Facultades: http://localhost:${port}/facultades`);
      
      console.log('\n=== PERMISOS DEL SISTEMA ===');
      console.log('👑 Administrativos: Acceso total (crear, editar, eliminar)');
      console.log('👁️  Consejeros: Solo lectura (ver documentos, comisiones, facultades, reportes)');
      
      console.log('\n✅ Sistema ICU con permisos listo');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

startServer();