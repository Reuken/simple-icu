// config/database.js
const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'icu_database',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20, // máximo número de clientes en el pool
  idleTimeoutMillis: 30000, // cuánto tiempo un cliente permanece inactivo antes de ser cerrado
  connectionTimeoutMillis: 2000, // tiempo de espera al intentar conectar
  statement_timeout: 60000, // tiempo de espera para queries
  query_timeout: 60000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Crear pool de conexiones
const pool = new Pool(dbConfig);

// Eventos del pool
pool.on('connect', (client) => {
  console.log('🔌 Nueva conexión establecida a PostgreSQL');
});

pool.on('error', (err, client) => {
  console.error('❌ Error inesperado en cliente PostgreSQL:', err);
  process.exit(-1);
});

pool.on('acquire', (client) => {
  console.log('📦 Cliente adquirido del pool');
});

pool.on('release', (client) => {
  console.log('🔓 Cliente liberado de vuelta al pool');
});

// Función para realizar queries
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Query ejecutado:', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params ? params.length : 0,
        duration: duration + 'ms',
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Error en query:', {
      query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      params: params,
      duration: duration + 'ms',
      error: error.message
    });
    throw error;
  }
}

// Función para obtener un cliente del pool (para transacciones)
async function getClient() {
  try {
    const client = await pool.connect();
    
    // Agregar método de query personalizado al cliente
    const originalQuery = client.query.bind(client);
    client.query = async (text, params) => {
      const start = Date.now();
      try {
        const result = await originalQuery(text, params);
        const duration = Date.now() - start;
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🔍 Transaction query:', {
            query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            duration: duration + 'ms',
            rows: result.rowCount
          });
        }
        
        return result;
      } catch (error) {
        const duration = Date.now() - start;
        console.error('❌ Error en transaction query:', {
          query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          duration: duration + 'ms',
          error: error.message
        });
        throw error;
      }
    };
    
    return client;
  } catch (error) {
    console.error('❌ Error obteniendo cliente del pool:', error);
    throw error;
  }
}

// Función para probar la conexión
async function testConnection() {
  try {
    console.log('🔄 Probando conexión a PostgreSQL...');
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version() as pg_version');
    client.release();
    
    console.log('✅ Conexión exitosa a PostgreSQL');
    console.log('🕐 Tiempo del servidor:', result.rows[0].now);
    console.log('📊 Versión PostgreSQL:', result.rows[0].pg_version.split(' ')[1]);
    
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error.message);
    console.error('🔧 Configuración actual:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      ssl: dbConfig.ssl
    });
    return false;
  }
}

// Función para cerrar el pool de conexiones
async function closePool() {
  try {
    console.log('🔄 Cerrando pool de conexiones...');
    await pool.end();
    console.log('✅ Pool de conexiones cerrado');
  } catch (error) {
    console.error('❌ Error cerrando pool:', error);
  }
}

// Función para obtener estadísticas del pool
function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

// Función de utilidad para crear tablas con verificación
async function createTableIfNotExists(tableName, createStatement) {
  try {
    const checkQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      );
    `;
    
    const result = await query(checkQuery, [tableName]);
    
    if (!result.rows[0].exists) {
      console.log(`📋 Creando tabla: ${tableName}`);
      await query(createStatement);
      console.log(`✅ Tabla ${tableName} creada exitosamente`);
    } else {
      console.log(`ℹ️  Tabla ${tableName} ya existe`);
    }
  } catch (error) {
    console.error(`❌ Error creando tabla ${tableName}:`, error.message);
    throw error;
  }
}

// Función para ejecutar migraciones
async function runMigrations() {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Crear tabla de migraciones si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Aquí puedes agregar más migraciones según sea necesario
    console.log('✅ Migraciones ejecutadas correctamente');
    
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error ejecutando migraciones:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Función para backup simple
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_icu_${timestamp}`;
    
    console.log(`🗄️  Creando backup: ${backupName}`);
    
    // Esta función requiere pg_dump instalado
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.user} -d ${dbConfig.database} > ${backupName}.sql`;
    
    await execAsync(command, {
      env: { ...process.env, PGPASSWORD: dbConfig.password }
    });
    
    console.log(`✅ Backup creado: ${backupName}.sql`);
    return `${backupName}.sql`;
  } catch (error) {
    console.error('❌ Error creando backup:', error);
    throw error;
  }
}

// Función para verificar integridad de datos
async function checkDataIntegrity() {
  try {
    console.log('🔍 Verificando integridad de datos...');
    
    const checks = [
      {
        name: 'Usuarios sin email duplicado',
        query: 'SELECT email, COUNT(*) as count FROM usuarios GROUP BY email HAVING COUNT(*) > 1',
        expectEmpty: true
      },
      {
        name: 'Códigos de usuario únicos',
        query: 'SELECT codigo, COUNT(*) as count FROM usuarios GROUP BY codigo HAVING COUNT(*) > 1',
        expectEmpty: true
      },
      {
        name: 'Documentos con archivos existentes',
        query: 'SELECT COUNT(*) as total FROM documentos WHERE archivo_path IS NOT NULL',
        expectNumber: true
      },
      {
        name: 'Consejeros con facultad válida',
        query: 'SELECT COUNT(*) as invalid FROM consejeros_icu c LEFT JOIN facultades f ON c.facultad_id = f.id WHERE c.facultad_id IS NOT NULL AND f.id IS NULL',
        expectZero: true
      }
    ];
    
    let allGood = true;
    
    for (const check of checks) {
      const result = await query(check.query);
      
      if (check.expectEmpty && result.rows.length > 0) {
        console.warn(`⚠️  ${check.name}: Encontrados datos duplicados`);
        console.warn(result.rows);
        allGood = false;
      } else if (check.expectZero && parseInt(result.rows[0].count || result.rows[0].invalid || result.rows[0].total) > 0) {
        console.warn(`⚠️  ${check.name}: Encontrados datos inconsistentes`);
        allGood = false;
      } else {
        console.log(`✅ ${check.name}: OK`);
      }
    }
    
    if (allGood) {
      console.log('✅ Integridad de datos verificada correctamente');
    } else {
      console.warn('⚠️  Se encontraron problemas de integridad');
    }
    
    return allGood;
  } catch (error) {
    console.error('❌ Error verificando integridad:', error);
    return false;
  }
}

// Manejo graceful del cierre de la aplicación
process.on('SIGTERM', async () => {
  console.log('📝 Recibida señal SIGTERM, cerrando pool de conexiones...');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📝 Recibida señal SIGINT, cerrando pool de conexiones...');
  await closePool();
  process.exit(0);
});

// Exportar funciones y objetos
module.exports = {
  pool,
  query,
  getClient,
  testConnection,
  closePool,
  getPoolStats,
  createTableIfNotExists,
  runMigrations,
  createBackup,
  checkDataIntegrity
};