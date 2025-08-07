
CREATE TABLE facultades (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Comisiones
CREATE TABLE comisiones (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL UNIQUE,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla base de Usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    codigo INTEGER UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    contrasena VARCHAR(20) NOT NULL,
    tipo_usuario VARCHAR(20) NOT NULL CHECK (tipo_usuario IN ('administrativo', 'consejero')),
    es_activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Administrativos
CREATE TABLE administrativos (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    funcion VARCHAR(50) NOT NULL,
    gestion VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Consejeros ICU
CREATE TABLE consejeros_icu (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    facultad_id INTEGER REFERENCES facultades(id) ON DELETE SET NULL,
    gestion VARCHAR(20) NOT NULL,
    es_estudiante BOOLEAN DEFAULT false,
    es_docente BOOLEAN DEFAULT false,
    es_directiva BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de relación Usuario-Comisión (muchos a muchos)
CREATE TABLE usuario_comisiones (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    comision_id INTEGER REFERENCES comisiones(id) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    es_activo BOOLEAN DEFAULT true,
    UNIQUE(usuario_id, comision_id)
);

-- Tabla de Documentos
CREATE TABLE documentos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    remitente VARCHAR(100),
    fecha_ingreso DATE NOT NULL,
    comision_id INTEGER REFERENCES comisiones(id) ON DELETE SET NULL,
    usuario_creador_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_usuarios_codigo ON usuarios(codigo);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo_usuario);
CREATE INDEX idx_consejeros_facultad ON consejeros_icu(facultad_id);
CREATE INDEX idx_documentos_fecha ON documentos(fecha_ingreso);

-TODO SE CREA CORRECTAMENTE-

POBLADA DB_ICU.TEXT

-- Insertar datos iniciales

-- Facultades
INSERT INTO facultades (nombre) VALUES
('FACULTAD INTEGRAL DEL CHACO (FICH)'),
('FACULTAD POLITECNICA (FP)'),
('FACULTAD DE CIENCIAS AGRICOLAS (FCA)'),
('FACULTAD DE CIENCIAS ECONOMICAS Y EMPRESARIALES (FCEE)'),
('FACULTAD DE CIENCIAS EXACTAS Y TECNOLOGIA (FCET)'),
('FACULTAD DE CIENCIAS JURIDICAS, POLITICAS, SOCIALES Y RELACIONES INTERNACIONALES (FCJPSRI)'),
('FACULTAD DE CIENCIAS VETERINARIAS (FCV)'),
('FACULTAD DE HUMANIDADES (FH)'),
('FACULTAD DE CIENCIAS DE LA SALUD HUMANA (FCSH)'),
('FACULTAD DE CIENCIAS FARMACEUTICAS Y BIOQUIMICAS (FCFB)'),
('FACULTAD DE CIENCIAS DEL HABITAT, DISEÑO Y ARTE (FCHDA)'),
('FACULTAD DE CIENCIAS CONTABLES, SISTEMAS DE CONTROL DE  GESTION Y FINANZAS (FCCSCGF)'),
('FACULTAD INTEGRAL DEL NORTE (FINOR)'),
('FACULTAD INTEGRAL DE LOS VALLES CRUCENOS (FIVC)'),
('FACULTAD INTEGRAL CHIQUITANA (FAICHI)'),
('FACULTAD INTEGRAL DE ICHILO (FINI)'),
('FACULTAD DE INGENIERIA EN CIENCIAS DE LA COMPUTACION Y TELECOMUNICACIONES (FICCT)'),
('FACULTAD INTEGRAL DEL NORESTE (FINE)'),
('FEDERACION UNIVERSITARIA DE PROFESORES (FUP)'),
('FEDERACION UNIVERSITARIA LOCAL (FUL)');

-- Comisiones
INSERT INTO comisiones (nombre, descripcion) VALUES
('Comisión Institucional y Jurídica', 'Encargada de asuntos institucionales y jurídicos'),
('Comisión de Administración, Economía y Finanzas', 'Gestión administrativa y financiera'),
('Comisión Académica', 'Asuntos académicos y curriculares'),
('Comisión Técnica de Infraestructura, Seguridad Industrial y Control del Medio Ambiente', 'Infraestructura y medio ambiente'),
('Comisión de Investigación, Ciencia e Innovación Tecnológica', 'Promoción de la investigación y innovación'),
('Comisión de Bienestar Social, Salud y Extensión', 'Bienestar estudiantil y extensión universitaria'),
('Comisión de Ética y Transparencia', 'Garantizar ética y transparencia institucional'),
('Comisión de Postgrado', 'Asuntos de estudios de postgrado'),
('Directiva ICU', 'Directiva encargada de la organizacion del ICU, conformada por consejeros estudiantes y docentes');

SELECT * FROM comisiones

-- Usuarios Administrativos
INSERT INTO usuarios (codigo, nombre, email, contrasena, tipo_usuario) VALUES
(5050, 'Franco Perlita', 'franco.perlita@icu.edu.bo', '123', 'administrativo'),
(5051, 'Jimmy Garcia Ulloa', 'jimmy.garcia@icu.edu.bo', '123', 'administrativo');

-- Usuarios Consejeros Estudiantes
INSERT INTO usuarios (codigo, nombre, email, contrasena, tipo_usuario) VALUES
(214144130, 'Miguel Angel Carrasco', 'miguel.carrasco@icu.edu.bo', '12345', 'consejero'),
(224044130, 'Reny Brayan Huallata', 'brayan.huallata@icu.edu.bo', '12345', 'consejero');

-- Usuarios Consejeros Docentes
INSERT INTO usuarios (codigo, nombre, email, contrasena, tipo_usuario) VALUES
(6060, 'Carlos Martinez Bonilla', 'carlos.martinez@icu.edu.bo', '12345', 'consejero'),
(6061, 'Edwin Calizaya', 'edwin.calizaya@icu.edu.bo', '12345', 'consejero');

-- Insertar datos en tabla administrativos
INSERT INTO administrativos (usuario_id, funcion, gestion) VALUES
((SELECT id FROM usuarios WHERE codigo = 5050), 'Auxiliar Administrativo', '2025-2026'),
((SELECT id FROM usuarios WHERE codigo = 5051), 'Coordinador General del ICU', '2025-2026');

-- Insertar datos en tabla consejeros_icu (Estudiantes)
INSERT INTO consejeros_icu (usuario_id, facultad_id, gestion, es_estudiante, es_docente, es_directiva) VALUES
((SELECT id FROM usuarios WHERE codigo = 214144130), (SELECT id FROM facultades WHERE nombre = 'FEDERACION UNIVERSITARIA LOCAL (FUL)'), '2025-2026', true, false, false),
((SELECT id FROM usuarios WHERE codigo = 224044130), (SELECT id FROM facultades WHERE nombre = 'FEDERACION UNIVERSITARIA LOCAL (FUL)'), '2025-2026', true, false, true);

-- Insertar datos en tabla consejeros_icu (Docentes)
INSERT INTO consejeros_icu (usuario_id, facultad_id, gestion, es_estudiante, es_docente, es_directiva) VALUES
((SELECT id FROM usuarios WHERE codigo = 6060), (SELECT id FROM facultades WHERE nombre = 'FACULTAD INTEGRAL CHIQUITANA (FAICHI)'), '2025-2026', false, true, true),
((SELECT id FROM usuarios WHERE codigo = 6061), (SELECT id FROM facultades WHERE nombre = 'FACULTAD DE INGENIERIA EN CIENCIAS DE LA COMPUTACION Y TELECOMUNICACIONES (FICCT)'), '2025-2026', false, true, false);

-- Asignar algunos usuarios a comisiones (ejemplos)
INSERT INTO usuario_comisiones (usuario_id, comision_id) VALUES
((SELECT id FROM usuarios WHERE codigo = 214144130), (SELECT id FROM comisiones WHERE nombre LIKE 'Directiva ICU%')),
((SELECT id FROM usuarios WHERE codigo = 6060), (SELECT id FROM comisiones WHERE nombre LIKE 'Directiva ICU%')),

-- Documentos de ejemplo
INSERT INTO documentos (titulo, remitente, fecha_ingreso, comision_id, usuario_creador_id) VALUES
('Propuesta de Calendario Academico 2026', 'Vicerrectorado', '2025-10-15',
 (SELECT id FROM comisiones WHERE nombre LIKE 'Comisión Académica%'),
 (SELECT id FROM usuarios WHERE codigo = 5051)),
('Solicitud de convenio marca', 'Rectorado', '2025-11-20',
 (SELECT id FROM comisiones WHERE nombre LIKE 'Comisión Institucional%'),
 (SELECT id FROM usuarios WHERE codigo = 5051));

-- Crear función para actualizar timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar timestamp automáticamente
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentarios para documentar las tablas
COMMENT ON TABLE usuarios IS 'Tabla principal de usuarios del sistema ICU aqui pueden ser o consejeros o administrativos';
COMMENT ON TABLE administrativos IS 'Información específica de usuarios administrativos con funciones';
COMMENT ON TABLE consejeros_icu IS 'Información específica de consejeros ICU, aqui se especializan en docentes o estudiantes';
COMMENT ON TABLE facultades IS 'Todas las facultades de la universidad';
COMMENT ON TABLE comisiones IS 'Todas las comisiones que conforman el ICU';
COMMENT ON TABLE usuario_comisiones IS 'Relación entre usuarios y comisiones para uso de analisis';
COMMENT ON TABLE documentos IS 'Documentos gestionados por el sistema una vez subidos';

-- Verificar que los datos se insertaron correctamente
SELECT 'Verificación de datos insertados:' as mensaje;
SELECT 'Facultades:' as tabla, COUNT(*) as registros FROM facultades
UNION ALL
SELECT 'Comisiones:', COUNT(*) FROM comisiones
UNION ALL
SELECT 'Usuarios:', COUNT(*) FROM usuarios
UNION ALL
SELECT 'Administrativos:', COUNT(*) FROM administrativos
UNION ALL
SELECT 'Consejeros ICU:', COUNT(*) FROM consejeros_icu
UNION ALL
SELECT 'Usuario-Comisiones:', COUNT(*) FROM usuario_comisiones
UNION ALL
SELECT 'Documentos:', COUNT(*) FROM documentos;

-TODO SE POBLA CORRECTAMENTE-
