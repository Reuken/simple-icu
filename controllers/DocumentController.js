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
      const comisionesResult = await query('SELECT id, nombre FROM comisiones ORDER BY nombre');
      const comisiones = comisionesResult.rows;
      
      res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Gestión de Documentos - ICU</title>
            <link rel="stylesheet" href="/estilos.css">

            <style>
                /* Estilos específicos para la tabla y paginación */
                .document-table-container { margin-top: 20px; overflow-x: auto; }
                .document-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                .document-table th, .document-table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                .document-table th { background-color: #f2f2f2; }
                .pagination-controls { display: flex; justify-content: center; align-items: center; gap: 10px; margin-top: 20px; }
                .pagination-controls button { padding: 8px 15px; background-color: #333; color: white; border: none; border-radius: 5px; cursor: pointer; }
                .pagination-controls button:hover:not(:disabled) { background-color: #555; }
                .pagination-controls button:disabled { background-color: #ccc; cursor: not-allowed; }
                .search-filter-controls { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; gap: 10px; }
                .search-filter-controls input, .search-filter-controls select { flex: 1; padding: 8px; border-radius: 4px; border: 1px solid #ddd; }
                .action-buttons { display: flex; gap: 5px; }
                .action-buttons button, .action-buttons a { padding: 5px 10px; border-radius: 4px; text-decoration: none; font-size: 0.9em;}
                .view-button { background-color: #007bff; color: white; border: none; }
                .download-button { background-color: #28a745; color: white; border: none; }
                
                /* Notificacion toast */
                    .toast-notification {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 15px 25px;
                        border-radius: 8px;
                        color: white;
                        font-weight: bold;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                        z-index: 10001;
                        opacity: 0;
                        transform: translateY(-20px);
                        transition: opacity 0.3s ease, transform 0.3s ease;
                    }
                    .toast-notification.show {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    .toast-notification.success {
                        background-color: #28a745; /* Verde */
                    }
                    .toast-notification.error {
                        background-color: #dc3545; /* Rojo */
                    }
            </style>
        </head>
        <body>
            <nav>
                <a href="/dashboard" class="logo">ICU Dashboard</a>
                <div class="nav-links">
                    <a href="/dashboard">🖥️ Dashboard</a>
                    <a href="/documentos" class="active">📄 Documentos</a>
                    <span class="user-info-nav">👤 ${usuario.nombre}</span>
                    <a href="/logout" class="logout-btn">⏻️ Cerrar Sesión</a>
                </div>
            </nav>
            
            <main>
                <div class="split-container">
                  <div class="form-column">
                ${permisos.subir_documentos ? `
                    <h2>Subir Nuevo Documento</h2>
                    <form onsubmit="handleUploadSubmit(event)" enctype="multipart/form-data" class="form-container">
                        <label for="titulo">Título del documento:</label>
                        <input type="text" id="titulo" name="titulo" required>

                        <label for="remitente">Remitente:</label>
                        <input type="text" id="remitente" name="remitente" required>

                        <label for="comision_id">Comisión:</label>
                        <select id="comision_id" name="comision_id">
                            <option value="">Seleccionar comisión...</option>
                            ${comisiones.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                        </select>

                         <label for="categoria">Categoría:</label>
                            <select id="categoria" name="categoria">
                                <option value="Reglamento">Reglamento</option>
                                <option value="Resolucion">Resolución</option>
                                <option value="Informe de comision">Informe</option>
                            </select>

                        <div class="drop-area" id="drop-area">
                            <input type="file" id="archivo" name="archivo" accept="application/pdf" hidden required>
                            <p>Haz clic aquí para seleccionar un archivo PDF o arrástralo</p>
                            <p>Máximo 25MB - Solo archivos PDF</p>
                            <p id="file-name-display"></p>
                        </div>
                        <button type="submit" class="cta-button">Subir Documento</button>
                      </form>
                    </div>      
                <hr>
                ` : ''}
            <div class="list-column">
                    <h2>Documentos del Sistema</h2>
                    <div class="search-filter-controls">
                        <input type="text" id="document-search" placeholder="Buscar documentos...">
                        <select id="document-comision-filter">
                            <option value="">Todas las comisiones</option>
                            ${comisiones.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                        </select>
                        <button class="cta-button" onclick="loadDocuments()">Actualizar</button>
                    </div>

                    <div class="document-table-container">
                        <table class="document-table">
                            <thead>
                                <tr>
                                    <th>Título</th>
                                    <th>Remitente</th>
                                    <th>Comisión</th>
                                    <th>Fecha</th>
                                    <th>Subido por</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="document-list-body">
                                </tbody>
                        </table>
                    </div>

                    <div class="pagination-controls">
                        <button id="prevPage" disabled>Anterior</button>
                        <span id="pageInfo">Página 1 de 1</span>
                        <button id="nextPage" disabled>Siguiente</button>
                    </div>
                </div>
            </div>
        </div>
      </main>

            <div id="pdfModal" class="modal">
                <div class="modal-content-pdf">
                    <div class="modal-header">
                        <h2 id="pdfModalTitle">Previsualización de Documento</h2>
                        <span class="close-pdf-modal" onclick="closePdfModal()">&times;</span>
                    </div>
                    <iframe id="pdfViewer" class="pdf-iframe" frameborder="0"></iframe>
                </div>
            </div>

            <script>
            let currentPage = 1;
                let totalPages = 1;
                const documentsPerPage = 15; // Ajusta según tu preferencia

                document.addEventListener('DOMContentLoaded', () => {
                    loadDocuments();
                    setupDropArea();

                    document.getElementById('document-search').addEventListener('keypress', (e) => {
                        if (e.key === 'Enter') {
                            currentPage = 1; // Resetear a la primera página en cada nueva búsqueda
                            loadDocuments();
                        }
                    });
                    document.getElementById('document-comision-filter').addEventListener('change', () => {
                        currentPage = 1; // Resetear a la primera página en cada cambio de filtro
                        loadDocuments();
                    });
                    document.getElementById('prevPage').addEventListener('click', () => {
                        if (currentPage > 1) {
                            currentPage--;
                            loadDocuments();
                        }
                    });
                    document.getElementById('nextPage').addEventListener('click', () => {
                        if (currentPage < totalPages) {
                            currentPage++;
                            loadDocuments();
                        }
                    });
                });

                async function loadDocuments() {
                    const searchTerm = document.getElementById('document-search').value;
                    const comisionFilter = document.getElementById('document-comision-filter').value;
                    const queryString = new URLSearchParams({
                        page: currentPage,
                        limit: documentsPerPage,
                        search: searchTerm,
                        comision_id: comisionFilter
                    }).toString();

                    console.log('Actualizando lista de documentos con los parámetros:', queryString);

                    try {
                        const response = await fetch('/api/documentos?' + queryString );
                        const data = await response.json();
                        
                        const documentListBody = document.getElementById('document-list-body');
                        documentListBody.innerHTML = ''; // Limpiar la tabla

                        if (data.documents && data.documents.length > 0) {
                            data.documents.forEach(doc => {
                                const row = documentListBody.insertRow();

                                row.innerHTML = \`
                                    <td>\${doc.titulo}</td>
                                    <td>\${doc.remitente}</td>
                                    <td>\${doc.comision_nombre || 'N/A'}</td>
                                    <td>\${new Date(doc.fecha_subida).toLocaleDateString()}</td>
                                    <td>\${doc.subido_por || 'Desconocido'}</td>
                                    <td class="action-buttons">
                                        <button class="view-button" onclick="viewPdf('\${doc.id}', '\${doc.titulo}')">Ver</button>
                                        <a href="/api/documentos/\${doc.id}/download" class="download-button">Descargar</a>
                                    </td>
                                \`;
                            });
                        } else {
                            documentListBody.innerHTML = \`<tr><td colspan="6">No se encontraron documentos.</td></tr>\`;
                        }
                        
                        // Actualizar controles de paginación
                        currentPage = data.currentPage;
                        totalPages = data.totalPages;
                        document.getElementById('pageInfo').textContent = \`Página \${currentPage} de \${totalPages}\`;
                        document.getElementById('prevPage').disabled = currentPage === 1;
                        document.getElementById('nextPage').disabled = currentPage === totalPages;

                    } catch (error) {
                        console.error('Error al cargar documentos:', error);
                        document.getElementById('document-list-body').innerHTML = \`<tr><td colspan="6">Error al cargar documentos.</td></tr>\`;
                    }
                }

                // --- Funcionalidad de Drag & Drop y Previsualización ---

                function setupDropArea() {
                    const dropArea = document.getElementById('drop-area');
                    const fileInput = document.getElementById('archivo');
                    const fileNameDisplay = document.getElementById('file-name-display');

                    ;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                        dropArea.addEventListener(eventName, preventDefaults, false);
                    });

                    function preventDefaults(e) {
                        e.preventDefault();
                        e.stopPropagation();
                    }

                    ;['dragenter', 'dragover'].forEach(eventName => {
                        dropArea.addEventListener(eventName, highlight, false);
                    });

                    ;['dragleave', 'drop'].forEach(eventName => {
                        dropArea.addEventListener(eventName, unhighlight, false);
                    });

                    function highlight() {
                        dropArea.classList.add('highlight');
                    }

                    function unhighlight() {
                        dropArea.classList.remove('highlight');
                    }

                    dropArea.addEventListener('drop', handleDrop, false);
                    fileInput.addEventListener('change', handleFilesSelect, false);
                    dropArea.addEventListener('click', () => fileInput.click(), false);


                    function handleFilesSelect(e) {
                        const dt = e.dataTransfer || e.target;
                        const files = dt.files;
                        if (files.length > 0) {
                            fileInput.files = files; // Asigna el archivo seleccionado al input real
                            fileNameDisplay.textContent = \`Archivo seleccionado: \${files[0].name}\`;
                        } else {
                            fileNameDisplay.textContent = '';
                        }
                    }

                    function handleDrop(e) {
                        const dt = e.dataTransfer;
                        const files = dt.files;
                        handleFilesSelect({ dataTransfer: dt, target: fileInput });
                    }
                }
                
                function viewPdf(documentId, documentTitle) {
                    const pdfModal = document.getElementById('pdfModal');
                    const pdfViewer = document.getElementById('pdfViewer');
                    const pdfModalTitle = document.getElementById('pdfModalTitle');

                    pdfModalTitle.textContent = documentTitle;
                    pdfViewer.src = \`/api/documentos/\${documentId}/preview\`; // La misma ruta de descarga funciona para previsualizar
                    pdfModal.style.display = 'block';
                }

                function closePdfModal() {
                    const pdfModal = document.getElementById('pdfModal');
                    const pdfViewer = document.getElementById('pdfViewer');
                    pdfModal.style.display = 'none';
                    pdfViewer.src = ''; // Limpiar el iframe al cerrar
                }
                window.onclick = function(event) {
                    const pdfModal = document.getElementById('pdfModal');
                    if (event.target == pdfModal) {
                        closePdfModal();
                    }
                }
           
                          /**
               * Muestra una notificación temporal (toast) en la esquina de la pantalla.
               */
              function showAlert(message, type = 'success') {
                  const notification = document.createElement('div');
                  notification.className = \`toast-notification \${type}\`;
                  notification.textContent = message;
                  document.body.appendChild(notification);

                  // Muestra la notificación
                  setTimeout(() => {
                      notification.classList.add('show');
                  }, 10);

                  // Oculta y elimina la notificación después de 3 segundos
                  setTimeout(() => {
                      notification.classList.remove('show');
                      setTimeout(() => {
                          document.body.removeChild(notification);
                      }, 300);
                  }, 3000);
              }


              // UploadSubmit

                  async function handleUploadSubmit(event) {
                      console.log('🚀 Iniciando subida de documento...');
                      event.preventDefault();
                      
                      const form = event.target;
                      const submitButton = form.querySelector('button[type="submit"]');
                      const originalButtonText = submitButton.textContent;
                      
                      // Validaciones del frontend
                      const formData = new FormData(form);
                      const titulo = formData.get('titulo')?.trim();
                      const archivo = formData.get('archivo');
                      
                      if (!titulo) {
                          showAlert('El título es obligatorio', 'error');
                          return;
                      }
                      
                      if (!archivo || archivo.size === 0) {
                          showAlert('Debe seleccionar un archivo', 'error');
                          return;
                      }
                      
                      // Deshabilitar botón
                      submitButton.disabled = true;
                      submitButton.textContent = 'Subiendo...';
                      
                      // Timeout para evitar que se quede colgado
                      const controller = new AbortController();
                      const timeoutId = setTimeout(() => {
                          controller.abort();
                          console.error('❌ Timeout: La subida tardó más de 2 minutos');
                      }, 120000); // 2 minutos
                      
                      try {
                          console.log('📤 Enviando archivo:', {
                              nombre: archivo.name,
                              tamaño: \`\${(archivo.size / 1024 / 1024).toFixed(2)} MB\`,
                              tipo: archivo.type,
                              titulo: titulo
                          });
                          
                          const response = await fetch('/api/documentos', {
                              method: 'POST',
                              body: formData,
                              signal: controller.signal
                          });
                          
                          clearTimeout(timeoutId);
                          
                          console.log('📥 Respuesta recibida:', {
                              status: response.status,
                              statusText: response.statusText,
                              contentType: response.headers.get('content-type')
                          });
                          
                          // Leer respuesta como texto primero
                          const responseText = await response.text();
                          console.log('📄 Contenido de respuesta:', responseText || '(vacío)');
                          
                          if (!response.ok) {
                              // Manejar errores HTTP
                              let errorMessage = \`Error del servidor (\${response.status})\`;
                              
                              if (responseText) {
                                  try {
                                      const errorData = JSON.parse(responseText);
                                      errorMessage = errorData.error || errorData.details || errorMessage;
                                  } catch (parseError) {
                                      errorMessage = responseText;
                                  }
                              }
                              
                              throw new Error(errorMessage);
                          }
                          
                          // Procesar respuesta exitosa
                          if (!responseText) {
                              throw new Error('El servidor no devolvió ningún dato');
                          }
                          
                          let result;
                          try {
                              result = JSON.parse(responseText);
                          } catch (parseError) {
                              console.error('❌ Error parseando JSON:', parseError);
                              throw new Error('Respuesta del servidor inválida');
                          }
                          
                          if (!result.success) {
                              throw new Error(result.error || result.details || 'Error desconocido del servidor');
                          }
                          
                          // Éxito
                          console.log('✅ Documento subido exitosamente:', result);
                          
                          const mensaje = result.message || 'Documento subido con éxito';
                          const procesamiento = result.procesamiento || {};
                          
                          let detalles = '';
                          if (procesamiento.ocr_aplicado) {
                              detalles += ' (OCR aplicado)';
                          }
                          if (procesamiento.palabras_clave_count > 0) {
                              detalles += \` - \${procesamiento.palabras_clave_count} palabras clave\`;
                          }
                          
                          showAlert(mensaje + detalles, 'success');
                          
                          // Limpiar formulario
                          form.reset();
                          const fileDisplay = document.getElementById('file-name-display');
                          if (fileDisplay) {
                              fileDisplay.textContent = '';
                          }
                          
                          // Recargar lista de documentos
                          if (typeof loadDocuments === 'function') {
                              await loadDocuments();
                              console.log('📋 Lista de documentos actualizada');
                          } else {
                              console.warn('⚠️ Función loadDocuments no disponible');
                          }
                          
                      } catch (error) {
                          clearTimeout(timeoutId);
                          
                          if (error.name === 'AbortError') {
                              console.error('❌ Subida cancelada por timeout');
                              showAlert('La subida tardó demasiado tiempo. Por favor, intente con un archivo más pequeño.', 'error');
                          } else {
                              console.error('❌ Error durante la subida:', error);
                              showAlert(\`Error: \${error.message}\`, 'error');
                          }
                          
                      } finally {
                          // Siempre reactivar botón
                          submitButton.disabled = false;
                          submitButton.textContent = originalButtonText;
                          console.log('🔄 Botón reactivado');
                      }
                  }
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
      const { page = 1, limit = 15, search = '', comision_id = '' } = req.query; // Añadimos comision_id como filtro
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let queryText = `
        SELECT
          d.id,
          d.titulo,
          d.remitente,
          c.nombre AS comision_nombre,
          d.fecha_ingreso AS fecha_subida,
          u.nombre AS subido_por,
          d.archivo_path
        FROM documentos d
        LEFT JOIN comisiones c ON d.comision_id = c.id
        LEFT JOIN usuarios u ON d.usuario_creador_id = u.id
        WHERE 1 = 1
      `;
      let countQuery = `SELECT COUNT(*) FROM documentos d LEFT JOIN comisiones c ON d.comision_id = c.id LEFT JOIN usuarios u ON d.usuario_creador_id = u.id WHERE 1 = 1`;
      const queryParams = [];
      let paramIndex = 1;

      if (search) {
        const searchClause = ` AND (d.titulo ILIKE $${paramIndex} OR d.remitente ILIKE $${paramIndex} OR c.nombre ILIKE $${paramIndex} OR u.nombre ILIKE $${paramIndex})`;
        queryText += searchClause; // 👇 CAMBIO
        countQuery += searchClause;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (comision_id) { // Filtro por comisión
        const comisionClause = ` AND d.comision_id = $${paramIndex}`;
        queryText += comisionClause; // 👇 CAMBIO
        countQuery += comisionClause;
        queryParams.push(comision_id);
        paramIndex++;
      }
      
      const totalDocumentsResult = await query(countQuery, queryParams);
      const totalDocuments = parseInt(totalDocumentsResult.rows[0].count);
      const totalPages = Math.ceil(totalDocuments / parseInt(limit));

      queryText += ` ORDER BY d.fecha_ingreso DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1} `;
      queryParams.push(parseInt(limit), offset);
    
      const result = await query(queryText, queryParams);

    // Procesar resultados para manejar campos JSON nulos
    const documentosProcessed = result.rows.map(doc => ({
      ...doc,
      palabras_clave: doc.palabras_clave || '[]',
      analisis_nlp: doc.analisis_nlp || '{}',
      recomendaciones: doc.recomendaciones || '[]',
      metadatos_procesamiento: doc.metadatos_procesamiento || '{}'
    }));

    res.json({
        documents: result.rows,
        currentPage: parseInt(page),
        perPage: parseInt(limit),
        totalDocuments,
        totalPages},documentosProcessed);
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
    let archivoPath = null;
    
    try {
      await client.query('BEGIN');

      const { titulo, remitente, comision_id } = req.body;
      const archivo = req.file;
      archivoPath = archivo?.path;

      // Validaciones básicas
      if (!archivo) {
        return res.status(400).json({ 
          success: false,
          error: 'No se ha subido ningún archivo',
          details: 'Archivo requerido'
        });
      }

      if (!titulo || titulo.trim().length === 0) {
        return res.status(400).json({ 
          success: false,
          error: 'El título es obligatorio',
          details: 'Título requerido'
        });
      }

      if (!req.session?.usuario?.id) {
        return res.status(401).json({ 
          success: false,
          error: 'Usuario no autenticado',
          details: 'Sesión requerida'
        });
      }

      console.log(`📤 Procesando documento: ${titulo} (${archivo.mimetype})`);

      // Variables con valores por defecto
      let contenidoTexto = '';
      let ocrAplicado = false;
      let metadatosProcesamiento = {};
      let palabrasClave = [];
      let analisisNLP = {
        longitud_caracteres: 0,
        longitud_palabras: 0,
        longitud_oraciones: 0,
        sentiment: 0,
        complejidad: { score: 0 },
        temas_detectados: [],
        procesamiento_limitado: true
      };

      try {
        // Procesar archivo con OCR si es necesario
        console.log('🔍 Iniciando procesamiento OCR...');
        const resultadoProcesamiento = await DocumentController.procesarArchivoConOCR(
          archivo.path, 
          archivo.mimetype
        );

        contenidoTexto = resultadoProcesamiento.texto || '';
        ocrAplicado = resultadoProcesamiento.ocr_aplicado || false;
        metadatosProcesamiento = resultadoProcesamiento.metadatos || {};

        console.log(`📝 Texto extraído: ${contenidoTexto.length} caracteres`);

      } catch (ocrError) {
        console.error('⚠️ Error en OCR, continuando sin procesamiento:', ocrError.message);
        // Continuamos sin OCR
        metadatosProcesamiento.ocr_error = ocrError.message;
      }

      // Análisis NLP solo si hay contenido de texto suficiente
      if (contenidoTexto && contenidoTexto.trim().length > 50) {
        try {
          console.log('🧠 Aplicando análisis NLP...');
          palabrasClave = await DocumentController.extractKeywords(contenidoTexto);
          analisisNLP = await DocumentController.analyzeDocument(contenidoTexto);
          
          console.log(`🏷️ Palabras clave extraídas: ${palabrasClave.length}`);
        } catch (nlpError) {
          console.error('⚠️ Error en análisis NLP, continuando con valores por defecto:', nlpError.message);
          analisisNLP.nlp_error = nlpError.message;
        }
      } else {
        console.warn('⚠️ Texto insuficiente para análisis NLP');
      }

      // Insertar documento en la base de datos
      console.log('💾 Guardando en base de datos...');
      const documentResult = await client.query(`
        INSERT INTO documentos (
          titulo, remitente, fecha_ingreso, comision_id, usuario_creador_id,
          archivo_path, contenido_texto, palabras_clave, analisis_nlp, metadatos_procesamiento
        ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        titulo.trim(),
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
        try {
          console.log('🔍 Buscando documentos similares...');
          recomendaciones = await DocumentController.findSimilarDocuments(
            nuevoDocumento.id,
            contenidoTexto,
            palabrasClave
          );
          console.log(`💡 Documentos similares encontrados: ${recomendaciones.length}`);

          // Actualizar documento con recomendaciones
          if (recomendaciones.length > 0) {
            await client.query(`
              UPDATE documentos 
              SET recomendaciones = $1 
              WHERE id = $2
            `, [JSON.stringify(recomendaciones), nuevoDocumento.id]);
          }
        } catch (similarError) {
          console.error('⚠️ Error buscando documentos similares:', similarError.message);
          // Continuamos sin recomendaciones
        }
      }

      await client.query('COMMIT');

      console.log(`✅ Documento subido exitosamente: ${titulo} por ${req.session.usuario.nombre}`);
      
      // Respuesta exitosa garantizada
      return res.status(200).json({
        success: true,
        message: 'Documento subido y procesado con éxito',
        documento: {
          id: nuevoDocumento.id,
          titulo: nuevoDocumento.titulo,
          remitente: nuevoDocumento.remitente,
          fecha_ingreso: nuevoDocumento.fecha_ingreso
        },
        procesamiento: {
          palabras_clave_count: palabrasClave.length,
          recomendaciones_count: recomendaciones.length,
          ocr_aplicado: ocrAplicado,
          texto_extraido_length: contenidoTexto.length,
          analisis_completado: contenidoTexto.trim().length > 50
        }
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error crítico subiendo documento:', error);
      
      // Respuesta de error garantizada
      return res.status(500).json({ 
        success: false,
        error: 'Error procesando documento',
        details: error.message,
        timestamp: new Date().toISOString()
      });
      
    } finally {
      client.release();
      
      // Limpiar archivo en caso de error
      if (archivoPath && req.file) {
        try {
          this.limpiarArchivo(archivoPath);
        } catch (cleanError) {
          console.error('Error limpiando archivo:', cleanError.message);
        }
      }
    }
}

    static async previewDocumento(req, res) {
      try {
          const { id } = req.params;
          // Solo necesitamos la ruta del archivo
          const result = await query('SELECT archivo_path FROM documentos WHERE id = $1', [id]);
          
          if (result.rows.length === 0) {
              return res.status(404).send('Documento no encontrado.');
          }

          const document = result.rows[0];
          const filePath = path.resolve(document.archivo_path);

          // Verificar si el archivo físico existe
          if (fs.existsSync(filePath)) {
              // res.sendFile envía el archivo para ser mostrado en el navegador (inline)
              res.sendFile(filePath);
          } else {
              res.status(404).send('El archivo no fue encontrado en el servidor.');
          }

      } catch (error) {
          console.error('Error al previsualizar el documento:', error);
          res.status(500).send('Error interno del servidor.');
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

  static async sugerirReglamentos(idsDeDocumentosDeSesion) {
        console.log(`🧠 Iniciando sugerencia de reglamentos para ${idsDeDocumentosDeSesion.length} documento(s).`);
        if (!idsDeDocumentosDeSesion || idsDeDocumentosDeSesion.length === 0) {
            console.log('⚠️ No hay documentos de sesión para analizar, no se sugieren reglamentos.');
            return []; // No hay documentos, no hay sugerencias
        }

        try {
            // 1. OBTENER EL CONTENIDO COMBINADO DE LOS DOCUMENTOS DE LA SESIÓN
            const params = idsDeDocumentosDeSesion.map((_, i) => `$${i + 1}`).join(',');
            const documentosSesionResult = await query(
                `SELECT contenido_texto, palabras_clave FROM documentos WHERE id IN (${params})`,
                idsDeDocumentosDeSesion
            );

            if (documentosSesionResult.rows.length === 0) {
                return [];
            }

            // Unimos todo el texto y palabras clave en un solo "perfil de contenido" para la sesión
            const perfilContenidoSesion = documentosSesionResult.rows.map(d => d.contenido_texto).join(' \n ');
            const perfilKeywordsSesion = [...new Set(documentosSesionResult.rows.flatMap(d => d.palabras_clave || []))];

            console.log(`📝 Perfil de sesión creado con ${perfilKeywordsSesion.length} palabras clave únicas.`);

            // 2. OBTENER TODOS LOS REGLAMENTOS DE LA BASE DE DATOS
            const reglamentosResult = await query(
                `SELECT id, titulo, contenido_texto, palabras_clave FROM documentos WHERE categoria = 'Reglamento'`
            );
            const todosLosReglamentos = reglamentosResult.rows;
            console.log(`📚 Encontrados ${todosLosReglamentos.length} reglamentos en la base de conocimiento.`);

            // 3. CALCULAR SIMILITUD Y ENCONTRAR LOS MÁS RELEVANTES
            const sugerencias = [];
            for (const reglamento of todosLosReglamentos) {
                // No sugerir un reglamento si ya está incluido en los documentos de la sesión
                if (idsDeDocumentosDeSesion.includes(reglamento.id)) {
                    continue;
                }

                // Usamos la lógica de similitud que ya tienes!
                const similitud = this.calculateSimilarity(
                    perfilKeywordsSesion,
                    reglamento.palabras_clave || [],
                    perfilContenidoSesion,
                    reglamento.contenido_texto || ''
                );

                if (similitud > 0.05) { // Umbral de similitud del 50% (ajustable)
                    sugerencias.push({
                        id: reglamento.id,
                        titulo: reglamento.titulo,
                        similitud: similitud
                    });
                }
            }

            // 4. DEVOLVER LAS MEJORES SUGERENCIAS
            const topSugerencias = sugerencias
                .sort((a, b) => b.similitud - a.similitud)
                .slice(0, 5); // Devolvemos hasta 5 sugerencias

            console.log(`✅ Sugerencias generadas: ${topSugerencias.length}`);
            return topSugerencias.map(s => s.titulo); // Devolvemos solo los títulos

        } catch (error) {
            console.error('❌ Error crítico al sugerir reglamentos:', error);
            return ['Error al procesar sugerencias']; // Devolver un error manejable
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