const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');

// Токен вашего бота, полученный через BotFather
const token = '8075874421:AAHwWSia-Hs3bHeTFrTVPJnOVVofYBYPD1o';
const bot = new TelegramBot(token, { polling: true });

// Создание базы данных SQLite (или подключение к существующей)
const db = new sqlite3.Database('./calculations.db');

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
        [{ text: "📝Отзывы", url: 'https://vk.com/app6326142_-214261496' }],
        [{ text: "❓Топ часто задаваемых вопросов", callback_data: 'faq' }],
		[{ text: "🎁 ПОДАРОК", callback_data: 'gift' }],
		[{ text: 'Контактная информация 📞', callback_data: 'contact_info' }]
      ]
    }
  };

  bot.sendMessage(chatId, '🛠Добро пожаловать в ПроРемонт! Наш бот может рассчитать стоимость ремонта, записать вас на экскурсию по нашим действующим объектам, а также вы можете посмотреть портфолио наших объектов и отзывы заказчиков!🛠', options);
});

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
  }

  // Отмечаем запрос как обработанный
  bot.answerCallbackQuery(query.id);
});

bot.on('callback_query', async (callbackQuery) => { // Сделайте эту функцию асинхронной
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  if (data === 'gift') {
    // Отправка сообщения о загрузке файлов
    const loadingMsg = await bot.sendMessage(chatId, 'Загрузка файлов...');
    const pdfFiles = [
      'pdf/Aq.pdf',  // Убедитесь, что путь корректен
      'pdf/compressed.pdf'   // Убедитесь, что путь корректен
    ];

    // Функция для отправки файлов поочередно
    for (const file of pdfFiles) {
      try {
        await bot.sendDocument(chatId, file);
        console.log(`Файл ${file} отправлен успешно.`);
      } catch (error) {
        console.error(`Ошибка при отправке файла ${file}:`, error);
        await bot.sendMessage(chatId, 'Ошибка при отправке файла.');
      }
    }

    // Удаление сообщения о загрузке и отправка уведомления
    await bot.deleteMessage(chatId, loadingMsg.message_id);
    bot.answerCallbackQuery(callbackQuery.id, { text: 'Все файлы отправлены!' });
    bot.sendMessage(chatId, 'Файлы успешно отправлены!');
    console.log('Все файлы отправлены.');
  }
});




// Обработка нажатия на инлайн-кнопку "Расчет стоимости ремонта"
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (action === 'calculate_cost') {
    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Новостройка', callback_data: 'new_building' }, { text: 'Вторичка', callback_data: 'secondary' }],
          [{ text: 'Частный дом', callback_data: 'house' }, { text: 'Коммерческое', callback_data: 'commercial' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Выберите тип недвижимости:', options);
  }

  // Обработка выбора типа недвижимости
  if (['new_building', 'secondary', 'house', 'commercial'].includes(action)) {
    userData[chatId].propertyType = action; // Сохранение выбранного типа недвижимости

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Косметический', callback_data: 'cosmetic' }, { text: 'Капитальный', callback_data: 'major' }],
          [{ text: 'Дизайнерский', callback_data: 'designer' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Выберите вид ремонта:', options);
  }

  // Обработка выбора вида ремонта
  if (['cosmetic', 'major', 'designer'].includes(action)) {
    userData[chatId].repairType = action; // Сохранение выбранного типа ремонта

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '1', callback_data: 'rooms_1' }, { text: '2', callback_data: 'rooms_2' }, { text: '3', callback_data: 'rooms_3' }],
          [{ text: '4 или более', callback_data: 'rooms_4plus' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Количество комнат:', options);
  }

  // Обработка выбора количества комнат
  if (['rooms_1', 'rooms_2', 'rooms_3', 'rooms_4plus'].includes(action)) {
    userData[chatId].rooms = action.replace('rooms_', ''); // Сохранение количества комнат

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: '1', callback_data: 'bathrooms_1' }, { text: '2', callback_data: 'bathrooms_2' }, { text: '3', callback_data: 'bathrooms_3' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Количество санузлов:', options);
  }

  // Обработка выбора количества санузлов
  if (['bathrooms_1', 'bathrooms_2', 'bathrooms_3'].includes(action)) {
    userData[chatId].bathrooms = action.replace('bathrooms_', ''); // Сохранение количества санузлов
    bot.sendMessage(chatId, 'Укажите площадь квартиры (в м²):');
  }
});

// Обработка сообщения для ввода площади квартиры
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (userData[chatId] && userData[chatId].bathrooms && !isNaN(parseFloat(text))) {
    // Площадь квартиры
    userData[chatId].area = text;

    const options = {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Телефон мастеру', callback_data: 'contact_phone' }],
          [{ text: 'WhatsApp', callback_data: 'contact_whatsapp' }],
          [{ text: 'Telegram', callback_data: 'contact_telegram' }]
        ]
      }
    };

    bot.sendMessage(chatId, 'Куда отправить расчет стоимости?', options);
  }
});

