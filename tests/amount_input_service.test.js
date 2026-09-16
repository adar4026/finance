// tests/amount_input_service.test.js — тесты для TASK_043 (ввод суммы через
// системную клавиатуру iOS: нативное поле <input inputmode="decimal">).
//
//  §1  AF.Services.AmountInput — чистые правила ввода:
//      sanitize (одна запятая, ≤2 знака, точка → запятая, мусор отбрасывается,
//      ведущие нули), toExpr (каноническая строка для aExpr, без NaN),
//      normalize (45,5 → 45,50; 45, → 45; ,5 → 0,50; пусто → 0),
//      fromNumber/display (загрузка сохранённой операции, группировка разрядов).
//  §2  Статика index.html/sw.js: поле с inputmode/enterkeyhint, стороны
//      перевода — поля, панель «Готово/Калькулятор», калькулятор сохранён как
//      режим (разметка/обработчики/applyKey/evalExpr не тронуты), нет новых
//      haptic-обходов, сервис подключён и закэширован, версия кэша поднята.
// Запуск: node tests/amount_input_service.test.js

const fs = require('fs');
const path = require('path');

global.window = global;
require('../js/services/amount_input_service.js');
const A = AF.Services.AmountInput;

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ §1.1 sanitize ============
[
  ['45,52', '45,52', 'запятая как разделитель'],
  ['45.52', '45,52', 'точка (аппаратная/иной регион) → запятая'],
  ['45,', '45,', 'промежуточное «45,» допустимо'],
  ['45.', '45,', 'промежуточное «45.» → «45,»'],
  ['0,50', '0,50', '«0,50» сохраняется'],
  ['100', '100', 'целое'],
  ['100,5', '100,5', 'один знак после запятой во время набора'],
  ['1,2,3', '1,23', 'вторая запятая отбрасывается'],
  ['1,234', '1,23', 'не более двух знаков после запятой'],
  ['abc12x', '12', 'буквы отбрасываются'],
  ['12a.3', '12,3', 'буквы внутри отбрасываются, точка → запятая'],
  ['007', '7', 'ведущие нули убираются'],
  ['00,5', '0,5', '«00,5» → «0,5»'],
  [',5', '0,5', '«,5» → «0,5»'],
  ['0', '0', 'ноль остаётся нулём'],
  ['', '', 'пусто остаётся пустым (плейсхолдер «0»)'],
  ['12 500,50', '12500,50', 'разрядные пробелы убираются при фокусе'],
  ['12 500', '12500', 'неразрывный пробел убирается'],
  ['-45', '45', 'знак не вводится вручную — его задаёт тип операции'],
  [null, '', 'null → пусто'],
  [undefined, '', 'undefined → пусто'],
  [4552, '4552', 'число приводится к строке'],
].forEach(([inp, exp, msg]) => assertEqual(A.sanitize(inp), exp, `sanitize(${JSON.stringify(inp)}): ${msg}`));
assertEqual(A.sanitize('1234567890123456'), '123456789012', 'целая часть ограничена MAX_INT_DIGITS');

// ============ §1.2 toExpr / toNumber ============
[
  ['45,52', '45.52'], ['45.52', '45.52'], ['45,', '45'], ['45,5', '45.5'], ['45,50', '45.5'],
  ['0,50', '0.5'], [',5', '0.5'], ['100', '100'], ['', '0'], [',', '0'], ['0', '0'], ['abc', '0'],
  ['007', '7'], ['0,00', '0'],
].forEach(([inp, exp]) => assertEqual(A.toExpr(inp), exp, `toExpr(${JSON.stringify(inp)}) → ${exp}`));
['45,52', '45,', '', ',', 'abc', '1,2,3', null].forEach(v =>
  assertTrue(!isNaN(parseFloat(A.toExpr(v))), `toExpr(${JSON.stringify(v)}) всегда парсится без NaN`));
assertEqual(A.toNumber('45,52'), 45.52, 'toNumber 45,52');
assertEqual(A.toNumber('45,'), 45, 'toNumber промежуточного «45,»');
assertEqual(A.toNumber(''), 0, 'toNumber пусто → 0');
assertEqual(A.toNumber('0,5'), 0.5, 'toNumber 0,5');
assertTrue(A.isPositive('45,') && !A.isPositive('') && !A.isPositive('0,0'), 'isPositive для знака/цвета во время набора');

// ============ §1.3 normalize (завершение ввода) ============
[
  ['45,5', '45,50'], ['45,', '45'], ['45.', '45'], [',5', '0,50'], ['', '0'], [',', '0'],
  ['100', '100'], ['100,5', '100,50'], ['0,50', '0,50'], ['45,52', '45,52'], ['007', '7'],
  ['0', '0'], ['0,0', '0'], ['12 500,5', '12500,50'],
].forEach(([inp, exp]) => assertEqual(A.normalize(inp), exp, `normalize(${JSON.stringify(inp)}) → ${exp}`));

