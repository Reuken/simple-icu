// services/emailService.js
const nodemailer = require('nodemailer');
const { pool } = require('../config/database');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function notificarProgramacionSesion(sesion) {
    try {
        const result = await pool.query(
            `SELECT email FROM usuarios WHERE tipo_usuario = 'consejero' AND es_activo = true`
        );
        const correos = result.rows.map(r => r.email).filter(Boolean);

        if (correos.length === 0) return;

        const appUrl = process.env.APP_URL || 'http://localhost:3000';
        const fechaFormateada = new Date(sesion.fecha).toLocaleDateString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const mailOptions = {
            from: `"Ilustre Consejo Universitario - UAGRM" <${process.env.EMAIL_USER}>`,
            bcc: correos.join(','),
            subject: `Convocatoria a Sesión ${sesion.tipo} del ICU`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #003366; color: white; padding: 20px; text-align: center;">
                        <h2 style="margin: 0;">Ilustre Consejo Universitario</h2>
                        <p style="margin: 5px 0 0 0; opacity: 0.8;">Universidad Autónoma Gabriel René Moreno</p>
                    </div>
                    <div style="padding: 25px; color: #333; line-height: 1.6;">
                        <h3 style="color: #003366; border-bottom: 2px solid #cc0000; padding-bottom: 8px;">Convocatoria Oficial</h3>
                        <p>Estimado(a) Consejero(a):</p>
                        <p>Se le convoca formalmente a la <strong>Sesión ${sesion.tipo}</strong> del ICU que se llevará a cabo bajo los siguientes datos:</p>
                        <ul>
                            <li><strong>Fecha:</strong> ${fechaFormateada}</li>
                            <li><strong>Hora:</strong> ${sesion.hora}</li>
                            <li><strong>Lugar:</strong> ${sesion.lugar}</li>
                        </ul>
                        <p>Para revisar el orden del día, los reglamentos sugeridos y la documentación adjunta, acceda a la plataforma:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${appUrl}/mi_espacio" style="background-color: #003366; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Ingresar a Mi Espacio ICU</a>
                        </div>
                    </div>
                    <div style="background-color: #f8f9fa; padding: 12px; text-align: center; font-size: 0.8rem; color: #6c757d; border-top: 1px solid #eee;">
                        Mensaje automático emitido por el Sistema Documental del ICU.
                    </div>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) console.error('❌ Error enviando correo de convocatoria:', err);
            else console.log('📧 Correos de convocatoria enviados a los consejeros.');
        });
    } catch (error) {
        console.error('❌ Error al preparar notificaciones de correo:', error);
    }
}

module.exports = { notificarProgramacionSesion };