// Обработка выбора канала для отправки данных
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const action = query.data;

  if (['contact_phone', 'contact_whatsapp', 'contact_telegram'].includes(action)) {
    const contactMethod = action.replace('contact_', '');
    userData[chatId].contactMethod = contactMethod;

    const summary = `
      Ремонт: ${userData[chatId].repairType}
      Тип недвижимости: ${userData[chatId].propertyType}
      Количество комнат: ${userData[chatId].rooms}
      Количество санузлов: ${userData[chatId].bathrooms}
      Площадь квартиры: ${userData[chatId].area} м²
      Канал связи: ${contactMethod}
    `;

    // Сохранение данных в базу данных SQLite
	async function saveCalculationToDb(chatId, data){
		try{
		await db.run(`
      INSERT INTO calculations (propertyType, repairType, rooms, bathrooms, area, contactMethod, chatId)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userData[chatId].propertyType, userData[chatId].repairType, userData[chatId].rooms, userData[chatId].bathrooms, userData[chatId].area, contactMethod, chatId],
      function(err) {
        if (err) {
			logger.error(`Ошибка при сохранении данных в БД: ${err.message}`);
			bot.sendMessage(chatId, 'Произошла ошибка при сохранении данных.');
        } else {
			logger.info(`Данные сохранены для пользователя ${chatId}`)
			bot.sendMessage(chatId, '✅Ваш расчет успешно сохранен.');
        }
      }
    );
	} catch (error) {
  logger.error(`Неожиданная ошибка: ${error.message}`);
  }
	}
	
    

    // Генерация ссылки для выбранного канала связи
    let sendLink = '';
    if (contactMethod === 'phone') {
      sendLink = `Телефон: +7 (919) 916-20-49`;
    } else if (contactMethod === 'whatsapp') {
      sendLink = `https://wa.me/+79199162049?text=${encodeURIComponent(summary)}`;
    } else if (contactMethod === 'telegram') {
      sendLink = `https://t.me/username?text=${encodeURIComponent(summary)}`;
    }

    bot.sendMessage(chatId, `✅Ваш расчет отправлен на: ${contactMethod}`);
    bot.sendMessage(chatId, `✅Вот ссылка для связи с мастером: ${sendLink}`);

    // Кнопка для возврата на стартовую страницу
    const restartOptions = {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🔄Начать заново", callback_data: 'restart' }]
        ]
      }
    };
    bot.sendMessage(chatId, '🔄Вы можете начать новый расчет или /start', restartOptions);
  }

  // Обработка нажатия на кнопку "Начать заново"
  if (action === 'restart') {
    userData[chatId] = {}; // Сброс данных пользователя
    bot.sendMessage(chatId, '🛠Добро пожаловать в ПроРемонт! Наш бот может рассчитать стоимость ремонта, записать вас на экскурсию по нашим действующим объектам, а также вы можете посмотреть портфолио наших объектов и отзывы заказчиков!🛠️', {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🏠Расчет стоимости ремонта", callback_data: 'calculate_cost' }],
          [{ text: "📝Отзывы", url: 'https://vk.com/app6326142_-214261496' }],
          [{ text: "❓Топ часто задаваемых вопросов", callback_data: 'faq' }],
		  [{ text: "🎁 ПОДАРОК", callback_data: 'gift' }],
		  [{ text: 'Контактная информация 📞', callback_data: 'contact_info' }]
        ]
      }
    });
  }
});
