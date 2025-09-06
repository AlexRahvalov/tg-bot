const mariadb = require('mariadb');

async function checkTableStructure() {
  let connection;
  try {
    connection = await mariadb.createConnection({
      host: 'localhost',
      user: 'root',
      password: '123456',
      database: 'minecraft_bot'
    });

    console.log('Подключение к БД установлено');
    
    const result = await connection.query('DESCRIBE users');
    console.log('\nСтруктура таблицы users:');
    console.table(result);
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkTableStructure();