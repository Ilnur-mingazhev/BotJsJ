const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');

// Токен вашего бота, полученный через BotFather
const token = '8075874421:AAHwWSia-Hs3bHeTFrTVPJnOVVofYBYPD1o';
const bot = new TelegramBot(token, { polling: true });

// Создание базы данных SQLite (или подключение к существующей)
const db = new sqlite3.Database('./DB/calculations.db');

// Настройка winston для логирования
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ],
});

logger.info('Bot started');

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

// Стартовое сообщение и инлайн-кнопки
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userData[chatId] = {}; // Инициализация данных для пользователя

  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🏠Расчет стоимости ремонта", callback_data: 'calculate_cost' }],
        [{ text: '📸 Портфолио наших объектов', url: 'https://proremont18.ru/nashi-rabotyi/' }],
        [{ text: "📝Отзывы", url: 'https://vk.com/app6326142_-214261496' }],
        [{ text: "❓Топ часто задаваемых вопросов(разработка)", callback_data: 'faq' }],
        [{ text: "🎁 ПОДАРОК", callback_data: 'gift' }],
        [{ text: 'Контактная информация 📞', callback_data: 'contact_info' }],
        [{ text: '👨‍💼 Связаться с менеджером', callback_data: 'contact_manager' }]
      ]
    }
  };

  bot.sendMessage(chatId, '🛠Добро пожаловать в ПроРемонт! Наш бот может рассчитать стоимость ремонта, записать вас на экскурсию по нашим действующим объектам, а также вы можете посмотреть портфолио наших объектов и отзывы заказчиков!🛠', options);
});

// Обработка callback-запросов
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;

  if (query.data === 'contact_info') {
    const contactInfo = `
Контактная информация:
📍 Адрес: г. Ижевск, ул. Металлургов, 2
📞 Телефон: +7 (919) 916-20-49
✉️ E-mail: proremont.18@yandex.ru
🕒 Режим работы: Пн. – Пт. с 8:00 до 17:00
    `;
    bot.sendMessage(chatId, contactInfo);
  } else if (query.data === 'contact_manager') {
    const contactInfo = `
👨‍💼 *Связаться с нашим менеджером:*
📞 Телефон: +7 (919) 916-20-49
📧 E-mail: proremont.18@yandex.ru
    `;
    bot.sendMessage(chatId, contactInfo);
  } else if (query.data === 'gift') {
    sendGiftFiles(chatId);
  }

  bot.answerCallbackQuery(query.id);
});

// Функция для отправки файлов
async function sendGiftFiles(chatId) {
  const loadingMsg = await bot.sendMessage(chatId, 'Загрузка файлов...');
  const pdfFiles = [
    'pdf/Aq.pdf',
    'pdf/compressed.pdf'
  ];

  for (const file of pdfFiles) {
    try {
      await bot.sendDocument(chatId, file);
      logger.info(`Файл ${file} отправлен успешно.`);
    } catch (error) {
      logger.error(`Ошибка при отправке файла ${file}: ${error.message}`);
      await bot.sendMessage(chatId, 'Ошибка при отправке файла.');
    }
  }

  await bot.deleteMessage(chatId, loadingMsg.message_id);
  bot.sendMessage(chatId, 'Файлы успешно отправлены!');
  logger.info('Все файлы отправлены.');
}

// Обработка нажатия на инлайн-кнопку "Расчет стоимости ремонта"
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (action === 'calculate_cost') {
    bot.sendMessage(chatId, 'Выберите тип недвижимости:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Новостройка', callback_data: 'new_building' }, { text: 'Вторичка', callback_data: 'secondary' }],
          [{ text: 'Частный дом', callback_data: 'house' }, { text: 'Коммерческое', callback_data: 'commercial' }]
        ]
      }
    });
  } else if (['new_building', 'secondary', 'house', 'commercial'].includes(action)) {
    userData[chatId].propertyType = action;
    bot.sendMessage(chatId, 'Выберите вид ремонта:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Косметический', callback_data: 'cosmetic' }, { text: 'Капитальный', callback_data: 'major' }],
          [{ text: 'Дизайнерский', callback_data: 'designer' }]
        ]
      }
    });
  } else if (['cosmetic', 'major', 'designer'].includes(action)) {
    userData[chatId].repairType = action;
    bot.sendMessage(chatId, 'Количество комнат:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '1', callback_data: 'rooms_1' }, { text: '2', callback_data: 'rooms_2' }, { text: '3', callback_data: 'rooms_3' }],
          [{ text: '4 или более', callback_data: 'rooms_4plus' }]
        ]
      }
    });
  } else if (['rooms_1', 'rooms_2', 'rooms_3', 'rooms_4plus'].includes(action)) {
    userData[chatId].rooms = action.replace('rooms_', '');
    bot.sendMessage(chatId, 'Количество санузлов:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '1', callback_data: 'bathrooms_1' }, { text: '2', callback_data: 'bathrooms_2' }, { text: '3', callback_data: 'bathrooms_3' }]
        ]
      }
    });
  } else if (['bathrooms_1', 'bathrooms_2', 'bathrooms_3'].includes(action)) {
    userData[chatId].bathrooms = action.replace('bathrooms_', '');
    bot.sendMessage(chatId, 'Укажите площадь квартиры (в м²):');
    bot.on('message', (msg) => {
      if (msg.chat.id === chatId && !isNaN(msg.text)) {
        userData[chatId].area = parseFloat(msg.text);
        bot.sendMessage(chatId, 'Выберите метод связи с вами:', {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'По телефону', callback_data: 'contact_phone' }],
              [{ text: 'Через WhatsApp', callback_data: 'contact_whatsapp' }],
              [{ text: 'Через Telegram', callback_data: 'contact_telegram' }]
            ]
          }
        });
      } else if (msg.chat.id === chatId) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную площадь в м².');
      }
    });
  } else if (['contact_phone', 'contact_whatsapp', 'contact_telegram'].includes(action)) {
    const contactMethod = action.replace('contact_', '');
    userData[chatId].contactMethod = contactMethod;
    saveCalculationToDb(chatId, userData[chatId]);
    bot.sendMessage(chatId, `✅Ваш расчет отправлен на: ${contactMethod}`);
    bot.sendMessage(chatId, `✅Вот ссылка для связи с мастером: ${getContactLink(contactMethod, chatId)}`);
  } else if (action === 'restart') {
    userData[chatId] = {}; 
    bot.sendMessage(chatId, 'Начнем расчет заново!', { reply_markup: { inline_keyboard: [[{ text: "🔄Начать заново", callback_data: 'restart' }]] } });
  }
});

function getContactLink(contactMethod, chatId) {
  if (contactMethod === 'phone') return 'tel:+79199162049';
  if (contactMethod === 'whatsapp') return 'https://wa.me/79199162049';
  if (contactMethod === 'telegram') return `https://t.me/${chatId}`;
}

function saveCalculationToDb(chatId, data) {
  const { propertyType, repairType, rooms, bathrooms, area, contactMethod } = data;
  db.run(
    `INSERT INTO calculations (propertyType, repairType, rooms, bathrooms, area, contactMethod, chatId) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [propertyType, repairType, rooms, bathrooms, area, contactMethod, chatId],
    (err) => {
      if (err) logger.error(`Ошибка при сохранении в базу данных: ${err.message}`);
      else logger.info(`Расчет успешно сохранен для chatId: ${chatId}`);
    }
  );
}

