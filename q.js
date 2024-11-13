const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const winston = require('winston');

// Токен вашего бота, полученный через BotFather
const token = '8075874421:AAHwWSia-Hs3bHeTFrTVPJnOVVofYBYPD1o';
const bot = new TelegramBot(token, { polling: true });
const MASTER_CHAT_ID = '1426960007';
//let userData = {};
let userStates = {};
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

// Инициализация базы данных SQLite для хранения записей на экскурсию
const dbBook = new sqlite3.Database('./DB/tour_bookings.db', (err) => {
	if (err) {
		logger.error('Ошибка при подключении к базе данных:', err.message);
	} else {
		logger.info('Подключение к базе данных успешно');
	}
});

// Создание таблицы для хранения записей на экскурсию, если она еще не существует
dbBook.run(`
	CREATE TABLE IF NOT EXISTS bookings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT,
		phone TEXT,
		date TEXT,
		time TEXT
	)
`);

// Структура данных для отслеживания состояния
let userData = {};

// Обработка команды /start
bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id;
	userData[chatId] = {}; // Инициализация данных для пользователя

	const options = {
		reply_markup: {
			inline_keyboard: [
				[{ text: "🏠Расчет стоимости ремонта", callback_data: 'calculate_cost' }],
				[{ text: '📸 Портфолио наших объектов', url: 'https://proremont18.ru/nashi-rabotyi/' }],
				[{ text: "📝Отзывы", url: 'https://vk.com/app6326142_-214261496' }],
				[{ text: "📝Записаться на экскурсию", callback_data: 'book_tour' }],
				[{ text: "❓Топ часто задаваемых вопросов", callback_data: 'faq' }],
				[{ text: "🎁 ПОДАРОК", callback_data: 'gift' }],
				[{ text: 'Контактная информация 📞', callback_data: 'contact_info' }],
				[{ text: '👨‍💼 Связаться с менеджером', callback_data: 'contact_manager' }]
			]
		}
	};

	bot.sendMessage(chatId, '🛠Добро пожаловать в ПроРемонт! Наш бот может записать вас на экскурсию по нашим действующим объектам, а также вы можете посмотреть портфолио наших объектов и отзывы заказчиков!🛠', options);
});

const faqMessage = `📋 Ответы на часто задаваемые вопросы:

💰 *Сколько стоит ремонт за квадратный метр?*
Стоимость ремонта под ключ за квадрат начинается от 10,000₽/кв.м в зависимости от дизайн-проекта. Для более подробного расчета отправьте нам дизайн-проект, в течение 3х рабочих дней мы отправим Вам предварительную смету.

⏱ *Какие сроки выполнения работ?*
Очередь на начало ремонтных работ у нас в среднем 1-1.5 месяца, срок работ из расчёта 10кв.м/месяц. Помните, сроки зависят не только от бригады, но и от подрядчиков мебели, сантехники, электрики, а также быстроты принимаемых заказчиком решений.

📸 *Как можно следить за ходом ремонта?*
На каждый объект создается индивидуальный чат, со всей командой и участниками процесса. Контролировать ход работ можно как вживую, так и удаленно. Мы регулярно отправляем фотоотчеты, а по просьбе заказчика можем подключить к системе видеонаблюдения.

💼 *Как контролировать расходы по ремонту?*
На ваш телефон будет установлено специальное приложение, в котором вы в онлайн режиме сможете видеть все расходы по ремонту. Чеки на материалы, объемы выполненных работ и пр. расходы.`;

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;

    if (query.data === 'faq') {
        bot.sendMessage(chatId, faqMessage, { parse_mode: 'Markdown' });
    } 
});



