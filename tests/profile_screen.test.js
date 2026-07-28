// tests/profile_screen.test.js — тесты для TASK_021 (отдельный экран «Профиль»
// в Apple-стиле + перенос пункта «Безопасность» из боковой шторки в профиль).
//
// Задача чисто интерфейсная: новых чистых функций она не вводит, поэтому
// проверки статические — regex по index.html и sw.js (тот же приём, что §4
// tests/analytics_screen.test.js и §7 tests/demo_data_service.test.js):
//  1. Состав экрана «Профиль»: шапка «Назад» + заголовок, карточка с фото и
//     именем, «Сменить фото», секция «Защита» с единственным пунктом.
//  2. Отсутствие общих настроек на экране профиля (они остаются в шторке).
//  3. Боковая шторка: пункта «Безопасность» больше нет, остальные — на месте.
//  4. Отсутствие «висячих» обращений к удалённым элементам (иначе TypeError
//     на старте приложения — самый вероятный класс регресса такой задачи).
//  5. Сохранность механизма фото/имени и экрана безопасности.
//  6. Версия кэша service worker поднята.
// Запуск: node tests/profile_screen.test.js

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

let passed = 0, failed = 0;
function assertTrue(cond, msg) {
  if (cond) { passed++; } else { failed++; console.error(`FAIL: ${msg}`); }
}
function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { passed++; }
  else { failed++; console.error(`FAIL: ${msg}\n  expected: ${e}\n  actual:   ${a}`); }
}

// Вырезаем разметку экрана профиля и боковой шторки, чтобы проверки
// «есть внутри профиля» / «нет внутри шторки» не путались друг с другом.
function block(startRe, label) {
  const m = html.match(startRe);
  assertTrue(!!m, `${label}: блок найден в index.html`);
  if (!m) return '';
  // от начала блока до следующего HTML-комментария верхнего уровня
  const from = m.index;
  const rest = html.slice(from + m[0].length);
  const end = rest.search(/\n<!--/);
  return html.slice(from, end === -1 ? html.length : from + m[0].length + end);
}

const profBlock = block(/<div class="overlay prof-ov" id="profOverlay">/, 'Экран «Профиль»');
const drawerBlock = block(/<div class="overlay drawer-ov" id="drawerOverlay">/, 'Боковая шторка');

// ============ §1 — состав экрана «Профиль» ============
{
  assertTrue(/class="prof-page"/.test(profBlock),
    'Профиль — полноэкранный контейнер .prof-page (не нижняя шторка .modal)');
  assertTrue(!/<div class="modal">/.test(profBlock),
    'Профиль больше не использует общий .modal (нижнюю модальную шторку)');
  assertTrue(/<button class="prof-back" id="profClose" aria-label="Назад">/.test(profBlock),
    'Профиль: Apple-кнопка «Назад» (#profClose) с aria-label');
  assertTrue(/<span>Назад<\/span>/.test(profBlock),
    'Профиль: у кнопки «Назад» есть текстовая подпись');
  assertTrue(/<div class="prof-title">Профиль<\/div>/.test(profBlock),
    'Профиль: заголовок «Профиль» в шапке');
  assertTrue(/id="profAvatar"/.test(profBlock) && /class="prof-ava"/.test(profBlock),
    'Профиль: крупный круглый аватар (#profAvatar внутри .prof-ava)');
  assertTrue(/id="profName"[^>]*class="prof-name-in"/.test(profBlock),
    'Профиль: редактируемое поле имени (#profName)');
  assertTrue(/id="profName"[^>]*placeholder="A-Lex"/.test(profBlock),
    'Профиль: placeholder имени — «A-Lex»');
  assertTrue(/id="profName"[^>]*aria-label="Имя профиля"/.test(profBlock),
    'Профиль: у поля имени есть aria-label (доступность)');
  assertTrue(/id="changePhoto"/.test(profBlock) && /id="photoInput"/.test(profBlock),
    'Профиль: строка «Сменить фото» и существующий #photoInput на месте');
  assertTrue(/<span class="prof-lbl">Сменить фото<\/span>/.test(profBlock),
    'Профиль: подпись строки — «Сменить фото»');
  assertTrue(/id="profCamBtn" aria-label="Сменить фото"/.test(profBlock),
    'Профиль: кнопка-камера на аватаре с aria-label');
  assertTrue(/<div class="prof-group-title">Защита<\/div>/.test(profBlock),
    'Профиль: секция «Защита»');
  assertTrue(/<span class="prof-lbl">Безопасность<\/span>/.test(profBlock),
    'Профиль: пункт «Безопасность» в секции «Защита»');
  assertTrue(/id="profSecurity"/.test(profBlock),
    'Профиль: пункт «Безопасность» — #profSecurity');
  // единственный пункт в секции «Защита»
  const guard = profBlock.slice(profBlock.indexOf('prof-group-title'));
  assertEqual((guard.match(/class="prof-row"/g) || []).length, 1,
    'Секция «Защита» содержит ровно один пункт');
  // эмодзи в строках профиля больше нет — только SVG-иконки
  assertEqual((profBlock.match(/class="prof-ic"/g) || []).length, 2,
    'Профиль: две SVG-иконки в чипах (камера + щит), без эмодзи');
  assertTrue(!/📷|🔐|🔔|🎯|📅|❤️|📊|🌙|📤|⚙️/.test(profBlock),
    'Профиль: эмодзи в разметке экрана не осталось');
}

