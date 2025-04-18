
---
> Идея проекта заключается в создании демократичной системы принятия новых участников на Minecraft-сервер, где решение принимается голосованием, а не единоличным администратором. Это интересный подход к формированию сообщества, где:
> 
> 1. Новые участники проходят "социальный фильтр"
> 2. Участники могут влиять на состав сообщества
> 3. Существует механизм самоочистки от проблемных игроков
> 4. Администраторы получают инструменты для управления процессом
---
## **Основные роли пользователей:**

- **Новый пользователь** — подаёт заявку.
- **Участник сообщества** — может голосовать, задавать вопросы.    
- **Администратор** — управляет правами, следит за процессами.

---

## **Основные модули и шаги работы системы**

### **1. Регистрация нового пользователя**
- [ ] 
- Пользователь запускает бота.
- Вводит свой **ник в Minecraft**.
- Отвечает на вопрос: **"Почему вы хотите попасть на сервер?"**    
- Заявка записывается в базу данных со статусом "На голосовании".

---

### **2. Голосование за заявку**
- [ ] 
- Всем участникам, имеющим право голосовать, рассылается сообщение с информацией о заявке.
- Участники голосуют с помощью реакций:
    - 👍 (Положительно)        
    - 👎 (Негативно)
        
- Под сообщением доступна кнопка **"Задать вопрос"**, открывающая форму для уточнений.

---

### **3. Завершение голосования**
- [ ] 
- Голосование длится фиксированное время (например, 24 часа, настраивается администратором).
- Если **не набрано достаточного количества голосов**, заявка отклоняется автоматически.
- Если **большинство голосов положительные**, заявка принимается.
- Бот проверяет ник в системе Mojang:
    - Если ник существует, используется его UUID.        
    - Если нет — генерируется оффлайн UUID.

---

### **4. Добавление в белый список**
- [ ] 
- Бот добавляет игрока в белый список Minecraft-сервера по UUID.    
- Заявка получает статус "Принята".

---

### **5. Вопросы к заявке**
- [ ] 
- Участники могут задавать вопросы заявителю.
- Все вопросы и ответы сохраняются в БД.
- Ответы приходят в виде личных сообщений в Telegram.

---

## **Дополнительный функционал**

### **6. Мониторинг участников сообщества**

- В боте доступен список всех участников сервера.
   
- Каждый участник может оставлять:
    - 👍 (респект)
    - 👎 (жалоба)
        
- Если пользователь получает **больше негативных реакций**, чем указано в настройках, бот автоматически:
    - Удаляет его из белого списка.
    - Помечает статус "Исключён".
    - Уведомляет администратора.

---

### **7. Права и панель администратора**

- Администратор может:
    - Просматривать список пользователей и их статус.
    - Назначать/снимать право голосования и обсуждения заявок.
    - Изменять настройки системы (время голосования, порог голосов, порог негативных реакций и т.д.).
    - Исключать участников вручную.
    - Обрабатывать жалобы и вручную одобрять/отклонять заявки.