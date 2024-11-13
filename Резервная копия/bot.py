import logging
import sqlite3
from aiogram import Bot, Dispatcher, types
from aiogram.types import ParseMode
from aiogram.utils import executor
import os
from aiogram.contrib.middlewares.logging import LoggingMiddleware
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

# Токен вашего бота, полученный через BotFather
API_TOKEN = '8075874421:AAHwWSia-Hs3bHeTFrTVPJnOVVofYBYPD1o'

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация бота и диспетчера
bot = Bot(token=API_TOKEN)
dp = Dispatcher(bot)
dp.middleware.setup(LoggingMiddleware())

# Создание базы данных SQLite (или подключение к существующей)
db = sqlite3.connect('./DB/calculations.db')
cursor = db.cursor()

dbBook = sqlite3.connect('./DB/tour_bookings.db')
cursorBook = dbBook.cursor()

# Создание таблиц, если их еще нет
cursor.execute('''CREATE TABLE IF NOT EXISTS calculations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    propertyType TEXT,
    repairType TEXT,
    rooms INTEGER,
    bathrooms INTEGER,
    area REAL,
    contactMethod TEXT,
    chatId INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);''')

cursorBook.execute('''CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    date TEXT,
    time TEXT
);''')

# Структура данных для отслеживания состояния пользователя
userData = {}

# Команда /start
@dp.message_handler(commands=['start'])
async def start(message: types.Message):
    chat_id = message.chat.id
    userData[chat_id] = {}

    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton("🏠Расчет стоимости ремонта", callback_data='calculate_cost'),
        InlineKeyboardButton('📸 Портфолио наших объектов', url='https://proremont18.ru/nashi-rabotyi/'),
        InlineKeyboardButton("📝Отзывы", url='https://vk.com/app6326142_-214261496'),
        InlineKeyboardButton("📝Записаться на экскурсию", callback_data='book_tour'),
        InlineKeyboardButton("❓Топ часто задаваемых вопросов(разработка)", callback_data='faq'),
        InlineKeyboardButton("🎁 ПОДАРОК", callback_data='gift'),
        InlineKeyboardButton('Контактная информация 📞', callback_data='contact_info'),
        InlineKeyboardButton('👨‍💼 Связаться с менеджером', callback_data='contact_manager')
    )
    await message.answer(
        '🛠Добро пожаловать в ПроРемонт! Наш бот может рассчитать стоимость ремонта, записать вас на экскурсию по нашим действующим объектам, а также вы можете посмотреть портфолио наших объектов и отзывы заказчиков!🛠',
        reply_markup=keyboard
    )

# Обработка нажатий на инлайн-кнопки
@dp.callback_query_handler(lambda c: c.data)
async def process_callback(callback_query: types.CallbackQuery):
    chat_id = callback_query.message.chat.id
    data = callback_query.data

    if data == 'book_tour':
        await bot.send_message(chat_id, 'Введите ваше имя:')
        userData[chat_id] = {}  # Инициализация данных пользователя
    elif data == 'contact_info':
        contact_info = """
        Контактная информация:
        📍 Адрес: г. Ижевск, ул. Металлургов, 2
        📞 Телефон: +7 (919) 916-20- 49
        ✉️ E-mail: proremont.18@yandex.ru
        🕒 Режим работы: Пн. – Пт. с 8:00 до 17:00
        """
        await bot.send_message(chat_id, contact_info)
    elif data == 'contact_manager':
        contact_info = """
        👨‍💼 *Связаться с нашим менеджером:*
        📞 Телефон: +7 (919) 916-20-49
        📧 E-mail: proremont.18@yandex.ru
        """
        await bot.send_message(chat_id, contact_info)
    elif data == 'gift':
        await send_gift_files(chat_id)
    elif data == 'calculate_cost':
        await bot.send_message(chat_id, 'Выберите тип недвижимости:', reply_markup=types.ReplyKeyboardMarkup(
            inline_keyboard=[
                [InlineKeyboardButton('Новостройка', callback_data='new_building'), InlineKeyboardButton('Вторичка', callback_data='secondary')],
                [InlineKeyboardButton('Частный дом', callback_data='house'), InlineKeyboardButton('Коммерческое', callback_data='commercial')]
            ]
        ))

# Функция отправки подарков
async def send_gift_files(chat_id):
    loading_msg = await bot.send_message(chat_id, 'Загрузка файлов...')
    pdf_files = ['pdf/Aq.pdf', 'pdf/compressed.pdf']

    for file in pdf_files:
        try:
            await bot.send_document(chat_id, open(file, 'rb'))
            logger.info(f'Файл {file} отправлен успешно.')
        except Exception as e:
            logger.error(f'Ошибка при отправке файла {file}: {e}')
            await bot.send_message(chat_id, 'Ошибка при отправке файла.')

    await bot.delete_message(chat_id, loading_msg.message_id)
    await bot.send_message(chat_id, 'Файлы успешно отправлены!')

# Обработка сообщений
@dp.message_handler(content_types=['text'])
async def handle_message(message: types.Message):
    chat_id = message.chat.id
    text = message.text

    if chat_id in userData:
        if 'name' not in userData[chat_id]:
            userData[chat_id]['name'] = text
            await bot.send_message(chat_id, 'Введите ваш номер телефона:')
        elif 'phone' not in userData[chat_id]:
            userData[chat_id]['phone'] = text
            await bot.send_message(chat_id, 'Выберите дату (например, 2024-11-13):')
        elif 'date' not in userData[chat_id]:
            userData[chat_id]['date'] = text
            await bot.send_message(chat_id, 'Укажите время экскурсии (например, 15:00):')
        elif 'time' not in userData[chat_id]:
            userData[chat_id]['time'] = text
            await bot.send_message(chat_id, 'Спасибо за запись! Мы с вами свяжемся.')

            # Сохранение в базе данных
            name = userData[chat_id]['name']
            phone = userData[chat_id]['phone']
            date = userData[chat_id]['date']
            time = userData[chat_id]['time']

            cursorBook.execute('INSERT INTO bookings (name, phone, date, time) VALUES (?, ?, ?, ?)',
                               (name, phone, date, time))
            dbBook.commit()

            # Уведомление администратора
            admin_chat_id = '1426960007'  # Замените на ID администратора
            await bot.send_message(admin_chat_id, f'Новая запись на экскурсию: \nИмя: {name}\nТелефон: {phone}\nДата: {date}\nВремя: {time}')

            # Очистка данных
            del userData[chat_id]
        else:
            await bot.send_message(chat_id, 'Я вас не понимаю.')

if __name__ == '__main__':
    executor.start_polling(dp, skip_updates=True)

@dp.callback_query_handler(lambda c: c.data == 'calculate_cost')
async def handle_calculate_cost(callback_query: types.CallbackQuery):
    chat_id = callback_query.message.chat.id
    
    # Создание инлайн клавиатуры для выбора типа недвижимости
    keyboard = InlineKeyboardMarkup(row_width=2)
    keyboard.add(
        InlineKeyboardButton('Новостройка', callback_data='new_building'),
        InlineKeyboardButton('Вторичка', callback_data='secondary'),
        InlineKeyboardButton('Частный дом', callback_data='house'),
        InlineKeyboardButton('Коммерческое', callback_data='commercial')
    )
    
    await bot.send_message(
        chat_id,
        'Выберите тип недвижимости:',
        reply_markup=keyboard
    )