// ============ §2 — общих настроек на экране профиля нет ============
{
  const gone = ['profNotif', 'profNotifBadge', 'profGoals', 'profCalendar',
    'profHealth', 'profStats', 'profTheme', 'profThemeLbl', 'profExport', 'profMore'];
  gone.forEach(id => {
    assertTrue(!profBlock.includes(`id="${id}"`),
      `Профиль: пункта #${id} на экране больше нет (остаётся в боковой шторке)`);
  });
  ['Уведомления', 'Цели', 'Календарь', 'Финансовое здоровье', 'Статистика',
    'Экспорт и копии', 'Все настройки', 'тема'].forEach(lbl => {
    assertTrue(!profBlock.includes(lbl),
      `Профиль: раздела «${lbl}» на экране нет`);
  });
}

// ============ §3 — боковая шторка ============
{
  assertTrue(!drawerBlock.includes('id="drSecurity"'),
    'Шторка: пункт «Безопасность» (#drSecurity) удалён');
  assertTrue(!drawerBlock.includes('Безопасность'),
    'Шторка: подписи «Безопасность» больше нет');
  ['drCats', 'drGoals', 'drCalendar', 'drRecur', 'drHealth', 'drStats',
    'drNotif', 'drTheme', 'drExport', 'drMore'].forEach(id => {
    assertTrue(drawerBlock.includes(`id="${id}"`),
      `Шторка: пункт #${id} сохранён`);
  });
  assertTrue(drawerBlock.includes('id="drawerHead"'),
    'Шторка: карточка «Личный профиль» (#drawerHead) сохранена');
  assertTrue(/\$\('#drawerHead'\)\.onclick=\(\)=>\{closeDrawer\(\);openProfile\(\);\}/.test(html),
    'Шторка: карточка профиля открывает экран «Профиль» (openProfile)');
  // группа «Приложение»: было 5 пунктов и 4 разделителя, стало 4 и 3
  const appGroup = drawerBlock.slice(drawerBlock.indexOf('Приложение'));
  assertEqual((appGroup.match(/class="drawer-row"/g) || []).length, 4,
    'Шторка: в группе «Приложение» осталось 4 пункта');
  assertEqual((appGroup.match(/class="drawer-sep"/g) || []).length, 3,
    'Шторка: лишний разделитель после удалённого пункта тоже убран');
}

