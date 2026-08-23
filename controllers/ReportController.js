// controllers/ReportController.js
const { query, getClient } = require('../config/database');
const { getSidebarHeader, getSidebarFooter } = require('../views/pages'); 

/**
 * Parsea un string JSON de forma segura, manejando objetos, nulos y strings inválidos.
 * @param {string|object|null} data - El dato a parsear.
 * @param {*} defaultValue - El valor a devolver si el parseo falla.
 * @returns {object|array|*} - El objeto parseado o el valor por defecto.
 */
function parseJSONSeguro(data, defaultValue = null) {
  // Si ya es un objeto (y no es nulo), lo devolvemos directamente.
  if (typeof data === 'object' && data !== null) {
    return data;
  }
  // Si no es un string o es un string vacío, devolvemos el valor por defecto.
  if (typeof data !== 'string' || data.trim() === '') {
    return defaultValue;
  }
  try {
    // Intentamos parsear el JSON.
    return JSON.parse(data);
  } catch (error) {
    // Si falla, mostramos una advertencia y devolvemos el valor por defecto.
    console.warn(`Advertencia: No se pudo parsear el JSON. Valor: "${data.substring(0, 50)}...".`);
    return defaultValue;
  }
}

class ReportController {
  
// Página principal de reportes
  static async getReportesPage(req, res) {
    try {
      const usuario = req.session.usuario;
      
      res.send(
        getSidebarHeader('Reportes y Análisis', 'reportes', usuario) + `
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                .ocr-indicator { display: inline-block; padding: 0.2rem 0.5rem; margin-left: 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: bold; }
                .ocr-applied { background: #17a2b8; color: white; }
                .ocr-native { background: #28a745; color: white; }
                .btn { padding: 0.4rem 0.8rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; font-size: 0.9rem; }
                .btn-info { background-color: #17a2b8; color: white; }
                .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
                
                .dashboard-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
                @media (min-width: 1024px) { .dashboard-grid { grid-template-columns: 350px 1fr; } }

                .welcome-card { background: linear-gradient(135deg, var(--uagrm-blue), #0056b3); color: white; border-radius: 8px; padding: 2rem; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }
                .welcome-card h1 { color: white; font-size: 1.8rem; border: none; margin-top: 0; }
                .refresh-btn { background: rgba(255, 255, 255, 0.2); color: white; border: 1px solid white; padding: 0.6rem 1.2rem; border-radius: 50px; cursor: pointer; margin-top: 1rem; font-weight: 500; transition: background-color 0.3s; }
                .refresh-btn:hover { background: rgba(255, 255, 255, 0.3); }
                
                .sidebar-column { display: flex; flex-direction: column; gap: 20px; }
                .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .stat-card { padding: 1rem; background: #f8f9fa; border-radius: 8px; text-align: center; border: 1px solid #eee; }
                .stat-title { font-size: 0.8rem; color: #6c757d; font-weight: 600; }
                .stat-number { font-size: 1.8rem; font-weight: 700; color: var(--uagrm-blue); margin: 0.25rem 0; }

                .main-content-column { display: flex; flex-direction: column; gap: 20px; }
                .chart-container { display: grid; grid-template-columns: 1fr; gap: 20px; }
                @media (min-width: 768px) { .chart-container { grid-template-columns: 1fr 1fr; } }
                .chart-wrapper { position: relative; height: 300px; }

                .loading { text-align: center; padding: 2rem; color: #666; font-style: italic; }
                .error { background-color: #f8d7da; border-left: 4px solid #dc3545; color: #721c24; padding: 1rem; border-radius: 4px; }
                .keyword-cloud { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
                .keyword-item { background-color: #e3f2fd; color: #1565c0; padding: 0.3rem 0.8rem; border-radius: 15px; font-size: 0.85rem; }

                .doc-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 0; border-bottom: 1px solid #f0f0f0; }
                .doc-item:last-child { border-bottom: none; }
                .doc-item h5 { margin: 0 0 5px 0; font-weight: 600; color: var(--text-dark); }
                
                .nlp-grid-compact { display: grid; grid-template-columns: 1fr; gap: 20px; }
                @media (min-width: 768px) { .nlp-grid-compact { grid-template-columns: 2fr 1fr; } }
                .topic-list-compact .topic-item { display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; padding: 0.5rem 1rem; border-radius: 6px; margin-bottom: 0.5rem; }
                .stat-card-compact { background: #f8f9fa; border-left: 4px solid #17a2b8; padding: 1rem; border-radius: 6px; margin-bottom: 1rem; }
                .stat-number-compact { font-size: 1.5rem; font-weight: 700; color: #333; }
                .stat-title-compact { font-size: 0.8rem; color: #6c757d; }
            </style>

            <div class="dashboard-grid">
                
                <!-- Columna Izquierda (Resumen Estadístico) -->
                <aside class="sidebar-column">
                    <div class="info-card" style="margin:0;">
                        <h3 style="margin-top:0;">📊 Estadísticas Clave</h3>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-title">Total Docs</div>
                                <div class="stat-number" id="totalDocs">-</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Este Mes</div>
                                <div class="stat-number" id="docsMes">-</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Procesados NLP</div>
                                <div class="stat-number" id="docsConNLP">-</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Procesados OCR</div>
                                <div class="stat-number" id="docsOCR">-</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Calidad OCR</div>
                                <div class="stat-number" id="calidadPromedio">-</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-title">Palabras Clave</div>
                                <div class="stat-number" id="totalKeywords">-</div>
                            </div>
                        </div>
                    </div>

                    <div class="info-card" style="margin:0;">
                        <h3 style="margin-top:0;">🔍 Calidad OCR</h3>
                        <div id="ocrQualityContent">
                            <div class="loading">Cargando...</div>
                        </div>
                    </div>
                </aside>

                <!-- Columna Derecha (Gráficos y Detalles) -->
                <div class="main-content-column">
                    <div class="welcome-card">
                        <h1>📊 Reportes y Análisis</h1>
                        <p>Visión general del procesamiento inteligente de documentos (PLN/OCR).</p>
                        <button class="refresh-btn" onclick="loadAllReports()">🔄 Actualizar Datos</button>
                    </div>

                    <div class="chart-container">
                        <div class="info-card" style="margin:0;">
                            <h3 style="margin-top:0;">🏛️ Docs por Comisión</h3>
                            <div class="chart-wrapper">
                                <canvas id="comisionesChart"></canvas>
                            </div>
                        </div>
                        <div class="info-card" style="margin:0;">
                            <h3 style="margin-top:0;">🗓️ Documentos por Mes</h3>
                            <div class="chart-wrapper">
                                <canvas id="temporalChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="info-card" style="margin:0;">
                        <h3 style="margin-top:0;">🧠 Análisis de Contenido (NLP)</h3>
                        <div id="nlpContent">
                            <div class="loading">Cargando análisis avanzado...</div>
                        </div>
                    </div>
                    
                    <div class="info-card" style="margin:0;">
                        <h3 style="margin-top:0;">📋 Últimos Documentos Procesados</h3>
                        <div id="recentDocs">
                            <div class="loading">Cargando registro...</div>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Modal PDF -->
            <div id="pdfModal" class="modal">
                <div class="modal-content-pdf">
                    <div class="modal-header">
                        <h2 id="pdfModalTitle" style="color:white; margin:0; border:none;">Previsualización</h2>
                        <span class="close-pdf-modal" onclick="closePdfModal()">&times;</span>
                    </div>
                    <iframe id="pdfViewer" class="pdf-iframe" frameborder="0"></iframe>
                </div>
            </div>

            <script>
                // ... El código interno de las gráficas (loadAllReports, displayNLPAnalysis, etc.) se mantiene EXACTAMENTE igual ...
                
                let temporalChart = null;
                let comisionesChart = null;
                let metodosChart = null;

                async function loadAllReports() {
                    await Promise.all([
                        loadResumenGeneral(), loadCalidadOCR(), loadAnalisisTemporal(), 
                        loadMetodosProcesamiento(), loadDistribucionComisiones(), 
                        loadAnalisisNLP(), loadDocumentosRecientes()
                    ]);
                }

                async function loadResumenGeneral() {
                    try {
                        const response = await fetch('/api/reportes/resumen');
                        const data = await response.json();
                        if (response.ok) {
                            document.getElementById('totalDocs').textContent = data.total_documentos || '0';
                            document.getElementById('docsMes').textContent = data.documentos_mes || '0';
                            document.getElementById('docsOCR').textContent = data.docs_con_ocr || '0';
                            document.getElementById('totalKeywords').textContent = data.total_keywords || '0';
                            document.getElementById('docsConNLP').textContent = data.docs_con_nlp || '0';
                            document.getElementById('calidadPromedio').textContent = (data.calidad_ocr_promedio || 0).toFixed(1);
                        }
                    } catch (error) { console.error(error); }
                }

                async function loadCalidadOCR() {
                    try {
                        const response = await fetch('/api/reportes/calidad-ocr');
                        const data = await response.json();
                        if (response.ok) displayOCRQuality(data);
                    } catch (error) { console.error(error); }
                }

                async function loadMetodosProcesamiento() {
                    try {
                        const response = await fetch('/api/reportes/metodos-procesamiento');
                        const data = await response.json();
                        if (response.ok && data.length > 0) createMetodosChart(data);
                    } catch (error) { console.error(error); }
                }

                async function loadAnalisisTemporal() {
                    try {
                        const response = await fetch('/api/reportes/temporal');
                        const data = await response.json();
                        if (response.ok && data.length > 0) createTemporalChart(data);
                    } catch (error) { console.error(error); }
                }

                async function loadDistribucionComisiones() {
                    try {
                        const response = await fetch('/api/reportes/comisiones');
                        const data = await response.json();
                        if (response.ok && data.length > 0) createComisionesChart(data);
                    } catch (error) { console.error(error); }
                }

                async function loadAnalisisNLP() {
                    try {
                        const response = await fetch('/api/reportes/nlp');
                        const data = await response.json();
                        if (response.ok) displayNLPAnalysis(data);
                    } catch (error) { console.error(error); }
                }

                async function loadDocumentosRecientes() {
                    try {
                        const response = await fetch('/api/reportes/recientes');
                        const data = await response.json();
                        if (response.ok) displayRecentDocuments(data);
                    } catch (error) { console.error(error); }
                }

                function displayOCRQuality(data) {
                    let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
                    if (data.distribucion_calidad) {
                        const dist = data.distribucion_calidad;
                        html += \`
                            <div style="display:flex; justify-content:space-between; padding:8px; background:#f8f9fa; border-radius:4px;"><span>Excelente</span> <strong>\${dist.excelente || 0}</strong></div>
                            <div style="display:flex; justify-content:space-between; padding:8px; background:#f8f9fa; border-radius:4px;"><span>Buena</span> <strong>\${dist.buena || 0}</strong></div>
                            <div style="display:flex; justify-content:space-between; padding:8px; background:#f8f9fa; border-radius:4px;"><span>Regular</span> <strong>\${dist.regular || 0}</strong></div>
                            <div style="display:flex; justify-content:space-between; padding:8px; background:#f8f9fa; border-radius:4px;"><span>Deficiente</span> <strong>\${dist.deficiente || 0}</strong></div>
                        \`;
                    }
                    html += '</div>';
                    document.getElementById('ocrQualityContent').innerHTML = html;
                }

                function createMetodosChart(data) { /* Similar implementacion chartjs */ }

                function createTemporalChart(data) {
                    const ctx = document.getElementById('temporalChart').getContext('2d');
                    if (temporalChart) temporalChart.destroy();
                    temporalChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: data.map(d => d.mes),
                            datasets: [{ label: 'Total Documentos', data: data.map(d => parseInt(d.cantidad)), borderColor: '#003366', tension: 0.4, fill: false }]
                        },
                        options: { responsive: true, maintainAspectRatio: false }
                    });
                }

                function createComisionesChart(data) {
                    const ctx = document.getElementById('comisionesChart').getContext('2d');
                    if (comisionesChart) comisionesChart.destroy();
                    comisionesChart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: data.map(d => d.nombre || 'Sin asignar'),
                            datasets: [{ data: data.map(d => parseInt(d.cantidad)), backgroundColor: ['#003366', '#cc0000', '#17a2b8', '#ffc107', '#28a745'] }]
                        },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
                    });
                }

                function displayNLPAnalysis(data) {
                    let html = '<div class="nlp-grid-compact"><div>';
                    if (data.palabras_frecuentes && data.palabras_frecuentes.length > 0) {
                        html += \`<h4>🏷️ Palabras Clave Frecuentes</h4><div class="keyword-cloud">\${data.palabras_frecuentes.slice(0, 10).map(k => \`<span class="keyword-item">\${k.palabra} (\${k.frecuencia})</span>\`).join('')}</div>\`;
                    }
                    if (data.temas_populares && data.temas_populares.length > 0) {
                        html += \`<h4 style="margin-top:20px;">📊 Temas Populares</h4><div class="topic-list-compact">\${data.temas_populares.slice(0, 5).map(t => \`<div class="topic-item"><strong>\${t.tema}</strong><span>(\${t.frecuencia} docs)</span></div>\`).join('')}</div>\`;
                    }
                    html += '</div><div>';
                    if (data.complejidad_promedio) {
                        html += \`<h4>📈 Complejidad Promedio</h4><div class="stat-card-compact"><div class="stat-number-compact">\${data.complejidad_promedio.toFixed(2)} / 10</div><div class="stat-title-compact">Score</div></div>\`;
                    }
                    html += '</div></div>';
                    document.getElementById('nlpContent').innerHTML = html;
                }

                function displayRecentDocuments(data) {
                    if (!data || data.length === 0) { document.getElementById('recentDocs').innerHTML = '<p>No hay documentos recientes.</p>'; return; }
                    const html = data.map(doc => {
                        const cleanTitle = doc.titulo.replace(/\\sOCR$/i, '').trim();
                        return \`
                            <div class="doc-item">
                                <div>
                                    <h5>\${cleanTitle}</h5>
                                    <p style="color:#6c757d; font-size:0.85rem;">\${doc.remitente || 'N/A'} | \${new Date(doc.created_at).toLocaleDateString()} | \${doc.nombre_comision || 'General'}</p>
                                </div>
                                <button class="cta-button secondary" style="padding:4px 8px; font-size:0.85rem;" onclick="viewPdf('\${doc.id}', '\${cleanTitle}')">Ver PDF</button>
                            </div>
                        \`;
                    }).join('');
                    document.getElementById('recentDocs').innerHTML = html;
                }

                function viewPdf(documentId, documentTitle) {
                    document.getElementById('pdfModalTitle').textContent = documentTitle;
                    document.getElementById('pdfViewer').src = \`/api/documentos/\${documentId}/preview\`;
                    document.getElementById('pdfModal').style.display = 'block';
                }
                function closePdfModal() {
                    document.getElementById('pdfModal').style.display = 'none';
                    document.getElementById('pdfViewer').src = '';
                }

                document.addEventListener('DOMContentLoaded', loadAllReports);
            </script>
        ` + getSidebarFooter()
      );
    } catch (error) {
      console.error('Error generando página de reportes:', error);
      res.status(500).send('Error interno del servidor');
    }
  }

