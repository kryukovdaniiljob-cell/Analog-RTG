'use strict';
/* Подбор аналогов РТГ. Логика своя, оформление mini-ahu. */

const ПОРЦИЯ = 100;
let D = null, P = [], найдено = [], показано = 0;
let дубНайдено = [], дубПоказано = 0;
let открыта = -1;

const $ = id => document.getElementById(id);
const норм = s => (s || '').toLowerCase().replace(/ё/g, 'е');
const эк = s => String(s).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ссылка = k => 'https://www.rusklimat.ru/search/?q=' + encodeURIComponent(k);

/* ---------- загрузка */
fetch('data.json?v=1').then(r => r.json()).then(d => {
  D = d; P = d.p;
  // строка для поиска склеивается один раз: фильтр по 5886 позициям
  // на каждое нажатие клавиши должен быть мгновенным
  P.forEach(r => r.push(норм([r[0], r[1], D.б[r[2]], D.к[r[5]]].join(' '))));
  // поисковая строка встала на место 10: девятое теперь периметр
  $('stamp').textContent = 'данные на ' + d.дата;
  $('footer-txt').textContent =
    'Позиций ' + P.length.toLocaleString('ru') + ' · замена найдена у ' +
    P.filter(r => r[7] >= 0).length.toLocaleString('ru') + ' · дублей ' +
    d.d.length.toLocaleString('ru') + ' · данные на ' + d.дата;
  заполнить($('f-пер'), D.п.map((v, i) => [i, v]));
  заполнить($('f-напр'), направленияДля());
  заполнить($('f-бренд'), брендыДля());
  отбор(); дубОтбор();
}).catch(e => {
  $('итог').textContent = 'Не удалось загрузить data.json: ' + e.message;
});

function заполнить(sel, пары, подпись) {
  const было = sel.value;
  sel.innerHTML = '<option value="">' + (подпись || 'все') + '</option>' +
    пары.map(([i, v]) => '<option value="' + i + '">' + эк(v) + '</option>').join('');
  if (пары.some(([i]) => String(i) === было)) sel.value = было;
  sel.disabled = !пары.length;
}

/* ---------- каскад: следующий список зависит от выбранного выше */
function подходит(r, уровень) {
  const п = $('f-пер').value, н = $('f-напр').value,
        г = $('f-груп').value, к = $('f-кат').value;
  if (уровень >= 1 && п !== '' && r[9] != п) return false;
  if (уровень >= 2 && н !== '' && r[3] != н) return false;
  if (уровень >= 3 && г !== '' && r[4] != г) return false;
  if (уровень >= 4 && к !== '' && r[5] != к) return false;
  return true;
}
const собрать1 = (поле, словарь, уровень) => {
  const s = new Set();
  P.forEach(r => { if (подходит(r, уровень)) s.add(r[поле]); });
  return [...s].map(i => [i, словарь[i]]).sort((a, b) => a[1].localeCompare(b[1], 'ru'));
};
const направленияДля = () => собрать1(3, D.н, 1);
const группыДля = () => собрать1(4, D.г, 2);
const категорииДля = () => собрать1(5, D.к, 3);
const брендыДля = () => собрать1(2, D.б, 4);

/* Периметр стоит первым уровнем: у Даниила сантехника, у Руфины климат и
   арматура, направления у них разные, и показывать чужие незачем. */
function каскад(с_уровня) {
  if (с_уровня <= 1) заполнить($('f-напр'), направленияДля());
  if (с_уровня <= 2) заполнить($('f-груп'), группыДля());
  if (с_уровня <= 3) заполнить($('f-кат'), категорииДля());
  заполнить($('f-бренд'), брендыДля());
}

/* ---------- отбор */
function отбор() {
  const сл = норм($('q').value.trim()).split(/\s+/).filter(Boolean);
  const п = $('f-пер').value, н = $('f-напр').value, г = $('f-груп').value,
        к = $('f-кат').value, б = $('f-бренд').value, з = $('f-зам').value;
  найдено = P.filter(r => {
    for (const w of сл) if (!r[10].includes(w)) return false;
    if (п !== '' && r[9] != п) return false;
    if (н !== '' && r[3] != н) return false;
    if (г !== '' && r[4] != г) return false;
    if (к !== '' && r[5] != к) return false;
    if (б !== '' && r[2] != б) return false;
    if (з === 'есть' && r[7] < 0) return false;
    if (з === 'нет' && r[7] >= 0) return false;
    if (з === 'чужой' && !чужой(r)) return false;
    return true;
  });
  показано = 0; $('список').innerHTML = шапка(); добавить();
  $('итог').textContent = 'Найдено позиций: ' + найдено.length.toLocaleString('ru') +
    ' из ' + P.length.toLocaleString('ru');
  крошки();
}
const чужой = r => (r[7] >= 0 && P[r[7]][2] !== r[2]) || (r[8] >= 0 && P[r[8]][2] !== r[2]);

