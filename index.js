// ====================================================
// СПИСОК ТВОИХ GOOGLE DOCS
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

const TROOP_TYPES = [
  { label: '⚔️ Пехота', value: 'пехота' },
  { label: '🛡️ Пикинеры', value: 'пикинеры' },
  { label: '🏹 Лучники', value: 'лучники' },
  { label: '🔀 Смешанный', value: 'смешанный' },
];

const ACTIVITIES = [
  { label: '⚔️ PvP-дуэль', value: 'pvp_duel' },
  { label: '🛡️ масс-PvP танк', value: 'mass_pvp_tank' },
  { label: '💥 масс-PvP ДД', value: 'mass_pvp_dd' },
  { label: '🎯 Ралли PvP', value: 'rally_pvp' },
  { label: '🌿 Ралли PvE', value: 'rally_pve' },
  { label: '👾 Фарм мобов', value: 'farm_pve' },
  { label: '🌐 Универсальный', value: 'universal' },
];

const ACTIVITY_LABELS = {
  pvp_duel: 'PvP-дуэль',
  mass_pvp_tank: 'масс-PvP (танк)',
  mass_pvp_dd: 'масс-PvP (ДД - фарм КП)',
  rally_pvp: 'Ралли (войска сбора) в PvP',
  rally_pve: 'Ралли (войска сбора) в PvE',
  farm_pve: 'фарм мобов в PvE',
  universal: 'универсальный',
};

const SEASONS = [
  { label: '🌱 Сезон 1', value: 's1' },
  { label: '🌿 Сезон 2', value: 's2' },
  { label: '🌳 Сезон 3', value: 's3' },
  { label: '⚔️ Сезон завоеваний', value: 'sc' },
];

const SEASON_LABELS = { s1: 'Сезон 1', s2: 'Сезон 2', s3: 'Сезон 3', sc: 'Сезон завоеваний' };

const HEROES = {
  s1: ['Айвор','Сесиль','Вудер','Олена','Верданди','Артур','Лэрд','Сигурд','Грегори','Йенс','Лейдольф','Ивана','Иветта','Рагнар','Хоберт','Бьорн'],
  s2: ['Хельгар','Юльми','Лагерта'],
  s3: ['Лодочник','Маргит','Леандра','Этельфледа'],
  sc: ['Рольф','Ная','Альф','Саша','Вали','Сефина','Гуннар','Хильда','Чарльтон','Хейдрун','Грета','Сигрид','Сигни','Тироти','Глоа','Дэйлен','Олаф','Торстейн','Хаварл','Гальвейг','Эфлрея'],
};

// Состояние кодируется в callback_data: step|troop|acts|season|heroes
// Это позволяет не хранить состояние на сервере

function encodeState(state) {
  return [
    state.troop || '',
    (state.acts || []).join(','),
    state.season || '',
    (state.heroes || []).join(','),
  ].join('|');
}

function decodeState(str) {
  const parts = str.split('|');
  return {
    troop: parts[0] || '',
    acts: parts[1] ? parts[1].split(',').filter(Boolean) : [],
    season: parts[2] || '',
    heroes: parts[3] ? parts[3].split(',').filter(Boolean) : [],
  };
}

// ====================================================
// GOOGLE DOCS
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
  } catch { return ''; }
}

async function fetchAllDocs() {
  const texts = await Promise.all(GOOGLE_DOCS.map(fetchDoc));
  return texts.filter(t => t.length > 0).join('\n\n---\n\n');
}