// ============ §1.4 fromNumber / display ============
assertEqual(A.fromNumber(45.5), '45,50', 'fromNumber 45.5 → 45,50');
assertEqual(A.fromNumber(45.52), '45,52', 'fromNumber 45.52');
assertEqual(A.fromNumber(100), '100', 'fromNumber целое без ,00');
assertEqual(A.fromNumber(0.5), '0,50', 'fromNumber 0.5 → 0,50');
assertEqual(A.fromNumber(0), '0', 'fromNumber 0');
assertEqual(A.fromNumber(NaN), '0', 'fromNumber NaN → 0 (без NaN в поле)');
assertEqual(A.fromNumber(-5), '0', 'fromNumber отрицательное → 0 (знак задаёт тип)');
assertEqual(A.fromNumber(12500.5), '12500,50', 'fromNumber без группировки (режим редактирования)');
assertEqual(A.fromNumber(1.005), '1,01', 'fromNumber округляет до центов');
assertEqual(A.display(100), '100', 'display целое');
assertEqual(A.display(0.5), '0,50', 'display 0,50');
assertEqual(A.display(NaN), '0', 'display NaN → 0');
assertTrue(/^12[\s  ]500,50$/.test(A.display(12500.5)), `display группирует разряды (${JSON.stringify(A.display(12500.5))})`);
assertEqual(A.sanitize(A.display(12500.5)), '12500,50', 'display → sanitize (фокус) убирает группировку без потерь');
assertEqual(A.toExpr(A.display(12500.5)), '12500.5', 'display → toExpr восстанавливает число');

// ============ §1.5 сквозной сценарий 4 → 5 → , → 5 → 2 ============
{
  let v = '';
  ['4', '5', ',', '5', '2'].forEach(ch => { v = A.sanitize(v + ch); });
  assertEqual(v, '45,52', 'посимвольный ввод 45,52');
  assertEqual(A.toExpr(v), '45.52', 'aExpr после ввода');
  assertEqual(A.normalize(v), '45,52', 'normalize не меняет полное значение');
  let u = '';
  ['1', '0', '0', ',', '5'].forEach(ch => { u = A.sanitize(u + ch); });
  assertEqual([u, A.normalize(u)], ['100,5', '100,50'], '100,5 → «Готово» → 100,50');
  let w = '';
  ['0', ',', '5', '0'].forEach(ch => { w = A.sanitize(w + ch); });
  assertEqual([w, A.toExpr(w)], ['0,50', '0.5'], '0,50 посимвольно');
}

// ============ §2 статика ============
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const code = html.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');

assertTrue(/<script src="js\/services\/amount_input_service\.js"><\/script>/.test(html), 'index.html подключает amount_input_service.js');
assertTrue(/'\.\/js\/services\/amount_input_service\.js'/.test(sw), 'sw.js кэширует amount_input_service.js');
{ const m = sw.match(/CACHE = 'finance-v(\d+)'/); assertTrue(m && +m[1] >= 175, `версия кэша поднята (finance-v${m && m[1]})`); }

// Нативное поле суммы
const amtInput = html.match(/<input class="disp-in" id="amtInput"[^>]*>/);
assertTrue(!!amtInput, 'поле #amtInput есть');
if (amtInput) {
  assertTrue(/type="text"/.test(amtInput[0]), '#amtInput type=text (не number — иначе iOS не даёт запятую)');
  assertTrue(/inputmode="decimal"/.test(amtInput[0]), '#amtInput inputmode=decimal — цифровая клавиатура iPhone с разделителем');
  assertTrue(/enterkeyhint="done"/.test(amtInput[0]), '#amtInput enterkeyhint=done');
  assertTrue(/placeholder="0"/.test(amtInput[0]), '#amtInput плейсхолдер «0»');
  assertTrue(/autocomplete="off"/.test(amtInput[0]) && /spellcheck="false"/.test(amtInput[0]), '#amtInput без автодополнения/проверки');
}
['amtFrom', 'amtTo'].forEach(id => {
  const m = html.match(new RegExp(`<input class="td-in" id="${id}"[^>]*>`));
  assertTrue(m && /inputmode="decimal"/.test(m[0]) && /type="text"/.test(m[0]), `сторона перевода #${id} — нативное поле inputmode=decimal`);
});
assertTrue(/<span class="disp-sign" id="dispSign"/.test(html) && /<span class="disp-cur" id="dispCur">/.test(html), 'знак и валюта — отдельные span рядом с полем');
assertTrue(/id="amtMeasure"/.test(html) && /function amtWidth\(inp\)/.test(code), 'ширина поля — по скрытому измерителю (валюта вплотную, не мешает)');
assertTrue(!/role="button" tabindex="0" aria-label="Сумма операции — открыть клавиатуру"/.test(html), 'старая кнопка-дисплей заменена полем');

