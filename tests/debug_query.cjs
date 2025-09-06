const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'tg_bot_db',
  acquireTimeout: 60000,
  timeout: 60000,
  connectionLimit: 5,
  permitSetMultiParamEntries: true,
  pluginDir: null,
  plugins: []
});

async function debugQuery() {
  let connection;
  try {
    console.log('🔗 Подключение к базе данных...');
    connection = await pool.getConnection();
    console.log('✅ Подключение установлено');
    
    // Сначала посмотрим всех пользователей
    console.log('\n📋 Все пользователи в базе данных:');
    const allUsers = await connection.query('SELECT id, username, role, minecraft_uuid FROM users');
    console.table(allUsers);
    
    // Выполним точный запрос как в коде
    const memberRole = 'member'; // Используем строку напрямую
    console.log('\n🔍 Выполняем запрос с role = "member":');
    const query1 = `SELECT * FROM users WHERE role = ? AND minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`;
    console.log('SQL:', query1);
    console.log('Параметры:', [memberRole]);
    const result1 = await connection.query(query1, [memberRole]);
    console.log('Результат:', result1.length, 'пользователей');
    if (result1.length > 0) {
      console.table(result1);
    }
    
    // Проверим также без условия на UUID
    console.log('\n🔍 Выполняем запрос только с role = "member":');
    const query2 = `SELECT * FROM users WHERE role = ?`;
    console.log('SQL:', query2);
    console.log('Параметры:', [memberRole]);
    const result2 = await connection.query(query2, [memberRole]);
    console.log('Результат:', result2.length, 'пользователей');
    if (result2.length > 0) {
      console.table(result2);
    }
    
    // Проверим пользователя с ID 2 отдельно
    console.log('\n🔍 Проверяем пользователя с ID 2:');
    const query3 = `SELECT * FROM users WHERE id = 2`;
    const result3 = await connection.query(query3);
    if (result3.length > 0) {
      console.table(result3);
      console.log('UUID пользователя:', result3[0].minecraft_uuid);
      console.log('UUID IS NOT NULL:', result3[0].minecraft_uuid !== null);
      console.log('UUID != "":', result3[0].minecraft_uuid !== '');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

debugQuery();