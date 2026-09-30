// tests/place_breakdown_screen.test.js — интерфейс TASK_060: форма «Место /
// магазин», экран детализации категории по местам и переход к операциям места.
// Расчёт покрыт tests/place_breakdown_service.test.js; здесь — статические
// проверки разметки/обработчиков index.html и sw.js (тот же приём, что
// tests/category_tx_screen.test.js):
//  1. Сервис подключён и в precache, cache version поднят.
//  2. Форма: блок места сразу после категории/подкатегории, #payeeRow внутри,
//     чипы только из расходов выбранной категории, очистка, перевод скрыт.
//  3. Аналитика: расходная категория → детализация; доходы и хвост «Другое» —
//     прежний список операций.
//  4. Экран детализации: «Назад», иконка/название, период стрелками
//     (shiftPeriod), кольцо, центр, сравнение, список, пустое состояние.
//  5. Операции места: режим «по месту» в #catTxOverlay, крошки, тот же период,
//     обычный режим сбрасывается в openCatTx().
//  6. CSS: длинные названия не наезжают на суммы, кольцо ужимается на узком
//     экране, safe-area — от .catx-page, токены темы вместо литералов.
// Запуск: node tests/place_breakdown_screen.test.js

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

// ============ §1 — подключение сервиса и service worker ============
{
  assertTrue(/<script src="js\/services\/place_breakdown_service\.js"><\/script>/.test(html),
    'index.html: подключён js/services/place_breakdown_service.js');
  const iSvc = html.indexOf('place_breakdown_service.js'), iStore = html.indexOf('js/database/store.js');
  assertTrue(iSvc > iStore, 'Сервис подключён после store.js (как остальные сервисы аналитики)');
  assertTrue(/'\.\/js\/services\/place_breakdown_service\.js'/.test(sw), 'sw.js: сервис в precache (офлайн)');
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m && parseInt(m[1], 10) >= 192, 'sw.js: cache version ≥ finance-v192');
}

