const mariadb = require('mariadb');

async function directUpdate() {
  const pool = mariadb.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'ga540012',
    database: 'minecraft_bot',
    connectionLimit: 5,
    autoCommit: true  // Принудительно включаем автокоммит
  });
  
  let connection;

  try {
    connection = await pool.getConnection();
    console.log('Подключение к базе данных успешно');
    
    // Проверяем текущее состояние
    console.log('\n=== ТЕКУЩЕЕ СОСТОЯНИЕ ===');
    const currentState = await connection.query(
      `SELECT id, username, role, can_vote, minecraft_uuid FROM users WHERE id = 2`
    );
    
    if (currentState.length > 0) {
      const user = currentState[0];
      console.log(`Пользователь ID ${user.id}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Can Vote: ${user.can_vote}`);
      console.log(`  UUID: ${user.minecraft_uuid}`);
    }
    
    // Выполняем обновление с явным указанием значений
    console.log('\n=== ВЫПОЛНЯЕМ ОБНОВЛЕНИЕ ===');
    const updateResult = await connection.query(
      `UPDATE users SET role = 'member', can_vote = 1 WHERE id = 2`
    );
    
    console.log(`Результат обновления: affectedRows = ${updateResult.affectedRows}`);
    
    // Проверяем результат после обновления
    console.log('\n=== СОСТОЯНИЕ ПОСЛЕ ОБНОВЛЕНИЯ ===');
    const afterUpdate = await connection.query(
      `SELECT id, username, role, can_vote, minecraft_uuid FROM users WHERE id = 2`
    );
    
    if (afterUpdate.length > 0) {
      const user = afterUpdate[0];
      console.log(`Пользователь ID ${user.id}:`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Can Vote: ${user.can_vote}`);
      console.log(`  UUID: ${user.minecraft_uuid}`);
    }
    
    // Проверяем, найдется ли пользователь теперь запросом whitelist
    console.log('\n=== ПРОВЕРКА ЗАПРОСА WHITELIST ===');
    const whitelistUsers = await connection.query(
      `SELECT * FROM users WHERE role = 'member' AND minecraft_uuid IS NOT NULL AND minecraft_uuid != ''`
    );
    
    console.log(`Найдено пользователей для whitelist: ${whitelistUsers.length}`);
    
    if (whitelistUsers.length > 0) {
      whitelistUsers.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, Username: ${user.username}, UUID: ${user.minecraft_uuid}`);
      });
    }
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

directUpdate().catch(console.error);