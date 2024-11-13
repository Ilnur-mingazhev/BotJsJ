const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();

// Токен вашего бота, полученный через BotFather
const token = '8075874421:AAHwWSia-Hs3bHeTFrTVPJnOVVofYBYPD1o';
const bot = new TelegramBot(token, { polling: true });

// Создание базы данных SQLite (или подключение к существующей)
const db = new sqlite3.Database('./calculations.db');

// Создание таблицы для хранения расчетов, если таблица еще не существует
db.run(`
  CREATE TABLE IF NOT EXISTS calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    propertyType TEXT,
    repairType TEXT,
    rooms INTEGER,
    bathrooms INTEGER,
    area REAL,
    contactMethod TEXT,
    chatId INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Структура данных для отслеживания состояния
let userData = {};

// Стартовое сообщение и кнопка
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userData[chatId] = {}; // Инициализация данных для пользователя
  
  const options = {
  reply_markup: {
    keyboard: [
      [{ text: "Расчет стоимости ремонта" }],
      [{ text: "Отзывы", url: 'https://vk.com/topic-214261496_48716771' }],
	  [{ text: "Топ часто задаваемых вопросов"}]
    ],
    resize_keyboard: true,
	one_time_keyboard: true
  }
};

bot.on('message', (msg) => {
  const chatId = msg.chat.id;

  if (msg.text === 'Отзывы') {
    // Отправляем сообщение с текстом ссылки
    bot.sendMessage(chatId, 'Нажмите на ссылку, чтобы открыть отзывы: https://vk.com/topic-214261496_48716771');
  }
});

bot.sendMessage(chatId, 'Добро пожаловать в ПроРемонт! Я с радостью помогу вам разобраться во всех тонкостях ремонта и выбрать оптимальные решения!', options);
});

// Обработка нажатия на кнопку "Расчет стоимости ремонта"
bot.onText(/Расчет стоимости ремонта/, (msg) => {
  const chatId = msg.chat.id;

  const options = {
    reply_markup: {
      keyboard: [
        [{ text: 'Новостройка' }, { text: 'Вторичка' }],
        [{ text: 'Частный дом' }, { text: 'Коммерческое' }]
      ],
      resize_keyboard: true
    }
  };

  bot.sendMessage(chatId, 'Выберите тип недвижимости:', options);
});

// Обработка выбора типа недвижимости
bot.onText(/^(Новостройка|Вторичка|Частный дом|Коммерческое)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const type = match[0];

  userData[chatId].propertyType = type; // Сохранение выбранного типа недвижимости

  const options = {
    reply_markup: {
      keyboard: [
        [{ text: 'Косметический' }, { text: 'Капитальный' }],
        [{ text: 'Дизайнерский' }]
      ],
      resize_keyboard: true
    }
  };

  bot.sendMessage(chatId, 'Выберите вид ремонта:', options);
});

// Обработка выбора вида ремонта
bot.onText(/^(Косметический|Капитальный|Дизайнерский)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const repairType = match[0];

  userData[chatId].repairType = repairType; // Сохранение выбранного типа ремонта

  const options = {
    reply_markup: {
      keyboard: [
        [{ text: '1' }, { text: '2' }, { text: '3' }],
        [{ text: '4 или более' }]
      ],
      resize_keyboard: true
    }
  };

  bot.sendMessage(chatId, 'Количество комнат:', options);
});

// Обработка выбора количества комнат
bot.onText(/^(1|2|3|4 или более)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const rooms = match[0];

  userData[chatId].rooms = rooms; // Сохранение количества комнат

  const options = {
    reply_markup: {
      keyboard: [
        [{ text: '1' }, { text: '2' }, { text: '3' }]
      ],
      resize_keyboard: true
    }
  };

  bot.sendMessage(chatId, 'Количество санузлов:', options);
});

// Обработка выбора количества санузлов
bot.onText(/^(1|2|3)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const bathrooms = match[0];

  userData[chatId].bathrooms = bathrooms; // Сохранение количества санузлов

  bot.sendMessage(chatId, 'Укажите площадь квартиры (в м²):');
});

// Обработка площади квартиры
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (userData[chatId] && userData[chatId].bathrooms && !isNaN(parseFloat(text))) {
    // Площадь квартиры
    userData[chatId].area = text;

    const options = {
      reply_markup: {
        keyboard: [
          [{ text: 'Телефон мастеру' }, { text: 'WhatsApp' }, { text: 'Telegram' }]
        ],
        resize_keyboard: true
      }
    };

    bot.sendMessage(chatId, 'Куда отправить расчет стоимости?', options);
  }
});

// Обработка выбора канала для отправки данных
bot.onText(/^(Телефон мастеру|WhatsApp|Telegram)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const contactMethod = match[0];

  userData[chatId].contactMethod = contactMethod; // Сохранение канала связи

  const summary = `
    Ремонт: ${userData[chatId].repairType}
    Тип недвижимости: ${userData[chatId].propertyType}
    Количество комнат: ${userData[chatId].rooms}
    Количество санузлов: ${userData[chatId].bathrooms}
    Площадь квартиры: ${userData[chatId].area} м²
    Канал связи: ${userData[chatId].contactMethod}
  `;

  // Сохранение данных в базу данных SQLite
  db.run(`
    INSERT INTO calculations (propertyType, repairType, rooms, bathrooms, area, contactMethod, chatId)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userData[chatId].propertyType, userData[chatId].repairType, userData[chatId].rooms, userData[chatId].bathrooms, userData[chatId].area, userData[chatId].contactMethod, chatId],
    function(err) {
      if (err) {
        bot.sendMessage(chatId, 'Произошла ошибка при сохранении данных.');
      } else {
        bot.sendMessage(chatId, 'Ваш расчет успешно сохранен.');
      }
    }
  );

  // Генерация ссылки для выбранного канала связи
  let sendLink = '';
  if (contactMethod === 'Телефон мастеру') {
    sendLink = `Телефон: +7 (919) 916-20-49`; // Подставьте телефон мастера (например, +1234567890)
  } else if (contactMethod === 'WhatsApp') {
    sendLink = `https://wa.me/+79199162049?text=${encodeURIComponent(summary)}`; // Ссылка на WhatsApp
  } else if (contactMethod === 'Telegram') {
    sendLink = `https://t.me/username?text=${encodeURIComponent(summary)}`; // Ссылка на Telegram (поменяйте на никнейм мастера)
  }

  // Отправка ссылки на выбранный канал
  bot.sendMessage(chatId, `Ваш расчет отправлен на: ${contactMethod}`);

  // Отправка ссылки мастеру
  bot.sendMessage(chatId, `Вот ссылка для связи с мастером: ${sendLink}`);

  // Кнопка для возврата на стартовую страницу
  const options = {
    reply_markup: {
      keyboard: [
        [{ text: "Начать заново" }]
      ],
      resize_keyboard: true
    }
  };
  bot.sendMessage(chatId, 'Вы можете начать новый расчет или /start', options);
});

// Обработка нажатия на кнопку "Начать заново"
bot.onText(/Начать заново/, (msg) => {
  const chatId = msg.chat.id;
  userData[chatId] = {}; // Сброс данных пользователя

  const options = {
    reply_markup: {
      keyboard: [
        [{ text: "Расчет стоимости ремонта" }]
		[{ text: "Отзывы", url: 'https://vk.com/topic-214261496_48716771' }],
		[{ text: "Топ часто задаваемых вопросов"}]
      ],
      resize_keyboard: true
    }
  };
  
bot.sendMessage(chatId, 'Добро пожаловать в ПроРемонт! Я с радостью помогу вам разобраться во всех тонкостях ремонта и выбрать оптимальные решения!', options);
});
