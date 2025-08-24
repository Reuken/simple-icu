// controllers/DocumentController.js
const { query, getClient } = require('../config/database');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const natural = require('natural');

// Configuración de NLP en español
// CORREGIDO: Se borro la linea 10

class DocumentController {
  
  // Obtener página principal de documentos
  static async getDocumentosPage(req, res) {
    try {
      const usuario = req.session.usuario;
      const permisos = usuario.permisos;
      
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gestión de Documentos - ICU</title>
            <link rel="stylesheet" href="/estilos.css">
            <style>
                .documents-container {
                    max-width: 1200px;
                    margin: 2rem auto;
                    padding: 0 1rem;
                }
                .upload-section {
                    background: white;
                    padding: 2rem;
                    border-radius: 8px;
                    margin-bottom: 2rem;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                .documents-grid {
                    display: grid;
                    gap: 1rem;
                }
                .document-card {
                    background: white;
                    padding: 1.5rem;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    border-left: 4px solid #007BFF;
                }
                .document-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }
                .keywords-section {
                    margin-top: 1rem;
                    padding: 1rem;
                    background: #f8f9fa;
                    border-radius: 4px;
                }
                .keyword-tag {
                    display: inline-block;
                    padding: 0.25rem 0.5rem;
                    margin: 0.25rem;
                    background: #007BFF;
                    color: white;
                    border-radius: 12px;
                    font-size: 0.8rem;
                }
                .recommendations {
                    margin-top: 1rem;
                    padding: 1rem;
                    background: #e8f5e8;
                    border-radius: 4px;
                    border-left: 4px solid #28a745;
                }
                .upload-area {
                    border: 2px dashed #007BFF;
                    border-radius: 8px;
                    padding: 2rem;
                    text-align: center;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                }
                .upload-area:hover {
                    background-color: #f8f9fa;
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
                .btn-success {
                    background-color: #28a745;
                    color: white;
                }
                .btn-info {
                    background-color: #17a2b8;
                    color: white;
                }
                .form-group {
                    margin-bottom: 1rem;
                }
                .form-control {
                    width: 100%;
                    padding: 0.5rem;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .hidden {
                    display: none;
                }
                .loading {
                    text-align: center;
                    padding: 2rem;
                }
                .alert {
                    padding: 1rem;
                    margin-bottom: 1rem;
                    border-radius: 4px;
                }
                .alert-success {
                    background-color: #d4edda;
                    border: 1px solid #c3e6cb;
                    color: #155724;
                }
                .alert-error {
                    background-color: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                }
            </style>
        </head>
        <body>
            <nav>
                <a href="/dashboard" class="logo">ICU Dashboard</a>
                <div class="nav-links">
                    <a href="/dashboard">Dashboard</a>
                    <a href="/documentos" class="active">📄 Documentos</a>
                    <span class="user-info-nav">👤 ${usuario.nombre}</span>
                    <a href="/logout" class="logout-btn">Cerrar Sesión</a>
                </div>
            </nav>

            <div class="documents-container">
                <div class="welcome-card">
                    <h1>📄 Gestión de Documentos ICU</h1>
                    <p>Sistema de documentos con análisis inteligente de contenido</p>
                </div>

                ${permisos.subir_documentos ? `
                <div class="upload-section">
                    <h3>📤 Subir Nuevo Documento</h3>
                    <form id="uploadForm" enctype="multipart/form-data">
                        <div class="form-group">
                            <label for="titulo">Título del documento:</label>
                            <input type="text" id="titulo" name="titulo" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="remitente">Remitente:</label>
                            <input type="text" id="remitente" name="remitente" class="form-control">
                        </div>
                        <div class="form-group">
                            <label for="comision_id">Comisión:</label>
                            <select id="comision_id" name="comision_id" class="form-control">
                                <option value="">Seleccionar comisión...</option>
                            </select>
                        </div>
                        <div class="upload-area" onclick="document.getElementById('archivo').click()">
                            <p>🔄 Haz clic aquí para seleccionar un archivo PDF</p>
                            <p><small>Máximo 10MB - Solo archivos PDF</small></p>
                            <input type="file" id="archivo" name="archivo" accept=".pdf" class="hidden" onchange="updateFileName(this)">
                        </div>
                        <div id="fileName" style="margin: 1rem 0; font-style: italic;"></div>
                        <button type="submit" class="btn btn-primary">📤 Subir Documento</button>
                    </form>
                </div>
                ` : ''}

                <div id="alertContainer"></div>
                
                <div class="documents-section">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3>📋 Documentos del Sistema</h3>
                        <div>
                            <input type="text" id="searchInput" placeholder="🔍 Buscar documentos..." class="form-control" style="width: 300px; display: inline-block;">
                            <button onclick="loadDocuments()" class="btn btn-info">🔄 Actualizar</button>
                        </div>
                    </div>
                    
                    <div id="documentsContainer">
                        <div class="loading">Cargando documentos...</div>
                    </div>
                </div>
            </div>

            <script>
                // Cargar comisiones para el select
                async function loadComisiones() {
                    try {
                        const response = await fetch('/api/comisiones');
                        const comisiones = await response.json();
                        const select = document.getElementById('comision_id');
                        
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

                // Actualizar nombre del archivo
                function updateFileName(input) {
                    const fileName = document.getElementById('fileName');
                    if (input.files && input.files[0]) {
                        fileName.textContent = '📄 Archivo seleccionado: ' + input.files[0].name;
                    } else {
                        fileName.textContent = '';
                    }
                }

              // Subir documento
              document.getElementById('uploadForm')?.addEventListener('submit', async function(e) {
                  e.preventDefault();
                  
                  const formData = new FormData(this);
                  const submitBtn = this.querySelector('button[type="submit"]');
                  
                  // Validar que se seleccionó un archivo
                  if (!formData.get('archivo') || formData.get('archivo').size === 0) {
                      showAlert('⚠️ Por favor selecciona un archivo PDF', 'error');
                      return;
                  }
                  
                  submitBtn.disabled = true;
                  submitBtn.textContent = '📤 Subiendo...';
                  
                  try {
                      const response = await fetch('/api/documentos', {
                          method: 'POST',
                          body: formData
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok) {
                          showAlert('✅ Documento subido exitosamente. Procesando análisis...', 'success');
                          this.reset();
                          document.getElementById('fileName').textContent = '';
                          setTimeout(() => loadDocuments(), 2000);
                      } else {
                          showAlert('❌ Error: ' + (result.error || result.details || 'Error desconocido'), 'error');
                      }
                  } catch (error) {
                      console.error('Error subiendo documento:', error);
                      showAlert('❌ Error de conexión: ' + error.message, 'error');
                  } finally {
                      submitBtn.disabled = false;
                      submitBtn.textContent = '📤 Subir Documento';
                  }
              });

              // Cargar documentos con manejo mejorado de errores
              async function loadDocuments() {
                  const container = document.getElementById('documentsContainer');
                  container.innerHTML = '<div class="loading">Cargando documentos...</div>';
                  
                  try {
                      console.log('Cargando documentos...');
                      const response = await fetch('/api/documentos');
                      
                      console.log('Response status:', response.status);
                      console.log('Response headers:', response.headers.get('content-type'));
                      
                      if (!response.ok) {
                          throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
                      }
                      
                      const contentType = response.headers.get('content-type');
                      if (!contentType || !contentType.includes('application/json')) {
                          const text = await response.text();
                          console.error('Respuesta no JSON:', text.substring(0, 200));
                          throw new Error('La respuesta del servidor no es JSON válido');
                      }
                      
                      const documentos = await response.json();
                      console.log('Documentos recibidos:', documentos);
                      
                      if (!Array.isArray(documentos)) {
                          console.error('Respuesta no es array:', typeof documentos, documentos);
                          throw new Error('La respuesta no es un array válido');
                      }
                      
                      if (documentos.length === 0) {
                          container.innerHTML = \`
                              <div class="no-data">
                                  <h3>📄 No hay documentos disponibles</h3>
                                  <p>Los documentos aparecerán aquí una vez que sean subidos.</p>
                                  \${${permisos.subir_documentos} ? '<p><small>Usa el formulario de arriba para subir tu primer documento.</small></p>' : ''}
                              </div>
                          \`;
                          return;
                      }
                      
                      container.innerHTML = documentos.map(doc => generateDocumentCard(doc)).join('');
                      console.log('Documentos renderizados exitosamente');
                      
                  } catch (error) {
                      console.error('Error cargando documentos:', error);
                      container.innerHTML = \`
                          <div class="alert alert-error">
                              <h4>❌ Error cargando documentos</h4>
                              <p><strong>Detalle:</strong> \${error.message}</p>
                              <button onclick="loadDocuments()" class="btn btn-primary" style="margin-top: 1rem;">
                                  🔄 Reintentar
                              </button>
                          </div>
                      \`;
                  }
              }

              // Generar tarjeta de documento con manejo seguro de JSON
              function generateDocumentCard(doc) {
                  try {
                      const fecha = new Date(doc.fecha_ingreso).toLocaleDateString('es-ES');
                      
                      // Manejo seguro de campos JSON
                      let keywords = [];
                      let recomendaciones = [];
                      
                      try {
                          if (doc.palabras_clave) {
                              keywords = typeof doc.palabras_clave === 'string' 
                                  ? JSON.parse(doc.palabras_clave) 
                                  : doc.palabras_clave;
                          }
                      } catch (e) {
                          console.warn('Error parseando palabras_clave para doc', doc.id, ':', e);
                      }
                      
                      try {
                          if (doc.recomendaciones) {
                              recomendaciones = typeof doc.recomendaciones === 'string' 
                                  ? JSON.parse(doc.recomendaciones) 
                                  : doc.recomendaciones;
                          }
                      } catch (e) {
                          console.warn('Error parseando recomendaciones para doc', doc.id, ':', e);
                      }
                      
                      return \`
                          <div class="document-card">
                              <div class="document-meta">
                                  <div>
                                      <h4>\${doc.titulo}</h4>
                                      <p><strong>Remitente:</strong> \${doc.remitente || 'No especificado'}</p>
                                      <p><strong>Fecha:</strong> \${fecha}</p>
                                      <p><strong>Comisión:</strong> \${doc.nombre_comision || 'Sin asignar'}</p>
                                      <p><strong>Subido por:</strong> \${doc.nombre_usuario || 'Usuario desconocido'}</p>
                                  </div>
                                  <div>
                                      \${doc.archivo_path ? \`
                                      <a href="/api/documentos/\${doc.id}/download" class="btn btn-info" target="_blank">
                                          📥 Descargar
                                      </a>
                                      \` : \`
                                      <span class="btn" style="background: #ccc; color: #666;">📄 Sin archivo</span>
                                      \`}
                                  </div>
                              </div>
                              
                              \${Array.isArray(keywords) && keywords.length > 0 ? \`
                              <div class="keywords-section">
                                  <h5>🏷️ Palabras Clave Identificadas:</h5>
                                  \${keywords.map(keyword => \`<span class="keyword-tag">\${keyword}</span>\`).join('')}
                              </div>
                              \` : ''}
                              
                              \${Array.isArray(recomendaciones) && recomendaciones.length > 0 ? \`
                              <div class="recommendations">
                                  <h5>💡 Documentos Relacionados:</h5>
                                  <ul>
                                      \${recomendaciones.map(rec => \`
                                          <li>
                                              <a href="/api/documentos/\${rec.id}/download" target="_blank">
                                                  \${rec.titulo}
                                              </a> 
                                              (Similaridad: \${Math.round(rec.similarity * 100)}%)
                                          </li>
                                      \`).join('')}
                                  </ul>
                              </div>
                              \` : ''}
                              
                              \${!doc.contenido_texto ? \`
                              <div style="margin-top: 1rem; padding: 0.5rem; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; color: #856404;">
                                  ⚠️ Este documento no ha sido procesado con análisis NLP
                              </div>
                              \` : ''}
                          </div>
                      \`;
                  } catch (error) {
                      console.error('Error generando card para documento', doc?.id, ':', error);
                      return \`
                          <div class="document-card" style="border-left-color: #dc3545;">
                              <p>❌ Error mostrando documento: \${doc?.titulo || 'Sin título'}</p>
                              <small>ID: \${doc?.id}</small>
                          </div>
                      \`;
                  }
              }

              // Mostrar alertas
              function showAlert(message, type) {
                  const container = document.getElementById('alertContainer');
                  const alert = document.createElement('div');
                  alert.className = \`alert alert-\${type}\`;
                  alert.innerHTML = message;
                  
                  container.appendChild(alert);
                  
                  // Auto-remover después de 5 segundos
                  setTimeout(() => {
                      if (alert.parentNode) {
                          alert.remove();
                      }
                  }, 5000);
              }

              // Búsqueda en tiempo real
              document.getElementById('searchInput').addEventListener('input', function(e) {
                  const searchTerm = e.target.value.toLowerCase();
                  const cards = document.querySelectorAll('.document-card');
                  
                  cards.forEach(card => {
                      const text = card.textContent.toLowerCase();
                      if (text.includes(searchTerm)) {
                          card.style.display = 'block';
                      } else {
                          card.style.display = 'none';
                      }
                  });
              });

              // Inicializar página
              document.addEventListener('DOMContentLoaded', function() {
                  console.log('DOM cargado, inicializando...');
                  
                  // Solo cargar comisiones si el usuario puede subir documentos
                  ${permisos.subir_documentos ? 'loadComisiones();' : ''}
                  
                  // Siempre cargar documentos
                  loadDocuments();
                  
                  console.log('Inicialización completada');
              });
          </script>
      </body>
      </html>
    `);
    } catch (error) {
      console.error('Error generando página de documentos:', error);
      res.status(500).send('Error interno del servidor');
    }
  }

  // Obtener lista de documentos
static async getDocumentos(req, res) {
  try {
    const result = await query(`
      SELECT 
        d.*,
        c.nombre as nombre_comision, 
        u.nombre as nombre_usuario
      FROM documentos d
      LEFT JOIN comisiones c ON d.comision_id = c.id
      LEFT JOIN usuarios u ON d.usuario_creador_id = u.id
      ORDER BY d.created_at DESC
    `);

    // Procesar resultados para manejar campos JSON nulos
    const documentosProcessed = result.rows.map(doc => ({
      ...doc,
      palabras_clave: doc.palabras_clave || '[]',
      analisis_nlp: doc.analisis_nlp || '{}',
      recomendaciones: doc.recomendaciones || '[]'
    }));

    res.json(documentosProcessed);
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ error: 'Error obteniendo documentos' });
  }
}

  // Subir documento con análisis NLP
  static async uploadDocumento(req, res) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const { titulo, remitente, comision_id } = req.body;
      const archivo = req.file;

      if (!archivo) {
        throw new Error('No se ha subido ningún archivo');
      }

      if (!titulo) {
        throw new Error('El título es obligatorio');
      }

      // Extraer texto del PDF
      const pdfPath = archivo.path;
      const dataBuffer = fs.readFileSync(pdfPath);
      const pdfData = await pdf(dataBuffer);
      const contenidoTexto = pdfData.text;

      // Análisis NLP
      const palabrasClave = await DocumentController.extractKeywords(contenidoTexto);
      const analisisNLP = await DocumentController.analyzeDocument(contenidoTexto);

      // Insertar documento en la base de datos
      const documentResult = await client.query(`
        INSERT INTO documentos (
          titulo, remitente, fecha_ingreso, comision_id, usuario_creador_id,
          archivo_path, contenido_texto, palabras_clave, analisis_nlp
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        titulo,
        remitente || null,
        comision_id || null,
        req.session.usuario.id,
        pdfPath,
        contenidoTexto,
        JSON.stringify(palabrasClave),
        JSON.stringify(analisisNLP)
      ]);

      const nuevoDocumento = documentResult.rows[0];

      // Buscar documentos similares
      const recomendaciones = await DocumentController.findSimilarDocuments(
        nuevoDocumento.id,
        contenidoTexto,
        palabrasClave
      );

      // Actualizar documento con recomendaciones
      await client.query(`
        UPDATE documentos 
        SET recomendaciones = $1 
        WHERE id = $2
      `, [JSON.stringify(recomendaciones), nuevoDocumento.id]);

      await client.query('COMMIT');

      console.log(`✅ Documento subido: ${titulo} por ${req.session.usuario.nombre}`);
      
      res.json({
        success: true,
        documento: nuevoDocumento,
        palabras_clave: palabrasClave,
        recomendaciones: recomendaciones,
        analisis: analisisNLP
      });

    } catch (error) {
      await client.query('ROLLBACK');
      
      // Eliminar archivo si hubo error
      if (req.file && req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (deleteError) {
          console.error('Error eliminando archivo:', deleteError);
        }
      }

      console.error('Error subiendo documento:', error);
      res.status(500).json({ 
        error: 'Error subiendo documento',
        details: error.message 
      });
    } finally {
      client.release();
    }
  }

  // Descargar documento
  static async downloadDocumento(req, res) {
    try {
      const { id } = req.params;
      
      const result = await query(`
        SELECT titulo, archivo_path 
        FROM documentos 
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      const documento = result.rows[0];
      const filePath = documento.archivo_path;

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo físico no encontrado' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${documento.titulo}.pdf"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Error descargando documento:', error);
      res.status(500).json({ error: 'Error descargando documento' });
    }
  }

  // Extraer palabras clave usando NLP
  static async extractKeywords(texto) {
    try {
      // Limpiar y tokenizar texto
      const textoLimpio = texto.toLowerCase()
        .replace(/[^\w\sáéíóúüñ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Palabras comunes en español a filtrar
      const stopWords = new Set([
        'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 
        'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los',
        'las', 'una', 'como', 'pero', 'sus', 'han', 'ya', 'o', 'si', 'más',
        'este', 'esta', 'ese', 'esa', 'esto', 'eso', 'ser', 'estar', 'tener',
        'hacer', 'todo', 'todos', 'toda', 'todas', 'otro', 'otra', 'otros', 'otras'
      ]);

      const tokens = natural.WordTokenizer().tokenize(textoLimpio);
      
      // Filtrar palabras y calcular frecuencias
      const wordFreq = {};
      tokens.forEach(token => {
        if (token.length > 3 && !stopWords.has(token) && isNaN(token)) {
          // CORREGIDO: Usar PorterStemmer en lugar de método stem() directo
          const stemmed = natural.PorterStemmer.stem(token);
          wordFreq[stemmed] = (wordFreq[stemmed] || 0) + 1;
        }
      });

      // Obtener las 10 palabras más frecuentes
      const keywords = Object.entries(wordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([word]) => word);

      return keywords;
    } catch (error) {
      console.error('Error extrayendo palabras clave:', error);
      return [];
    }
  }

  // Analizar documento con NLP
  static async analyzeDocument(texto) {
    try {
      // CORREGIDO: El SentimentAnalyzer requiere un array de tokens stemmed
      const tokens = natural.WordTokenizer().tokenize(texto.toLowerCase());
      const stemmedTokens = tokens.map(token => natural.PorterStemmer.stem(token));
      
      const analisis = {
        longitud_caracteres: texto.length,
        longitud_palabras: tokens.length,
        longitud_oraciones: texto.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
        sentiment: natural.SentimentAnalyzer.getSentiment(stemmedTokens),
        complejidad: this.calculateComplexity(texto),
        temas_detectados: await this.detectTopics(texto)
      };

      return analisis;
    } catch (error) {
      console.error('Error analizando documento:', error);
      return {
        longitud_caracteres: texto.length,
        longitud_palabras: texto.split(/\s+/).length,
        longitud_oraciones: texto.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
        sentiment: 0,
        complejidad: { score: 0 },
        temas_detectados: []
      };
    }
  }

  // Calcular complejidad del texto
  static calculateComplexity(texto) {
    const palabras = texto.split(/\s+/).filter(p => p.trim().length > 0);
    const oraciones = texto.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (oraciones.length === 0 || palabras.length === 0) {
      return { score: 0, palabras_por_oracion: 0, caracteres_por_palabra: 0 };
    }
    
    const promedioPalabrasPorOracion = palabras.length / oraciones.length;
    const promedioCaracteresPorPalabra = texto.length / palabras.length;
    
    // Índice de complejidad simple
    const complejidad = (promedioPalabrasPorOracion * promedioCaracteresPorPalabra) / 100;
    
    return {
      score: Math.min(complejidad, 10), // Escala de 0 a 10
      palabras_por_oracion: promedioPalabrasPorOracion,
      caracteres_por_palabra: promedioCaracteresPorPalabra
    };
  }

  // Detectar temas principales
  static async detectTopics(texto) {
    try {
      // Palabras clave relacionadas con temas universitarios
      const temasUniversitarios = {
        'academico': ['académico', 'academico', 'currículo', 'curriculo', 'materia', 'asignatura', 'calificación', 'evaluación'],
        'administrativo': ['administrativo', 'administración', 'gestión', 'proceso', 'tramite', 'solicitud'],
        'investigación': ['investigación', 'investigacion', 'proyecto', 'estudio', 'análisis', 'metodología'],
        'estudiantil': ['estudiante', 'estudiantil', 'alumno', 'beca', 'matricula', 'inscripción'],
        'infraestructura': ['infraestructura', 'edificio', 'construcción', 'mantenimiento', 'equipamiento'],
        'normativo': ['reglamento', 'norma', 'resolución', 'decreto', 'estatuto', 'disposición']
      };

      const textoLower = texto.toLowerCase();
      const temasDetectados = [];

      for (const [tema, palabras] of Object.entries(temasUniversitarios)) {
        let coincidencias = 0;
        palabras.forEach(palabra => {
          coincidencias += (textoLower.match(new RegExp(palabra, 'g')) || []).length;
        });
        
        if (coincidencias > 0) {
          temasDetectados.push({
            tema: tema,
            relevancia: coincidencias,
            palabras_encontradas: palabras.filter(p => textoLower.includes(p))
          });
        }
      }

      return temasDetectados.sort((a, b) => b.relevancia - a.relevancia).slice(0, 3);
    } catch (error) {
      console.error('Error detectando temas:', error);
      return [];
    }
  }

  // Encontrar documentos similares
  static async findSimilarDocuments(documentoId, texto, palabrasClave) {
    try {
      const result = await query(`
        SELECT id, titulo, palabras_clave, contenido_texto
        FROM documentos 
        WHERE id != $1 AND contenido_texto IS NOT NULL
        LIMIT 20
      `, [documentoId]);

      const documentosSimilares = [];

      for (const doc of result.rows) {
        const otrasClaves = doc.palabras_clave ? JSON.parse(doc.palabras_clave) : [];
        const similarity = this.calculateSimilarity(palabrasClave, otrasClaves, texto, doc.contenido_texto);
        
        if (similarity > 0.3) { // Umbral de similitud del 30%
          documentosSimilares.push({
            id: doc.id,
            titulo: doc.titulo,
            similarity: similarity
          });
        }
      }

      return documentosSimilares
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5); // Top 5 documentos similares
        
    } catch (error) {
      console.error('Error buscando documentos similares:', error);
      return [];
    }
  }

  // Calcular similitud entre documentos
  static calculateSimilarity(keywords1, keywords2, texto1, texto2) {
    try {
      // Verificar que tengamos arrays válidos
      if (!Array.isArray(keywords1)) keywords1 = [];
      if (!Array.isArray(keywords2)) keywords2 = [];
      
      // Similitud basada en palabras clave
      const intersection = keywords1.filter(k => keywords2.includes(k));
      const union = [...new Set([...keywords1, ...keywords2])];
      const keywordSimilarity = union.length > 0 ? intersection.length / union.length : 0;

      // Similitud basada en texto usando distancia de Jaccard
      const tokens1 = new Set(natural.WordTokenizer().tokenize(texto1.toLowerCase()));
      const tokens2 = new Set(natural.WordTokenizer().tokenize(texto2.toLowerCase()));
      
      const tokenIntersection = [...tokens1].filter(t => tokens2.has(t));
      const tokenUnion = new Set([...tokens1, ...tokens2]);
      const textSimilarity = tokenUnion.size > 0 ? tokenIntersection.length / tokenUnion.size : 0;

      // Promedio ponderado (70% palabras clave, 30% contenido)
      return (keywordSimilarity * 0.7) + (textSimilarity * 0.3);
      
    } catch (error) {
      console.error('Error calculando similitud:', error);
      return 0;
    }
  }
}

module.exports = DocumentController;