// Панель над системной клавиатурой
assertTrue(/<div class="amt-bar" id="amtBar" hidden>/.test(html), 'панель #amtBar скрыта по умолчанию');
assertTrue(/id="amtBarDone">Готово</.test(html) && /id="amtBarCalc">Калькулятор</.test(html), 'панель: «Готово» и «Калькулятор»');
assertTrue(/window\.visualViewport\.addEventListener\('resize',placeAmtBar\)/.test(code), 'панель позиционируется по visualViewport');
assertTrue(/\$\$\('#amtBar button'\)\.forEach\(b=>b\.onpointerdown=e=>e\.preventDefault\(\)\)/.test(code), 'кнопки панели не отбирают фокус до click');
assertTrue(/\$\('#amtBarDone'\)\.onclick=amtBlurActive;/.test(code), '«Готово» закрывает клавиатуру (blur)');
assertTrue(/if\(e\.key==='Enter'\)\{e\.preventDefault\(\);inp\.blur\(\);\}/.test(code), 'Enter на аппаратной клавиатуре = «Готово»');
assertTrue(/\.sheet\.amt-open \.tx-footer\{transform:translateY\(100%\)\}/.test(html), 'футер уезжает на время ввода — панель его не перекрывает');

// Привязки: тап по сумме → фокус поля; калькулятор — режим
assertTrue(/bindAmountInput\(\$\('#amtInput'\),null\);/.test(code) && /bindAmountInput\(\$\('#amtFrom'\),'from'\);/.test(code) && /bindAmountInput\(\$\('#amtTo'\),'to'\);/.test(code), 'три поля суммы привязаны');
assertTrue(/\$\('\.display'\)\.onclick=e=>\{if\(e\.target\.closest\('#calcPill'\)\)return;amtFocus\(\$\('#amtInput'\)\);\};/.test(code), 'тап по блоку суммы фокусирует поле');
assertTrue(!/\$\('\.display'\)\.onclick=openKeypad;/.test(code), 'тап по сумме больше не открывает калькулятор');
assertTrue(/\$\('#calcPill'\)\.onclick=openCalc;/.test(code) && /\$\('#amtBarCalc'\)\.onclick=openCalc;/.test(code), 'калькулятор открывается кнопками (режим)');
assertTrue(/function openCalc\(\)\{amtBlurActive\(\);openKeypad\(\);\}/.test(code), 'openCalc: закрыть системную клавиатуру, открыть калькулятор');
assertTrue(/closeKeypad\(\); \/\/ калькулятор — отдельный режим/.test(html), 'фокус поля закрывает калькулятор (не показываются вместе)');
assertTrue(/\$\('#tdFrom'\)\.onclick=e=>\{transFocus='from';updateDisplay\(\);amtFocus\(\$\('#amtFrom'\)\);\};/.test(code), 'сторона «Со счёта» фокусирует своё поле');
assertTrue(/amtFocus\(\$\('#amtTo'\)\);return;\}/.test(code), 'saveTx: «Укажите сумму зачисления» фокусирует поле «На счёт»');

// Калькулятор сохранён как есть
assertTrue(/<div class="keypad-dock" id="keypadDock">/.test(html) && /<button class="save" id="saveBtn">✓<\/button>/.test(html), 'разметка калькулятора сохранена');
assertTrue(/\$\$\('\.keypad button\[data-k\]'\)\.forEach\(b=>\{const k=b\.dataset\.k;if\(k&&k!=='back-hold'\)\{b\.onclick=\(\)=>key\(k\);/.test(code), 'обработчики клавиш калькулятора сохранены');
assertTrue(html.includes("function applyKey(e,k){\n  if(k==='clear')return '0';"), 'applyKey не изменён');
assertTrue(html.includes("try{const r=Function('\"use strict\";return('+s+')')();return isFinite(r)?Math.round(r*100)/100:NaN;}"), 'evalExpr не изменён');

// Модель: поле пишет в aExpr каноническую строку; в фокусе не перезаписывается
assertTrue(/amtCommit\(side,AMT\.toExpr\(s\)\);/.test(code), 'input → aExpr через toExpr');
assertTrue(/inp\.value=AMT\.normalize\(inp\.value\);/.test(code), 'blur → normalize');
assertTrue(/if\(!inp\|\|document\.activeElement===inp\)return;/.test(code), 'amtPaint не трогает поле в фокусе');
assertTrue(/if\(inp\.value==='0'\)inp\.value='';/.test(code), 'при фокусе «0» очищается — ввод без стирания');

// Нет новых haptic-обходов в коде поля суммы (блок TASK_043 в index.html)
{
  const block = html.slice(html.indexOf('const AMT=AF.Services.AmountInput;'), html.indexOf('/* TASK_042: тактильный отклик клавиши'));
  assertTrue(block.length > 500, 'блок TASK_043 найден');
  assertTrue(!/navigator\.vibrate/.test(block), 'в коде поля суммы нет navigator.vibrate');
  assertTrue(!/AF\.Services\.Haptics|haptic\(/.test(block), 'обработчики поля суммы не вызывают Haptics/haptic()');
  assertTrue(!/input\[switch\]|setAttribute\('switch'/.test(code), 'в index.html нет switch-хитростей');
}

// Pressed-state с reduced-motion
assertTrue(/\.calc-pill:active\{transform:scale\(\.96\)/.test(html) && /\.amt-bar button:active\{transform:scale\(\.96\)/.test(html), 'pressed-state кнопок');
assertTrue(/@media \(prefers-reduced-motion:reduce\)\{\s*\.calc-pill,\.amt-bar button,#overlay \.keypad button/.test(html), 'reduced-motion отключает сдвиги');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
