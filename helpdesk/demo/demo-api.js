// IT Help Desk — демо-версия без сервера.
// Перехватывает запросы фронтенда к /api/* и отвечает так же, как server.js,
// на вымышленных данных. Изменения хранятся в localStorage браузера посетителя.
(function () {
  'use strict';

  var STORE_KEY = 'hd_demo_db_v1';
  var DEFAULT_USER = 'ivanova_ea';

  // Режим симуляции входа (переключатель пользователей) нужен демо всегда.
  try {
    var url = new URL(window.location.href);
    if (url.searchParams.get('sim') !== '1') {
      url.searchParams.set('sim', '1');
      history.replaceState(null, '', url.toString());
    }
    if (!localStorage.getItem('simulated_kerberos_user')) {
      localStorage.setItem('simulated_kerberos_user', DEFAULT_USER);
    }
  } catch (_) {}

  // ---------- Вымышленные данные ----------
  var USERS = [
    { id: 1, username: 'ivanova_ea', full_name: 'Иванова Елена Андреевна', email: 'ivanova@demo-proekt.ru', phone: '1041', position: 'Инженер-проектировщик', department: 'Архитектурный отдел', role: 'usr', cabinet: '3 этаж, каб. 312' },
    { id: 2, username: 'sidorov_mv', full_name: 'Сидоров Максим Викторович', email: 'sidorov@demo-proekt.ru', phone: '1012', position: 'Главный инженер проекта', department: 'Отдел ГИП', role: 'usr', cabinet: '2 этаж, каб. 205' },
    { id: 3, username: 'kuznetsova_on', full_name: 'Кузнецова Ольга Николаевна', email: 'kuznetsova@demo-proekt.ru', phone: '1077', position: 'Ведущий инженер', department: 'Отдел электроснабжения', role: 'usr', cabinet: '4 этаж, каб. 407' },
    { id: 4, username: 'volkov_ip', full_name: 'Волков Игорь Павлович', email: 'volkov@demo-proekt.ru', phone: '1150', position: 'Инженер-сметчик', department: 'Сметный отдел', role: 'usr', cabinet: '2 этаж, каб. 218' },
    { id: 5, username: 'orlov_dv', full_name: 'Орлов Дмитрий Владимирович', email: 'orlov@demo-proekt.ru', phone: '3031', position: 'IT-специалист', department: 'Отдел информационных технологий', role: 'adm', cabinet: '1 этаж, каб. 104' },
    { id: 6, username: 'belov_as', full_name: 'Белов Артём Сергеевич', email: 'belov@demo-proekt.ru', phone: '3032', position: 'Системный администратор', department: 'Отдел информационных технологий', role: 'adm', cabinet: '1 этаж, каб. 104' },
    { id: 7, username: 'smirnova_tv', full_name: 'Смирнова Татьяна Викторовна', email: 'smirnova@demo-proekt.ru', phone: '1001', position: 'Заместитель директора', department: 'Дирекция', role: 'wtch', cabinet: '5 этаж, каб. 501' },
  ];

  var CATEGORIES = [
    'ПК и оргтехника', 'Сеть и интернет', 'Доступы и учетные записи',
    'Программное обеспечение (ПО)', 'САПР и лицензии', 'Принтеры и МФУ', 'Телефония', 'Портал',
  ];

  // [дней назад, часов, категория, приоритет, статус, инициатор, исполнитель, тема, описание, комментарии]
  var SEED = [
    [0, 1, 3, 'high', 'created', 1, null, 'Доступ к папке заказчика', 'Нужен доступ на чтение к папке «Исходные данные» по объекту КНГ.047-26.', []],
    [0, 2, 1, 'medium', 'created', 4, null, 'Не включается второй монитор', 'После переезда в другой кабинет второй монитор не включается, индикатор не горит.', []],
    [0, 4, 4, 'low', 'created', 2, null, 'Установить архиватор 7-Zip', 'Не открываются архивы .7z с документацией от заказчика.', []],
    [0, 6, 5, 'urgent', 'created', 3, null, 'Не запускается AutoCAD', 'После обновления Windows AutoCAD закрывается сразу при запуске. Сдаём раздел ЭС завтра, очень срочно.', []],
    [0, 11, 2, 'high', 'in_progress', 1, 5, 'Нет доступа к сетевому диску проектов', 'Не открывается папка проекта УНГ.118-26 на диске Z:, пишет «Отказано в доступе».', [[5, 'Проверяю права на папку, отпишусь через 15 минут.']]],
    [1, 14, 6, 'medium', 'in_progress', 4, 6, 'МФУ на 2 этаже печатает полосами', 'Канон в коридоре 2 этажа печатает с серыми полосами по всему листу.', [[6, 'Заказали новый тонер-картридж, пока печатайте на МФУ в 205.']]],
    [1, 10, 3, 'high', 'resolved', 2, 5, 'Новый сотрудник в отделе ГИП', 'С понедельника выходит новый ГИП, нужна учётная запись, почта и доступ к проектам.', [[5, 'Учётная запись создана, данные для входа переданы руководителю.']]],
    [2, 16, 4, 'low', 'pending', 1, 6, 'Установить Adobe Acrobat', 'Нужен Acrobat для подписания и сборки томов в PDF.', [[6, 'Ждём согласования лицензии от руководства.']]],
    [3, 9, 1, 'medium', 'resolved', 3, 6, 'Медленно работает компьютер', 'Компьютер очень долго загружается, тормозит при открытии чертежей.', [[6, 'Заменили HDD на SSD, добавили 16 ГБ памяти.'], [3, 'Спасибо, летает!']]],
    [3, 13, 7, 'low', 'resolved', 4, 5, 'Не работает внутренний телефон', 'Нет гудка на телефоне в каб. 218.', [[5, 'Переобжали кабель, телефон работает.']]],
    [4, 10, 5, 'high', 'resolved', 2, 5, 'Слетела лицензия nanoCAD', 'При запуске nanoCAD пишет, что лицензия недействительна.', [[5, 'Перепривязали лицензию на сервере лицензий.']]],
    [5, 15, 2, 'medium', 'rejected', 1, 6, 'Доступ к YouTube', 'Прошу открыть доступ к YouTube для обучающих видео по Revit.', [[6, 'Доступ к видеохостингам ограничен политикой компании. Обучающие видео можно запросить у отдела BIM.']]],
    [6, 11, 1, 'medium', 'resolved', 4, 6, 'Второй монитор', 'Для работы со сметами нужен второй монитор.', [[6, 'Монитор установлен.']]],
    [7, 9, 4, 'high', 'resolved', 3, 5, 'Ошибка при открытии Excel', 'Excel выдаёт ошибку при открытии реестра чертежей с макросами.', [[5, 'Включили доверенное расположение для папки реестров.']]],
    [8, 12, 3, 'medium', 'resolved', 1, 5, 'Сброс пароля', 'Забыла пароль после отпуска, не могу войти.', [[5, 'Пароль сброшен, при входе задайте новый.']]],
    [9, 10, 6, 'low', 'resolved', 2, 6, 'Сканирование в папку', 'Настроить сканирование с МФУ в мою сетевую папку.', []],
    [11, 14, 5, 'medium', 'resolved', 4, 5, 'Установить СПДС-модуль', 'Нужен модуль СПДС для оформления чертежей по ГОСТ.', [[5, 'Модуль установлен и активирован.']]],
    [12, 9, 2, 'urgent', 'resolved', 3, 6, 'Пропал интернет в отделе', 'Во всём отделе электроснабжения нет интернета и почты.', [[6, 'Заменили коммутатор на 4 этаже, связь восстановлена.']]],
    [14, 16, 1, 'low', 'resolved', 1, 6, 'Не работает мышь', 'Мышь периодически перестаёт реагировать.', [[6, 'Заменили на новую.']]],
    [17, 11, 4, 'medium', 'resolved', 2, 5, 'Обновить Microsoft Project', 'Нужна версия Project, которая открывает файлы графиков заказчика.', []],
    [21, 10, 3, 'medium', 'resolved', 4, 5, 'Доступ к порталу закупок', 'Нужен доступ к порталу закупок для загрузки смет.', [[5, 'Доступ выдан.']]],
  ];

  function iso(daysAgo, hour, minuteOffset) {
    var d = new Date();
    if (daysAgo === 0) {
      // Сегодняшние заявки: «hour» — сколько получасов назад, чтобы время не оказалось в будущем
      return new Date(d.getTime() - hour * 30 * 60000 + (minuteOffset || 0) * 60000 * 0.1).toISOString();
    }
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, (minuteOffset || 0) % 60, 0, 0);
    return d.toISOString();
  }

  function buildSeed() {
    var db = { users: USERS, categories: [], tickets: [], comments: [], history: [], attachments: [], seq: { ticket: 0, comment: 0, history: 0, category: 0 } };
    CATEGORIES.forEach(function (name) {
      db.categories.push({ id: ++db.seq.category, name: name, is_active: 1 });
    });
    var year = new Date().getFullYear();
    var number = 120;
    // Старые заявки первыми, чтобы номера шли по порядку
    SEED.slice().reverse().forEach(function (s) {
      var created = iso(s[0], s[1]);
      var id = ++db.seq.ticket;
      number += 1 + (id % 3);
      var t = {
        id: id, ticket_number: 'HD-' + year + '-' + String(number).padStart(4, '0'),
        title: s[7], description: s[8], category_id: s[2], priority: s[3], status: s[4],
        initiator_id: s[5], assignee_id: s[6], idempotency_key: 'seed-' + id,
        created_at: created, updated_at: created, closed_at: null,
      };
      db.tickets.push(t);
      var initiator = userById(s[5]);
      addHistory(db, id, s[5], 'Создана', 'Заявка зарегистрирована инициатором ' + initiator.full_name + ' с приоритетом "' + s[3] + '".', created);
      // События заявки идут после её создания, но не позже текущего момента
      var base = new Date(created).getTime();
      var at = function (minutes) { return new Date(Math.min(base + minutes * 60000, Date.now() - 60000)).toISOString(); };
      if (s[6] && s[4] !== 'created') {
        var spec = userById(s[6]);
        addHistory(db, id, s[6], 'В работе', 'Специалист ' + spec.full_name + ' взял заявку в работу.', at(20));
      }
      s[9].forEach(function (c, i) {
        var when = at(45 + i * 50);
        db.comments.push({ id: ++db.seq.comment, ticket_id: id, author_id: c[0], content: c[1], created_at: when });
        addHistory(db, id, c[0], 'Комментарий', userById(c[0]).full_name + ' оставил новый комментарий к заявке.', when);
      });
      if (s[4] === 'pending') {
        addHistory(db, id, s[6], 'В ожидании', 'Заявка приостановлена. Причина: Ожидание согласования.', at(150));
      }
      if (s[4] === 'resolved' || s[4] === 'rejected') {
        var closed = at(180);
        var last = s[9].length ? s[9][s[9].length - 1][1] : 'Проблема устранена.';
        addHistory(db, id, s[6], s[4] === 'resolved' ? 'Решено' : 'Отклонен',
          s[4] === 'resolved' ? 'Заявка успешно решена. Результат: ' + last : 'Заявка отклонена. Причина: ' + last, closed);
        t.closed_at = closed;
        t.updated_at = closed;
      }
    });
    return db;
  }

  function addHistory(db, ticketId, userId, action, details, at) {
    db.history.push({ id: ++db.seq.history, ticket_id: ticketId, user_id: userId, action: action, details: details, created_at: at || new Date().toISOString() });
  }

  var db;
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { db = JSON.parse(raw); return; }
    } catch (_) {}
    db = buildSeed();
    save();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (_) {}
  }
  window.hdDemoReset = function () {
    try {
      localStorage.removeItem(STORE_KEY);
      localStorage.removeItem('hd_notifications_history');
      localStorage.setItem('simulated_kerberos_user', DEFAULT_USER);
    } catch (_) {}
    location.reload();
  };

  function userById(id) {
    for (var i = 0; i < USERS.length; i++) if (String(USERS[i].id) === String(id)) return USERS[i];
    return null;
  }
  function publicUser(u) {
    return u ? { id: u.id, username: u.username, full_name: u.full_name, email: u.email, phone: u.phone, position: u.position, department: u.department, role: u.role, photo: '', cabinet: u.cabinet } : null;
  }
  function categoryById(id) {
    for (var i = 0; i < db.categories.length; i++) if (String(db.categories[i].id) === String(id)) return db.categories[i];
    return null;
  }
  function ticketById(id) {
    for (var i = 0; i < db.tickets.length; i++) if (String(db.tickets[i].id) === String(id)) return db.tickets[i];
    return null;
  }
  var PRIORITY_RU = { low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Критический' };
  var PRIORITY_ORDER = { urgent: 1, high: 2, medium: 3, low: 4 };

  function withUsers(t) {
    var r = Object.assign({}, t);
    var cat = categoryById(t.category_id);
    r.category_name = cat ? cat.name : null;
    var ini = userById(t.initiator_id);
    r.initiator_name = ini ? ini.full_name : 'Неизвестный пользователь';
    r.initiator_email = ini ? ini.email : '';
    r.initiator_phone = ini ? ini.phone : '';
    r.initiator_position = ini ? ini.position : '';
    r.initiator_department = ini ? ini.department : '';
    r.initiator_photo = '';
    r.initiator_cabinet = ini ? ini.cabinet : '';
    var as = userById(t.assignee_id);
    r.assignee_name = as ? as.full_name : null;
    r.assignee_email = as ? as.email : null;
    r.assignee_phone = as ? as.phone : null;
    r.assignee_photo = '';
    return r;
  }

  // ---------- Обработчики API ----------
  function err(status, message) { return { status: status, body: { error: message } }; }
  function ok(body, status) { return { status: status || 200, body: body }; }
  function isClosed(s) { return s === 'resolved' || s === 'rejected'; }

  function handle(method, path, query, body, me) {
    var m;
    if (path === '/api/config') return ok({ allowSimulation: true });
    if (!me) return err(401, 'Пользователь не найден в демо-данных.');
    if (path === '/api/auth/me') return ok({ user: publicUser(me) });
    if (path === '/api/users') return ok(USERS.map(publicUser));

    if (path === '/api/categories' && method === 'GET') return ok(db.categories);
    if (path === '/api/categories' && method === 'POST') {
      if (me.role !== 'adm') return err(403, 'Недостаточно прав для редактирования справочника');
      var name = String(body.name || '').trim();
      if (!name) return err(400, 'Название категории не может быть пустым');
      if (db.categories.some(function (c) { return c.name === name; })) return err(400, 'Категория с таким названием уже существует');
      var cat = { id: ++db.seq.category, name: name, is_active: 1 };
      db.categories.push(cat); save();
      return ok(cat, 201);
    }
    if ((m = path.match(/^\/api\/categories\/(\d+)$/))) {
      if (me.role !== 'adm') return err(403, 'Недостаточно прав для редактирования справочника');
      var c = categoryById(m[1]);
      if (!c) return err(404, 'Категория не найдена');
      if (method === 'PUT') {
        if (body.name !== undefined) c.name = String(body.name).trim();
        if (body.is_active !== undefined) c.is_active = body.is_active ? 1 : 0;
        save(); return ok(c);
      }
      if (method === 'DELETE') {
        if (db.tickets.some(function (t) { return String(t.category_id) === String(c.id); })) {
          c.is_active = 0; save();
          return ok({ message: 'Категория используется в заявках. Она была деактивирована вместо удаления.', deactivated: true });
        }
        db.categories = db.categories.filter(function (x) { return x !== c; }); save();
        return ok({ message: 'Категория успешно удалена', deleted: true });
      }
    }

    if (path === '/api/tickets' && method === 'GET') {
      var list = db.tickets.slice();
      if (me.role !== 'adm') list = list.filter(function (t) { return String(t.initiator_id) === String(me.id); });
      ['initiator_id', 'assignee_id', 'status', 'category_id', 'priority'].forEach(function (k) {
        if (query.get(k)) list = list.filter(function (t) { return String(t[k]) === query.get(k); });
      });
      var q = (query.get('q') || '').trim().toLowerCase();
      if (q) {
        list = list.filter(function (t) {
          var ini = userById(t.initiator_id);
          return [t.ticket_number, t.title, t.description, ini && ini.full_name, ini && ini.username]
            .some(function (v) { return v && String(v).toLowerCase().indexOf(q) !== -1; });
        });
      }
      var sortBy = query.get('sort_by') || 'created_at';
      var dir = (query.get('sort_order') || 'desc').toLowerCase() === 'asc' ? 1 : -1;
      list.sort(function (a, b) {
        var x, y;
        if (sortBy === 'priority') { x = PRIORITY_ORDER[a.priority] || 5; y = PRIORITY_ORDER[b.priority] || 5; }
        else if (sortBy === 'status') { x = a.status; y = b.status; }
        else { x = a.created_at; y = b.created_at; }
        return x < y ? -dir : x > y ? dir : 0;
      });
      return ok(list.map(function (t) {
        var r = withUsers(t);
        var cs = db.comments.filter(function (cm) { return cm.ticket_id === t.id; });
        var last = cs[cs.length - 1];
        r.last_comment_id = last ? last.id : null;
        r.last_comment_content = last ? last.content : null;
        r.last_comment_author_id = last ? last.author_id : null;
        var la = last && userById(last.author_id);
        r.last_comment_author_name = la ? la.full_name : null;
        return r;
      }));
    }

    if (path === '/api/tickets' && method === 'POST') {
      var description = String(body.description || '').trim();
      if (!description || !body.category_id || !body.idempotency_key) return err(400, 'Заполните обязательные поля: Описание, Категория');
      var dup = db.tickets.filter(function (t) { return t.idempotency_key === body.idempotency_key; })[0];
      if (dup) return ok(dup);
      var initiator = me, onBehalf = false;
      if (me.role === 'adm' && body.initiator_id && String(body.initiator_id) !== String(me.id)) {
        initiator = userById(body.initiator_id);
        if (!initiator) return err(404, 'Выбранный инициатор не найден в системе.');
        onBehalf = true;
      }
      var title = String(body.title || '').trim() || description.split('\n')[0].trim().slice(0, 75) || 'Без темы';
      var year = new Date().getFullYear();
      var maxSeq = db.tickets.reduce(function (mx, t) {
        var p = t.ticket_number.split('-');
        return p[1] === String(year) ? Math.max(mx, parseInt(p[2], 10) || 0) : mx;
      }, 0);
      var now = new Date().toISOString();
      var nt = {
        id: ++db.seq.ticket, ticket_number: 'HD-' + year + '-' + String(maxSeq + 1).padStart(4, '0'),
        title: title, description: description, category_id: parseInt(body.category_id, 10),
        priority: body.priority || 'medium', status: 'created', initiator_id: initiator.id, assignee_id: null,
        idempotency_key: body.idempotency_key, created_at: now, updated_at: now, closed_at: null,
      };
      db.tickets.push(nt);
      addHistory(db, nt.id, me.id, 'Создана', onBehalf
        ? 'Заявка зарегистрирована специалистом ' + me.full_name + ' от лица инициатора ' + initiator.full_name + ' с приоритетом "' + nt.priority + '".'
        : 'Заявка зарегистрирована инициатором ' + me.full_name + ' с приоритетом "' + nt.priority + '".', now);
      (body.__files || []).forEach(function (f) { addAttachment(nt.id, f); });
      save();
      return ok({ id: nt.id, ticket_number: nt.ticket_number }, 201);
    }

    if ((m = path.match(/^\/api\/tickets\/(\d+)$/))) {
      var t = ticketById(m[1]);
      if (!t) return err(404, 'Заявка не найдена');
      if (method === 'GET') {
        if (me.role === 'usr' && String(t.initiator_id) !== String(me.id)) return err(403, 'Нет доступа к этой заявке');
        return ok({
          ticket: withUsers(t),
          comments: db.comments.filter(function (cm) { return cm.ticket_id === t.id; }).map(function (cm) {
            var a = userById(cm.author_id);
            return Object.assign({}, cm, { author_name: a ? a.full_name : 'Неизвестный пользователь', author_role: a ? a.role : 'usr' });
          }),
          history: db.history.filter(function (h) { return h.ticket_id === t.id; }).map(function (h) {
            var a = userById(h.user_id);
            return Object.assign({}, h, { user_name: a ? a.full_name : 'Неизвестный пользователь' });
          }),
          attachments: db.attachments.filter(function (a) { return a.ticket_id === t.id; }),
        });
      }
      if (method === 'PUT') {
        if (!String(body.description || '').trim() || !body.category_id) return err(400, 'Заполните обязательные поля: Описание, Категория');
        if (String(t.initiator_id) !== String(me.id) && me.role !== 'adm') return err(403, 'У вас нет прав на редактирование этой заявки');
        if (t.status !== 'created' || t.assignee_id) return err(400, 'Нельзя редактировать заявку, которая уже принята специалистом в работу или назначена');
        t.description = String(body.description).trim();
        t.title = t.description.split('\n')[0].trim().slice(0, 75) || t.title;
        t.category_id = parseInt(body.category_id, 10);
        if (body.priority) t.priority = body.priority;
        t.updated_at = new Date().toISOString();
        var del = [];
        try { del = JSON.parse(body.deletedAttachmentIds || '[]'); } catch (_) {}
        db.attachments = db.attachments.filter(function (a) { return del.map(String).indexOf(String(a.id)) === -1; });
        (body.__files || []).forEach(function (f) { addAttachment(t.id, f); });
        addHistory(db, t.id, me.id, 'Отредактирована', 'Инициатор отредактировал параметры и описание заявки до начала работы.');
        save();
        return ok(withUsers(t));
      }
    }

    if ((m = path.match(/^\/api\/tickets\/(\d+)\/attachments$/)) && method === 'POST') {
      var ta = ticketById(m[1]);
      if (!ta) return err(404, 'Заявка не найдена');
      var att = (body.__files || [])[0];
      if (!att) return err(400, 'Файл не передан');
      var rec = addAttachment(ta.id, att);
      addHistory(db, ta.id, me.id, 'Добавлено вложение', 'Пользователь ' + me.full_name + ' добавил вложение: ' + rec.file_name);
      save();
      return ok(rec, 201);
    }
    if ((m = path.match(/^\/api\/tickets\/(\d+)\/attachments\/(\d+)$/)) && method === 'DELETE') {
      var td = ticketById(m[1]);
      if (!td) return err(404, 'Заявка не найдена');
      if (me.role !== 'adm' && String(td.initiator_id) !== String(me.id)) return err(403, 'Недостаточно прав для удаления этого вложения');
      var a = db.attachments.filter(function (x) { return String(x.id) === m[2]; })[0];
      if (!a) return err(404, 'Вложение не найдено');
      db.attachments = db.attachments.filter(function (x) { return x !== a; });
      addHistory(db, td.id, me.id, 'Удалено вложение', 'Пользователь ' + me.full_name + ' удалил вложение: ' + a.file_name);
      save();
      return ok({ success: true, message: 'Вложение успешно удалено' });
    }

    if ((m = path.match(/^\/api\/tickets\/(\d+)\/(status|assign|category|priority|initiator|comments)$/))) {
      var tk = ticketById(m[1]);
      if (!tk) return err(404, 'Заявка не найдена');
      var now2 = new Date().toISOString();
      var action = m[2];

      if (action === 'status') {
        var status = body.status, details = body.details;
        if (['created', 'in_progress', 'pending', 'resolved', 'rejected'].indexOf(status) === -1) return err(400, 'Неверный или отсутствующий статус');
        var isSpec = me.role === 'adm';
        var isInit = String(tk.initiator_id) === String(me.id);
        if (!isSpec) {
          if (!isInit) return err(403, 'Недостаточно прав для изменения статуса');
          if (status !== 'rejected') return err(403, 'Пользователи могут только отменять свои заявки');
          if (isClosed(tk.status)) return err(400, 'Нельзя отменить уже закрытую заявку');
        }
        var actionName = 'Изменение статуса';
        var msg = 'Статус заявки изменен с "' + tk.status + '" на "' + status + '".';
        if (isInit && !isSpec && status === 'rejected') { actionName = 'Отменена'; msg = 'Инициатор ' + me.full_name + ' отменил заявку.' + (details ? ' Причина: ' + details : ''); }
        else if (status === 'in_progress') { actionName = 'В работе'; msg = 'Специалист ' + me.full_name + ' взял заявку в работу.'; }
        else if (status === 'resolved') { actionName = 'Решено'; msg = 'Заявка успешно решена. Результат: ' + (details || 'Проблема устранена.'); }
        else if (status === 'rejected') { actionName = 'Отклонен'; msg = 'Заявка отклонена. Причина: ' + (details || 'Отказано в выполнении.'); }
        else if (status === 'pending') { actionName = 'В ожидании'; msg = 'Заявка приостановлена. Причина: ' + (details || 'Ожидание комплектующих / информации.'); }
        if (status === 'in_progress' && !tk.assignee_id) tk.assignee_id = me.id;
        if (status === 'resolved') tk.assignee_id = me.id;
        tk.closed_at = isClosed(status) ? (tk.closed_at || now2) : null;
        tk.status = status;
        tk.updated_at = now2;
        addHistory(db, tk.id, me.id, actionName, msg, now2);
        save();
        return ok({ success: true, status: status, actionName: actionName, details: msg });
      }

      if (action === 'comments') {
        var content = String(body.content || '').trim();
        if (!content) return err(400, 'Текст комментария не может быть пустым');
        if (me.role === 'usr' && String(tk.initiator_id) !== String(me.id)) return err(403, 'Нет доступа к этой заявке');
        var cm = { id: ++db.seq.comment, ticket_id: tk.id, author_id: me.id, content: content, created_at: now2 };
        db.comments.push(cm);
        addHistory(db, tk.id, me.id, 'Комментарий', me.full_name + ' оставил новый комментарий к заявке.', now2);
        save();
        return ok(Object.assign({}, cm, { author_name: me.full_name, author_role: me.role }), 201);
      }

      if (me.role !== 'adm') return err(403, 'Недостаточно прав для этого действия');

      if (action === 'assign') {
        var target = body.assignee_id ? userById(body.assignee_id) : null;
        if (body.assignee_id && (!target || target.role !== 'adm')) return err(400, 'Исполнитель должен иметь роль IT-специалиста (adm)');
        var prevStatus = tk.status;
        if (target && tk.status === 'created') tk.status = 'in_progress';
        if (!target && tk.status !== 'created') tk.status = 'created';
        if (!isClosed(tk.status)) tk.closed_at = null;
        tk.assignee_id = target ? target.id : null;
        tk.updated_at = now2;
        addHistory(db, tk.id, me.id, 'Назначение', target
          ? 'Специалист ' + me.full_name + ' назначил исполнителем ' + target.full_name + '.'
          : 'Специалист ' + me.full_name + ' снял исполнителя с заявки.', now2);
        if (tk.status !== prevStatus) {
          addHistory(db, tk.id, me.id, tk.status === 'created' ? 'В очереди' : 'В работе',
            tk.status === 'created' ? 'Заявка возвращена в очередь.' : 'Заявка взята в работу исполнителем ' + target.full_name + '.', now2);
        }
        save();
        return ok({ success: true, assignee_id: tk.assignee_id, assignee_name: target ? target.full_name : null });
      }
      if (action === 'category') {
        var nc = categoryById(body.category_id);
        if (!body.category_id) return err(400, 'Выберите категорию');
        if (!nc) return err(400, 'Категория не найдена');
        var oc = categoryById(tk.category_id);
        tk.category_id = nc.id; tk.updated_at = now2;
        addHistory(db, tk.id, me.id, 'Смена категории', 'Специалист ' + me.full_name + ' изменил категорию заявки с "' + (oc ? oc.name : '—') + '" на "' + nc.name + '".', now2);
        save();
        return ok({ success: true, category_name: nc.name });
      }
      if (action === 'priority') {
        if (!PRIORITY_RU[body.priority]) return err(400, 'Неверный приоритет');
        var op = tk.priority;
        tk.priority = body.priority; tk.updated_at = now2;
        addHistory(db, tk.id, me.id, 'Смена приоритета', 'Специалист ' + me.full_name + ' изменил приоритет заявки с "' + PRIORITY_RU[op] + '" на "' + PRIORITY_RU[body.priority] + '".', now2);
        save();
        return ok({ success: true, priority: body.priority });
      }
      if (action === 'initiator') {
        var ni = userById(body.initiator_id);
        if (!body.initiator_id) return err(400, 'Пожалуйста, выберите нового инициатора.');
        if (!ni) return err(404, 'Новый инициатор не найден в системе.');
        var oldName = (userById(tk.initiator_id) || {}).full_name || '—';
        tk.initiator_id = ni.id; tk.updated_at = now2;
        addHistory(db, tk.id, me.id, 'Изменен инициатор', 'Специалист ' + me.full_name + ' изменил инициатора заявки с "' + oldName + '" на "' + ni.full_name + '".', now2);
        save();
        return ok({ success: true, initiator_name: ni.full_name });
      }
    }

    if (path.indexOf('/api/reports/') === 0 && me.role !== 'adm' && me.role !== 'wtch') {
      return err(403, 'Доступ разрешен только для IT-специалистов (adm) и наблюдателей (wtch)');
    }
    if (path === '/api/reports/stats') {
      var from = query.get('start_date'), to = query.get('end_date');
      var inRange = db.tickets.filter(function (t) {
        var d = t.created_at.slice(0, 10);
        return (!from || d >= from.slice(0, 10)) && (!to || d <= to.slice(0, 10));
      });
      var summary = { total: 0, created: 0, in_progress: 0, pending: 0, resolved: 0, rejected: 0 };
      var byCat = {};
      inRange.forEach(function (t) {
        summary.total++;
        if (summary[t.status] !== undefined) summary[t.status]++;
        var cn = (categoryById(t.category_id) || {}).name;
        if (cn) byCat[cn] = (byCat[cn] || 0) + 1;
      });
      return ok({ summary: summary, byCategory: Object.keys(byCat).map(function (k) { return { name: k, cnt: byCat[k] }; }) });
    }
    if (path === '/api/reports/closed-tickets-data') {
      return ok(db.tickets.filter(function (t) { return isClosed(t.status); }).map(function (t) {
        var h = db.history.filter(function (x) { return x.ticket_id === t.id; });
        var taken = h.filter(function (x) { return x.action === 'В работе' || x.action === 'Назначение'; })[0];
        var closed = h.filter(function (x) { return x.action === 'Решено' || x.action === 'Отклонен'; }).pop();
        var r = withUsers(t);
        return {
          id: t.id, ticket_number: t.ticket_number, initiator_name: r.initiator_name, initiator_email: r.initiator_email,
          initiator_phone: r.initiator_phone, initiator_department: r.initiator_department, initiator_position: r.initiator_position,
          initiator_cabinet: r.initiator_cabinet, description: t.description, category_id: t.category_id,
          category_name: r.category_name || 'Не указана', priority: t.priority, status: t.status, created_at: t.created_at,
          taken_at: taken ? taken.created_at : null, assignee_name: r.assignee_name || 'Не назначен',
          closed_at: closed ? closed.created_at : t.updated_at, resolution: closed ? closed.details : '',
        };
      }));
    }
    if (path === '/api/reports/export') {
      var rows = [['Номер', 'Дата', 'Инициатор', 'Категория', 'Приоритет', 'Статус', 'Исполнитель', 'Описание']];
      db.tickets.forEach(function (t) {
        var r = withUsers(t);
        rows.push([t.ticket_number, t.created_at.slice(0, 10), r.initiator_name, r.category_name, PRIORITY_RU[t.priority], t.status, r.assignee_name || '', t.description]);
      });
      var csv = '﻿' + rows.map(function (row) {
        return row.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
      }).join('\r\n');
      return { status: 200, raw: csv, type: 'text/csv; charset=utf-8' };
    }
    if (path === '/api/admin/run-categorization') {
      return ok({ success: true, message: 'В демо-версии архив уже размечен по категориям.', updated: 0 });
    }
    return err(404, 'Метод недоступен в демо-версии');
  }

  function addAttachment(ticketId, file) {
    var rec = {
      id: db.attachments.reduce(function (mx, a) { return Math.max(mx, a.id); }, 0) + 1,
      ticket_id: ticketId, file_name: file.name,
      // Содержимое файла в демо не хранится: ссылка ведёт на пояснение
      file_path: 'data:text/plain;charset=utf-8,' + encodeURIComponent('Демо-версия: файл «' + file.name + '» не загружается на сервер.'),
      file_size: (file.size / 1024).toFixed(1) + ' KB', created_at: new Date().toISOString(),
    };
    db.attachments.push(rec);
    return rec;
  }

  // ---------- Перехват fetch ----------
  var realFetch = window.fetch.bind(window);
  window.fetch = function (input, options) {
    var href = typeof input === 'string' ? input : input.url;
    var at = href.indexOf('/api/');
    if (at === -1) return realFetch(input, options);
    options = options || {};
    var u = new URL(href.slice(at), location.origin);
    var method = (options.method || 'GET').toUpperCase();
    var headers = options.headers || {};
    var username = headers['X-Remote-User'] || headers['x-remote-user'] || localStorage.getItem('simulated_kerberos_user') || DEFAULT_USER;
    var me = null;
    for (var i = 0; i < USERS.length; i++) if (USERS[i].username === username) me = USERS[i];

    var body = {};
    if (options.body instanceof FormData) {
      body.__files = [];
      options.body.forEach(function (v, k) {
        if (typeof v === 'object' && v && 'name' in v) body.__files.push({ name: v.name, size: v.size });
        else body[k] = v;
      });
    } else if (typeof options.body === 'string') {
      try { body = JSON.parse(options.body); } catch (_) {}
    }

    if (!db) load();
    var res;
    try { res = handle(method, u.pathname, u.searchParams, body, me); }
    catch (e) { res = err(500, 'Ошибка демо-сервера: ' + e.message); }

    return new Promise(function (resolve) {
      setTimeout(function () {
        if (res.raw !== undefined) {
          resolve(new Response(res.raw, { status: res.status, headers: { 'Content-Type': res.type } }));
        } else {
          resolve(new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } }));
        }
      }, 120 + Math.random() * 180);
    });
  };

  load();
})();
