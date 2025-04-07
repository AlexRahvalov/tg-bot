import { Bot } from 'grammy';
import * as dotenv from 'dotenv';

// Загружаем переменные окружения
dotenv.config();

// Получаем токен бота из переменных окружения
const botToken = process.env.BOT_TOKEN;

if (!botToken) {
  console.error('Ошибка: Не указан токен Telegram-бота (BOT_TOKEN)');
  process.exit(1);
}

// Создаем экземпляр бота
const bot = new Bot(botToken);

// Функция для получения ID пользователя
async function setupIdHelper() {
  console.log('🤖 Запускаем бота для получения Telegram ID...');
  console.log('📱 Отправьте любое сообщение боту, чтобы узнать свой ID');
  
  // Обработчик для всех сообщений
  bot.on('message', async (ctx) => {
    if (!ctx.from) return;
    
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name;
    const lastName = ctx.from.last_name || '';
    const username = ctx.from.username ? `@${ctx.from.username}` : 'не указан';
    
    console.log(`✅ Получена информация о пользователе:`);
    console.log(`👤 Имя: ${firstName} ${lastName}`);
    console.log(`🔑 Telegram ID: ${userId}`);
    console.log(`📝 Username: ${username}`);
    
    await ctx.reply(
      `📋 Информация о вашем аккаунте:\n\n` +
      `👤 Имя: ${firstName} ${lastName}\n` +
      `🔑 Telegram ID: ${userId}\n` +
      `📝 Username: ${username}\n\n` +
      `Для назначения вас администратором укажите ваш Telegram ID (${userId}) в параметре ADMIN_TELEGRAM_ID в файле .env`
    );
  });
  
  // Запускаем бота
  await bot.start();
}

// Запускаем функцию
setupIdHelper().catch(console.error); 