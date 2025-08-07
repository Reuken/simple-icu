// scripts/admin.js - Scripts de administración para el sistema ICU
const { query, getClient } = require('../config/database');
const bcrypt = require('bcrypt');

class AdminTools {
  
  // Crear un nuevo usuario
  static async createUser(userData) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');
      
      // Validar datos requeridos
      const required = ['codigo', 'nombre', 'email', 'contrasena', 'tipo_usuario'];
      for (const field of required) {
        if (!userData[field]) {
          throw new Error(`Campo requerido faltante: ${field}`);
        }
      }
      
      // Hash de la contraseña
      const hashedPassword = await bcrypt.hash(userData.contrasena, 10);
      
      // Insertar usuario base
      const userResult = await client.query(`
        INSERT INTO usuarios (codigo, nombre, email, contrasena, tipo_usuario)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [userData.codigo, userData.nombre, userData.email, hashedPassword, userData.tipo_usuario]);
      
      const newUser = userResult.rows[0];
      
      // Insertar datos específicos según tipo
      if (userData.tipo_usuario === 'administrativo') {
        await client.query(`
          INSERT INTO administrativos (usuario_id, funcion, gestion)
          VALUES ($1, $2, $3)
        `, [newUser.id, userData.funcion || 'Sin función', userData.gestion || '2024-2025']);
      } else if (userData.tipo_usuario === 'consejero') {
        await client.query(`
          INSERT INTO consejeros_icu (usuario_id, facultad_id, gestion, es_estudiante, es_docente, es_directiva)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          newUser.id, 
          userData.facultad_id || null, 
          userData.gestion || '2024-2025',
          userData.es_estudiante || false,
          userData.es_docente || false,
          userData.es_directiva || false
        ]);
      }
      
      await client.query('COMMIT');
      console.log(`✅ Usuario creado: ${userData.nombre} (${userData.codigo})`);
      return newUser;
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Error creando usuario:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Resetear contraseña de un usuario
  static async resetPassword(codigo, nuevaContrasena) {
    try {
      const hashedPassword = await bcrypt.hash(nuevaContrasena, 10);
      
      const result = await query(`
        UPDATE usuarios 
        SET contrasena = $1, updated_at = CURRENT_TIMESTAMP
        WHERE codigo = $2
        RETURNING nombre, codigo
      `, [hashedPassword, codigo]);
      
      if (result.rows.length === 0) {
        throw new Error(`Usuario con código ${codigo} no encontrado`);
      }
      
      console.log(`✅ Contraseña actualizada para: ${result.rows[0].nombre}`);
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error reseteando contraseña:', error.message);
      throw error;
    }
  }
  
  // Desactivar/Activar usuario
  static async toggleUserStatus(codigo, activo = false) {
    try {
      const result = await query(`
        UPDATE usuarios 
        SET es_activo = $1, updated_at = CURRENT_TIMESTAMP
        WHERE codigo = $2
        RETURNING nombre, codigo, es_activo
      `, [activo, codigo]);
      
      if (result.rows.length === 0) {
        throw new Error(`Usuario con código ${codigo} no encontrado`);
      }
      
      const user = result.rows[0];
      const status = user.es_activo ? 'activado' : 'desactivado';
      console.log(`✅ Usuario ${status}: ${user.nombre} (${user.codigo})`);
      return user;
    } catch (error) {
      console.error('❌ Error cambiando status del usuario:', error.message);
      throw error;
    }
  }
  
  // Asignar usuario a comisión
  static async assignToComision(usuarioId, comisionId) {
    try {
      const result = await query(`
        INSERT INTO usuario_comisiones (usuario_id, comision_id, es_activo)
        VALUES ($1, $2, true)
        ON CONFLICT (usuario_id, comision_id) 
        DO UPDATE SET es_activo = true, fecha_asignacion = CURRENT_TIMESTAMP
        RETURNING *
      `, [usuarioId, comisionId]);
      
      console.log('✅ Usuario asignado a comisión exitosamente');
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error asignando a comisión:', error.message);
      throw error;
    }
  }
  
  // Generar reporte de usuarios
  static async generateUserReport() {
    try {
      const result = await query(`
        SELECT 
          u.codigo,
          u.nombre,
          u.email,
          u.tipo_usuario,
          u.es_activo,
          u.created_at,
          CASE 
            WHEN u.tipo_usuario = 'administrativo' THEN a.funcion
            WHEN u.tipo_usuario = 'consejero' THEN 
              CASE 
                WHEN c.es_directiva THEN 'Directiva'
                WHEN c.es_docente THEN 'Docente - ' || COALESCE(f.nombre, 'Sin Facultad')
                WHEN c.es_estudiante THEN 'Estudiante - ' || COALESCE(f.nombre, 'Sin Facultad')
                ELSE 'Consejero'
              END
          END as detalle_rol,
          COUNT(uc.comision_id) as comisiones_asignadas
        FROM usuarios u
        LEFT JOIN administrativos a ON u.id = a.usuario_id
        LEFT JOIN consejeros_icu c ON u.id = c.usuario_id
        LEFT JOIN facultades f ON c.facultad_id = f.id
        LEFT JOIN usuario_comisiones uc ON u.id = uc.usuario_id AND uc.es_activo = true
        GROUP BY u.id, u.codigo, u.nombre, u.email, u.tipo_usuario, u.es_activo, u.created_at, a.funcion, c.es_directiva, c.es_docente, c.es_estudiante, f.nombre
        ORDER BY u.codigo
      `);
      
      console.log('\n📊 REPORTE DE USUARIOS ICU');
      console.log('=' + '='.repeat(80));
      
      result.rows.forEach(user => {
        const status = user.es_activo ? '✅' : '❌';
        const fechaCreacion = new Date(user.created_at).toLocaleDateString();
        
        console.log(`${status} ${user.codigo} - ${user.nombre}`);
        console.log(`   📧 ${user.email}`);
        console.log(`   👤 ${user.detalle_rol || user.tipo_usuario}`);
        console.log(`   🏛️  ${user.comisiones_asignadas} comisión(es)`);
        console.log(`   📅 Creado: ${fechaCreacion}`);
        console.log('   ' + '-'.repeat(50));
      });
      
      return result.rows;
    } catch (error) {
      console.error('❌ Error generando reporte:', error.message);
      throw error;
    }
  }
  
  // Backup de datos críticos
  static async backupData() {
    try {
      const usuarios = await query('SELECT * FROM usuarios WHERE es_activo = true ORDER BY codigo');
      const facultades = await query('SELECT * FROM facultades ORDER BY id');
      const comisiones = await query('SELECT * FROM comisiones ORDER BY id');
      
      const backup = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        usuarios: usuarios.rows,
        facultades: facultades.rows,
        comisiones: comisiones.rows
      };
      
      const fs = require('fs');
      const filename = `backup_icu_${new Date().toISOString().split('T')[0]}.json`;
      
      fs.writeFileSync(filename, JSON.stringify(backup, null, 2));
      console.log(`✅ Backup creado: ${filename}`);
      return filename;
    } catch (error) {
      console.error('❌ Error creando backup:', error.message);
      throw error;
    }
  }
  
  // Estadísticas del sistema
  static async getSystemStats() {
    try {
      const stats = await query(`
        SELECT 
          COUNT(*) as total_usuarios,
          COUNT(CASE WHEN tipo_usuario = 'administrativo' THEN 1 END) as administrativos,
          COUNT(CASE WHEN tipo_usuario = 'consejero' THEN 1 END) as consejeros,
          COUNT(CASE WHEN es_activo = true THEN 1 END) as usuarios_activos,
          COUNT(CASE WHEN es_activo = false THEN 1 END) as usuarios_inactivos,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as nuevos_ultimo_mes
        FROM usuarios
      `);
      
      const comisiones = await query('SELECT COUNT(*) as total FROM comisiones');
      const facultades = await query('SELECT COUNT(*) as total FROM facultades');
      const asignaciones = await query('SELECT COUNT(*) as total FROM usuario_comisiones WHERE es_activo = true');
      
      const resultado = {
        ...stats.rows[0],
        total_comisiones: parseInt(comisiones.rows[0].total),
        total_facultades: parseInt(facultades.rows[0].total),
        asignaciones_activas: parseInt(asignaciones.rows[0].total)
      };
      
      console.log('\n📈 ESTADÍSTICAS DEL SISTEMA ICU');
      console.log('=' + '='.repeat(40));
      console.log(`👥 Total Usuarios: ${resultado.total_usuarios}`);
      console.log(`✅ Usuarios Activos: ${resultado.usuarios_activos}`);
      console.log(`❌ Usuarios Inactivos: ${resultado.usuarios_inactivos}`);
      console.log(`🏛️  Administrativos: ${resultado.administrativos}`);
      console.log(`🎓 Consejeros: ${resultado.consejeros}`);
      console.log(`🆕 Nuevos (30 días): ${resultado.nuevos_ultimo_mes}`);
      console.log(`🏢 Facultades: ${resultado.total_facultades}`);
      console.log(`📋 Comisiones: ${resultado.total_comisiones}`);
      console.log(`🔗 Asignaciones Activas: ${resultado.asignaciones_activas}`);
      
      return resultado;
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error.message);
      throw error;
    }
  }
}

