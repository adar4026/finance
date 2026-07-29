// tests/reliable_save_screen.test.js — проверки путей сохранения в index.html (TASK_026).
// Запуск: node tests/reliable_save_screen.test.js
//
// Поведенческие тесты самого контракта живут в tests/store_save.test.js (там
// работает настоящий AF.Store поверх подставного хранилища). Здесь проверяется
// то, что можно проверить только по коду экрана: что НИ ОДИН CRUD-путь не
// продолжает «успешный» сценарий, не убедившись в физической записи.
// Главный тест — сканер §2: он не ищет заранее известные строки, а находит
// ВСЕ вызовы save() в файле и требует, чтобы каждый был либо проверен, либо
// не заявлял пользователю успех.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
// Код без комментариев: в комментариях TASK_026 намеренно приведены прежние
// (дефектные) конструкции — «было / стало», и они не должны попадать под
// проверки «в коде не осталось …». Блочные комментарии /* */ вырезаются
// целиком, строчные — только когда занимают всю строку (иначе пострадали бы
// URL вида https://).
const code = html
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
const store = fs.readFileSync(path.join(__dirname, '..', 'js', 'database', 'store.js'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}

// ============ 1. Обёртка save() ============
{
  const m = code.match(/function save\(\)\{[\s\S]*?\n\}/);
  assertTrue(!!m, 'Функция save() найдена');
  const body = m ? m[0] : '';
  assertTrue(/const res=AF\.Store\.save\(state\)/.test(body), 'save() получает Result от AF.Store.save()');
  assertTrue(/if\(!res\.ok\)/.test(body), 'save() проверяет результат записи');
  assertTrue(/AF\.Store\.rollback\(state\)/.test(body), 'При отказе save() откатывает состояние в памяти');
  assertTrue(/toastError\(/.test(body), 'При отказе save() показывает пользователю сообщение');
  assertTrue(/return res/.test(body), 'save() возвращает Result вызывающему коду');
  assertTrue(!/AF\.Store\.save\(state\);\s*renderHeader\(\);\s*\}/.test(code),
    'Прежняя обёртка «AF.Store.save(state); renderHeader();» (C-1) в коде не осталась');
  assertTrue(/saveRecovering/.test(code), 'Есть защита от рекурсии render() → save() → render()');
  assertTrue(/function saveBoot\(/.test(code), 'Стартовые сохранения выделены в saveBoot() (без отката и без модального шума)');
  assertTrue(!/AF\.Store\.save\(state\);/.test(code.replace(/const res=AF\.Store\.save\(state\)|const r=AF\.Store\.save\(state\)/g, '')),
    'Нет вызовов AF.Store.save(state) с выброшенным результатом');
}

// ============ 2. Сканер: каждый вызов save() либо проверен, либо не заявляет успех ============
{
  const lines = code.split('\n');
  // признаки «успешного» продолжения сценария на той же строке после save()
  const successMarkers = [
    { re: /toast\(/, what: 'success-тост' },
    { re: /classList\.remove\('show'\)/, what: 'закрытие модального окна' },
    { re: /closeSheet\(\)/, what: 'закрытие формы операции' },
    { re: /closePin\(\)/, what: 'закрытие экрана ввода кода' },
  ];
  let checked = 0, unguardedSilent = 0;
  lines.forEach((raw, i) => {
    const line = raw;
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;      // комментарии
    if (!/\bsave\(\)/.test(line)) return;
    if (/ctx\.save\(\)/.test(line)) return;                                          // canvas API
    if (/function save\(\)/.test(line) || /function saveBoot\(/.test(line)) return;  // определения
    const guarded = /if\(!save\(\)\.ok\)/.test(line) || /(const|let|var)\s+\w+\s*=\s*save\(\)/.test(line);
    if (guarded) { checked++; return; }
    // не проверен — тогда на строке не должно быть заявления об успехе
    const after = line.slice(line.indexOf('save()') + 6);
    successMarkers.forEach(mk => {
      assertTrue(!mk.re.test(after),
        `Строка ${i + 1}: непроверенный save() не должен сопровождать ${mk.what} — ${t.slice(0, 90)}`);
    });
    unguardedSilent++;
  });
  assertTrue(checked >= 25, `Проверенных вызовов save() достаточно много (найдено ${checked})`);
  assertTrue(unguardedSilent > 0 && unguardedSilent < checked,
    `Непроверенные вызовы — только «тихие» настройки, их меньшинство (${unguardedSilent})`);
}

// ============ 3. Ключевые CRUD-пути ============
{
  const paths = [
    ['saveTx', /const res=save\(\);\s*\n\s*txSaving=false;\s*\n\s*if\(!res\.ok\)return;/, 'добавление/редактирование операции'],
    ['delTx', /state\.tx=state\.tx\.filter\(t=>t\.id!=editId\);\s*\n\s*if\(!save\(\)\.ok\)return;/, 'удаление операции'],
    ['saveBudget', /state\.budgets\[budCat\]=[^\n]*\n\s*if\(!save\(\)\.ok\)return;/, 'бюджет'],
    ['deleteBudget', /delete state\.budgets\[budEdit\];\s*\n\s*if\(!save\(\)\.ok\)return;/, 'удаление бюджета'],
    ['saveGoal', /state\.goals\.push\([^\n]*\n\s*if\(!save\(\)\.ok\)return;/, 'цель'],
    ['saveAcc', /state\.accounts\.push\(\{id:AF\.Ids\.forAccount\(state\)[^\n]*\n\s*\}\n\s*if\(!save\(\)\.ok\)return;/, 'счёт'],
    ['delAcc', /state\.accounts=state\.accounts\.filter\(a=>a\.id!==accEdit\);\s*\n\s*if\(!save\(\)\.ok\)return;/, 'удаление счёта'],
    ['archive', /a\.isArchived=!a\.isArchived;a\.updatedAt=Date\.now\(\);\s*\n\s*if\(!save\(\)\.ok\)return;/, 'архивирование счёта'],
    ['saveCat', /if\(!save\(\)\.ok\)\{renderCatMgr\(\);return;\}/, 'категория'],
    ['saveGroup', /state\.accountGroups\.push[^\n]*\n\s*if\(!save\(\)\.ok\)return;/, 'группа счетов'],
    ['saveReminder', /state\.reminders\.push\(Object\.assign[^\n]*\n\s*if\(!save\(\)\.ok\)return;/, 'напоминание'],
    ['importCSV', /added\.forEach\(t=>state\.tx\.push\(t\)\);[\s\S]{0,300}?if\(!save\(\)\.ok\)return;/, 'импорт CSV'],
    ['loadDemo', /if\(!save\(\)\.ok\)return;\s*\/\/ TASK_026: прежние данные/, 'демо-данные'],
    ['clearAll', /state\.cats=\[\];state\.subcats=\[\];state\.taxonomyVersion=0;seedCategories\(\);\s*\n\s*if\(!save\(\)\.ok\)return;/, 'полная очистка'],
  ];
  paths.forEach(([name, re, what]) => assertTrue(re.test(html), `Путь ${name} (${what}) не считает операцию выполненной без записи`));

  // success-тост «Расход добавлен ✓» физически недостижим при ошибке
  const saveTxBody = (html.match(/function saveTx\(\)\{[\s\S]*?\n\}/) || [''])[0];
  assertTrue(saveTxBody.indexOf('if(!res.ok)return;') < saveTxBody.indexOf('Расход добавлен'),
    'Проверка результата стоит РАНЬШЕ success-тоста «Расход добавлен ✓»');
  assertTrue(saveTxBody.indexOf('if(!res.ok)return;') < saveTxBody.indexOf('closeSheet()'),
    'Проверка результата стоит раньше закрытия формы — введённые данные не теряются');
  assertTrue(saveTxBody.indexOf('if(!res.ok)return;') < saveTxBody.indexOf('haptic(14)'),
    'Тактильный отклик «успешно» не срабатывает при ошибке записи');
}

// ============ 4. Двойное нажатие и повторная попытка ============
{
  const saveTxBody = (html.match(/function saveTx\(\)\{[\s\S]*?\n\}/) || [''])[0];
  assertTrue(/if\(!\$\('#overlay'\)\.classList\.contains\('show'\)\)return;/.test(saveTxBody),
    'Повторный клик по уже закрытой форме не создаёт вторую операцию');
  assertTrue(/if\(txSaving\|\|txCommitted\)return;/.test(saveTxBody),
    'Повторный вход в saveTx() и повторное сохранение уже сохранённой формы отсекаются');
  assertTrue(/let aTxId=null, txSaving=false, txCommitted=false;/.test(html),
    'Объявлены aTxId (id формы), txSaving и txCommitted (защита от двойного нажатия)');
  assertTrue(/txCommitted=true;\s*\/\/ защёлка/.test(saveTxBody),
    'После успешной записи форма защёлкивается: closeSheet() уходит через history.back() асинхронно, и второй клик успел бы создать дубликат');
  assertTrue(/aTxId=null;txCommitted=false;/.test(html), 'Защёлка снимается при открытии формы');
  assertTrue(/function newTxId\(\)\{ if\(!aTxId\)aTxId=AF\.Ids\.forTx\(state\); return aTxId; \}/.test(html),
    'id новой операции выдаётся один раз на форму — повтор после ошибки не плодит записи');
  assertTrue(/aTxId=null;txCommitted=false;\s*\/\/ TASK_026/.test(html), 'При открытии формы pending-id сбрасывается');
  assertTrue(/id:newTxId\(\),type:'transfer'/.test(html) && /id:newTxId\(\),type:aType/.test(html),
    'Обе ветки создания операции (перевод и доход/расход) используют фиксированный id формы');
}

// ============ 5. Сообщение об ошибке (UX) ============
{
  assertTrue(/function toastError\(m\)\{/.test(html), 'Сообщение об ошибке показывается общим механизмом тостов (второго не заведено)');
  const te = (html.match(/function toastError\(m\)\{[\s\S]*?\n\}/) || [''])[0];
  assertTrue(/classList\.add\('err','show'\)/.test(te), 'Ошибка использует заметный вариант тоста');
  assertTrue(/t\._t=null/.test(te), 'Сообщение об ошибке не исчезает само по таймеру');
  assertTrue(/t\.onclick=/.test(te), 'Сообщение об ошибке закрывается касанием');
  assertTrue(/\.toast\.err\{[^}]*background:#d92d20[^}]*color:#fff/.test(html), 'Ошибка читаема в обеих темах (белый на красном)');
  assertTrue(/\.toast\.err\{[^}]*env\(safe-area-inset-bottom/.test(html), 'Сообщение не перекрывает safe area и системные кнопки');
  assertTrue(/\.toast\.err\{[^}]*white-space:pre-line/.test(html), 'Длинное сообщение переносится, а не обрезается');
  const t = (html.match(/function toast\(m\)\{[\s\S]*?\n/) || [''])[0];
  assertTrue(/classList\.remove\('err'\)/.test(t), 'Обычный тост снимает класс ошибки — success не наследует красный вид');
}

// ============ 6. Контракт AF.Store.save() ============
{
  assertTrue(/QUOTA_EXCEEDED:\s*'QUOTA_EXCEEDED'/.test(store), 'Store объявляет код QUOTA_EXCEEDED');
  assertTrue(/SERIALIZATION_FAILED:\s*'SERIALIZATION_FAILED'/.test(store), 'Store объявляет код SERIALIZATION_FAILED');
  assertTrue(/STORAGE_FAILED:\s*'STORAGE_FAILED'/.test(store), 'Store объявляет код STORAGE_FAILED');
  assertTrue(/AF\.Result\.err\(\{ code, message/.test(store), 'Используется существующий контракт AF.Result, а не второй формат');
  assertTrue(/function isQuotaError/.test(store), 'Есть распознавание браузерных вариантов переполнения квоты');
  assertTrue(/NS_ERROR_DOM_QUOTA_REACHED/.test(store) && /e\.code === 22/.test(store) && /e\.code === 1014/.test(store),
    'Учтены варианты Chrome/Safari/Firefox и legacy-коды');
  assertTrue(/function rollback\(state, json\)/.test(store), 'Store предоставляет откат состояния');
  assertTrue(/Object\.keys\(state\)\.forEach\(k => \{ delete state\[k\]; \}\)/.test(store),
    'Откат выполняется внутрь того же объекта (ссылки замыканий остаются валидными)');
  assertTrue(/const SCHEMA_VERSION = 3;/.test(store), 'SCHEMA_VERSION не изменён (остаётся 3)');
}

// ============ 7. Генерация id (M-8) ============
{
  assertTrue(!/\bid:Date\.now\(\)/.test(html), 'В index.html не осталось id:Date.now() (операции)');
  assertTrue(!/id:'[a-z]+'\+Date\.now\(\)/.test(html), 'Не осталось id вида «префикс + Date.now()»');
  assertTrue(!/Date\.now\(\)\+Math\.random\(\)/.test(code), 'Не осталось id вида Date.now()+Math.random()');
  assertTrue(!/id:'s'\+Date\.now\(\)\.toString\(36\)/.test(html), 'Подкатегории больше не используют timestamp как id');
  assertTrue(/<script src="js\/core\/ids\.js"><\/script>/.test(html), 'Генератор id подключён в index.html');
  ['forTx', 'forAccount', 'forAccountGroup', 'forCategory', 'forSubcategory', 'forGoal', 'forReminder']
    .forEach(fn => assertTrue(new RegExp('AF\\.Ids\\.' + fn + '\\(state\\)').test(html), `Используется AF.Ids.${fn}()`));
  assertTrue(/const usedTxIds=new Set/.test(html) && /AF\.Ids\.unique\(AF\.Ids\.PREFIX\.tx,usedTxIds\)/.test(html),
    'Импорт CSV проверяет уникальность id и против существующих операций, и внутри пачки');
  assertTrue(/let nid=Date\.now\(\)/.test(html) === false, 'processAutoPost() больше не стартует счётчик от Date.now()');
  assertTrue(/state\.tx\.push\(\{id:AF\.Ids\.forTx\(state\),type:r\.type/.test(html), 'Авто-операции получают id из общего генератора');
}

// ============ 8. Импорт и восстановление копии ============
{
  assertTrue(/function importJSON\(d\)\{/.test(html), 'Импорт JSON вынесен в отдельную функцию');
  const imp = (html.match(/function importJSON\(d\)\{[\s\S]*?\n\}/) || [''])[0];
  assertTrue(/const next=Object\.assign\(\{\},state,d\)/.test(imp), 'Импортируемая база собирается отдельно от текущего состояния');
  assertTrue(imp.indexOf('AF.Store.save(next)') < imp.indexOf('state=next'), 'Состояние подменяется только ПОСЛЕ успешной записи');
  assertTrue(/if\(!w\.ok\)\{[\s\S]*?return false;/.test(imp), 'При отказе записи импорт не считается успешным');
  assertTrue(/dedupeIds\(next\.tx/.test(imp) && /dedupeIds\(next\.accounts/.test(imp) && /dedupeIds\(next\.cats/.test(imp),
    'Повторяющиеся id в импортируемых коллекциях перевыдаются (импорт не затирает сущность с тем же id)');
  assertTrue(!/state=Object\.assign\(state,d\)/.test(code), 'Старая подмена состояния до записи удалена');

  const rest = (html.match(/function doBackupRestore\(text\)\{[\s\S]*?\n\}/) || [''])[0];
  assertTrue(rest.indexOf('AF.Store.save(next)') < rest.indexOf('state=next'),
    'Восстановление копии: запись раньше подмены состояния — прежняя база не разрушается');
  assertTrue(/if\(!w\.ok\)\{/.test(rest), 'Восстановление копии проверяет результат записи');
  assertTrue(!/state=res\.value;AF\.Store\.save\(state\)/.test(code), 'Прежний порядок «подменить, потом писать» удалён');
}

// ============ 9. Math.min(...) на неограниченных массивах (M-10) ============
{
  assertTrue(/function minOf\(arr,init\)\{/.test(html) && /function maxOf\(arr,init\)\{/.test(html),
    'Добавлены итеративные minOf/maxOf');
  assertTrue(!/Math\.min\(\.\.\.ds\)/.test(html) && !/Math\.min\(\.\.\.dates\)/.test(html),
    'Раскладывание массива дат в аргументы Math.min() убрано (RangeError на большой истории)');
  assertTrue(/new Date\(minOf\(ds\)\)/.test(html), 'График капитала использует minOf()');
  assertTrue(/const minD=dates\.length\?minOf\(dates\):Date\.now\(\)/.test(html), 'Статистика использует minOf()');
  assertTrue(/if\(v!==v\)return NaN/.test(html),
    'Семантика NaN сохранена в точности (исправление H-6 — задача TASK_027, здесь не смешивается)');
}

// ============ 10. Версия кэша и состав ассетов ============
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m, 'Версия кэша найдена в sw.js');
  assertTrue(m && Number(m[1]) >= 168, `Версия кэша поднята (сейчас finance-v${m && m[1]})`);
  assertTrue(/'\.\/js\/core\/ids\.js'/.test(sw), 'Новый файл js/core/ids.js добавлен в офлайн-кэш');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
