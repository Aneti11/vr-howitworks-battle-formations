const express = require('express');
const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// ====================================================
// СПИСОК ТВОИХ GOOGLE DOCS
// Чтобы добавить новый документ — просто добавь ссылку
// ====================================================
const GOOGLE_DOCS = [
  "https://docs.google.com/document/d/10pTYe4LHdNI5Hjuuk9wcK0airdkDdegglLkxYuWHRbU/edit?usp=sharing",
  "https://docs.google.com/document/d/1awJJymLhGYQKJqVEhMn-DV7A4ROafZ5UNiZHBk8cPr4/edit?usp=sharing",
  "https://docs.google.com/document/d/1p4QqGCSF32tuYfETVUdrpmz9wbhfLin6Jev0lfEop7k/edit?usp=sharing",
  "https://docs.google.com/document/d/1mytnd0ZwuwgpmMLPl0YQFTdFJfgd8_e-isElQb33he0/edit?usp=sharing",
  "https://docs.google.com/document/d/1C18hXJNV1SMIMzI2z6prv3g9_g6MEY1kX9WmUlqRBSA/edit?usp=sharing",
  // Сюда добавляй новые документы:
  // "https://docs.google.com/document/d/ВАШ_ID/edit?usp=sharing",
];

// Состояние пользователей (в памяти)
const userState = {};

// ====================================================
// ЧИТАЕМ GOOGLE DOC
// ====================================================
function getDocExportUrl(shareUrl) {
  const match = shareUrl.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://docs.google.com/document/d/${match[1]}/export?format=txt`;
}

async function fetchDoc(url) {
  try {
    const exportUrl = getDocExportUrl(url);
    if (!exportUrl) return '';
    const res = await fetch(exportUrl);
    if (!res.ok) return '';
    return await res.text();
  } catch {
    return '';
  }
}

async function fetchAllDocs() {
  const texts = await Promise.all(GOOGLE_DOCS.map(fetchDoc));
  return texts.filter(t => t.length > 0).join('\n\n---\n\n');
}

// ====================================================
// ЗАПРОС К GEMINI
// ====================================================
async function askGemini(gameData, userQuery) {
  const systemPrompt = `Ты — аналитик игры Viking Rise. У тебя есть подробные данные об игре: герои, умения, снаряжение и механики боя.

ВАЖНЫЕ ПРАВИЛА:
- Отвечай ТОЛЬКО на основе предоставленных данных. Не придумывай ничего, чего нет в источниках.
- Если данных недостаточно — честно скажи об этом.
- Давай конкретные рекомендации: главный герой, второй герой, обоснование.
- Умения перечисляй в порядке приоритета, минимум 4 штуки.
- Отвечай кратко и по делу. Без лишней воды.
- Используй русский язык.

ДАННЫЕ ОБ ИГРЕ:
${gameData}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\nЗАПРОС ПОЛЬЗОВАТЕЛЯ:\n${userQuery}` }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.3 }
      })
    }
  );
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Не удалось получить ответ. Попробуй ещё раз.';
}