function шапка() {
  return '<div class="head"><span>НС-код</span><span>Наименование</span>' +
    '<span>Характеристики</span><span>Замена</span><span></span></div>';
}
function добавить() {
  const ч = найдено.slice(показано, показано + ПОРЦИЯ);
  $('список').insertAdjacentHTML('beforeend', ч.map(строка).join(''));
  показано += ч.length;
  $('ещё').style.display = показано < найдено.length ? 'block' : 'none';
}
const спекСтрокой = r => r[6].map(([k, v]) => {
  const имя = D.поля[k];
  if (имя === 'Диаметр, мм') return 'Ø' + v;
  if (имя === 'Диаметр 2, мм') return 'Ø2 ' + v;
  if (имя === 'Диаметр 3, мм') return 'Ø3 ' + v;
  if (имя === 'Толщина стенки, мм') return 'ст.' + v;
  if (имя === 'DN') return 'DN' + v;
  if (имя === 'Угол, град') return v + '°';
  if (имя === 'Тонкость, мкм') return v + ' мкм';
  if (имя === 'Размерность' || имя === 'Артикул') return '';
  if (имя === 'Резьба 1' || имя === 'Резьба 2' ||
      имя === 'Исполнение резьбы' || имя === 'Материал' || имя === 'Цвет') return v;
  return имя.replace(/,.*/, '') + ' ' + v;
}).filter(Boolean).join(' · ');

function замена(r) {
  if (r[7] < 0) return '<span class="none">нет</span>';
  const a = P[r[7]], свой = a[2] === r[2];
  return '<span class="repl__name">' + эк(a[1]) + '</span>' +
    '<span class="tag ' + (свой ? 'tag--own">свой' : 'tag--other">другой') + ' бренд</span>' +
    '<div class="repl__brand">' + эк(D.б[a[2]]) + '</div>';
}
function строка(r) {
  const i = P.indexOf(r);
  return '<div class="row' + (i === открыта ? ' is-open' : '') + '" data-i="' + i + '">' +
    '<div class="code">' + эк(r[0]) + '</div>' +
    '<div><div class="name">' + эк(r[1]) + '</div>' +
      '<div class="sub">' + эк(D.б[r[2]]) + ' · ' + эк(D.к[r[5]]) + '</div></div>' +
    '<div class="spec">' + (спекСтрокой(r) || '<span class="none">нет данных</span>') + '</div>' +
    '<div class="repl">' + замена(r) + '</div>' +
    '<div><a class="link" href="' + ссылка(r[0]) + '" target="_blank" rel="noopener">карточка</a></div>' +
    '</div>';
}

/* ---------- крошки выбранного разреза */
function крошки() {
  const ч = [];
  const пары = [['f-пер', D.п, 'Периметр'], ['f-напр', D.н, 'Направление'],
                ['f-груп', D.г, 'Группа'],
                ['f-кат', D.к, 'Категория'], ['f-бренд', D.б, 'Бренд']];
  пары.forEach(([id, сл, подпись]) => {
    const v = $(id).value;
    if (v !== '') ч.push('<span class="crumb">' + подпись + ': <b>' + эк(сл[v]) +
      '</b><button type="button" data-clear="' + id + '" aria-label="Убрать">×</button></span>');
  });
  const з = $('f-зам');
  if (з.value) ч.push('<span class="crumb">Замена: <b>' +
    эк(з.options[з.selectedIndex].text) + '</b><button type="button" data-clear="f-зам" aria-label="Убрать">×</button></span>');
  $('crumbs').innerHTML = ч.join('');
}

/* ---------- карточка сравнения */
function карточка(i) {
  const r = P[i];
  const ряд = [r, r[7] >= 0 ? P[r[7]] : null, r[8] >= 0 ? P[r[8]] : null].filter(Boolean);
  const карта = ряд.map(x => new Map(x[6].map(([k, v]) => [D.поля[k], v])));
  const поля = [];
  D.поля.forEach(п => { if (карта.some(m => m.has(п))) поля.push(п); });
  const заг = ['Выбранная позиция', 'Замена 1', 'Замена 2'].slice(0, ряд.length);
  let h = '<div class="card"><div class="card__top">' +
    '<span class="card__ttl">Сравнение характеристик</span>' +
    '<button class="btn btn--ghost" type="button" id="закрыть">Закрыть</button></div>' +
    '<table class="cmp"><thead><tr><th></th>' +
    ряд.map((x, j) => '<th>' + заг[j] + '<div class="sub">' + эк(D.б[x[2]]) + '</div></th>').join('') +
    '</tr><tr><th>Наименование</th>' +
    ряд.map(x => '<td><div class="name">' + эк(x[1]) + '</div></td>').join('') +
    '</tr></thead><tbody>' +
    /* НС-код отдельной строкой: внутри наименования его было не найти
       глазом, а именно по нему и ищут позицию в 1С. */
    '<tr><th>НС-код</th>' +
    ряд.map(x => '<td class="v same"><b>' + эк(x[0]) + '</b>' +
      ' <a class="link" href="' + ссылка(x[0]) + '" target="_blank" rel="noopener">карточка</a></td>').join('') +
    '</tr>';
  поля.forEach(п => {
    const б = карта[0].get(п);
    h += '<tr><th>' + эк(п) + '</th>' + карта.map((m, j) => {
      const v = m.get(п);
      if (v === undefined) return '<td class="v miss">нет</td>';
      // Артикул у разных товаров разный всегда, и подсветка его как
      // расхождения только сбивает: отличие там не содержательное.
      const кл = (j === 0 || п === 'Артикул') ? 'same'
        : (String(v) === String(б) ? 'same' : 'diff');
      return '<td class="v ' + кл + '">' + эк(v) + '</td>';
    }).join('') + '</tr>';
  });
  h += '</tbody></table><p class="card__note">Жёлтым отмечено то, что отличается от ' +
    'выбранной позиции. Все размеры присоединения у замены совпадают: несовпадение ' +
    'любого из них отбраковывает кандидата.</p></div>';
  $('карточка').innerHTML = h;
  $('закрыть').addEventListener('click', () => {
    открыта = -1; $('карточка').innerHTML = '';
    document.querySelectorAll('.row.is-open').forEach(e => e.classList.remove('is-open'));
  });
}

