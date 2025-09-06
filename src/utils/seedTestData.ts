import { UserRepository } from '../db/repositories/userRepository';
import { UserRole } from '../models/types';
import { logger } from './logger';
import { initializeDatabase, closeDatabase } from '../db/connection';

/**
 * Создание тестовых пользователей
 */
export async function seedTestUsers() {
  try {
    await initializeDatabase();
    logger.info('Начинаем заполнение базы тестовыми пользователями...');
    
    const userRepository = new UserRepository();
    
    // Проверяем, есть ли уже пользователи в базе
    const existingUsers = await userRepository.findAll();
    
    if (existingUsers.length > 1) {
      logger.info(`В базе уже есть ${existingUsers.length} пользователей. Пропускаем заполнение тестовыми данными.`);
      return;
    }
    
    // Примеры тестовых пользователей
    const testUsers = [
      {
        telegramId: 123456789,
        username: 'testuser1',
        minecraftNickname: 'MinePlayer1',
        role: UserRole.MEMBER,
        canVote: true,
        reputation: 5
      },
      {
        telegramId: 987654321,
        username: 'testuser2',
        minecraftNickname: 'MinePlayer2',
        role: UserRole.MEMBER,
        canVote: true,
        reputation: -2
      },
      {
        telegramId: 123789456,
        username: 'testuser3',
        minecraftNickname: 'MinePlayer3',
        role: UserRole.MEMBER,
        canVote: true,
        reputation: 0
      }
    ];
    
    // Создаем тестовых пользователей
    for (const userData of testUsers) {
      const existingUser = await userRepository.findByMinecraftNickname(userData.minecraftNickname);
      
      if (!existingUser) {
        await userRepository.create(userData);
        logger.info(`Создан тестовый пользователь: ${userData.minecraftNickname}`);
      } else {
        logger.info(`Пользователь ${userData.minecraftNickname} уже существует, пропускаем...`);
      }
    }
    
    logger.info('Тестовые пользователи успешно созданы!');
    
  } catch (error) {
    logger.error('Ошибка при создании тестовых пользователей:', error);
  } finally {
    await closeDatabase();
  }
}

// Запускаем функцию заполнения, если скрипт вызван напрямую
if (require.main === module) {
  seedTestUsers().then(() => {
    process.exit(0);
  }).catch((error) => {
    logger.error('Ошибка при выполнении скрипта заполнения:', error);
    process.exit(1);
  });
}