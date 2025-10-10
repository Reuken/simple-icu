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
                /* Estilo base para todas las insignias de categoría */
                    .category-badge {
                        color: white;
                        padding: 4px 10px;
                        border-radius: 12px;
                        font-size: 0.8em;
                        font-weight: 500;
                        text-transform: capitalize; /* Pone la primera letra en mayúscula */
                    }

                    /* Colores específicos para cada categoría */
                    .category-resolucion { background-color: #007BFF; } /* Azul */
                    .category-reglamento { background-color: #6f42c1; } /* Morado */
                    .category-informe { background-color: #fd7e14; }   /* Naranja */
                    .category-general { background-color: #6c757d; }   /* Gris */
                    .delete-button {
                        background-color: #dc3545;
                        color: white;
                        border: none;
                                  }

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
                         <select id="document-category-filter">
                              <option value="">Todas las categorías</option>
                              <option value="Reglamento">Reglamento</option>
                              <option value="Resolucion">Resolución</option>
                              <option value="Informe de comision">Informe</option>
                              <option value="General">General</option>
                          </select>
                        <button class="cta-button" onclick="loadDocuments()">Buscar</button>
                    </div>

                    <div class="document-table-container">
                        <table class="document-table">
                            <thead>
                                <tr>
                                    <th>Título</th>
                                    <th>Remitente</th>
                                    <th>Comisión</th>
                                    <th>Categoría</th>
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

                    // Event listener para el filtro de categoría
                      document.getElementById('document-category-filter').addEventListener('change', () => {
                          currentPage = 1;
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
                    const categoryFilter = document.getElementById('document-category-filter').value;
                    const queryString = new URLSearchParams({
                        page: currentPage,
                        limit: documentsPerPage,
                        search: searchTerm,
                        comision_id: comisionFilter,
                        categoria: categoryFilter 
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

                                //Cada categoria con su color distintivo
                                const categoria = doc.categoria || 'General';
                                const categoriaClass = 'category-' + categoria.toLowerCase().split(' ')[0];

                                row.innerHTML = \`
                                    <td>\${doc.titulo}</td>
                                    <td>\${doc.remitente}</td>
                                    <td>\${doc.comision_nombre || 'N/A'}</td>
                                     <td><span class="category-badge \${categoriaClass}">\${categoria}</span></td>
                                    <td>\${new Date(doc.fecha_subida).toLocaleDateString()}</td>
                                    <td>\${doc.subido_por || 'Desconocido'}</td>
                                    <td class="action-buttons">
                                        <button class="view-button" onclick="viewPdf('\${doc.id}', '\${doc.titulo}')">Ver</button>
                                        <a href="/api/documentos/\${doc.id}/download" class="download-button">Descargar</a>
                                        <button class="delete-button" onclick="deleteDocument('\${doc.id}', '\${doc.titulo}')">Borrar</button>
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
                    pdfViewer.src = \`/api/documentos/\${documentId}/preview\`;
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
                      event.preventDefault();
                      
                      const form = event.target;
                      const submitButton = form.querySelector('button[type="submit"]');
                      const originalButtonText = submitButton.textContent;
                      const formData = new FormData(form);
                      
                      if (!formData.get('titulo')?.trim()) { 
                          showAlert('El título es obligatorio', 'error'); 
                          return; 
                      }
                      if (!formData.get('archivo') || formData.get('archivo').size === 0) { 
                          showAlert('Debe seleccionar un archivo', 'error'); 
                          return; 
                      }
                      
                      submitButton.disabled = true;
                      submitButton.textContent = 'Subiendo y procesando...';
                      
                      // Iniciar la subida SIN esperar respuesta
                      fetch('/api/documentos', { 
                          method: 'POST', 
                          body: formData 
                      }).catch(error => {
                          console.error('Error en subida:', error);
                      });
                      
                      // Esperar
                      setTimeout(() => {
                          submitButton.disabled = false;
                          submitButton.textContent = originalButtonText;
                          
                          form.reset();
                          document.getElementById('file-name-display').textContent = '';
                          
                          showAlert('Documento subido con éxito', 'success');
                          loadDocuments();
                      }, 15000);
                  }

                  async function deleteDocument(id, titulo) {
                          if (!confirm(\`¿Estás seguro de que quieres eliminar el documento "\${titulo}"? Esta acción no se puede deshacer.\`)) {
                              return;
                          }

                          try {
                              const response = await fetch(\`/api/documentos/\${id}\`, {
                                  method: 'DELETE',
                              });

                              const result = await response.json();

                              if (response.ok && result.success) {
                                  showAlert('Documento eliminado con éxito', 'success');
                                  loadDocuments(); // Recargar la lista
                              } else {
                                  showAlert(result.message || 'No se pudo eliminar el documento', 'error');
                              }
                          } catch (error) {
                              console.error('Error al eliminar documento:', error);
                              showAlert('Error de red al intentar eliminar.', 'error');
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
      const { page = 1, limit = 15, search = '', comision_id = '', categoria = '' } = req.query; // Añadimos comision_id como filtro
      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      let queryText = `
      SELECT
        d.id, d.titulo, d.remitente, d.categoria,
        d.palabras_clave, d.analisis_nlp, d.recomendaciones, d.metadatos_procesamiento,
        c.nombre AS comision_nombre,
        d.fecha_ingreso AS fecha_subida,
        u.nombre AS subido_por
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

      if (categoria) { // Filtro por categoria
      const categoryClause = ` AND d.categoria = $${paramIndex}`;
      queryText += categoryClause;
      countQuery += categoryClause;
      queryParams.push(categoria);
      paramIndex++;
    }
      
      const totalDocumentsResult = await query(countQuery, queryParams);
      const totalDocuments = parseInt(totalDocumentsResult.rows[0].count);
      const totalPages = Math.ceil(totalDocuments / parseInt(limit));

      queryText += ` ORDER BY d.fecha_ingreso DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1} `;
      queryParams.push(parseInt(limit), offset);
    
      const result = await query(queryText, queryParams);

     const documentosProcessed = result.rows.map(doc => ({
          ...doc,
          palabras_clave: parseJSONSeguro(doc.palabras_clave, []),
      analisis_nlp: parseJSONSeguro(doc.analisis_nlp, {}),
      recomendaciones: parseJSONSeguro(doc.recomendaciones, []),
      metadatos_procesamiento: parseJSONSeguro(doc.metadatos_procesamiento, {})
        }));

        // Se envía un único objeto JSON que contiene toda la información
        res.json({
            documents: documentosProcessed, // <-- Se usa la constante procesada
            currentPage: parseInt(page),
            totalPages: totalPages
        });
    } catch (error) {
      console.error('Error obteniendo documentos:', error);
      res.status(500).json({ error: 'Error obteniendo documentos' });
    }
  }

  static async deleteDocumento(req, res) {
    const { id } = req.params;
    const client = await getClient();
    try {
        await client.query('BEGIN');

        // 1. Obtener la ruta del archivo antes de borrar el registro
        const docResult = await client.query('SELECT archivo_path FROM documentos WHERE id = $1', [id]);
        if (docResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Documento no encontrado.' });
        }
        const filePath = docResult.rows[0].archivo_path;

        // 2. Borrar el registro de la base de datos
        await client.query('DELETE FROM documentos WHERE id = $1', [id]);

        // 3. Borrar el archivo físico del servidor
        if (filePath) {
            // Usamos el método de limpieza que ya tienes
            DocumentController.limpiarArchivo(filePath);
        }

        await client.query('COMMIT');
        res.status(200).json({ success: true, message: 'Documento eliminado correctamente.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error al eliminar documento:', error);
        res.status(500).json({ success: false, message: 'Error interno al eliminar el documento.' });
    } finally {
        client.release();
    }
}

static async getTodosLosReglamentos(req, res) {
    try {
        const result = await query(
            "SELECT id, titulo FROM documentos WHERE categoria = 'Reglamento' ORDER BY titulo ASC"
        );
        // Si se llama desde una API, devuelve JSON.
        // Si no, simplemente devuelve los datos para uso interno.
        if (res) {
            return res.json(result.rows);
        }
        return result.rows;
    } catch (error) {
        console.error('Error al obtener todos los reglamentos:', error);
        if (res) {
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
        throw error;
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

  /**
  Extrae citas específicas de reglamentos y resoluciones del texto.
   * Prioriza formatos en mayúsculas como "VICERRECTORADO N° 598/2025".
   * @param {string} texto - El contenido completo del documento.
   * @returns {string[]} Un array de citas únicas encontradas.
   */
  static extractDocumentCitations(texto) {
    // Expresiones Regulares refinadas
    const REGEX_CITE_CON_NUMERO = /(?:Resolución|Oficio|Informe|Decanato|Consejo Facultativo)\s*[\w\s.]*?N[°º*]\s*[\d-\/]+/gi;
    const REGEX_REGLAMENTO_TITULO = /(?:Reglamento|Estatuto Orgánico de la Universidad Autónoma Gabriel René Moreno|Estatuto Orgánico de la U\.A\.G\.R\.M\.)[\s\wÁÉÍÓÚáéíóúñÑ"'-]+/gi;
    const REGEX_ARTICULO = /(?:Artículo|Art\.?|Inciso)\s*[\d\w°.,\s]+/gi;

    let citasCandidatas = new Set();
    const parrafos = texto.split(/[\n\r]{2,}/); // 1. Analizar por párrafo

    parrafos.forEach(parrafo => {
        const pLimpio = parrafo.replace(/[\n\r]/g, ' ').trim();

        const regs = pLimpio.match(REGEX_REGLAMENTO_TITULO);
        const arts = pLimpio.match(REGEX_ARTICULO);
        const citasNum = pLimpio.match(REGEX_CITE_CON_NUMERO);

        if (regs && arts) {
            // 2. Asociar artículos solo si están en el mismo párrafo que un reglamento
            const articulosUnicos = [...new Set(arts)];
            citasCandidatas.add(`${regs[0].trim()} en su ${articulosUnicos.join(', ')}`);
        } else if (regs) {
            // Añadir reglamentos mencionados solos
            regs.forEach(r => citasCandidatas.add(r.trim()));
        }

        if (citasNum) {
            citasNum.forEach(c => citasCandidatas.add(c.trim()));
        }
    });

    // --- 3. FILTRADO Y LIMPIEZA POST-PROCESAMIENTO ---
    let listaFiltrada = Array.from(citasCandidatas)
        .map(cita => cita.replace(/\s+/g, ' ').replace(/[.,]$/, '').trim()) // Limpiar espacios y puntuación final
        .filter(cita => {
            const lowerCita = cita.toLowerCase();
            // Descartar frases procedurales o incompletas
            if (lowerCita.includes('cuyo objetivo es que') ||
                lowerCita.includes('establece que') ||
                lowerCita.includes('fines consiguientes') ||
                lowerCita.includes('vicerrectorado, dicaa')) {
                return false;
            }
            // Descartar frases muy cortas que no sean citas con número
            if (cita.length < 20 && !cita.match(/N[°º*]/)) {
                return false;
            }
            return true;
        })
        // Corregir redundancias como "en su Artículo 72 en su Artículo 72"
        .map(cita => {
            const partes = cita.split(/ en su /gi);
            if (partes.length > 1) {
                const base = partes[0];
                const articulos = [...new Set(partes.slice(1).join(', ').split(',').map(a => a.trim()))].join(', ');
                return `${base} en su ${articulos}`;
            }
            return cita;
        });

    // --- 4. DESDUPLICACIÓN INTELIGENTE FINAL ---
    // Prioriza las menciones que incluyen artículos sobre las que no.
    const mapaFinal = new Map();
    // Ordenar de la más larga (específica) a la más corta (general)
    listaFiltrada.sort((a, b) => b.length - a.length);

    listaFiltrada.forEach(cita => {
        let esRedundante = false;
        // Normalizamos la cita para buscar duplicados semánticos
        const citaNormalizada = cita.toLowerCase().replace(/[^a-z0-9]/g, '');

        for (const [key, value] of mapaFinal.entries()) {
            // Si una cita ya guardada (que es más larga) contiene la versión simplificada
            // de la cita actual, entonces la actual es redundante.
            if (key.includes(citaNormalizada)) {
                esRedundante = true;
                break;
            }
        }

        if (!esRedundante) {
            mapaFinal.set(citaNormalizada, cita);
        }
    });

    const resultadoFinal = Array.from(mapaFinal.values());
    console.log(`✅ Citas de ultra precisión encontradas: ${resultadoFinal.length}`);
    return resultadoFinal;
}

  // Función principal para procesar archivos con OCR
  static async procesarArchivoConOCR(archivoPath, tipoArchivo) {
    try {
     // //  console.log(`🔍 Procesando archivo: ${tipoArchivo}`);
      
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
      //  console.log('🖼️ Procesando imagen con OCR...');
        const resultado = await this.extraerTextoDeImagen(archivoPath);
        contenidoTexto = resultado.texto;
        metadatos = { ...metadatos, ...resultado.metadatos };
        ocrAplicado = true;
      }

      metadatos.caracteres_extraidos = contenidoTexto.length;
      
      // // console.log(`✅ Procesamiento completado: ${metadatos.caracteres_extraidos} caracteres extraídos`);
      
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
     //  console.log('📄 Procesando PDF...');
      
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
      //    console.log('📄 PDF parece escaneado, aplicando OCR...');
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
       //  console.log('📝 Texto nativo extraído exitosamente');
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
     //  console.log('🔧 Iniciando OCR para PDF escaneado...');
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
        //   console.log(`📄 Procesando página ${pagina}...`);
          
          const resultado = await convert(pagina);
          
          if (resultado && resultado.path) {
            // Mejorar imagen antes del OCR
            const imagenMejorada = await this.mejorarImagenParaOCR(resultado.path);
            
            // Aplicar OCR
            const { data: { text } } = await Tesseract.recognize(imagenMejorada, 'spa', {
              logger: m => {
                if (m.status === 'recognizing text') {
                 // console.log(`OCR página ${pagina}: ${Math.round(m.progress * 100)}%`);
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
     //  console.log(`✅ OCR completado. ${paginasProcesadas} páginas procesadas en ${tiempoTotal}ms`);
      
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
     //  console.log('🖼️ Aplicando OCR a imagen...');
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
     //  console.log(`✅ OCR de imagen completado en ${tiempoTotal}ms`);
      
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
        const { titulo, remitente, comision_id, categoria } = req.body;
        const archivo = req.file;
        archivoPath = archivo?.path;
        
        if (!archivo) {
            throw new Error('No se ha subido ningún archivo');
        }
        if (!titulo) {
            throw new Error('El título es obligatorio');
        }

        console.log(`📤 Procesando documento: ${titulo}`);
        const resultadoProcesamiento = await DocumentController.procesarArchivoConOCR(archivo.path, archivo.mimetype);
        const { texto: contenidoTexto, ocr_aplicado: ocrAplicado, metadatos: metadatosProcesamiento } = resultadoProcesamiento;
        
        let palabrasClave = [];
        let analisisNLP = {};
        if (contenidoTexto && contenidoTexto.trim().length > 50) {
            palabrasClave = await DocumentController.extractKeywords(contenidoTexto);
            analisisNLP = await DocumentController.analyzeDocument(contenidoTexto);
        }
        
        const documentResult = await client.query(`
            INSERT INTO documentos (
                titulo, remitente, fecha_ingreso, comision_id, usuario_creador_id,
                archivo_path, contenido_texto, palabras_clave, analisis_nlp, metadatos_procesamiento, categoria
            ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            titulo.trim(), remitente || null, comision_id || null, req.session.usuario.id,
            archivo.path, contenidoTexto, JSON.stringify(palabrasClave), JSON.stringify(analisisNLP),
            JSON.stringify(metadatosProcesamiento), categoria || 'General'
        ]);
        
        const nuevoDocumento = documentResult.rows[0];
        
        let recomendaciones = [];
        if (palabrasClave.length > 0) {
            recomendaciones = await DocumentController.findSimilarDocuments(nuevoDocumento.id, contenidoTexto, palabrasClave);
            if (recomendaciones.length > 0) {
                await client.query('UPDATE documentos SET recomendaciones = $1 WHERE id = $2', [JSON.stringify(recomendaciones), nuevoDocumento.id]);
            }
        }
        
        await client.query('COMMIT');
        
        // CRÍTICO: Asegúrate que NO se haya enviado nada antes
        if (res.headersSent) {
            console.error('❌ Headers ya enviados, no se puede responder');
            return;
        }
        
        // Prepara la respuesta
        const responseData = { 
            success: true, 
            message: 'Documento subido y procesado con éxito' 
        };
        
        // Envía la respuesta de forma explícita
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(responseData))
        });
        res.end(JSON.stringify(responseData));
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error crítico subiendo documento:', error);
        
        if (archivoPath) {
            try {
                this.limpiarArchivo(archivoPath);
            } catch (cleanError) {
                console.error('Error limpiando archivo:', cleanError.message);
            }
        }
        
        if (!res.headersSent) {
            const errorData = { 
                success: false, 
                error: 'Error procesando documento', 
                details: error.message 
            };
            res.writeHead(500, {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(JSON.stringify(errorData))
            });
            res.end(JSON.stringify(errorData));
        }
        
    } finally {
        client.release();
    }
}
    static async previewDocumento(req, res) {
      try {
          const { id } = req.params;
          const result = await query('SELECT archivo_path FROM documentos WHERE id = $1', [id]);
          
          if (result.rows.length === 0) {
              return res.status(404).send('Documento no encontrado en la base de datos.');
          }

          const document = result.rows[0];
          
          // [CORREGIDO] Construir la ruta absoluta de forma segura
          const projectRoot = path.join(__dirname, '..'); // Sube un nivel desde /controllers para llegar a la raíz del proyecto
          const filePath = path.join(projectRoot, document.archivo_path);

          if (fs.existsSync(filePath)) {
              res.sendFile(filePath);
          } else {
              console.error(`❌ Archivo no encontrado en el disco. Ruta buscada: ${filePath}`);
              res.status(404).send('El archivo físico no fue encontrado en el servidor.');
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
      const result = await query('SELECT titulo, archivo_path FROM documentos WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }

      const documento = result.rows[0];
      
      // [CORREGIDO] Construir la ruta absoluta de forma segura
      const projectRoot = path.join(__dirname, '..');
      const filePath = path.join(projectRoot, documento.archivo_path);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo físico no encontrado' });
      }

      const extension = path.extname(filePath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (extension === '.pdf') {
        contentType = 'application/pdf';
      }

      res.setHeader('Content-Type', contentType);
      // Para descargar con un nombre legible en lugar del nombre codificado
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

    //   console.log(`🏷️ Keywords extraídos: ${keywords.length} de ${Object.keys(wordFreq).length} únicos`);
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
        citas_reglamentos: this.extractDocumentCitations(texto),
        temas_detectados: await this.detectTopics(texto),
        procesado_con_ocr: true,
        calidad_texto: this.evaluarCalidadTexto(texto)
      };

    console.log(`🧠 Análisis NLP completado. Citas encontradas: ${analisis.citas_reglamentos.length}`);
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
    if (!idsDeDocumentosDeSesion || idsDeDocumentosDeSesion.length === 0) {
        return [];
    }
    try {
        const params = idsDeDocumentosDeSesion.map((_, i) => `$${i + 1}`).join(',');
        const documentosSesionResult = await query(
            `SELECT analisis_nlp FROM documentos WHERE id IN (${params})`,
            idsDeDocumentosDeSesion
        );

        if (documentosSesionResult.rows.length === 0) { return []; }
        
        // 1. Extraer todas las citas con la función mejorada (ver Petición 2)
        let citasUnicas = new Set();
        documentosSesionResult.rows.forEach(doc => {
            const analisis = doc.analisis_nlp || {};
            if (analisis.citas_reglamentos && Array.isArray(analisis.citas_reglamentos)) {
                analisis.citas_reglamentos.forEach(cita => citasUnicas.add(cita));
            }
        });
        const citasArray = [...citasUnicas];
        if (citasArray.length === 0) return [];

        // 2. Buscar en la DB documentos cuyo título coincida con las citas
        const searchPatterns = citasArray.map(cita => `%${cita}%`);
        const documentosEncontradosResult = await query(
            `SELECT id, titulo FROM documentos WHERE titulo ILIKE ANY($1)`,
            [searchPatterns]
        );
        const mapaDocumentos = new Map(documentosEncontradosResult.rows.map(doc => [doc.titulo.toLowerCase(), doc]));

        // 3. Construir el resultado final con información de enlace
        const sugerencias = citasArray.map(cita => {
            const docEncontrado = mapaDocumentos.get(cita.toLowerCase());
            if (docEncontrado) {
                return {
                    texto: cita,
                    esEnlace: true,
                    documento_id: docEncontrado.id,
                    documento_titulo: docEncontrado.titulo
                };
            } else {
                return {
                    texto: cita,
                    esEnlace: false,
                    documento_id: null,
                    documento_titulo: null
                };
            }
        });

        console.log(`✅ Sugerencias enriquecidas generadas: ${sugerencias.length}`);
        return sugerencias;

    } catch (error) {
        console.error('❌ Error crítico al sugerir reglamentos:', error);
        return [{ texto: 'Error al procesar sugerencias', esEnlace: false, documento_id: null, documento_titulo: null }];
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
      
   //    console.log(`🔍 Similitud calculada: ${Math.round(similarity * 100)}% (keywords: ${Math.round(keywordSimilarity * 100)}%, text: ${Math.round(textSimilarity * 100)}%)`);
      return similarity;
      
    } catch (error) {
      console.error('❌ Error calculando similitud:', error);
      return 0;
    }
  }
}

module.exports = DocumentController;