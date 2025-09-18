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
      comisionesHtml = '<p>Es administrativo, directiva o no está asignado a ninguna comisión actualmente.</p>';
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dashboard ICU - ${usuario.nombre}</title>
          <link rel="stylesheet" href="estilos.css">
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
        <div class="split-container">
          
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
            <div class="list-column">
              <h3>⚡ Módulos Disponibles</h3>
              <div class="quick-actions">
                  ${accionesHtml}
              </div>
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
        const limit = 20; // O el límite que prefieras
        
        const usuariosData = await SistemaUsuarios.getAllUsers(page, limit);
        const facultades = await Facultad.getAll(); // Asumiendo que tienes este método

        // Pasamos el objeto 'usuariosData' completo y las facultades
        res.send(generateUsuariosPage(usuariosData, facultades));
    } catch (error) {
        res.status(500).send("Error al cargar la página de usuarios.");
    }
});

// REEMPLAZA ESTA RUTA EN TU CÓDIGO
app.post('/api/usuarios/add', requireAuth, requireRole(['administrativo']), async (req, res) => {
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

// REEMPLAZA ESTA RUTA EN TU CÓDIGO
app.post('/api/usuarios/edit/:id', requireAuth, requireRole(['administrativo']), async (req, res) => {
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

function generateUsuariosPage(data, facultades) {

  const { usuarios } = data; 

    let usuariosHtml = usuarios.map(u => `
        <div class="card">
            <h3>${u.nombre}</h3>
            <p><strong>Código:</strong> ${u.codigo}</p>
            <p><strong>Email:</strong> ${u.email}</p>
            <p><strong>Rol:</strong> ${u.detalle_rol || u.tipo_usuario}</p>
            <p><strong>Estado:</strong> <span class="${u.es_activo ? 'status-active' : 'status-inactive'}">${u.es_activo ? 'Activo' : 'Inactivo'}</span></p>
            <button class="cta-button" onclick="openEditModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Editar</button>
        </div>
    `).join('');

    let facultadesOptions = facultades.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Usuarios - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
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

        <main>
                <div class="split-container">
                 <div class="form-column">
                      <h2>Añadir Nuevo Usuario</h2>
                      <form action="/api/usuarios/add" method="POST" class="form-container" onsubmit="return handleFormSubmit(event)">
                        <label for="nombre">Nombre Completo:</label><input type="text" id="nombre" name="nombre" required>
                        <label for="codigo">Código:</label><input type="number" id="codigo" name="codigo" required>
                        <label for="email">Email:</label><input type="email" id="email" name="email" required>
                        <label for="contrasena">Contraseña:</label><input type="password" id="contrasena" name="contrasena" required>
                        <label for="tipo_usuario">Tipo de Usuario:</label>
                        <select id="tipo_usuario" name="tipo_usuario" onchange="toggleConsejeroFields()" required>
                            <option value="administrativo">Administrativo</option>
                            <option value="consejero">Consejero</option>
                        </select>
                        <div id="consejero-fields" style="display:none;">
                            <label for="facultad_id">Facultad:</label><select id="facultad_id" name="facultad_id">${facultadesOptions}</select>
                            <label for="gestion">Gestión:</label><input type="text" id="gestion" name="gestion" placeholder="Ej: 2024-2026">
                            <div><input type="checkbox" id="es_estudiante" name="es_estudiante"><label for="es_estudiante">Es Estudiante</label></div>
                            <div><input type="checkbox" id="es_docente" name="es_docente"><label for="es_docente">Es Docente</label></div>
                        </div>
                        <button type="submit" class="cta-button">Añadir Usuario</button>
                      </form>
                  </div>
                
                <hr>
               <div class="list-column">
                    <h2>Usuarios Existentes</h2>
                    <div class="user-list-container">
                        <table class="user-table">
                            <thead>
                                <tr>
                                    <th>Usuario</th>
                                    <th>Rol</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${usuarios.map(u => `
                                    <tr>
                                        <td><strong>${u.nombre}</strong><br><small>Código: ${u.codigo}</small></td>
                                        <td>${u.detalle_rol || u.tipo_usuario}</td>
                                        <td><span class="${u.es_activo ? 'status-active' : ''}">${u.es_activo ? 'Activo' : 'Inactivo'}</span></td>
                                        <td>
                                            <button class="edit-button" onclick="openEditModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
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
                  <label for="edit-nombre">Nombre:</label><input type="text" id="edit-nombre" name="nombre" required>
                  <label for="edit-codigo">Código:</label><input type="number" id="edit-codigo" name="codigo" required>
                  <label for="edit-email">Email:</label><input type="email" id="edit-email" name="email" required>
                  <label for="edit-tipo_usuario">Tipo:</label><select id="edit-tipo_usuario" name="tipo_usuario" required><option value="administrativo">Administrativo</option><option value="consejero">Consejero</option></select>
                  <div><input type="checkbox" id="edit-es_activo" name="es_activo"><label for="edit-es_activo">Activo</label></div>
                  <button type="submit" class="cta-button">Guardar Cambios</button>
                </form>
              </div>
            </div>

             <script>
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