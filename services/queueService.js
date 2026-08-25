// services/queueService.js
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const nodemailer = require('nodemailer');
require('dotenv').config();

// 1. Configurar conexión a Redis
const connection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

// 2. Crear la Cola de Notificaciones
const emailQueue = new Queue('icu-notificaciones', { connection });

// 3. Configurar el Transporter de Correos (Ajusta con tus credenciales)
const transporter = nodemailer.createTransport({
    service: 'gmail', // O el SMTP que utilice la UAGRM
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 4. Crear el Worker (Consumidor de la cola)
const emailWorker = new Worker('icu-notificaciones', async job => {
    const { to, subject, html } = job.data;
    
    try {
        console.log(`✉️ [WORKER] Procesando envío a: ${to}...`);
        await transporter.sendMail({
            from: `"Sistema ICU" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html
        });
        console.log(`✅ [WORKER] Correo enviado a: ${to}`);
    } catch (error) {
        console.error(`❌ [WORKER] Fallo al enviar a ${to}:`, error.message);
        throw error; // Lanzar error para que BullMQ gestione el reintento
    }
}, { 
    connection,
    concurrency: 5 // Control de concurrencia: procesa máximo 5 correos simultáneos para no saturar el SMTP
});

emailWorker.on('completed', job => {
    console.log(`🏁 Tarea ${job.id} completada exitosamente.`);
});

emailWorker.on('failed', (job, err) => {
    console.error(`⚠️ Tarea ${job.id} falló después de varios intentos: ${err.message}`);
});

module.exports = { emailQueue };