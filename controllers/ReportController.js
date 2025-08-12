// controllers/ReportController.js
const { query } = require('../config/database');

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
                    max-width: 1200px;
                    margin: 2rem auto;
                    padding: 0 1rem;
                }
                .reports-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
                    gap: 2rem;
                    margin-bottom: 2rem;
                }
                .report-card {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    border-left: 4px solid #007BFF;
                }
                .report-card h3 {
                    color: #007BFF;
                    margin-bottom: 1rem;
                }
                .chart-container {
                    position: relative;
                    height: 300px;
                    margin: 1rem 0;
                }
                .stats-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 1rem;
                    margin: 1rem 0;
                }
                .stat-item {
                    text-align: center;
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                .stat-number {
                    font-size: 2rem;
                    font-weight: bold;
                    color: #007BFF;
                }
                .stat-label {
                    font-size: 0.9rem;
                    color: #6c757d;
                    margin-top: 0.5rem;
                }
                .keywords-cloud {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    margin: 1rem 0;
                }
                .keyword-item {
                    padding: 0.25rem 0.75rem;
                    background: #007BFF;
                    color: white;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    position: relative;
                }
                .recent-documents {
                    max-height: 400px;
                    overflow-y: auto;
                }
                .document-item {
                    padding: 0.75rem;
                    border-bottom: 1px solid #eee;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .document-item:hover {
                    background-color: #f8f9fa;
                }
                .document-title {
                    font-weight: 500;
                    color: #333;
                }
                .document-meta {
                    font-size: 0.8rem;
                    color: #6c757d;
                }
                .btn {
                    padding: 0.5rem 1rem;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                    transition: background-color 0.3s ease;
                }
                .btn-primary {
                    background-color: #007BFF;
                    color: white;
                }
                .btn-info {
                    background-color: #17a2b8;
                    color: white;
                }
                .btn-success {
                    background-color: #28a745;
                    color: white;
                }
                .loading {
                    text-align: center;
                    padding: 2rem;
                    color: #6c757d;
                }
                .filter-section {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .filter-controls {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    align-items: end;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }
                .form-control {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .nlp-insights {
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    padding: 1.5rem;
                    border-radius: 8px;
                    margin: 1rem 0;
                }
                .insight-item {
                    margin: 0.5rem 0;
                    padding: 0.5rem;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <nav>
                <a href="/dashboard" class="logo">ICU Dashboard</a>
                <div class="nav-links">
                    <a href="/dashboard">Dashboard</a>
                    <a href="/reportes" class="active">📊 Reportes</a>
                    <span class="user-info-nav">👤 ${usuario.nombre}</span>
                    <a href="/logout" class="logout-btn">Cerrar Sesión</a>
                </div>
            </nav>

            <div class="reports-container">
                <div class="welcome-card">
                    <h1>📊 Centro de Reportes y Análisis</h1>
                    <p>Análisis inteligente de documentos y estadísticas del sistema ICU</p>
                </div>

                <div class="filter-section">
                    <h3>🔍 Filtros de Análisis</h3>
                    <div class="filter-controls">
                        <div class="form-group">
                            <label for="fechaDesde">Fecha desde:</label>
                            <input type="date" id="fechaDesde" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="fechaHasta">Fecha hasta:</label>
                            <input type="date" id="fechaHasta" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="comisionFiltro">Comisión:</label>
                            <select id="comisionFiltro" class="form-control">
                                <option value="">Todas las comisiones</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <button onclick="actualizarReportes()" class="btn btn-primary">🔄 Actualizar Reportes</button>
                        </div>
                    </div>
                </div>

                <div class="reports-grid">
                    <!-- Resumen General -->
                    <div class="report-card">
                        <h3>📈 Resumen General</h3>
                        <div id="resumenGeneral">
                            <div class="loading">Cargando estadísticas...</div>
                        </div>
                    </div>

                    <!-- Análisis Temporal -->
                    <div class="report-card">
                        <h3>📅 Documentos por Mes</h3>
                        <div class="chart-container">
                            <canvas id="chartTemporal"></canvas>
                        </div>
                    </div>

                    <!-- Distribución por Comisiones -->
                    <div class="report-card">
                        <h3>🏛️ Documentos por Comisión</h3>
                        <div class="chart-container">
                            <canvas id="chartComisiones"></canvas>
                        </div>
                    </div>

                    <!-- Palabras Clave Más Frecuentes -->
                    <div class="report-card">
                        <h3>🏷️ Palabras Clave Populares</h3>
                        <div id="keywordsSection">
                            <div class="loading">Analizando palabras clave...</div>
                        </div>
                    </div>

                    <!-- Análisis de Sentimiento NLP -->
                    <div class="report-card">
                        <h3>🧠 Análisis NLP</h3>
                        <div id="nlpAnalysis">
                            <div class="loading">Procesando análisis de contenido...</div>
                        </div>
                    </div>

                    <!-- Documentos Recientes -->
                    <div class="report-card">
                        <h3>📄 Documentos Recientes</h3>
                        <div id="recentDocuments" class="recent-documents">
                            <div class="loading">Cargando documentos...</div>
                        </div>
                    </div>
                </div>
            </div>

            <script>
                let chartTemporal, chartComisiones;

                // Inicializar página
                document.addEventListener('DOMContentLoaded', function() {
                    // Configurar fechas por defecto (últimos 6 meses)
                    const hoy = new Date();
                    const hace6Meses = new Date();
                    hace6Meses.setMonth(hace6Meses.getMonth() - 6);
                    
                    document.getElementById('fechaHasta').value = hoy.toISOString().split('T')[0];
                    document.getElementById('fechaDesde').value = hace6Meses.toISOString().split('T')[0];

                    cargarComisiones();
                    actualizarReportes();
                });

                // Cargar comisiones para filtro
                async function cargarComisiones() {
                    try {
                        const response = await fetch('/api/comisiones');
                        const comisiones = await response.json();
                        const select = document.getElementById('comisionFiltro');
                        
                        comisiones.forEach(comision => {
                            const option = document.createElement('option');
                            option.value = comision.id;
                            option.textContent = comision.nombre;
                            select.appendChild(option);
                        });
                    } catch (error) {
                        console.error('Error cargando comisiones:', error);
                    }
                }

                // Actualizar todos los reportes
                async function actualizarReportes() {
                    const filtros = {
                        fechaDesde: document.getElementById('fechaDesde').value,
                        fechaHasta: document.getElementById('fechaHasta').value,
                        comisionId: document.getElementById('comisionFiltro').value
                    };

                    await Promise.all([
                        cargarResumenGeneral(filtros),
                        cargarAnalisisTemporal(filtros),
                        cargarDistribucionComisiones(filtros),
                        cargarPalabrasClave(filtros),
                        cargarAnalisisNLP(filtros),
                        cargarDocumentosRecientes(filtros)
                    ]);
                }

                // Cargar resumen general
                async function cargarResumenGeneral(filtros = {}) {
                    try {
                        const params = new URLSearchParams(filtros);
                        const response = await fetch(\`/api/reportes/resumen?\${params}\`);
                        const data = await response.json();
                        
                        document.getElementById('resumenGeneral').innerHTML = \`
                            <div class="stats-summary">
                                <div class="stat-item">
                                    <div class="stat-number">\${data.totalDocumentos}</div>
                                    <div class="stat-label">Total Documentos</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">\${data.documentosEsteMes}</div>
                                    <div class="stat-label">Este Mes</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">\${data.promedioPorMes}</div>
                                    <div class="stat-label">Promedio/Mes</div>
                                </div>
                                <div class="stat-item">
                                    <div class="stat-number">\${data.comisionesActivas}</div>
                                    <div class="stat-label">Comisiones Activas</div>
                                </div>
                            </div>
                            <div style="margin-top: 1rem; padding: 1rem; background: #f8f9fa; border-radius: 4px;">
                                <strong>📊 Métricas de Contenido:</strong><br>
                                • Promedio de palabras por documento: \${data.promedioPalabras}<br>
                                • Documentos con análisis NLP: \${data.documentosConNLP}<br>
                                • Total de palabras clave identificadas: \${data.totalPalabrasClave}
                            </div>
                        \`;
                    } catch (error) {
                        document.getElementById('resumenGeneral').innerHTML = '<p>Error cargando resumen</p>';
                        console.error('Error:', error);
                    }
                }

                // Cargar análisis temporal
                async function cargarAnalisisTemporal(filtros = {}) {
                    try {
                        const params = new URLSearchParams(filtros);
                        const response = await fetch(\`/api/reportes/temporal?\${params}\`);
                        const data = await response.json();
                        
                        const ctx = document.getElementById('chartTemporal').getContext('2d');
                        
                        if (chartTemporal) {
                            chartTemporal.destroy();
                        }
                        
                        chartTemporal = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: data.labels,
                                datasets: [{
                                    label: 'Documentos por Mes',
                                    data: data.valores,
                                    borderColor: '#007BFF',
                                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                                    tension: 0.4,
                                    fill: true
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    y: {
                                        beginAtZero: true
                                    }
                                }
                            }
                        });
                    } catch (error) {
                        console.error('Error cargando análisis temporal:', error);
                    }
                }

                // Cargar distribución por comisiones
                async function cargarDistribucionComisiones(filtros = {}) {
                    try {
                        const params = new URLSearchParams(filtros);
                        const response = await fetch(\`/api/reportes/comisiones?\${params}\`);
                        const data = await response.json();
                        
                        const ctx = document.getElementById('chartComisiones').getContext('2d');
                        
                        if (chartComisiones) {
                            chartComisiones.destroy();
                        }
                        
                        chartComisiones = new Chart(ctx, {
                            type: 'doughnut',
                            data: {
                                labels: data.labels,
                                datasets: [{
                                    data: data.valores,
                                    backgroundColor: [
                                        '#007BFF', '#28a745', '#ffc107', '#dc3545',
                                        '#17a2b8', '#6f42c1', '#fd7e14', '#20c997',
                                        '#6c757d', '#343a40'
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
                    } catch (error) {
                        console.error('Error cargando distribución por comisiones:', error);
                    }
                }

                // Cargar palabras clave
                async function cargarPalabrasClave(filtros = {}) {
                    try {
                        const params = new URLSearchParams(filtros);
                        const response = await fetch(\`/api/reportes/palabras-clave?\${params}\`);
                        const data = await response.json();
                        
                        const keywordsHtml = data.map(item => \`
                            <span class="keyword-item" style="font-size: \${Math.min(1 + (item.frecuencia / 10), 2)}rem">
                                \${item.palabra} (\${item.frecuencia})
                            </span>
                        \`).join('');
                        
                        document.getElementById('keywordsSection').innerHTML = \`
                            <div class="keywords-cloud">
                                \${keywordsHtml}
                            </div>
                            <p style="margin-top: 1rem; font-size: 0.9rem; color: #6c757d;">
                                Se muestran las 20 palabras clave más frecuentes. El tamaño indica la frecuencia de aparición.
                            </p>
                        \`;
                    } catch (error) {
                        document.getElementById('keywordsSection').innerHTML = '<p>Error cargando palabras clave</p>';
                        console.error('Error:', error);
                    }
                }

                // Cargar análisis NLP
                async function cargarAnalisisNLP(filtros = {}) {
                    try {
                        const params = new URLSearchParams(filtros);
                        const response = await fetch(\`/api/reportes/nlp?\${params}\`);
                        const data = await response.json();
                        
                        document.getElementById('nlpAnalysis').innerHTML = \`
                            <div class="nlp-insights">
                                <h5>🧠 Insights de Contenido</h5>
                                <div class="insight-item">
                                    <strong>Sentimiento Promedio:</strong> \${data.sentimientoPromedio > 0 ? '😊 Positivo' : data.sentimientoPromedio < 0 ? '😔 Negativo' : '😐 Neutral'} 
                                    (\${data.sentimientoPromedio.toFixed(2)})
                                </div>
                                <div class="insight-item">
                                    <strong>Complejidad Promedio:</strong> \${data.complejidadPromedio.toFixed(1)}/10
                                </div>
                                <div class="insight-item">
                                    <strong>Longitud Promedio:</strong> \${Math.round(data.longitudPromedio)} palabras
                                </div>
                            </div>
                            
                            <h5 style="margin-top: 1rem;">📋 Temas Más Frecuentes:</h5>
                            <div style="margin: 1rem 0;">
                                \${data.temasFrecuentes.map(tema => \`
                                    <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: #f8f9fa; margin: 0.25rem 0; border-radius: 4px;">
                                        <span>\${tema.tema.charAt(0).toUpperCase() + tema.tema.slice(1)}</span>
                                        <strong>\${tema.frecuencia} documentos</strong>
                                    </div>
                                \`).join('')}
                            </div>
                        \`;
                    } catch (error) {
                        document.getElementById('nlpAnalysis').innerHTML = '<p>Error cargando análisis NLP</p>';
                        console.error('Error:', error);
                    }
                }

                // Cargar documentos recientes
                async function cargarDocumentosRecientes(filtros = {}) {
                    try {
                        const params = new URLSearchParams({...filtros, limit: 10});
                        const response = await fetch(\`/api/reportes/recientes?\${params}\`);
                        const data = await response.json();
                        
                        const documentosHtml = data.map(doc => \`
                            <div class="document-item">
                                <div>
                                    <div class="document-title">\${doc.titulo}</div>
                                    <div class="document-meta">
                                        \${doc.remitente || 'Sin remitente'} • 
                                        \${new Date(doc.fecha_ingreso).toLocaleDateString()} • 
                                        \${doc.nombre_comision || 'Sin comisión'}
                                    </div>
                                </div>
                                <a href="/api/documentos/\${doc.id}/download" class="btn btn-info btn-sm" target="_blank">
                                    📥 Ver
                                </a>
                            </div>
                        \`).join('');
                        
                        document.getElementById('recentDocuments').innerHTML = documentosHtml || '<p>No hay documentos recientes</p>';
                    } catch (error) {
                        document.getElementById('recentDocuments').innerHTML = '<p>Error cargando documentos</p>';
                        console.error('Error:', error);
                    }
                }
            </script>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('Error generando página de reportes:', error);
      res.status(500).send('Error interno del servidor');
    }
  }

  // API endpoints para datos de reportes
  
  // Resumen general
  static async getResumenGeneral(req, res) {
    try {
      const { fechaDesde, fechaHasta, comisionId } = req.query;
      
      let whereClause = '1=1';
      let params = [];
      let paramCount = 0;

      if (fechaDesde) {
        whereClause += ` AND fecha_ingreso >= ${++paramCount}`;
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        whereClause += ` AND fecha_ingreso <= ${++paramCount}`;
        params.push(fechaHasta);
      }
      if (comisionId) {
        whereClause += ` AND comision_id = ${++paramCount}`;
        params.push(comisionId);
      }

      const resumenQuery = `
        SELECT 
          COUNT(*) as total_documentos,
          COUNT(CASE WHEN fecha_ingreso >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as documentos_este_mes,
          AVG(CASE WHEN contenido_texto IS NOT NULL THEN array_length(string_to_array(contenido_texto, ' '), 1) END) as promedio_palabras,
          COUNT(CASE WHEN palabras_clave IS NOT NULL THEN 1 END) as documentos_con_nlp
        FROM documentos 
        WHERE ${whereClause}
      `;

      const result = await query(resumenQuery, params);
      const datos = result.rows[0];

      // Calcular promedio por mes
      const mesesQuery = `
        SELECT COUNT(DISTINCT DATE_TRUNC('month', fecha_ingreso)) as meses_activos
        FROM documentos 
        WHERE ${whereClause}
      `;
      const mesesResult = await query(mesesQuery, params);
      const mesesActivos = parseInt(mesesResult.rows[0].meses_activos) || 1;

      // Contar comisiones activas
      const comisionesQuery = `
        SELECT COUNT(DISTINCT comision_id) as comisiones_activas
        FROM documentos 
        WHERE ${whereClause} AND comision_id IS NOT NULL
      `;
      const comisionesResult = await query(comisionesQuery, params);

      // Contar palabras clave totales
      const palabrasClaveQuery = `
        SELECT COUNT(*) as total_palabras_clave
        FROM (
          SELECT jsonb_array_elements_text(palabras_clave::jsonb) as palabra
          FROM documentos 
          WHERE ${whereClause} AND palabras_clave IS NOT NULL
        ) palabras
      `;
      const palabrasResult = await query(palabrasClaveQuery, params);

      res.json({
        totalDocumentos: parseInt(datos.total_documentos),
        documentosEsteMes: parseInt(datos.documentos_este_mes),
        promedioPorMes: Math.round(parseInt(datos.total_documentos) / mesesActivos),
        comisionesActivas: parseInt(comisionesResult.rows[0].comisiones_activas),
        promedioPalabras: Math.round(parseFloat(datos.promedio_palabras) || 0),
        documentosConNLP: parseInt(datos.documentos_con_nlp),
        totalPalabrasClave: parseInt(palabrasResult.rows[0].total_palabras_clave || 0)
      });

    } catch (error) {
      console.error('Error obteniendo resumen:', error);
      res.status(500).json({ error: 'Error obteniendo resumen' });
    }
  }

  // Análisis temporal
  static async getAnalisisTemporal(req, res) {
    try {
      const { fechaDesde, fechaHasta, comisionId } = req.query;
      
      let whereClause = '1=1';
      let params = [];
      let paramCount = 0;

      if (fechaDesde) {
        whereClause += ` AND fecha_ingreso >= ${++paramCount}`;
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        whereClause += ` AND fecha_ingreso <= ${++paramCount}`;
        params.push(fechaHasta);
      }
      if (comisionId) {
        whereClause += ` AND comision_id = ${++paramCount}`;
        params.push(comisionId);
      }

      const temporalQuery = `
        SELECT 
          TO_CHAR(fecha_ingreso, 'YYYY-MM') as mes,
          COUNT(*) as cantidad
        FROM documentos 
        WHERE ${whereClause}
        GROUP BY TO_CHAR(fecha_ingreso, 'YYYY-MM')
        ORDER BY mes
      `;

      const result = await query(temporalQuery, params);
      
      res.json({
        labels: result.rows.map(row => {
          const [year, month] = row.mes.split('-');
          const date = new Date(year, month - 1);
          return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' });
        }),
        valores: result.rows.map(row => parseInt(row.cantidad))
      });

    } catch (error) {
      console.error('Error obteniendo análisis temporal:', error);
      res.status(500).json({ error: 'Error obteniendo análisis temporal' });
    }
  }

  // Distribución por comisiones
  static async getDistribucionComisiones(req, res) {
    try {
      const { fechaDesde, fechaHasta, comisionId } = req.query;
      
      let whereClause = '1=1';
      let params = [];
      let paramCount = 0;

      if (fechaDesde) {
        whereClause += ` AND d.fecha_ingreso >= ${++paramCount}`;
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        whereClause += ` AND d.fecha_ingreso <= ${++paramCount}`;
        params.push(fechaHasta);
      }
      if (comisionId) {
        whereClause += ` AND d.comision_id = ${++paramCount}`;
        params.push(comisionId);
      }

      const comisionesQuery = `
        SELECT 
          COALESCE(c.nombre, 'Sin comisión') as nombre_comision,
          COUNT(d.id) as cantidad
        FROM documentos d
        LEFT JOIN comisiones c ON d.comision_id = c.id
        WHERE ${whereClause}
        GROUP BY c.nombre
        ORDER BY cantidad DESC
      `;

      const result = await query(comisionesQuery, params);
      
      res.json({
        labels: result.rows.map(row => row.nombre_comision),
        valores: result.rows.map(row => parseInt(row.cantidad))
      });

    } catch (error) {
      console.error('Error obteniendo distribución por comisiones:', error);
      res.status(500).json({ error: 'Error obteniendo distribución por comisiones' });
    }
  }

  // Palabras clave más frecuentes
  static async getPalabrasClave(req, res) {
    try {
      const { fechaDesde, fechaHasta, comisionId } = req.query;
      
      let whereClause = '1=1';
      let params = [];
      let paramCount = 0;

      if (fechaDesde) {
        whereClause += ` AND fecha_ingreso >= ${++paramCount}`;
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        whereClause += ` AND fecha_ingreso <= ${++paramCount}`;
        params.push(fechaHasta);
      }
      if (comisionId) {
        whereClause += ` AND comision_id = ${++paramCount}`;
        params.push(comisionId);
      }

      const palabrasQuery = `
        SELECT 
          palabra,
          COUNT(*) as frecuencia
        FROM (
          SELECT jsonb_array_elements_text(palabras_clave::jsonb) as palabra
          FROM documentos 
          WHERE ${whereClause} AND palabras_clave IS NOT NULL
        ) palabras
        GROUP BY palabra
        ORDER BY frecuencia DESC
        LIMIT 20
      `;

      const result = await query(palabrasQuery, params);
      
      res.json(result.rows.map(row => ({
        palabra: row.palabra,
        frecuencia: parseInt(row.frecuencia)
      })));

    } catch (error) {
      console.error('Error obteniendo palabras clave:', error);
      res.status(500).json({ error: 'Error obteniendo palabras clave' });
    }
  }

  // Análisis NLP
  static async getAnalisisNLP(req, res) {
    try {
      const { fechaDesde, fechaHasta, comisionId } = req.query;
      
      let whereClause = '1=1';
      let params = [];
      let paramCount = 0;

      if (fechaDesde) {
        whereClause += ` AND fecha_ingreso >= ${++paramCount}`;
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        whereClause += ` AND fecha_ingreso <= ${++paramCount}`;
        params.push(fechaHasta);
      }
      if (comisionId) {
        whereClause += ` AND comision_id = ${++paramCount}`;
        params.push(comisionId);
      }

      // Análisis de sentimiento y complejidad
      const analisisQuery = `
        SELECT 
          AVG((analisis_nlp->>'sentiment')::numeric) as sentimiento_promedio,
          AVG((analisis_nlp->'complejidad'->>'score')::numeric) as complejidad_promedio,
          AVG((analisis_nlp->>'longitud_palabras')::numeric) as longitud_promedio
        FROM documentos 
        WHERE ${whereClause} AND analisis_nlp IS NOT NULL
      `;

      const analisisResult = await query(analisisQuery, params);

      // Temas más frecuentes
      const temasQuery = `
        SELECT 
          tema->>'tema' as tema,
          COUNT(*) as frecuencia
        FROM (
          SELECT jsonb_array_elements(analisis_nlp->'temas_detectados') as tema
          FROM documentos 
          WHERE ${whereClause} AND analisis_nlp IS NOT NULL
        ) temas
        GROUP BY tema->>'tema'
        ORDER BY frecuencia DESC
        LIMIT 10
      `;

      const temasResult = await query(temasQuery, params);

      const datos = analisisResult.rows[0];
      
      res.json({
        sentimientoPromedio: parseFloat(datos.sentimiento_promedio) || 0,
        complejidadPromedio: parseFloat(datos.complejidad_promedio) || 0,
        longitudPromedio: parseFloat(datos.longitud_promedio) || 0,
        temasFrecuentes: temasResult.rows.map(row => ({
          tema: row.tema,
          frecuencia: parseInt(row.frecuencia)
        }))
      });

    } catch (error) {
      console.error('Error obteniendo análisis NLP:', error);
      res.status(500).json({ error: 'Error obteniendo análisis NLP' });
    }
  }

  // Documentos recientes
  static async getDocumentosRecientes(req, res) {
    try {
      const { fechaDesde, fechaHasta, comisionId, limit = 10 } = req.query;
      
      let whereClause = '1=1';
      let params = [];
      let paramCount = 0;

      if (fechaDesde) {
        whereClause += ` AND d.fecha_ingreso >= ${++paramCount}`;
        params.push(fechaDesde);
      }
      if (fechaHasta) {
        whereClause += ` AND d.fecha_ingreso <= ${++paramCount}`;
        params.push(fechaHasta);
      }
      if (comisionId) {
        whereClause += ` AND d.comision_id = ${++paramCount}`;
        params.push(comisionId);
      }

      params.push(parseInt(limit));
      
      const documentosQuery = `
        SELECT 
          d.id, d.titulo, d.remitente, d.fecha_ingreso,
          c.nombre as nombre_comision,
          u.nombre as nombre_usuario
        FROM documentos d
        LEFT JOIN comisiones c ON d.comision_id = c.id
        LEFT JOIN usuarios u ON d.usuario_creador_id = u.id
        WHERE ${whereClause}
        ORDER BY d.created_at DESC
        LIMIT ${++paramCount}
      `;

      const result = await query(documentosQuery, params);
      res.json(result.rows);

    } catch (error) {
      console.error('Error obteniendo documentos recientes:', error);
      res.status(500).json({ error: 'Error obteniendo documentos recientes' });
    }
  }

  // Endpoint principal para reportes de documentos (usado desde el servidor principal)
  static async getDocumentosReport(req, res) {
    try {
      const tipo = req.query.tipo || 'resumen';
      
      switch (tipo) {
        case 'resumen':
          return await ReportController.getResumenGeneral(req, res);
        case 'temporal':
          return await ReportController.getAnalisisTemporal(req, res);
        case 'comisiones':
          return await ReportController.getDistribucionComisiones(req, res);
        case 'palabras-clave':
          return await ReportController.getPalabrasClave(req, res);
        case 'nlp':
          return await ReportController.getAnalisisNLP(req, res);
        case 'recientes':
          return await ReportController.getDocumentosRecientes(req, res);
        default:
          res.status(400).json({ error: 'Tipo de reporte no válido' });
      }
    } catch (error) {
      console.error('Error en reporte de documentos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}

module.exports = ReportController;