// ============ §4 — нет висячих обращений к удалённым элементам ============
{
  const dangling = ['profNotif', 'profNotifBadge', 'profGoals', 'profCalendar',
    'profHealth', 'profStats', 'profTheme', 'profThemeLbl', 'profExport',
    'profMore', 'drSecurity', 'prof-head', 'prof-badge'];
  dangling.forEach(id => {
    assertTrue(!html.includes(id),
      `Во всём index.html не осталось упоминаний «${id}» (иначе TypeError на старте)`);
  });
}

// ============ §5 — сохранены механизм фото/имени и экран безопасности ============
{
  assertTrue(/\$\('#changePhoto'\)\.onclick=\(\)=>\$\('#photoInput'\)\.click\(\);/.test(html),
    'Строка «Сменить фото» открывает существующий #photoInput');
  assertTrue(/\$\('#profCamBtn'\)\.onclick=\(\)=>\$\('#photoInput'\)\.click\(\);/.test(html),
    'Кнопка-камера открывает тот же #photoInput');
  assertTrue(/state\.avatar=cv\.toDataURL\('image\/jpeg',0\.85\);save\(\);renderHeader\(\);/.test(html),
    'Механизм сохранения фото (canvas 256px → state.avatar → save) не изменён');
  assertTrue(/\$\('#profName'\)\.oninput=e=>\{state\.profileName=e\.target\.value;\};/.test(html),
    'Имя по-прежнему пишется в state.profileName');
  assertTrue(/\$\('#profName'\)\.onchange=\(\)=>\{save\(\);renderHeader\(\);/.test(html),
    'Имя по-прежнему сохраняется и обновляет шапку');
  assertTrue(/\$\('#profSecurity'\)\.onclick=openSecurity;/.test(html),
    'Пункт «Безопасность» ведёт на существующий openSecurity()');
  assertTrue(/id="securityOverlay"/.test(html) && /function renderSecurity\(\)/.test(html),
    'Экран «Безопасность» и его рендер сохранены (перенесена только точка входа)');
  // TASK_023 добавила в тело openSecurity() тихую проверку доступности биометрии,
  // поэтому проверяется не дословный текст функции, а её инвариант из TASK_021:
  // профиль под экраном безопасности НЕ закрывается.
  {
    const m = html.match(/function openSecurity\(\)\{[^}]*\}/);
    assertTrue(!!m, 'openSecurity() найдена');
    assertTrue(!!m && /renderSecurity\(\)/.test(m[0]) && /\$\('#securityOverlay'\)\.classList\.add\('show'\)/.test(m[0]),
      'openSecurity() рендерит экран безопасности и показывает его');
    assertTrue(!!m && !/profOverlay/.test(m[0]),
      'openSecurity() не закрывает профиль — возврат назад ведёт обратно на профиль');
  }
  assertEqual((html.match(/\.onclick=openSecurity|drGo\(openSecurity\)/g) || []).length, 1,
    'Единственная точка входа в «Безопасность» — пункт профиля');
  assertTrue(/'#profOverlay'/.test(html) && html.includes("'#profOverlay',"),
    'Профиль остаётся в списке слоёв, закрываемых по Escape');
}

// ============ §6 — версия кэша service worker поднята ============
{
  const m = sw.match(/const CACHE = 'finance-v(\d+)'/);
  assertTrue(!!m, 'sw.js: версия кэша распознана');
  assertTrue(m && Number(m[1]) >= 164,
    'sw.js: версия кэша поднята до finance-v164 или выше (TASK_021)');
}

// ============ §7 — отсутствие регресса класса TASK_018 ($$(...) как массив) ============
{
  assertTrue(!/\$\$\([^)]*\)\.(map|find|filter|reduce)\(/.test(html),
    'Нет прямых .map()/.find()/.filter()/.reduce() на NodeList из $$() (регресс TASK_018)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