// ============ §2 — форма: «Место / магазин» ============
{
  const iCat = html.indexOf('id="catBlock"'), iSub = html.indexOf('id="subcatBlock"'),
        iPlace = html.indexOf('id="placeBlock"'), iTrans = html.indexOf('id="transRow"'),
        iAcc = html.indexOf('id="accField"');
  assertTrue(iCat > 0 && iCat < iSub && iSub < iPlace && iPlace < iTrans && iPlace < iAcc,
    'Блок места — сразу после категории и подкатегории, до счёта/даты');
  const block = html.slice(iPlace, html.indexOf('id="transRow"'));
  assertTrue(/Место \/ магазин — необязательно/.test(block), 'Подпись «Место / магазин — необязательно»');
  assertTrue(/id="placeStrip"/.test(block), 'Контейнер чипов #placeStrip');
  assertTrue(/id="payeeRow"/.test(block) && /id="fPayee"/.test(block), '#payeeRow/#fPayee перенесены в блок места (то же поле payee, без дубля)');
  assertTrue(/id="payeeClear"[^>]*aria-label="Очистить место"/.test(block), 'Кнопка очистки места');
  assertTrue((html.match(/id="fPayee"/g) || []).length === 1, 'Поле места одно — нового поля данных нет');

  const rp = fnSrc('renderPlaces');
  assertTrue(!!rp, 'renderPlaces() объявлена');
  assertTrue(/isExp=aType==='expense'/.test(rp) && /P\.suggestions\(state\.tx,aCat,\{type:'expense'\}\)/.test(rp),
    'Чипы — только для расхода и только из выбранной категории (PlaceBreakdown.suggestions)');
  assertTrue(/row\.style\.display=placeItems\.length\?'':'none'/.test(rp), 'Без истории мест строка чипов скрыта');
  assertTrue(/'Получатель'/.test(rp), 'У дохода — прежний «Получатель»');
  assertTrue(/\?'':v;/.test(rp), 'Повторный тап по выбранному чипу очищает место');
  assertTrue(/esc\(v\)/.test(rp), 'Названия мест экранируются (esc)');
  assertTrue(/\$\('#payeeClear'\)\.hidden=!inp\.value/.test(rp), 'Кнопка очистки видна только при заполненном месте');

  const upd = fnSrc('updatePayeeAc');
  assertTrue(/const pool=state\.tx\.filter\(t=>t&&t\.type===aType&&t\.cat===aCat\)/.test(upd) && /payeeSuggestions\(pool,q\)/.test(upd),
    'Автодополнение — только из операций того же типа и категории');

  const st = fnSrc('setType');
  assertTrue(/\$\('#placeBlock'\)\.style\.display=vis\.payeeRow\?'':'none'/.test(st), 'Перевод: блок места скрыт (как прежде #payeeRow)');
  assertTrue(/renderSubcats\(\);\s*renderPlaces\(\);/.test(st), 'setType() перерисовывает чипы мест');
  assertTrue(/renderSubcats\(\);renderPlaces\(\);/.test(st), 'Смена категории перерисовывает чипы мест этой категории');
  assertTrue(/\$\('#fPayee'\)\.oninput=\(\)=>\{updatePayeeAc\(\);renderPlaces\(\);\}/.test(html), 'Ввод обновляет подсветку чипа');
  assertTrue(/\$\('#payeeClear'\)\.onclick=\(\)=>\{\$\('#fPayee'\)\.value='';/.test(html), 'Очистка обнуляет поле');
  assertTrue(/inp\.value=payeeAcItems\[i\];[\s\S]{0,140}renderPlaces\(\);/.test(fnSrc('pickPayee')), 'Выбор из автодополнения обновляет чипы');
  // сохранение — прежний applyTxMeta: пустое место удаляет ключ payee
  assertTrue(/const p=metaNormPayee\(payee\); if\(p\)t\.payee=p; else delete t\.payee;/.test(html),
    'Сохранение без места не создаёт пустой ключ (прежний applyTxMeta)');
  assertTrue(/\$\('#fPayee'\)\.value=t\.payee\|\|''/.test(html), 'Редактирование показывает сохранённое место');
  // CSS: длинные названия чипов не ломают форму
  assertTrue(/#overlay \.place-strip\{display:flex;flex-wrap:wrap/.test(html), 'Чипы мест переносятся по строкам');
  assertTrue(/#overlay \.place-strip \.subcat-chip\{max-width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis/.test(html),
    'Длинное название обрезается внутри чипа');
}

// ============ §3 — Аналитика: вход в детализацию ============
{
  const pie = fnSrc('renderAnaPie');
  assertTrue(/if\(row\.dataset\.cat&&ty==='expense'&&placeSvc\(\)\)\{openCatDetail\(row\.dataset\.cat\);\}/.test(pie),
    'Тап по расходной категории → openCatDetail()');
  assertTrue(/else if\(row\.dataset\.cat\)\{const c=catById\(row\.dataset\.cat\);openCatTx\(\[row\.dataset\.cat\]/.test(pie),
    'Доходная категория — прежний список операций');
  assertTrue(/else if\(row\.dataset\.cats\)\{openCatTx\(/.test(pie), 'Свёрнутый хвост «Другое» — прежнее поведение');
  assertTrue(/const sel=cur\.filter\(t=>t\.type===ty\)/.test(pie), 'Общий обзор категорий не изменён');
}

// ============ §4 — экран детализации ============
{
  const iD = html.indexOf('id="catDetailOverlay"'), iT = html.indexOf('id="catTxOverlay"');
  assertTrue(iD > 0 && iD < iT, '#catDetailOverlay в DOM раньше #catTxOverlay — операции места открываются поверх');
  const mk = html.slice(iD, iT);
  assertTrue(/class="overlay catx-ov" id="catDetailOverlay"/.test(html), 'Каркас экрана — .catx-ov (как «Операции по категории»)');
  assertTrue(/<button class="catx-back" id="catDetailClose" aria-label="Назад">/.test(mk), 'Кнопка «Назад»');
  assertTrue(/id="catDetailIc"/.test(mk) && /id="catDetailTitle"/.test(mk), 'Иконка и название категории');
  assertTrue(/class="month-switch cd-switch"/.test(mk) && /id="catDetailPrev"/.test(mk) && /id="catDetailNext"/.test(mk),
    'Переключатель периода — общий компонент .month-switch со стрелками');
  assertTrue(/<canvas id="placeChart"/.test(mk), 'Отдельное кольцо #placeChart');
  assertTrue(/id="cdCenterName"/.test(mk) && /id="cdCenterSum"/.test(mk) && /id="cdCenterCnt"/.test(mk),
    'Центр кольца: название, сумма, число операций');
  assertTrue(/id="cdCompare"/.test(mk) && /id="cdList"/.test(mk) && /id="cdAllBtn"/.test(mk), 'Сравнение, список мест, «Все операции»');
  assertTrue(/id="cdEmpty"[^>]*hidden/.test(mk) && /Нет расходов за этот период/.test(mk), 'Пустое состояние (скрыто по умолчанию)');

  const rd = fnSrc('renderCatDetail');
  assertTrue(!!rd, 'renderCatDetail() объявлена');
  assertTrue(/const r=periodRange\(\), pr=rangeBack\(1\);/.test(rd), 'Период — общий период Аналитики, прошлый — rangeBack(1)');
  assertTrue(/P\.breakdown\(state\.tx\.filter\(t=>inAnaRange\(t,r\)\),cdCat,opts\)/.test(rd), 'Детализация через PlaceBreakdown.breakdown');
  assertTrue(/type:'expense',amountOf:txBase/.test(rd), 'Только расходы, суммы в базовой валюте (txBase)');
  assertTrue(/\$\('#cdHero'\)\.hidden=empty;/.test(rd) && /\$\('#cdEmpty'\)\.hidden=!empty;/.test(rd), 'Пустой период — без кольца, пустое состояние');
  assertTrue(/if\(empty\)\{[\s\S]*?placeChart\.destroy\(\)/.test(rd), 'Пустой период уничтожает старое кольцо (не остаётся сломанная диаграмма)');
  assertTrue(/P\.segments\(bd\.rows\)/.test(rd) && /backgroundColor:segs\.map\(g=>g\.color\)/.test(rd), 'Цвета сегментов = цвета маркеров строк');
  assertTrue(/style="background:\$\{x\.color\}"/.test(rd), 'Маркер строки окрашен цветом сегмента');
  assertTrue(/P\.change\(bd\.total,prevSum\)/.test(rd) && /В прошлом периоде расходов не было/.test(rd), 'Сравнение без «∞%»');
  assertTrue(!/∞/.test(rd.replace(/\/\/[^\n]*/g, '')), 'Нет символа ∞ в коде детализации (вне комментариев)');
  assertTrue(/cdPct\(x\.share\)/.test(rd) && /plural\(x\.count,'операция','операции','операций'\)/.test(rd), 'Строка: доля и число операций');
  assertTrue(/esc\(x\.label\)/.test(rd), 'Названия мест экранируются');
  assertTrue(/openPlaceTx\(cdCat,x\.key,x\.label\)/.test(rd), 'Тап по месту → операции этого места');
  assertTrue(/plugins:\[pieLabels\]/.test(rd), 'Проценты на крупных сегментах — общий плагин pieLabels (названия — только в списке)');

  assertTrue(/\$\('#catDetailPrev'\)\.onclick=\(\)=>shiftPeriod\(-1\);/.test(html) && /\$\('#catDetailNext'\)\.onclick=\(\)=>shiftPeriod\(1\);/.test(html),
    'Стрелки периода — тот же shiftPeriod(), что в Аналитике');
  assertTrue(/renderHeader\(\);\s*renderCatDetail\(\);[^\n]*\n\}/.test(fnSrc('render')), 'render() обновляет открытую детализацию (период/CRUD)');
  assertTrue(/\$\('#catDetailClose'\)\.onclick=closeCatDetail;/.test(html), '«Назад» закрывает детализацию → Аналитика');
  const oc = fnSrc('openCatDetail');
  assertTrue(oc.indexOf("classList.add('show')") < oc.indexOf('renderCatDetail()'), 'Экран показывается до построения кольца (Chart.js меряет контейнер)');
  assertTrue(/placeChart\.destroy\(\)/.test(fnSrc('closeCatDetail')), 'Закрытие уничтожает кольцо');
}

// ============ §5 — операции места ============
{
  const op = fnSrc('openPlaceTx');
  assertTrue(/catTxPlace=\{key,label\};/.test(op) && /catTxIds=\[catId\];catTxType='expense';/.test(op), 'Режим «по месту»: категория, тип расход, место');
  assertTrue(/\$\('#catTxOverlay'\)\.classList\.add\('show'\)/.test(op), 'Открывается существующий экран операций');
  assertTrue(/catTxPlace=null;/.test(fnSrc('openCatTx')), 'openCatTx() (Бюджеты/доходы) — обычный режим');
  const rt = fnSrc('renderCatTx');
  assertTrue(/const r=drill\?placeTxRange\(\):catTxRange\(\)/.test(rt), 'Период операций места = период детализации');
  assertTrue(/'Расходы › '\+c\.name\+' › '/.test(rt), 'Крошки «Расходы › Категория › Место»');
  assertTrue(/\$\('#catTxSeg'\)\.style\.display=drill\?'none':''/.test(rt), 'Собственный выбор периода скрыт в режиме «по месту»');
  assertTrue(/catxGroupedTxHtml\(shown\)/.test(rt), 'Группировка по дням и итог дня — прежний catxGroupedTxHtml');
  assertTrue(/openSheet\(x\.dataset\.id\)/.test(rt), 'Редактирование/удаление операции — прежний openSheet');
  assertTrue(/<div class="catx-crumb" id="catTxCrumb" hidden><\/div>/.test(html), 'Элемент крошек');
  assertTrue(/if\(catTxPlace\)\{shiftPeriod\(dir\);renderCatTx\(\);return;\}/.test(fnSrc('catTxShift')),
    'Стрелки на экране операций двигают общий период → «Назад» вернёт тот же период');
  assertTrue(/\$\('#catTxClose'\)\.onclick=\(\)=>\$\('#catTxOverlay'\)\.classList\.remove\('show'\);/.test(html),
    '«Назад» с операций места возвращает на детализацию (она под экраном)');
  assertTrue(/openPlaceTx\(cdCat,null,'Все операции'\)/.test(html), '«Все операции категории» — key=null');
}

// ============ §6 — CSS ============
{
  assertTrue(/\.cd-nm\{[^}]*-webkit-line-clamp:2/.test(html) && /\.cd-nm\{[^}]*overflow-wrap:anywhere/.test(html),
    'Длинное название места — до 2 строк, без наезда на сумму');
  assertTrue(/\.cd-l\{flex:1;min-width:0\}/.test(html), 'Колонка названия сжимается (min-width:0)');
  assertTrue(/\.cd-amt\{flex-shrink:0;max-width:48%;[^}]*white-space:nowrap/.test(html), 'Сумма в одну строку, не шире половины');
  assertTrue(/\.cat-donut\.cd-donut\{width:min\(220px,62vw\);height:min\(220px,62vw\)\}/.test(html), 'Кольцо ужимается на маленьком iPhone');
  assertTrue(/\.cd-page>\*\{flex-shrink:0\}/.test(html), 'Блоки экрана не сжимаются flex-колонкой (урок TASK_041 .catx-summary)');
  const cdCss = (html.match(/\/\* ===== TASK_060: детализация категории[\s\S]*?\.catx-crumb\[hidden\]\{display:none\}/) || [''])[0];
  assertTrue(!!cdCss, 'Блок CSS TASK_060 найден');
  assertTrue(!/#[0-9a-fA-F]{3,8}\b/.test(cdCss), 'CSS детализации без литеральных цветов — только токены темы (light/dark)');
  assertTrue(/\.catx-page\{[^}]*env\(safe-area-inset-bottom\)/.test(html), 'Safe-area снизу — от общего .catx-page');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
