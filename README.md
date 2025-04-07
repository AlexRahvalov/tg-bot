# Telegram-бот для доступа к Minecraft-серверу

Этот проект представляет собой Telegram-бота для демократичного управления доступом к приватному Minecraft-серверу. Бот позволяет обрабатывать заявки на вступление, проводить голосования среди участников и автоматически добавлять одобренных игроков в белый список сервера.

## Основные возможности

- 📝 Подача заявок новыми пользователями
- 🗳️ Голосование за заявки от участников сообщества
- ❓ Возможность задавать вопросы заявителям
- ✅ Автоматическое добавление принятых игроков в белый список сервера
- 👮 Система отзывов и контроля участников
- 🛠️ Панель администратора для управления сервером

## Технологический стек

- TypeScript
- Bun (JavaScript runtime)
- grammy (библиотека для Telegram Bot API)
- MariaDB (база данных)
- Docker (для контейнеризации)

## Требования

- [Bun](https://bun.sh) версии 1.2.8 или выше
- [Docker](https://www.docker.com) и Docker Compose для запуска базы данных
- API-токен Telegram бота от [BotFather](https://t.me/BotFather)
- Minecraft-сервер с доступом к RCON

## Установка и запуск

1. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/tg-bot.git
cd tg-bot
```

2. Создайте файл `.env` в корне проекта и заполните его своими данными:
```
BOT_TOKEN=your_telegram_bot_token
DB_PASSWORD=your_database_password
```

3. Запустите бота:

**На Windows:**
```powershell
.\scripts\setup.ps1
```

**На Linux/macOS:**
```bash
chmod +x ./scripts/setup.sh
./scripts/setup.sh
```

## Разработка

Для запуска в режиме разработки:
```
bun run dev
```

Для сборки проекта:
```
bun run build
```

## Лицензия

Проект распространяется под лицензией MIT.

## Автор

- [AlexRahvalov](https://t.me/AlexRahvalov)
