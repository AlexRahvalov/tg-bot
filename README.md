# Telegram-бот для доступа к Minecraft-серверу

Этот бот реализует демократичную систему принятия новых участников на Minecraft-сервер через голосование.

## Особенности

- Новые участники подают заявки через Telegram-бота
- Существующие участники голосуют за или против принятия
- Участники могут задавать вопросы заявителям
- Автоматическое добавление/удаление игроков из белого списка сервера
- Система мониторинга участников сообщества
- Панель администратора для управления правами и настройками

## Требования

- [Bun](https://bun.sh/) 1.2.9 или выше
- [Docker](https://www.docker.com/) и Docker Compose для запуска базы данных
- Minecraft-сервер с настроенным RCON
- Telegram-бот (получите токен у @BotFather)

## Установка

1. Клонируйте репозиторий:
```
git clone https://github.com/AlexRahvalov/tg-bot.git
cd tg-bot
```

2. Установите зависимости:
```
bun install
```

3. Скопируйте файл `.env.example` в `.env` и настройте его:
```
cp .env.example .env
```

4. Отредактируйте `.env` файл, установив ваши настройки:
   - `BOT_TOKEN` - токен Telegram-бота
   - `DB_*` - настройки базы данных
   - `MINECRAFT_*` - настройки Minecraft-сервера
   - `ADMIN_TELEGRAM_ID` - ID администратора в Telegram

5. Запустите базу данных:
```
docker-compose up -d
```

6. Запустите миграцию базы данных:
```
bun run src/database/migration.ts
```

## Запуск

### Режим разработки
```
bun run dev
```

### Сборка и запуск в продакшн
```
bun run build
bun run start
```

## Структура проекта

- `src/index.ts` - Главный файл приложения
- `src/database/` - Модули работы с базой данных
- `src/models/` - Модели данных
- `src/services/` - Бизнес-логика
- `src/controllers/` - Обработчики команд и сообщений
- `src/utils/` - Вспомогательные функции
- `src/middleware/` - Промежуточные обработчики

## Основные команды бота

- `/start` - Начать взаимодействие с ботом
- `/apply` - Подать заявку на вступление в сервер
- `/status` - Проверить статус своей заявки
- `/help` - Показать список команд

## Лицензия

MIT

## Автор

Alexander Rahvalov (t.me/AlexRahvalov)

## Вклад

Приветствуются пулл-реквесты и сообщения об ошибках!
