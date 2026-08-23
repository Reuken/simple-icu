// views/pages.js
// ---------------------------------------------------------
// PÁGINA: DASHBOARD INICIAL
// ---------------------------------------------------------
function generateDashboardPage(usuario) {
    const comisionesHtml = usuario.comisiones && usuario.comisiones.length > 0 
        ? usuario.comisiones.map(c => '<span class="badge" style="background-color:var(--uagrm-blue); margin-right:5px; display:inline-block; margin-bottom:5px;">' + c.nombre + '</span>').join('') 
        : '<span style="color:var(--text-muted); font-style:italic;">No está asignado a ninguna comisión.</span>';

    return getSidebarHeader('Dashboard Principal', 'dashboard', usuario) + `
        <div class="welcome-card" style="margin-bottom: 2rem;">
            <h1 style="border:none; margin-top:0;">¡Bienvenido, ${usuario.nombre}!</h1>
            <p>Usted ha ingresado como: <strong>${usuario.descripcion_rol || usuario.tipo_usuario}</strong></p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
            <div style="display:flex; flex-direction:column; gap:20px;">
                <div class="info-card" style="margin:0;">
                    <h3 style="margin-top:0;">📋 Mi Información</h3>
                    <p><strong>Código:</strong> ${usuario.codigo}</p>
                    <p><strong>Email:</strong> ${usuario.email}</p>
                    <p style="margin-top:15px; border-top:1px solid #eee; padding-top:10px;"><strong>Mis Comisiones:</strong><br><br>${comisionesHtml}</p>
                </div>
                
                <div class="info-card" style="margin:0;">
                    <h3 style="margin-top:0;">🔗 Accesos Directos</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:15px;">Navegue por los módulos utilizando el menú lateral izquierdo.</p>
                    <a href="https://www.uagrm.edu.bo/gaceta/cogobierno/icu" target="_blank" class="cta-button secondary" style="display:block; margin-bottom:10px; background-color:#e9ecef; color:var(--uagrm-blue);">📜 Gaceta U.A.G.R.M. Oficial</a>
                    <a href="https://drive.google.com/drive/folders/1Rc2h9llNWZV_5O0wQ2gl4DxmLx7vQzuq?usp=sharing" target="_blank" class="cta-button secondary" style="display:block; background-color:#e9ecef; color:var(--uagrm-blue);">📂 Informes de Gestión Anteriores</a>
                </div>
            </div>

            <div class="info-card" style="margin:0; padding:1.5rem; max-height:800px; overflow-y:auto;">
                <div id="historial-sesiones-container">
                    <h3 style="border-bottom:2px solid var(--uagrm-red); padding-bottom:10px; margin-top:0;">⏳ Registro Histórico de Sesiones</h3>
                    <p style="color:var(--text-muted);">Cargando historial...</p>
                </div>
            </div>
        </div>

        <!-- Modal PDF a Pantalla Completa -->
        <div id="pdfModal" class="modal" style="display:none; position:fixed; z-index:10000; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.7); backdrop-filter: blur(3px);">
            <div style="background-color:#fff; margin:2% auto; width:90%; max-width:1400px; height:90vh; border-radius:8px; display:flex; flex-direction:column; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="background:#0055a4; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; color:white;">
                    <h2 id="pdfModalTitle" style="margin:0; font-size:1.2rem; color:white;">Previsualización de Documento</h2>
                    <span onclick="closePdfModal()" style="cursor:pointer; font-size:1.8rem; font-weight:bold; line-height:1; color:white;">&times;</span>
                </div>
                <iframe id="pdfViewer" style="width:100%; height:100%; flex-grow:1; border:none; background-color:#525659;" frameborder="0"></iframe>
            </div>
        </div>

        <script>
            document.addEventListener('DOMContentLoaded', function() {
                loadHistorialSesiones(); 
            });

            async function loadHistorialSesiones() {
                var container = document.getElementById('historial-sesiones-container');
                try {
                    var response = await fetch('/api/historial-sesiones');
                    var sesiones = await response.json();

                    if (!response.ok || !sesiones || sesiones.length === 0) {
                        container.innerHTML = '<h3 style="border-bottom:2px solid #dc3545; padding-bottom:10px; margin-top:0;">⏳ Registro Histórico de Sesiones</h3><p style="color:#6c757d;">No hay historial disponible.</p>';
                        return;
                    }

                    var html = '<h3 style="border-bottom:2px solid #dc3545; padding-bottom:10px; margin-top:0;">⏳ Registro Histórico de Sesiones</h3>';
                    
                    for (var i = 0; i < sesiones.length; i++) {
                        var sesion = sesiones[i];
                        var fechaFormateada = new Date(sesion.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
                        var esFinalizada = (sesion.estado === 'Finalizada');
                        
                        var badgeEstado = esFinalizada 
                            ? "<span style='background-color:#28a745; color:white; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;'>✅ Finalizada</span>"
                            : "<span style='background-color:#17a2b8; color:white; padding:4px 10px; border-radius:12px; font-size:0.75rem; font-weight:bold;'>⏳ Programada</span>";

                        var btnActa = esFinalizada
                            ? "<a href='/api/sesion/" + sesion.id + "/resumen-pdf' target='_blank' class='cta-button' style='background-color:#ffc107; color:#000; padding:6px 12px; font-size:0.8rem; text-decoration:none; border-radius:4px;'>📄 Descargar Acta PDF</a>"
                            : "";

                        html += "<div style='background:#f8f9fa; border:1px solid #dee2e6; border-radius:8px; padding:15px; margin-bottom:15px;'>";
                        html += "<div style='display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; border-bottom:1px solid #ddd; padding-bottom:10px;'>";
                        html += "<div>";
                        html += "<h4 style='margin:0 0 8px 0; color:#0055a4; font-size:1.1rem;'>" + sesion.tipo + " - " + fechaFormateada + "</h4>";
                        html += "<p style='margin:0; font-size:0.85rem; color:#6c757d;'>⏰ " + sesion.hora + " | " + badgeEstado + "</p>";
                        html += "</div><div>" + btnActa + "</div></div>";
                        
                        if (sesion.resoluciones && sesion.resoluciones.length > 0) {
                            html += "<p style='margin:0 0 5px 0; font-size:0.85rem; font-weight:bold;'>Documentos Aprobados:</p>";
                            html += "<ul style='list-style:none; padding:0; margin:0;'>";
                            
                            for (var j = 0; j < sesion.resoluciones.length; j++) {
                                var resDoc = sesion.resoluciones[j];
                                if(resDoc && resDoc.titulo) {
                                    // JSON.stringify crea automáticamente las comillas y protege caracteres extraños
                                    var safeTitle = JSON.stringify(resDoc.titulo);
                                    html += "<li style='display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-top:1px solid #eee; font-size:0.85rem;'>";
                                    html += "<span style='flex:1; margin-right:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;'>" + resDoc.titulo + "</span>";
                                    html += "<button class='cta-button secondary' style='padding:2px 8px; font-size:0.75rem; margin:0;' onclick='viewPdf(" + resDoc.id + ", " + safeTitle + ")'>Ver Doc.</button>";
                                    html += "</li>";
                                }
                            }
                            html += "</ul>";
                        } else {
                            var msg = esFinalizada ? 'Ningún documento aprobado en esta sesión.' : 'Documentos pendientes de tratamiento...';
                            html += "<p style='color:#6c757d; font-size:0.85rem; margin:0; font-style:italic;'>" + msg + "</p>";
                        }
                        html += "</div>";
                    }
                    container.innerHTML = html;

                } catch (error) {
                    console.error('Error cargando historial:', error);
                    container.innerHTML = '<h3 style="border-bottom:2px solid #dc3545; padding-bottom:10px; margin-top:0;">⏳ Registro Histórico de Sesiones</h3><div style="color:#dc3545;">Error de conexión al cargar el historial.</div>';
                }
            }

            function viewPdf(docId, docTitle) {
                var modal = document.getElementById('pdfModal');
                var viewer = document.getElementById('pdfViewer');
                if (modal && viewer) {
                    document.getElementById('pdfModalTitle').textContent = docTitle;
                    viewer.src = '/api/documentos/' + docId + '/preview';
                    modal.style.display = 'block';
                }
            }
            function closePdfModal() {
                var modal = document.getElementById('pdfModal');
                if (modal) modal.style.display = 'none';
            }
        </script>
    ` + getSidebarFooter();
}

