// tests/recurring_screen.test.js — экран «Регулярные платежи» (TASK_061).
// Расчёты покрыты tests/recurring_service.test.js; здесь — статические
// проверки разметки/стилей/обработчиков index.html и sw.js (тот же приём,
// что tests/place_breakdown_screen.test.js):
//  1. Сервис подключён (после forecast_service) и в precache, cache version.
//  2. Навигация: «←» вместо «×», заголовок, «+» справа, 44×44, safe-area.
//  3. Назад: история (pushState/popstate), fallback без истории, форма
//     платежа не теряет ввод при back, Escape — через closeRecurring, жест
//     от левого края только по горизонтали.
//  4. Карточка итога, список, группы, пустое состояние, сортировка.
//  5. Форма: обе кнопки добавления → одна форма, пауза/возобновление,
//     isActive не сбрасывается правкой, подтверждение удаления.
//  6. Авто-проводка — через Recurring.autoPostDates, локальные даты.
//  7. CSS: токены темы, перенос названий, сумма не обрезается,
//     prefers-reduced-motion.
// Запуск: node tests/recurring_screen.test.js

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function fnSrc(name) {
  const m = html.match(new RegExp('function ' + name + '\\([^)]*\\)\\{[\\s\\S]*?\\n\\}'));
  return m ? m[0] : '';
}
const markup = (() => {
  const a = html.indexOf('<div class="overlay catx-ov" id="recurOverlay">');
  return a < 0 ? '' : html.slice(a, html.indexOf('<!-- Цели (Goals, Screen 7) -->', a));
})();
const css = (() => {
  const a = html.indexOf('/* ===== TASK_061: «Регулярные платежи»');
  const b = html.indexOf('#recurOverlay.rp-leaving .rp-page{transition:none}', a);
  return a < 0 || b < 0 ? '' : html.slice(a, b + 60);
})();

// ============ §1 — подключение ============
{
  const iF = html.search(/<script src="js\/services\/forecast_service\.js\?v=\d+"><\/script>/),
        iR = html.search(/<script src="js\/services\/recurring_service\.js\?v=\d+"><\/script>/);
  assertTrue(iR > iF && iF > 0, 'recurring_service.js подключён после forecast_service.js');
  assertTrue(/'\.\/js\/services\/recurring_service\.js'/.test(sw), 'sw.js: сервис в precache (офлайн)');
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m && parseInt(m[1], 10) >= 193, 'sw.js: cache version ≥ finance-v193');
}

