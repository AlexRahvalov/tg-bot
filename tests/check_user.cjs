const mariadb = require('mariadb');

async function checkUser() {
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
    
    // Проверяем пользователя с telegram_id из скриншота
    const users = await connection.query(
      `SELECT u.id, u.telegram_id, u.username, u.nickname, u.minecraft_nickname, u.role, u.can_vote, 
              a.status as application_status, a.id as application_id
       FROM users u 
       LEFT JOIN applications a ON u.id = a.user_id 
       ORDER BY u.telegram_id, a.created_at DESC`
    );
    
    console.log('\nВсе пользователи в системе:');
    for (const user of users) {
      console.log(`ID: ${user.id}, Telegram ID: ${user.telegram_id}, Username: ${user.username}`);
      console.log(`  Nickname: ${user.nickname}, Minecraft: ${user.minecraft_nickname}`);
      console.log(`  Role: ${user.role}, Can Vote: ${user.can_vote}`);
      console.log(`  Application Status: ${user.application_status}, App ID: ${user.application_id}`);
      console.log('---');
    }
    
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
    await pool.end();
  }
}

checkUser();