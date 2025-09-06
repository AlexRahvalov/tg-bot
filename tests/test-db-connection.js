const mariadb = require('mariadb');

async function testConnection() {
  let connection;
  try {
    console.log('🔄 Тестирование подключения к MariaDB...');
    
    // Попробуем подключиться с минимальными настройками
    connection = await mariadb.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'ga540012',
      ssl: false,
      // Принудительно используем mysql_native_password
      authPlugins: {
        mysql_native_password: () => require('mariadb/lib/auth/native-password-auth')
      },
      // Отключаем проблемные плагины
      skipSetTimezone: true,
      permitSetMultiParamEntries: true
    });
    
    console.log('✅ Подключение успешно!');
    
    // Проверим версию сервера
    const result = await connection.query('SELECT VERSION() as version');
    console.log('📊 Версия сервера:', result[0].version);
    
    // Проверим плагины аутентификации
    const authPlugins = await connection.query("SELECT user, host, plugin FROM mysql.user WHERE user='root'");
    console.log('🔐 Плагины аутентификации для root:');
    authPlugins.forEach(row => {
      console.log(`  - ${row.user}@${row.host}: ${row.plugin}`);
    });
    
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
    console.error('📋 Код ошибки:', error.code);
    console.error('📋 SQL State:', error.sqlState);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

testConnection();