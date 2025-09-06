const mariadb = require('mariadb');

async function checkWhitelistStatus() {
  const pool = mariadb.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'ga540012',
    database: 'minecraft_bot',
    connectionLimit: 5
  });
  
  let connection;

  try {
    connection = await pool.getConnection();
    console.log('Подключение к базе данных успешно');
    
    // Проверяем пользователей с различными статусами whitelist
    console.log('\n=== Проверка статусов whitelist ===');
    
    const allUsers = await connection.query(
      `SELECT id, username, minecraft_nickname, role, whitelist_status FROM users WHERE minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`
    );
    
    console.log(`\nВсего пользователей с UUID: ${allUsers.length}`);
    
    if (allUsers.length > 0) {
      console.log('\n--- Все пользователи с UUID ---');
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.minecraft_nickname} (${user.username}) - Роль: ${user.role}, Статус whitelist: ${user.whitelist_status || 'не указан'}`);
      });
    }
    
    // Проверяем пользователей со статусом not_added
    const notAddedUsers = await connection.query(
      `SELECT id, username, minecraft_nickname, role, whitelist_status FROM users WHERE whitelist_status = 'not_added'`
    );
    
    console.log(`\n--- Пользователи со статусом 'not_added': ${notAddedUsers.length} ---`);
    notAddedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.minecraft_nickname} (${user.username}) - Роль: ${user.role}`);
    });
    
    // Проверяем пользователей со статусом added
    const addedUsers = await connection.query(
      `SELECT id, username, minecraft_nickname, role, whitelist_status FROM users WHERE whitelist_status = 'added'`
    );
    
    console.log(`\n--- Пользователи со статусом 'added': ${addedUsers.length} ---`);
    addedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.minecraft_nickname} (${user.username}) - Роль: ${user.role}`);
    });
    
    // Проверяем пользователей со статусом removed
    const removedUsers = await connection.query(
      `SELECT id, username, minecraft_nickname, role, whitelist_status FROM users WHERE whitelist_status = 'removed'`
    );
    
    console.log(`\n--- Пользователи со статусом 'removed': ${removedUsers.length} ---`);
    removedUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.minecraft_nickname} (${user.username}) - Роль: ${user.role}`);
    });
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

checkWhitelistStatus().catch(console.error);