// services/pdfReportService.js
const PDFDocument = require('pdfkit');

function generarActaSesionPDF(sesion, consejeros, documentosTratados, streamSalida) {
    const doc = new PDFDocument({ margin: 40, size: 'LETTER' });
    doc.pipe(streamSalida);

    // Encabezado Institucional
    doc.fillColor('#003366')
       .fontSize(16)
       .text('UNIVERSIDAD AUTÓNOMA GABRIEL RENÉ MORENO', { align: 'center', bold: true })
       .fontSize(13)
       .text('ILUSTRE CONSEJO UNIVERSITARIO (ICU)', { align: 'center' })
       .moveDown(0.5);

    doc.strokeColor('#cc0000').lineWidth(2).moveTo(40, doc.y).lineTo(570, doc.y).stroke().moveDown(1);

    // Datos de la Sesión
    const fecha = new Date(sesion.fecha).toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    doc.fillColor('#333333').fontSize(11);
    doc.text(`ACTA DE SESIÓN ${sesion.tipo.toUpperCase()}`, { bold: true, align: 'center' });
    doc.moveDown(0.5);
    doc.text(`Fecha: ${fecha}  |  Hora: ${sesion.hora}  |  Estado: ${sesion.estado}`);
    doc.text(`Lugar: ${sesion.lugar}`);
    doc.moveDown(1);

    // Sección 1: Asistencia y Quórum
    const presentes = consejeros.filter(c => c.asistio).length;
    const total = consejeros.length;

    doc.fillColor('#003366').fontSize(12).text('1. CONTROL DE ASISTENCIA Y QUÓRUM', { underline: true });
    doc.fillColor('#333333').fontSize(10).moveDown(0.3);
    doc.text(`Quórum verificado: ${presentes} de ${total} miembros presentes.`);
    doc.moveDown(0.5);

    // Lista compacta de asistencia
    consejeros.forEach(c => {
        const estadoAsist = c.asistio ? '[PRESENTE]' : '[AUSENTE]';
        const rol = c.es_docente ? 'Docente' : 'Estudiante';
        doc.text(`• ${c.nombre} (${rol} - ${c.facultad_nombre || 'Gremio'}): ${estadoAsist}`);
    });
    doc.moveDown(1);

    // Sección 2: Tratamiento de Documentos y Resoluciones
    doc.fillColor('#003366').fontSize(12).text('2. TRATAMIENTO DE DOCUMENTOS Y RESOLUCIONES', { underline: true });
    doc.fillColor('#333333').fontSize(10).moveDown(0.5);

    if (documentosTratados.length === 0) {
        doc.text('No se trataron documentos específicos en esta sesión.');
    } else {
        documentosTratados.forEach((d, idx) => {
            doc.text(`${idx + 1}. ${d.titulo} (${d.categoria})`, { bold: true });
            doc.text(`   Resultado: ${d.estado_tratamiento}`);
            if (d.observacion) {
                doc.text(`   Observación: ${d.observacion}`);
            }
            doc.moveDown(0.4);
        });
    }
    doc.moveDown(2);

    // Sección 3: Espacio de Firmas de la Directiva
    if (doc.y > 600) doc.addPage();

    doc.fillColor('#003366').fontSize(12).text('3. CONFORMIDAD DE LA DIRECTIVA DEL ICU', { underline: true });
    doc.moveDown(3);

    const posYFirmas = doc.y;
    doc.strokeColor('#333333').lineWidth(1);

    // Línea Presidente
    doc.moveTo(60, posYFirmas).lineTo(260, posYFirmas).stroke();
    doc.fontSize(9).fillColor('#333333').text('Ing. Carlos Martínez Bonilla\nPRESIDENTE ICU', 60, posYFirmas + 5, { align: 'center', width: 200 });

    // Línea Secretario
    doc.moveTo(340, posYFirmas).lineTo(540, posYFirmas).stroke();
    doc.fontSize(9).fillColor('#333333').text('Univ. Diego Torrico\n1er. SECRETARIO ICU', 340, posYFirmas + 5, { align: 'center', width: 200 });

    doc.end();
}

module.exports = { generarActaSesionPDF };