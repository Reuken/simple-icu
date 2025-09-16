// controllers/ReportController.js
const { query, getClient } = require('../config/database');

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
      
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reportes y Análisis - ICU</title>
            <link rel="stylesheet" href="/estilos.css">
            <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
            <style>
                .reports-container {
                    max-width: 1400px;
                    margin: 2rem auto;
                    padding: 0 1rem;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 1rem;
                    margin-bottom: 2rem;
                }
                .stat-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    text-align: center;
                }
                .stat-number {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #007BFF;
                    margin: 0.5rem 0;
                }
                .ocr-stats {
                    background: linear-gradient(135deg, #e8f4fd, #d1ecf1);
                    border-left: 4px solid #17a2b8;
                }
                .chart-container {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .chart-wrapper {
                    position: relative;
                    height: 400px;
                    margin: 1rem 0;
                }
                .nlp-analysis {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .keyword-cloud {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin: 1rem 0;
                }
                .keyword-item {
                    padding: 0.5rem 1rem;
                    background: linear-gradient(45deg, #007BFF, #0056b3);
                    color: white;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    font-weight: 500;
                }
                .topic-analysis {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                    margin: 1rem 0;
                }
                .topic-card {
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 4px solid #28a745;
                }
                .recent-docs {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .doc-item {
                    padding: 1rem;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .doc-item:last-child {
                    border-bottom: none;
                }
                .sentiment-indicator {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                }
                .sentiment-positive { background-color: #28a745; }
                .sentiment-neutral { background-color: #ffc107; }
                .sentiment-negative { background-color: #dc3545; }
                .ocr-indicator {
                    display: inline-block;
                    padding: 0.2rem 0.5rem;
                    margin-left: 0.5rem;
                    border-radius: 12px;
                    font-size: 0.7rem;
                    font-weight: bold;
                }
                .ocr-applied { background: #17a2b8; color: white; }
                .ocr-native { background: #28a745; color: white; }
                .loading {
                    text-align: center;
                    padding: 2rem;
                    font-size: 1.2rem;
                    color: #666;
                }
                .error {
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                    padding: 1rem;
                    border-radius: 4px;
                    margin: 1rem 0;
                }
                .refresh-btn {
                    background: #007BFF;
                    color: white;
                    border: none;
                    padding: 0.5rem 1rem;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-bottom: 1rem;
                }
                .refresh-btn:hover {
                    background: #0056b3;
                }
                .btn {
                    padding: 0.4rem 0.8rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    font-size: 0.9rem;
                }
                .btn-info {
                    background-color: #17a2b8;
                    color: white;
                }
                .btn-sm {
                    padding: 0.25rem 0.5rem;
                    font-size: 0.8rem;
                }
                .ocr-quality {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .quality-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin: 1rem 0;
                }
                .quality-item {
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 6px;
                    text-align: center;
                }
                .quality-score {
                    font-size: 1.8rem;
                    font-weight: bold;
                    margin: 0.5rem 0;
                }
                .quality-excellent { color: #28a745; }
                .quality-good { color: #007BFF; }
                .quality-fair { color: #ffc107; }
                .quality-poor { color: #dc3545; }
            </style>
        </head>
        <body>
            <nav>
                <a href="/dashboard" class="logo">ICU Dashboard</a>
                <div class="nav-links">
                    <a href="/dashboard">Dashboard</a>
                    <a href="/documentos">📄 Documentos</a>
                    <a href="/reportes" class="active">📊 Reportes</a>
                    <span class="user-info-nav">👤 ${usuario.nombre}</span>
                    <a href="/logout" class="logout-btn">Cerrar Sesión</a>
                </div>
            </nav>

            <div class="reports-container">
                <div class="welcome-card">
                    <h1>📊 Reportes y Análisis NLP + OCR</h1>
                    <p>Análisis inteligente de documentos con procesamiento OCR avanzado</p>
                    <button class="refresh-btn" onclick="loadAllReports()">🔄 Actualizar Reportes</button>
                </div>

                <!-- Estadísticas Generales -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-title">📄 Total Documentos</div>
                        <div class="stat-number" id="totalDocs">-</div>
                        <div class="stat-subtitle">En el sistema</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">📈 Este Mes</div>
                        <div class="stat-number" id="docsMes">-</div>
                        <div class="stat-subtitle">Nuevos documentos</div>
                    </div>
                    <div class="stat-card ocr-stats">
                        <div class="stat-title">🔍 Procesados OCR</div>
                        <div class="stat-number" id="docsOCR">-</div>
                        <div class="stat-subtitle">Con análisis OCR</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">🏷️ Palabras Clave</div>
                        <div class="stat-number" id="totalKeywords">-</div>
                        <div class="stat-subtitle">Identificadas</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-title">🎯 Procesados NLP</div>
                        <div class="stat-number" id="docsConNLP">-</div>
                        <div class="stat-subtitle">Con análisis completo</div>
                    </div>
                    <div class="stat-card ocr-stats">
                        <div class="stat-title">📊 Calidad OCR</div>
                        <div class="stat-number" id="calidadPromedio">-</div>
                        <div class="stat-subtitle">Score promedio</div>
                    </div>
                </div>

                <!-- Análisis de Calidad OCR -->
                <div class="ocr-quality">
                    <h3>🔍 Análisis de Calidad de Procesamiento OCR</h3>
                    <div id="ocrQualityContent">
                        <div class="loading">Analizando calidad OCR...</div>
                    </div>
                </div>

                <!-- Análisis Temporal -->
                <div class="chart-container">
                    <h3>📈 Análisis Temporal de Documentos</h3>
                    <div class="chart-wrapper">
                        <canvas id="temporalChart"></canvas>
                    </div>
                </div>
                
                <!-- Distribución por Comisiones -->
                <div class="chart-container">
                    <h3>🏛️ Distribución por Comisiones</h3>
                    <div class="chart-wrapper">
                        <canvas id="comisionesChart"></canvas>
                    </div>
                </div>

                <!-- Análisis NLP -->
                <div class="nlp-analysis">
                    <h3>🧠 Análisis de Procesamiento de Lenguaje Natural</h3>
                    
                    <div id="nlpContent">
                        <div class="loading">Cargando análisis NLP...</div>
                    </div>
                </div>

                <!-- Documentos Recientes -->
                <div class="recent-docs">
                    <h3>📋 Documentos Recientes con Análisis</h3>
                    <div id="recentDocs">
                        <div class="loading">Cargando documentos recientes...</div>
                    </div>
                </div>
            </div>

            <script>
                let temporalChart = null;
                let comisionesChart = null;
                let metodosChart = null;

                // Cargar todos los reportes
                async function loadAllReports() {
                    console.log('🔄 Cargando todos los reportes...');
                    
                    // Ejecutar todas las cargas en paralelo
                    await Promise.all([
                        loadResumenGeneral(),
                        loadCalidadOCR(),
                        loadAnalisisTemporal(),
                        loadMetodosProcesamiento(),
                        loadDistribucionComisiones(),
                        loadAnalisisNLP(),
                        loadDocumentosRecientes()
                    ]);
                    
                    console.log('✅ Todos los reportes cargados');
                }

                // Cargar resumen general
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
                        } else {
                            console.error('Error en resumen:', data.error);
                        }
                    } catch (error) {
                        console.error('Error cargando resumen:', error);
                    }
                }

                // Cargar análisis de calidad OCR
                async function loadCalidadOCR() {
                    try {
                        const response = await fetch('/api/reportes/calidad-ocr');
                        const data = await response.json();
                        
                        if (response.ok) {
                            displayOCRQuality(data);
                        } else {
                            document.getElementById('ocrQualityContent').innerHTML = 
                                '<div class="error">Error cargando análisis de calidad OCR</div>';
                        }
                    } catch (error) {
                        console.error('Error cargando calidad OCR:', error);
                        document.getElementById('ocrQualityContent').innerHTML = 
                            '<div class="error">Error de conexión</div>';
                    }
                }

                // Cargar métodos de procesamiento
                async function loadMetodosProcesamiento() {
                    try {
                        const response = await fetch('/api/reportes/metodos-procesamiento');
                        const data = await response.json();
                        
                        if (response.ok && data.length > 0) {
                            createMetodosChart(data);
                        } else {
                            console.warn('No hay datos de métodos de procesamiento');
                        }
                    } catch (error) {
                        console.error('Error cargando métodos:', error);
                    }
                }

                // Cargar análisis temporal
                async function loadAnalisisTemporal() {
                    try {
                        const response = await fetch('/api/reportes/temporal');
                        const data = await response.json();
                        
                        if (response.ok && data.length > 0) {
                            createTemporalChart(data);
                        } else {
                            console.warn('No hay datos temporales disponibles');
                        }
                    } catch (error) {
                        console.error('Error cargando análisis temporal:', error);
                    }
                }

                // Cargar distribución por comisiones
                async function loadDistribucionComisiones() {
                    try {
                        const response = await fetch('/api/reportes/comisiones');
                        const data = await response.json();
                        
                        if (response.ok && data.length > 0) {
                            createComisionesChart(data);
                        } else {
                            console.warn('No hay datos de comisiones disponibles');
                        }
                    } catch (error) {
                        console.error('Error cargando distribución comisiones:', error);
                    }
                }

                // Cargar análisis NLP
                async function loadAnalisisNLP() {
                    try {
                        const response = await fetch('/api/reportes/nlp');
                        const data = await response.json();
                        
                        if (response.ok) {
                            displayNLPAnalysis(data);
                        } else {
                            document.getElementById('nlpContent').innerHTML = 
                                '<div class="error">Error cargando análisis NLP: ' + (data.error || 'Error desconocido') + '</div>';
                        }
                    } catch (error) {
                        console.error('Error cargando análisis NLP:', error);
                        document.getElementById('nlpContent').innerHTML = 
                            '<div class="error">Error de conexión al cargar análisis NLP</div>';
                    }
                }

                // Cargar documentos recientes
                async function loadDocumentosRecientes() {
                    try {
                        const response = await fetch('/api/reportes/recientes');
                        const data = await response.json();
                        
                        if (response.ok) {
                            displayRecentDocuments(data);
                        } else {
                            document.getElementById('recentDocs').innerHTML = 
                                '<div class="error">Error cargando documentos recientes</div>';
                        }
                    } catch (error) {
                        console.error('Error cargando documentos recientes:', error);
                        document.getElementById('recentDocs').innerHTML = 
                            '<div class="error">Error de conexión</div>';
                    }
                }

                // Mostrar análisis de calidad OCR
                function displayOCRQuality(data) {
                    let html = '<div class="quality-grid">';
                    
                    // Distribución de calidad
                    if (data.distribucion_calidad) {
                        const dist = data.distribucion_calidad;
                        
                        html += \`
                            <div class="quality-item">
                                <h5>Excelente (>0.8)</h5>
                                <div class="quality-score quality-excellent">\${dist.excelente || 0}</div>
                                <small>documentos</small>
                            </div>
                            <div class="quality-item">
                                <h5>Buena (0.6-0.8)</h5>
                                <div class="quality-score quality-good">\${dist.buena || 0}</div>
                                <small>documentos</small>
                            </div>
                            <div class="quality-item">
                                <h5>Regular (0.4-0.6)</h5>
                                <div class="quality-score quality-fair">\${dist.regular || 0}</div>
                                <small>documentos</small>
                            </div>
                            <div class="quality-item">
                                <h5>Deficiente (<0.4)</h5>
                                <div class="quality-score quality-poor">\${dist.deficiente || 0}</div>
                                <small>documentos</small>
                            </div>
                        \`;
                    }
                    
                    // Estadísticas adicionales
                    if (data.estadisticas) {
                        const stats = data.estadisticas;
                        html += \`
                            <div class="quality-item">
                                <h5>Tiempo Promedio OCR</h5>
                                <div class="quality-score quality-good">\${stats.tiempo_promedio_ms || 0}ms</div>
                                <small>por documento</small>
                            </div>
                            <div class="quality-item">
                                <h5>Páginas Procesadas</h5>
                                <div class="quality-score quality-good">\${stats.total_paginas || 0}</div>
                                <small>total</small>
                            </div>
                        \`;
                    }
                    
                    html += '</div>';
                    
                    // Consejos para mejorar calidad
                    if (data.distribucion_calidad && data.distribucion_calidad.deficiente > 0) {
                        html += \`
                            <div style="margin-top: 1rem; padding: 1rem; background: #fff3cd; border-radius: 6px; color: #856404;">
                                <strong>💡 Consejos para mejorar:</strong>
                                <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
                                    <li>Escanear documentos a 300 DPI o superior</li>
                                    <li>Asegurar buen contraste y iluminación uniforme</li>
                                    <li>Evitar páginas inclinadas o borrosas</li>
                                    <li>Usar formatos sin compresión excesiva</li>
                                </ul>
                            </div>
                        \`;
                    }
                    
                    document.getElementById('ocrQualityContent').innerHTML = html;
                }

                // Crear gráfico de métodos de procesamiento
                function createMetodosChart(data) {
                    const ctx = document.getElementById('metodosChart').getContext('2d');
                    
                    if (metodosChart) {
                        metodosChart.destroy();
                    }
                    
                    metodosChart = new Chart(ctx, {
                        type: 'pie',
                        data: {
                            labels: data.map(d => {
                                const labels = {
                                    'nativo': 'Extracción Nativa',
                                    'ocr': 'OCR Aplicado',
                                    'ocr_fallback': 'OCR Fallback',
                                    'sin_procesar': 'Sin Procesar'
                                };
                                return labels[d.metodo] || d.metodo;
                            }),
                            datasets: [{
                                data: data.map(d => parseInt(d.cantidad)),
                                backgroundColor: [
                                    '#28a745', // Nativo - Verde
                                    '#17a2b8', // OCR - Azul claro
                                    '#ffc107', // OCR Fallback - Amarillo
                                    '#dc3545'  // Sin procesar - Rojo
                                ]
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom'
                                }
                            }
                        }
                    });
                }

                // Crear gráfico temporal
                function createTemporalChart(data) {
                    const ctx = document.getElementById('temporalChart').getContext('2d');
                    
                    if (temporalChart) {
                        temporalChart.destroy();
                    }
                    
                    temporalChart = new Chart(ctx, {
                        type: 'line',
                        data: {
                            labels: data.map(d => d.mes),
                            datasets: [
                                {
                                    label: 'Total Documentos',
                                    data: data.map(d => parseInt(d.cantidad)),
                                    borderColor: '#007BFF',
                                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                                    tension: 0.4,
                                    fill: false
                                },
                                {
                                    label: 'Procesados con OCR',
                                    data: data.map(d => parseInt(d.con_ocr || 0)),
                                    borderColor: '#17a2b8',
                                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                                    tension: 0.4,
                                    fill: false
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    display: true
                                }
                            },
                            scales: {
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        stepSize: 1
                                    }
                                }
                            }
                        }
                    });
                }

                // Crear gráfico de comisiones
                function createComisionesChart(data) {
                    const ctx = document.getElementById('comisionesChart').getContext('2d');
                    
                    if (comisionesChart) {
                        comisionesChart.destroy();
                    }
                    
                    comisionesChart = new Chart(ctx, {
                        type: 'doughnut',
                        data: {
                            labels: data.map(d => d.nombre || 'Sin asignar'),
                            datasets: [{
                                data: data.map(d => parseInt(d.cantidad)),
                                backgroundColor: [
                                    '#007BFF', '#28a745', '#ffc107', '#dc3545', 
                                    '#6f42c1', '#fd7e14', '#20c997', '#6c757d'
                                ]
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'bottom'
                                }
                            }
                        }
                    });
                }

                // Mostrar análisis NLP
                function displayNLPAnalysis(data) {
                    let html = '';
                    
                    // Palabras clave más frecuentes
                    if (data.palabras_frecuentes && data.palabras_frecuentes.length > 0) {
                        html += \`
                            <h4>🏷️ Palabras Clave Más Frecuentes</h4>
                            <div class="keyword-cloud">
                                \${data.palabras_frecuentes.map(keyword => 
                                    \`<span class="keyword-item">\${keyword.palabra} (\${keyword.frecuencia})</span>\`
                                ).join('')}
                            </div>
                        \`;
                    }
                    
                    // Análisis de temas
                    if (data.temas_populares && data.temas_populares.length > 0) {
                        html += \`
                            <h4>📊 Temas Más Frecuentes</h4>
                            <div class="topic-analysis">
                                \${data.temas_populares.map(tema => \`
                                    <div class="topic-card">
                                        <h5>\${tema.tema}</h5>
                                        <p>Documentos: \${tema.frecuencia}</p>
                                        <small>Palabras relacionadas: \${tema.palabras_ejemplo || 'N/A'}</small>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    }
                    
                    // Estadísticas de sentimientos
                    if (data.analisis_sentimientos) {
                        html += \`
                            <h4>😊 Análisis de Sentimientos</h4>
                            <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
                                <div>Positivos: <strong>\${data.analisis_sentimientos.positivos || 0}</strong></div>
                                <div>Neutrales: <strong>\${data.analisis_sentimientos.neutrales || 0}</strong></div>
                                <div>Negativos: <strong>\${data.analisis_sentimientos.negativos || 0}</strong></div>
                            </div>
                        \`;
                    }
                    
                    // Complejidad promedio
                    if (data.complejidad_promedio) {
                        html += \`
                            <h4>📈 Complejidad Promedio de Documentos</h4>
                            <div style="background: #e8f4fd; padding: 1rem; border-radius: 4px;">
                                <p>Score de complejidad: <strong>\${data.complejidad_promedio.toFixed(2)}/10</strong></p>
                                <small>Basado en longitud de oraciones y vocabulario utilizado</small>
                            </div>
                        \`;
                    }
                    
                    // Información específica de OCR
                    if (data.estadisticas_ocr) {
                        html += \`
                            <h4>🔍 Estadísticas de Procesamiento OCR</h4>
                            <div style="background: #e8f5e8; padding: 1rem; border-radius: 4px;">
                                <p>Documentos procesados con OCR: <strong>\${data.estadisticas_ocr.documentos_ocr}</strong></p>
                                <p>Calidad promedio de extracción: <strong>\${data.estadisticas_ocr.calidad_promedio}%</strong></p>
                                <p>Páginas totales procesadas: <strong>\${data.estadisticas_ocr.paginas_totales}</strong></p>
                            </div>
                        \`;
                    }
                    
                    if (!html) {
                        html = '<div class="error">No hay suficientes datos de análisis NLP disponibles. Asegúrese de que se hayan subido documentos y procesado correctamente.</div>';
                    }
                    
                    document.getElementById('nlpContent').innerHTML = html;
                }

                // Mostrar documentos recientes
                function displayRecentDocuments(data) {
                    if (!data || data.length === 0) {
                        document.getElementById('recentDocs').innerHTML = '<p>No hay documentos recientes disponibles.</p>';
                        return;
                    }
                    
                    const html = data.map(doc => {
                        const fecha = new Date(doc.created_at).toLocaleDateString();
                        const sentiment = parseFloat(doc.sentiment) || 0;
                        let sentimentClass = 'sentiment-neutral';
                        if (sentiment > 0.1) sentimentClass = 'sentiment-positive';
                        else if (sentiment < -0.1) sentimentClass = 'sentiment-negative';
                        
                        // Determinar indicador de procesamiento
                        let processingIndicator = '';
                        if (doc.metadatos_procesamiento) {
                            try {
                                const metadatos = typeof doc.metadatos_procesamiento === 'string' 
                                    ? JSON.parse(doc.metadatos_procesamiento) 
                                    : doc.metadatos_procesamiento;
                                    
                                if (metadatos.ocr_aplicado) {
                                    processingIndicator = '<span class="ocr-indicator ocr-applied">OCR</span>';
                                } else if (metadatos.metodo_extraccion === 'nativo') {
                                    processingIndicator = '<span class="ocr-indicator ocr-native">NATIVO</span>';
                                }
                            } catch (e) {
                                // Ignorar errores de parsing
                            }
                        }
                        
                        return \`
                            <div class="doc-item">
                                <div>
                                    <h5>\${doc.titulo} \${processingIndicator}</h5>
                                    <p>
                                        <span class="sentiment-indicator \${sentimentClass}"></span>
                                        <strong>Remitente:</strong> \${doc.remitente || 'N/A'} | 
                                        <strong>Fecha:</strong> \${fecha} |
                                        <strong>Comisión:</strong> \${doc.nombre_comision || 'Sin asignar'}
                                    </p>
                                    <small>Palabras clave: \${doc.palabras_preview || 'Procesando...'}</small>
                                </div>
                                <div>
                                    <a href="/api/documentos/\${doc.id}/download" class="btn btn-info btn-sm" target="_blank">
                                        📥 Ver
                                    </a>
                                </div>
                            </div>
                        \`;
                    }).join('');
                    
                    document.getElementById('recentDocs').innerHTML = html;
                }

                // Inicializar página
                document.addEventListener('DOMContentLoaded', function() {
                    console.log('🚀 Iniciando carga de reportes...');
                    loadAllReports();
                });
            </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error generando página de reportes:', error);
      res.status(500).send('Error interno del servidor');
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
      const keywords = JSON.parse(row.palabras_clave);
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