// 1. VISTA: LISTAR DOCUMENTOS
function generateDocumentosListarPage(comisiones, usuario) {
    return getSidebarHeader('Buscar Documentos', 'documentos_listar', usuario) + `
        <div class="info-card">
            <h3 style="margin-top: 0;">📑 Explorador de Documentos</h3>
            <div class="search-filter-controls" style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                <input type="text" id="document-search" placeholder="Buscar por título o palabra clave..." style="flex:2; padding:8px;">
                <select id="document-category-filter" style="flex:1; padding:8px;">
                    <option value="">Todas las categorías</option>
                    <option value="Acta">Acta</option><option value="Citacion">Citación</option>
                    <option value="Informe de comision">Informe</option><option value="Pronunciamiento">Pronunciamiento</option>
                    <option value="Reglamento">Reglamento</option><option value="Resolucion">Resolución</option>
                </select>
                <select id="document-estado-filter" style="flex:1; padding:8px;">
                    <option value="">Todos los estados</option>
                    <option value="Borrador">Borrador</option><option value="Revision">En Revisión</option>
                    <option value="Aprobado">Aprobado</option><option value="Rechazado">Rechazado</option>
                    <option value="Promulgado">Promulgado</option><option value="Derogado">Derogado</option>
                </select>
                <button class="cta-button" onclick="currentPage=1; loadDocuments()">Buscar</button>
            </div>
            <div class="table-responsive">
                <table class="users-table">
                    <thead><tr><th>Título / Categoría</th><th>Comisión</th><th>Estado</th><th>Fecha</th><th>Acción</th></tr></thead>
                    <tbody id="document-list-body"><tr><td colspan="5" style="text-align:center;">Cargando...</td></tr></tbody>
                </table>
            </div>
            <div style="display:flex; justify-content:center; gap:15px; margin-top:20px;">
                <button id="prevPage" class="cta-button secondary" onclick="if(currentPage>1){currentPage--; loadDocuments();}">Anterior</button>
                <span id="pageInfo" style="padding-top:8px;">Página 1</span>
                <button id="nextPage" class="cta-button secondary" onclick="if(currentPage<totalPages){currentPage++; loadDocuments();}">Siguiente</button>
            </div>
        </div>
        
        <script>
            let currentPage = 1, totalPages = 1;
            document.addEventListener('DOMContentLoaded', loadDocuments);
            document.getElementById('document-search').addEventListener('keypress', e => { if(e.key === 'Enter') { currentPage=1; loadDocuments(); }});

            async function loadDocuments() {
                const q = new URLSearchParams({
                    page: currentPage,
                    search: document.getElementById('document-search').value,
                    categoria: document.getElementById('document-category-filter').value,
                    estado: document.getElementById('document-estado-filter').value
                });
                
                const res = await fetch('/api/documentos?' + q);
                const data = await res.json();
                const tbody = document.getElementById('document-list-body');
                tbody.innerHTML = '';
                
                if(data.documents && data.documents.length > 0) {
                    data.documents.forEach(doc => {
                        const tituloSeguro = JSON.stringify(doc.titulo);
                        tbody.innerHTML += "<tr>" +
                            "<td><strong>" + doc.titulo + "</strong><br><small>" + doc.categoria + "</small></td>" +
                            "<td>" + (doc.comision_nombre || 'N/A') + "</td>" +
                            "<td><span style='padding:4px 8px; background:#17a2b8; color:white; border-radius:12px; font-size:0.8rem;'>" + (doc.estado||'Borrador') + "</span></td>" +
                            "<td>" + new Date(doc.fecha_subida).toLocaleDateString() + "</td>" +
                            "<td>" +
                            "<button class='cta-button secondary' style='padding:4px 8px; margin-right:5px;' onclick='viewPdf(" + doc.id + ", " + tituloSeguro + ")'>Ver</button>" +
                            "<a href='/api/documentos/" + doc.id + "/download' class='cta-button' style='background:#28a745; text-decoration:none; padding:4px 8px;'>Bajar</a>" +
                            "</td></tr>";
                    });
                } else { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No hay resultados</td></tr>'; }
                totalPages = data.totalPages || 1;
                document.getElementById('pageInfo').textContent = 'Página ' + currentPage + ' de ' + totalPages;
            }
        </script>
    ` + getSidebarFooter();
}

// 2. VISTA: SUBIR DOCUMENTOS (Lógica Dinámica)
function generateDocumentosSubirPage(comisiones, usuario) {
    let opcionesComision = comisiones.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    return getSidebarHeader('Subir Documento', 'documentos_subir', usuario) + `
        <div class="info-card" style="max-width: 600px; margin: 0 auto;">
            <h3 style="margin-top: 0; color: var(--uagrm-blue);">📤 Cargar Nuevo Documento</h3>
            <p style="color:var(--text-muted); font-size:0.9rem;">El formulario se adaptará automáticamente según la categoría seleccionada.</p>
            
            <form onsubmit="handleUploadSubmit(event)" enctype="multipart/form-data" class="form-container">
                <div class="form-group full-width">
                    <label>Categoría del Documento:</label>
                    <select id="categoria" name="categoria" onchange="aplicarLogicaDinamica()" required>
                        <option value="">Seleccione una categoría...</option>
                        <option value="Informe de comision">Informe de Comisión</option>
                        <option value="Resolucion">Resolución</option>
                        <option value="Reglamento">Reglamento</option>
                        <option value="Acta">Acta</option>
                        <option value="Citacion">Citación</option>
                        <option value="Pronunciamiento">Pronunciamiento</option>
                    </select>
                </div>

                <div class="form-group full-width" id="bloque-comision" style="display:none;">
                    <label>Comisión Perteneciente:</label>
                    <select id="comision_id" name="comision_id">
                        <option value="">Seleccione...</option>
                        ${opcionesComision}
                    </select>
                </div>

                <div class="form-group full-width">
                    <label>Estado Asignado (Automático):</label>
                    <input type="text" id="estado_visible" value="Pendiente" disabled style="background:#e9ecef; font-weight:bold; color:var(--uagrm-blue);">
                    <input type="hidden" id="estado" name="estado" value="Borrador">
                </div>

                <div class="form-group full-width">
                    <label>Título:</label>
                    <input type="text" id="titulo" name="titulo" required placeholder="Se autocompleta al subir archivo...">
                </div>
                
                <div class="form-group full-width">
                    <label>Remitente / Autor:</label>
                    <input type="text" id="remitente" name="remitente" required value="Consejo Universitario">
                </div>

                <div class="drop-area" id="drop-area" style="border: 2px dashed #ccc; border-radius: 8px; padding: 30px; text-align: center; margin: 15px 0; cursor: pointer; background: #f8f9fa;">
                    <input type="file" id="archivo" name="archivo" accept="application/pdf" hidden required>
                    <p style="margin:0; font-size:1.1rem;">Haz clic aquí o arrastra un PDF</p>
                    <p id="file-name-display" style="font-weight:bold; color:var(--uagrm-blue); margin-top:10px;"></p>
                </div>

                <button type="submit" class="cta-button" style="width: 100%; padding:15px; font-size:1.1rem;">Procesar y Guardar Documento</button>
            </form>
        </div>

        <script>
            function aplicarLogicaDinamica() {
                var cat = document.getElementById('categoria').value;
                var bloqueComision = document.getElementById('bloque-comision');
                var inputComision = document.getElementById('comision_id');
                var estadoVis = document.getElementById('estado_visible');
                var estadoOculto = document.getElementById('estado');

                if (cat === 'Informe de comision') {
                    bloqueComision.style.display = 'block';
                    inputComision.required = true;
                    estadoVis.value = 'Borrador (Requiere Tratamiento)';
                    estadoOculto.value = 'Borrador';
                } else if (cat === 'Resolucion') {
                    bloqueComision.style.display = 'none';
                    inputComision.required = false; inputComision.value = '';
                    estadoVis.value = 'Aprobado (Genera Efecto Legal)';
                    estadoOculto.value = 'Aprobado';
                } else if (cat === 'Reglamento') {
                    bloqueComision.style.display = 'none';
                    inputComision.required = false; inputComision.value = '';
                    estadoVis.value = 'Promulgado (Vigente)';
                    estadoOculto.value = 'Promulgado';
                } else {
                    bloqueComision.style.display = 'none';
                    inputComision.required = false; inputComision.value = '';
                    estadoVis.value = 'General / Sin Estado Específico';
                    estadoOculto.value = 'Borrador';
                }
            }

            // Script para Drop Area
            var dropArea = document.getElementById('drop-area');
            var fileInput = document.getElementById('archivo');
            dropArea.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', function() {
                if(this.files.length > 0) {
                    document.getElementById('file-name-display').textContent = '📄 ' + this.files[0].name;
                    var tituloInput = document.getElementById('titulo');
                    if(!tituloInput.value) tituloInput.value = this.files[0].name.replace('.pdf', '');
                }
            });

            async function handleUploadSubmit(event) {
                event.preventDefault();
                var btn = event.target.querySelector('button[type="submit"]');
                btn.disabled = true; btn.textContent = 'Procesando (OCR)... Espere...';
                
                try {
                    var res = await fetch('/api/documentos', { method: 'POST', body: new FormData(event.target) });
                    var data = await res.json();
                    if(res.ok) {
                        alert('✅ Documento subido con éxito');
                        window.location.href = '/documentos/listar';
                    } else alert('❌ ' + data.error);
                } catch(e) { alert('Error de red'); } 
                finally { btn.disabled = false; btn.textContent = 'Procesar y Guardar Documento'; }
            }
        </script>
    ` + getSidebarFooter();
}

