// services/emailService.js
const { pool } = require('../config/database');
const { emailQueue } = require('./queueService');

async function notificarProgramacionSesion({ tipo, lugar, fecha, hora }) {
    try {
        // 1. Obtener los correos de todos los consejeros activos
        const result = await pool.query(`
            SELECT u.email, u.nombre 
            FROM usuarios u 
            INNER JOIN consejeros_icu c ON u.id = c.usuario_id 
            WHERE u.es_activo = true AND u.email IS NOT NULL
        `);
        
        const consejeros = result.rows;
        if (consejeros.length === 0) return;

        console.log(`📥 Encolando ${consejeros.length} correos para la sesión ${tipo}...`);

        // 2. Iterar y agregar cada correo a la cola (BullMQ)
        for (const consejero of consejeros) {
            const htmlContent = `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <h2 style="color: #0055a4;">Convocatoria a Sesión ${tipo} del ICU</h2>
                    <p>Estimado/a <strong>${consejero.nombre}</strong>,</p>
                    <p>Se le notifica que ha sido convocada una nueva sesión del Ilustre Consejo Universitario con los siguientes detalles:</p>
                    <ul>
                        <li><strong>Fecha:</strong> ${fecha}</li>
                        <li><strong>Hora:</strong> ${hora}</li>
                        <li><strong>Lugar:</strong> ${lugar}</li>
                    </ul>
                    <p>Puede revisar la agenda y los documentos a tratar ingresando a su panel en <strong>Mi Espacio ICU</strong>.</p>
                </div>
            `;

            // Agregar a la cola con configuración de reintentos automáticos
            await emailQueue.add('enviar-convocatoria', {
                to: consejero.email,
                subject: `Convocatoria ICU - Sesión ${tipo}`,
                html: htmlContent
            }, {
                attempts: 3, // Reintentar 3 veces si el servidor de correos falla
                backoff: {
                    type: 'exponential',
                    delay: 5000 // Esperar 5s, luego 25s, luego 125s...
                }
            });
        }
        
        console.log('✅ Todos los correos han sido enviados a la cola de Redis.');
    } catch (error) {
        console.error('Error al encolar notificaciones de sesión:', error);
    }
}

module.exports = { notificarProgramacionSesion };