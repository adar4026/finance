// tests/home_tx_wrap_screen.test.js — TASK_046: заголовок и подзаголовок
// операции на Главной (.home-title/.home-sub) показываются ПОЛНОСТЬЮ —
// перенос строк вместо обрезания многоточием. Статические проверки по
// исходнику index.html/sw.js (тот же приём, что tests/category_tx_screen.test.js
// и tests/tx_time_screen.test.js) — задача чисто CSS, логика не менялась.
// Запуск: node tests/home_tx_wrap_screen.test.js

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

// Извлекает тело правила `.home-title{...}` (или другого простого
// одноблочного селектора) из CSS-текста index.html.
function ruleBody(css, selector) {
  const re = new RegExp(selector.replace(/[.]/g, '\\.') + '\\{([^}]*)\\}');
  const m = css.match(re);
  return m ? m[1] : null;
}

// ============ §1 — .home-title: без ellipsis/nowrap/overflow:hidden ============
{
  const body = ruleBody(html, '.home-tx .home-title');
  assertTrue(!!body, 'index.html: правило .home-tx .home-title найдено');
  assertTrue(!/text-overflow\s*:\s*ellipsis/.test(body), '.home-title: text-overflow:ellipsis отсутствует');
  assertTrue(!/white-space\s*:\s*nowrap/.test(body), '.home-title: white-space:nowrap отсутствует');
  assertTrue(!/overflow\s*:\s*hidden/.test(body), '.home-title: overflow:hidden отсутствует');
  assertTrue(/white-space\s*:\s*normal/.test(body), '.home-title: white-space:normal — перенос строк явно включён');
  assertTrue(/overflow-wrap\s*:\s*break-word/.test(body), '.home-title: overflow-wrap:break-word — длинное слово без пробелов не ломает строку по горизонтали');
}

// ============ §2 — .home-sub: без ellipsis/nowrap/overflow:hidden ============
{
  const body = ruleBody(html, '.home-tx .home-sub');
  assertTrue(!!body, 'index.html: правило .home-tx .home-sub найдено');
  assertTrue(!/text-overflow\s*:\s*ellipsis/.test(body), '.home-sub: text-overflow:ellipsis отсутствует');
  assertTrue(!/white-space\s*:\s*nowrap/.test(body), '.home-sub: white-space:nowrap отсутствует');
  assertTrue(!/overflow\s*:\s*hidden/.test(body), '.home-sub: overflow:hidden отсутствует');
  assertTrue(/white-space\s*:\s*normal/.test(body), '.home-sub: white-space:normal — перенос строк явно включён');
  assertTrue(/overflow-wrap\s*:\s*break-word/.test(body), '.home-sub: overflow-wrap:break-word — длинное слово без пробелов не ломает строку по горизонтали');
}

// ============ §3 — ни одно правило Главной не скрывает текст операции целиком ============
// (регрессия «скрытия текста»: -webkit-line-clamp / height ограничения на самих
// блоках title/sub, которые обрезали бы визуально даже без ellipsis)
{
  [ '.home-tx .home-title', '.home-tx .home-sub' ].forEach(sel => {
    const body = ruleBody(html, sel);
    assertTrue(!/line-clamp/.test(body), sel + ': нет -webkit-line-clamp (текст не обрезается по числу строк)');
    assertTrue(!/max-height/.test(body), sel + ': нет max-height (текст не обрезается по высоте)');
  });
}

// ============ §4 — карточка/строка/тело операции не задают фиксированную высоту ============
// Без этого перенос строк упёрся бы в обрезанный контейнер — .home-tx/.home-body/
// .home-daycard должны расти под контент сами.
{
  const rules = [
    { label: '.home-daycard', body: ruleBody(html, '.home-daycard') },
    { label: '.home-tx (базовое правило)', body: ruleBody(html, '.home-tx') },
    { label: '.home-tx .home-body', body: ruleBody(html, '.home-tx .home-body') },
  ];
  rules.forEach(({ label, body }) => {
    assertTrue(!!body, label + ': правило найдено');
    if (body) {
      assertTrue(!/(?:^|[^-a-z])height\s*:/.test(body), label + ': нет фиксированной height (растёт под контент)');
      assertTrue(!/max-height/.test(body), label + ': нет max-height');
    }
  });
}

// ============ §5 — .home-acc (способ оплаты) НАМЕРЕННО защищён от переполнения ============
// Это НЕ «описание операции» — короткая метка счёта; ellipsis здесь допустим и
// нужен, чтобы аномально длинное имя счёта не вызвало горизонтальный скролл строки.
{
  const body = ruleBody(html, '.home-tx .home-acc');
  assertTrue(!!body, 'index.html: правило .home-tx .home-acc найдено');
  assertTrue(/text-overflow\s*:\s*ellipsis/.test(body), '.home-acc: ellipsis сохранён — защита от переполнения строки');
  assertTrue(/max-width\s*:/.test(body), '.home-acc: max-width задан — ограничивает ширину способа оплаты');
}

// ============ §6 — версия кэша sw.js поднята (байты index.html изменились) ============
{
  const m = sw.match(/CACHE\s*=\s*'finance-v(\d+)'/);
  assertTrue(!!m, 'sw.js: CACHE найден');
  if (m) assertTrue(parseInt(m[1], 10) >= 178, "sw.js: версия кэша поднята до finance-v178 или выше (TASK_046)");
}

// ============ §7 — расчётная логика/данные не менялись ============
// Функции, отвечающие за сортировку/суммы/группировку по дням, остались на
// месте с прежними именами — задача чисто визуальная.
{
  assertTrue(/function homeTxRow\(t\)\{/.test(html), 'homeTxRow() не переименована');
  assertTrue(/function homeGroupedTxHtml\(list\)\{/.test(html), 'homeGroupedTxHtml() не переименована');
  assertTrue(/AF\.Services\.TxTime\.sortAll\(list\)/.test(html), 'Сортировка по времени (TASK_044) не тронута');
  assertTrue(/AF\.Services\.TxTime\.sortDay\(byDay\[day\]\)/.test(html), 'Сортировка внутри дня (TASK_044) не тронута');
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