// 3. VISTA: GESTIONAR ESTADOS Y BITÁCORA
function generateDocumentosEstadosPage(usuario) {
    return getSidebarHeader('Bitácora y Estados', 'documentos_estados', usuario) + `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">
            
            <!-- Cambiar Estado -->
            <div class="info-card" style="margin:0; height:fit-content;">
                <h3 style="margin-top:0;">🔄 Cambiar Estado</h3>
                
                <!-- AQUI ESTÁ LA CORRECCIÓN: Agregamos class="form-container" -->
                <form id="formCambioEstado" onsubmit="cambiarEstado(event)" class="form-container">
                    <div class="form-grid">
                        <div class="form-group full-width">
                            <label>Buscar Documento Aprobado:</label>
                            <input type="text" id="buscarDocAprobado" placeholder="Escriba para buscar..." oninput="filtrarAprobados()" style="margin-bottom: 8px;">
                            <select id="selectDoc" size="5" style="width:100%; border: 1px solid #ccc; border-radius: 4px; padding: 8px;" required></select>
                        </div>
                        
                        <div class="form-group full-width">
                            <label>Nuevo Estado:</label>
                            <select id="nuevo_estado" required>
                                <option value="">Seleccione...</option>
                                <option value="Promulgado">Promulgado (Publicar en Gaceta)</option>
                                <option value="Derogado">Derogado (Dejar sin efecto)</option>
                            </select>
                        </div>
                        
                        <div class="form-group full-width">
                            <label>Justificación / Observación:</label>
                            <textarea id="observacion_estado" rows="3" required placeholder="Ej: Promulgado mediante resolución X..."></textarea>
                        </div>
                    </div>
                    <button type="submit" class="cta-button" style="width:100%; margin-top:15px;">Registrar Cambio</button>
                </form>
            </div>

            <!-- Bitácora -->
            <div class="info-card" style="margin:0;">
                <h3 style="margin-top:0;">📜 Bitácora Histórica de Estados</h3>
                <div class="table-responsive" style="max-height:500px; overflow-y:auto;">
                    <table class="users-table">
                        <thead><tr><th>Fecha</th><th>Documento</th><th>Cambio</th><th>Responsable / Obs.</th></tr></thead>
                        <tbody id="bitacora-body"><tr><td colspan="4">Cargando bitácora...</td></tr></tbody>
                    </table>
                </div>
            </div>
        </div>

        <script>
            let docsCache = [];
            document.addEventListener('DOMContentLoaded', async () => {
                // Cargar Documentos Aprobados
                const res = await fetch('/api/documentos?estado=Aprobado&limit=100');
                const data = await res.json();
                docsCache = data.documents || [];
                filtrarAprobados();
                // Cargar Bitácora
                cargarBitacora();
            });

            function filtrarAprobados() {
                const txt = document.getElementById('buscarDocAprobado').value.toLowerCase();
                const sel = document.getElementById('selectDoc');
                sel.innerHTML = '';
                docsCache.filter(d => d.titulo.toLowerCase().includes(txt)).forEach(d => {
                    sel.innerHTML += '<option value="' + d.id + '">' + d.titulo + '</option>';
                });
            }

            async function cambiarEstado(e) {
                e.preventDefault();
                const docId = document.getElementById('selectDoc').value;
                if(!docId) return alert('Seleccione un documento');
                
                const payload = {
                    nuevo_estado: document.getElementById('nuevo_estado').value,
                    observacion: document.getElementById('observacion_estado').value
                };

                try {
                    const res = await fetch('/api/documentos/' + docId + '/estado', {
                        method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
                    });
                    if(res.ok) {
                        alert('✅ Estado actualizado y registrado en bitácora.');
                        window.location.reload();
                    } else alert('❌ Error al actualizar el estado en el servidor.');
                } catch (error) {
                    alert('❌ Ocurrió un error de red al intentar comunicarse con el servidor.');
                }
            }

            async function cargarBitacora() {
                try {
                    const res = await fetch('/api/documentos/bitacora');
                    const datos = await res.json();
                    const tbody = document.getElementById('bitacora-body');
                    tbody.innerHTML = '';
                    if(datos.length === 0) return tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin registros</td></tr>';
                    
                    datos.forEach(b => {
                        tbody.innerHTML += "<tr>" +
                            "<td><small>" + new Date(b.fecha).toLocaleString() + "</small></td>" +
                            "<td><strong>" + b.documento_titulo + "</strong></td>" +
                            "<td><span style='color:#dc3545;text-decoration:line-through;'>" + b.estado_anterior + "</span> ➔ <span style='color:#28a745;font-weight:bold;'>" + b.estado_nuevo + "</span></td>" +
                            "<td><small>👤 " + b.usuario_nombre + "<br>📝 <i>" + b.observacion + "</i></small></td>" +
                        "</tr>";
                    });
                } catch (error) {
                    document.getElementById('bitacora-body').innerHTML = '<tr><td colspan="4" style="text-align:center; color: red;">Error al cargar bitácora</td></tr>';
                }
            }
        </script>
    ` + getSidebarFooter();
}

