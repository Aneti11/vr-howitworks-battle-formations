# Battle Formations Helper Bot

Телеграм-бот для подбора сборок в Viking Rise.

## Настройка

### 1. Загрузи на GitHub
- Создай новый репозиторий на github.com
- Загрузи все файлы из этой папки

### 2. Задеплой на Vercel
- Зайди на vercel.com
- Нажми "Add New Project"
- Выбери свой репозиторий
- В разделе "Environment Variables" добавь:
  - `TELEGRAM_TOKEN` — токен от BotFather
  - `GEMINI_API_KEY` — ключ от Google AI Studio
- Нажми Deploy

### 3. Подключи вебхук
После деплоя у тебя будет адрес вида: `https://твой-проект.vercel.app`

Открой в браузере:
```
https://api.telegram.org/botТВОЙ_ТОКЕН/setWebhook?url=https://твой-проект.vercel.app/webhook
```

Замени ТВОЙ_ТОКЕН и адрес на свои значения.

### 4. Добавить новый документ
Открой файл `index.js`, найди раздел `GOOGLE_DOCS` и добавь ссылку.

## Обновление данных
Просто обновляй свои Google Docs — бот автоматически использует актуальные данные.
