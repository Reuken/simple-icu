// config/database.js
const { Pool } = require('pg');
require('dotenv').config();

// Configuración de la base de datos
const dbConfig = {
  user: process.env.DB_USER || 'icu_adm',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'icu_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  
  // Configuraciones adicionales para producción
  max: 20, // Máximo número de conexiones en el pool
  idleTimeoutMillis: 30000, // Tiempo antes de cerrar conexiones inactivas
  connectionTimeoutMillis: 2000, // Tiempo máximo para obtener conexión
  
  // SSL para producción (deshabilitado para desarrollo local)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Crear pool de conexiones
const pool = new Pool(dbConfig);

// Función para probar la conexión
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✅ Conexión a PostgreSQL exitosa:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
    return false;
  }
}

// Función para ejecutar consultas
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`📊 Query ejecutada: ${duration}ms`);
    return res;
  } catch (err) {
    console.error('❌ Error en query:', err.message);
    throw err;
  }
}

// Función para obtener un cliente del pool (para transacciones)
async function getClient() {
  return await pool.connect();
}

// Cerrar todas las conexiones al salir de la aplicación
process.on('SIGINT', () => {
  console.log('\n🔄 Cerrando conexiones de base de datos...');
  pool.end(() => {
    console.log('✅ Pool de conexiones cerrado');
    process.exit(0);
  });
});

module.exports = {
  pool,
  query,
  getClient,
  testConnection
};