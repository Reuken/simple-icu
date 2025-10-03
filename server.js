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
//  gestionar_comisiones: false,
    ver_reportes: false,
//  generar_reportes: false,
    ver_facultades: false,
//  gestionar_facultades: false,
    ver_mi_espacio: false,
    gestionar_sesion:false
  };

  if (tipo_usuario === 'superadmin') {
    // Superadmin tienen todos los permisos
    Object.keys(permisos).forEach(key => {
      permisos[key] = true;
    });
  } else if (tipo_usuario === 'consejero') {
    // Consejeros solo pueden ver, no gestionar
    permisos.ver_documentos = true;
    permisos.ver_comisiones = true;
    permisos.ver_facultades = true;
    permisos.ver_mi_espacio = true;

  } else if (tipo_usuario === 'administrativo') {
    // Administratio ve y gestiona pero no crea usuarios
    permisos.ver_documentos = true;
    permisos.ver_comisiones = true;
    permisos.ver_facultades = true;
    permisos.ver_usuarios = true;
    permisos.ver_reportes = true;
    permisos.subir_documentos = true;
    permisos.gestionar_sesion = true;
  }
  return permisos;
}

app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const stats = await SistemaUsuarios.getStats();
    const permisos = usuario.permisos;
    
    // Generar tarjetas de módulos disponibles
    let accionesHtml = '';
    if (permisos.ver_usuarios) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/usuarios'"><h4>👥 Usuarios</h4><p>Gestionar usuarios del sistema</p>${permisos.crear_usuarios ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}</div>`;
    }
    if (permisos.ver_documentos) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/documentos'"><h4>📄 Documentos</h4><p>Gestionar documentos del ICU</p>${permisos.subir_documentos ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}</div>`;
    }
    if (permisos.ver_comisiones) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/comisiones'"><h4>🏛️ Comisiones</h4><p>Ver todas las comisiones</p><span class="perm-badge view-only">👁️ Solo lectura</span></div>`;
    }
    if (permisos.ver_reportes) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/reportes'"><h4>📊 Reportes</h4><p>Ver reportes y análisis NLP</p>${permisos.generar_reportes ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}</div>`;
    }
    if (permisos.ver_facultades) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/facultades'"><h4>🎓 Facultades</h4><p>Información de facultades y miembros</p><span class="perm-badge view-only">👁️ Solo lectura</span></div>`;
    }
    if (permisos.ver_mi_espacio) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/mi_espacio'"><h4>👔 Mi espacio ICU</h4><p>Informacion importante para los consejeros</p><span class="perm-badge view-only">👁️ Solo lectura</span></div>`;
    }
    if (permisos.gestionar_sesion) {
      accionesHtml += `<div class="action-card" onclick="window.location.href='/gestion_sesion'"><h4>🗓️ Gestionar Sesión</h4><p>Editar la información de la próxima sesión.</p><span class="perm-badge">✏️ Gestión completa</span></div>`;
    }

    // Generar tarjetas de comisiones del usuario
    let comisionesHtml = '';
    if (usuario.comisiones && usuario.comisiones.length > 0) {
      comisionesHtml = usuario.comisiones.map(comision => `
        <div class="comision-item">
          <strong>${comision.nombre}</strong>
          <small>${comision.descripcion || 'Sin descripción'}</small>
        </div>
      `).join('');
    } else {
      comisionesHtml = '<p class="no-comision-msg">No está asignado a ninguna comisión actualmente.</p>';
    }

    // Enviar la página rediseñada
    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dashboard ICU - ${usuario.nombre}</title>
          <link rel="stylesheet" href="/estilos.css">
          <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
          <style>
              body { background-color: #f4f7f9; }
              .main-container { max-width: 1400px; margin: 2rem auto; padding: 1rem; }
              .welcome-card {
                  background: linear-gradient(135deg, #2a95e2ff, #cfe2ff); /* Gradiente de azules muy claros */
                  /* Se elimina 'color: white;' para que herede el color oscuro del body */
                  padding: 2.5rem 2rem;
                  border-radius: 12px;
                  margin-bottom: 2rem;
                  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); /* Sombra más sutil y neutral */
                  border: 1px solid #dee2e6; /* Borde ligero para definir la tarjeta */
}
              .welcome-card h1 { font-size: 2.5rem; font-weight: 500; margin: 0 0 0.5rem 0; }
              .welcome-card p { font-size: 1.2rem; opacity: 0.9; margin: 0; }
              .dashboard-grid {
                  display: grid;
                  grid-template-columns: 1fr;
                  gap: 2rem;
              }
              @media (min-width: 1024px) {
                  .dashboard-grid { grid-template-columns: 1fr 3fr; }
              }
              .sidebar-column .info-card {
                  background-color: #ffffff; border-radius: 12px; padding: 2rem;
                  box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eef;
                  margin-bottom: 2rem;
              }
              .sidebar-column h3 {
                  font-size: 1.5rem; font-weight: 500; color: #333; margin-top: 0;
                  border-bottom: 2px solid #007BFF; padding-bottom: 0.5rem; display: inline-block;
              }
              .user-details p { font-size: 1rem; color: #555; line-height: 1.6; }
              .user-details p strong { font-weight: 500; color: #333; }
              .comision-item {
                  background-color: #f8f9fa; border-left: 3px solid #007BFF;
                  padding: 1rem; border-radius: 6px; margin-bottom: 0.5rem;
              }
              .comision-item strong { display: block; }
              .no-comision-msg { font-style: italic; color: #6c757d; }
              
              .main-column h3 { font-size: 1.8rem; font-weight: 500; margin-bottom: 1.5rem; color: #333; }
              .quick-actions {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                  gap: 1.5rem;
              }
              .action-card {
                  background-color: #ffffff; border: 1px solid #eef; border-radius: 12px;
                  padding: 1.5rem; text-align: center; transition: all 0.3s ease;
                  cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.05);
              }
              .action-card:hover {
                  transform: translateY(-5px); box-shadow: 0 6px 20px rgba(0, 123, 255, 0.15);
                  border-color: #007BFF;
              }
              .action-card h4 { font-size: 1.2rem; margin: 0 0 0.5rem 0; color: #0056b3; }
              .action-card p { margin: 0; color: #6c757d; }
              .perm-badge {
                  font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 12px;
                  font-weight: 500; display: inline-block; margin-top: 1rem;
              }
              .perm-badge { background-color: #d4edda; color: #155724; }
              .perm-badge.view-only { background-color: #e9ecef; color: #495057; }
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

          <div class="main-container">
              <div class="welcome-card">
                  <h1>¡Bienvenido, ${usuario.nombre}!</h1>
                  <p>Usted ha ingresado como: <strong>${usuario.descripcion_rol}</strong></p>
              </div>

              <div class="dashboard-grid">
                  <aside class="sidebar-column">
                      <div class="info-card">
                          <h3>📋 Mi Información</h3>
                          <div class="user-details">
                              <p><strong>Código:</strong> ${usuario.codigo}</p>
                              <p><strong>Email:</strong> ${usuario.email}</p>
                              <p><strong>Tipo:</strong> ${usuario.tipo_usuario}</p>
                          </div>
                      </div>
                      <div class="info-card">
                          <h3>🏛️ Mis Comisiones</h3>
                          ${comisionesHtml}
                      </div>
                  </aside>
                  <section class="main-column">
                      <h3>⚡ Módulos Disponibles</h3>
                      <div class="quick-actions">
                          ${accionesHtml}
                      </div>
                  </section>
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

app.get('/usuarios', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20; // O el límite que prefieras
        
        const usuariosData = await SistemaUsuarios.getAllUsers({
            page,
            limit,
            includeInactive: true 
        });

        const facultades = await Facultad.getAll(); // Asumiendo que tienes este método

        // Pasamos el objeto 'usuariosData' completo y las facultades
        res.send(generateUsuariosPage(usuariosData, facultades, req.session.usuario));
    } catch (error) {
        res.status(500).send("Error al cargar la página de usuarios.");
    }
});


app.post('/api/usuarios/add', requireAuth, requireRole(['superadmin']), async (req, res) => {
    try {
        const { nombre, codigo, email, contrasena, tipo_usuario, facultad_id, gestion, es_estudiante, es_docente, funcion } = req.body;

        // Hashear contraseña (si usas bcrypt en producción, mantenlo)
        // const salt = await bcrypt.genSalt(10);
        // const hashedContrasena = await bcrypt.hash(contrasena, salt);

        // Construimos el objeto 'userData' que la clase Usuario.create espera
        const userData = {
            nombre,
            codigo: parseInt(codigo),
            email,
            contrasena: contrasena, // Usando contraseña en texto plano como tu clase
            tipo_usuario,
            // Datos específicos del rol
            facultad_id: tipo_usuario === 'consejero' ? parseInt(facultad_id) : null,
            gestion: gestion || null,
            es_estudiante: tipo_usuario === 'consejero' ? es_estudiante === 'on' : false,
            es_docente: tipo_usuario === 'consejero' ? es_docente === 'on' : false,
            es_directiva: false, // Asumimos que no se crea como directiva desde este form.
            funcion: tipo_usuario === 'administrativo' ? funcion || 'Sin especificar' : null
        };
        
        // La clase se encarga del resto
        const nuevoUsuario = await Usuario.create(userData);

        console.log(`✅ Usuario creado: ${nuevoUsuario.nombre}`);
        res.redirect('/usuarios');
    } catch (error) {
        console.error('Error al añadir usuario:', error);
        res.status(500).send('Error al crear el usuario. Verifique que el código y el email no estén ya registrados.');
    }
});


app.post('/api/usuarios/edit/:id', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, es_activo } = req.body; // Solo los campos permitidos y 'es_activo'

        // El método update actual no es ideal, pero nos adaptamos a él.
        // Primero, buscamos el usuario para tener una instancia de la clase.
        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).send('Usuario no encontrado.');
        }

        // Actualizamos los campos permitidos por el método update
        await usuario.update({ nombre, email });
        
        // El estado 'es_activo' se maneja por separado, ya que update no lo soporta.
        await usuario.setActive(es_activo === 'on');

        console.log(`✅ Usuario actualizado: ID ${id}`);
        res.redirect('/usuarios');
    } catch (error) {
        console.error('Error al editar usuario:', error);
        res.status(500).send('Error al actualizar el usuario.');
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

app.get('/api/documentos/:id/preview', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.previewDocumento(req, res);
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

// =================== RUTAS DE GESTIONAR SESION ===================
// --- GESTIÓN DE SESIÓN (SOLO ADMIN) ---
app.get('/gestion_sesion', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    try {
        // [CORREGIDO] Manejo seguro: si no hay sesión, se usa un objeto vacío
        const sesionResult = await pool.query('SELECT * FROM sesiones ORDER BY fecha DESC, hora DESC LIMIT 1');
        const sesionActual = sesionResult.rows[0] || {}; 

        // Obtener los últimos 30 documentos para el selector
        const documentosResult = await pool.query('SELECT id, titulo FROM documentos ORDER BY fecha_ingreso DESC LIMIT 30');
        const documentosRecientes = documentosResult.rows;

        // Obtener documentos ya asociados a la sesión actual
        // [CORREGIDO] Se usa 'sesionActual.id || 0' para evitar errores si la sesión no existe
        const docsAsociadosResult = await pool.query('SELECT documento_id FROM sesion_documentos WHERE sesion_id = $1', [sesionActual.id || 0]);
        const docsAsociadosIds = docsAsociadosResult.rows.map(r => r.documento_id);

        // Pasamos todos los datos a la función que genera el HTML
        res.send(generateGestionSesionPage(sesionActual, documentosRecientes, docsAsociadosIds));
    } catch (error) {
        console.error('Error al cargar página de gestión de sesión:', error);
        res.status(500).send('Error al cargar la página de gestión de la sesión.');
    }
});

app.post('/api/sesion/update', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { sesion_id, tipo, lugar, fecha, hora, temas_recurrentes, temas_nuevos, documentos } = req.body;
        
        // Combinar temas recurrentes y nuevos
        let temasArray = temas_recurrentes ? (Array.isArray(temas_recurrentes) ? temas_recurrentes : [temas_recurrentes]) : [];
        if (temas_nuevos) {
            temasArray = [...temasArray, ...temas_nuevos.split('\n').map(t => t.trim()).filter(t => t)];
        }
        const temasString = temasArray.join('|');

        // [NUEVO] Lógica de sugerencia de reglamentos
        const idsDocumentosSeleccionados = documentos ? (Array.isArray(documentos) ? documentos : [documentos]).map(id => parseInt(id)) : [];
        const reglamentosSugeridos = await DocumentController.sugerirReglamentos(idsDocumentosSeleccionados);
        const reglamentosString = reglamentosSugeridos.join('|');
        
        let currentSesionId = sesion_id;

        if (currentSesionId) { // Actualizar sesión
            await client.query(
                'UPDATE sesiones SET tipo=$1, lugar=$2, fecha=$3, hora=$4, temas=$5, reglamentos=$6, updated_at=NOW() WHERE id=$7',
                [tipo, lugar, fecha, hora, temasString, reglamentosString, currentSesionId]
            );
        } else { // Crear nueva sesión
            const result = await client.query(
                'INSERT INTO sesiones (tipo, lugar, fecha, hora, temas, reglamentos) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                [tipo, lugar, fecha, hora, temasString, reglamentosString]
            );
            currentSesionId = result.rows[0].id;
        }

        // Gestionar documentos asociados
        await client.query('DELETE FROM sesion_documentos WHERE sesion_id = $1', [currentSesionId]);
        if (req.body.documentos && idsDocumentosSeleccionados.length > 0) {
            const docValues = idsDocumentosSeleccionados.map(docId => `(${currentSesionId}, ${docId})`).join(',');
            await client.query(`INSERT INTO sesion_documentos (sesion_id, documento_id) VALUES ${docValues}`);
        }

        await client.query('COMMIT');
        res.redirect('/gestion_sesion');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al actualizar la sesión:', error);
        res.status(500).send('Error al guardar la información de la sesión.');
    } finally {
        client.release();
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

// =================== RUTAS A MI ESPACIO ICU ===================

app.get('/mi_espacio', requireAuth, requireRole(['consejero']), async (req, res) => {
    try {
        const usuario = req.session.usuario;
        
        // [NUEVO] Obtenemos la última sesión de la base de datos
        const sesionQuery = `
            SELECT s.*, 
                   (SELECT json_agg(json_build_object('id', d.id, 'titulo', d.titulo))
                    FROM documentos d
                    JOIN sesion_documentos sd ON d.id = sd.documento_id
                    WHERE sd.sesion_id = s.id) as documentos
            FROM sesiones s
            ORDER BY s.fecha DESC, s.hora DESC
            LIMIT 1
        `;
        const sesionResult = await pool.query(sesionQuery);
        
        const proximaSesion = sesionResult.rows[0] || {};
        res.send(generateMiEspacioPage(usuario, proximaSesion));

    } catch (error) {
        console.error('Error al cargar Mi Espacio ICU:', error);
        res.status(500).send('Error al cargar la página.');
    }
});

// Pagina Usuarios

function generateUsuariosPage(data, facultades, usuario) {

  // Asegurarse de que los datos de entrada son correctos
    const usuarios = data.usuarios || [];
    const { permisos } = usuario;

    // [NUEVO] Separar usuarios en activos e inactivos
    const usuariosActivos = usuarios.filter(u => u.es_activo);
    const usuariosInactivos = usuarios.filter(u => !u.es_activo);

    let facultadesOptions = facultades.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('');

  // [NUEVO] El formulario de creación solo se genera si el usuario tiene el permiso
  const formularioCrearUsuario = `
    <div class="info-card">
      <h3>Añadir Nuevo Usuario</h3>
      <form action="/api/usuarios/add" method="POST" class="form-container">
        <div class="form-grid">
            <div class="form-group"><label for="nombre">Nombre Completo:</label><input type="text" id="nombre" name="nombre" required></div>
            <div class="form-group"><label for="codigo">Código:</label><input type="number" id="codigo" name="codigo" required></div>
            <div class="form-group"><label for="email">Email:</label><input type="email" id="email" name="email" required></div>
            <div class="form-group"><label for="contrasena">Contraseña:</label><input type="password" id="contrasena" name="contrasena" required></div>
            <div class="form-group full-width">
                <label for="tipo_usuario">Tipo de Usuario:</label>
                <select id="tipo_usuario" name="tipo_usuario" onchange="toggleConsejeroFields()" required>
                    <option value="consejero">Consejero</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="superadmin">Superadmin</option>
                </select>
            </div>
            <div id="consejero-fields" class="full-width" style="display:none;">
                <div class="form-grid">
                    <div class="form-group"><label for="facultad_id">Facultad:</label><select id="facultad_id" name="facultad_id">${facultadesOptions}</select></div>
                    <div class="form-group"><label for="gestion">Gestión:</label><input type="text" id="gestion" name="gestion" placeholder="Ej: 2024-2026"></div>
                    <div class="form-group checkbox-group">
                        <div><input type="checkbox" id="es_estudiante" name="es_estudiante"><label for="es_estudiante">Es Estudiante</label></div>
                        <div><input type="checkbox" id="es_docente" name="es_docente"><label for="es_docente">Es Docente</label></div>
                    </div>
                </div>
            </div>
        </div>
        <button type="submit" class="cta-button" style="width: 100%; margin-top: 20px;">Añadir Usuario</button>
      </form>
    </div>
  `; 

  return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Gestión de Usuarios - ICU</title>
          <link rel="stylesheet" href="/estilos.css">
          <style>
          /* [NUEVO] Estilos para las pestañas */
            .tabs { display: flex; border-bottom: 2px solid #dee2e6; margin-bottom: 2rem; }
            .tab-button { background: none; border: none; padding: 1rem 1.5rem; cursor: pointer; font-size: 1.1rem; font-weight: 500; color: #6c757d; border-bottom: 3px solid transparent; transition: all 0.3s ease; }
            .tab-button.active { color: #007BFF; border-bottom-color: #007BFF; }
            .tab-content { display: none; }
            .tab-content.active { display: block; }

            .users-table { width: 100%; border-collapse: collapse; }
            .users-table th, .users-table td { padding: 1rem 1.5rem; text-align: left; }
            .users-table thead { background-color: #f8f9fa; color: #333; }
            .users-table tbody tr { border-bottom: 1px solid #eef; transition: background-color 0.3s ease; }
            .users-table tbody tr:hover { background-color: #f8f9fa; }
            
            .status-badge { padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.8rem; font-weight: 500; }
            .status-active { background-color: #d4edda; color: #155724; }
            .status-inactive { background-color: #f8d7da; color: #721c24; }

            body { background-color: #f4f7f9; }
            .main-container { max-width: 1400px; margin: 2rem auto; padding: 1rem; }
            .info-card { background-color: #ffffff; border-radius: 12px; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eef; margin-bottom: 2rem; }
            .info-card h3 { font-size: 1.5rem; font-weight: 500; color: #333; margin-top: 0; border-bottom: 2px solid #007BFF; padding-bottom: 0.5rem; display: inline-block; }
            
            .users-table { width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
            .users-table th, .users-table td { padding: 1rem 1.5rem; text-align: left; }
            .users-table thead { background-color: #007BFF; color: white; }
            .users-table tbody tr { border-bottom: 1px solid #eef; transition: background-color 0.3s ease; }
            .users-table tbody tr:last-child { border-bottom: none; }
            .users-table tbody tr:hover { background-color: #f8f9fa; }
            
            .status-badge { padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.8rem; font-weight: 500; }
            .status-active { background-color: #d4edda; color: #155724; }
            .status-inactive { background-color: #f8d7da; color: #721c24; }

            .modal { display: none; position: fixed; z-index: 1001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); }
            .modal-content { background-color: #fefefe; margin: 10% auto; padding: 2rem; border: 1px solid #888; width: 90%; max-width: 500px; border-radius: 12px; }
            .close { color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
            .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .form-group { display: flex; flex-direction: column; }
            .full-width { grid-column: 1 / -1; }

              /* Estilos para el Modal */
              .modal { display: none; position: fixed; z-index: 1001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4); }
              .modal-content { background-color: #fefefe; margin: 10% auto; padding: 20px; border: 1px solid #888; width: 80%; max-width: 500px; border-radius: 8px; }
              .close { color: #aaa; float: right; font-size: 28px; font-weight: bold; }
              .close:hover, .close:focus { color: black; text-decoration: none; cursor: pointer; }
              form label { display: block; margin-top: 10px; }
              form input, form select { width: 100%; padding: 8px; margin-top: 5px; border-radius: 4px; border: 1px solid #ddd; }
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
                  <a href="/logout" class="logout-btn">Cerrar Sesión</a>
              </div>
          </nav>

          <main class="main-container">
             <div class="welcome-card">
                <h1>Gestión de Usuarios</h1>
                <p>Administración de cuentas del sistema ICU.</p>
            </div>

            ${permisos.crear_usuarios ? formularioCrearUsuario : ''}

            <div class="info-card">
                <div class="tabs">
                    <button class="tab-button active" onclick="openTab(event, 'activos')">Usuarios Activos (${usuariosActivos.length})</button>
                    <button class="tab-button" onclick="openTab(event, 'inactivos')">Usuarios Inactivos (${usuariosInactivos.length})</button>
                </div>

                <div id="activos" class="tab-content active">
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="users-table">
                            <thead><tr><th>Usuario</th><th>Rol o Gestion</th><th>Estado</th><th>Acciones</th></tr></thead>
                            <tbody>
                                ${usuariosActivos.length > 0 ? usuariosActivos.map(u => `
                                    <tr>
                                        <td><strong>${u.nombre}</strong><br><small>Código: ${u.codigo}</small></td>
                                        <td>${u.detalle_rol || u.tipo_usuario}</td>
                                        <td><span class="status-badge status-active">Activo</span></td>
                                        <td><button class="cta-button" style="padding: 8px 15px; font-size: 0.9rem;" onclick='openEditModal(${JSON.stringify(u).replace(/"/g, "&quot;")})'>Editar</button></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No hay usuarios activos.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div id="inactivos" class="tab-content">
                    <div class="table-responsive" style="overflow-x: auto;">
                        <table class="users-table">
                            <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
                            <tbody>
                                ${usuariosInactivos.length > 0 ? usuariosInactivos.map(u => `
                                    <tr>
                                        <td><strong>${u.nombre}</strong><br><small>Código: ${u.codigo}</small></td>
                                        <td>${u.detalle_rol || u.tipo_usuario}</td>
                                        <td><span class="status-badge status-inactive">Inactivo</span></td>
                                        <td><button class="cta-button" style="padding: 8px 15px; font-size: 0.9rem;" onclick='openEditModal(${JSON.stringify(u).replace(/"/g, "&quot;")})'>Editar</button></td>
                                    </tr>
                                `).join('') : '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No hay usuarios inactivos.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </main>


              <div id="editModal" class="modal">
                  <div class="modal-content">
                    <span class="close" onclick="closeEditModal()">&times;</span>
                    <h2>Editar Usuario</h2>
                    <form id="editForm" method="POST">
                      <input type="hidden" id="edit-id" name="id">
                      <div class="form-grid">
                        <div class="form-group"><label for="edit-nombre">Nombre:</label><input type="text" id="edit-nombre" name="nombre" required></div>
                        <div class="form-group"><label for="edit-codigo">Código:</label><input type="number" id="edit-codigo" name="codigo" required></div>
                        <div class="form-group full-width"><label for="edit-email">Email:</label><input type="email" id="edit-email" name="email" required></div>
                        <div class="form-group full-width"><label for="edit-tipo_usuario">Tipo:</label><select id="edit-tipo_usuario" name="tipo_usuario" required ${!permisos.crear_usuarios ? 'disabled' : ''}><option value="consejero">Consejero</option><option value="administrativo">Administrativo</option><option value="superadmin">Superadmin</option></select></div>
                        <div><input type="checkbox" id="edit-es_activo" name="es_activo"><label for="edit-es_activo"> Activo</label></div>
                      </div>
                      <button type="submit" class="cta-button" style="width: 100%; margin-top: 20px;">Guardar Cambios</button>
                    </form>
                  </div>
              </div>

              <script>

          // Script para manejar las pestañas
          function openTab(evt, tabName) {
              var i, tabcontent, tabbuttons;
              tabcontent = document.getElementsByClassName("tab-content");
              for (i = 0; i < tabcontent.length; i++) {
                  tabcontent[i].style.display = "none";
              }
              tabbuttons = document.getElementsByClassName("tab-button");
              for (i = 0; i < tabbuttons.length; i++) {
                  tabbuttons[i].className = tabbuttons[i].className.replace(" active", "");
              }
              document.getElementById(tabName).style.display = "block";
              evt.currentTarget.className += " active";
          }
          // Por defecto, mostrar la primera pestaña (activos)
          document.addEventListener('DOMContentLoaded', () => {
              document.getElementById('activos').style.display = 'block';
          });

          function toggleConsejeroFields() {
            const tipo = document.getElementById('tipo_usuario').value;
            document.getElementById('consejero-fields').style.display = tipo === 'consejero' ? 'block' : 'none';
          }
          function openEditModal(user) {
            document.getElementById('editForm').action = '/api/usuarios/edit/' + user.id;
            document.getElementById('edit-id').value = user.id;
            document.getElementById('edit-nombre').value = user.nombre;
            document.getElementById('edit-codigo').value = user.codigo;
            document.getElementById('edit-email').value = user.email;
            document.getElementById('edit-tipo_usuario').value = user.tipo_usuario;
            document.getElementById('edit-es_activo').checked = user.es_activo;
            document.getElementById('editModal').style.display = 'block';
          }
          function closeEditModal() {
            document.getElementById('editModal').style.display = 'none';
          }
          window.onclick = function(event) {
            if (event.target == document.getElementById('editModal')) {
              closeEditModal();
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
function generateMiEspacioPage(usuario, proximaSesion) {
  const { nombre, comisiones, descripcion_rol } = usuario;
  const comisionesHtml = comisiones.map(c => `<span class="comision-tag">${c.nombre}</span>`).join(' ') || '<span class="comision-tag none">Ninguna asignada</span>';

  // Formatear los datos de la sesión que vienen de la DB
  const sesionData = {
      tipo: proximaSesion.tipo || 'No definida',
      lugar: proximaSesion.lugar || 'No definido',
      fecha: proximaSesion.fecha ? new Date(proximaSesion.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No definida',
      hora: proximaSesion.hora || 'No definida',
      temas: proximaSesion.temas ? proximaSesion.temas.split('|') : ['No hay temas definidos'],
      documentos: proximaSesion.documentos || [],
      reglamentos: proximaSesion.reglamentos ? proximaSesion.reglamentos.split('|') : ['Sin sugerencias']
  };

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">  
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mi Espacio - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
        <style>
            /* --- Estilos para un diseño más elegante --- */
            body {
                background-color: #f4f7f9; /* Un gris muy claro para el fondo */
            }
            .main-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 1rem;
                display: grid;
                grid-template-columns: 1fr;
                gap: 2rem;
            }
            @media (min-width: 992px) {
                .main-container {
                    grid-template-columns: 1fr 2fr; /* Columna de perfil más pequeña que la de sesión */
                }
            }
            .info-card {
                background-color: #ffffff;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                border: 1px solid #eef;
            }
            .info-card h3 {
                font-size: 1.5rem;
                font-weight: 500;
                color: #333;
                margin-top: 0;
                margin-bottom: 1.5rem;
                border-bottom: 2px solid #007BFF;
                padding-bottom: 0.5rem;
                display: inline-block;
            }
            .info-card p {
                font-size: 1rem;
                color: #555;
                margin-bottom: 1rem;
                line-height: 1.6;
            }
            .info-card p strong {
                font-weight: 500;
                color: #333;
            }
            .comision-tag {
                display: inline-block;
                background-color: #e3f2fd;
                color: #1565c0;
                padding: 0.3rem 0.8rem;
                border-radius: 15px;
                font-size: 0.9rem;
                margin-right: 5px;
                margin-bottom: 5px;
            }
            .comision-tag.none {
                background-color: #f8f9fa;
                color: #6c757d;
            }
            
            .session-card {
                background: linear-gradient(135deg, #007BFF, #0056b3);
                color: white;
                border-radius: 12px;
                padding: 2rem;
                box-shadow: 0 8px 30px rgba(0, 123, 255, 0.3);
            }
            .session-card h3, .session-card h4 {
                font-weight: 500;
                border-bottom: 1px solid rgba(255, 255, 255, 0.3);
                padding-bottom: 0.5rem;
                margin-bottom: 1rem;
            }
            .session-details-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            .detail-item {
                background: rgba(255, 255, 255, 0.1);
                padding: 1rem;
                border-radius: 8px;
            }
            .detail-item strong {
                display: block;
                font-size: 0.9rem;
                opacity: 0.8;
                margin-bottom: 0.25rem;
            }
            .badge {
                background-color: #28a745;
                padding: 0.3rem 0.8rem;
                border-radius: 15px;
                font-size: 0.9rem;
                font-weight: bold;
            }
            ul {
                list-style-type: none;
                padding-left: 0;
            }
            ul li {
                background-color: rgba(255, 255, 255, 0.1);
                margin-bottom: 0.5rem;
                padding: 0.75rem;
                border-radius: 4px;
                transition: background-color 0.3s ease;
            }
            ul li:hover {
                background-color: rgba(255, 255, 255, 0.2);
            }
            ul li a {
                color: white;
                text-decoration: none;
                font-weight: 500;
            }
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

        <main class="main-container">
            <div class="info-card">
                <h3>Mi Perfil</h3>
                <p><strong>Nombre:</strong> ${nombre}</p>
                <p><strong>Rol:</strong> ${descripcion_rol}</p>
                <p><strong>Comisiones Asignadas:</strong></p>
                <div>${comisionesHtml}</div>
            </div>

            <div class="session-card">
                <h3>Próxima Sesión del ICU</h3>
                <div class="session-details-grid">
                    <div class="detail-item">
                        <strong>Tipo:</strong>
                        <span class="badge">${sesionData.tipo}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Fecha:</strong>
                        <span>${sesionData.fecha}</span>
                    </div>
                    <div class="detail-item">
                        <strong>Hora:</strong>
                        <span>${sesionData.hora}</span>
                    </div>
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <strong>Lugar:</strong>
                        <span>${sesionData.lugar}</span>
                    </div>
                </div>

                <h4>Temas a Tratar</h4>
                <ul>${sesionData.temas.map(t => `<li>${t}</li>`).join('')}</ul>
                
                <h4>Documentos para la Sesión</h4>
                <ul>${sesionData.documentos.length > 0 ? sesionData.documentos.map(d => `<li><a href="/api/documentos/${d.id}/download">${d.titulo}</a></li>`).join('') : '<li>No hay documentos adjuntos.</li>'}</ul>
                
                <h4>Reglamentos a Revisar</h4>
                <ul>${sesionData.reglamentos.map(r => `<li>${r}</li>`).join('')}</ul>
            </div>
        </main>
    </body>
    </html>
  `;
}


function generateGestionSesionPage(sesion, documentos, docsAsociadosIds) {

    const lugares = [ // Puedes expandir esta lista o moverla a la DB en el futuro
        'Salón Provincia - Yapacani',
        'Salón Auditorio - Facultad de Ciencias Veterinarias',
        'Salón Auditorio - Facultad de Ciencias Humanidades'
    ];

    const temasRecurrentes = [
        'Lectura de correspondencia',
        'Informe de comisiones',
        'Temas varios',
        'Aprobación de actas'
    ];

    // [CORREGIDO] Asegurarse de que los datos existan y sean arrays
    const temasGuardados = sesion.temas ? sesion.temas.split('|').map(t => t.trim()) : [];
    const reglamentosGuardados = sesion.reglamentos ? sesion.reglamentos.split('|').map(r => r.trim()) : [];
    const docsAsociados = Array.isArray(docsAsociadosIds) ? docsAsociadosIds : [];

    // [CORREGIDO] Formatear fecha y hora para los inputs
    const fechaFormatted = sesion.fecha ? new Date(sesion.fecha).toISOString().split('T')[0] : '';
    const horaFormatted = sesion.hora || '';

    // [CORREGIDO] El bucle para las opciones de documentos ahora funciona
    let documentosOptions = documentos.map(d => {
        const isSelected = docsAsociados.includes(d.id) ? 'selected' : '';
        return `<option value="${d.id}" ${isSelected}>${d.titulo}</option>`;
    }).join('');

    return `
        <!DOCTYPE html><html lang="es">
        <head>
            <meta charset="UTF-8"><title>Gestionar Sesión</title>
            <link rel="stylesheet" href="/estilos.css">
            <style>
                /* [NUEVO] Estilos para el nuevo diseño del formulario */
                .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px 30px; }
                .form-group { display: flex; flex-direction: column; }
                .full-width { grid-column: 1 / -1; }
                .checkbox-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; border: 1px solid #eee; padding: 10px; border-radius: 5px; }
                .checkbox-group div { display: flex; align-items: center; }
            </style>
        </head>
        
        <body>
          <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
          </nav>
       
            <main class="container">
                <h2 style="text-align: center;">Gestionar Próxima Sesión</h2>
                 <form action="/api/sesion/update" method="POST" class="form-container">
                    <input type="hidden" name="sesion_id" value="${sesion.id || ''}">
                    
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="tipo">Tipo de Sesión:</label>
                            <select id="tipo" name="tipo" required>
                                <option value="Ordinaria" ${sesion.tipo === 'Ordinaria' ? 'selected' : ''}>Ordinaria</option>
                                <option value="Extraordinaria" ${sesion.tipo === 'Extraordinaria' ? 'selected' : ''}>Extraordinaria</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="lugar">Lugar:</label>
                            <select id="lugar" name="lugar" required>
                                ${lugares.map(l => `<option value="${l}" ${sesion.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="fecha">Fecha:</label>
                            <input type="date" id="fecha" name="fecha" value="${fechaFormatted}" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="hora">Hora:</label>
                            <input type="time" id="hora" name="hora" value="${horaFormatted}" required>
                        </div>
                        
                        <div class="form-group full-width">
                            <label>Temas Recurrentes:</label>
                            <div class="checkbox-group">
                                ${temasRecurrentes.map(t => `
                                    <div>
                                        <input type="checkbox" id="tema_${t.replace(/\s+/g, '')}" name="temas_recurrentes" value="${t}" ${temasGuardados.includes(t) ? 'checked' : ''}>
                                        <label for="tema_${t.replace(/\s+/g, '')}">${t}</label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <label for="temas_nuevos">Temas Nuevos (uno por línea):</label>
                            <textarea name="temas_nuevos" rows="4">${
                                temasGuardados.filter(t => !temasRecurrentes.includes(t)).join('\n')
                            }</textarea>
                        </div>
                        
                        <div class="form-group full-width">
                            <label for="documentos">Documentos para la sesión (Ctrl+Click para selección múltiple):</label>
                            <select name="documentos" multiple size="8">${documentosOptions}</select>
                        </div>

                        <div class="form-group full-width">
                            <label for="reglamentos">Reglamentos a revisar (Sugeridos por el sistema, uno por línea):</label>
                            <textarea name="reglamentos" rows="3">${reglamentosGuardados.join('\n')}</textarea>
                        </div>
                    </div>

                    <button type="submit" class="cta-button" style="width: 100%; margin-top: 20px;">Guardar Cambios y Sugerir Reglamentos</button>
                </form>
            </main>
        
        </body>
    </html>`;
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
      console.log(`_._ Mi Espacio: http://localhost:${port}/mi_espacio`);
      
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