  //MOSTRAR HISTORIAL DE SESIONES EN EL DASHBOARD
  static async getHistorialSesiones(req, res) {
    try {
        const result = await query(`
            SELECT 
                s.id, s.tipo, s.fecha, s.hora,
                (SELECT json_agg(json_build_object('id', d.id, 'titulo', d.titulo))
                 FROM documentos d
                 JOIN sesion_documentos sd ON d.id = sd.documento_id
                 WHERE sd.sesion_id = s.id AND d.categoria = 'Resolucion') as resoluciones
            FROM sesiones s
            WHERE s.fecha <= CURRENT_DATE
            ORDER BY s.fecha DESC, s.hora DESC
            LIMIT 5
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error obteniendo historial de sesiones:', error);
        res.status(500).json({ error: 'Error interno' });
    }
  }

  static async getCorrespondencia(req, res) { // Mantenemos req, res por si se usa como API
    try {
        const result = await query(`
            SELECT id, fecha, temas 
            FROM sesiones 
            WHERE temas IS NOT NULL AND temas != ''
            ORDER BY fecha DESC
        `);
        
        const correspondencia = [];
        result.rows.forEach(sesion => {
            const temasArray = (sesion.temas || '').split('|'); // Manejo seguro por si es null
            temasArray.forEach(tema => {
                if (tema.trim()) {
                    correspondencia.push({
                        sesion_id: sesion.id,
                        fecha_sesion: sesion.fecha,
                        descripcion_tema: tema.trim()
                    });
                }
            });
        });
        
        // Si 'res' existe, es una llamada API, enviamos JSON
        if (res) {
            return res.json(correspondencia);
        }
        // Si no, es una llamada interna, devolvemos los datos
        return correspondencia; 

    } catch (error) {
        console.error('Error obteniendo correspondencia:', error);
        if (res) {
            return res.status(500).json({ error: 'Error interno' });
        }
        throw error; // Propagar el error si es una llamada interna
    }
}
  // Obtener resumen general (actualizado con OCR)
  static async getResumenGeneral(req, res) {
    try {
      console.log('📊 Obteniendo resumen general...');
      
      // Total de documentos
      const totalResult = await query('SELECT COUNT(*) as total FROM documentos');
      const total_documentos = parseInt(totalResult.rows[0].total);

      // Documentos este mes
      const mesResult = await query(`
        SELECT COUNT(*) as total 
        FROM documentos 
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
      `);
      const documentos_mes = parseInt(mesResult.rows[0].total);

      // Documentos con análisis NLP
      const nlpResult = await query(`
          SELECT COUNT(*) as total 
          FROM documentos 
          WHERE palabras_clave IS NOT NULL AND json_array_length(palabras_clave::json) > 0
        `);
      const docs_con_nlp = parseInt(nlpResult.rows[0].total);

      // Documentos procesados con OCR
      const ocrResult = await query(`
          SELECT COUNT(*) as total 
          FROM documentos 
          WHERE metadatos_procesamiento IS NOT NULL 
          AND metadatos_procesamiento->>'ocr_aplicado' = 'true'
          AND (metadatos_procesamiento->>'caracteres_extraidos')::int > 0
        `);
      const docs_con_ocr = parseInt(ocrResult.rows[0].total);

      // Calidad promedio de OCR
      const calidadResult = await query(`
        SELECT AVG(
          CASE 
            WHEN metadatos_procesamiento IS NOT NULL 
            AND metadatos_procesamiento::json->>'ocr_aplicado' = 'true'
            AND analisis_nlp IS NOT NULL 
            AND analisis_nlp::json->'calidad_texto'->>'score' IS NOT NULL
            THEN (analisis_nlp::json->'calidad_texto'->>'score')::float
            ELSE NULL
          END
        ) as calidad_promedio
        FROM documentos
      `);
      const calidad_ocr_promedio = parseFloat(calidadResult.rows[0].calidad_promedio) || 0;

      // Contar palabras clave únicas
      const keywordsResult = await query(`
        SELECT palabras_clave 
        FROM documentos 
        WHERE palabras_clave IS NOT NULL
      `);
      
      let total_keywords = 0;
      const uniqueKeywords = new Set();
      
     keywordsResult.rows.forEach(row => {
      try {
    // 1. Verificar que el dato existe y es un string no vacío
      if (row.palabras_clave && typeof row.palabras_clave === 'string') {
      const keywords = parseJSONSeguro(row.palabras_clave, []);
      if (Array.isArray(keywords)) {
        keywords.forEach(k => uniqueKeywords.add(k));
          }
        }
      } catch (e) {
        console.warn(`Error parsing keywords para el documento (valor: "${row.palabras_clave}"):`, e);
      }
});
      total_keywords = uniqueKeywords.size;

      const resumen = {
        total_documentos,
        documentos_mes,
        docs_con_nlp,
        docs_con_ocr,
        total_keywords,
        calidad_ocr_promedio: Math.round(calidad_ocr_promedio * 10) / 10
      };

      console.log('📊 Resumen generado:', resumen);
      res.json(resumen);

    } catch (error) {
      console.error('Error obteniendo resumen general:', error);
      res.status(500).json({ 
        error: 'Error obteniendo resumen general',
        details: error.message 
      });
    }
  }

  static async getMetodosProcesamiento(req, res) {
        try {
            const result = await query(`
                SELECT 
                    metadatos_procesamiento->>'metodo_extraccion' as metodo, 
                    COUNT(*) as cantidad 
                FROM documentos 
                WHERE metadatos_procesamiento->>'metodo_extraccion' IS NOT NULL
                GROUP BY metodo
            `);
            res.json(result.rows);
        } catch (error) {
            console.error('Error obteniendo métodos de procesamiento:', error);
            res.status(500).json({ error: 'Error obteniendo métodos de procesamiento' });
        }
    }


  // Obtener análisis de calidad OCR
  static async getCalidadOCR(req, res) {
    try {
      console.log('🔍 Analizando calidad OCR...');
      
      // Obtener documentos con metadatos de procesamiento
      const result = await query(`
        SELECT 
          metadatos_procesamiento,
          analisis_nlp
        FROM documentos 
        WHERE metadatos_procesamiento IS NOT NULL
      `);

      let distribucionCalidad = {
        excelente: 0,  // > 0.8
        buena: 0,      // 0.6 - 0.8
        regular: 0,    // 0.4 - 0.6
        deficiente: 0  // < 0.4
      };

      let estadisticas = {
        tiempo_promedio_ms: 0,
        total_paginas: 0,
        documentos_analizados: 0
      };

      let tiempoTotal = 0;
      let documentosConTiempo = 0;

      result.rows.forEach(row => {
        try {

          const metadatos = parseJSONSeguro(row.metadatos_procesamiento, {});
          const analisis = parseJSONSeguro(row.analisis_nlp, null);
          
          // Analizar calidad si hay datos disponibles
          if (analisis && analisis.calidad_texto && analisis.calidad_texto.score !== undefined) {
            const calidad = parseFloat(analisis.calidad_texto.score);
            
            if (calidad > 0.8) distribucionCalidad.excelente++;
            else if (calidad > 0.6) distribucionCalidad.buena++;
            else if (calidad > 0.4) distribucionCalidad.regular++;
            else distribucionCalidad.deficiente++;
          }
          
          // Estadísticas de tiempo y páginas
          if (metadatos.tiempo_procesamiento) {
            tiempoTotal += metadatos.tiempo_procesamiento;
            documentosConTiempo++;
          }
          
          if (metadatos.paginas_procesadas) {
            estadisticas.total_paginas += metadatos.paginas_procesadas;
          }
          
          estadisticas.documentos_analizados++;
          
        } catch (error) {
          console.warn('Error procesando metadatos:', error);
        }
      });

      if (documentosConTiempo > 0) {
        estadisticas.tiempo_promedio_ms = Math.round(tiempoTotal / documentosConTiempo);
      }

      const analisisCalidad = {
        distribucion_calidad: distribucionCalidad,
        estadisticas: estadisticas
      };

      console.log('🔍 Análisis de calidad OCR completado:', analisisCalidad);
      res.json(analisisCalidad);

    } catch (error) {
      console.error('Error analizando calidad OCR:', error);
      res.status(500).json({ 
        error: 'Error analizando calidad OCR',
        details: error.message 
      });
    }
  }

  // Obtener análisis temporal (actualizado para incluir OCR)
  static async getAnalisisTemporal(req, res) {
    try {
      console.log('📈 Obteniendo análisis temporal...');
      
      const result = await query(`
        SELECT 
          TO_CHAR(created_at, 'YYYY-MM') as mes,
          COUNT(*) as cantidad,
          COUNT(CASE WHEN metadatos_procesamiento::text LIKE '%"ocr_aplicado":true%' THEN 1 END) as con_ocr
        FROM documentos
        WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM')
        ORDER BY mes ASC
      `);

      console.log('📈 Datos temporales:', result.rows);
      res.json(result.rows);

    } catch (error) {
      console.error('Error obteniendo análisis temporal:', error);
      res.status(500).json({ 
        error: 'Error obteniendo análisis temporal',
        details: error.message 
      });
    }
  }

  // Obtener distribución por comisiones
  static async getDistribucionComisiones(req, res) {
    try {
      console.log('🏛️ Obteniendo distribución por comisiones...');
      
      const result = await query(`
        SELECT 
          COALESCE(c.nombre, 'Sin asignar') as nombre,
          COUNT(d.id) as cantidad
        FROM documentos d
        LEFT JOIN comisiones c ON d.comision_id = c.id
        GROUP BY c.nombre
        ORDER BY cantidad DESC
      `);

      console.log('🏛️ Distribución comisiones:', result.rows);
      res.json(result.rows);

    } catch (error) {
      console.error('Error obteniendo distribución comisiones:', error);
      res.status(500).json({ 
        error: 'Error obteniendo distribución comisiones',
        details: error.message 
      });
    }
  }

  // Obtener análisis NLP detallado (actualizado con información OCR)
  static async getAnalisisNLP(req, res) {
    try {
      console.log('🧠 Obteniendo análisis NLP...');
      
      // Obtener documentos con análisis NLP
      const documentosResult = await query(`
        SELECT palabras_clave, analisis_nlp, metadatos_procesamiento
        FROM documentos 
        WHERE palabras_clave IS NOT NULL 
        AND analisis_nlp IS NOT NULL
      `);

      console.log(`🧠 Documentos con NLP encontrados: ${documentosResult.rows.length}`);

      if (documentosResult.rows.length === 0) {
        return res.json({
          palabras_frecuentes: [],
          temas_populares: [],
          analisis_sentimientos: { positivos: 0, neutrales: 0, negativos: 0 },
          complejidad_promedio: 0,
          estadisticas_ocr: { documentos_ocr: 0, calidad_promedio: 0, paginas_totales: 0 }
        });
      }

      // Análisis de palabras clave
      const keywordFreq = {};
      const temaFreq = {};
      let sentimientos = { positivos: 0, neutrales: 0, negativos: 0 };
      let totalComplejidad = 0;
      let validComplexity = 0;

      // Estadísticas OCR
      let estadisticasOCR = {
        documentos_ocr: 0,
        calidad_total: 0,
        documentos_con_calidad: 0,
        paginas_totales: 0
      };

      documentosResult.rows.forEach(row => {
        try {
          // Procesar palabras clave
          const keywords = parseJSONSeguro(row.palabras_clave, []);
          if (Array.isArray(keywords)) {
            keywords.forEach(keyword => {
              keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
            });
          }

          // Procesar análisis NLP
          const analisis = parseJSONSeguro(row.analisis_nlp, {});
          
          // Análisis de sentimientos
          if (analisis.sentiment !== undefined) {
            const sentiment = parseFloat(analisis.sentiment);
            if (sentiment > 0.1) sentimientos.positivos++;
            else if (sentiment < -0.1) sentimientos.negativos++;
            else sentimientos.neutrales++;
          }

          // Complejidad
          if (analisis.complejidad && analisis.complejidad.score !== undefined) {
            totalComplejidad += parseFloat(analisis.complejidad.score);
            validComplexity++;
          }

          // Temas detectados
          if (analisis.temas_detectados && Array.isArray(analisis.temas_detectados)) {
            analisis.temas_detectados.forEach(tema => {
              const temaKey = tema.tema || 'otros';
              temaFreq[temaKey] = (temaFreq[temaKey] || 0) + 1;
            });
          }

          // Estadísticas OCR
          if (row.metadatos_procesamiento) {
            const metadatos = parseJSONSeguro(row.metadatos_procesamiento, {});
            if (metadatos.ocr_aplicado) {
              estadisticasOCR.documentos_ocr++;
              
              if (metadatos.paginas_procesadas) {
                estadisticasOCR.paginas_totales += metadatos.paginas_procesadas;
              }
            }
            
            // Calidad del texto
            if (analisis.calidad_texto && analisis.calidad_texto.score !== undefined) {
              estadisticasOCR.calidad_total += parseFloat(analisis.calidad_texto.score);
              estadisticasOCR.documentos_con_calidad++;
            }
          }

        } catch (error) {
          console.warn('Error procesando documento NLP:', error);
        }
      });

      // Preparar palabras más frecuentes (top 15)
      const palabras_frecuentes = Object.entries(keywordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15)
        .map(([palabra, frecuencia]) => ({ palabra, frecuencia }));

      // Preparar temas más populares
      const temas_populares = Object.entries(temaFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([tema, frecuencia]) => ({ tema, frecuencia }));

      // Complejidad promedio
      const complejidad_promedio = validComplexity > 0 ? totalComplejidad / validComplexity : 0;

      // Estadísticas finales de OCR
      const estadisticasOCRFinal = {
        documentos_ocr: estadisticasOCR.documentos_ocr,
        calidad_promedio: estadisticasOCR.documentos_con_calidad > 0 
          ? Math.round((estadisticasOCR.calidad_total / estadisticasOCR.documentos_con_calidad) * 100) 
          : 0,
        paginas_totales: estadisticasOCR.paginas_totales
      };

      const analisisCompleto = {
        palabras_frecuentes,
        temas_populares,
        analisis_sentimientos: sentimientos,
        complejidad_promedio: Math.round(complejidad_promedio * 100) / 100,
        estadisticas_ocr: estadisticasOCRFinal
      };

      console.log('🧠 Análisis NLP generado:', {
        palabras_count: palabras_frecuentes.length,
        temas_count: temas_populares.length,
        sentimientos,
        complejidad_promedio: analisisCompleto.complejidad_promedio,
        ocr_stats: estadisticasOCRFinal
      });

      res.json(analisisCompleto);

    } catch (error) {
      console.error('Error obteniendo análisis NLP:', error);
      res.status(500).json({ 
        error: 'Error obteniendo análisis NLP',
        details: error.message 
      });
    }
  }

  // Obtener documentos recientes (actualizado con información OCR)
  static async getDocumentosRecientes(req, res) {
    try {
      console.log('📋 Obteniendo documentos recientes...');
      
      const result = await query(`
        SELECT 
          d.id,
          d.titulo,
          d.remitente,
          d.created_at,
          d.palabras_clave,
          d.analisis_nlp,
          d.metadatos_procesamiento,
          c.nombre as nombre_comision
        FROM documentos d
        LEFT JOIN comisiones c ON d.comision_id = c.id
        ORDER BY d.created_at DESC
        LIMIT 10
      `);

      // Procesar datos para incluir información de NLP y OCR
      const documentosConInfo = result.rows.map(doc => {
        let sentiment = 0;
        let palabras_preview = 'Sin procesar';

        try {
          // Extraer palabras clave para preview
          if (doc.palabras_clave) {
            const keywords = parseJSONSeguro(doc.palabras_clave, []);
            if (Array.isArray(keywords) && keywords.length > 0) {
              palabras_preview = keywords.slice(0, 3).join(', ');
              if (keywords.length > 3) palabras_preview += '...';
            }
          }

          // Extraer sentiment
          if (doc.analisis_nlp) {
            const analisis = parseJSONSeguro(doc.analisis_nlp, {});
            sentiment = analisis.sentiment || 0;
          }
        } catch (error) {
          console.warn('Error procesando datos para documento:', doc.id, error);
        }

        return {
          ...doc,
          sentiment,
          palabras_preview
        };
      });

      console.log(`📋 Documentos recientes procesados: ${documentosConInfo.length}`);
      res.json(documentosConInfo);

    } catch (error) {
      console.error('Error obteniendo documentos recientes:', error);
      res.status(500).json({ 
        error: 'Error obteniendo documentos recientes',
        details: error.message 
      });
    }
  }

  // Obtener reporte detallado de documentos (actualizado con OCR)
  static async getDocumentosReport(req, res) {
    try {
      console.log('📄 Obteniendo reporte detallado de documentos...');
      
      const result = await query(`
        SELECT 
          d.id,
          d.titulo,
          d.remitente,
          d.fecha_ingreso,
          d.created_at,
          d.palabras_clave,
          d.analisis_nlp,
          d.recomendaciones,
          d.metadatos_procesamiento,
          c.nombre as nombre_comision,
          u.nombre as nombre_usuario
        FROM documentos d
        LEFT JOIN comisiones c ON d.comision_id = c.id
        LEFT JOIN usuarios u ON d.usuario_creador_id = u.id
        ORDER BY d.created_at DESC
      `);

      // Procesar documentos con análisis completo
      const documentosCompletos = result.rows.map(doc => {
        let analisisCompleto = {
          palabras_clave: [],
          sentiment: 0,
          complejidad: { score: 0 },
          temas_detectados: [],
          longitud_palabras: 0,
          recomendaciones: [],
          procesamiento: {
            metodo: 'sin_procesar',
            ocr_aplicado: false,
            calidad_texto: null,
            tiempo_procesamiento: null
          }
        };

        try {
          // Procesar palabras clave
          if (doc.palabras_clave) {
            analisisCompleto.palabras_clave = JSON.parse(doc.palabras_clave);
          }

          // Procesar análisis NLP
          if (doc.analisis_nlp) {
            const nlp = JSON.parse(doc.analisis_nlp);
            analisisCompleto = { ...analisisCompleto, ...nlp };
          }

          // Procesar recomendaciones
          if (doc.recomendaciones) {
            analisisCompleto.recomendaciones = JSON.parse(doc.recomendaciones);
          }

          // Procesar metadatos de procesamiento
          if (doc.metadatos_procesamiento) {
            const metadatos = JSON.parse(doc.metadatos_procesamiento);
            analisisCompleto.procesamiento = {
              metodo: metadatos.metodo_extraccion || 'desconocido',
              ocr_aplicado: metadatos.ocr_aplicado || false,
              calidad_texto: analisisCompleto.calidad_texto || null,
              tiempo_procesamiento: metadatos.tiempo_procesamiento || null,
              paginas_procesadas: metadatos.paginas_procesadas || 0
            };
          }
        } catch (error) {
          console.warn('Error procesando análisis completo para documento:', doc.id, error);
        }

        return {
          id: doc.id,
          titulo: doc.titulo,
          remitente: doc.remitente,
          fecha_ingreso: doc.fecha_ingreso,
          created_at: doc.created_at,
          nombre_comision: doc.nombre_comision,
          nombre_usuario: doc.nombre_usuario,
          analisis: analisisCompleto
        };
      });

      console.log(`📄 Reporte completo generado: ${documentosCompletos.length} documentos`);
      res.json(documentosCompletos);

    } catch (error) {
      console.error('Error obteniendo reporte de documentos:', error);
      res.status(500).json({ 
        error: 'Error obteniendo reporte de documentos',
        details: error.message 
      });
    }
  }

  // Obtener palabras clave más frecuentes (sin cambios significativos)
  static async getPalabrasClave(req, res) {
    try {
      console.log('🏷️ Obteniendo análisis de palabras clave...');
      
      const result = await query(`
        SELECT palabras_clave 
        FROM documentos 
        WHERE palabras_clave IS NOT NULL
      `);

      const keywordStats = {};
      let totalDocuments = 0;

      result.rows.forEach(row => {
        try {
          const keywords = JSON.parse(row.palabras_clave);
          if (Array.isArray(keywords)) {
            totalDocuments++;
            keywords.forEach(keyword => {
              if (!keywordStats[keyword]) {
                keywordStats[keyword] = {
                  palabra: keyword,
                  frecuencia: 0,
                  documentos: new Set()
                };
              }
              keywordStats[keyword].frecuencia++;
              keywordStats[keyword].documentos.add(totalDocuments);
            });
          }
        } catch (error) {
          console.warn('Error procesando palabras clave:', error);
        }
      });

      // Convertir a array y calcular estadísticas adicionales
      const palabrasClaveArray = Object.values(keywordStats).map(stat => ({
        palabra: stat.palabra,
        frecuencia: stat.frecuencia,
        documentos_count: stat.documentos.size,
        porcentaje: totalDocuments > 0 ? Math.round((stat.documentos.size / totalDocuments) * 100) : 0
      }));

      // Ordenar por frecuencia
      palabrasClaveArray.sort((a, b) => b.frecuencia - a.frecuencia);

      console.log(`🏷️ Análisis completado: ${palabrasClaveArray.length} palabras únicas`);
      res.json({
        palabras_clave: palabrasClaveArray.slice(0, 50), // Top 50
        total_documentos: totalDocuments,
        total_palabras_unicas: palabrasClaveArray.length
      });

    } catch (error) {
      console.error('Error obteniendo palabras clave:', error);
      res.status(500).json({ 
        error: 'Error obteniendo palabras clave',
        details: error.message 
      });
    }
  }
}

module.exports = ReportController;