// server.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { pool, testConnection } = require('./config/database');
const { Usuario, SistemaUsuarios, Facultad, Comision } = require('./models/User');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

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

// Middleware para poder leer los datos del formulario
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sirve los archivos estáticos desde la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware para verificar autenticación
function requireAuth(req, res, next) {
  if (req.session.usuario) {
    next();
  } else {
    res.redirect('/login.html?error=auth_required');
  }
}

// Middleware para logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Ruta de inicio - verificar conexión a DB
app.get('/', async (req, res, next) => {
  try {
    // Verificar conexión a base de datos
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

// Ruta para el login
app.post('/login', async (req, res) => {
  try {
    const { codigo, contrasena } = req.body;
    
    // Validación básica
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

    // Autenticar usuario
    const usuario = await Usuario.authenticate(parseInt(codigo), contrasena);
    
    if (usuario) {
      // Obtener datos completos del usuario
      const datosCompletos = await usuario.getCompleteData();
      const comisiones = await usuario.getComisiones();

      // Guardar información del usuario en la sesión
      req.session.usuario = {
        id: datosCompletos.id,
        codigo: datosCompletos.codigo,
        nombre: datosCompletos.nombre,
        email: datosCompletos.email,
        rol: datosCompletos.rol,
        descripcion_rol: datosCompletos.descripcion_rol,
        tipo_usuario: datosCompletos.tipo_usuario,
        comisiones: comisiones,
        login_time: new Date().toISOString()
      };

      console.log(`✅ Login exitoso: ${datosCompletos.nombre} (${datosCompletos.codigo})`);
      
      // Redirigir al dashboard
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
            <div style="background-color: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
              <h4>💡 Recordar que el login es parecido al de Perfil Uagrm 💡:</h4>
              <p><strong>Administrativo:</strong> Login: Codigo administrativo, Contraseña: CI</p>
              <p><strong>Consejero Estudiante:</strong> Login: Registro universitario, Contraseña: CI</p>
              <p><strong>Consejero Docente:</strong> Login: Codigo docente, Contraseña: CI</p>
            </div>
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

// Ruta para el dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const stats = await SistemaUsuarios.getStats();
    
    // Generar tarjetas de comisiones
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
      comisionesHtml = '<p>No está asignado a ninguna comisión actualmente o es administrativo.</p>';
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
              .dashboard-container {
                  max-width: 1200px;
                  margin: 2rem auto;
                  padding: 0 1rem;
              }
              .welcome-card {
                  background: linear-gradient(135deg, #f8f9fa);
                  color: white;
                  padding: 2rem;
                  border-radius: 12px;
                  margin-bottom: 2rem;
                  text-align: center;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
              .user-info {
                  background-color: #f8f9fa;
                  padding: 1.5rem;
                  border-radius: 8px;
                  margin-bottom: 2rem;
                  border: 1px solid #dee2e6;
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
              .comisiones-section {
                  background: white;
                  padding: 1.5rem;
                  border-radius: 8px;
                  margin-bottom: 2rem;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .comision-card {
                  background: #f8f9fa;
                  padding: 1rem;
                  border-radius: 6px;
                  margin: 0.5rem 0;
                  border-left: 3px solid #007BFF;
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
                  background-color: rgba(0, 123, 255, 0.2);
                  color: white;
              }
              .time-info {
                  font-size: 0.9rem;
                  opacity: 0.8;
              }
              @media (max-width: 768px) {
                  .dashboard-container {
                      padding: 0 0.5rem;
                  }
                  .stats-grid {
                      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                  }
              }
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

          <div class="dashboard-container">
              <div class="welcome-card">
                  <h1>¡Bienvenido ${usuario.nombre}!</h1>
                  <p><strong>${usuario.descripcion_rol}</strong></p>
                  <span class="role-badge">${usuario.rol.replace('_', ' ').toUpperCase()}</span>
                  <div class="time-info">
                      <p>Sesión iniciada: ${new Date(usuario.login_time).toLocaleString()}</p>
                  </div>
              </div>

              <div class="user-info">
                  <h3>📋 Información del Usuario</h3>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                      <div><strong>Código:</strong> ${usuario.codigo}</div>
                      <div><strong>Nombre:</strong> ${usuario.nombre}</div>
                      <div><strong>Nivel de cuenta:</strong> ${usuario.tipo_usuario}</div>
                      <div><strong>Rol:</strong> ${usuario.descripcion_rol}</div>
                  </div>
              </div>

              <div class="comisiones-section">
                  <h3>🏛️ Mi Comision</h3>
                  ${comisionesHtml}
              </div>

              <h3>⚡ Acciones Rápidas</h3>
              <div class="quick-actions">
                  <div class="action-card" onclick="window.location.href='/usuarios'">
                      <h4>👥 Usuarios</h4>
                      <p>Gestionar usuarios del sistema</p>
                  </div>
                  <div class="action-card" onclick="alert('Próximamente')">
                      <h4>📄 Documentos</h4>
                      <p>Gestionar documentos del ICU</p>
                  </div>
                  <div class="action-card" onclick="alert('Próximamente')">
                      <h4>🏛️ Comisiones</h4>
                      <p>Ver todas las comisiones</p>
                  </div>
                  <div class="action-card" onclick="alert('Próximamente')">
                      <h4>📊 Reportes</h4>
                      <p>Generar reportes y análisis</p>
                  </div>
                  <div class="action-card" onclick="alert('Próximamente')">
                      <h4>🎓 Facultades</h4>
                      <p>Información de facultades</p>
                  </div>
              </div>
          </div>

          <script>
              // Auto-refresh de estadísticas cada 5 minutos
              setTimeout(() => {
                  window.location.reload();
              }, 300000);
          </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// Ruta para ver usuarios
app.get('/usuarios', requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const resultado = await SistemaUsuarios.getAllUsers(page, limit);
    
    res.json(resultado);
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Ruta para cerrar sesión
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

// Ruta de salud del sistema
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

// Manejo de errores 404
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
        <a href="/" class="cta-button">Volver al inicio</a>
      </div>
    </body>
    </html>
  `);
});

// Manejo global de errores
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
        <a href="/" class="cta-button">Volver al inicio</a>
      </div>
    </body>
    </html>
  `);
});

// Iniciar servidor
async function startServer() {
  try {
    // Probar conexión a la base de datos
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se puede conectar a PostgreSQL');
    }

    app.listen(port, () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
      console.log(`📊 Dashboard de salud: http://localhost:${port}/health`);
      console.log(`👥 API de usuarios: http://localhost:${port}/usuarios`);
      
      console.log('\n=== USUARIOS DE PRUEBA ===');
      console.log('📋 Todos los usuarios tienen contraseña: 123 o 12345');
      console.log('🏛️  Administrativos: 5050, 5051');
      console.log('🎓 Consejeros Estudiantes: 214144130, 224044130');
      console.log('👨‍🏫 Consejeros Docentes: 6060, 6061');
      
      console.log('\n✅ Sistema ICU listo para usar');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

startServer();