// ---------------------------------------------------------
// COMPONENTES: LAYOUT BASE (SIDEBAR + TOPBAR)
// ---------------------------------------------------------
function getSidebarHeader(pageTitle, activePage, usuario) {
    const p = usuario && usuario.permisos ? usuario.permisos : {};
    const nombreUsuario = usuario ? usuario.nombre : 'Usuario';
    
    let menuHtml = `<a href="/dashboard" class="${activePage === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>`;
    if (p.ver_documentos) {
        const isDocsActive = ['documentos_listar', 'documentos_subir', 'documentos_estados'].includes(activePage);
        menuHtml += `
            <div style="border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 5px;">
                <a href="#" onclick="document.getElementById('docs-submenu').style.display = document.getElementById('docs-submenu').style.display === 'none' ? 'block' : 'none';" class="${isDocsActive ? 'active' : ''}" style="display:flex; justify-content:space-between;">
                    <span>📄 Documentos</span> <span>▼</span>
                </a>
                <div id="docs-submenu" style="display: ${isDocsActive ? 'block' : 'none'}; background-color: rgba(0,0,0,0.15);">
                    <a href="/documentos/listar" class="${activePage === 'documentos_listar' ? 'active' : ''}" style="padding-left: 40px; font-size: 0.9em;">🔍 Listar y Buscar</a>
                    ${p.subir_documentos ? `<a href="/documentos/subir" class="${activePage === 'documentos_subir' ? 'active' : ''}" style="padding-left: 40px; font-size: 0.9em;">📤 Subir Documento</a>` : ''}
                    ${p.subir_documentos ? `<a href="/documentos/estados" class="${activePage === 'documentos_estados' ? 'active' : ''}" style="padding-left: 40px; font-size: 0.9em;">🔄 Gestionar Estados</a>` : ''}
                </div>
            </div>
        `;
    }
    if (p.ver_comisiones) menuHtml += `<a href="/comisiones" class="${activePage === 'comisiones' ? 'active' : ''}">📋 Comisiones</a>`;
    if (p.ver_facultades) menuHtml += `<a href="/facultades" class="${activePage === 'facultades' ? 'active' : ''}">🏛️ Facultades</a>`;
    if (p.ver_usuarios) menuHtml += `<a href="/usuarios" class="${activePage === 'usuarios' ? 'active' : ''}">👥 Usuarios</a>`;
    if (p.ver_reportes) menuHtml += `<a href="/reportes" class="${activePage === 'reportes' ? 'active' : ''}">📈 Reportes</a>`;
    if (p.ver_mi_espacio) menuHtml += `<a href="/mi_espacio" class="${activePage === 'mi_espacio' ? 'active' : ''}">👔 Mi Espacio ICU</a>`;
    if (p.gestionar_sesion) menuHtml += `<a href="/gestion_sesion" class="${activePage === 'gestion_sesion' ? 'active' : ''}">🗓️ Gestionar Sesión</a>`;

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${pageTitle} - Sistema ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .notif-wrapper { position: relative; display: inline-block; }
            .notif-bell { background: none; border: none; font-size: 1.3rem; cursor: pointer; position: relative; padding: 4px 8px; }
            .notif-count { position: absolute; top: 0; right: 0; background: var(--uagrm-red); color: white; border-radius: 50%; font-size: 0.7rem; padding: 2px 6px; font-weight: bold; }
            .notif-dropdown { display: none; position: absolute; right: 0; top: 120%; width: 320px; background: white; border: 1px solid var(--border-color); border-radius: 8px; box-shadow: 0 8px 25px rgba(0,0,0,0.15); z-index: 10002; max-height: 380px; overflow-y: auto; }
            .notif-dropdown.show { display: block; }
            .notif-item { padding: 12px 15px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background 0.2s; font-size: 0.85rem; }
            .notif-item:hover { background: #f8f9fa; }
            .notif-item.unread { background: #eef5fc; border-left: 3px solid var(--uagrm-blue); }
            .notif-item h5 { margin: 0 0 4px 0; color: var(--uagrm-blue); font-size: 0.9rem; }
            .notif-item p { margin: 0; color: var(--text-dark); }
            .notif-item small { color: var(--text-muted); display: block; margin-top: 4px; }
        </style>
    </head>
    <body>
        <div class="app-layout">
            <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>

            <aside class="sidebar" id="sidebar">
                <div class="sidebar-header">
                    <img src="/img/logo_uagrm.png" alt="Logo UAGRM" style="max-width: 60px; margin-bottom: 10px;">
                    <h2 style="border:none;">ICU UAGRM</h2>
                    <small style="color: rgba(255,255,255,0.7);">Sistema Documental</small>
                </div>
                <div class="sidebar-menu">
                    ${menuHtml}
                </div>
            </aside>

            <div class="main-content">
                <header class="topbar">
                    <div style="display:flex; align-items:center;">
                        <button class="hamburger-btn" onclick="toggleSidebar()">☰</button>
                        <h2 style="margin:0 0 0 15px; font-size:1.3rem; color:var(--uagrm-blue); border:none;">${pageTitle}</h2>
                    </div>
                    <div style="display:flex; align-items:center; gap:18px;">
                        
                        <!-- Campana de Notificaciones -->
                        <div class="notif-wrapper">
                            <button class="notif-bell" onclick="toggleNotificaciones()">
                                🔔<span class="notif-count" id="notifCount" style="display:none;">0</span>
                            </button>
                            <div class="notif-dropdown" id="notifDropdown">
                                <div style="padding: 10px 15px; background: var(--uagrm-blue); color: white; font-weight: bold; font-size: 0.9rem; border-radius: 7px 7px 0 0;">
                                    Notificaciones
                                </div>
                                <div id="notifList">
                                    <p style="padding: 15px; text-align: center; color: var(--text-muted); margin: 0;">Cargando...</p>
                                </div>
                            </div>
                        </div>

                        <span style="font-weight:600; color:var(--text-dark);">👤 ${nombreUsuario}</span>
                        <a href="/logout" class="logout-btn" style="padding: 6px 12px; font-size: 0.9rem;">Salir</a>
                    </div>
                </header>
                
                <main class="page-content-wrapper">

        <script>
            async function cargarNotificaciones() {
                try {
                    const res = await fetch('/api/notificaciones');
                    const data = await res.json();
                    const list = document.getElementById('notifList');
                    const badge = document.getElementById('notifCount');

                    if (!Array.isArray(data) || data.length === 0) {
                        list.innerHTML = '<p style="padding: 15px; text-align: center; color: var(--text-muted); margin: 0;">Sin notificaciones recientes.</p>';
                        badge.style.display = 'none';
                        return;
                    }

                    const sinLeer = data.filter(n => !n.leido).length;
                    if (sinLeer > 0) {
                        badge.textContent = sinLeer;
                        badge.style.display = 'inline-block';
                    } else {
                        badge.style.display = 'none';
                    }

                    list.innerHTML = data.map(n => \`
                        <div class="notif-item \${n.leido ? '' : 'unread'}" onclick="marcarLeida(\${n.id})">
                            <h5>\${n.titulo}</h5>
                            <p>\${n.mensaje}</p>
                            <small>\${new Date(n.created_at).toLocaleDateString()} \${new Date(n.created_at).toLocaleTimeString()}</small>
                        </div>
                    \`).join('');
                } catch (e) {
                    console.error('Error cargando notificaciones:', e);
                }
            }

            function toggleNotificaciones() {
                const dd = document.getElementById('notifDropdown');
                dd.classList.toggle('show');
            }

            async function marcarLeida(id) {
                await fetch(\`/api/notificaciones/\${id}/leida\`, { method: 'PUT' });
                cargarNotificaciones();
            }

            document.addEventListener('DOMContentLoaded', cargarNotificaciones);
            window.addEventListener('click', (e) => {
                if (!e.target.closest('.notif-wrapper')) {
                    document.getElementById('notifDropdown')?.classList.remove('show');
                }
            });
        </script>
    `;
}

function getSidebarFooter() {
    return `
                </main> <!-- Cierra page-content-wrapper -->
            </div> <!-- Cierra main-content -->
        </div> <!-- Cierra app-layout -->

        <!-- Script para abrir/cerrar la barra lateral en móviles -->
        <script>
            function toggleSidebar() {
                const sidebar = document.getElementById('sidebar');
                const overlay = document.getElementById('sidebarOverlay');
                if (sidebar && overlay) {
                    sidebar.classList.toggle('open');
                    overlay.classList.toggle('active');
                }
            }
        </script>
    </body>
    </html>
    `;
}

// ---------------------------------------------------------
// PÁGINA: GESTIÓN DE USUARIOS
// ---------------------------------------------------------
function generateUsuariosPage(data, facultades, usuario) {
    const usuarios = data.usuarios || [];
    const { permisos } = usuario;
    const usuariosActivos = usuarios.filter(u => u.es_activo);
    const usuariosInactivos = usuarios.filter(u => !u.es_activo);
    const currentPage = data.page || 1;
    const totalPages = data.totalPages || 1; 
    const currentSearch = data.search || '';

    let facultadesOptions = facultades.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('');

    let paginationHtml = '';
    if (totalPages > 1) { 
        const generatePageLink = (page) => {
            const params = new URLSearchParams({ page });
            if (currentSearch) params.set('search', currentSearch);
            return `/usuarios?${params.toString()}`;
        };
        paginationHtml = `
        <div style="display:flex; justify-content:center; gap:15px; margin-top:20px; align-items:center;">
            <a href="${generatePageLink(currentPage - 1)}" class="cta-button secondary ${currentPage === 1 ? 'disabled' : ''}" style="${currentPage === 1 ? 'pointer-events:none; opacity:0.5;' : ''}">&laquo; Anterior</a>
            <span>Página ${currentPage} de ${totalPages}</span>
            <a href="${generatePageLink(currentPage + 1)}" class="cta-button secondary ${currentPage === totalPages ? 'disabled' : ''}" style="${currentPage === totalPages ? 'pointer-events:none; opacity:0.5;' : ''}">Siguiente &raquo;</a>
        </div>`;
    }

    const formularioCrearUsuario = `
        <div class="info-card">
            <h3>Añadir Nuevo Usuario</h3>
            <form action="/api/usuarios/add" method="POST" class="form-container">
                <div class="form-grid">
                    <div class="form-group"><label>Nombre Completo:</label><input type="text" name="nombre" required></div>
                    <div class="form-group"><label>Código:</label><input type="number" name="codigo" required></div>
                    <div class="form-group"><label>Email:</label><input type="email" name="email" required></div>
                    <div class="form-group"><label>Contraseña:</label><input type="password" name="contrasena" required></div>
                    <div class="form-group full-width">
                        <label>Tipo de Usuario:</label>
                        <select id="tipo_usuario" name="tipo_usuario" onchange="toggleFields()" required>
                            <option value="consejero">Consejero</option>
                            <option value="administrativo">Administrativo</option>
                            <option value="superadmin">Superadmin</option>
                        </select>
                    </div>
                    <div class="form-group admin-field" style="display:none;"><label>Gestión:</label><input type="text" name="gestion" placeholder="Ej: 2024-2026"></div>
                    <div class="form-group admin-field" style="display:none;"><label>Función:</label><input type="text" name="funcion" placeholder="Ej: Auxiliar Administrativo"></div>
                    <div id="consejero-fields" class="full-width">
                        <div class="form-grid">
                            <div class="form-group"><label>Facultad:</label><select name="facultad_id">${facultadesOptions}</select></div>
                            <div class="form-group" style="display:flex; flex-direction:row; gap:15px; align-items:center; border:1px solid #ccc; padding:10px; border-radius:4px;">
                                <div><input type="checkbox" name="es_estudiante" id="es_est"><label for="es_est" style="display:inline; margin-left:5px;">Estudiante</label></div>
                                <div><input type="checkbox" name="es_docente" id="es_doc"><label for="es_doc" style="display:inline; margin-left:5px;">Docente</label></div>
                            </div>
                        </div>
                    </div>
                </div>
                <button type="submit" class="cta-button" style="width: 100%; margin-top: 20px;">Guardar Usuario</button>
            </form>
        </div>
    `; 

    return getSidebarHeader('Gestión de Usuarios', 'usuarios', usuario) + `
        ${permisos.crear_usuarios ? formularioCrearUsuario : ''}

        <div class="info-card">
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <input type="search" id="user-search" placeholder="Buscar por nombre, código o email..." value="${currentSearch}" style="flex:1; padding:10px; border-radius:4px; border:1px solid #ccc;">
                <button class="cta-button" onclick="performSearch()">Buscar</button>
            </div>
            
            <div class="tabs">
                <button class="tab-button active" onclick="openTab(event, 'activos')">Activos (${usuariosActivos.length})</button>
                <button class="tab-button" onclick="openTab(event, 'inactivos')">Inactivos (${usuariosInactivos.length})</button>
            </div>

            <div id="activos" class="tab-content active">
                <div class="table-responsive">
                    <table class="users-table">
                        <thead><tr><th>Usuario</th><th>Rol o Gestión</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${usuariosActivos.length > 0 ? usuariosActivos.map(u => `
                                <tr>
                                    <td><strong>${u.nombre}</strong><br><small>Código: ${u.codigo}</small></td>
                                    <td>${u.detalle_rol || u.tipo_usuario}</td>
                                    <td><span class="status-badge status-active">Activo</span></td>
                                    <td><button class="cta-button secondary" style="padding: 6px 12px; font-size: 0.9rem;" onclick='openEditModal(${JSON.stringify(u).replace(/"/g, "&quot;")})'>Editar</button></td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align: center;">No hay usuarios activos.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="inactivos" class="tab-content">
                <div class="table-responsive">
                    <table class="users-table">
                        <thead><tr><th>Usuario</th><th>Rol o Gestión</th><th>Estado</th><th>Acciones</th></tr></thead>
                        <tbody>
                            ${usuariosInactivos.length > 0 ? usuariosInactivos.map(u => `
                                <tr>
                                    <td><strong>${u.nombre}</strong><br><small>Código: ${u.codigo}</small></td>
                                    <td>${u.detalle_rol || u.tipo_usuario}</td>
                                    <td><span class="status-badge status-inactive">Inactivo</span></td>
                                    <td><button class="cta-button secondary" style="padding: 6px 12px; font-size: 0.9rem;" onclick='openEditModal(${JSON.stringify(u).replace(/"/g, "&quot;")})'>Editar</button></td>
                                </tr>
                            `).join('') : '<tr><td colspan="4" style="text-align: center;">No hay usuarios inactivos.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            ${paginationHtml}
        </div>

        <!-- Modal Editar -->
        <div id="editModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeEditModal()">&times;</span>
                <h3 style="color:var(--uagrm-blue); border-bottom:2px solid var(--uagrm-red); padding-bottom:10px; margin-top:0;">Editar Usuario</h3>
                <form id="editForm" method="POST" class="form-container">
                    <input type="hidden" id="edit-id" name="id">
                    <div class="form-grid">
                        <div class="form-group full-width"><label>Nombre:</label><input type="text" id="edit-nombre" name="nombre" required></div>
                        <div class="form-group"><label>Email:</label><input type="email" id="edit-email" name="email" required></div>
                        <div class="form-group"><label>Tipo:</label>
                            <select id="edit-tipo_usuario" name="tipo_usuario" required ${!permisos.crear_usuarios ? 'disabled' : ''}>
                                <option value="consejero">Consejero</option>
                                <option value="administrativo">Administrativo</option>
                                <option value="superadmin">Superadmin</option>
                            </select>
                        </div>
                        <div class="form-group full-width">
                            <input type="checkbox" id="edit-es_activo" name="es_activo"> <label for="edit-es_activo" style="display:inline;">Usuario Activo</label>
                        </div>
                    </div>
                    <button type="submit" class="cta-button" style="width: 100%; margin-top: 20px;">Guardar Cambios</button>
                </form>
            </div>
        </div>

        <script>
            function performSearch() {
                const searchTerm = document.getElementById('user-search').value;
                window.location.href = \`/usuarios?page=1&search=\${encodeURIComponent(searchTerm)}\`;
            }
            document.getElementById('user-search')?.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') performSearch();
            });
            function openTab(evt, tabName) {
                document.querySelectorAll(".tab-content").forEach(tab => tab.style.display = "none");
                document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
                document.getElementById(tabName).style.display = "block";
                evt.currentTarget.classList.add("active");
            }
            function toggleFields() {
                const tipo = document.getElementById('tipo_usuario').value;
                document.getElementById('consejero-fields').style.display = tipo === 'consejero' ? 'block' : 'none';
                document.querySelectorAll('.admin-field').forEach(f => f.style.display = tipo !== 'consejero' ? 'flex' : 'none');
            }
            function openEditModal(user) {
                document.getElementById('editForm').action = '/api/usuarios/edit/' + user.id;
                document.getElementById('edit-id').value = user.id;
                document.getElementById('edit-nombre').value = user.nombre;
                document.getElementById('edit-email').value = user.email;
                document.getElementById('edit-tipo_usuario').value = user.tipo_usuario;
                document.getElementById('edit-es_activo').checked = user.es_activo;
                document.getElementById('editModal').style.display = 'block';
            }
            function closeEditModal() { document.getElementById('editModal').style.display = 'none'; }
            
            document.addEventListener('DOMContentLoaded', () => {
                document.getElementById('activos').style.display = 'block';
                toggleFields();
            });
        </script>
    ` + getSidebarFooter();
}
// ---------------------------------------------------------
// PÁGINA: COMISIONES
// ---------------------------------------------------------
function generateComisionesPage(comisiones, usuario) {
    let comisionesHtml = comisiones.map(c => `
        <div class="comision-card">
            <h3 style="border:none; margin-bottom:5px;">${c.nombre}</h3>
            <p>${c.descripcion}</p>
            <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                <strong>👥 Miembros (${c.miembros.length}):</strong>
                <ul style="padding-left: 20px; color: var(--text-muted);">
                    ${c.miembros.length > 0 ? c.miembros.map(m => `<li>${m.nombre}</li>`).join('') : '<li>Sin miembros asignados.</li>'}
                </ul>
            </div>
        </div>
    `).join('');

    return getSidebarHeader('Comisiones del ICU', 'comisiones', usuario) + `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            ${comisionesHtml}
        </div>
    ` + getSidebarFooter();
}

// ---------------------------------------------------------
// PÁGINA: FACULTADES
// ---------------------------------------------------------
function generateFacultadesPage(facultades, usuario) {
    let facultadesHtml = facultades.map(f => `
        <div class="comision-card">
            <h3 style="border:none; margin-bottom:5px;">${f.nombre}</h3>
            <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 10px;">
                <p style="color:var(--uagrm-blue); font-weight:600; margin-bottom:5px;">👨‍🎓 Delegados Estudiantiles:</p>
                <ul style="padding-left: 20px; color: var(--text-muted); margin-bottom: 15px;">
                    ${f.delegados_estudiantes.length > 0 ? f.delegados_estudiantes.map(d => `<li>${d.nombre}</li>`).join('') : '<li>Pendiente de asignación.</li>'}
                </ul>
                <p style="color:var(--uagrm-red); font-weight:600; margin-bottom:5px;">👨‍🏫 Delegados Docentes:</p>
                <ul style="padding-left: 20px; color: var(--text-muted);">
                    ${f.delegados_docentes.length > 0 ? f.delegados_docentes.map(d => `<li>${d.nombre}</li>`).join('') : '<li>Pendiente de asignación.</li>'}
                </ul>
            </div>
        </div>
    `).join('');

    return getSidebarHeader('Representación Facultativa', 'facultades', usuario) + `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px;">
            ${facultadesHtml}
        </div>
    ` + getSidebarFooter();
}

// ---------------------------------------------------------
// PÁGINA: GESTIONAR SESIÓN
// ---------------------------------------------------------
function generateGestionSesionPage(sesion, documentos, docsAsociadosIds, usuario) {
    const lugares = ['Salón Provincia - Yapacani', 'Auditorio - Cs. Veterinarias', 'Auditorio - Cs. Humanidades', 'Rectorado UAGRM'];
    const temasRecurrentes = ['Lectura de correspondencia', 'Informe de comisiones', 'Temas varios', 'Aprobación de actas'];
    const temasGuardados = sesion.temas ? sesion.temas.split('|').map(t => t.trim()) : [];
    const reglamentosGuardados = sesion.reglamentos ? sesion.reglamentos.split('|').map(r => r.trim()) : [];
    const docsAsociados = Array.isArray(docsAsociadosIds) ? docsAsociadosIds : [];
    const fechaFormatted = sesion.fecha ? new Date(sesion.fecha).toISOString().split('T')[0] : '';
    const horaFormatted = sesion.hora || '';

    let documentosOptions = documentos.map(d => `<option value="${d.id}" ${docsAsociados.includes(d.id) ? 'selected' : ''}>${d.titulo}</option>`).join('');

    return getSidebarHeader('Gestionar Sesión', 'gestion_sesion', usuario) + `
        <div class="info-card">
            <h3 style="margin-bottom: 20px; border:none;">📅 Configurar Próxima Sesión ICU</h3>
            <form action="/api/sesion/update" method="POST" id="sesionForm" class="form-container">
                <input type="hidden" name="sesion_id" id="sesion_id" value="${sesion.id || ''}">
                
                <div class="form-grid">
                    <div class="form-group"><label>Tipo de Sesión:</label>
                        <select name="tipo" required>
                            <option value="Ordinaria" ${sesion.tipo === 'Ordinaria' ? 'selected' : ''}>Ordinaria</option>
                            <option value="Extraordinaria" ${sesion.tipo === 'Extraordinaria' ? 'selected' : ''}>Extraordinaria</option>
                        </select>
                    </div>
                    <div class="form-group"><label>Lugar:</label>
                        <select name="lugar" required>${lugares.map(l => `<option value="${l}" ${sesion.lugar === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
                    </div>
                    <div class="form-group"><label>Fecha:</label><input type="date" name="fecha" value="${fechaFormatted}" required></div>
                    <div class="form-group"><label>Hora:</label><input type="time" name="hora" value="${horaFormatted}" required></div>
                    
                    <div class="form-group full-width">
                        <label>Temas Recurrentes:</label>
                        <div style="display:flex; gap:15px; flex-wrap:wrap; padding:15px; border:1px solid #ccc; border-radius:4px; background:#f8f9fa;">
                            ${temasRecurrentes.map(t => `<div style="display:flex; align-items:center;"><input type="checkbox" name="temas_recurrentes" value="${t}" ${temasGuardados.includes(t) ? 'checked' : ''} style="margin:0 8px 0 0;"> <label style="margin:0; font-weight:normal;">${t}</label></div>`).join('')}
                        </div>
                    </div>

                    <div class="form-group full-width">
                        <label>Temas Nuevos (uno por línea):</label>
                        <textarea name="temas_nuevos" rows="3">${temasGuardados.filter(t => !temasRecurrentes.includes(t)).join('\n')}</textarea>
                    </div>
                    
                    <div class="form-group full-width">
                        <label>Documentos para la sesión (Ctrl+Click para selección múltiple):</label>
                        <select name="documentos" id="documentos" multiple size="6">${documentosOptions}</select>
                    </div>

                    <div class="form-group full-width">
                        <label>Reglamentos a revisar (Sugeridos por el sistema, uno por línea):</label>
                        <textarea name="reglamentos" id="reglamentos" rows="3">${reglamentosGuardados.join('\n')}</textarea>
                    </div>
                </div>

                <div style="display:flex; gap:15px; margin-top:25px; flex-wrap:wrap;">
                    <button type="submit" class="cta-button" style="flex:2; min-width:250px;">Guardar y Sugerir Reglamentos</button>
                    <button type="button" class="cta-button secondary" style="flex:1; min-width:200px;" onclick="prepararNuevaSesion()">Limpiar para Nueva Sesión</button>
                </div>
            </form>
             ${sesion.id ? `
                            <a href="/sesion_en_vivo/${sesion.id}" class="cta-button" style="background-color:#28a745; text-decoration:none; padding:10px 20px; display:inline-block;">
                                🔴 Ir al Panel "Día de la Sesión" (En Vivo)
                            </a>
                        ` : ''}
        </div>

        <script>
            function prepararNuevaSesion() {
                document.getElementById('sesionForm').reset(); 
                document.getElementById('sesion_id').value = ''; 
                alert('Formulario listo para crear una nueva sesión. Rellena los datos y guarda.');
            }
        </script>
    ` + getSidebarFooter();
}

// ---------------------------------------------------------
// PÁGINA: MI ESPACIO (Consejeros)
// ---------------------------------------------------------
function generateMiEspacioPage(usuario, proximaSesion, todosLosReglamentos, correspondenciaData) {
    const { nombre, comisiones, descripcion_rol } = usuario;
    const comisionesHtml = comisiones.map(c => `<span class="badge" style="background-color:var(--uagrm-blue); margin-right:5px;">${c.nombre}</span>`).join(' ') || '<span class="badge status-inactive">Ninguna asignada</span>';

    const sesionData = {
        tipo: proximaSesion.tipo || 'No definida',
        lugar: proximaSesion.lugar || 'No definido',
        fecha: proximaSesion.fecha ? new Date(proximaSesion.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'No definida',
        hora: proximaSesion.hora || 'No definida',
        temas: proximaSesion.temas ? proximaSesion.temas.split('|') : ['No hay temas definidos'],
        documentos: proximaSesion.documentos || [],
        reglamentos: proximaSesion.reglamentos || []
    };

    let reglamentosSugeridosHtml = '<p style="color:var(--text-muted);">Sin sugerencias de reglamentos.</p>';

    if (Array.isArray(sesionData.reglamentos) && sesionData.reglamentos.length > 0 && typeof sesionData.reglamentos[0] === 'object' && sesionData.reglamentos[0].sugerencias) {
        reglamentosSugeridosHtml = sesionData.reglamentos.map(grupo => `
            <div style="background:rgba(255,255,255,0.1); padding:15px; border-radius:8px; margin-bottom:10px;">
                <h5 style="margin:0 0 10px 0; font-size:1rem;">Sugerencias para: <strong>${grupo.documento_fuente_titulo}</strong></h5>
                <ul style="list-style:none; padding:0; margin:0;">
                    ${grupo.sugerencias.map(r => {
                        if (r.esEnlace) {
                            return `<li style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;"><span>${r.texto}</span><button class="cta-button secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="viewPdf('${r.documento_id}', '${r.documento_titulo}')">Ver Doc.</button></li>`;
                        } else {
                            return `<li style="margin-bottom:5px;"><span>${r.texto}</span></li>`;
                        }
                    }).join('')}
                </ul>
            </div>
        `).join('');
    } else if (typeof sesionData.reglamentos === 'string' && sesionData.reglamentos.trim()) {
        reglamentosSugeridosHtml = `<ul style="list-style:none; padding:0;">${sesionData.reglamentos.split('|').map(r => `<li style="background:rgba(255,255,255,0.1); padding:10px; border-radius:4px; margin-bottom:5px;">${r}</li>`).join('')}</ul>`;
    }
    
    const todosReglamentosHtml = todosLosReglamentos && todosLosReglamentos.length > 0
      ? todosLosReglamentos.map(reg => `
          <li style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
              <span style="font-size:0.95rem;">${reg.titulo}</span>
              <button class="cta-button secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="viewPdf('${reg.id}', '${reg.titulo}')">Ver</button>
          </li>
        `).join('')
      : '<li style="padding:10px;">No hay reglamentos disponibles.</li>';

    const correspondenciaHtml = correspondenciaData && correspondenciaData.length > 0
      ? correspondenciaData.map(item => {
          const fecha = new Date(item.fecha_sesion).toLocaleDateString('es-ES');
          return `<li style="padding:10px; border-bottom:1px solid #eee;">
                    <span style="display:block; font-weight:500;">${item.descripcion_tema}</span> 
                    <small style="color:var(--text-muted);">(Sesión: ${fecha})</small>
                  </li>`;
        }).join('')
      : '<li style="padding:10px;">No hay correspondencia registrada.</li>';

    return getSidebarHeader('Mi Espacio ICU', 'mi_espacio', usuario) + `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">
            
            <!-- Columna Izquierda: Perfil y Documentos -->
            <div>
                <div class="info-card">
                    <h3>Perfil del Consejero</h3>
                    <p><strong>Nombre:</strong> ${nombre}</p>
                    <p><strong>Rol:</strong> ${descripcion_rol}</p>
                    <p style="margin-top:10px;"><strong>Comisiones:</strong><br><br>${comisionesHtml}</p>
                </div>
                
                <div class="info-card">
                    <h3>Normativa Universitaria</h3>
                    <ul style="list-style:none; padding:0; margin:0; max-height: 300px; overflow-y:auto; border:1px solid #eee; border-radius:4px;">
                        ${todosReglamentosHtml}
                    </ul>
                </div>

                <div class="info-card">
                    <h3>📬 Correspondencia</h3>
                    <ul style="list-style:none; padding:0; margin:0; max-height: 300px; overflow-y:auto; border:1px solid #eee; border-radius:4px;">
                        ${correspondenciaHtml}
                    </ul>
                </div>
            </div>

            <!-- Columna Derecha: Agenda de Sesión -->
            <div>
                <div class="session-card" style="background: linear-gradient(135deg, var(--uagrm-blue), #0055a4); color:white; padding:2rem; border-radius:8px; box-shadow:0 10px 20px rgba(0,0,0,0.1);">
                    <h2 style="margin-top:0; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:10px;">Próxima Sesión del ICU</h2>
                    
                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:15px; margin-top:20px; text-align:center;">
                        <div style="background:rgba(255,255,255,0.15); padding:15px; border-radius:8px;"><strong>Tipo</strong><br><span style="font-size:1.1rem;">${sesionData.tipo}</span></div>
                        <div style="background:rgba(255,255,255,0.15); padding:15px; border-radius:8px;"><strong>Fecha</strong><br><span style="font-size:1.1rem;">${sesionData.fecha}</span></div>
                        <div style="background:rgba(255,255,255,0.15); padding:15px; border-radius:8px;"><strong>Hora</strong><br><span style="font-size:1.1rem;">${sesionData.hora}</span></div>
                        <div style="background:rgba(255,255,255,0.15); padding:15px; border-radius:8px; grid-column: 1 / -1;"><strong>Lugar</strong><br><span style="font-size:1.1rem;">${sesionData.lugar}</span></div>
                    </div>
                    
                    <h4 style="margin-top:30px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px;">Temas a Tratar</h4>
                    <ul style="list-style:none; padding:0;">
                        ${sesionData.temas.map(t => `<li style="background:rgba(255,255,255,0.1); padding:10px; border-radius:4px; margin-bottom:5px;">${t}</li>`).join('')}
                    </ul>

                    <h4 style="margin-top:20px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px;">Documentos para la Sesión</h4>
                    <ul style="list-style:none; padding:0;">
                        ${sesionData.documentos.length > 0 ? sesionData.documentos.map(d => `<li style="background:rgba(255,255,255,0.1); padding:10px; border-radius:4px; margin-bottom:5px;"><a href="/api/documentos/${d.id}/download" target="_blank" style="color:white; text-decoration:none; font-weight:600;">📄 ${d.titulo}</a></li>`).join('') : '<li style="padding:10px;">No hay documentos adjuntos.</li>'}
                    </ul>

                    <h4 style="margin-top:20px; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px;">Reglamentos y Resoluciones a Revisar</h4>
                    ${reglamentosSugeridosHtml}
                </div>
            </div>
        </div>

        <!-- Modal PDF a Pantalla Completa -->
        <div id="pdfModal" class="modal" style="display:none; position:fixed; z-index:10000; left:0; top:0; width:100%; height:100%; background-color:rgba(0,0,0,0.7); backdrop-filter: blur(3px);">
            <div style="background-color:#fff; margin:2% auto; width:90%; max-width:1400px; height:90vh; border-radius:8px; display:flex; flex-direction:column; overflow:hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="background:#0055a4; padding:15px 20px; display:flex; justify-content:space-between; align-items:center; color:white;">
                    <h2 id="pdfModalTitle" style="margin:0; font-size:1.2rem; color:white;">Previsualización de Documento</h2>
                    <span onclick="closePdfModal()" style="cursor:pointer; font-size:1.8rem; font-weight:bold; line-height:1; color:white;">&times;</span>
                </div>
                <iframe id="pdfViewer" style="width:100%; height:100%; flex-grow:1; border:none; background-color:#525659;" frameborder="0"></iframe>
            </div>
        </div>

        <script>
            function viewPdf(docId, docTitle) {
                const modal = document.getElementById('pdfModal');
                const viewer = document.getElementById('pdfViewer');
                if (modal && viewer) {
                    document.getElementById('pdfModalTitle').textContent = docTitle;
                    viewer.src = \`/api/documentos/\${docId}/preview\`;
                    modal.style.display = 'block';
                }
            }
            function closePdfModal() {
                const modal = document.getElementById('pdfModal');
                const viewer = document.getElementById('pdfViewer');
                if (modal && viewer) {
                    viewer.src = '';
                    modal.style.display = 'none';
                }
            }
        </script>
    ` + getSidebarFooter();
}

// ---------------------------------------------------------
// PÁGINA: DÍA DE LA SESIÓN (Asistencia y Tratamiento)
// ---------------------------------------------------------
function generateDiaSesionPage(sesion, consejeros, documentosSesion, todosDocumentosAprobados, usuario) {
    const esFinalizada = sesion.estado === 'Finalizada';
    const esSuperAdmin = usuario.tipo_usuario === 'superadmin';
    const bloqueado = esFinalizada && !esSuperAdmin;
    const sesionId = sesion.id ? parseInt(sesion.id, 10) : 0;

    const fechaFormateada = new Date(sesion.fecha).toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    // 1. AGRUPAR CONSEJEROS POR FACULTAD Y TIPO
    const consejerosAgrupados = {};
    consejeros.forEach(c => {
        const facultad = c.facultad_nombre || 'Representación Directa / Gremios';
        if (!consejerosAgrupados[facultad]) {
            consejerosAgrupados[facultad] = { docentes: [], estudiantes: [], otros: [] };
        }
        if (c.es_docente) {
            consejerosAgrupados[facultad].docentes.push(c);
        } else if (c.es_estudiante) {
            consejerosAgrupados[facultad].estudiantes.push(c);
        } else {
            consejerosAgrupados[facultad].otros.push(c);
        }
    });

    // 2. GENERAR HTML DE LA LISTA DE ASISTENCIA VERTICAL
    let asistenciaHtml = '';
    for (const [facultad, grupos] of Object.entries(consejerosAgrupados)) {
        asistenciaHtml += `
            <div style="margin-bottom: 12px; border: 1px solid #dee2e6; border-radius: 6px; overflow: hidden; background: white;">
                <div style="background-color: #e9ecef; padding: 8px 12px; font-weight: bold; border-bottom: 1px solid #dee2e6; color: var(--uagrm-blue);">
                    🏛️ ${facultad}
                </div>
                <div style="display: flex; flex-direction: column;">
        `;
        
        const renderItem = (c) => `
            <div class="vertical-item">
                <label for="asist_${c.id}" style="margin:0; cursor:pointer; flex:1; font-size:0.9rem;">
                    ${c.nombre}
                </label>
                <input type="checkbox" id="asist_${c.id}" class="check-asistencia" value="${c.id}" 
                    ${c.asistio ? 'checked' : ''} ${bloqueado ? 'disabled' : ''} style="width:18px; height:18px; cursor:pointer;">
            </div>
        `;

        if (grupos.docentes.length > 0) {
            asistenciaHtml += `<div class="sub-header-rol">👨‍🏫 Docentes</div>`;
            grupos.docentes.forEach(c => asistenciaHtml += renderItem(c));
        }
        
        if (grupos.estudiantes.length > 0) {
            asistenciaHtml += `<div class="sub-header-rol">👨‍🎓 Estudiantes</div>`;
            grupos.estudiantes.forEach(c => asistenciaHtml += renderItem(c));
        }

        if (grupos.otros.length > 0) {
            asistenciaHtml += `<div class="sub-header-rol">👥 Otros Delegados</div>`;
            grupos.otros.forEach(c => asistenciaHtml += renderItem(c));
        }
        
        asistenciaHtml += `</div></div>`;
    }

    return getSidebarHeader(`Sesión en Vivo: ${sesion.tipo}`, 'gestion_sesion', usuario) + `
        <style>
            .sesion-header-card {
                background: linear-gradient(135deg, var(--uagrm-blue), #0055a4);
                color: white;
                border-radius: 8px;
                padding: 1.5rem 2rem;
                margin-bottom: 2rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 15px;
            }
            .sesion-badge-estado {
                padding: 6px 14px;
                border-radius: 20px;
                font-weight: bold;
                font-size: 0.9rem;
                text-transform: uppercase;
                background-color: ${esFinalizada ? '#dc3545' : '#28a745'};
                color: white;
            }
            .asistencia-container {
                max-height: 500px;
                overflow-y: auto;
                padding: 10px;
                background: #f8f9fa;
                border: 1px solid var(--border-color);
                border-radius: 6px;
            }
            .vertical-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 15px;
                border-bottom: 1px solid #eee;
                transition: background 0.2s;
            }
            .vertical-item:hover {
                background-color: #f1f5f9;
            }
            .vertical-item:last-child {
                border-bottom: none;
            }
            .sub-header-rol {
                padding: 4px 15px;
                background: #f8f9fa;
                font-size: 0.8rem;
                font-weight: bold;
                color: #6c757d;
                border-bottom: 1px solid #eee;
                border-top: 1px solid #eee;
            }
            .sub-header-rol:first-child {
                border-top: none;
            }
            .tratamiento-table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
            }
            .tratamiento-table th, .tratamiento-table td {
                border: 1px solid var(--border-color);
                padding: 10px;
                text-align: left;
                vertical-align: top;
            }
            .tratamiento-table th {
                background-color: var(--uagrm-blue);
                color: white;
            }
            .box-deroga-panel {
                margin-top: 8px;
                padding: 8px;
                background: #f1f5f9;
                border-radius: 6px;
                border: 1px solid #cbd5e1;
            }
        </style>

        <div class="sesion-header-card">
            <div>
                <h1 style="margin: 0; font-size: 1.6rem; color: white; border: none;">Sesión ${sesion.tipo} - ICU</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">📅 ${fechaFormateada} | ⏰ ${sesion.hora} | 📍 ${sesion.lugar}</p>
            </div>
            <div style="display:flex; align-items:center; gap: 15px;">
                <span class="sesion-badge-estado">${sesion.estado}</span>
                ${esFinalizada ? `
                    <a href="/api/sesion/${sesionId}/resumen-pdf" target="_blank" class="cta-button" style="background-color: #ffc107; color: #000; padding: 8px 16px;">📄 Descargar Acta PDF</a>
                ` : ''}
            </div>
        </div>

        ${bloqueado ? `
            <div style="background:#fff3cd; border-left:4px solid #ffc107; padding:15px; border-radius:4px; margin-bottom:20px; color:#856404;">
                <strong>⚠️ Sesión Finalizada:</strong> Esta sesión ya ha sido concluida. Los registros se encuentran bloqueados para edición.
            </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px;">
            
            <!-- BLOQUE 1: LISTA DE ASISTENCIA VERTICAL -->
            <div class="info-card" style="margin: 0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="margin:0;">📋 Asistencia por Facultades</h3>
                    ${!bloqueado ? `
                        <button type="button" class="cta-button secondary" style="padding:4px 10px; font-size:0.8rem;" onclick="marcarTodos(true)">Marcar Todos</button>
                    ` : ''}
                </div>
                <form id="formAsistencia" onsubmit="return false;">
                    <div class="asistencia-container">
                        ${asistenciaHtml}
                    </div>
                    ${!bloqueado ? `
                        <button type="button" id="btnGuardarAsistencia" class="cta-button" style="width:100%; margin-top:15px;" onclick="guardarAsistencia(true)">💾 Guardar Asistencia Solo</button>
                    ` : ''}
                </form>
            </div>

            <!-- BLOQUE 2: TRATAMIENTO DE DOCUMENTOS -->
            <div class="info-card" style="margin: 0;">
                <h3 style="margin-top:0;">📑 Tratamiento de Documentos en Agenda</h3>
                
                ${documentosSesion.length > 0 ? `
                    <div class="table-responsive">
                        <table class="tratamiento-table">
                            <thead>
                                <tr>
                                    <th>Documento</th>
                                    <th style="width:130px;">Resultado</th>
                                    <th>Detalles / Derogación</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${documentosSesion.map(d => `
                                    <tr class="row-doc" data-doc-id="${d.id}">
                                        <td>
                                            <strong>${d.titulo}</strong><br>
                                            <small style="color:var(--text-muted);">${d.categoria}</small>
                                        </td>
                                        <td>
                                            <select class="select-resultado" onchange="cambioResultado(this, ${d.id})" ${bloqueado ? 'disabled' : ''} style="padding:6px; width:100%;">
                                                <option value="Pendiente" ${d.estado_tratamiento === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                                <option value="Aprobado" ${d.estado_tratamiento === 'Aprobado' ? 'selected' : ''}>Aprobado</option>
                                                <option value="Rechazado" ${d.estado_tratamiento === 'Rechazado' ? 'selected' : ''}>Rechazado</option>
                                            </select>
                                        </td>
                                        <td>
                                            <input type="text" class="input-obs" placeholder="Observación opcional..." value="${d.observacion || ''}" ${bloqueado ? 'disabled' : ''} style="width:100%; padding:6px;">
                                            
                                            <div id="deroga_box_${d.id}" class="box-deroga-panel" style="display: ${d.estado_tratamiento === 'Aprobado' ? 'block' : 'none'};">
                                                <label style="font-size:0.8rem; font-weight:bold; color:var(--uagrm-red); display:block; margin-bottom:4px;">
                                                    ¿Este documento deroga otra norma?
                                                </label>
                                                <select class="select-deroga" ${bloqueado ? 'disabled' : ''} style="width:100%; padding:5px; font-size:0.85rem;">
                                                    <option value="no" selected>No</option>
                                                    <option value="si">Sí</option>
                                                </select>
                                            </div>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : '<p style="color:var(--text-muted);">No hay documentos agendados para esta sesión.</p>'}

                ${!bloqueado ? `
                    <div style="margin-top:25px; border-top:2px solid var(--border-color); padding-top:15px;">
                        <button type="button" id="btnFinalizarSesion" class="cta-button" style="width:100%;" onclick="finalizarSesion()">🏁 Guardar Todo y Finalizar Sesión</button>
                    </div>
                ` : ''}
            </div>
        </div>

        <script>
            var SESION_ID = ${sesionId};

            function marcarTodos(estado) {
                var checks = document.querySelectorAll('.check-asistencia');
                for (var i = 0; i < checks.length; i++) {
                    checks[i].checked = estado;
                }
            }

            function cambioResultado(selectEl, docId) {
                var box = document.getElementById('deroga_box_' + docId);
                if (box) {
                    box.style.display = (selectEl.value === 'Aprobado') ? 'block' : 'none';
                }
            }

            async function guardarAsistencia(mostrarAlerta) {
                if (mostrarAlerta === undefined) mostrarAlerta = true;

                var asistencias = [];
                document.querySelectorAll('.check-asistencia').forEach(function(chk) {
                    asistencias.push({
                        usuario_id: parseInt(chk.value, 10),
                        asistio: chk.checked
                    });
                });

                try {
                    var btn = document.getElementById('btnGuardarAsistencia');
                    if (btn) btn.disabled = true;

                    var res = await fetch('/api/sesion/' + SESION_ID + '/asistencia', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ asistencias: asistencias })
                    });
                    
                    var data = await res.json();
                    if (btn) btn.disabled = false;

                    if (res.ok && data.success) {
                        if (mostrarAlerta) alert('✅ Asistencia guardada correctamente.');
                        return true;
                    } else {
                        throw new Error(data.error || 'No se pudo guardar la asistencia');
                    }
                } catch (e) {
                    var btn = document.getElementById('btnGuardarAsistencia');
                    if (btn) btn.disabled = false;
                    alert('❌ Error: ' + e.message);
                    return false;
                }
            }

            async function finalizarSesion() {
                if (!confirm('¿Confirma que desea finalizar la sesión? Se guardará la asistencia y el tratamiento de documentos automáticamente.')) {
                    return;
                }

                var btnFin = document.getElementById('btnFinalizarSesion');
                if (btnFin) {
                    btnFin.disabled = true;
                    btnFin.textContent = '⏳ Procesando... Por favor, espere.';
                }

                try {
                    // Recolectar asistencias
                    var asistencias = [];
                    document.querySelectorAll('.check-asistencia').forEach(function(chk) {
                        asistencias.push({
                            usuario_id: parseInt(chk.value, 10),
                            asistio: chk.checked
                        });
                    });

                    // Recolectar tratamiento
                    var docTratamiento = [];
                    document.querySelectorAll('.row-doc').forEach(function(row) {
                        docTratamiento.push({
                            documento_id: parseInt(row.getAttribute('data-doc-id'), 10),
                            estado_tratamiento: row.querySelector('.select-resultado').value,
                            observacion: row.querySelector('.input-obs').value
                        });
                    });

                    // Enviar todo en una sola petición al endpoint unificado
                    var res = await fetch('/api/sesion/' + SESION_ID + '/finalizar', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({ 
                            asistencias: asistencias,
                            documentos_tratamiento: docTratamiento 
                        })
                    });
                    
                    var data = await res.json();

                    if (res.ok && data.success) {
                        alert('🎉 ¡Sesión Finalizada con Éxito!');
                        // Forzamos el refresco limpio ignorando el caché
                        window.location.reload(true);
                    } else {
                        throw new Error(data.error || 'No se pudo aplicar el cambio en la base de datos.');
                    }
                } catch (e) {
                    console.error('Fallo capturado:', e);
                    alert('❌ Error al finalizar la sesión: ' + e.message);
                    if (btnFin) {
                        btnFin.disabled = false;
                        btnFin.textContent = '🏁 Guardar Todo y Finalizar Sesión';
                    }
                }
            }
        </script>
    ` + getSidebarFooter();
}
module.exports = {
    getSidebarHeader,  
    getSidebarFooter,   
    generateDashboardPage,
    generateUsuariosPage,
    generateComisionesPage,
    generateFacultadesPage,
    generateMiEspacioPage,
    generateGestionSesionPage,
    generateDiaSesionPage,
    generateDocumentosListarPage, generateDocumentosSubirPage, generateDocumentosEstadosPage
};