/* ---------- дубли */
function дубОтбор() {
  const сл = норм($('qd').value.trim()).split(/\s+/).filter(Boolean);
  const п = $('f-пер') ? $('f-пер').value : '';
  дубНайдено = D.d.filter(x => {
    if (п !== '' && x[5] != п) return false;
    const t = норм(x.slice(0, 5).join(' '));
    for (const w of сл) if (!t.includes(w)) return false;
    return true;
  });
  дубПоказано = 0;
  $('список-д').innerHTML =
    '<div class="head"><span>Бренд</span><span>Позиция 1</span><span>Позиция 2</span></div>'
      .replace('class="head"', 'class="head" style="grid-template-columns:180px minmax(0,1fr) minmax(0,1fr)"');
  дубДобавить();
  $('итог-д').textContent = 'Найдено пар: ' + дубНайдено.length.toLocaleString('ru') +
    ' из ' + D.d.length.toLocaleString('ru');
}
function дубДобавить() {
  const ч = дубНайдено.slice(дубПоказано, дубПоказано + ПОРЦИЯ);
  $('список-д').insertAdjacentHTML('beforeend', ч.map(x =>
    '<div class="row" style="grid-template-columns:180px minmax(0,1fr) minmax(0,1fr);cursor:default">' +
    '<div class="sub">' + эк(x[4]) + '</div>' +
    '<div><div class="name">' + эк(x[1]) + '</div><div class="code">' + эк(x[0]) + '</div></div>' +
    '<div><div class="name">' + эк(x[3]) + '</div><div class="code">' + эк(x[2]) + '</div></div>' +
    '</div>').join(''));
  дубПоказано += ч.length;
  $('ещё-д').style.display = дубПоказано < дубНайдено.length ? 'block' : 'none';
}

/* ---------- события */
$('q').addEventListener('input', отбор);
$('f-пер').addEventListener('change', () => { каскад(1); отбор(); дубОтбор(); });
$('f-напр').addEventListener('change', () => { каскад(2); отбор(); });
$('f-груп').addEventListener('change', () => { каскад(3); отбор(); });
$('f-кат').addEventListener('change', () => { каскад(4); отбор(); });
$('f-бренд').addEventListener('change', отбор);
$('f-зам').addEventListener('change', отбор);
$('сброс').addEventListener('click', () => {
  ['q', 'f-пер', 'f-напр', 'f-груп', 'f-кат', 'f-бренд', 'f-зам'].forEach(id => $(id).value = '');
  открыта = -1; $('карточка').innerHTML = '';
  каскад(1); отбор();
});
$('crumbs').addEventListener('click', e => {
  const b = e.target.closest('[data-clear]');
  if (!b) return;
  $(b.dataset.clear).value = '';
  каскад(1); отбор();
});
$('список').addEventListener('click', e => {
  if (e.target.closest('a')) return;
  const row = e.target.closest('.row');
  if (!row) return;
  const i = +row.dataset.i;
  if (i === открыта) { открыта = -1; $('карточка').innerHTML = ''; row.classList.remove('is-open'); return; }
  открыта = i;
  document.querySelectorAll('.row.is-open').forEach(el => el.classList.remove('is-open'));
  row.classList.add('is-open');
  карточка(i);
  $('карточка').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
$('ещё').addEventListener('click', добавить);
$('qd').addEventListener('input', дубОтбор);
$('ещё-д').addEventListener('click', дубДобавить);
$('burger').addEventListener('click', () => {
  const n = $('nav'), o = n.classList.toggle('is-open');
  $('burger').setAttribute('aria-expanded', o ? 'true' : 'false');
});
document.querySelectorAll('.nav__link').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav__link').forEach(x => x.classList.remove('is-active'));
    a.classList.add('is-active');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('is-active'));
    $('tab-' + a.dataset.tab).classList.add('is-active');
    $('nav').classList.remove('is-open');
    window.scrollTo(0, 0);
  });
});
