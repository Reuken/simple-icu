const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { query, pool, testConnection, getClient } = require('../config/database');
const { Usuario, SistemaUsuarios, Facultad, Comision } = require('../models/User');
const DocumentController = require('../controllers/DocumentController');
const ReportController = require('../controllers/ReportController');
const { enviarCorreosConsejeros, notificarProgramacionSesion } = require('../services/emailService');
const { generarActaSesionPDF } = require('../services/pdfReportService');

const { 
    generateDashboardPage, 
    generateUsuariosPage, 
    generateComisionesPage, 
    generateFacultadesPage, 
    generateMiEspacioPage, 
    generateGestionSesionPage,
    generateDiaSesionPage,
    generateDocumentosListarPage,   
    generateDocumentosSubirPage,      
    generateDocumentosEstadosPage     
} = require('../views/pages');

// Configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './uploads/documents/';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage, 
  fileFilter: (req, file, cb) => file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Solo PDFs'), false),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// Middlewares Inteligentes de Autenticación (Responden JSON a la API y HTML a las vistas)
function requireAuth(req, res, next) {
  if (req.session && req.session.usuario) return next();
  if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ success: false, error: 'Sesión expirada' });
  res.redirect('/login.html?error=auth_required');
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.usuario) {
      if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ success: false, error: 'No autenticado' });
      return res.redirect('/login.html');
    }
    if (roles.includes(req.session.usuario.tipo_usuario) || roles.includes(req.session.usuario.rol)) return next();
    if (req.originalUrl.startsWith('/api/')) return res.status(403).json({ success: false, error: 'Sin permisos' });
    res.redirect('/dashboard');
  };
}

function getPermisos(tipo, rol) {
  const p = { ver_usuarios: false, crear_usuarios: false, ver_documentos: false, subir_documentos: false, ver_comisiones: false, ver_reportes: false, ver_facultades: false, ver_mi_espacio: false, gestionar_sesion: false };
  if (tipo === 'superadmin') Object.keys(p).forEach(k => p[k] = true);
  else if (tipo === 'consejero') { p.ver_documentos = true; p.ver_comisiones = true; p.ver_facultades = true; p.ver_mi_espacio = true; }
  else if (tipo === 'administrativo') { p.ver_documentos = true; p.ver_comisiones = true; p.ver_facultades = true; p.ver_usuarios = true; p.ver_reportes = true; p.subir_documentos = true; p.gestionar_sesion = true; }
  return p;
}

// ==========================================
// 1. RUTAS PRINCIPALES Y LOGIN
// ==========================================
router.get('/', async (req, res) => {
  try {
    if (!(await testConnection())) throw new Error('Sin conexión a BD');
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } catch (error) { res.status(500).send(`Error de base de datos: ${error.message}`); }
});

router.post('/login', async (req, res) => {
  try {
    const { codigo, contrasena } = req.body;
    if (!codigo || !contrasena) return res.status(400).send('Campos vacíos.');

    const usuario = await Usuario.authenticate(parseInt(codigo), contrasena);
    if (usuario) {
      const datosCompletos = await usuario.getCompleteData();
      req.session.usuario = {
        id: datosCompletos.id, codigo: datosCompletos.codigo, nombre: datosCompletos.nombre, email: datosCompletos.email,
        rol: datosCompletos.rol, descripcion_rol: datosCompletos.descripcion_rol, tipo_usuario: datosCompletos.tipo_usuario,
        comisiones: await usuario.getComisiones(), login_time: new Date().toISOString(),
        permisos: getPermisos(datosCompletos.tipo_usuario, datosCompletos.rol)
      };
      res.redirect('/dashboard');
    } else res.status(401).send('Código o contraseña incorrectos.');
  } catch (error) { res.status(500).send('Error interno.'); }
});

router.get('/dashboard', requireAuth, (req, res) => res.send(generateDashboardPage(req.session.usuario)));
router.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/?logout=success')));

// ==========================================
// 2. DOCUMENTOS, ESTADOS Y BITÁCORA
// ==========================================

// --- Vistas HTML ---
router.get('/documentos/listar', requireAuth, (req, res) => res.send(generateDocumentosListarPage([], req.session.usuario)));

router.get('/documentos/subir', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    res.send(generateDocumentosSubirPage(await Comision.getAll(), req.session.usuario));
});

router.get('/documentos/estados', requireAuth, requireRole(['administrativo', 'superadmin']), (req, res) => {
    res.send(generateDocumentosEstadosPage(req.session.usuario));
});

// Alias por compatibilidad
router.get('/documentos', (req, res) => res.redirect('/documentos/listar'));

