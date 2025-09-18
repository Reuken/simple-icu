// models/User.js
const { query } = require('../config/database');
// Comentamos bcrypt por ahora para desarrollo
// const bcrypt = require('bcrypt');

class Usuario {
  constructor(data) {
    this.id = data.id;
    this.codigo = data.codigo;
    this.nombre = data.nombre;
    this.email = data.email;
    this.tipo_usuario = data.tipo_usuario;
    this.es_activo = data.es_activo;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Encontrar usuario por código
  static async findByCodigo(codigo) {
    try {
      const result = await query(
        'SELECT * FROM usuarios WHERE codigo = $1 AND es_activo = true',
        [codigo]
      );
      return result.rows.length > 0 ? new Usuario(result.rows[0]) : null;
    } catch (error) {
      console.error('Error buscando usuario por código:', error);
      throw error;
    }
  }

  // Autenticar usuario - VERSIÓN CORREGIDA
  static async authenticate(codigo, contrasena) {
    try {
      console.log(`🔍 Intentando autenticar usuario: ${codigo}`);
      
      const result = await query(
        'SELECT * FROM usuarios WHERE codigo = $1 AND es_activo = true',
        [codigo]
      );

      if (result.rows.length === 0) {
        console.log(`❌ Usuario no encontrado: ${codigo}`);
        return null;
      }

      const usuario = result.rows[0];
      console.log(`✅ Usuario encontrado: ${usuario.nombre} (${usuario.codigo})`);
      console.log(`🔐 Contraseña en BD: "${usuario.contrasena}", Contraseña ingresada: "${contrasena}"`);

      // Comparación directa para desarrollo (sin bcrypt)
      const isValidPassword = usuario.contrasena === contrasena;
      
      if (!isValidPassword) {
        console.log(`❌ Contraseña incorrecta para usuario: ${codigo}`);
        return null;
      }

      console.log(`✅ Autenticación exitosa para: ${usuario.nombre}`);
      return new Usuario(usuario);
    } catch (error) {
      console.error('Error en autenticación:', error);
      throw error;
    }
  }

  // Obtener datos completos del usuario con rol específico
  async getCompleteData() {
    try {
      if (this.tipo_usuario === 'administrativo') {
        const result = await query(`
          SELECT u.*, a.funcion, a.gestion
          FROM usuarios u
          JOIN administrativos a ON u.id = a.usuario_id
          WHERE u.id = $1
        `, [this.id]);

        if (result.rows.length > 0) {
          return {
            ...this,
            funcion: result.rows[0].funcion,
            gestion: result.rows[0].gestion,
            rol: 'administrativo',
            descripcion_rol: `Administrativo - ${result.rows[0].funcion}`
          };
        }
      } else if (this.tipo_usuario === 'consejero') {
        const result = await query(`
          SELECT u.*, c.gestion, c.es_estudiante, c.es_docente, c.es_directiva,
                 f.nombre as nombre_facultad
          FROM usuarios u
          JOIN consejeros_icu c ON u.id = c.usuario_id
          LEFT JOIN facultades f ON c.facultad_id = f.id
          WHERE u.id = $1
        `, [this.id]);

        if (result.rows.length > 0) {
          const userData = result.rows[0];
          let rol = 'consejero';
          let descripcion_rol = 'Consejero ICU';

          if (userData.es_directiva) {
            rol = 'directiva';
            descripcion_rol = 'Miembro de la Directiva ICU';
          } else if (userData.es_docente) {
            rol = 'consejero_docente';
            descripcion_rol = `Consejero ICU Docente${userData.nombre_facultad ? ' - ' + userData.nombre_facultad : ''}`;
          } else if (userData.es_estudiante) {
            rol = 'consejero_estudiante';
            descripcion_rol = `Consejero ICU Estudiante${userData.nombre_facultad ? ' - ' + userData.nombre_facultad : ''}`;
          }

          return {
            ...this,
            gestion: userData.gestion,
            es_estudiante: userData.es_estudiante,
            es_docente: userData.es_docente,
            es_directiva: userData.es_directiva,
            nombre_facultad: userData.nombre_facultad,
            rol: rol,
            descripcion_rol: descripcion_rol
          };
        }
      }

      return this;
    } catch (error) {
      console.error('Error obteniendo datos completos del usuario:', error);
      throw error;
    }
  }

  // Obtener comisiones del usuario
  async getComisiones() {
    try {
      const result = await query(`
        SELECT c.id, c.nombre, c.descripcion, uc.fecha_asignacion, uc.es_activo
        FROM comisiones c
        JOIN usuario_comisiones uc ON c.id = uc.comision_id
        WHERE uc.usuario_id = $1 AND uc.es_activo = true
        ORDER BY c.nombre
      `, [this.id]);

      return result.rows;
    } catch (error) {
      console.error('Error obteniendo comisiones del usuario:', error);
      throw error;
    }
  }

  // Crear nuevo usuario - VERSIÓN PARA DESARROLLO SIN BCRYPT
  static async create(userData) {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      // Sin hash para desarrollo
      const plainPassword = userData.contrasena;

      // Insertar usuario
      const userResult = await client.query(`
        INSERT INTO usuarios (codigo, nombre, email, contrasena, tipo_usuario)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [userData.codigo, userData.nombre, userData.email, plainPassword, userData.tipo_usuario]);

      const newUser = userResult.rows[0];

      // Insertar datos específicos según el tipo
      if (userData.tipo_usuario === 'administrativo') {
        await client.query(`
          INSERT INTO administrativos (usuario_id, funcion, gestion)
          VALUES ($1, $2, $3)
        `, [newUser.id, userData.funcion, userData.gestion]);
      } else if (userData.tipo_usuario === 'consejero') {
        await client.query(`
          INSERT INTO consejeros_icu (usuario_id, facultad_id, gestion, es_estudiante, es_docente, es_directiva)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [newUser.id, userData.facultad_id, userData.gestion, userData.es_estudiante, userData.es_docente, userData.es_directiva]);
      }

      await client.query('COMMIT');
      return new Usuario(newUser);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creando usuario:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Actualizar usuario - VERSIÓN PARA DESARROLLO SIN BCRYPT
  async update(updateData) {
    const client = await require('../config/database').getClient();
    
    try {
      await client.query('BEGIN');

      const fields = [];
      const values = [];
      let paramCount = 1;

      // Campos que se pueden actualizar
      const allowedFields = ['nombre', 'email'];
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          fields.push(`${field} = $${paramCount}`);
          values.push(updateData[field]);
          paramCount++;
        }
      }

      if (updateData.contrasena) {
        // Sin hash para desarrollo
        fields.push(`contrasena = $${paramCount}`);
        values.push(updateData.contrasena);
        paramCount++;
      }

      if (fields.length > 0) {
        values.push(this.id);
        const result = await client.query(`
          UPDATE usuarios 
          SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE id = $${paramCount}
          RETURNING *
        `, values);

        if (result.rows.length > 0) {
          Object.assign(this, result.rows[0]);
        }
      }

      await client.query('COMMIT');
      return this;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error actualizando usuario:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async setActive(isActive) {
    try {
        await query('UPDATE usuarios SET es_activo = $1 WHERE id = $2', [isActive, this.id]);
        this.es_activo = isActive;
        return this;
    } catch (error) {
        console.error('Error actualizando estado activo:', error);
        throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM usuarios WHERE id = $1 AND es_activo = true',
        [id]
      );
      return result.rows.length > 0 ? new Usuario(result.rows[0]) : null;
    } catch (error) {
      console.error('Error buscando usuario por ID:', error);
      throw error;
    }
  }
}

