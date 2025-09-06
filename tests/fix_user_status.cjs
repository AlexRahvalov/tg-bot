const mariadb = require('mariadb');

async function fixUserStatus() {
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
    
    // Начинаем транзакцию
    await connection.beginTransaction();
    
    // Находим пользователя с UUID но статусом applicant
    const users = await connection.query(
      `SELECT id, telegram_id, username, nickname, minecraft_nickname, minecraft_uuid, role, can_vote 
       FROM users 
       WHERE role = 'applicant' AND minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`
    );
    
    if (users.length === 0) {
      console.log('Пользователи со статусом applicant и UUID не найдены.');
      await connection.rollback();
      return;
    }
    
    console.log(`\nНайдено ${users.length} пользователей со статусом applicant и UUID:`);
    
    for (const user of users) {
      console.log(`\nОбрабатываем пользователя:`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Telegram ID: ${user.telegram_id}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Nickname: ${user.nickname}`);
      console.log(`  Minecraft Nickname: ${user.minecraft_nickname}`);
      console.log(`  Minecraft UUID: ${user.minecraft_uuid}`);
      console.log(`  Текущая роль: ${user.role}`);
      console.log(`  Право голоса: ${user.can_vote}`);
      
      // Обновляем статус пользователя на member и даем право голоса
      const updateResult = await connection.query(
        `UPDATE users SET role = 'member', can_vote = 1 WHERE id = ?`,
        [user.id]
      );
      
      console.log(`  Результат обновления: affectedRows = ${updateResult.affectedRows}`);
      
      if (updateResult.affectedRows > 0) {
        console.log(`  ✅ Статус пользователя обновлен на 'member' с правом голоса`);
      } else {
        console.log(`  ❌ Не удалось обновить статус пользователя`);
        throw new Error(`Не удалось обновить пользователя с ID ${user.id}`);
      }
    }
    
    // Коммитим транзакцию
    await connection.commit();
    console.log('\n✅ Транзакция успешно зафиксирована');
    
    // Проверяем результат после коммита
    console.log('\n=== ПРОВЕРКА ПОСЛЕ ОБНОВЛЕНИЯ ===');
    const updatedUsers = await connection.query(
      `SELECT id, telegram_id, username, role, can_vote, minecraft_uuid FROM users WHERE minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`
    );
    
    for (const user of updatedUsers) {
      console.log(`Пользователь ID ${user.id} (${user.username}): роль = ${user.role}, голос = ${user.can_vote}, UUID = ${user.minecraft_uuid}`);
    }
    
    console.log('\n🏁 Обработка завершена. Теперь перезапустите бота для синхронизации whitelist.');
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error);
    if (connection) {
      try {
        await connection.rollback();
        console.log('Транзакция отменена');
      } catch (rollbackError) {
        console.error('Ошибка при откате транзакции:', rollbackError);
      }
    }
    throw error;
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

fixUserStatus().catch(console.error);