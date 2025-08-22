

// Funciones auxiliares para generar páginas HTML
function generateUsersPage(resultado, facultades, usuario) {
  const permisos = usuario.permisos;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Usuarios - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .users-container {
                max-width: 1400px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .users-grid {
                display: grid;
                gap: 1rem;
                margin-top: 2rem;
            }
            .user-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #007BFF;
            }
            .user-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
            }
            .user-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 0.5rem;
                margin: 1rem 0;
            }
            .role-badge {
                padding: 0.25rem 0.75rem;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
                color: white;
            }
            .role-administrativo { background-color: #dc3545; }
            .role-consejero { background-color: #28a745; }
            .role-directiva { background-color: #007BFF; }
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                transition: background-color 0.3s ease;
                margin: 0.25rem;
            }
            .btn-primary { background-color: #007BFF; color: white; }
            .btn-success { background-color: #28a745; color: white; }
            .btn-info { background-color: #17a2b8; color: white; }
            .form-section {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                margin-bottom: 2rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ${!permisos.crear_usuarios ? 'display: none;' : ''}
            }
            .form-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 1rem;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-control {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .pagination {
                display: flex;
                justify-content: center;
                gap: 0.5rem;
                margin: 2rem 0;
            }
            .pagination a {
                padding: 0.5rem 0.75rem;
                border: 1px solid #dee2e6;
                color: #007BFF;
                text-decoration: none;
                border-radius: 4px;
            }
            .pagination a.active {
                background-color: #007BFF;
                color: white;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 2rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .search-controls {
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios" class="active">👥 Usuarios</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="users-container">
            <div class="welcome-card">
                <h1>👥 Gestión de Usuarios del Sistema ICU</h1>
                <p>Total de usuarios: <strong>${resultado.total}</strong> | Página ${resultado.page} de ${resultado.totalPages}</p>
            </div>

            ${permisos.crear_usuarios ? `
            <div class="form-section">
                <h3>➕ Crear Nuevo Usuario</h3>
                <form id="userForm">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="codigo">Código *</label>
                            <input type="number" id="codigo" name="codigo" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="nombre">Nombre completo *</label>
                            <input type="text" id="nombre" name="nombre" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email *</label>
                            <input type="email" id="email" name="email" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="contrasena">Contraseña *</label>
                            <input type="password" id="contrasena" name="contrasena" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="tipo_usuario">Tipo de usuario *</label>
                            <select id="tipo_usuario" name="tipo_usuario" class="form-control" required onchange="toggleRoleFields()">
                                <option value="">Seleccionar...</option>
                                <option value="administrativo">Administrativo</option>
                                <option value="consejero">Consejero</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="gestion">Gestión *</label>
                            <input type="text" id="gestion" name="gestion" class="form-control" value="2025-2026" required>
                        </div>
                    </div>
                    
                    <!-- Campos específicos para administrativo -->
                    <div id="administrativo-fields" style="display: none;">
                        <div class="form-group">
                            <label for="funcion">Función</label>
                            <input type="text" id="funcion" name="funcion" class="form-control" placeholder="Ej: Secretario General">
                        </div>
                    </div>
                    
                    <!-- Campos específicos para consejero -->
                    <div id="consejero-fields" style="display: none;">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="facultad_id">Facultad</label>
                                <select id="facultad_id" name="facultad_id" class="form-control">
                                    <option value="">Seleccionar facultad...</option>
                                    ${facultades.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="es_estudiante" name="es_estudiante" value="true"> Es estudiante
                                </label>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="es_docente" name="es_docente" value="true"> Es docente
                                </label>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="es_directiva" name="es_directiva" value="true"> Es miembro de directiva
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-success">➕ Crear Usuario</button>
                </form>
            </div>
            ` : ''}

            <div class="search-section">
                <div class="search-controls">
                    <input type="text" id="searchInput" placeholder="🔍 Buscar usuarios..." class="form-control" style="max-width: 300px;">
                    <select id="tipoFilter" class="form-control" style="max-width: 200px;">
                        <option value="">Todos los tipos</option>
                        <option value="administrativo">Administrativos</option>
                        <option value="consejero">Consejeros</option>
                    </select>
                    <button onclick="filtrarUsuarios()" class="btn btn-info">🔄 Filtrar</button>
                </div>
            </div>

            <div class="users-grid" id="usersContainer">
                ${resultado.usuarios.map(user => `
                    <div class="user-card">
                        <div class="user-header">
                            <div>
                                <h4>${user.nombre}</h4>
                                <span class="role-badge role-${user.tipo_usuario}">
                                    ${user.tipo_usuario.toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <span><strong>#${user.codigo}</strong></span>
                            </div>
                        </div>
                        
                        <div class="user-info">
                            <div><strong>Email:</strong> ${user.email}</div>
                            <div><strong>Estado:</strong> ${user.es_activo ? '✅ Activo' : '❌ Inactivo'}</div>
                            <div><strong>Creado:</strong> ${new Date(user.created_at).toLocaleDateString()}</div>
                            ${user.detalle_rol ? `<div><strong>Rol:</strong> ${user.detalle_rol}</div>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>

            ${resultado.totalPages > 1 ? `
            <div class="pagination">
                ${resultado.page > 1 ? `<a href="?page=${resultado.page - 1}">&laquo; Anterior</a>` : ''}
                ${Array.from({length: Math.min(resultado.totalPages, 5)}, (_, i) => {
                    const pageNum = i + Math.max(1, resultado.page - 2);
                    return pageNum <= resultado.totalPages ? 
                        `<a href="?page=${pageNum}" ${pageNum === resultado.page ? 'class="active"' : ''}>${pageNum}</a>` : '';
                }).join('')}
                ${resultado.page < resultado.totalPages ? `<a href="?page=${resultado.page + 1}">Siguiente &raquo;</a>` : ''}
            </div>
            ` : ''}
        </div>

        <script>
            function toggleRoleFields() {
                const tipoUsuario = document.getElementById('tipo_usuario').value;
                const adminFields = document.getElementById('administrativo-fields');
                const consejeroFields = document.getElementById('consejero-fields');
                
                adminFields.style.display = tipoUsuario === 'administrativo' ? 'block' : 'none';
                consejeroFields.style.display = tipoUsuario === 'consejero' ? 'block' : 'none';
            }

            ${permisos.crear_usuarios ? `
            document.getElementById('userForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData(this);
                const userData = {};
                
                for (let [key, value] of formData.entries()) {
                    if (key === 'es_estudiante' || key === 'es_docente' || key === 'es_directiva') {
                        userData[key] = value === 'true';
                    } else {
                        userData[key] = value;
                    }
                }
                
                try {
                    const response = await fetch('/usuarios', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(userData)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        alert('✅ Usuario creado exitosamente');
                        location.reload();
                    } else {
                        alert('❌ Error: ' + result.error);
                    }
                } catch (error) {
                    alert('❌ Error de conexión: ' + error.message);
                }
            });
            ` : ''}

            function filtrarUsuarios() {
                const search = document.getElementById('searchInput').value.toLowerCase();
                const tipoFilter = document.getElementById('tipoFilter').value;
                const cards = document.querySelectorAll('.user-card');
                
                cards.forEach(card => {
                    const texto = card.textContent.toLowerCase();
                    const roleElement = card.querySelector('.role-badge');
                    const tipo = roleElement ? roleElement.textContent.toLowerCase() : '';
                    
                    const matchesSearch = texto.includes(search);
                    const matchesType = !tipoFilter || tipo.includes(tipoFilter);
                    
                    if (matchesSearch && matchesType) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            }

            // Filtrado en tiempo real
            document.getElementById('searchInput').addEventListener('input', filtrarUsuarios);
            document.getElementById('tipoFilter').addEventListener('change', filtrarUsuarios);
        </script>
    </body>
    </html>
  `;
}

function generateComisionesPage(comisiones, usuario) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comisiones ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .comisiones-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .comision-card {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                margin-bottom: 2rem;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                border-left: 4px solid #007BFF;
            }
            .comision-header {
                margin-bottom: 1.5rem;
            }
            .comision-title {
                color: #007BFF;
                margin-bottom: 0.5rem;
            }
            .miembros-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 1.5rem;
                margin-top: 1.5rem;
            }
            .rol-section {
                background: #f8f9fa;
                padding: 1.5rem;
                border-radius: 6px;
                border-left: 3px solid #28a745;
            }
            .rol-presidente {
                border-left-color: #dc3545;
                background: linear-gradient(135deg, #fff5f5, #f8f9fa);
            }
            .rol-secretario {
                border-left-color: #ffc107;
                background: linear-gradient(135deg, #fffdf5, #f8f9fa);
            }
            .rol-miembro {
                border-left-color: #17a2b8;
                background: linear-gradient(135deg, #f0f9ff, #f8f9fa);
            }
            .rol-title {
                font-weight: bold;
                margin-bottom: 0.75rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .miembro-item {
                padding: 0.75rem;
                background: white;
                border-radius: 4px;
                margin-bottom: 0.5rem;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .miembro-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .miembro-nombre {
                font-weight: 500;
                color: #333;
            }
            .miembro-meta {
                font-size: 0.9rem;
                color: #6c757d;
            }
            .tipo-badge {
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.75rem;
                font-weight: bold;
                color: white;
            }
            .badge-administrativo { background-color: #dc3545; }
            .badge-consejero { background-color: #28a745; }
            .stats-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #007BFF;
            }
            .stat-number {
                font-size: 2rem;
                font-weight: bold;
                color: #007BFF;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 2rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .empty-state {
                text-align: center;
                padding: 3rem;
                color: #6c757d;
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/comisiones" class="active">🏛️ Comisiones</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="comisiones-container">
            <div class="welcome-card">
                <h1>🏛️ Comisiones del ICU</h1>
                <p>Estructura organizacional y miembros de cada comisión</p>
            </div>

            <div class="stats-summary">
                <div class="stat-card">
                    <div class="stat-number">${comisiones.length}</div>
                    <div>Total Comisiones</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${comisiones.reduce((acc, c) => acc + c.miembros.length, 0)}</div>
                    <div>Total Miembros</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${comisiones.filter(c => c.miembros.length > 0).length}</div>
                    <div>Comisiones Activas</div>
                </div>
            </div>

            <div class="search-section">
                <input type="text" id="searchInput" placeholder="🔍 Buscar comisiones o miembros..." class="form-control">
            </div>

            <div id="comisionesContainer">
                ${comisiones.map(comision => {
                    // Organizar miembros por rol
                    const miembrosPorRol = {
                        presidente: [],
                        secretario: [],
                        miembro: []
                    };
                    
                    // Para la tabla usuario_comisiones (miembros sin rol específico)
                    comision.miembros.forEach(miembro => {
                        miembrosPorRol.miembro.push(miembro);
                    });

                    return `
                        <div class="comision-card" data-comision="${comision.nombre.toLowerCase()}">
                            <div class="comision-header">
                                <h3 class="comision-title">${comision.nombre}</h3>
                                <p>${comision.descripcion || 'Sin descripción disponible'}</p>
                                <div style="margin-top: 1rem;">
                                    <strong>👥 Total miembros:</strong> ${comision.miembros.length}
                                    <span style="margin-left: 1rem;"><strong>📅 Creada:</strong> ${new Date(comision.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            
                            ${comision.miembros.length > 0 ? `
                                <div class="miembros-grid">
                                    ${Object.entries(miembrosPorRol).map(([rol, miembros]) => {
                                        if (miembros.length === 0) return '';
                                        
                                        const iconos = {
                                            presidente: '👑',
                                            secretario: '📋',
                                            miembro: '👥'
                                        };
                                        
                                        const titulos = {
                                            presidente: 'Presidente',
                                            secretario: 'Secretario',
                                            miembro: 'Miembros'
                                        };
                                        
                                        return `
                                            <div class="rol-section rol-${rol}">
                                                <div class="rol-title">
                                                    ${iconos[rol]} ${titulos[rol]} (${miembros.length})
                                                </div>
                                                ${miembros.map(miembro => `
                                                    <div class="miembro-item">
                                                        <div class="miembro-info">
                                                            <div>
                                                                <div class="miembro-nombre">${miembro.nombre}</div>
                                                                <div class="miembro-meta">
                                                                    ${miembro.email} • Código: ${miembro.codigo}
                                                                </div>
                                                                <div class="miembro-meta">
                                                                    Asignado: ${new Date(miembro.fecha_asignacion).toLocaleDateString()}
                                                                </div>
                                                            </div>
                                                            <span class="tipo-badge badge-${miembro.tipo_usuario}">
                                                                ${miembro.tipo_usuario.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                `).join('')}
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            ` : `
                                <div class="empty-state">
                                    <h4>👥 Sin miembros asignados</h4>
                                    <p>Esta comisión aún no tiene miembros asignados.</p>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <script>
            // Funcionalidad de búsqueda
            document.getElementById('searchInput').addEventListener('input', function(e) {
                const searchTerm = e.target.value.toLowerCase();
                const cards = document.querySelectorAll('.comision-card');
                
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    if (text.includes(searchTerm)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });

            // Estadísticas en tiempo real
            function updateStats() {
                const visibleCards = document.querySelectorAll('.comision-card:not([style*="display: none"])');
                const totalMiembros = Array.from(visibleCards).reduce((acc, card) => {
                    const miembros = card.querySelectorAll('.miembro-item');
                    return acc + miembros.length;
                }, 0);
                
                // Actualizar contadores si es necesario
                console.log(\`Mostrando \${visibleCards.length} comisiones con \${totalMiembros} miembros\`);
            }
        </script>
    </body>
    </html>
  `;
}

function generateFacultadesPage(facultades, usuario) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Facultades UAGRM</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .facultades-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .facultades-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                gap: 2rem;
            }
            .facultad-card {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .facultad-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 15px rgba(0,0,0,0.15);
            }
            .facultad-header {
                background: linear-gradient(135deg, #007BFF, #0056b3);
                color: white;
                padding: 1.5rem;
                text-align: center;
            }
            .facultad-title {
                font-size: 1.1rem;
                font-weight: bold;
                margin: 0;
                line-height: 1.3;
            }
            .facultad-body {
                padding: 1.5rem;
            }
            .consejeros-section {
                margin-top: 1rem;
            }
            .consejeros-stats {
                display: flex;
                justify-content: space-around;
                margin-bottom: 1rem;
                padding: 1rem;
                background: #f8f9fa;
                border-radius: 6px;
            }
            .stat-item {
                text-align: center;
            }
            .stat-number {
                font-size: 1.5rem;
                font-weight: bold;
                color: #007BFF;
            }
            .stat-label {
                font-size: 0.8rem;
                color: #6c757d;
            }
            .consejero-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 0.75rem;
                margin: 0.5rem 0;
                background: #f8f9fa;
                border-radius: 4px;
                border-left: 3px solid #007BFF;
            }
            .consejero-info {
                flex: 1;
            }
            .consejero-nombre {
                font-weight: 500;
                margin-bottom: 0.25rem;
            }
            .consejero-meta {
                font-size: 0.9rem;
                color: #6c757d;
            }
            .consejero-badges {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }
            .role-badge {
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: bold;
                color: white;
                text-align: center;
            }
            .badge-estudiante {
                background-color: #28a745;
            }
            .badge-docente {
                background-color: #007BFF;
            }
            .badge-directiva {
                background-color: #dc3545;
            }
            .empty-state {
                text-align: center;
                padding: 2rem;
                color: #6c757d;
                font-style: italic;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 2rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .search-controls {
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .form-control {
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
            }
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            .btn-info {
                background-color: #17a2b8;
                color: white;
            }
            .overview-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .overview-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                text-align: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                border-left: 4px solid #007BFF;
            }
            .overview-number {
                font-size: 2.5rem;
                font-weight: bold;
                color: #007BFF;
                margin-bottom: 0.5rem;
            }
            .overview-label {
                color: #6c757d;
                font-weight: 500;
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/facultades" class="active">🎓 Facultades</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="facultades-container">
            <div class="welcome-card">
                <h1>🎓 Facultades de la UAGRM</h1>
                <p>Información de facultades y sus consejeros en el ICU</p>
            </div>

            <div class="overview-stats">
                <div class="overview-card">
                    <div class="overview-number">${facultades.length}</div>
                    <div class="overview-label">Total Facultades</div>
                </div>
                <div class="overview-card">
                    <div class="overview-number">${facultades.reduce((acc, f) => acc + f.consejeros.length, 0)}</div>
                    <div class="overview-label">Total Consejeros</div>
                </div>
                <div class="overview-card">
                    <div class="overview-number">${facultades.filter(f => f.consejeros.some(c => c.es_estudiante)).length}</div>
                    <div class="overview-label">Con Estudiantes</div>
                </div>
                <div class="overview-card">
                    <div class="overview-number">${facultades.filter(f => f.consejeros.some(c => c.es_docente)).length}</div>
                    <div class="overview-label">Con Docentes</div>
                </div>
            </div>

            <div class="search-section">
                <div class="search-controls">
                    <input type="text" id="searchInput" placeholder="🔍 Buscar facultades o consejeros..." class="form-control" style="min-width: 300px;">
                    <select id="tipoFilter" class="form-control">
                        <option value="">Todos los tipos</option>
                        <option value="estudiante">Solo estudiantes</option>
                        <option value="docente">Solo docentes</option>
                        <option value="directiva">Solo directiva</option>
                    </select>
                    <button onclick="filtrarFacultades()" class="btn btn-info">🔄 Filtrar</button>
                </div>
            </div>

            <div class="facultades-grid" id="facultadesContainer">
                ${facultades.map(facultad => {
                    const estudiantes = facultad.consejeros.filter(c => c.es_estudiante);
                    const docentes = facultad.consejeros.filter(c => c.es_docente);
                    const directiva = facultad.consejeros.filter(c => c.es_directiva);

                    return `
                        <div class="facultad-card" data-facultad="${facultad.nombre.toLowerCase()}">
                            <div class="facultad-header">
                                <h3 class="facultad-title">${facultad.nombre}</h3>
                            </div>
                            
                            <div class="facultad-body">
                                <div class="consejeros-stats">
                                    <div class="stat-item">
                                        <div class="stat-number">${facultad.consejeros.length}</div>
                                        <div class="stat-label">Total</div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-number">${estudiantes.length}</div>
                                        <div class="stat-label">Estudiantes</div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-number">${docentes.length}</div>
                                        <div class="stat-label">Docentes</div>
                                    </div>
                                    <div class="stat-item">
                                        <div class="stat-number">${directiva.length}</div>
                                        <div class="stat-label">Directiva</div>
                                    </div>
                                </div>
                                
                                <div class="consejeros-section">
                                    ${facultad.consejeros.length > 0 ? `
                                        <h5>👥 Consejeros ICU:</h5>
                                        ${facultad.consejeros.map(consejero => `
                                            <div class="consejero-item">
                                                <div class="consejero-info">
                                                    <div class="consejero-nombre">${consejero.nombre}</div>
                                                    <div class="consejero-meta">
                                                        ${consejero.email} • Código: ${consejero.codigo}
                                                    </div>
                                                </div>
                                                <div class="consejero-badges">
                                                    ${consejero.es_estudiante ? '<span class="role-badge badge-estudiante">Estudiante</span>' : ''}
                                                    ${consejero.es_docente ? '<span class="role-badge badge-docente">Docente</span>' : ''}
                                                    ${consejero.es_directiva ? '<span class="role-badge badge-directiva">Directiva</span>' : ''}
                                                </div>
                                            </div>
                                        `).join('')}
                                    ` : `
                                        <div class="empty-state">
                                            <p>👥 Sin consejeros ICU asignados</p>
                                        </div>
                                    `}
                                </div>
                                
                                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #eee; font-size: 0.9rem; color: #6c757d;">
                                    📅 Registrada: ${new Date(facultad.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>

        <script>
            function filtrarFacultades() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const tipoFilter = document.getElementById('tipoFilter').value;
                const cards = document.querySelectorAll('.facultad-card');
                
                cards.forEach(card => {
                    const texto = card.textContent.toLowerCase();
                    let matchesSearch = texto.includes(searchTerm);
                    let matchesFilter = true;
                    
                    if (tipoFilter) {
                        const badges = card.querySelectorAll(\`.badge-\${tipoFilter}\`);
                        matchesFilter = badges.length > 0;
                    }
                    
                    if (matchesSearch && matchesFilter) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
                
                // Actualizar estadísticas visibles
                updateVisibleStats();
            }
            
            function updateVisibleStats() {
                const visibleCards = document.querySelectorAll('.facultad-card:not([style*="display: none"])');
                let totalConsejeros = 0;
                let totalEstudiantes = 0;
                let totalDocentes = 0;
                let totalDirectiva = 0;
                
                visibleCards.forEach(card => {
                    const stats = card.querySelectorAll('.stat-number');
                    if (stats.length >= 4) {
                        totalConsejeros += parseInt(stats[0].textContent);
                        totalEstudiantes += parseInt(stats[1].textContent);
                        totalDocentes += parseInt(stats[2].textContent);
                        totalDirectiva += parseInt(stats[3].textContent);
                    }
                });
                
                console.log(\`Estadísticas filtradas: \${visibleCards.length} facultades, \${totalConsejeros} consejeros\`);
            }
            
            // Filtrado en tiempo real
            document.getElementById('searchInput').addEventListener('input', filtrarFacultades);
            document.getElementById('tipoFilter').addEventListener('change', filtrarFacultades);
        </script>
    </body>
    </html>
  `;
}// server.js - Versión con sistema de permisos
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const multer = require('multer');
const fs = require('fs');
const { pool, testConnection } = require('./config/database');
const { Usuario, SistemaUsuarios, Facultad, Comision } = require('./models/User');
const DocumentController = require('./controllers/DocumentController');
const ReportController = require('./controllers/ReportController');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = './uploads/documents/';
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB límite
  }
});

// Configurar sesiones con PostgreSQL
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'icu-secret-key-2024-super-secure',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de autenticación
function requireAuth(req, res, next) {
  if (req.session.usuario) {
    next();
  } else {
    res.redirect('/login.html?error=auth_required');
  }
}

// Middleware de autorización por rol
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session.usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    if (roles.includes(req.session.usuario.tipo_usuario) || roles.includes(req.session.usuario.rol)) {
      next();
    } else {
      res.status(403).json({ error: 'No tienes permisos para acceder a esta función' });
    }
  };
}

// Middleware para logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url} - Usuario: ${req.session.usuario?.nombre || 'Anónimo'}`);
  next();
});

// Ruta de inicio
app.get('/', async (req, res, next) => {
  try {
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('No se puede conectar a la base de datos');
    }
    next();
  } catch (error) {
    res.status(500).send(`
      <html>
      <head>
        <title>Error del Sistema</title>
        <link rel="stylesheet" href="estilos.css">
      </head>
      <body>
        <div class="container">
          <h1>Error del Sistema</h1>
          <p>No se puede conectar a la base de datos. Por favor, contacte al administrador.</p>
          <p><strong>Error:</strong> ${error.message}</p>
        </div>
      </body>
      </html>
    `);
  }
}, express.static(path.join(__dirname, 'public')));

// Ruta de login
app.post('/login', async (req, res) => {
  try {
    const { codigo, contrasena } = req.body;
    
    if (!codigo || !contrasena) {
      return res.status(400).send(`
        <html>
        <head>
          <title>Error de Login</title>
          <link rel="stylesheet" href="estilos.css">
        </head>
        <body>
          <div class="container">
            <h1>Error de Validación</h1>
            <p>Por favor, complete todos los campos.</p>
            <a href="/login.html" class="cta-button">Intentar de nuevo</a>
          </div>
        </body>
        </html>
      `);
    }

    const usuario = await Usuario.authenticate(parseInt(codigo), contrasena);
    
    if (usuario) {
      const datosCompletos = await usuario.getCompleteData();
      const comisiones = await usuario.getComisiones();

      req.session.usuario = {
        id: datosCompletos.id,
        codigo: datosCompletos.codigo,
        nombre: datosCompletos.nombre,
        email: datosCompletos.email,
        rol: datosCompletos.rol,
        descripcion_rol: datosCompletos.descripcion_rol,
        tipo_usuario: datosCompletos.tipo_usuario,
        comisiones: comisiones,
        login_time: new Date().toISOString(),
        permisos: getPermisos(datosCompletos.tipo_usuario, datosCompletos.rol)
      };

      console.log(`✅ Login exitoso: ${datosCompletos.nombre} (${datosCompletos.codigo})`);
      res.redirect('/dashboard');
    } else {
      console.log(`❌ Login fallido para código: ${codigo}`);
      res.status(401).send(`
        <html>
        <head>
          <title>Error de Login</title>
          <link rel="stylesheet" href="estilos.css">
        </head>
        <body>
          <div class="container">
            <h1>Error de Autenticación</h1>
            <p>Código o contraseña incorrectos.</p>
            <a href="/login.html" class="cta-button">Intentar de nuevo</a>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).send(`
      <html>
      <head>
        <title>Error del Sistema</title>
        <link rel="stylesheet" href="estilos.css">
      </head>
      <body>
        <div class="container">
          <h1>Error del Sistema</h1>
          <p>Ocurrió un error interno. Por favor, intente más tarde.</p>
          <a href="/login.html" class="cta-button">Volver al Login</a>
        </div>
      </body>
      </html>
    `);
  }
});

// Función para obtener permisos según el rol
function getPermisos(tipo_usuario, rol) {
  const permisos = {
    ver_usuarios: false,
    crear_usuarios: false,
    ver_documentos: false,
    subir_documentos: false,
    ver_comisiones: false,
    gestionar_comisiones: false,
    ver_reportes: false,
    generar_reportes: false,
    ver_facultades: false,
    gestionar_facultades: false
  };

  if (tipo_usuario === 'administrativo') {
    // Administrativos tienen todos los permisos
    Object.keys(permisos).forEach(key => {
      permisos[key] = true;
    });
  } else if (tipo_usuario === 'consejero') {
    // Consejeros solo pueden ver, no gestionar
    permisos.ver_documentos = true;
    permisos.ver_comisiones = true;
    permisos.ver_reportes = true;
    permisos.ver_facultades = true;
  }

  return permisos;
}

// Dashboard con permisos
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const stats = await SistemaUsuarios.getStats();
    const permisos = usuario.permisos;
    
    // Generar tarjetas según permisos
    let accionesHtml = '';
    
    if (permisos.ver_usuarios) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/usuarios'">
          <h4>👥 Usuarios</h4>
          <p>Gestionar usuarios del sistema</p>
          ${permisos.crear_usuarios ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}
        </div>
      `;
    }

    if (permisos.ver_documentos) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/documentos'">
          <h4>📄 Documentos</h4>
          <p>Gestionar documentos del ICU</p>
          ${permisos.subir_documentos ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}
        </div>
      `;
    }

    if (permisos.ver_comisiones) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/comisiones'">
          <h4>🏛️ Comisiones</h4>
          <p>Ver todas las comisiones</p>
          <span class="perm-badge view-only">👁️ Solo lectura</span>
        </div>
      `;
    }

    if (permisos.ver_reportes) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/reportes'">
          <h4>📊 Reportes</h4>
          <p>Ver reportes y análisis</p>
          ${permisos.generar_reportes ? '<span class="perm-badge">✏️ Gestión completa</span>' : '<span class="perm-badge view-only">👁️ Solo lectura</span>'}
        </div>
      `;
    }

    if (permisos.ver_facultades) {
      accionesHtml += `
        <div class="action-card" onclick="window.location.href='/facultades'">
          <h4>🎓 Facultades</h4>
          <p>Información de facultades</p>
          <span class="perm-badge view-only">👁️ Solo lectura</span>
        </div>
      `;
    }

    // Generar comisiones HTML
    let comisionesHtml = '';
    if (usuario.comisiones && usuario.comisiones.length > 0) {
      comisionesHtml = usuario.comisiones.map(comision => `
        <div class="comision-card">
          <h4>${comision.nombre}</h4>
          <p>${comision.descripcion || 'Sin descripción'}</p>
          <small>Asignado: ${new Date(comision.fecha_asignacion).toLocaleDateString()}</small>
        </div>
      `).join('');
    } else {
      comisionesHtml = '<p>No está asignado a ninguna comisión actualmente.</p>';
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dashboard ICU - ${usuario.nombre}</title>
          <link rel="stylesheet" href="estilos.css">
          <style>
              .perm-badge {
                  font-size: 0.8rem;
                  padding: 0.25rem 0.5rem;
                  border-radius: 12px;
                  font-weight: bold;
                  display: inline-block;
                  margin-top: 0.5rem;
              }
              .perm-badge {
                  background-color: #28a745;
                  color: white;
              }
              .perm-badge.view-only {
                  background-color: #6c757d;
                  color: white;
              }
              .dashboard-container {
                  max-width: 1200px;
                  margin: 2rem auto;
                  padding: 0 1rem;
              }
              .welcome-card {
                  background: linear-gradient(135deg, #007BFF, #0056b3);
                  color: white;
                  padding: 2rem;
                  border-radius: 12px;
                  margin-bottom: 2rem;
                  text-align: center;
                  box-shadow: 0 8px 32px rgba(0, 123, 255, 0.3);
              }
              .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                  gap: 1rem;
                  margin-bottom: 2rem;
              }
              .stat-card {
                  background: white;
                  padding: 1.5rem;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                  text-align: center;
                  border-left: 4px solid #007BFF;
              }
              .stat-number {
                  font-size: 2rem;
                  font-weight: bold;
                  color: #007BFF;
              }
              .quick-actions {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 1rem;
                  margin-top: 2rem;
              }
              .action-card {
                  background-color: #ffffff;
                  border: 2px solid #e9ecef;
                  border-radius: 8px;
                  padding: 1.5rem;
                  text-align: center;
                  transition: all 0.3s ease;
                  cursor: pointer;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              }
              .action-card:hover {
                  border-color: #007BFF;
                  transform: translateY(-2px);
                  box-shadow: 0 4px 15px rgba(0, 123, 255, 0.2);
              }
              .user-info, .comisiones-section {
                  background-color: #f8f9fa;
                  padding: 1.5rem;
                  border-radius: 8px;
                  margin-bottom: 2rem;
                  border: 1px solid #dee2e6;
              }
              .comision-card {
                  background: white;
                  padding: 1rem;
                  border-radius: 6px;
                  margin: 0.5rem 0;
                  border-left: 3px solid #007BFF;
              }
              .role-badge {
                  background-color: #28a745;
                  color: white;
                  padding: 0.5rem 1rem;
                  border-radius: 25px;
                  font-weight: bold;
                  display: inline-block;
                  margin: 0.5rem 0;
              }
              .logout-btn {
                  background-color: #dc3545;
                  color: white;
                  padding: 0.5rem 1rem;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                  text-decoration: none;
                  display: inline-block;
                  transition: background-color 0.3s ease;
              }
              .logout-btn:hover {
                  background-color: #c82333;
              }
          </style>
      </head>
      <body>
          <nav>
              <a href="/dashboard" class="logo">ICU Dashboard</a>
              <div class="nav-links">
                  <a href="/dashboard">Dashboard</a>
                  <span class="user-info-nav">👤 ${usuario.nombre} (${usuario.descripcion_rol})</span>
                  <a href="/logout" class="logout-btn">Cerrar Sesión</a>
              </div>
          </nav>

          <div class="dashboard-container">
              <div class="welcome-card">
                  <h1>¡Bienvenido ${usuario.nombre}!</h1>
                  <p>Usted es: <strong>${usuario.descripcion_rol}</strong></p>
                  <span class="role-badge">${usuario.rol.replace('_', ' ').toUpperCase()}</span>
              </div>

              <div class="stats-grid">
                  <div class="stat-card">
                      <div class="stat-number">${stats.total_usuarios}</div>
                      <div>Usuarios Totales</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${stats.administrativos}</div>
                      <div>Administrativos</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${stats.consejeros}</div>
                      <div>Consejeros</div>
                  </div>
                  <div class="stat-card">
                      <div class="stat-number">${stats.total_comisiones}</div>
                      <div>Comisiones</div>
                  </div>
              </div>

              <div class="user-info">
                  <h3>📋 Información del Usuario</h3>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                      <div><strong>ID:</strong> ${usuario.id}</div>
                      <div><strong>Código:</strong> ${usuario.codigo}</div>
                      <div><strong>Email:</strong> ${usuario.email}</div>
                      <div><strong>Tipo:</strong> ${usuario.tipo_usuario}</div>
                  </div>
              </div>

              <div class="comisiones-section">
                  <h3>🏛️ Mis Comisiones</h3>
                  ${comisionesHtml}
              </div>

              <h3>⚡ Módulos Disponibles</h3>
              <div class="quick-actions">
                  ${accionesHtml}
              </div>
          </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error cargando dashboard:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// =================== RUTAS DE USUARIOS ===================
app.get('/usuarios', requireAuth, requireRole(['administrativo']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    if (req.headers.accept === 'application/json') {
      const resultado = await SistemaUsuarios.getAllUsers(page, limit);
      res.json(resultado);
    } else {
      // Renderizar página HTML de usuarios
      const resultado = await SistemaUsuarios.getAllUsers(page, limit);
      const facultades = await Facultad.getAll();
      
      res.send(generateUsersPage(resultado, facultades, req.session.usuario));
    }
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/usuarios', requireAuth, requireRole(['administrativo']), async (req, res) => {
  try {
    const nuevoUsuario = await Usuario.create(req.body);
    res.json({ success: true, usuario: nuevoUsuario });
  } catch (error) {
    console.error('Error creando usuario:', error);
    res.status(500).json({ error: 'Error creando usuario', details: error.message });
  }
});

// =================== RUTAS DE DOCUMENTOS ===================
app.get('/documentos', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.getDocumentosPage(req, res);
});

app.get('/api/documentos', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.getDocumentos(req, res);
});

app.post('/api/documentos', requireAuth, requireRole(['administrativo']), upload.single('archivo'), (req, res) => {
  DocumentController.uploadDocumento(req, res);
});

app.get('/api/documentos/:id/download', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  DocumentController.downloadDocumento(req, res);
});

// =================== RUTAS DE COMISIONES ===================
app.get('/comisiones', requireAuth, requireRole(['administrativo', 'consejero']), async (req, res) => {
  try {
    const comisiones = await Comision.getAll();
    const comisionesConMiembros = await Promise.all(
      comisiones.map(async (comision) => {
        const miembros = await Comision.getMiembros(comision.id);
        return { ...comision, miembros };
      })
    );
    
    res.send(generateComisionesPage(comisionesConMiembros, req.session.usuario));
  } catch (error) {
    console.error('Error obteniendo comisiones:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// =================== RUTAS DE REPORTES ===================
app.get('/reportes', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getReportesPage(req, res);
});

app.get('/api/reportes/resumen', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getResumenGeneral(req, res);
});

app.get('/api/reportes/temporal', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getAnalisisTemporal(req, res);
});

app.get('/api/reportes/comisiones', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getDistribucionComisiones(req, res);
});

app.get('/api/reportes/palabras-clave', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getPalabrasClave(req, res);
});

app.get('/api/reportes/nlp', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getAnalisisNLP(req, res);
});

app.get('/api/reportes/recientes', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getDocumentosRecientes(req, res);
});

app.get('/api/reportes/documentos', requireAuth, requireRole(['administrativo', 'consejero']), (req, res) => {
  ReportController.getDocumentosReport(req, res);
});

// Ruta auxiliar para obtener comisiones (necesaria para filtros)
app.get('/api/comisiones', requireAuth, requireRole(['administrativo', 'consejero']), async (req, res) => {
  try {
    const comisiones = await Comision.getAll();
    res.json(comisiones);
  } catch (error) {
    console.error('Error obteniendo comisiones:', error);
    res.status(500).json({ error: 'Error obteniendo comisiones' });
  }
});

// =================== RUTAS DE FACULTADES ===================
app.get('/facultades', requireAuth, requireRole(['administrativo', 'consejero']), async (req, res) => {
  try {
    const facultades = await Facultad.getAll();
    const facultadesConConsejeros = await Promise.all(
      facultades.map(async (facultad) => {
        const result = await require('./config/database').query(`
          SELECT u.codigo, u.nombre, u.email, c.es_estudiante, c.es_docente, c.es_directiva
          FROM usuarios u
          JOIN consejeros_icu c ON u.id = c.usuario_id
          WHERE c.facultad_id = $1 AND u.es_activo = true
          ORDER BY u.nombre
        `, [facultad.id]);
        
        return { ...facultad, consejeros: result.rows };
      })
    );
    
    res.send(generateFacultadesPage(facultadesConConsejeros, req.session.usuario));
  } catch (error) {
    console.error('Error obteniendo facultades:', error);
    res.status(500).send('Error interno del servidor');
  }
});

// Logout
app.get('/logout', (req, res) => {
  const userName = req.session.usuario ? req.session.usuario.nombre : 'Usuario';
  req.session.destroy((err) => {
    if (err) {
      console.log('Error al cerrar sesión:', err);
    }
    console.log(`🚪 Logout: ${userName}`);
    res.redirect('/?logout=success');
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbConnected = await testConnection();
    const stats = await SistemaUsuarios.getStats();
    
    res.json({
      status: 'OK',
      database: dbConnected ? 'Connected' : 'Disconnected',
      timestamp: new Date().toISOString(),
      stats: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Pagina Usuarios

function generateUsersPage(resultado, facultades, usuario) {
  
  const usuarios = resultado.rows || [];
  const permisos = usuario.permisos;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Usuarios - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .users-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .users-table {
                background: white;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                margin-top: 2rem;
            }
            .table-header {
                background: #007BFF;
                color: white;
                padding: 1rem;
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr 120px;
                gap: 1rem;
                align-items: center;
                font-weight: bold;
            }
            .table-row {
                padding: 1rem;
                display: grid;
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr 120px;
                gap: 1rem;
                align-items: center;
                border-bottom: 1px solid #eee;
                transition: background-color 0.3s ease;
                overflow-wrap: break-word;
            }
            .table-row:hover {
                background-color: #f8f9fa;
            }
            .status-badge {
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
                text-align: center;
            }
            .status-active {
                background-color: #d4edda;
                color: #155724;
            }
            .status-inactive {
                background-color: #f8d7da;
                color: #721c24;
            }
            .user-type {
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.8rem;
                text-transform: capitalize;
            }
            .type-administrativo {
                background-color: #e3f2fd;
                color: #1565c0;
            }
            .type-docente {
                background-color: #f3e5f5;
                color: #7b1fa2;
            }
            .type-estudiante {
                background-color: #e8f5e8;
                color: #2e7d32;
            }
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                font-size: 0.9rem;
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
            .btn-warning {
                background-color: #ffc107;
                color: #212529;
            }
            .btn-info {
                background-color: #17a2b8;
                color: white;
            }
            .btn-small {
                padding: 0.25rem 0.5rem;
                font-size: 0.8rem;
                margin: 0 0.25rem;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .form-control {
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
            }
            .stats-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            .stat-number {
                font-size: 2rem;
                font-weight: bold;
                color: #007BFF;
            }
            .stat-label {
                color: #666;
                margin-top: 0.5rem;
            }
            .no-users {
                text-align: center;
                padding: 3rem;
                color: #666;
            }
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 2rem;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                position: relative;
            }
            .close {
                position: absolute;
                right: 1rem;
                top: 1rem;
                font-size: 1.5rem;
                cursor: pointer;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
            @media (max-width: 768px) {
                .table-header, .table-row {
                    grid-template-columns: 1fr;
                    text-align: left;
                }
                .search-section {
                    flex-direction: column;
                    align-items: stretch;
                }
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios" class="active">👥 Usuarios</a>
                <a href="/facultades">🏛️ Facultades</a>
                <a href="/comisiones">📋 Comisiones</a>
                <a href="/documentos">📄 Documentos</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="users-container">
            <div class="welcome-card">
                <h1>👥 Gestión de Usuarios</h1>
                <p>Modulo de gestion de consejeros del ICU</p>
            </div>

            <!-- Búsqueda y filtros -->
            <div class="search-section">
                <input type="text" id="searchInput" placeholder="🔍 Buscar usuarios..." class="form-control" style="flex: 1; min-width: 200px;">
                <select id="tipoFilter" class="form-control" style="width: 150px;">
                    <option value="">Todos los tipos</option>
                    <option value="administrativo">Administrativo</option>
                    <option value="docente">Docente</option>
                    <option value="estudiante">Estudiante</option>
                </select>
                <select id="estadoFilter" class="form-control" style="width: 120px;">
                    <option value="">Todos</option>
                    <option value="activo">Activos</option>
                    <option value="inactivo">Inactivos</option>
                </select>
            </div>

            <!-- Tabla de usuarios -->
            ${resultado.usuarios.length > 0 ? `
            <div class="users-table">
                <div class="table-header">
                    <span>👤 Usuario</span>
                    <span>📧 Email</span>
                    <span>🏷️ Tipo</span>
                    <span>🏛️ Facultad</span>
                    <span>📊 Estado</span>
                    <span>⚙️ Acciones</span>
                </div>
                ${resultado.usuarios.map(u => `
                <div class="table-row" data-tipo="${u.tipo_usuario}" data-activo="${u.es_activo}">
                    <div>
                        <strong>${u.nombre}</strong>
                    </div>
                    <div>${u.email}</div>
                    <div>
                        <span class="user-type type-${u.tipo_usuario}">${u.tipo_usuario}</span>
                    </div>
                    <div>${u.nombre_facultad || 'Sin asignar o administrativo'}</div>
                    <div>
                        <span class="status-badge ${u.es_activo ? 'status-active' : 'status-inactive'}">
                            ${u.es_activo ? '✅ Activo' : '❌ Inactivo'}
                        </span>
                    </div>
                    <div>
                        ${permisos.cambiar_estado_usuarios ? `
                        <button onclick="toggleUserStatus(${u.id}, ${u.es_activo})" 
                                class="btn ${u.es_activo ? 'btn-warning' : 'btn-success'} btn-small">
                            ${u.es_activo ? '⏸️' : '▶️'}
                        </button>
                        ` : ''}
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `
            `}
        </div>

        <!-- Modal para crear/editar usuario -->
        <div id="userModal" class="modal">
            <div class="modal-content">
                <span class="close" onclick="closeModal()">&times;</span>
                <h3 id="modalTitle">➕ Nuevo Usuario</h3>
                <form id="userForm">
                    <input type="hidden" id="userId" name="id">
                    
                    <div class="form-group">
                        <label for="nombre">Nombre:</label>
                        <input type="text" id="nombre" name="nombre" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="apellido">Apellido:</label>
                        <input type="text" id="apellido" name="apellido" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="email">Email:</label>
                        <input type="email" id="email" name="email" class="form-control" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="tipo_usuario">Tipo de Usuario:</label>
                        <select id="tipo_usuario" name="tipo_usuario" class="form-control" required>
                            <option value="">Seleccionar...</option>
                            <option value="administrativo">Administrativo</option>
                            <option value="docente">Docente</option>
                            <option value="estudiante">Estudiante</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="facultad_id">Facultad:</label>
                        <select id="facultad_id" name="facultad_id" class="form-control">
                            <option value="">Sin asignar</option>
                            ${facultades.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')}
                        </select>
                    </div>
                    
                    <div class="form-group" id="passwordGroup">
                        <label for="password">Contraseña:</label>
                        <input type="password" id="password" name="password" class="form-control">
                        <small>Dejar vacío para mantener la contraseña actual (solo en edición)</small>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem;">
                        <button type="button" onclick="closeModal()" class="btn" style="background: #6c757d; color: white;">Cancelar</button>
                        <button type="submit" class="btn btn-success">💾 Guardar</button>
                    </div>
                </form>
            </div>
        </div>

        <script>
            // Variables globales
            let currentUsers = [];
            
            const resultado = await SistemaUsuarios.getAllUsers();
            const usuarios = resultado.usuarios; // Extraer el array

            // Para enlazar usuarios con facultad

            const resultadoFac = await Facultad.getMiembros();
            const usuariosFac = resultadoFac.usuarios; // Extraer el array

            // Inicializar
            document.addEventListener('DOMContentLoaded', function() {
                currentUsers = ${JSON.stringify(usuarios)};
                setupEventListeners();
            });
            
            function setupEventListeners() {
                // Búsqueda en tiempo real
                document.getElementById('searchInput').addEventListener('input', filterUsers);
                document.getElementById('tipoFilter').addEventListener('change', filterUsers);
                document.getElementById('estadoFilter').addEventListener('change', filterUsers);
                
                // Form submit
                document.getElementById('userForm').addEventListener('submit', handleUserSubmit);
            }
            
            function filterUsers() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const tipoFilter = document.getElementById('tipoFilter').value;
                const estadoFilter = document.getElementById('estadoFilter').value;
                
                const rows = document.querySelectorAll('.table-row');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    const tipo = row.dataset.tipo;
                    const activo = row.dataset.activo === 'true';
                    
                    let show = true;
                    
                    // Filtro de texto
                    if (searchTerm && !text.includes(searchTerm)) {
                        show = false;
                    }
                    
                    // Filtro de tipo
                    if (tipoFilter && tipo !== tipoFilter) {
                        show = false;
                    }
                    
                    // Filtro de estado
                    if (estadoFilter === 'activo' && !activo) {
                        show = false;
                    } else if (estadoFilter === 'inactivo' && activo) {
                        show = false;
                    }
                    
                    row.style.display = show ? 'grid' : 'none';
                });
            }
            
            function openCreateModal() {
                document.getElementById('modalTitle').textContent = '➕ Nuevo Usuario';
                document.getElementById('userForm').reset();
                document.getElementById('userId').value = '';
                document.getElementById('passwordGroup').querySelector('input').required = true;
                document.getElementById('userModal').style.display = 'block';
            }
            
            function editUser(id) {
                const user = currentUsers.find(u => u.id === id);
                if (!user) return;
                
                document.getElementById('modalTitle').textContent = '✏️ Editar Usuario';
                document.getElementById('userId').value = user.id;
                document.getElementById('nombre').value = user.nombre;
                document.getElementById('apellido').value = user.apellido;
                document.getElementById('email').value = user.email;
                document.getElementById('tipo_usuario').value = user.tipo_usuario;
                document.getElementById('facultad_id').value = user.facultad_id || '';
                document.getElementById('password').value = '';
                document.getElementById('passwordGroup').querySelector('input').required = false;
                document.getElementById('userModal').style.display = 'block';
            }
            
            function closeModal() {
                document.getElementById('userModal').style.display = 'none';
            }
            
            async function handleUserSubmit(e) {
                e.preventDefault();
                
                const formData = new FormData(e.target);
                const userData = Object.fromEntries(formData.entries());
                
                const isEdit = userData.id !== '';
                const url = isEdit ? \`/api/usuarios/\${userData.id}\` : '/api/usuarios';
                const method = isEdit ? 'PUT' : 'POST';
                
                try {
                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(userData)
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        alert(\`✅ Usuario \${isEdit ? 'actualizado' : 'creado'} exitosamente\`);
                        closeModal();
                        location.reload(); // Recargar para ver cambios
                    } else {
                        alert('❌ Error: ' + result.error);
                    }
                } catch (error) {
                    alert('❌ Error de conexión: ' + error.message);
                }
            }
            
            async function toggleUserStatus(userId, currentStatus) {
                const action = currentStatus ? 'desactivar' : 'activar';
                
                if (!confirm(\`¿Estás seguro de que quieres \${action} este usuario?\`)) {
                    return;
                }
                
                try {
                    const response = await fetch(\`/api/usuarios/\${userId}/toggle-status\`, {
                        method: 'PATCH'
                    });
                    
                    const result = await response.json();
                    
                    if (response.ok) {
                        alert(\`✅ Usuario \${action}do exitosamente\`);
                        location.reload();
                    } else {
                        alert('❌ Error: ' + result.error);
                    }
                } catch (error) {
                    alert('❌ Error de conexión: ' + error.message);
                }
            }
            
            // Cerrar modal al hacer click fuera
            window.onclick = function(event) {
                const modal = document.getElementById('userModal');
                if (event.target === modal) {
                    closeModal();
                }
            }
        </script>
    </body>
    </html>
  `;
}

//Pagina de Informacion comisiones 
 
function generateComisionesPage(comisiones, usuario) {
  const permisos = usuario.permisos;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Comisiones - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .comisiones-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .comisiones-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                gap: 1.5rem;
                margin-top: 2rem;
            }
            .comision-card {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                overflow: hidden;
            }
            .comision-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .comision-header {
                background: linear-gradient(135deg, #007BFF, #0056b3);
                color: white;
                padding: 1.5rem;
                position: relative;
            }
            .comision-title {
                font-size: 1.2rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
            }
            .comision-description {
                opacity: 0.9;
                font-size: 0.9rem;
            }
            .comision-body {
                padding: 1.5rem;
            }
            .comision-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                font-size: 0.9rem;
                color: #666;
            }
            .miembro-count {
                background: #e3f2fd;
                color: #1976d2;
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
            }
            .comision-status {
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                font-size: 0.8rem;
                font-weight: bold;
            }
            .status-activa {
                background-color: #d4edda;
                color: #155724;
            }
            .status-inactiva {
                background-color: #f8d7da;
                color: #721c24;
            }
            .comision-actions {
                display: flex;
                gap: 0.5rem;
                justify-content: flex-end;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid #eee;
            }
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                font-size: 0.9rem;
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
            .btn-warning {
                background-color: #ffc107;
                color: #212529;
            }
            .btn-small {
                padding: 0.375rem 0.75rem;
                font-size: 0.8rem;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .form-control {
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
            }
            .stats-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            .stat-number {
                font-size: 2rem;
                font-weight: bold;
                color: #007BFF;
            }
            .stat-label {
                color: #666;
                margin-top: 0.5rem;
            }
            .no-comisiones {
                text-align: center;
                padding: 3rem;
                color: #666;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 2rem;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                position: relative;
                max-height: 80vh;
                overflow-y: auto;
            }
            .close {
                position: absolute;
                right: 1rem;
                top: 1rem;
                font-size: 1.5rem;
                cursor: pointer;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
            .form-group textarea {
                resize: vertical;
                min-height: 80px;
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios">👥 Usuarios</a>
                <a href="/facultades">🏛️ Facultades</a>
                <a href="/comisiones" class="active">📋 Comisiones</a>
                <a href="/documentos">📄 Documentos</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="comisiones-container">
            <div class="welcome-card">
                <h1>📋 Informacion de Comisiones</h1>
                <p>Detalles de todas las comisiones y sus miembros</p>
            </div>

            <!-- Búsqueda y filtros -->
            <div class="search-section">
                <input type="text" id="searchInput" placeholder="🔍 Buscar comisiones..." class="form-control" style="flex: 1; min-width: 200px;">
                <select id="estadoFilter" class="form-control" style="width: 150px;">
                    <option value="">Todas</option>
                </select>

            <!-- Grid de comisiones -->
            ${comisiones.length > 0 ? `
            <div class="comisiones-grid">
                ${comisiones.map(c => `
                <div class="comision-card" data-activa="${c.es_activa}">
                    <div class="comision-header">
                        <div class="comision-title">${c.nombre}</div>
                        <div class="comision-description">${c.descripcion || 'Sin descripción'}</div>
                    </div>
                    <div class="comision-body">
                        <div class="comision-meta">
                            <span class="miembro-count">👥 Miembros de la comision: 
                            </span>
                        </div>
                        <div style="font-size: 0.9rem; color: #666;">
                            <p><strong>📄 Documentos:</strong> ${c.total_documentos || 0}</p>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `
            `}
        </div>

        <script>
            // Variables globales
            let currentComisiones = [];
            
            // Inicializar
            document.addEventListener('DOMContentLoaded', function() {
                currentComisiones = ${JSON.stringify(comisiones)};
                setupEventListeners();
            });
            
            function setupEventListeners() {
                // Búsqueda y filtros
                document.getElementById('searchInput').addEventListener('input', filterComisiones);
                document.getElementById('estadoFilter').addEventListener('change', filterComisiones);
                
                // Form submit
                document.getElementById('comisionForm').addEventListener('submit', handleComisionSubmit);
            }
            
            function filterComisiones() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const estadoFilter = document.getElementById('estadoFilter').value;
                
                const cards = document.querySelectorAll('.comision-card');
                
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    const activa = card.dataset.activa === 'true';
                    
                    let show = true;
                    
                    // Filtro de texto
                    if (searchTerm && !text.includes(searchTerm)) {
                        show = false;
                    }
                    card.style.display = show ? 'block' : 'none';
                });
            }
            
 // Modal del VerMiembros - Falta implementar mostrar miembros 

            function viewComision(id) {
                const comision = currentComisiones.find(c => c.id === id);
                if (!comision) return;
                
                document.getElementById('viewModalTitle').textContent = \`👁️ \${comision.nombre}\`;
                document.getElementById('viewModalContent').innerHTML = \`
                    <div style="line-height: 1.6;">
                        <p><strong>📝 Descripción:</strong></p>
                        <p style="margin-left: 1rem; font-style: italic;">\${comision.descripcion || 'Sin descripción'}</p>
                        <p><strong>👥 Miembros:</strong> \${comision.total_miembros || 0}</p>
                        <p><strong>📄 Documentos:</strong> \${comision.total_documentos || 0}</p>
                        
                        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee;">
                            <button onclick="closeViewModal()" class="btn" style="background: #6c757d; color: white; margin-left: 1rem;">Cerrar</button>
                        </div>
                    </div>
                \`;
                document.getElementById('viewModal').style.display = 'block';
            }
            
            function closeModal() {
                document.getElementById('comisionModal').style.display = 'none';
            }
            
            function closeViewModal() {
                document.getElementById('viewModal').style.display = 'none';
            }
            
            // Cerrar modales al hacer click fuera
            window.onclick = function(event) {
                const comisionModal = document.getElementById('comisionModal');
                const viewModal = document.getElementById('viewModal');
                
                if (event.target === comisionModal) {
                    closeModal();
                } else if (event.target === viewModal) {
                    closeViewModal();
                }
            }
        </script>
    </body>
    </html>
  `;
}

//Pagina de Facultades

function generateFacultadesPage(facultades, usuario) {
  const permisos = usuario.permisos;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Gestión de Facultades - ICU</title>
        <link rel="stylesheet" href="/estilos.css">
        <style>
            .facultades-container {
                max-width: 1200px;
                margin: 2rem auto;
                padding: 0 1rem;
            }
            .facultades-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                gap: 1.5rem;
                margin-top: 2rem;
            }
            .facultad-card {
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                overflow: hidden;
                position: relative;
            }
            .facultad-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            .facultad-header {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                padding: 1.5rem;
                position: relative;
            }
            .facultad-title {
                font-size: 1.1rem;
                font-weight: bold;
                margin-bottom: 0.5rem;
                line-height: 1.3;
            }
            .facultad-code {
                opacity: 0.9;
                font-size: 0.8rem;
                background: rgba(255,255,255,0.2);
                padding: 0.25rem 0.5rem;
                border-radius: 12px;
                display: inline-block;
            }
            .facultad-body {
                padding: 1.5rem;
            }
            .facultad-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            .stat-item {
                text-align: center;
                padding: 0.75rem;
                background: #f8f9fa;
                border-radius: 6px;
            }
            .stat-number {
                font-size: 1.5rem;
                font-weight: bold;
                color: #28a745;
                display: block;
            }
            .stat-label {
                font-size: 0.8rem;
                color: #666;
                margin-top: 0.25rem;
            }
            .facultad-actions {
                display: flex;
                gap: 0.5rem;
                justify-content: flex-end;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid #eee;
            }
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
                font-size: 0.9rem;
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
            .btn-small {
                padding: 0.375rem 0.75rem;
                font-size: 0.8rem;
            }
            .search-section {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                margin-bottom: 1rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                display: flex;
                gap: 1rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .form-control {
                padding: 0.5rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
            }
            .stats-cards {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 1rem;
                margin-bottom: 2rem;
            }
            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                text-align: center;
            }
            .stat-card-number {
                font-size: 2rem;
                font-weight: bold;
                color: #28a745;
            }
            .stat-card-label {
                color: #666;
                margin-top: 0.5rem;
            }
            .no-facultades {
                text-align: center;
                padding: 3rem;
                color: #666;
                background: white;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .modal {
                display: none;
                position: fixed;
                z-index: 1000;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.5);
            }
            .modal-content {
                background-color: white;
                margin: 5% auto;
                padding: 2rem;
                border-radius: 8px;
                width: 90%;
                max-width: 500px;
                position: relative;
                max-height: 80vh;
                overflow-y: auto;
            }
            .close {
                position: absolute;
                right: 1rem;
                top: 1rem;
                font-size: 1.5rem;
                cursor: pointer;
            }
            .form-group {
                margin-bottom: 1rem;
            }
            .form-group label {
                display: block;
                margin-bottom: 0.5rem;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <nav>
            <a href="/dashboard" class="logo">ICU Dashboard</a>
            <div class="nav-links">
                <a href="/dashboard">Dashboard</a>
                <a href="/usuarios">👥 Usuarios</a>
                <a href="/facultades" class="active">🏛️ Facultades</a>
                <a href="/comisiones">📋 Comisiones</a>
                <a href="/documentos">📄 Documentos</a>
                <span class="user-info-nav">👤 ${usuario.nombre}</span>
                <a href="/logout" class="logout-btn">Cerrar Sesión</a>
            </div>
        </nav>

        <div class="facultades-container">
            <div class="welcome-card">
                <h1>🏛️ Facultades</h1>
                <p>Visualiza las facultades de la UAGRM y sus representantes</p>
            </div>

            <!-- Búsqueda -->
            <div class="search-section">
                <input type="text" id="searchInput" placeholder="🔍 Buscar facultades..." class="form-control" style="flex: 1; min-width: 200px;">
                ${permisos.crear_facultades ? `
                <button onclick="openCreateModal()" class="btn btn-success">➕ Nueva Facultad</button>
                ` : ''}
            </div>

            <!-- Grid de facultades -->
            ${facultades.length > 0 ? `
            <div class="facultades-grid">
                ${facultades.map(f => `
                <div class="facultad-card">
                    <div class="facultad-header">
                        <div class="facultad-title">${f.nombre}</div>
                    </div>
                    <div class="facultad-body">
                        <div class="facultad-stats">
                            <div class="stat-item">
                                <span class="stat-number">${f.total_usuarios || 0}</span>
                                <span class="stat-label">👨‍🎓 Cantidad total de estudiantes</span>
                            </div>
                            <div class="stat-item">
                                <span class="stat-number">${f.total_docentes || 0}</span>
                                <span class="stat-label">👨‍🏫 Cantidad total de Docentes</span>
                            </div>
                        </div>
                        <div style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                            <p><strong>👨‍🎓 Delegados estudiantes:</strong></p>
                            <p><strong>👨‍🏫 Delegados docentes:</strong></p>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
            ` : `
            `}
        </div>

        <script>
            // Variables globales
            let currentFacultades = [];
            
            // Inicializar
            document.addEventListener('DOMContentLoaded', function() {
                currentFacultades = ${JSON.stringify(facultades)};
                setupEventListeners();
            });
            
            function setupEventListeners() {
                // Búsqueda
                document.getElementById('searchInput').addEventListener('input', filterFacultades);
                
                // Form submit
                document.getElementById('facultadForm').addEventListener('submit', handleFacultadSubmit);
            }
            
            function filterFacultades() {
                const searchTerm = document.getElementById('searchInput').value.toLowerCase();
                const cards = document.querySelectorAll('.facultad-card');
                
                cards.forEach(card => {
                    const text = card.textContent.toLowerCase();
                    card.style.display = text.includes(searchTerm) ? 'block' : 'none';
                });
            }

            function closeModal() {
                document.getElementById('facultadModal').style.display = 'none';
            }
            
            function closeViewModal() {
                document.getElementById('viewModal').style.display = 'none';
            }
                
            // Cerrar modales al hacer click fuera
            window.onclick = function(event) {
                const facultadModal = document.getElementById('facultadModal');
                const viewModal = document.getElementById('viewModal');
                
                if (event.target === facultadModal) {
                    closeModal();
                } else if (event.target === viewModal) {
                    closeViewModal();
                }
            }
        </script>
    </body>
    </html>
  `;
}
// Manejo de errores
app.use((req, res) => {
  res.status(404).send(`
    <html>
    <head>
      <title>Página no encontrada</title>
      <link rel="stylesheet" href="estilos.css">
    </head>
    <body>
      <div class="container">
        <h1>404 - Página no encontrada</h1>
        <p>La página que busca no existe.</p>
        <a href="/dashboard" class="cta-button">Volver al dashboard</a>
      </div>
    </body>
    </html>
  `);
});

app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).send(`
    <html>
    <head>
      <title>Error del servidor</title>
      <link rel="stylesheet" href="estilos.css">
    </head>
    <body>
      <div class="container">
        <h1>Error interno del servidor</h1>
        <p>Ocurrió un error inesperado. Por favor, contacte al administrador.</p>
        <a href="/dashboard" class="cta-button">Volver al dashboard</a>
      </div>
    </body>
    </html>
  `);
});

// Iniciar servidor
async function startServer() {
  try {
    const connected = await testConnection();
    if (!connected) {
      throw new Error('No se puede conectar a PostgreSQL');
    }

    app.listen(port, () => {
      console.log(`🚀 Servidor ejecutándose en http://localhost:${port}`);
      console.log(`📊 Dashboard: http://localhost:${port}/dashboard`);
      console.log(`👥 Usuarios: http://localhost:${port}/usuarios`);
      console.log(`📄 Documentos: http://localhost:${port}/documentos`);
      console.log(`🏛️  Comisiones: http://localhost:${port}/comisiones`);
      console.log(`📊 Reportes: http://localhost:${port}/reportes`);
      console.log(`🎓 Facultades: http://localhost:${port}/facultades`);
      
      console.log('\n=== PERMISOS DEL SISTEMA ===');
      console.log('👑 Administrativos: Acceso total (crear, editar, eliminar)');
      console.log('👁️  Consejeros: Solo lectura (ver documentos, comisiones, facultades, reportes)');
      
      console.log('\n✅ Sistema ICU con permisos listo');
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error.message);
    process.exit(1);
  }
}

startServer();