// --- Endpoints API ---
router.get('/api/documentos', requireAuth, (req, res) => DocumentController.getDocumentos(req, res));
router.get('/api/documentos/bitacora', requireAuth, (req, res) => DocumentController.getBitacora(req, res));
router.get('/api/documentos/:id/download', requireAuth, (req, res) => DocumentController.downloadDocumento(req, res));
router.get('/api/documentos/:id/preview', requireAuth, (req, res) => DocumentController.previewDocumento(req, res));
router.delete('/api/documentos/:id', requireAuth, requireRole(['administrativo', 'superadmin']), (req, res) => DocumentController.deleteDocumento(req, res));

// Endpoint subida OCR optimizado
router.post('/api/documentos', requireAuth, requireRole(['administrativo', 'superadmin']), (req, res) => {
    const uploadSingle = upload.single('archivo');
    uploadSingle(req, res, (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        if (!req.file) return res.status(400).json({ success: false, error: 'Archivo requerido.' });
        DocumentController.uploadDocumento(req, res).catch(e => {
            if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
        });
    });
});

// Endpoint cambiar estado y registrar en Bitácora
router.put('/api/documentos/:id/estado', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    const { nuevo_estado, observacion } = req.body;
    const docId = req.params.id;
    const client = await getClient();
    try {
        await client.query('BEGIN');
        
        // Obtener estado anterior
        const docRes = await client.query('SELECT estado FROM documentos WHERE id = $1', [docId]);
        if (docRes.rows.length === 0) throw new Error('Documento no encontrado');
        const estadoAnterior = docRes.rows[0].estado;

        // Actualizar Documento
        await client.query(`UPDATE documentos SET estado = $1 WHERE id = $2`, [nuevo_estado, docId]);

        // Registrar en Bitácora
        await client.query(`
            INSERT INTO bitacora_documentos (documento_id, usuario_id, estado_anterior, estado_nuevo, observacion)
            VALUES ($1, $2, $3, $4, $5)
        `, [docId, req.session.usuario.id, estadoAnterior, nuevo_estado, observacion]);

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (error) { 
        await client.query('ROLLBACK'); 
        res.status(500).json({ success: false, error: error.message }); 
    } finally { 
        client.release(); 
    }
});

router.get('/reportes', requireAuth, requireRole(['administrativo', 'superadmin']), (req, res) => ReportController.getReportesPage(req, res));
router.get('/api/reportes/resumen', requireAuth, (req, res) => ReportController.getResumenGeneral(req, res));
router.get('/api/reportes/temporal', requireAuth, (req, res) => ReportController.getAnalisisTemporal(req, res));
router.get('/api/reportes/comisiones', requireAuth, (req, res) => ReportController.getDistribucionComisiones(req, res));
router.get('/api/reportes/palabras-clave', requireAuth, (req, res) => ReportController.getPalabrasClave(req, res));
router.get('/api/reportes/nlp', requireAuth, (req, res) => ReportController.getAnalisisNLP(req, res));
router.get('/api/reportes/recientes', requireAuth, (req, res) => ReportController.getDocumentosRecientes(req, res));
router.get('/api/reportes/documentos', requireAuth, (req, res) => ReportController.getDocumentosReport(req, res));
router.get('/api/historial-sesiones', requireAuth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT s.id, s.tipo, s.fecha, s.hora, s.estado,
                   (
                       SELECT json_agg(json_build_object('id', d.id, 'titulo', d.titulo))
                       FROM documentos d
                       JOIN sesion_documentos sd ON d.id = sd.documento_id
                       WHERE sd.sesion_id = s.id AND sd.estado_tratamiento IN ('Aprobado', 'Promulgado')
                   ) as resoluciones
            FROM sesiones s
            ORDER BY s.fecha DESC, s.hora DESC
            LIMIT 15
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error en /api/historial-sesiones:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 3. COMISIONES, FACULTADES Y USUARIOS
// ==========================================
router.get('/comisiones', requireAuth, requireRole(['administrativo', 'consejero', 'superadmin']), async (req, res) => {
  try {
    const comisiones = await Comision.getAll();
    const comisionesConDetalles = await Promise.all(comisiones.map(async (c) => {
      const miembros = await query(`SELECT u.nombre, u.id FROM usuarios u JOIN usuario_comisiones uc ON u.id = uc.usuario_id WHERE uc.comision_id = $1 AND uc.es_activo = true`, [c.id]);
      const docs = await query(`SELECT id, titulo FROM documentos WHERE comision_id = $1 ORDER BY fecha_ingreso DESC`, [c.id]);
      return { ...c, miembros: miembros.rows, documentos: docs.rows };
    }));
    res.send(generateComisionesPage(comisionesConDetalles, req.session.usuario));
  } catch (error) { res.status(500).send('Error.'); }
});
router.get('/api/comisiones', requireAuth, async (req, res) => res.json(await Comision.getAll()));
router.get('/facultades', requireAuth, requireRole(['administrativo', 'consejero', 'superadmin']), async (req, res) => {
    res.send(generateFacultadesPage(await Facultad.obtenerTodasConConsejeros(), req.session.usuario));
});

router.get('/usuarios', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        const usuariosData = await SistemaUsuarios.getAllUsers({ page, limit: 20, search, includeInactive: true });
        usuariosData.search = search;
        if (req.session.usuario.tipo_usuario === 'administrativo') usuariosData.usuarios = usuariosData.usuarios.filter(u => u.tipo_usuario !== 'superadmin');
        res.send(generateUsuariosPage(usuariosData, await Facultad.getAll(), req.session.usuario));
    } catch (error) { res.status(500).send("Error."); }
});
router.post('/api/usuarios/add', requireAuth, requireRole(['superadmin']), async (req, res) => {
    try {
        const { nombre, codigo, email, contrasena, tipo_usuario, facultad_id, gestion, es_estudiante, es_docente, funcion } = req.body;
        await Usuario.create({ nombre, codigo: parseInt(codigo), email, contrasena, tipo_usuario, facultad_id: tipo_usuario === 'consejero' ? parseInt(facultad_id) : null, gestion: gestion || '2024-2026', es_estudiante: es_estudiante === 'on', es_docente: es_docente === 'on', es_directiva: false, funcion: tipo_usuario === 'administrativo' ? funcion : null });
        res.redirect('/usuarios');
    } catch (error) { res.status(500).send('Error'); }
});
router.post('/api/usuarios/edit/:id', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    try {
        const u = await Usuario.findById(req.params.id);
        if (u) { await u.update({ nombre: req.body.nombre, email: req.body.email }); await u.setActive(req.body.es_activo === 'on'); }
        res.redirect('/usuarios');
    } catch (error) { res.status(500).send('Error'); }
});

