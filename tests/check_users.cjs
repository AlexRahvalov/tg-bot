const mariadb = require('mariadb');

async function checkUsers() {
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
    
    // Сначала покажем всех пользователей
    console.log('\n📋 Все пользователи в базе данных:');
    const allUsers = await connection.query('SELECT id, username, role, minecraft_uuid FROM users');
    allUsers.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}, Role: ${user.role}, UUID: ${user.minecraft_uuid}`);
    });
    
    // Проверяем пользователей с ролью 'member' и UUID
    const membersWithUUID = await connection.query(
      'SELECT * FROM users WHERE role = ? AND minecraft_uuid IS NOT NULL AND minecraft_uuid != ?',
      ['member', '']
    );

    console.log(`\n👥 Найдено ${membersWithUUID.length} пользователей с ролью 'member' и Minecraft UUID`);
    
    if (membersWithUUID.length === 0) {
      console.log('❌ Нет пользователей с ролью \'member\' и Minecraft UUID');
      
      // Дополнительная отладка
      console.log('\n🔍 Отладочная информация:');
      
      // Проверим пользователей только с ролью 'member'
      const membersOnly = await connection.query('SELECT * FROM users WHERE role = ?', ['member']);
      console.log(`- Пользователей с ролью 'member': ${membersOnly.length}`);
      
      // Проверим пользователей с UUID
      const usersWithUUID = await connection.query('SELECT * FROM users WHERE minecraft_uuid IS NOT NULL AND minecraft_uuid != ?', ['']);
      console.log(`- Пользователей с UUID: ${usersWithUUID.length}`);
      
      if (usersWithUUID.length > 0) {
        console.log('\n📋 Пользователи с UUID:');
        usersWithUUID.forEach(user => {
          console.log(`- ID: ${user.id}, Username: ${user.username}, Role: ${user.role}, UUID: ${user.minecraft_uuid}`);
        });
      }
    } else {
      console.log('\n📋 Пользователи с ролью \'member\' и UUID:');
      membersWithUUID.forEach(user => {
        console.log(`- ID: ${user.id}, Username: ${user.username}, Role: ${user.role}, UUID: ${user.minecraft_uuid}`);
      });
    }
    
  } catch (error) {
    console.error('Ошибка при работе с базой данных:', error);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

checkUsers().catch(console.error);