// ====================================================
// GEMINI
// ====================================================
async function askGemini(gameData, userQuery, apiKey) {
  const prompt = `Ты — аналитик игры Viking Rise. У тебя есть подробные данные об игре.

ПРАВИЛА:
- Отвечай ТОЛЬКО на основе предоставленных данных.
- Давай конкретные рекомендации: главный герой, второй герой, обоснование.
- Умения перечисляй в порядке приоритета, минимум 4 штуки.
- Отвечай кратко и по делу. Используй русский язык.

ДАННЫЕ ОБ ИГРЕ:
${gameData}

ЗАПРОС:
${userQuery}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.3 }
      })
    }
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Нет ответа от Gemini.';
}

// ====================================================
// TELEGRAM
// ====================================================
async function tg(method, body, token) {
  await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function sendMessage(chatId, text, keyboard, token) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  await tg('sendMessage', body, token);
}

async function editMessage(chatId, messageId, text, keyboard, token) {
  const body = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' };
  if (keyboard) body.reply_markup = keyboard;
  await tg('editMessageText', body, token);
}

// ====================================================
// КЛАВИАТУРЫ
// ====================================================
function troopKeyboard() {
  const rows = [];
  for (let i = 0; i < TROOP_TYPES.length; i += 2) {
    rows.push(TROOP_TYPES.slice(i, i + 2).map(t => ({
      text: t.label,
      callback_data: `T|${t.value}||`
    })));
  }
  return { inline_keyboard: rows };
}

function activityKeyboard(state) {
  const selected = state.acts || [];
  const rows = [];
  for (let i = 0; i < ACTIVITIES.length; i += 2) {
    rows.push(ACTIVITIES.slice(i, i + 2).map(a => ({
      text: selected.includes(a.value) ? `✅ ${a.label}` : a.label,
      callback_data: `A|${encodeState(state)}~${a.value}`
    })));
  }
  rows.push([{ text: '✅ Готово', callback_data: `AD|${encodeState(state)}` }]);
  return { inline_keyboard: rows };
}

function seasonKeyboard(state) {
  const rows = [];
  for (let i = 0; i < SEASONS.length; i += 2) {
    rows.push(SEASONS.slice(i, i + 2).map(s => ({
      text: s.label,
      callback_data: `S|${encodeState(state)}~${s.value}`
    })));
  }
  return { inline_keyboard: rows };
}

function heroKeyboard(state) {
  const heroes = HEROES[state.season] || [];
  const selected = state.heroes || [];
  const rows = [];
  for (let i = 0; i < heroes.length; i += 3) {
    rows.push(heroes.slice(i, i + 3).map(h => ({
      text: selected.includes(h) ? `✅ ${h}` : h,
      callback_data: `H|${encodeState(state)}~${h}`
    })));
  }
  rows.push([
    { text: '⏭ Пропустить', callback_data: `HD|${encodeState(state)}` },
    { text: '✅ Готово', callback_data: `HD|${encodeState(state)}` },
  ]);
  return { inline_keyboard: rows };
}

// ====================================================
// ОБРАБОТКА
// ====================================================
async function handleStart(chatId, token) {
  await sendMessage(chatId,
    '👋 Привет! Я помогу подобрать сборку для Viking Rise.\n\n<b>Шаг 1 из 4: Выбери тип войск</b>',
    troopKeyboard(), token
  );
}

async function handleCallback(chatId, messageId, data, token, geminiKey) {
  const [cmd, ...rest] = data.split('|');
  const payload = rest.join('|');

  // Шаг 1: выбор войск
  if (cmd === 'T') {
    const [troop] = payload.split('|');
    const state = { troop, acts: [], season: '', heroes: [] };
    await editMessage(chatId, messageId,
      `✅ Войска: <b>${troop}</b>\n\n<b>Шаг 2 из 4: Выбери вид активности</b>\nМожно выбрать несколько. Нажми ✅ Готово когда закончишь.`,
      activityKeyboard(state), token
    );
    return;
  }

  // Шаг 2: выбор активности (переключение)
  if (cmd === 'A') {
    const [stateStr, actValue] = payload.split('~');
    const state = decodeState(stateStr);
    if (state.acts.includes(actValue)) {
      state.acts = state.acts.filter(a => a !== actValue);
    } else {
      state.acts.push(actValue);
    }
    const actNames = state.acts.map(a => ACTIVITY_LABELS[a] || a).join(', ') || 'ничего';
    await editMessage(chatId, messageId,
      `✅ Войска: <b>${state.troop}</b>\n\n<b>Шаг 2 из 4: Выбери вид активности</b>\nВыбрано: ${actNames}\n\nНажми ✅ Готово когда закончишь.`,
      activityKeyboard(state), token
    );
    return;
  }

  // Шаг 2: готово
  if (cmd === 'AD') {
    const state = decodeState(payload);
    if (!state.acts || state.acts.length === 0) {
      await sendMessage(chatId, '⚠️ Выбери хотя бы один вид активности!', null, token);
      return;
    }
    const actNames = state.acts.map(a => ACTIVITY_LABELS[a] || a).join(', ');
    await editMessage(chatId, messageId,
      `✅ Войска: <b>${state.troop}</b>\n✅ Активность: <b>${actNames}</b>\n\n<b>Шаг 3 из 4: Выбери сезон королевства</b>`,
      seasonKeyboard(state), token
    );
    return;
  }

  // Шаг 3: выбор сезона
  if (cmd === 'S') {
    const [stateStr, season] = payload.split('~');
    const state = decodeState(stateStr);
    state.season = season;
    state.heroes = [];
    const actNames = state.acts.map(a => ACTIVITY_LABELS[a] || a).join(', ');
    await editMessage(chatId, messageId,
      `✅ Войска: <b>${state.troop}</b>\n✅ Активность: <b>${actNames}</b>\n✅ Сезон: <b>${SEASON_LABELS[season]}</b>\n\n<b>Шаг 4 из 4: Выбери героев</b>\nНеобязательно — можно пропустить.`,
      heroKeyboard(state), token
    );
    return;
  }

  // Шаг 4: выбор героя (переключение)
  if (cmd === 'H') {
    const [stateStr, hero] = payload.split('~');
    const state = decodeState(stateStr);
    if (state.heroes.includes(hero)) {
      state.heroes = state.heroes.filter(h => h !== hero);
    } else {
      state.heroes.push(hero);
    }
    const actNames = state.acts.map(a => ACTIVITY_LABELS[a] || a).join(', ');
    await editMessage(chatId, messageId,
      `✅ Войска: <b>${state.troop}</b>\n✅ Активность: <b>${actNames}</b>\n✅ Сезон: <b>${SEASON_LABELS[state.season]}</b>\n\n<b>Шаг 4 из 4: Выбери героев</b>\nВыбрано: ${state.heroes.length > 0 ? state.heroes.join(', ') : 'никого'}`,
      heroKeyboard(state), token
    );
    return;
  }

  // Шаг 4: готово — генерируем рекомендацию
  if (cmd === 'HD') {
    const state = decodeState(payload);
    const actNames = state.acts.map(a => ACTIVITY_LABELS[a] || a).join(', ');
    await editMessage(chatId, messageId,
      '⏳ Формирую рекомендацию...\n\nЭто займёт несколько секунд.',
      null, token
    );
    try {
      const gameData = await fetchAllDocs();
      const heroText = state.heroes.length > 0
        ? `Предпочтительные герои: ${state.heroes.join(', ')}`
        : 'Предпочтения по героям не указаны.';

      const query = `Подбери сборку:
- Тип войск: ${state.troop}
- Вид активности: ${actNames}
- Сезон королевства: ${SEASON_LABELS[state.season]}
- ${heroText}

Дай рекомендацию:
1. Главный герой и почему
2. Второй герой и почему
3. Умения в порядке приоритета (минимум 4)
4. Снаряжение (если есть данные)`;

      const answer = await askGemini(gameData, query, geminiKey);
      await sendMessage(chatId, `📋 <b>Рекомендация:</b>\n\n${answer}`, null, token);
      await sendMessage(chatId, '🔄 Хочешь подобрать ещё одну сборку?', {
        inline_keyboard: [[{ text: '🔄 Новый запрос', callback_data: 'START' }]]
      }, token);
    } catch (err) {
      await sendMessage(chatId, `❌ Ошибка: ${err.message}`, null, token);
    }
    return;
  }

  if (cmd === 'START') {
    await handleStart(chatId, token);
    return;
  }
}

// ====================================================
// CLOUDFLARE WORKERS HANDLER
// ====================================================
export default {
  async fetch(request, env) {
    const token = env.TELEGRAM_TOKEN;
    const geminiKey = env.GEMINI_API_KEY;

    if (request.method === 'GET') {
      return new Response('Bot is running!', { status: 200 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const update = await request.json();

      if (update.message) {
        const chatId = update.message.chat.id;
        const text = update.message.text || '';
        if (text.startsWith('/start')) {
          await handleStart(chatId, token);
        }
      }

      if (update.callback_query) {
        const chatId = update.callback_query.message.chat.id;
        const messageId = update.callback_query.message.message_id;
        const data = update.callback_query.data;

        await tg('answerCallbackQuery', { callback_query_id: update.callback_query.id }, token);
        await handleCallback(chatId, messageId, data, token, geminiKey);
      }
    } catch (err) {
      console.error('Error:', err.message);
    }

    return new Response('OK', { status: 200 });
  }
};