// Clase para operaciones de sistema
class SistemaUsuarios {
  // Obtener todos los usuarios con paginación
  static async getAllUsers(page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const result = await query(`
        SELECT u.*, f.nombre AS nombre_facultad, 
               CASE 
                 WHEN u.tipo_usuario = 'administrativo' THEN a.funcion
                 WHEN u.tipo_usuario = 'consejero' THEN 
                   CASE 
                     WHEN c.es_directiva THEN 'Directiva'
                     WHEN c.es_docente THEN 'Docente - ' || f.nombre
                     WHEN c.es_estudiante THEN 'Estudiante - ' || f.nombre
                   END
               END as detalle_rol
        FROM usuarios u
        LEFT JOIN administrativos a ON u.id = a.usuario_id
        LEFT JOIN consejeros_icu c ON u.id = c.usuario_id
        LEFT JOIN facultades f ON c.facultad_id = f.id
        WHERE u.es_activo = true
        ORDER BY u.nombre
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      const countResult = await query('SELECT COUNT(*) FROM usuarios WHERE es_activo = true');
      
      return {
        usuarios: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: page,
        limit: limit,
        totalPages: Math.ceil(countResult.rows[0].count / limit)
      };
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      throw error;
    }
  }

  // Obtener estadísticas del sistema
  static async getStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_usuarios,
          COUNT(CASE WHEN tipo_usuario = 'administrativo' THEN 1 END) as administrativos,
          COUNT(CASE WHEN tipo_usuario = 'consejero' THEN 1 END) as consejeros,
          COUNT(CASE WHEN es_activo = true THEN 1 END) as usuarios_activos
        FROM usuarios
      `);

      const comisionesResult = await query('SELECT COUNT(*) as total_comisiones FROM comisiones');
      const facultadesResult = await query('SELECT COUNT(*) as total_facultades FROM facultades');

      return {
        ...result.rows[0],
        total_comisiones: comisionesResult.rows[0].total_comisiones,
        total_facultades: facultadesResult.rows[0].total_facultades
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
}

// Clases auxiliares
class Facultad {
  static async getAll() {
    try {
      const result = await query('SELECT * FROM facultades ORDER BY nombre');
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo facultades:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await query('SELECT * FROM facultades WHERE id = $1', [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error buscando facultad:', error);
      throw error;
    }
  }
    // ✅ Obtener miembros de una facultad
     static async getMiembros(facultadId) {
        try {
            const result = await query(`
                SELECT 
                    u.id,
                    u.codigo, 
                    u.nombre, 
                    u.email, 
                    u.tipo_usuario,
                    c.es_directiva,
                    c.es_docente,
                    c.es_estudiante,
                    f.nombre as nombre_facultad,
                    u.created_at as fecha_registro
                FROM usuarios u
                JOIN consejeros_icu c ON u.id = c.usuario_id
                JOIN facultades f ON c.facultad_id = f.id
                WHERE c.facultad_id = $1 
                    AND u.es_activo = true 
                    AND u.tipo_usuario = 'consejero'
                ORDER BY 
                    c.es_directiva DESC,
                    c.es_docente DESC, 
                    c.es_estudiante DESC,
                    u.nombre
            `, [facultadId]);
            
            return result.rows;
        } catch (error) {
            console.error('Error obteniendo miembros de facultad:', error);
            throw error;
        }
    }

    // ✅ Obtener estadísticas de una facultad
    static async getStats(facultadId) {
        try {
            const result = await query(`
                SELECT 
                    COUNT(*) as total_miembros,
                    COUNT(CASE WHEN c.es_directiva THEN 1 END) as directivos,
                    COUNT(CASE WHEN c.es_docente THEN 1 END) as docentes,
                    COUNT(CASE WHEN c.es_estudiante THEN 1 END) as estudiantes,
                    f.nombre as nombre_facultad
                FROM usuarios u
                JOIN consejeros_icu c ON u.id = c.usuario_id
                JOIN facultades f ON c.facultad_id = f.id
                WHERE c.facultad_id = $1 AND u.es_activo = true
                GROUP BY f.nombre
            `, [facultadId]);
            
            return result.rows.length > 0 ? result.rows[0] : {
                total_miembros: 0,
                directivos: 0,
                docentes: 0,
                estudiantes: 0,
                nombre_facultad: null
            };
        } catch (error) {
            console.error('Error obteniendo estadísticas de facultad:', error);
            throw error;
        }
    } 

    static async obtenerTodasConConsejeros() {
    try {
        const result = await query(`
            SELECT
                f.id,
                f.nombre,
                -- Agrupamos a los consejeros estudiantes en un array JSON
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT('nombre', u.nombre)
                    ) FILTER (WHERE c.es_estudiante = true), 
                    '[]'::json
                ) AS delegados_estudiantes,
                -- Agrupamos a los consejeros docentes en otro array JSON
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT('nombre', u.nombre)
                    ) FILTER (WHERE c.es_docente = true), 
                    '[]'::json
                ) AS delegados_docentes
            FROM 
                facultades f
            LEFT JOIN 
                consejeros_icu c ON f.id = c.facultad_id
            LEFT JOIN 
                usuarios u ON c.usuario_id = u.id AND u.es_activo = true AND u.tipo_usuario = 'consejero'
            GROUP BY 
                f.id, f.nombre  -- SIGLA eliminada de aquí
            ORDER BY 
                f.nombre;
        `);

        const facultadesData = result.rows.map(facultad => ({
            ...facultad
        }));

        return facultadesData;

    } catch (error) {
        console.error('Error al obtener facultades con consejeros anidados:', error);
        throw error;
    }
  }
}    //Fin de la clase Facultad

class Comision {
  static async getAll() {
    try {
      const result = await query('SELECT * FROM comisiones ORDER BY nombre');
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo comisiones:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await query('SELECT * FROM comisiones WHERE id = $1', [id]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error buscando comisión:', error);
      throw error;
    }
  }

  // Obtener miembros de una comisión
  static async getMiembros(comisionId) {
    try {
      const result = await query(`
        SELECT u.codigo, u.nombre, u.email, u.tipo_usuario, uc.fecha_asignacion
        FROM usuarios u
        JOIN usuario_comisiones uc ON u.id = uc.usuario_id
        WHERE uc.comision_id = $1 AND uc.es_activo = true
        ORDER BY u.nombre
      `, [comisionId]);
      return result.rows;
    } catch (error) {
      console.error('Error obteniendo miembros de comisión:', error);
      throw error;
    }
  }
}

module.exports = {
  Usuario,
  SistemaUsuarios,
  Facultad,
  Comision
};