// ==========================================
// 4. GESTIÓN DE SESIÓN Y EN VIVO
// ==========================================
router.get('/gestion_sesion', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    const client = await getClient();
    try {
        // CORRECCIÓN: Filtrar explícitamente para NO cargar sesiones ya finalizadas
        const sesionResult = await client.query(`
            SELECT * FROM sesiones 
            WHERE estado != 'Finalizada' 
            ORDER BY fecha DESC, hora DESC LIMIT 1
        `);
        // Si no hay sesiones activas, sesionActual será un objeto vacío (formulario limpio)
        const sesionActual = sesionResult.rows[0] || {}; 

        const documentosRecientes = (await client.query('SELECT id, titulo FROM documentos ORDER BY fecha_ingreso DESC LIMIT 30')).rows;
        const docsAsociadosIds = sesionActual.id 
            ? (await client.query('SELECT documento_id FROM sesion_documentos WHERE sesion_id = $1', [sesionActual.id])).rows.map(r => r.documento_id) 
            : [];
            
        res.send(generateGestionSesionPage(sesionActual, documentosRecientes, docsAsociadosIds, req.session.usuario));
    } catch (error) { 
        console.error('Error:', error);
        res.status(500).send('Error.'); 
    } finally {
        client.release();
    }
});

router.post('/api/sesion/update', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    const { sesion_id, tipo, lugar, fecha, hora, temas_recurrentes, temas_nuevos, documentos } = req.body;
    let idSesionNum = (sesion_id && String(sesion_id).trim()) ? parseInt(sesion_id, 10) : null;
    const client = await getClient();
    try {
        await client.query('BEGIN');
        let arrayTemas = Array.isArray(temas_recurrentes) ? [...temas_recurrentes] : (temas_recurrentes ? [temas_recurrentes] : []);
        if (temas_nuevos) arrayTemas.push(...temas_nuevos.split('\n').map(t => t.trim()).filter(Boolean));
        
        const docsArray = documentos ? (Array.isArray(documentos) ? documentos : [documentos]).map(id => parseInt(id, 10)).filter(id => !isNaN(id)) : [];
        let reglamentosString = '';
        if (docsArray.length > 0) {
            const sugerencias = await DocumentController.sugerirReglamentos(docsArray);
            if (Array.isArray(sugerencias)) reglamentosString = sugerencias.map(s => typeof s === 'object' ? (s.texto || s.documento_fuente_titulo) : s).filter(Boolean).join('|');
        }

        if (idSesionNum) {
            await client.query(`UPDATE sesiones SET tipo=$1, lugar=$2, fecha=$3, hora=$4, temas=$5, reglamentos=$6, updated_at=NOW() WHERE id=$7`, [tipo, lugar, fecha, hora, arrayTemas.join('|'), reglamentosString, idSesionNum]);
        } else {
            const nueva = await client.query(`INSERT INTO sesiones (tipo, lugar, fecha, hora, temas, reglamentos, estado) VALUES ($1, $2, $3, $4, $5, $6, 'Programada') RETURNING id`, [tipo, lugar, fecha, hora, arrayTemas.join('|'), reglamentosString]);
            idSesionNum = nueva.rows[0].id;
        }

        await client.query(`DELETE FROM sesion_documentos WHERE sesion_id = $1`, [idSesionNum]);
        for (const docId of docsArray) {
            await client.query(`INSERT INTO sesion_documentos (sesion_id, documento_id, estado_tratamiento) VALUES ($1, $2, 'Pendiente')`, [idSesionNum, docId]);
            await client.query(`UPDATE documentos SET estado = 'Revision' WHERE id = $1 AND estado = 'Borrador'`, [docId]);
        }
        await client.query('COMMIT');
        res.redirect('/gestion_sesion');
    } catch (error) { await client.query('ROLLBACK'); res.status(500).send('Error'); } finally { client.release(); }
});

