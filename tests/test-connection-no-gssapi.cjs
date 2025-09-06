const mariadb = require('mariadb');
require('dotenv').config();

async function testConnection() {
  console.log('Testing MariaDB connection without GSSAPI...');
  
  try {
    // Создаем подключение с явным отключением проблемных плагинов
    const conn = await mariadb.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      // Отключаем SSL и проблемные плагины
      ssl: false,
      // Принудительно используем только mysql_native_password
      connectTimeout: 10000,
      socketTimeout: 10000
    });

    console.log('✅ Connection successful!');
    
    // Проверим версию сервера
    const result = await conn.query('SELECT VERSION() as version');
    console.log('Server version:', result[0].version);
    
    // Проверим текущего пользователя и его плагин аутентификации
    const userInfo = await conn.query('SELECT USER() as current_user_name');
    console.log('Current user:', userInfo[0].current_user_name);
    
    // Проверим плагин аутентификации для root пользователя
    const authPlugin = await conn.query(
      "SELECT user, host, plugin FROM mysql.user WHERE user = 'root'"
    );
    console.log('Root user authentication plugins:');
    authPlugin.forEach(user => {
      console.log(`- ${user.user}@${user.host}: ${user.plugin}`);
    });
    
    await conn.end();
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('SQL State:', error.sqlState);
    
    if (error.code === 'ER_AUTHENTICATION_PLUGIN_NOT_SUPPORTED') {
      console.log('\n🔧 Suggested fix: Update root user to use mysql_native_password:');
      console.log('ALTER USER \'root\'@\'localhost\' IDENTIFIED VIA mysql_native_password USING PASSWORD(\'your_password\');');
    }
  }
}

testConnection();