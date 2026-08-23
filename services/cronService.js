
// services/cronService.js
const cron = require('node-cron');
const { pool } = require('../config/database');
const { enviarCorreosConsejeros } = require('./emailService');

function iniciarCronJobs() {
    cron.schedule('0 7 * * *', async () => {
        console.log('⏰ Ejecutando revisión diaria de sesiones programadas...');
        try {
            const result = await pool.query(`SELECT id, tipo, hora, lugar FROM sesiones WHERE fecha = CURRENT_DATE`);

            if (result.rows.length > 0) {
                const sesionHoy = result.rows[0];
                console.log('🔔 ¡Hay sesión hoy! Generando recordatorios...');
                
                // 1. Alerta en el sistema
                await pool.query(`
                    INSERT INTO notificaciones (usuario_id, titulo, mensaje, tipo_evento)
                    SELECT id, 'Recordatorio: Sesión Hoy', 
                           'Recuerde que hoy a las ' || $1 || ' se llevará a cabo la sesión ' || $2 || ' en: ' || $3, 
                           'RECORDATORIO_SESION'
                    FROM usuarios WHERE tipo_usuario = 'consejero' AND es_activo = true
                `, [sesionHoy.hora, sesionHoy.tipo, sesionHoy.lugar]);

                // 2. Alerta por correo
                enviarCorreosConsejeros(
                    'Recordatorio: Sesión del ICU el día de HOY', 
                    `<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 5px solid #007BFF;">
                        <h2 style="margin-top: 0;">Recordatorio de Sesión</h2>
                        <p>Estimado(a) Consejero(a), le recordamos que <strong>HOY a las ${sesionHoy.hora}</strong> se llevará a cabo la sesión <strong>${sesionHoy.tipo}</strong>.</p>
                        <p><strong>Lugar:</strong> ${sesionHoy.lugar}</p>
                        <p>Se solicita puntual asistencia.</p>
                    </div>`
                );
            }
        } catch (error) {
            console.error('❌ Error en el Cron Job de recordatorios:', error);
        }
    });
    console.log('✅ Tareas programadas (Cron Jobs) iniciadas.');
}

module.exports = { iniciarCronJobs };