// services/category_taxonomy_service.js — дефолтная таксономия категорий (TASK_016).
// Flutter → services/category_taxonomy_service.dart
//
// Вынесено из ранее инлайновой константы CATS в index.html — значения не
// изменены, только перемещены. Единый источник правды: seedCategories()
// (index.html) сидирует state.cats/state.subcats по этим же данным, а тесты
// demo-данных проверяются по нему же, без дублирования таксономии.
window.AF = window.AF || {}; AF.Services = AF.Services || {};
AF.Services.CategoryTaxonomy = {
  CATS: {
    expense: [
      {id:'food',name:'Продукты',emoji:'🛒',color:'#40c057',subs:['Супермаркет','Рынок','Доставка']},
      {id:'cafe',name:'Кафе и рестораны',emoji:'☕',color:'#f783ac',subs:['Кафе','Рестораны','Фастфуд','Кофе']},
      {id:'transport',name:'Транспорт',emoji:'🚗',color:'#ffa94d',subs:['Топливо','Такси','Общественный','Парковка']},
      {id:'home',name:'Жильё',emoji:'🏠',color:'#ffd43b',subs:['Аренда','Ипотека','Ремонт','Мебель']},
      {id:'bills',name:'Счета и связь',emoji:'💡',color:'#4dabf7',subs:['Электричество','Вода/Газ','Интернет','Моб. связь']},
      {id:'shopping',name:'Покупки',emoji:'🛍️',color:'#da77f2',subs:['Одежда','Обувь','Электроника','Для дома']},
      {id:'health',name:'Здоровье',emoji:'💊',color:'#ff8787',subs:['Аптека','Врачи','Стоматология','Фитнес']},
      {id:'fun',name:'Развлечения',emoji:'🎮',color:'#9775fa',subs:['Кино','Игры','Хобби','Концерты']},
      {id:'subs',name:'Подписки',emoji:'📺',color:'#5c7cfa',subs:['Стриминг','Музыка','Приложения','Облако']},
      {id:'travel',name:'Путешествия',emoji:'✈️',color:'#3bc9db',subs:['Билеты','Отели','Экскурсии','Виза']},
      {id:'edu',name:'Образование',emoji:'🎓',color:'#69db7c',subs:['Курсы','Книги','Репетитор']},
      {id:'pets',name:'Питомцы',emoji:'🐾',color:'#a9e34b',subs:['Корм','Ветеринар','Аксессуары']},
      {id:'kids',name:'Дети',emoji:'👶',color:'#ffa8a8',subs:['Сад/Школа','Игрушки','Кружки','Одежда']},
      {id:'care',name:'Красота и уход',emoji:'💆',color:'#faa2c1',subs:['Парикмахер','Косметика','Спа']},
      {id:'sport',name:'Спорт',emoji:'🏋️',color:'#ff922b',subs:['Зал','Инвентарь','Секции']},
      {id:'taxes',name:'Налоги и сборы',emoji:'🏛️',color:'#748ffc',subs:['Налоги','Штрафы','Комиссии']},
      {id:'gifts_e',name:'Подарки',emoji:'🎁',color:'#f06595',subs:['Подарки','Праздники','Цветы']},
      {id:'other_e',name:'Другое',emoji:'📦',color:'#868e96',subs:[]},
    ],
    income: [
      {id:'salary',name:'Зарплата',emoji:'💼',color:'#3ecf8e',subs:['Оклад','Премия','Аванс']},
      {id:'freelance',name:'Фриланс',emoji:'🧑‍💻',color:'#38d9a9',subs:['Проекты','Консультации']},
      {id:'business',name:'Бизнес',emoji:'💰',color:'#20c997',subs:['Выручка','Прибыль']},
      {id:'invest',name:'Инвестиции',emoji:'📈',color:'#0ca678',subs:['Дивиденды','Проценты','Продажа активов']},
      {id:'rent',name:'Аренда',emoji:'🔑',color:'#63e6be',subs:['Аренда жилья']},
      {id:'gift',name:'Подарки',emoji:'🎁',color:'#82c91e',subs:['Подарок','Кэшбэк']},
      {id:'benefits',name:'Пособия',emoji:'🏦',color:'#3bc9db',subs:['Пенсия','Стипендия','Соцвыплаты']},
      {id:'other_i',name:'Прочее',emoji:'💵',color:'#94d82d',subs:[]},
    ]
  },

  // true, если catId входит в таксономию (любого типа).
  categoryExists(catId) {
    return this.CATS.expense.some(c => c.id === catId) || this.CATS.income.some(c => c.id === catId);
  },

  // subIndex — числовой индекс подкатегории, как использует sub(cat,i) в demo_data_service.js/loadDemo().
  subcategoryExists(catId, subIndex) {
    const all = this.CATS.expense.concat(this.CATS.income);
    const cat = all.find(c => c.id === catId);
    if (!cat || !Array.isArray(cat.subs)) return false;
    return typeof subIndex === 'number' && subIndex >= 0 && subIndex < cat.subs.length;
  },
};