// Funciones de utilidad CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  (async () => {
    try {
      switch (command) {
        case 'create-user':
          // node scripts/admin.js create-user codigo nombre email password tipo
          const [codigo, nombre, email, password, tipo] = args.slice(1);
          if (!codigo || !nombre || !email || !password || !tipo) {
            console.log('Uso: node admin.js create-user <codigo> <nombre> <email> <password> <tipo>');
            console.log('Tipos: administrativo, consejero');
            process.exit(1);
          }
          await AdminTools.createUser({
            codigo: parseInt(codigo),
            nombre,
            email,
            contrasena: password,
            tipo_usuario: tipo
          });
          break;
          
        case 'reset-password':
          // node scripts/admin.js reset-password codigo newpassword
          const [userCode, newPass] = args.slice(1);
          if (!userCode || !newPass) {
            console.log('Uso: node admin.js reset-password <codigo> <nueva_password>');
            process.exit(1);
          }
          await AdminTools.resetPassword(parseInt(userCode), newPass);
          break;
          
        case 'toggle-user':
          // node scripts/admin.js toggle-user codigo true/false
          const [code, status] = args.slice(1);
          if (!code || !status) {
            console.log('Uso: node admin.js toggle-user <codigo> <true|false>');
            process.exit(1);
          }
          await AdminTools.toggleUserStatus(parseInt(code), status === 'true');
          break;
          
        case 'report':
          await AdminTools.generateUserReport();
          break;
          
        case 'stats':
          await AdminTools.getSystemStats();
          break;
          
        case 'backup':
          await AdminTools.backupData();
          break;
          
        default:
          console.log('Comandos disponibles:');
          console.log('  create-user <codigo> <nombre> <email> <password> <tipo>');
          console.log('  reset-password <codigo> <nueva_password>');
          console.log('  toggle-user <codigo> <true|false>');
          console.log('  report - Generar reporte de usuarios');
          console.log('  stats - Mostrar estadísticas del sistema');
          console.log('  backup - Crear backup de datos');
      }
      
      process.exit(0);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  })();
}

module.exports = AdminTools;