router.get('/sesion_en_vivo/:id', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    try {
        const sesion = (await query('SELECT * FROM sesiones WHERE id = $1', [req.params.id])).rows[0];
        if (!sesion) return res.status(404).send('Sesión no encontrada');
        const consejeros = await query(`SELECT u.id, u.nombre, c.es_docente, c.es_estudiante, f.nombre as facultad_nombre, COALESCE(a.asistio, false) as asistio FROM usuarios u INNER JOIN consejeros_icu c ON u.id = c.usuario_id LEFT JOIN facultades f ON c.facultad_id = f.id LEFT JOIN asistencia_sesiones a ON a.usuario_id = u.id AND a.sesion_id = $1 WHERE u.es_activo = true ORDER BY c.es_docente DESC, u.nombre ASC`, [req.params.id]);
        const docsSesion = await query(`SELECT d.id, d.titulo, d.categoria, sd.estado_tratamiento, sd.observacion FROM documentos d INNER JOIN sesion_documentos sd ON d.id = sd.documento_id WHERE sd.sesion_id = $1`, [req.params.id]);
        res.send(generateDiaSesionPage(sesion, consejeros.rows, docsSesion.rows, [], req.session.usuario));
    } catch (error) { res.status(500).send('Error.'); }
});

router.post('/api/sesion/:id/asistencia', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM asistencia_sesiones WHERE sesion_id = $1', [req.params.id]);
        for (const item of req.body.asistencias) {
            await client.query(`INSERT INTO asistencia_sesiones (sesion_id, usuario_id, asistio) VALUES ($1, $2, $3)`, [req.params.id, item.usuario_id, item.asistio]);
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (dbErr) { await client.query('ROLLBACK'); res.status(500).json({ success: false, error: dbErr.message }); } finally { client.release(); }
});

