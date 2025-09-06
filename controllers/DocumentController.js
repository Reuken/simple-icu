// controllers/DocumentController.js
const { query, getClient } = require('../config/database');
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const natural = require('natural');
const { PorterStemmerEs } = require('natural');
const Tesseract = require('tesseract.js');
const pdf2pic = require('pdf2pic');
const sharp = require('sharp');
const sentimentAnalyzer = new natural.SentimentAnalyzer('Spanish', PorterStemmerEs, 'afinn');

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
                
                .progress-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }

                .progress-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    min-width: 400px;
                    max-width: 500px;
                    text-align: center;
                }

                .progress-bar-container {
                    width: 100%;
                    height: 20px;
                    background-color: #e9ecef;
                    border-radius: 10px;
                    margin: 1rem 0;
                    overflow: hidden;
                    position: relative;
                }

                .progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #007BFF, #28a745);
                    border-radius: 10px;
                    width: 0%;
                    transition: width 0.5s ease;
                    position: relative;
                }

                .progress-bar::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(45deg, 
                        transparent 35%, 
                        rgba(255, 255, 255, 0.5) 50%, 
                        transparent 65%
                    );
                    animation: shimmer 1.5s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .progress-text {
                    font-size: 1.1rem;
                    color: #333;
                    margin-bottom: 0.5rem;
                    font-weight: 500;
                }

                .progress-percentage {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #007BFF;
                    margin: 0.5rem 0;
                }

                .progress-step {
                    font-size: 0.9rem;
                    color: #666;
                    margin-top: 0.5rem;
                    font-style: italic;
                }

                .success-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1001;
                }

                .success-content {
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    min-width: 350px;
                    text-align: center;
                    border-top: 5px solid #28a745;
                }

                .success-icon {
                    font-size: 3rem;
                    color: #28a745;
                    margin-bottom: 1rem;
                }

                .spinner {
                    border: 3px solid #f3f3f3;
                    border-top: 3px solid #007BFF;
                    border-radius: 50%;
                    width: 30px;
                    height: 30px;
                    animation: spin 1s linear infinite;
                    margin: 1rem auto;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
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
                .processing-info {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    color: #856404;
                    padding: 0.75rem;
                    border-radius: 4px;
                    margin-top: 1rem;
                    font-size: 0.9rem;
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
                    <p>Sistema de documentos con análisis inteligente de contenido y OCR</p>
                </div>

                ${permisos.subir_documentos ? `
                <div class="upload-section">
                    <h3>📤 Subir Nuevo Documento</h3>
                    <div class="processing-info">
                        <strong>ℹ️ Información:</strong> Los PDFs escaneados serán procesados automáticamente con OCR para extraer texto.
                        El procesamiento puede tomar unos minutos dependiendo del tamaño del documento.
                    </div>
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
                            <p>🔄 Haz clic aquí para seleccionar un archivo</p>
                            <p><small>Máximo 10MB - PDF, imágenes (JPG, PNG, TIFF)</small></p>
                            <input type="file" id="archivo" name="archivo" accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp" class="hidden" onchange="updateFileName(this)">
                        </div>
                        <div id="fileName" style="margin: 1rem 0; font-style: italic;"></div>
                        <button type="submit" class="btn btn-primary">📤 Subir Documento</button>
                    </form>
                    <div id="processingStatus" class="hidden processing-info">
                        <div id="processingMessage">🔄 Procesando documento...</div>
                        <div id="processingDetails"></div>
                    </div>
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
                        const file = input.files[0];
                        const fileType = file.type.includes('pdf') ? '📄 PDF' : 
                                        file.type.includes('image') ? '🖼️ Imagen' : '📁 Archivo';
                        fileName.innerHTML = \`\${fileType} seleccionado: <strong>\${file.name}</strong> (\${(file.size/1024/1024).toFixed(2)} MB)\`;
                    } else {
                        fileName.textContent = '';
                    }
                }

              // Subir documento con monitoreo de progreso
              document.getElementById('uploadForm')?.addEventListener('submit', async function(e) {
                  e.preventDefault();
                  
                  const formData = new FormData(this);
                  const submitBtn = this.querySelector('button[type="submit"]');
                  const processingStatus = document.getElementById('processingStatus');
                  const processingMessage = document.getElementById('processingMessage');
                  const processingDetails = document.getElementById('processingDetails');
                  
                  // Validar que se seleccionó un archivo
                  if (!formData.get('archivo') || formData.get('archivo').size === 0) {
                      showAlert('⚠️ Por favor selecciona un archivo', 'error');
                      return;
                  }
                  
                  const file = formData.get('archivo');
                  const isScannedPDF = file.type === 'application/pdf';
                  const isImage = file.type.startsWith('image/');
                  
                  submitBtn.disabled = true;
                  submitBtn.textContent = '📤 Subiendo...';
                  processingStatus.classList.remove('hidden');
                  
                  // Mostrar mensaje apropiado según el tipo de archivo
                  if (isScannedPDF) {
                      processingMessage.textContent = '🔄 Subiendo PDF... Se aplicará OCR si es necesario';
                      processingDetails.textContent = 'Esto puede tomar varios minutos para PDFs escaneados';
                  } else if (isImage) {
                      processingMessage.textContent = '🖼️ Subiendo imagen... Aplicando OCR';
                      processingDetails.textContent = 'Extrayendo texto de la imagen';
                  }
                  
                  try {
                      const response = await fetch('/api/documentos', {
                          method: 'POST',
                          body: formData
                      });
                      
                      const result = await response.json();
                      
                      if (response.ok) {
                          showAlert('✅ Documento procesado exitosamente con análisis NLP' + 
                                  (result.ocr_aplicado ? ' y OCR' : ''), 'success');
                          this.reset();
                          document.getElementById('fileName').textContent = '';
                          
                          // Mostrar información adicional del procesamiento
                          if (result.ocr_aplicado) {
                              showAlert('🔍 OCR aplicado: ' + result.texto_extraido_length + ' caracteres extraídos', 'success');
                          }
                          if (result.palabras_clave && result.palabras_clave.length > 0) {
                              showAlert('🏷️ Palabras clave identificadas: ' + result.palabras_clave.slice(0, 5).join(', '), 'success');
                          }
                          
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
                      processingStatus.classList.add('hidden');
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
                      let processingInfo = '';
                      
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
                      
                      // Determinar si se aplicó OCR
                      if (doc.metadatos_procesamiento) {
                          try {
                              const metadatos = typeof doc.metadatos_procesamiento === 'string' 
                                  ? JSON.parse(doc.metadatos_procesamiento) 
                                  : doc.metadatos_procesamiento;
                              if (metadatos.ocr_aplicado) {
                                  processingInfo = '<div style="margin-top: 0.5rem; padding: 0.5rem; background: #e8f4fd; border-radius: 4px; font-size: 0.8rem;">🔍 Procesado con OCR</div>';
                              }
                          } catch (e) {
                              console.warn('Error parseando metadatos para doc', doc.id);
                          }
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
                              \` : processingInfo}
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
                  
                  // Auto-remover después de 8 segundos (más tiempo para OCR info)
                  setTimeout(() => {
                      if (alert.parentNode) {
                          alert.remove();
                      }
                  }, 8000);
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
      recomendaciones: doc.recomendaciones || '[]',
      metadatos_procesamiento: doc.metadatos_procesamiento || '{}'
    }));

    res.json(documentosProcessed);
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({ error: 'Error obteniendo documentos' });
  }
}

  // Crear directorio temporal si no existe
  static ensureTempDir() {
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('📁 Directorio temp creado');
    }
  }

  // Función principal para procesar archivos con OCR
  static async procesarArchivoConOCR(archivoPath, tipoArchivo) {
    try {
      console.log(`🔍 Procesando archivo: ${tipoArchivo}`);
      
      let contenidoTexto = '';
      let ocrAplicado = false;
      let metadatos = {
        tipo_archivo: tipoArchivo,
        ocr_aplicado: false,
        metodo_extraccion: 'nativo',
        caracteres_extraidos: 0,
        paginas_procesadas: 0
      };

      if (tipoArchivo === 'application/pdf') {
        // Procesar PDF
        const resultado = await this.procesarPDFConOCR(archivoPath);
        contenidoTexto = resultado.texto;
        metadatos = { ...metadatos, ...resultado.metadatos };
        ocrAplicado = resultado.metadatos.ocr_aplicado;
      } else if (tipoArchivo.startsWith('image/')) {
        // Procesar imagen
        console.log('🖼️ Procesando imagen con OCR...');
        const resultado = await this.extraerTextoDeImagen(archivoPath);
        contenidoTexto = resultado.texto;
        metadatos = { ...metadatos, ...resultado.metadatos };
        ocrAplicado = true;
      }

      metadatos.caracteres_extraidos = contenidoTexto.length;
      
      console.log(`✅ Procesamiento completado: ${metadatos.caracteres_extraidos} caracteres extraídos`);
      
      return {
        texto: contenidoTexto,
        ocr_aplicado: ocrAplicado,
        metadatos: metadatos
      };

    } catch (error) {
      console.error('❌ Error procesando archivo:', error);
      return {
        texto: '',
        ocr_aplicado: false,
        metadatos: { error: error.message }
      };
    }
  }

  // Procesar PDF con OCR si es necesario
  static async procesarPDFConOCR(rutaArchivo) {
    try {
      console.log('📄 Procesando PDF...');
      
      // 1. Intentar extraer texto nativo primero
      const textoNativo = await this.extraerTextoNativoPDF(rutaArchivo);
      
      let metadatos = {
        metodo_extraccion: 'nativo',
        ocr_aplicado: false,
        caracteres_nativos: textoNativo.length,
        paginas_procesadas: 0
      };
      
      // 2. Si hay poco texto nativo, probablemente es escaneado
      if (textoNativo.trim().length < 100) {
        console.log('📄 PDF parece escaneado, aplicando OCR...');
        const resultadoOCR = await this.extraerTextoOCRdePDF(rutaArchivo);
        return {
          texto: resultadoOCR.texto,
          metadatos: {
            ...metadatos,
            metodo_extraccion: 'ocr',
            ocr_aplicado: true,
            paginas_procesadas: resultadoOCR.metadatos.paginas_procesadas,
            tiempo_procesamiento: resultadoOCR.metadatos.tiempo_procesamiento
          }
        };
      } else {
        console.log('📝 Texto nativo extraído exitosamente');
        return {
          texto: textoNativo,
          metadatos: metadatos
        };
      }
      
    } catch (error) {
      console.error('❌ Error procesando PDF:', error);
      // Si falla todo, intentar OCR como último recurso
      try {
        const resultadoOCR = await this.extraerTextoOCRdePDF(rutaArchivo);
        return {
          texto: resultadoOCR.texto,
          metadatos: {
            metodo_extraccion: 'ocr_fallback',
            ocr_aplicado: true,
            error_nativo: error.message,
            paginas_procesadas: resultadoOCR.metadatos.paginas_procesadas
          }
        };
      } catch (ocrError) {
        console.error('❌ OCR también falló:', ocrError);
        return {
          texto: '',
          metadatos: {
            error: `Nativo: ${error.message}, OCR: ${ocrError.message}`,
            ocr_aplicado: false,
            metodo_extraccion: 'fallido'
          }
        };
      }
    }
  }

  // Extraer texto nativo del PDF
  static async extraerTextoNativoPDF(rutaArchivo) {
    try {
      const buffer = fs.readFileSync(rutaArchivo);
      const data = await pdf(buffer);
      return data.text || '';
    } catch (error) {
      console.warn('⚠️ Falló extracción nativa:', error.message);
      return '';
    }
  }

  // OCR para PDFs escaneados
  static async extraerTextoOCRdePDF(rutaArchivo) {
    const tiempoInicio = Date.now();
    
    try {
      console.log('🔧 Iniciando OCR para PDF escaneado...');
      this.ensureTempDir();
      
      // Convertir PDF a imágenes
      const convert = pdf2pic.fromPath(rutaArchivo, {
        density: 300,           // DPI alta para mejor OCR
        saveFilename: "page",
        savePath: "./temp/",
        format: "png",
        width: 2000,
        height: 2800
      });
      
      // Procesar cada página
      let textoCompleto = '';
      let pagina = 1;
      let hayMasPaginas = true;
      let paginasProcesadas = 0;
      
      while (hayMasPaginas && pagina <= 20) { // Límite de 20 páginas
        try {
          console.log(`📄 Procesando página ${pagina}...`);
          
          const resultado = await convert(pagina);
          
          if (resultado && resultado.path) {
            // Mejorar imagen antes del OCR
            const imagenMejorada = await this.mejorarImagenParaOCR(resultado.path);
            
            // Aplicar OCR
            const { data: { text } } = await Tesseract.recognize(imagenMejorada, 'spa', {
              logger: m => {
                if (m.status === 'recognizing text') {
                  console.log(`OCR página ${pagina}: ${Math.round(m.progress * 100)}%`);
                }
              }
            });
            
            if (text.trim()) {
              textoCompleto += `\n--- PÁGINA ${pagina} ---\n${text.trim()}\n`;
              paginasProcesadas++;
            }
            
            // Limpiar archivos temporales
            this.limpiarArchivo(resultado.path);
            this.limpiarArchivo(imagenMejorada);
            
            pagina++;
          } else {
            hayMasPaginas = false;
          }
          
        } catch (paginaError) {
          console.warn(`⚠️ Error procesando página ${pagina}: ${paginaError.message}`);
          hayMasPaginas = false;
        }
      }
      
      const tiempoTotal = Date.now() - tiempoInicio;
      console.log(`✅ OCR completado. ${paginasProcesadas} páginas procesadas en ${tiempoTotal}ms`);
      
      return {
        texto: textoCompleto.trim(),
        metadatos: {
          paginas_procesadas: paginasProcesadas,
          tiempo_procesamiento: tiempoTotal
        }
      };
      
    } catch (error) {
      console.error('❌ Error en OCR de PDF:', error);
      return {
        texto: '',
        metadatos: {
          error: error.message,
          paginas_procesadas: 0,
          tiempo_procesamiento: Date.now() - tiempoInicio
        }
      };
    }
  }

  // Extraer texto de imagen
  static async extraerTextoDeImagen(rutaImagen) {
    const tiempoInicio = Date.now();
    
    try {
      console.log('🖼️ Aplicando OCR a imagen...');
      this.ensureTempDir();
      
      // Mejorar imagen para OCR
      const imagenMejorada = await this.mejorarImagenParaOCR(rutaImagen);
      
      // Aplicar OCR
      const { data: { text } } = await Tesseract.recognize(imagenMejorada, 'spa', {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR imagen: ${Math.round(m.progress * 100)}%`);
          }
        }
      });
      
      // Limpiar archivo temporal si es diferente al original
      if (imagenMejorada !== rutaImagen) {
        this.limpiarArchivo(imagenMejorada);
      }
      
      const tiempoTotal = Date.now() - tiempoInicio;
      console.log(`✅ OCR de imagen completado en ${tiempoTotal}ms`);
      
      return {
        texto: text.trim(),
        metadatos: {
          tiempo_procesamiento: tiempoTotal,
          ocr_aplicado: true
        }
      };
      
    } catch (error) {
      console.error('❌ Error en OCR de imagen:', error);
      return {
        texto: '',
        metadatos: {
          error: error.message,
          tiempo_procesamiento: Date.now() - tiempoInicio
        }
      };
    }
  }

  // Mejorar imagen para mejor OCR
  static async mejorarImagenParaOCR(rutaImagen) {
    try {
      const imagenMejorada = `${rutaImagen}_enhanced.png`;
      
      await sharp(rutaImagen)
        .grayscale()                    // Escala de grises
        .normalize()                    // Normalizar contraste
        .sharpen()                      // Aumentar nitidez
        .threshold(128)                 // Binarizar (blanco/negro)
        .png({ quality: 100 })
        .toFile(imagenMejorada);
      
      return imagenMejorada;
    } catch (error) {
      console.warn('⚠️ Error mejorando imagen, usando original:', error.message);
      return rutaImagen;
    }
  }

  // Limpiar archivo temporal
  static limpiarArchivo(rutaArchivo) {
    try {
      if (fs.existsSync(rutaArchivo)) {
        fs.unlinkSync(rutaArchivo);
      }
    } catch (error) {
      console.warn('⚠️ Error eliminando archivo temporal:', rutaArchivo, error.message);
    }
  }

  // Subir documento con análisis NLP y OCR
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

      console.log(`📤 Procesando documento: ${titulo} (${archivo.mimetype})`);

      // Procesar archivo con OCR si es necesario
      const resultadoProcesamiento = await DocumentController.procesarArchivoConOCR(
        archivo.path, 
        archivo.mimetype
      );

      const contenidoTexto = resultadoProcesamiento.texto;
      const ocrAplicado = resultadoProcesamiento.ocr_aplicado;
      const metadatosProcesamiento = resultadoProcesamiento.metadatos;

      console.log(`📝 Texto extraído: ${contenidoTexto.length} caracteres`);

      // Análisis NLP solo si hay contenido de texto suficiente
      let palabrasClave = [];
      let analisisNLP = {};
      
      if (contenidoTexto && contenidoTexto.trim().length > 50) {
        console.log('🧠 Aplicando análisis NLP...');
        palabrasClave = await DocumentController.extractKeywords(contenidoTexto);
        analisisNLP = await DocumentController.analyzeDocument(contenidoTexto);
        
        console.log(`🏷️ Palabras clave extraídas: ${palabrasClave.length}`);
      } else {
        console.warn('⚠️ Texto insuficiente para análisis NLP');
        analisisNLP = {
          longitud_caracteres: contenidoTexto.length,
          longitud_palabras: 0,
          longitud_oraciones: 0,
          sentiment: 0,
          complejidad: { score: 0 },
          temas_detectados: [],
          procesamiento_limitado: true
        };
      }

      // Insertar documento en la base de datos
      const documentResult = await client.query(`
        INSERT INTO documentos (
          titulo, remitente, fecha_ingreso, comision_id, usuario_creador_id,
          archivo_path, contenido_texto, palabras_clave, analisis_nlp, metadatos_procesamiento
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        titulo,
        remitente || null,
        comision_id || null,
        req.session.usuario.id,
        archivo.path,
        contenidoTexto,
        JSON.stringify(palabrasClave),
        JSON.stringify(analisisNLP),
        JSON.stringify(metadatosProcesamiento)
      ]);

      const nuevoDocumento = documentResult.rows[0];

      // Buscar documentos similares solo si hay palabras clave
      let recomendaciones = [];
      if (palabrasClave.length > 0 && contenidoTexto.trim().length > 100) {
        console.log('🔍 Buscando documentos similares...');
        recomendaciones = await DocumentController.findSimilarDocuments(
          nuevoDocumento.id,
          contenidoTexto,
          palabrasClave
        );
        console.log(`💡 Documentos similares encontrados: ${recomendaciones.length}`);
      }

      // Actualizar documento con recomendaciones
      if (recomendaciones.length > 0) {
        await client.query(`
          UPDATE documentos 
          SET recomendaciones = $1 
          WHERE id = $2
        `, [JSON.stringify(recomendaciones), nuevoDocumento.id]);
      }

      await client.query('COMMIT');

      console.log(`✅ Documento subido: ${titulo} por ${req.session.usuario.nombre}`);
      console.log(`🔍 OCR aplicado: ${ocrAplicado ? 'Sí' : 'No'}`);
      
      res.json({
        success: true,
        documento: nuevoDocumento,
        palabras_clave: palabrasClave,
        recomendaciones: recomendaciones,
        analisis: analisisNLP,
        ocr_aplicado: ocrAplicado,
        texto_extraido_length: contenidoTexto.length,
        metadatos_procesamiento: metadatosProcesamiento
      });

    } catch (error) {
      await client.query('ROLLBACK');
      
      // Eliminar archivo si hubo error
      if (req.file && req.file.path) {
        this.limpiarArchivo(req.file.path);
      }

      console.error('❌ Error subiendo documento:', error);
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

      // Determinar tipo de contenido según extensión
      const extension = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      
      if (extension === '.pdf') {
        contentType = 'application/pdf';
      } else if (['.jpg', '.jpeg'].includes(extension)) {
        contentType = 'image/jpeg';
      } else if (extension === '.png') {
        contentType = 'image/png';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${documento.titulo}${extension}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      console.error('Error descargando documento:', error);
      res.status(500).json({ error: 'Error descargando documento' });
    }
  }

  // Extraer palabras clave usando NLP (mejorado)
  static async extractKeywords(texto) {
    try {
      // Limpiar y tokenizar texto
      const textoLimpio = texto.toLowerCase()
        .replace(/[^\w\sáéíóúüñ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Palabras comunes en español a filtrar (expandidas)
      const stopWords = new Set([
        'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 
        'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los',
        'las', 'una', 'como', 'pero', 'sus', 'han', 'ya', 'o', 'si', 'más',
        'este', 'esta', 'ese', 'esa', 'esto', 'eso', 'ser', 'estar', 'tener',
        'hacer', 'todo', 'todos', 'toda', 'todas', 'otro', 'otra', 'otros', 'otras',
        'muy', 'también', 'hasta', 'desde', 'cuando', 'donde', 'cual', 'cuales',
        'quien', 'quienes', 'cómo', 'qué', 'página', 'páginas', 'documento', 'texto',
        'archivo', 'parte', 'partes', 'siguiente', 'anterior', 'arriba', 'abajo',
        'izquierda', 'derecha', 'ver', 'viene', 'va', 'puede', 'debe', 'tiene',
        'mediante', 'través', 'acerca', 'sobre', 'bajo', 'entre', 'durante', 'culo',
      ]);

      const tokens = new natural.WordTokenizer().tokenize(textoLimpio);
      
      // Filtrar palabras y calcular frecuencias
      const wordFreq = {};
      tokens.forEach(token => {
        if (token.length > 3 && !stopWords.has(token) && isNaN(token)) {
          const stemmed = natural.PorterStemmer.stem(token);
          wordFreq[stemmed] = (wordFreq[stemmed] || 0) + 1;
        }
      });

      // Obtener las palabras más frecuentes
      const keywords = Object.entries(wordFreq)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 15)  // Aumentado a 15 para mejor análisis
        .map(([word]) => word);

      console.log(`🏷️ Keywords extraídos: ${keywords.length} de ${Object.keys(wordFreq).length} únicos`);
      return keywords;
      
    } catch (error) {
      console.error('❌ Error extrayendo palabras clave:', error);
      return [];
    }
  }

  // Analizar documento con NLP (mejorado)
  static async analyzeDocument(texto) {
    try {
      const tokens = new natural.WordTokenizer().tokenize(texto.toLowerCase());
      const stemmedTokens = tokens.map(token => PorterStemmerEs.stem(token));
      
      const analisis = {
        longitud_caracteres: texto.length,
        longitud_palabras: tokens.length,
        longitud_oraciones: texto.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
        sentiment: sentimentAnalyzer.getSentiment(stemmedTokens), 
        complejidad: this.calculateComplexity(texto),
        temas_detectados: await this.detectTopics(texto),
        procesado_con_ocr: true,
        calidad_texto: this.evaluarCalidadTexto(texto)
      };

      console.log(`🧠 Análisis NLP completado - Sentiment: ${analisis.sentiment}, Complejidad: ${analisis.complejidad.score}`);
      return analisis;
      
    } catch (error) {
      console.error('❌ Error analizando documento:', error);
      return {
        longitud_caracteres: texto.length,
        longitud_palabras: texto.split(/\s+/).length,
        longitud_oraciones: texto.split(/[.!?]+/).filter(s => s.trim().length > 0).length,
        sentiment: 0,
        complejidad: { score: 0 },
        temas_detectados: [],
        error: error.message
      };
    }
  }

  // Evaluar calidad del texto extraído
  static evaluarCalidadTexto(texto) {
    const palabras = texto.split(/\s+/).filter(p => p.trim().length > 0);
    const lineas = texto.split('\n').filter(l => l.trim().length > 0);
    
    // Detectar patrones de OCR problemático
    const caracteresRaros = (texto.match(/[^\w\sáéíóúñ.,;:()¿?¡!\-]/g) || []).length;
    const palabrasCortas = palabras.filter(p => p.length < 3).length;
    const numerosAislados = (texto.match(/\b\d\b/g) || []).length;
    
    const ratioCaracteresRaros = caracteresRaros / texto.length;
    const ratioPalabrasCortas = palabrasCortas / palabras.length;
    const ratioNumerosAislados = numerosAislados / palabras.length;
    
    let calidadScore = 1.0;
    calidadScore -= ratioCaracteresRaros * 2; // Penalizar caracteres raros
    calidadScore -= ratioPalabrasCortas * 0.5; // Penalizar muchas palabras cortas
    calidadScore -= ratioNumerosAislados * 0.3; // Penalizar números aislados
    
    return {
      score: Math.max(0, Math.min(1, calidadScore)),
      caracteres_raros: caracteresRaros,
      palabras_cortas: palabrasCortas,
      numeros_aislados: numerosAislados,
      lineas_procesadas: lineas.length
    };
  }

  // Calcular complejidad del texto (mejorado)
  static calculateComplexity(texto) {
    const palabras = texto.split(/\s+/).filter(p => p.trim().length > 0);
    const oraciones = texto.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (oraciones.length === 0 || palabras.length === 0) {
      return { score: 0, palabras_por_oracion: 0, caracteres_por_palabra: 0 };
    }
    
    const promedioPalabrasPorOracion = palabras.length / oraciones.length;
    const promedioCaracteresPorPalabra = texto.length / palabras.length;
    
    // Factores adicionales de complejidad
    const palabrasLargas = palabras.filter(p => p.length > 7).length;
    const ratioPalabrasLargas = palabrasLargas / palabras.length;
    
    // Índice de complejidad mejorado
    const complejidadBase = (promedioPalabrasPorOracion * promedioCaracteresPorPalabra) / 100;
    const bonificacionComplejidad = ratioPalabrasLargas * 2;
    const complejidad = complejidadBase + bonificacionComplejidad;
    
    return {
      score: Math.min(complejidad, 10), // Escala de 0 a 10
      palabras_por_oracion: Math.round(promedioPalabrasPorOracion * 100) / 100,
      caracteres_por_palabra: Math.round(promedioCaracteresPorPalabra * 100) / 100,
      ratio_palabras_largas: Math.round(ratioPalabrasLargas * 100) / 100
    };
  }

  // Detectar temas principales (mejorado)
  static async detectTopics(texto) {
    try {
      // Palabras clave relacionadas con temas universitarios (expandido)
      const temasUniversitarios = {
        'académico': [
          'académico', 'academico', 'asignatura', 'asignaturas', 'materia', 'Facultad', 
          'resolución', 'resolucion', 'evaluación', 'evaluacion', 'Decanato', 'parcial',
          'final', 'nota', 'reglamento', 'rendimiento', 'icu', 'ICU', 'Estatuto', 'DICAA'
        ],
        'administrativo': [
          'administrativo', 'administración', 'administracion', 'gestión', 'gestion', 
          'proceso', 'trámite', 'tramite', 'solicitud', 'Rectorado', 'requisito',
          'documentación', 'documentacion', 'Vicerrectorado', 'registro'
        ],
        'investigación': [
          'investigación', 'investigacion', 'proyecto', 'estudio', 'análisis', 'analisis',
          'metodología', 'metodologia', 'tesis', 'monografía', 'monografia', 'paper',
          'publicación', 'publicacion', 'revista', 'congreso', 'simposio'
        ],
        'estudiantil': [
          'estudiante', 'estudiantil', 'alumno', 'beca', 'matricula', 'matrícula',
          'inscripción', 'inscripcion', 'carrera', 'semestre', 'periodo', 'curso',
          'graduación', 'graduacion', 'titulación', 'titulacion'
        ],
        'infraestructura': [
          'infraestructura', 'edificio', 'construcción', 'construccion', 'mantenimiento',
          'equipamiento', 'laboratorio', 'aula', 'biblioteca', 'campus', 'instalación',
          'instalacion', 'mobiliario', 'tecnología', 'tecnologia'
        ],
        'normativo': [
          'reglamento', 'norma', 'resolución', 'resolucion', 'decreto', 'estatuto',
          'disposición', 'disposicion', 'ordenanza', 'directiva', 'circular', 'ley',
          'código', 'codigo', 'marco', 'legal', 'jurídico', 'juridico'
        ],
        'financiero': [
          'presupuesto', 'financiero', 'económico', 'economico', 'costo', 'gasto',
          'inversión', 'inversion', 'financiamiento', 'recurso', 'fondo', 'partida',
          'asignación', 'asignacion', 'transferencia', 'pago'
        ],
        'personal': [
          'personal', 'docente', 'profesor', 'maestro', 'instructor', 'catedrático',
          'catedratico', 'administrativo', 'empleado', 'funcionario', 'contratación',
          'contratacion', 'nombramiento', 'designación', 'designacion'
        ]
      };

      const textoLower = texto.toLowerCase();
      const temasDetectados = [];

      for (const [tema, palabras] of Object.entries(temasUniversitarios)) {
        let coincidencias = 0;
        const palabrasEncontradas = [];
        
        palabras.forEach(palabra => {
          const matches = (textoLower.match(new RegExp(`\\b${palabra}\\b`, 'g')) || []).length;
          if (matches > 0) {
            coincidencias += matches;
            palabrasEncontradas.push(palabra);
          }
        });
        
        if (coincidencias > 0) {
          temasDetectados.push({
            tema: tema,
            relevancia: coincidencias,
            densidad: coincidencias / texto.length * 1000, // Densidad por cada 1000 caracteres
            palabras_encontradas: palabrasEncontradas.slice(0, 5) // Máximo 5 ejemplos
          });
        }
      }

      return temasDetectados
        .sort((a, b) => b.relevancia - a.relevancia)
        .slice(0, 5); // Top 5 temas
        
    } catch (error) {
      console.error('❌ Error detectando temas:', error);
      return [];
    }
  }

  // Encontrar documentos similares (arreglado)
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
        try {
          let otrasClaves = [];
          
          // **ARREGLO AQUÍ** - Validar palabras_clave de forma más robusta
          if (doc.palabras_clave) {
            try {
              // Si ya es un array, usarlo directamente
              if (Array.isArray(doc.palabras_clave)) {
                otrasClaves = doc.palabras_clave;
              }
              // Si es string, intentar parsearlo
              else if (typeof doc.palabras_clave === 'string' && doc.palabras_clave.trim() !== '') {
                const trimmed = doc.palabras_clave.trim();
                // Si parece JSON, parsearlo
                if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                  otrasClaves = JSON.parse(trimmed);
                } else {
                  // Si es texto plano, dividirlo por comas
                  otrasClaves = trimmed.split(',').map(k => k.trim()).filter(k => k);
                }
              }
              
              // Asegurar que sea array
              if (!Array.isArray(otrasClaves)) otrasClaves = [];
              
            } catch (parseError) {
              console.warn(`Error parsing keywords for document ${doc.id}: ${parseError.message}`);
              otrasClaves = [];
            }
          }

          const similarity = this.calculateSimilarity(palabrasClave, otrasClaves, texto, doc.contenido_texto);
          if (similarity > 0.2) { // Umbral de similitud del 20%
            documentosSimilares.push({
              id: doc.id,
              titulo: doc.titulo,
              similarity: similarity
            });
          }
        } catch (docError) {
          console.warn(`Error processing document ${doc.id} for similarity: ${docError.message}`);
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

  // Calcular similitud entre documentos (mejorado)
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
      const tokens1 = new Set(new natural.WordTokenizer().tokenize(texto1.toLowerCase()));
      const tokens2 = new Set(new natural.WordTokenizer().tokenize(texto2.toLowerCase()));
      
      const tokenIntersection = [...tokens1].filter(t => tokens2.has(t));
      const tokenUnion = new Set([...tokens1, ...tokens2]);
      const textSimilarity = tokenUnion.size > 0 ? tokenIntersection.length / tokenUnion.size : 0;

      // Promedio ponderado (70% palabras clave, 30% contenido)
      const similarity = (keywordSimilarity * 0.7) + (textSimilarity * 0.3);
      
      console.log(`🔍 Similitud calculada: ${Math.round(similarity * 100)}% (keywords: ${Math.round(keywordSimilarity * 100)}%, text: ${Math.round(textSimilarity * 100)}%)`);
      return similarity;
      
    } catch (error) {
      console.error('❌ Error calculando similitud:', error);
      return 0;
    }
  }
}

module.exports = DocumentController;