# Установка зависимостей
Write-Host "Установка зависимостей..." -ForegroundColor Green
bun install

# Запуск базы данных
Write-Host "Запуск базы данных..." -ForegroundColor Green
docker-compose up -d mariadb

# Пауза для запуска базы данных
Write-Host "Ожидание запуска базы данных..." -ForegroundColor Green
Start-Sleep -Seconds 5

# Запуск бота в режиме разработки
Write-Host "Запуск бота..." -ForegroundColor Green
bun run dev 