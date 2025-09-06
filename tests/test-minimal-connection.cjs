const mariadb = require('mariadb');
require('dotenv').config();

async function testConnection() {
  console.log('Testing minimal MariaDB connection...');
  
  try {
    // Тест с минимальными параметрами
    const pool = mariadb.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      connectionLimit: 1,
      acquireTimeout: 10000
    });

    console.log('Pool created, attempting connection...');
    const conn = await pool.getConnection();
    console.log('✅ Connection successful!');
    
    // Проверим версию сервера
    const result = await conn.query('SELECT VERSION() as version');
    console.log('Server version:', result[0].version);
    
    // Проверим доступные плагины аутентификации
    const plugins = await conn.query('SHOW PLUGINS WHERE Type = "AUTHENTICATION"');
    console.log('Available authentication plugins:');
    plugins.forEach(plugin => {
      console.log(`- ${plugin.Name}: ${plugin.Status}`);
    });
    
    conn.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('SQL State:', error.sqlState);
  }
}

testConnection();