// ====================================================
// TELEGRAM: ОТПРАВКА СООБЩЕНИЙ
// ====================================================
async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function editMessage(chatId, messageId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  };
  if (keyboard) body.reply_markup = keyboard;
  await fetch(`${TELEGRAM_API}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// ====================================================
// МЕНЮ: ШАГИ ВЫБОРА
// ====================================================
const TROOP_TYPES = [
  { label: '⚔️ Пехота', value: 'пехота' },
  { label: '🛡️ Пикинеры', value: 'пикинеры' },
  { label: '🏹 Лучники', value: 'лучники' },
  { label: '🔀 Смешанный', value: 'смешанный (все войска)' },
];

const ACTIVITIES = [
  { label: '⚔️ PvP-дуэль', value: 'PvP-дуэль' },
  { label: '🛡️ масс-PvP (танк)', value: 'масс-PvP (танк)' },
  { label: '💥 масс-PvP (ДД/КП)', value: 'масс-PvP (ДД - фарм КП)' },
  { label: '🎯 Ралли PvP', value: 'Ралли (войска сбора) в PvP' },
  { label: '🌿 Ралли PvE', value: 'Ралли (войска сбора) в PvE' },
  { label: '👾 Фарм мобов PvE', value: 'фарм мобов в PvE' },
  { label: '🌐 Универсальный', value: 'универсальный' },
];

const SEASONS = [
  { label: '🌱 Сезон 1', value: 'Сезон 1' },
  { label: '🌿 Сезон 2', value: 'Сезон 2' },
  { label: '🌳 Сезон 3', value: 'Сезон 3' },
  { label: '⚔️ Сезон завоеваний', value: 'Сезон завоеваний' },
];

// Герои по сезонам
const HEROES = {
  'Сезон 1': ['Айвор','Сесиль','Вудер','Олена','Верданди','Артур','Лэрд','Сигурд','Грегори','Йенс','Лейдольф','Ивана','Иветта','Рагнар','Хоберт','Бьорн'],
  'Сезон 2': ['Хельгар','Юльми','Лагерта'],
  'Сезон 3': ['Лодочник','Маргит','Леандра','Этельфледа'],
  'Сезон завоеваний': ['Рольф','Ная','Альф','Саша','Вали','Сефина','Гуннар','Хильда','Чарльтон','Хейдрун','Грета','Сигрид','Сигни','Тироти','Глоа','Дэйлен','Олаф','Торстейн','Хаварл','Гальвейг','Эфлрея'],
};

function buildInlineKeyboard(items, prefix, cols = 2, selectedValues = []) {
  const buttons = items.map(item => ({
    text: selectedValues.includes(item.value) ? `✅ ${item.label}` : item.label,
    callback_data: `${prefix}:${item.value}`
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += cols) {
    rows.push(buttons.slice(i, i + cols));
  }
  return { inline_keyboard: rows };
}

function buildHeroKeyboard(season, selected = []) {
  const heroes = HEROES[season] || [];
  const buttons = heroes.map(h => ({
    text: selected.includes(h) ? `✅ ${h}` : h,
    callback_data: `hero:${h}`
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  rows.push([
    { text: '⏭ Пропустить', callback_data: 'hero:skip' },
    { text: '✅ Готово', callback_data: 'hero:done' }
  ]);
  return { inline_keyboard: rows };
}

// ====================================================
// ОБРАБОТКА ШАГОВ
// ====================================================
async function handleStart(chatId) {
  userState[chatId] = { step: 'troop', activities: [], heroes: [] };
  await sendMessage(
    chatId,
    '👋 Привет! Я помогу подобрать сборку для Viking Rise.\n\n<b>Шаг 1 из 4: Выбери тип войск</b>',
    buildInlineKeyboard(TROOP_TYPES, 'troop', 2)
  );
}

async function handleCallback(chatId, messageId, data) {
  const state = userState[chatId] || {};
  const [prefix, ...valueParts] = data.split(':');
  const value = valueParts.join(':');

  // Шаг 1: тип войск
  if (prefix === 'troop') {
    state.troop = value;
    state.step = 'activity';
    state.activities = [];
    userState[chatId] = state;
    await editMessage(
      chatId, messageId,
      `✅ Войска: <b>${value}</b>\n\n<b>Шаг 2 из 4: Выбери вид активности</b>\nМожно выбрать несколько. Нажми ✅ Готово когда закончишь.`,
      buildActivityKeyboard(state.activities)
    );
    return;
  }

  // Шаг 2: активность (мультивыбор)
  if (prefix === 'act') {
    if (value === 'done') {
      if (state.activities.length === 0) {
        await sendMessage(chatId, '⚠️ Выбери хотя бы один вид активности!');
        return;
      }
      state.step = 'season';
      userState[chatId] = state;
      await editMessage(
        chatId, messageId,
        `✅ Войска: <b>${state.troop}</b>\n✅ Активность: <b>${state.activities.join(', ')}</b>\n\n<b>Шаг 3 из 4: Выбери сезон королевства</b>`,
        buildInlineKeyboard(SEASONS, 'season', 2)
      );
    } else {
      if (state.activities.includes(value)) {
        state.activities = state.activities.filter(a => a !== value);
      } else {
        state.activities.push(value);
      }
      userState[chatId] = state;
      await editMessage(
        chatId, messageId,
        `✅ Войска: <b>${state.troop}</b>\n\n<b>Шаг 2 из 4: Выбери вид активности</b>\nМожно выбрать несколько. Нажми ✅ Готово когда закончишь.`,
        buildActivityKeyboard(state.activities)
      );
    }
    return;
  }

  // Шаг 3: сезон
  if (prefix === 'season') {
    state.season = value;
    state.step = 'hero';
    state.heroes = [];
    userState[chatId] = state;
    await editMessage(
      chatId, messageId,
      `✅ Войска: <b>${state.troop}</b>\n✅ Активность: <b>${state.activities.join(', ')}</b>\n✅ Сезон: <b>${value}</b>\n\n<b>Шаг 4 из 4: Выбери героев</b>\nНеобязательно. Можно пропустить.`,
      buildHeroKeyboard(value, [])
    );
    return;
  }

  // Шаг 4: герои (мультивыбор)
  if (prefix === 'hero') {
    if (value === 'skip' || value === 'done') {
      await editMessage(chatId, messageId,
        `⏳ Формирую рекомендацию...\n\nЭто займёт несколько секунд.`
      );
      await generateRecommendation(chatId, state);
    } else {
      if (state.heroes.includes(value)) {
        state.heroes = state.heroes.filter(h => h !== value);
      } else {
        state.heroes.push(value);
      }
      userState[chatId] = state;
      await editMessage(
        chatId, messageId,
        `✅ Войска: <b>${state.troop}</b>\n✅ Активность: <b>${state.activities.join(', ')}</b>\n✅ Сезон: <b>${state.season}</b>\n\n<b>Шаг 4 из 4: Выбери героев</b>\nВыбрано: ${state.heroes.length > 0 ? state.heroes.join(', ') : 'никого'}`,
        buildHeroKeyboard(state.season, state.heroes)
      );
    }
    return;
  }
}

function buildActivityKeyboard(selected = []) {
  const buttons = ACTIVITIES.map(item => ({
    text: selected.includes(item.value) ? `✅ ${item.label}` : item.label,
    callback_data: `act:${item.value}`
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2));
  }
  rows.push([{ text: '✅ Готово', callback_data: 'act:done' }]);
  return { inline_keyboard: rows };
}

async function generateRecommendation(chatId, state) {
  try {
    const gameData = await fetchAllDocs();
    const heroText = state.heroes.length > 0
      ? `Предпочтительные герои: ${state.heroes.join(', ')}`
      : 'Предпочтения по героям не указаны — выбери лучший вариант из доступных в данном сезоне.';

    const query = `Подбери сборку для следующих условий:
- Тип войск: ${state.troop}
- Вид активности: ${state.activities.join(', ')}
- Сезон королевства: ${state.season}
- ${heroText}

Дай рекомендацию:
1. Главный герой и почему
2. Второй герой и почему
3. Умения в порядке приоритета (минимум 4)
4. Снаряжение (если есть данные)`;

    const answer = await askGemini(gameData, query);

    await sendMessage(chatId, `📋 <b>Рекомендация для твоей сборки:</b>\n\n${answer}`);
    await sendMessage(
      chatId,
      '🔄 Хочешь подобрать ещё одну сборку?',
      { inline_keyboard: [[{ text: '🔄 Новый запрос', callback_data: 'restart' }]] }
    );
  } catch (err) {
    await sendMessage(chatId, '❌ Произошла ошибка. Попробуй ещё раз — напиши /start');
  }
}

// ====================================================
// WEBHOOK
// ====================================================
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  const update = req.body;

  if (update.message) {
    const chatId = update.message.chat.id;
    const text = update.message.text;
    if (text === '/start' || text === '/start@BattleFormationsVRhowitworks_bot') {
      await handleStart(chatId);
    }
  }

  if (update.callback_query) {
    const chatId = update.callback_query.message.chat.id;
    const messageId = update.callback_query.message.message_id;
    const data = update.callback_query.data;

    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: update.callback_query.id })
    });

    if (data === 'restart') {
      await handleStart(chatId);
    } else {
      await handleCallback(chatId, messageId, data);
    }
  }
});

app.get('/', (req, res) => res.send('Bot is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
