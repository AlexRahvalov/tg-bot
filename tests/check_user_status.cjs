const mariadb = require('mariadb');

async function checkUserStatus() {
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
    console.log('✅ Подключение к базе данных установлено');
    
    // Ищем пользователя oksana_rahvalova (правильный username)
    const users = await connection.query(
      `SELECT id, telegram_id, username, minecraft_nickname, role, can_vote, reputation 
       FROM users 
       WHERE username = 'oksana_rahvalova' OR minecraft_nickname LIKE '%oksana%' OR telegram_id = 1015554804`
    );
    
    console.log('\n=== РЕЗУЛЬТАТЫ ПОИСКА ПОЛЬЗОВАТЕЛЯ ===');
    
    if (users.length === 0) {
      console.log('❌ Пользователь oksanahvalova не найден');
      
      // Попробуем найти всех пользователей для отладки
      const allUsers = await connection.query(
        'SELECT id, telegram_id, username, minecraft_nickname, role, can_vote FROM users ORDER BY id DESC LIMIT 10'
      );
      
      console.log('\n=== ПОСЛЕДНИЕ 10 ПОЛЬЗОВАТЕЛЕЙ В СИСТЕМЕ ===');
      allUsers.forEach(user => {
        console.log(`ID: ${user.id}, TG: ${user.telegram_id}, Username: ${user.username}, Minecraft: ${user.minecraft_nickname}, Role: ${user.role}, CanVote: ${user.can_vote}`);
      });
    } else {
      users.forEach(user => {
        console.log(`\n👤 Пользователь найден:`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Telegram ID: ${user.telegram_id}`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Minecraft: ${user.minecraft_nickname}`);
        console.log(`  Роль: ${user.role}`);
        console.log(`  Право голоса: ${user.can_vote}`);
        console.log(`  Репутация: ${user.reputation}`);
        
        // Проверяем логику прав
        const hasVotingRights = user.can_vote === 1 && (user.role === 'member' || user.role === 'admin');
        console.log(`  Может голосовать/оценивать: ${hasVotingRights ? '✅ ДА' : '❌ НЕТ'}`);
        
        if (!hasVotingRights) {
          if (user.can_vote !== 1) {
            console.log(`    ❌ Проблема: can_vote = ${user.can_vote} (должно быть 1)`);
          }
          if (user.role !== 'member' && user.role !== 'admin') {
            console.log(`    ❌ Проблема: role = '${user.role}' (должно быть 'member' или 'admin')`);
          }
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Подключение к базе данных закрыто');
    }
    if (pool) {
      await pool.end();
    }
  }
}

checkUserStatus();