// Обработка callback-запросов
bot.on('callback_query', (query) => {
	const chatId = query.message.chat.id;
	const data = query.data;

	if (data === 'book_tour') {
		userData[chatId] = {}; // Убедимся, что данные инициализированы
		bot.sendMessage(chatId, 'Введите ваше имя:');
	} else if (data === 'contact_info') {
		const contactInfo = `
Контактная информация:
📍 Адрес: г. Ижевск, ул. Металлургов, 2
📞 Телефон: +7 (919) 916-20-49
✉️ E-mail: proremont.18@yandex.ru
🕒 Режим работы: Пн. – Пт. с 8:00 до 17:00
		`;
		bot.sendMessage(chatId, contactInfo);
	} else if (data === 'contact_manager') {
		const contactInfo = `
👨‍💼 *Связаться с нашим менеджером:*
📞 Телефон: +7 (919) 916-20-49
📧 E-mail: proremont.18@yandex.ru
		`;
		bot.sendMessage(chatId, contactInfo);
	} else if (data === 'gift') {
		sendGiftFiles(chatId);
	}
	bot.answerCallbackQuery(query.id, { text: 'Вы выбрали действие!' });
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

// Обработка ввода для записи на экскурсию
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!userData[chatId]) {
        return; // Проверяем, что userData для данного chatId существует
    }

    if (!userData[chatId].name) {
        // Сохраняем имя
        userData[chatId].name = text;
        bot.sendMessage(chatId, 'Введите ваш номер телефона:');
    } else if (!userData[chatId].phone) {
        // Сохраняем телефон
        userData[chatId].phone = text;
        bot.sendMessage(chatId, 'Введите дату и время бронирования (например, 2024-11-14 15:30):');
    } else if (!userData[chatId].bookingDateTime) {
        // Сохраняем дату и время бронирования
        userData[chatId].bookingDateTime = text;

        // Подтверждение для пользователя
        bot.sendMessage(chatId, 'Ваш тур успешно забронирован!');

        // Отправка уведомления мастеру
        const masterMessage = `
📅 *Новое бронирование:*
Пользователь: ${userData[chatId].name}
Телефон: ${userData[chatId].phone}
ID: ${chatId}
Дата и время бронирования: ${userData[chatId].bookingDateTime}
        `;
        bot.sendMessage(MASTER_CHAT_ID, masterMessage);

        // Очищаем данные пользователя после бронирования
        delete userData[chatId];
    }
});

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;

    if (data === 'calculate_cost') {
        userStates[chatId] = 'choose_property_type';
        bot.sendMessage(chatId, 'Выберите тип недвижимости:', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Новостройка", callback_data: "new_building" }],
                    [{ text: "Вторичное жилье", callback_data: "secondary_housing" }],
                    [{ text: "Коммерческая недвижимость", callback_data: "commercial" }],
                    [{ text: "Частный дом", callback_data: "private_house" }]
                ]
            }
        });
    } else if (userStates[chatId] === 'choose_property_type') {
        userStates[chatId] = 'has_design_project';
        bot.sendMessage(chatId, 'У вас есть дизайн проект?', {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Да", callback_data: "has_design_yes" }],
                    [{ text: "Нет", callback_data: "has_design_no" }]
                ]
            }
        });
    } else if (userStates[chatId] === 'has_design_project') {
        if (query.data === 'has_design_yes') {
            userStates[chatId] = 'enter_area';
            bot.sendMessage(chatId, 'Введите площадь в квадратных метрах:');
        } else if (query.data === 'has_design_no') {
            bot.sendMessage(chatId, 'Точную стоимость работ возможно рассчитать только по дизайн проекту. Если у вас его нет, мы готовы его для вас сделать. Нажмите кнопку, чтобы связаться с менеджером.', {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "Связаться с менеджером", url: "https://t.me/+79199162049" }]
                    ]
                }
            });
            delete userStates[chatId]; // Завершаем процесс, так как дизайн проект не предоставлен
        }
    } else if (userStates[chatId] === 'enter_area') {
        userStates[chatId] = 'enter_rooms';
        userData[chatId] = { area: query.text }; // Сохраняем площадь
        bot.sendMessage(chatId, 'Введите количество комнат:');
    } else if (userStates[chatId] === 'enter_rooms') {
        userStates[chatId] = 'enter_bathrooms';
        userData[chatId].rooms = query.text; // Сохраняем количество комнат
        bot.sendMessage(chatId, 'Введите количество санузлов:');
    } else if (userStates[chatId] === 'enter_bathrooms') {
        userData[chatId].bathrooms = query.text; // Сохраняем количество санузлов
        const area = parseFloat(userData[chatId].area);

        // Расчет стоимости в зависимости от площади
        let costPerMeter = area < 50 ? 20000 : 15000;

        // Отправляем пользователю расчет
        bot.sendMessage(chatId, `Стоимость ремонтных работ от ${costPerMeter}₽ за квадратный метр`);

        bot.sendMessage(chatId, 'Для более подробного расчета именно вашего проекта Вы можете записаться на бесплатный замер, а также отправить ваш дизайн проект менеджеру.');

        // Уведомление мастера
        const messageToMaster = `
            Новый запрос на расчет стоимости ремонта:
            Тип недвижимости: ${query.message.text}
            Площадь: ${userData[chatId].area} м²
            Количество комнат: ${userData[chatId].rooms}
            Количество санузлов: ${userData[chatId].bathrooms}
            Стоимость ремонта: от ${costPerMeter}₽ за м²
            Контакт с клиентом: ${chatId} (при необходимости можно обратиться за дополнительной информацией).
        `;
        bot.sendMessage(masterChatId, messageToMaster); // Отправляем уведомление мастеру

        // Очистка данных
        delete userData[chatId];
        delete userStates[chatId];
    }
});