// POST: Finalizar Sesión (Guarda Asistencia, Tratamiento y cambia Estado a 'Finalizada')
router.post('/api/sesion/:id/finalizar', requireAuth, requireRole(['administrativo', 'superadmin']), async (req, res) => {
    const sesionIdNum = parseInt(req.params.id, 10);
    const { asistencias, documentos_tratamiento } = req.body;

    if (isNaN(sesionIdNum)) {
        return res.status(400).json({ success: false, error: 'ID de sesión inválido.' });
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // 1. Procesar Asistencias de la sesión
        if (asistencias && Array.isArray(asistencias)) {
            await client.query('DELETE FROM asistencia_sesiones WHERE sesion_id = $1', [sesionIdNum]);
            for (const item of asistencias) {
                await client.query(
                    `INSERT INTO asistencia_sesiones (sesion_id, usuario_id, asistio) VALUES ($1, $2, $3)`,
                    [sesionIdNum, item.usuario_id, item.asistio]
                );
            }
        }

        // 2. Procesar tratamiento de cada documento
        if (documentos_tratamiento && Array.isArray(documentos_tratamiento)) {
            for (const item of documentos_tratamiento) {
                const docId = parseInt(item.documento_id, 10);
                const estado = item.estado_tratamiento || 'Pendiente';
                const obs = item.observacion || '';

                await client.query(`
                    UPDATE sesion_documentos 
                    SET estado_tratamiento = $1, observacion = $2
                    WHERE sesion_id = $3 AND documento_id = $4
                `, [estado, obs, sesionIdNum, docId]);

                await client.query(`
                    UPDATE documentos 
                    SET estado = $1 
                    WHERE id = $2
                `, [estado, docId]);
            }
        }

        // 3. Cambiar estado de la sesión a 'Finalizada' de forma definitiva
        await client.query(`
            UPDATE sesiones 
            SET estado = 'Finalizada', updated_at = NOW() 
            WHERE id = $1
        `, [sesionIdNum]);

        await client.query('COMMIT');
        console.log(`✅ Sesión ID ${sesionIdNum} marcada exitosamente como Finalizada.`);
        return res.json({ success: true, message: 'Sesión finalizada exitosamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error al finalizar sesión completa:', error);
        return res.status(500).json({ success: false, error: error.message || 'Error al guardar la sesión.' });
    } finally {
        client.release();
    }
});

router.get('/api/sesion/:id/resumen-pdf', requireAuth, async (req, res) => {
    try {
        const sesionRes = await query(`SELECT * FROM sesiones WHERE id = $1`, [req.params.id]);
        if (sesionRes.rows.length === 0) return res.status(404).send('Sesión no encontrada');
        const consejerosRes = await query(`SELECT u.nombre, c.es_docente, c.es_estudiante, f.nombre as facultad_nombre, COALESCE(a.asistio, false) as asistio FROM usuarios u INNER JOIN consejeros_icu c ON u.id = c.usuario_id LEFT JOIN facultades f ON c.facultad_id = f.id LEFT JOIN asistencia_sesiones a ON a.usuario_id = u.id AND a.sesion_id = $1 WHERE u.es_activo = true ORDER BY c.es_docente DESC, u.nombre ASC`, [req.params.id]);
        const docsRes = await query(`SELECT d.titulo, d.categoria, sd.estado_tratamiento, sd.observacion FROM documentos d INNER JOIN sesion_documentos sd ON d.id = sd.documento_id WHERE sd.sesion_id = $1`, [req.params.id]);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Acta_Sesion_${req.params.id}.pdf"`);
        generarActaSesionPDF(sesionRes.rows[0], consejerosRes.rows, docsRes.rows, res);
    } catch (error) { res.status(500).send('Error'); }
});

// ==========================================
// 5. MI ESPACIO Y NOTIFICACIONES
// ==========================================
router.get('/mi_espacio', requireAuth, requireRole(['consejero', 'superadmin']), async (req, res) => {
    try {
        const sesionResult = await query(`SELECT s.*, (SELECT json_agg(json_build_object('id', d.id, 'titulo', d.titulo)) FROM documentos d JOIN sesion_documentos sd ON d.id = sd.documento_id WHERE sd.sesion_id = s.id) as documentos FROM sesiones s ORDER BY s.fecha DESC, s.hora DESC LIMIT 1`);
        const proximaSesion = sesionResult.rows[0] || {};
        proximaSesion.reglamentos = await DocumentController.sugerirReglamentos((proximaSesion.documentos || []).map(doc => doc.id));
        res.send(generateMiEspacioPage(req.session.usuario, proximaSesion, await DocumentController.getTodosLosReglamentos(), await ReportController.getCorrespondencia(null)));
    } catch (error) { res.status(500).send('Error.'); }
});

router.get('/api/notificaciones', requireAuth, async (req, res) => res.json((await query(`SELECT * FROM notificaciones WHERE usuario_id = $1 ORDER BY created_at DESC LIMIT 10`, [req.session.usuario.id])).rows));
router.put('/api/notificaciones/:id/leida', requireAuth, async (req, res) => { await query(`UPDATE notificaciones SET leido = true WHERE id = $1 AND usuario_id = $2`, [req.params.id, req.session.usuario.id]); res.json({ success: true }); });

// ==========================================
// 6. MANEJADORES DE ERRORES GLOBALES
// ==========================================
router.use((req, res) => {
  res.status(404).send(`<html><head><title>404</title><link rel="stylesheet" href="/estilos.css"></head><body style="text-align:center; padding:50px;"><h1>404 - Página no encontrada</h1><a href="/dashboard" class="cta-button">Volver al dashboard</a></body></html>`);
});

router.use((err, req, res, next) => {
  console.error('Error no capturado:', err);
  res.status(500).send('Error del servidor');
});

module.exports = router;