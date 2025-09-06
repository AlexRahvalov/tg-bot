const mariadb = require('mariadb');

async function testWhitelistSync() {
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
    
    // Проверяем точно такой же запрос, как в findApprovedUsersWithUUID
    console.log('\n=== Тестируем запрос findApprovedUsersWithUUID ===');
    const users = await connection.query(
      `SELECT * FROM users WHERE role = ? AND minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`,
      ['member']
    );
    
    console.log(`Найдено пользователей: ${users.length}`);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. Пользователь:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Telegram ID: ${user.telegram_id}`);
        console.log(`   Username: ${user.username || 'не указан'}`);
        console.log(`   Nickname: ${user.nickname}`);
        console.log(`   Minecraft Nickname: ${user.minecraft_nickname}`);
        console.log(`   Minecraft UUID: ${user.minecraft_uuid}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Can Vote: ${user.can_vote}`);
      });
    } else {
      console.log('❌ Пользователи не найдены!');
    }
    
    // Дополнительная проверка - все пользователи с UUID
    console.log('\n=== Все пользователи с UUID ===');
    const allUsersWithUUID = await connection.query(
      `SELECT id, username, role, minecraft_uuid FROM users WHERE minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`
    );
    
    console.log(`Всего пользователей с UUID: ${allUsersWithUUID.length}`);
    allUsersWithUUID.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, Username: ${user.username}, Role: ${user.role}, UUID: ${user.minecraft_uuid}`);
    });
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

testWhitelistSync().catch(console.error);