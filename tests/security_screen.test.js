// tests/security_screen.test.js — тесты для TASK_023 (Apple-редизайн экрана
// «Безопасность» + доведение его настроек до реально работающих).
//
// Часть задачи чисто интерфейсная, поэтому проверки статические — regex по
// index.html / sw.js / store.js (тот же приём, что tests/profile_screen.test.js
// и tests/budgets_screen.test.js). Чистые правила покрыты отдельно в
// tests/security_service.test.js.
//
//  1. Каркас экрана: полноэкранный .secp-page, круглая кнопка «Назад»,
//     заголовок и подзаголовок, фон/safe-area/тёмная тема.
//  2. Состав карточек: код / Face ID / «Запрашивать», виджеты, приватность.
//  3. Честность: виджеты — disabled без сохраняемой настройки; биометрия —
//     реальный WebAuthn с проверкой доступности, без имитации.
//  4. Зависимости: код выключен → Face ID гаснет; Face ID без кода → создание кода.
//  5. Сохранность существующей логики защитного кода и её подключение к
//     новой настройке «Запрашивать».
//  6. Переключатели: role="switch" + aria-checked + видимый focus + анимация,
//     бирюзовый акцент, без градиента и эмодзи.
//  7. Ничего не сломано за пределами задачи: .sw/.sec-toggle и экран профиля
//     на месте, «Безопасность» не вернулась в шторку.
//  8. Подключение нового сервиса и версия кэша service worker.
// Запуск: node tests/security_screen.test.js

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const store = fs.readFileSync(path.join(root, 'js', 'database', 'store.js'), 'utf8');
const svc = fs.readFileSync(path.join(root, 'js', 'services', 'security_service.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
// Вырезаем участок между двумя маркерами — чтобы проверки «есть здесь» /
// «нет здесь» не путали разные экраны друг с другом.
function slice(startRe, endRe, label) {
  const m = html.match(startRe);
  assertTrue(!!m, `${label}: начало блока найдено`);
  if (!m) return '';
  const rest = html.slice(m.index);
  const e = rest.slice(1).match(endRe);
  assertTrue(!!e, `${label}: конец блока найден`);
  return e ? rest.slice(0, e.index + 1) : rest;
}

const secMarkup = slice(/<!-- Безопасность — отдельный экран/, /<!-- Выбор времени блокировки/, 'Разметка экрана «Безопасность»');
const pickMarkup = slice(/<!-- Выбор времени блокировки/, /<!-- PIN-код/, 'Разметка выбора времени блокировки');
const drawerMarkup = slice(/<!-- Боковая панель \(drawer\)/, /<!-- Безопасность — отдельный экран/, 'Разметка боковой шторки');
const renderSec = slice(/function renderSecurity\(\)\{/, /\nasync function secToggleBio/, 'Функция renderSecurity()');

// ============ 1. Каркас экрана ============
assertTrue(/<div class="overlay secp-ov" id="securityOverlay">/.test(html),
  'Экран безопасности — собственный полноэкранный оверлей .secp-ov (не общий .detail-sheet)');
assertTrue(!/id="securityOverlay"[^>]*>\s*<div class="detail-sheet"/.test(html),
  'Прежний модальный .detail-sheet у экрана безопасности больше не используется');
assertTrue(/\.secp-page\{[^}]*background:var\(--home-bg\)/.test(html),
  'Фон экрана — тот же светло-серый var(--home-bg), что на Главной/Профиле/Счетах/Бюджетах');
assertTrue(/\.secp-page\{[^}]*env\(safe-area-inset-top\)[^}]*env\(safe-area-inset-bottom\)/.test(html),
  'Учтена safe-area iPhone сверху и снизу');
assertTrue(/\.secp-page\{[^}]*overflow-y:auto[^}]*-webkit-overflow-scrolling:touch/.test(html),
  'У экрана собственный мобильный скролл');
assertTrue(/\.secp-card\{[^}]*box-shadow:var\(--fincard-shadow\)/.test(html),
  'Карточки используют существующий токен мягкой тени var(--fincard-shadow)');
assertTrue(/\.secp-card\{[^}]*background:var\(--card\)/.test(html) && /\.secp-card\{[^}]*border-radius:2\dpx/.test(html),
  'Карточки — белые с крупным скруглением');
assertTrue(/\[data-theme="dark"\] \.secp-page,\[data-theme="dark"\] \.secp-pick-ov\{--secp-accent:/.test(html)
  && /\[data-theme="dark"\] \.secp-sep\{/.test(html),
  'Тёмная тема учтена (акцент на обоих слоях и разделители)');
assertTrue(/\.secp-sep\{[^}]*margin-left:20px/.test(html),
  'Разделители — аккуратные inset (не на всю ширину карточки)');

// ============ 2. Шапка ============
assertTrue(/<button class="secp-back" id="securityClose" aria-label="Назад">/.test(secMarkup),
  'Кнопка «Назад» — с aria-label');
assertTrue(/\.secp-back\{[^}]*border-radius:50%/.test(html) && /\.secp-back\{[^}]*border:1\.6px solid var\(--text\)/.test(html),
  'Кнопка «Назад» — круглая, с тонкой тёмной обводкой (как в референсе)');
assertTrue(/\.secp-back svg\{/.test(html) && /<svg viewBox="0 0 12 20" aria-hidden="true"><path d="M10 1\.5 2 10l8 8\.5"\/><\/svg>/.test(secMarkup),
  'Внутри кнопки — SVG-шеврон');
assertTrue(/<div class="secp-title">Безопасность<\/div>/.test(secMarkup), 'Заголовок «Безопасность» по центру');
assertTrue(/\.secp-nav \.secp-title\{[^}]*pointer-events:none/.test(html),
  'Заголовок не перехватывает касания (как на экране профиля)');
assertTrue(/<div class="secp-sub">Ограничение входа в приложение<\/div>/.test(renderSec),
  'Крупный спокойный подзаголовок «Ограничение входа в приложение»');
assertTrue(!/🔐|🔒|🙈/.test(secMarkup) && !/🔐|🔒|🙈/.test(renderSec),
  'На экране безопасности не осталось эмодзи (требование постановки)');

// ============ 3. Главная карточка доступа ============
assertTrue(/Защитный код<\/span>/.test(renderSec), 'Строка «Защитный код»');
assertTrue(/>Face ID/.test(renderSec), 'Строка «Face ID»');
assertTrue(/Запрашивать<\/span>/.test(renderSec), 'Строка «Запрашивать»');
assertTrue(/<span class="secp-val">\$\{delayLbl\}<\/span>/.test(renderSec),
  'У «Запрашивать» справа выводится выбранное значение');
assertTrue(/secp-chev/.test(renderSec), 'У «Запрашивать» есть шеврон для открытия настройки');
assertTrue(/id="secLockBtn"/.test(renderSec) && /\$\('#secLockBtn'\)\.onclick=openLockPicker/.test(renderSec),
  '«Запрашивать» открывает выбор времени блокировки');
assertTrue(/aria-disabled="true"[^`]*Запрашивать/.test(renderSec) || /pinOn\s*\n?\s*\?[\s\S]*secLockBtn[\s\S]*:[\s\S]*aria-disabled="true"/.test(renderSec),
  'Без включённого кода строка «Запрашивать» неактивна');
assertTrue(/\$\('#swPin'\)\.onclick=\(\)=>\{ if\(state\.pinHash\)pinStart\('disable'\); else pinStart\('set'\); \}/.test(renderSec),
  'Переключатель кода использует существующую машину состояний (set/disable), а не новую логику');
assertTrue(/id="secChangePin"/.test(renderSec) && /pinStart\('change'\)/.test(renderSec),
  'Изменение защитного кода доступно при включённом коде');

// ============ 4. Переключатели: качество и доступность ============
assertTrue(/role="switch" aria-label="\$\{label\}" aria-checked="\$\{on\?'true':'false'\}"/.test(renderSec),
  'Переключатели — role="switch" с aria-label и aria-checked (читается screen reader)');
assertTrue(/const sw=\(id,label,on,dis\)=>`<button class="secp-sw"[^`]*type="button"/.test(renderSec),
  'Переключатель — настоящая <button> (фокусируется и жмётся с клавиатуры штатно)');
['Защитный код', 'Face ID', 'Разрешить виджетам доступ к данным', 'Скрывать суммы'].forEach(l => {
  assertTrue(renderSec.includes(`'${l}'`), `У переключателя есть доступное имя: ${l}`);
});
assertTrue(/\.secp-sw\[aria-checked="true"\]\{background:var\(--secp-accent\)\}/.test(html),
  'Визуальное состояние переключателя следует из aria-checked (одно состояние, не два источника правды)');
assertTrue(/\.secp-sw:focus-visible\{outline:/.test(html), 'У переключателя видимый focus-ring');
assertTrue(/\.secp-sw\{[^}]*transition:background \.24s/.test(html) && /\.secp-sw::after\{[^}]*transition:transform \.24s/.test(html),
  'Переключатель анимирован плавно (фон + движение бегунка)');
assertTrue(/--secp-accent:#30b0c7/.test(html),
  'Активный цвет — спокойный бирюзово-голубой #30b0c7 (тот же тон, что у чипа «Безопасность» в профиле)');
assertTrue(!/\.secp-sw\[aria-checked="true"\]\{[^}]*gradient/.test(html),
  'В активном состоянии переключателя нет градиента (тем более фиолетового)');
assertTrue(/\.secp-sw\[disabled\]\{/.test(html), 'Есть явное оформление недоступного переключателя');

// ============ 5. Face ID — реальная биометрия или честное «недоступно» ============
assertTrue(/PublicKeyCredential\.isUserVerifyingPlatformAuthenticatorAvailable\(\)/.test(html),
  'Доступность биометрии определяется штатной проверкой платформенного аутентификатора');
assertTrue(/navigator\.credentials\.create\(\{publicKey:\{/.test(html) && /navigator\.credentials\.get\(\{publicKey:\{/.test(html),
  'Биометрия реализована через настоящий WebAuthn (регистрация + проверка), а не имитацией');
assertTrue((html.match(/userVerification:'required'/g) || []).length >= 2,
  'И регистрация, и проверка требуют userVerification:\'required\' (иначе Face ID может не запрашиваться)');
assertTrue(/authenticatorAttachment:'platform'/.test(html),
  'Используется именно платформенный аутентификатор (Face ID/Touch ID устройства)');
assertTrue(/secBioAvail===false\?'<i class="secp-sub2">Недоступно на этом устройстве<\/i>'/.test(renderSec),
  'Если платформенной биометрии нет — честная подпись «Недоступно на этом устройстве»');
assertTrue(/sw\('swBio','Face ID',bioOn,secBioAvail!==true\)/.test(renderSec),
  'Переключатель Face ID выключен (disabled), пока доступность не подтверждена');
assertTrue(/const bioReady=secBioAvail===true&&!!S, bioOn=bioReady&&sec\.biometric/.test(renderSec),
  'Face ID показывается включённым только при реально доступной биометрии');
assertTrue(/локальная блокировка входа на этом устройстве[^`]*не шифруются/.test(renderSec),
  'Пользователю честно сказано, чем является защита (локальная блокировка, данные не шифруются)');

// ============ 6. Зависимости «код ↔ Face ID» ============
assertTrue(/if\(!state\.pinHash\)\{[^}]*pinStart\('set'\);return;/.test(html),
  'Включение Face ID без кода сначала ведёт к созданию защитного кода');
assertTrue(/state\.pinHash=null;\s*\n?\s*const S=secSvc\(\); if\(S\)state\.settings\.security=S\.applyPasscodeOff\(S\.read\(state\)\);/.test(html),
  'Отключение защитного кода гасит Face ID через правило чистого сервиса');
assertTrue(/if\(!S\.canEnableBiometric\(!!state\.pinHash,secBioAvail\)\)return;/.test(html),
  'Включение биометрии проходит через проверку canEnableBiometric()');
// TASK_026 переписала строку: сохранение теперь проверяется (`if(!save().ok)`),
// поэтому дословное сравнение заменено на сам инвариант — выключение снимает
// и флаг, и сохранённый идентификатор ключа, после чего экран перерисовывается.
assertTrue(/sec\.biometric=false;sec\.bioCredId=null;.*renderSecurity\(\)/.test(html),
  'Выключение Face ID удаляет сохранённый ключ');

// ============ 7. «Запрашивать» — настоящая, а не декоративная настройка ============
assertTrue(/<div id="secLockList" role="radiogroup"/.test(pickMarkup),
  'Выбор времени блокировки — доступная группа radio');
assertTrue(/role="radio" aria-checked=/.test(html), 'Варианты выбора помечены role="radio" + aria-checked');
// TASK_026: между присваиванием и закрытием шторки появилась проверка
// результата записи — инвариант тот же, дословный текст изменился.
assertTrue(/state\.settings\.security=next;\s*\n?\s*if\(!save\(\)\.ok\)/.test(html),
  'Выбранное значение сохраняется в состояние (переживает перезагрузку)');
assertTrue(/function secMarkInactive\(\)\{[\s\S]*lastActiveAt=Date\.now\(\)/.test(html),
  'Уход приложения в фон фиксируется отметкой времени');
assertTrue(/window\.addEventListener\('pagehide',secMarkInactive\)/.test(html),
  'Отметка ставится и на pagehide (iOS часто не даёт другого шанса)');
assertTrue(/document\.addEventListener\('visibilitychange',\(\)=>\{ document\.visibilityState==='hidden'\?secMarkInactive\(\):secMaybeLock\(\); \}\)/.test(html),
  'Возврат в приложение приводит к повторной проверке блокировки');
assertTrue(/function secShouldLock\(\)\{[\s\S]*S\.shouldLock\(state,Date\.now\(\)\)/.test(html),
  'Решение о блокировке принимает чистый сервис (покрыт юнит-тестами)');
assertTrue(/^secMaybeLock\(\);/m.test(html) && !/if\(state\.pinHash\)pinStart\('unlock'\)/.test(html),
  'Блокировка на старте идёт через secMaybeLock() (с учётом настройки), прежняя безусловная строка убрана');

// ============ 8. Виджеты — честное disabled-состояние ============
assertTrue(/Разрешить виджетам доступ к данным/.test(renderSec), 'Отдельная карточка «Разрешить виджетам доступ к данным»');
assertTrue(/sw\('swWidgets','[^']*',false,true\)/.test(renderSec),
  'Переключатель виджетов выключен и disabled (функции нет — включать нечего)');
assertTrue(/Веб-версия A-Lex Finance не передаёт данные виджетам/.test(renderSec),
  'Пользователю объяснено, почему настройка недоступна (без заявления несуществующей защиты)');
// Комментарии сервиса объясняют, ПОЧЕМУ виджетов тут нет — проверяем сам код.
const svcCode = svc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
assertTrue(!/widget/i.test(svcCode),
  'Настройка виджетов НЕ сохраняется в состоянии — в коде сервиса её нет');
assertTrue(!/"widgets"/.test(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')),
  'Проверочный факт: в manifest.json действительно нет виджетов');

// ============ 9. Сохранность существующей логики и границы задачи ============
['async function sha(s)', 'function pinStart(mode)', 'function pinKey(d)', 'async function pinComplete()',
 'function pinError()', 'function closePin()', 'function openSecurity()'].forEach(sig => {
  assertTrue(html.includes(sig), `Существующая функция сохранена: ${sig}`);
});
assertTrue(/state\.pinHash=await sha\(code\)/.test(html), 'Код по-прежнему хранится только в виде хэша');
assertTrue(/\$\('#swHide'\)\.onclick=\(\)=>\{state\.hideAmounts=!state\.hideAmounts;save\(\);renderSecurity\(\);render\(\);updateEye\(\);updateFcEye\(\);\}/.test(renderSec),
  'Существующая настройка «Скрывать суммы» сохранена без изменений логики');
assertTrue(/\.sw\{width:50px/.test(html) && /\.sec-toggle\{/.test(html),
  'Общие .sw/.sec-toggle не удалены — их использует редактор напоминания');
assertTrue(/<div class="sec-toggle" style="margin-bottom:14px"><span>Создавать операцию автоматически<\/span><button class="sw" id="remAutoPost"><\/button><\/div>/.test(html),
  'Строка «Создавать операцию автоматически» (единственный другой потребитель .sw) не затронута');
assertTrue(!/\.sec-btn/.test(html), 'Мёртвый после редизайна .sec-btn удалён');
assertTrue(/\.prof-card\{background:var\(--card\);border-radius:22px;box-shadow:var\(--fincard-shadow\)/.test(html),
  'Экран профиля (TASK_021) не затронут');
assertTrue(/<button class="prof-row" id="profSecurity">/.test(html),
  'Точка входа «Безопасность» остаётся в профиле');
assertTrue(!/Безопасность/.test(drawerMarkup) && !/id="drSecurity"/.test(html),
  '«Безопасность» НЕ вернулась в боковую шторку «Ещё» (прямое требование)');
assertTrue(!/'#pinOverlay'/.test((html.match(/if\(e\.key==='Escape'\)\{closeSheet\(\);\[[^\]]*\]/) || [''])[0]),
  'Экран ввода кода по-прежнему нельзя закрыть по Escape');
assertTrue(/'#securityOverlay','#secLockOverlay'\]/.test(html),
  'Новые оверлеи добавлены в общий Escape-обработчик');

// ============ 10. Подключение сервиса и версия кэша ============
assertTrue(fs.existsSync(path.join(root, 'js', 'services', 'security_service.js')),
  'Новый чистый сервис js/services/security_service.js существует');
assertTrue(html.indexOf('js/services/security_service.js') < html.indexOf('js/database/store.js'),
  'Сервис подключается ДО store.js — migrate() должен его видеть при первом load()');
assertTrue(/const SEC = \(typeof AF !== 'undefined' && AF && AF\.Services\) \? AF\.Services\.Security : null;/.test(store)
  && /if \(SEC && typeof SEC\.normalize === 'function'\) SEC\.normalize\(s\);/.test(store),
  'migrate() нормализует настройки безопасности с проверкой наличия сервиса (инвариант совместимости TASK_015 §0)');
assertEqual((store.match(/const SCHEMA_VERSION = (\d+);/) || [])[1], '3',
  'SCHEMA_VERSION не поднимался — новые ключи необязательны и нормализуются идемпотентно');
assertTrue(/'\.\/js\/services\/security_service\.js',/.test(sw), 'Сервис добавлен в ASSETS service worker');
// >= вместо точного номера — та же практика, что tests/budgets_screen.test.js §7:
// последующие точечные задачи (напр. TASK_024) законно поднимают версию дальше.
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m, 'sw.js: CACHE найден');
  if (m) assertTrue(parseInt(m[1], 10) >= 166, 'Версия кэша service worker поднята до finance-v166 или выше (TASK_023)');
}
assertTrue(!/document\.|localStorage|navigator\.|crypto\.|PublicKeyCredential/.test(svcCode),
  'Сервис остаётся чистым: без DOM, localStorage, WebAuthn и прочих обращений к платформе');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