// ============ §2 — верхняя навигация ============
{
  assertTrue(!!markup, 'Экран #recurOverlay в каркасе .catx-ov/.catx-page');
  assertTrue(/class="catx-page rp-page" id="recurPage"/.test(markup), 'Страница .catx-page (фон, собственный скролл, safe-area — TASK_041)');
  assertTrue(!/recurClose/.test(html), 'Кнопка «×» (#recurClose) удалена');
  assertTrue(!/>×</.test(markup), 'На экране нет «×»');
  assertTrue(!/🔁 Регулярные платежи/.test(markup), 'Заголовок без emoji');
  const iBack = markup.indexOf('id="recurBack"'), iTitle = markup.indexOf('class="rp-title"'), iPlus = markup.indexOf('id="recurAddTop"');
  assertTrue(iBack > 0 && iBack < iTitle && iTitle < iPlus, 'Порядок: «←» — заголовок — «+»');
  assertTrue(/id="recurBack" aria-label="Назад"/.test(markup), '«←» с aria-label «Назад»');
  assertTrue(/<h1 class="rp-title">Регулярные платежи<\/h1>/.test(markup), 'Заголовок «Регулярные платежи»');
  assertTrue(/id="recurAddTop" aria-label="Добавить платёж"/.test(markup), '«+» с aria-label');
  assertTrue(/\.rp-back,\.rp-plus\{width:44px;height:44px;flex:0 0 44px/.test(html), 'Зоны нажатия «←» и «+» — 44×44');
  assertTrue(/\.rp-back\{border:none;background:none;/.test(html), '«←» лёгкая: без рамки и подложки');
  assertTrue(/\.catx-page\{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/.test(html), 'safe-area сверху и снизу — от .catx-page');
}

// ============ §3 — назад: история, fallback, жест ============
{
  const open = fnSrc('openRecurring'), close = fnSrc('closeRecurring'), hide = fnSrc('hideRecurring');
  assertTrue(/history\.pushState\(\{recur:true\},''\)/.test(open) && /recurHistoryPushed=true/.test(open), 'Открытие кладёт запись в историю (как шторка операции)');
  assertTrue(/if\(!recurHistoryPushed\)/.test(open), 'Повторное открытие не плодит записи');
  assertTrue(/if\(recurHistoryPushed\)\{recurHistoryPushed=false;history\.back\(\);\}/.test(close), '«←» → history.back()');
  assertTrue(/else hideRecurring\(\);/.test(close), 'Fallback без истории — просто закрытие');
  assertTrue(/classList\.remove\('show','rp-leaving'\)/.test(hide), 'hideRecurring() снимает экран');
  assertTrue(/prefers-reduced-motion: reduce/.test(hide), 'Без анимации при prefers-reduced-motion');
  const pop = html.match(/window\.addEventListener\('popstate',\(\)=>\{\n  if\(!\$\('#recurOverlay'\)[\s\S]*?\n\}\);/);
  assertTrue(!!pop, 'popstate (системный back/свайп) закрывает экран');
  assertTrue(!!pop && /#reminderEditOverlay'\)\.classList\.contains\('show'\)\)\{history\.pushState/.test(pop[0]),
    'Открыта форма платежа — back не закрывает экран и не теряет ввод');
  assertTrue(/\$\('#recurBack'\)\.onclick=\(\)=>closeRecurring\(\);/.test(html), '«←» → closeRecurring()');
  assertTrue(/\$\('#recurOverlay'\)\.onclick=e=>\{if\(e\.target\.id==='recurOverlay'\)closeRecurring\(\);\};/.test(html), 'Тап по фону — тоже через историю');
  assertTrue(/\$\('#drRecur'\)\.onclick=drGo\(openRecurring\);/.test(html), 'Вход из drawer не изменён');
  const esc = html.match(/document\.addEventListener\('keydown',e=>\{if\(e\.key==='Escape'\)\{[\s\S]*?\}\}\);/);
  assertTrue(!!esc && /if\(!\$\('#reminderEditOverlay'\)\.classList\.contains\('show'\)\)closeRecurring\(\);/.test(esc[0]), 'Escape: при открытой форме закрывает только её, иначе — closeRecurring()');
  assertTrue(!!esc && !/'#recurOverlay'/.test(esc[0]), 'Escape больше не снимает .show напрямую (нет «висящей» записи истории)');
  const sw2 = fnSrc('initRecurEdgeSwipe');
  assertTrue(/t\.clientX-pg\.getBoundingClientRect\(\)\.left>24/.test(sw2), 'Жест начинается только у левого края (24px)');
  assertTrue(/lock=\(x>0&&Math\.abs\(x\)>Math\.abs\(y\)\)\?'x':'y'/.test(sw2), 'Жест: только горизонтально вправо, вертикальный скролл не перехватывается');
  assertTrue(/closeRecurring\(true\)/.test(sw2) && /touchcancel/.test(sw2), 'Жест закрывает через closeRecurring; отмена касания возвращает экран');
  assertTrue(/initRecurEdgeSwipe\(\);/.test(html), 'Жест подключён');
  assertTrue(/\.rp-page\{[^}]*touch-action:pan-y/.test(html), 'touch-action:pan-y — без конфликтов с горизонтальными жестами браузера');
}

// ============ §4 — карточка, список, пустое состояние ============
{
  assertTrue(/<section class="fincard rp-sum"/.test(markup), 'Карточка итога — существующий .fincard');
  assertTrue(/Ежемесячные расходы/.test(markup) && /id="recurMonthly"/.test(markup) && /id="recurSumSub"/.test(markup), 'Подпись, сумма, строка «N активных платежей · X / год»');
  const iSum = markup.indexOf('rp-sum'), iHead = markup.indexOf('id="recurHead"'), iList = markup.indexOf('id="recurList"'),
        iEmpty = markup.indexOf('id="recurEmpty"'), iAdd = markup.indexOf('id="addRecurBtn"');
  assertTrue(iSum < iHead && iHead < iList && iList < iEmpty && iEmpty < iAdd, 'Порядок: итог → «Предстоящие списания» → список → пустое → «Добавить»');
  assertTrue(/<h2>Предстоящие списания<\/h2>/.test(markup) && /id="recurSort"/.test(markup), 'Заголовок списка и сортировка справа');
  assertTrue(/Добавьте регулярные расходы, чтобы видеть свои ежемесячные обязательства/.test(markup), 'Текст пустого состояния');

  const r = fnSrc('renderRecurring');
  assertTrue(/R\.summary\(list,recurBaseCents\)/.test(r), 'Итог — Recurring.summary в базовой валюте');
  assertTrue(/esc\(R\.countLabel\(sum\.count\)\)\+' · <span class="nw">'\+esc\(recurMoney\(sum\.yearly\)\)\+' \/ год<\/span>'/.test(r), '«N активных платежей · X / год» (годовая сумма без висячего переноса)');
  assertTrue(/R\.sort\(R\.items\(list,t,recurBaseCents\),recurSort\)/.test(r), 'Список — ближайшая дата, сортировка сервиса');
  assertTrue(/group\('Регулярные поступления',inc\)\+group\('Приостановлены',paused\)/.test(r), 'Доходы и приостановленные — отдельными группами');
  assertTrue(/\$\('#recurEmpty'\)\.hidden=items\.length>0/.test(r), 'Пустое состояние — только без платежей');
  assertTrue(/\$\('#recurHead'\)\.hidden=!exp\.length/.test(r), 'Без активных списаний заголовок списка скрыт');
  assertTrue(/openReminderEdit\(x\.dataset\.rem,\{recur:true\}\)/.test(r), 'Тап по строке → существующая форма');

  const row = fnSrc('recurRow');
  assertTrue(/class="rp-ic" style="background:\$\{reminderColor\(r\)\}22"/.test(row) && /\$\{reminderIcon\(r\)\}/.test(row), 'Иконка категории LexMoney в скруглённом квадрате');
  assertTrue(/esc\(r\.title\|\|''\)/.test(row) && /data-rem="\$\{esc\(r\.id\)\}"/.test(row), 'Название и id экранируются');
  assertTrue(/R\.dateLabel\(x\.date,today\)\)\+' · '\+R\.LABEL\[r\.repeatType\]/.test(row), 'Вторая строка: «16 окт. · Ежемесячно»');
  assertTrue(/'Приостановлен'/.test(row), 'Приостановленный — подпись вместо даты');
  assertTrue(/\$\{inc\?'\+':'−'\}\$\{recurMoney\(r\.amount,curOfAcc\(recurAccId\(r\)\)\)\}/.test(row), 'Сумма «−7,99 €» в валюте счёта списания');
  assertTrue(/<button type="button" class="rp-row/.test(row), 'Строка — кнопка (клавиатура, фокус)');

  assertTrue(/state\.hideAmounts\?maskAmt\(cur\)/.test(fnSrc('recurMoney')), 'Скрытие сумм (глаз) соблюдается');
  assertTrue(/\{cents:true\}/.test(fnSrc('recurMoney')), 'Суммы с копейками — 2 знака');
  assertTrue(/AF\.Services\.Currency\.toBase\(state,r\.amount,cur\)/.test(fnSrc('recurBaseCents')), 'Валютные счета — в базовую валюту по курсам приложения');
  assertTrue(/state\.accounts\[0\]/.test(fnSrc('recurAccId')), 'Счёт по умолчанию — как у авто-проводки');
  assertTrue(/recurSort=recurSort==='date'\?'amount':'date'/.test(html), 'Сортировка «По дате» ⇄ «По сумме»');
  assertTrue(/classList\.add\('upd'\)/.test(fnSrc('setRecurMonthly')), 'Плавное обновление итоговой суммы');
}

// ============ §5 — форма платежа ============
{
  assertTrue(/const openRecurAdd=\(\)=>openReminderEdit\(null,\{recur:true\}\);\n\$\('#recurAddTop'\)\.onclick=openRecurAdd;\n\$\('#addRecurBtn'\)\.onclick=openRecurAdd;/.test(html),
    '«+» в заголовке и нижняя кнопка — один обработчик и одна форма');
  const oe = fnSrc('openReminderEdit');
  assertTrue(/fromRecur\?'Регулярный платёж':'Напоминание'/.test(oe) && /fromRecur\?'Новый платёж':'Новое напоминание'/.test(oe), 'Заголовки формы при открытии с экрана; Календарь — прежние');
  assertTrue(/\$\('#remPause'\)\.style\.display=rec\?'block':'none'/.test(oe), '«Приостановить» — только для повторяющихся');
  assertTrue(/isPaused\(r\)\?'Возобновить платёж':'Приостановить платёж'/.test(oe), 'Подпись кнопки зависит от состояния');
  assertTrue(/id="remPause"/.test(html) && /\$\('#remPause'\)\.onclick=toggleReminderPause;/.test(html), 'Кнопка паузы подключена');
  const tp = fnSrc('toggleReminderPause');
  assertTrue(/R\.resumePatch\(r,new Date\(\)\):R\.pausePatch\(\)/.test(tp), 'Пауза/возобновление — через сервис (без задним числом проводок)');
  assertTrue(/if\(!save\(\)\.ok\)return;/.test(tp), 'Запись с откатом TASK_026');
  const sv = fnSrc('saveReminder');
  assertTrue(!/autoPost,isActive:true\}/.test(sv), 'Правка не сбрасывает isActive (приостановленный не возобновляется молча)');
  assertTrue(/createdAt:Date\.now\(\),isActive:true\}/.test(sv), 'Новый платёж — активен');
  assertTrue(/else r\.isActive=true;/.test(sv), 'Разовое (без повтора) — снова активно, не пропадает');
  assertTrue(/if\(!confirm\('Удалить напоминание\? Уже созданные операции останутся\.'\)\)return;/.test(fnSrc('deleteReminder')), 'Удаление — с подтверждением');
  assertTrue(/AF\.Services\.Forecast\.toIso\(new Date\(\)\)/.test(oe), 'Дата по умолчанию — локальный сегодняшний день');
}

// ============ §6 — авто-проводка ============
{
  const ap = fnSrc('processAutoPost');
  assertTrue(/AF\.Services\.Recurring\.autoPostDates\(r,now\)/.test(ap), 'Даты авто-проводки — Recurring.autoPostDates');
  assertTrue(/date:iso/.test(ap) && !/toISOString/.test(ap), 'Дата операции — локальный день (не toISOString)');
  assertTrue(/autoFrom:r\.id/.test(ap) && /r\.lastPosted=occ\[occ\.length-1\]/.test(ap), 'Защита от дублей сохранена (autoFrom, lastPosted)');
  assertTrue(/if\(!save\(\)\.ok\)return 0;/.test(ap), 'Откат при ошибке записи сохранён');
  assertTrue(/const norm=AF\.Services\.Recurring\.normalizePatch\(r\);\n    if\(norm\)\{Object\.assign\(r,norm\);normalized\+\+;\}/.test(ap),
    'Старый lastPosted однократно переводится в новый формат');
  assertTrue(/r\.lastPostedV=AF\.Services\.Recurring\.LAST_POSTED_V;/.test(ap), 'Новая проводка помечает lastPosted новым форматом');
  assertTrue(/if\(created\|\|normalized\)\{\n    if\(!save\(\)\.ok\)return 0;\n    if\(!created\)return 0;/.test(ap), 'Нормализация сохраняется без тоста об операциях');
  assertTrue(/autoPost:true,lastPosted:date,lastPostedV:AF\.Services\.Recurring\.LAST_POSTED_V,/.test(html), 'Повтор из формы операции — lastPosted нового формата');
}

// ============ §7 — CSS ============
{
  assertTrue(!!css, 'Блок стилей TASK_061');
  assertTrue(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'Нет HEX-литералов цвета — только токены темы');
  assertTrue(!/rgba?\(/.test(css), 'Нет rgba-литералов — только токены темы');
  assertTrue(/\.rp-sum-v\{[^}]*color:var\(--text\)/.test(css), 'Итог — нейтральный цвет, не красный');
  assertTrue(/\.rp-amt\{[^}]*color:var\(--expense\)/.test(css), 'Суммы списаний — var(--expense)');
  assertTrue(/\.rp-amt\{[^}]*white-space:nowrap/.test(css) && !/\.rp-amt\{[^}]*overflow:hidden/.test(css), 'Сумма не переносится и не обрезается');
  assertTrue(/\.rp-txt\{flex:1;min-width:0\}/.test(css) && /\.rp-nm\{[^}]*overflow-wrap:anywhere/.test(css), 'Длинные названия переносятся, не наезжая на сумму');
  assertTrue(/\.rp-row\{[^}]*min-height:64px/.test(css), 'Высота строки ≥ 64px — удобное нажатие');
  assertTrue(/\.rp-row\+\.rp-row::before\{[^}]*background:var\(--line\)/.test(css), 'Тонкие разделители между строками');
  assertTrue(/\.rp-add\{[^}]*dashed/.test(css) && /\.rp-add\{[^}]*background:transparent/.test(css), '«Добавить платёж» — пунктир без заливки');
  assertTrue(/\[data-theme="dark"\] \.rp-add\{color:var\(--accent2\)/.test(css), 'Тёмная тема: более светлый акцент для контраста');
  assertTrue(/@media \(prefers-reduced-motion:reduce\)\{\n    \.rp-page\{animation:none\}/.test(html), 'prefers-reduced-motion отключает анимации экрана');
}

console.log(`\nrecurring_screen.test.js: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
