/* ACE Training Lab — admin page.
   Every action is sent to the Google Apps Script with the admin password.
   The password is checked there, never in this file. It is kept only for
   this browser tab and is forgotten when the tab is closed or on Log out. */
(function () {
  'use strict';

  var API = window.ACE_CONFIG.API_URL;
  var BUILT_IN = window.ACE_INSTRUCTORS || {};   // the instructors the website had before the Instructors tab existed
  var seeding = false;
  var STATUSES = ['New', 'Payment checked', 'Confirmed', 'Cancelled'];
  var KEY = 'ace_admin_pw';
  var password = '';
  var LEAD_STATUSES = ['New', 'Contacted', 'Demo done', 'Joined', 'Not interested'];
  var SETTING_KEYS = ['whatsapp', 'phone1', 'phone2', 'phone3', 'email', 'notifyEmail', 'address1', 'address2', 'hours', 'topbar', 'accounts'];
  var settingsLoaded = false;
  var data = { courses: [], batches: [], registrations: [], leads: [], results: [], instructors: [], settings: {} };
  var photoFile = null;        // new photo chosen in the instructor form, already made smaller
  var confirmId = null;        // which Delete button is waiting for "Yes"

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function call(action, extra) {
    var body = { action: action, password: password };
    Object.keys(extra || {}).forEach(function (k) { body[k] = extra[k]; });
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, error: 'Could not reach the server. Check your internet connection.' }; });
  }
  function note(kind, text) {
    var m = $('msg');
    m.className = 'form-msg show ' + kind;
    m.textContent = text;
    if (kind === 'info') setTimeout(function () { if (m.textContent === text) m.className = 'form-msg'; }, 4000);
  }
  function siteChanged() { try { localStorage.removeItem('ace_data_v2'); } catch (e) { /* storage blocked */ } }
  function imgSrc(file) {
    if (!file) return '';
    return /^https?:\/\//.test(file) ? file : '../assets/images/' + file;
  }
  function builtInList() {
    return Object.keys(BUILT_IN).map(function (k) { var p = BUILT_IN[k]; return { id: k, name: p.name, role: p.role, photo: p.photo, bio: p.bio, show: true }; });
  }
  function courseName(id) {
    var c = data.courses.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : id;
  }

  /* ---------- sign in / out ---------- */
  function showApp(on) {
    $('login').classList.toggle('hidden', on);
    $('app').classList.toggle('hidden', !on);
  }
  function load() {
    return call('adminData').then(function (res) {
      if (!res.ok) { return res; }
      var people = res.instructors;        // null: the Instructors tab is not made yet; missing: older backend
      data = res;
      data.leads = res.leads || [];        // older backend versions do not send these
      data.results = res.results || [];
      data.settings = res.settings || {};
      data.instructorsReady = Array.isArray(people);
      data.instructors = data.instructorsReady ? people : builtInList();
      if (people === null && !seeding) {
        // first time: copy the instructors already on the website into a new Instructors tab
        seeding = true;
        return call('adminSeedInstructors', { instructors: builtInList() }).then(function () { return load(); });
      }
      renderAll();
      if (!settingsLoaded) { fillSettings(); settingsLoaded = true; }   // do not overwrite what is being typed
      return res;
    });
  }
  function signIn(pw, quiet) {
    password = pw;
    return load().then(function (res) {
      if (res.ok) {
        try { sessionStorage.setItem(KEY, pw); } catch (e) { /* storage blocked */ }
        showApp(true);
      } else {
        password = '';
        try { sessionStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
        showApp(false);
        if (!quiet) { var m = $('login-msg'); m.className = 'form-msg show error'; m.textContent = res.error || 'Sign in failed'; }
      }
    });
  }
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var b = e.target.querySelector('button');
    b.disabled = true; b.textContent = 'Signing in…';
    signIn($('pw').value).then(function () { b.disabled = false; b.textContent = 'Sign in'; $('pw').value = ''; });
  });
  $('logout').addEventListener('click', function () {
    password = '';
    try { sessionStorage.removeItem(KEY); } catch (e) { /* storage blocked */ }
    showApp(false);
  });

  /* ---------- views ---------- */
  document.querySelectorAll('.side [data-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.side [data-view]').forEach(function (b) { b.classList.toggle('on', b === btn); });
      ['courses', 'batches', 'leads', 'regs', 'instructors', 'results', 'settings'].forEach(function (v) { $('view-' + v).classList.toggle('hidden', v !== btn.getAttribute('data-view')); });
      $('msg').className = 'form-msg';
    });
  });

  function deleteButtons(id) {
    if (confirmId === id) {
      return '<button class="btn btn-small btn-danger" data-act="yes" data-id="' + esc(id) + '">Yes, delete</button>' +
        '<button class="btn btn-small btn-line" data-act="no">No</button>';
    }
    return '<button class="btn btn-small btn-danger" data-act="ask" data-id="' + esc(id) + '">Delete</button>';
  }

  function renderAll() {
    /* courses */
    $('course-rows').innerHTML = data.courses.length ? data.courses.map(function (c) {
      return '<tr><td class="strong">' + esc(c.name) + '</td><td>' + esc(c.group) + '</td><td>' + (c.fee ? 'Rs ' + esc(c.fee) : '<span class="muted">not set</span>') + '</td>' +
        '<td><button class="pill' + (c.show ? ' on' : '') + '" data-act="toggle" data-id="' + esc(c.id) + '" aria-pressed="' + (c.show ? 'true' : 'false') + '">' + (c.show ? 'Showing' : 'Hidden') + '</button></td>' +
        '<td class="actions"><button class="btn btn-small btn-line" data-act="edit" data-id="' + esc(c.id) + '">Edit</button>' + deleteButtons('c:' + c.id) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No courses yet. Click "Add course".</td></tr>';

    var groups = {};
    data.courses.forEach(function (c) { if (c.group) groups[c.group] = 1; });
    $('groups').innerHTML = Object.keys(groups).map(function (g) { return '<option value="' + esc(g) + '">'; }).join('');
    var keep = $('c-instructor').value;
    $('c-instructor').innerHTML = '<option value="">None</option>' + data.instructors.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.name) + (p.show ? '' : ' (hidden)') + '</option>';
    }).join('');
    $('c-instructor').value = keep;

    /* batches */
    $('b-course').innerHTML = '<option value="">Select a course</option>' + data.courses.map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>';
    }).join('');
    $('batch-rows').innerHTML = data.batches.length ? data.batches.map(function (b) {
      return '<tr><td class="strong">' + esc(courseName(b.courseId)) + '</td><td>' + esc(b.start) + '</td><td>' + esc(b.time) + '</td><td>' + esc(b.seats) + '</td>' +
        '<td class="actions">' + deleteButtons('b:' + b.row) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No batches yet.</td></tr>';

    /* registrations */
    $('reg-rows').innerHTML = data.registrations.length ? data.registrations.map(function (r) {
      var proof = /^https:\/\/drive\.google\.com\//.test(r.proof) ? '<a href="' + esc(r.proof) + '" target="_blank" rel="noopener" style="text-decoration:underline">Open</a>' : '<span class="muted">none</span>';
      return '<tr><td>' + esc(r.timestamp) + '</td><td class="strong">' + esc(r.name) + '</td><td>' + esc(r.courseName) + (r.batch ? '<br><span class="muted">' + esc(r.batch) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.mobile) + '</td><td>' + esc(r.email) + '</td><td>' + proof + '</td>' +
        '<td><select data-act="status" data-row="' + esc(r.row) + '" aria-label="Status for ' + esc(r.name) + '">' + STATUSES.map(function (s) {
          return '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">No registrations yet.</td></tr>';
    renderExtra();
  }

  function renderExtra() {
    $('lead-rows').innerHTML = data.leads.length ? data.leads.map(function (r) {
      var digits = String(r.mobile).replace(/[^0-9]/g, '');
      var wa = digits.length >= 8 ? '<a href="https://api.whatsapp.com/send/?phone=' + digits + '" target="_blank" rel="noopener" style="text-decoration:underline">' + esc(r.mobile) + '</a>' : esc(r.mobile);
      return '<tr><td>' + esc(r.timestamp) + '</td><td class="strong">' + esc(r.name) + '</td><td>' + wa + '</td><td>' + esc(r.courseName || 'Not sure yet') + '</td><td>' + esc(r.note) + '</td>' +
        '<td><select data-act="lead-status" data-row="' + esc(r.row) + '" aria-label="Status for ' + esc(r.name) + '">' + LEAD_STATUSES.map(function (s) {
          return '<option' + (s === r.status ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select></td></tr>';
    }).join('') : '<tr><td colspan="6" class="empty">No demo requests yet.</td></tr>';

    $('result-rows').innerHTML = data.results.length ? data.results.map(function (r) {
      return '<tr><td class="strong">' + esc(r.name) + '</td><td>' + esc(r.course) + '</td><td>' + esc(r.score) + '</td>' +
        '<td><button class="pill' + (r.show ? ' on' : '') + '" data-act="result-toggle" data-row="' + esc(r.row) + '" aria-pressed="' + (r.show ? 'true' : 'false') + '">' + (r.show ? 'Showing' : 'Hidden') + '</button></td>' +
        '<td class="actions">' + deleteButtons('r:' + r.row) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No results yet.</td></tr>';

    /* instructors */
    var old = res_old();
    $('instructor-note').className = old ? 'form-msg show error' : 'form-msg';
    $('instructor-note').textContent = old ? 'The Google Apps Script needs updating before instructors can be changed here. The list below is what the website shows now.' : '';
    $('add-instructor').disabled = old;
    $('instructor-rows').innerHTML = data.instructors.length ? data.instructors.map(function (p) {
      var teaches = data.courses.filter(function (c) { return c.instructor === p.id; }).map(function (c) { return esc(c.name); }).join(', ');
      var photo = p.photo ? '<img src="' + esc(imgSrc(p.photo)) + '" alt="">' : '<img alt="">';
      return '<tr><td><div class="person">' + photo + '<span class="strong">' + esc(p.name) + '</span></div></td><td>' + esc(p.role) + '</td>' +
        '<td>' + (teaches || '<span class="muted">none</span>') + '</td>' +
        '<td><button class="pill' + (p.show ? ' on' : '') + '" data-act="instructor-toggle" data-id="' + esc(p.id) + '" aria-pressed="' + (p.show ? 'true' : 'false') + '"' + (old ? ' disabled' : '') + '>' + (p.show ? 'Showing' : 'Hidden') + '</button></td>' +
        '<td class="actions">' + (old ? '' : '<button class="btn btn-small btn-line" data-act="instructor-edit" data-id="' + esc(p.id) + '">Edit</button>' + deleteButtons('i:' + p.id)) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="empty">No instructors yet. Click "Add instructor".</td></tr>';
  }
  function res_old() { return !data.instructorsReady; }

  /* ---------- course form ---------- */
  var FIELDS = ['id', 'name', 'group', 'fee', 'oldFee', 'level', 'duration', 'mode', 'instructor', 'short', 'learn', 'image'];
  function openForm(c) {
    $('course-form-title').textContent = c ? 'Edit course' : 'Add a course';
    FIELDS.forEach(function (k) { $('c-' + k).value = c ? (c[k] || '') : ''; });
    $('course-form').dataset.show = c ? String(c.show) : 'true';
    $('course-form').classList.remove('hidden');
    $('c-name').focus();
  }
  $('add-course').addEventListener('click', function () { openForm(null); });
  $('course-cancel').addEventListener('click', function () { $('course-form').classList.add('hidden'); });
  $('course-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = { show: $('course-form').dataset.show !== 'false' };
    FIELDS.forEach(function (k) { c[k] = $('c-' + k).value.trim(); });
    save('adminSaveCourse', { course: c }, 'Course saved.').then(function (ok) { if (ok) $('course-form').classList.add('hidden'); });
  });

  function save(action, extra, okText) {
    return call(action, extra).then(function (res) {
      if (!res.ok) { note('error', res.error || 'That did not work. Please try again.'); return false; }
      siteChanged();
      return load().then(function () { note('info', okText); return true; });
    });
  }

  /* ---------- table buttons ---------- */
  document.querySelector('.main').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.tagName === 'SELECT') return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'edit') openForm(data.courses.filter(function (c) { return c.id === id; })[0]);
    if (act === 'toggle') {
      var c = data.courses.filter(function (x) { return x.id === id; })[0];
      var copy = {}; Object.keys(c).forEach(function (k) { copy[k] = c[k]; });
      copy.show = !c.show;
      b.disabled = true;
      save('adminSaveCourse', { course: copy }, copy.show ? 'Course is now showing on the website.' : 'Course is now hidden from the website.');
    }
    if (act === 'ask') { confirmId = id; renderAll(); }
    if (act === 'no') { confirmId = null; renderAll(); }
    if (act === 'yes') {
      confirmId = null;
      b.disabled = true;
      if (id.indexOf('c:') === 0) save('adminDeleteCourse', { id: id.slice(2) }, 'Course deleted.');
      else if (id.indexOf('r:') === 0) save('adminDeleteResult', { row: Number(id.slice(2)) }, 'Result deleted.');
      else if (id.indexOf('i:') === 0) save('adminDeleteInstructor', { id: id.slice(2) }, 'Instructor deleted.');
      else save('adminDeleteBatch', { row: Number(id.slice(2)) }, 'Batch deleted.');
    }
    if (act === 'instructor-edit') openInstructor(findInstructor(id));
    if (act === 'instructor-toggle') {
      var p0 = findInstructor(id), copy2 = {};
      Object.keys(p0).forEach(function (k) { copy2[k] = p0[k]; });
      copy2.show = !p0.show;
      b.disabled = true;
      save('adminSaveInstructor', { instructor: copy2 }, copy2.show ? 'Instructor is now showing on the website.' : 'Instructor is now hidden from the website.');
    }
    if (act === 'refresh') load().then(function (r) { note(r.ok ? 'info' : 'error', r.ok ? 'Updated.' : r.error); });
    if (act === 'result-toggle') {
      var row = Number(b.getAttribute('data-row'));
      var r0 = data.results.filter(function (x) { return x.row === row; })[0];
      b.disabled = true;
      save('adminSaveResult', { result: { row: row, name: r0.name, course: r0.course, score: r0.score, quote: r0.quote, show: !r0.show } }, r0.show ? 'Result hidden.' : 'Result is now showing.');
    }
  });
  document.querySelector('.main').addEventListener('change', function (e) {
    var kind = e.target.getAttribute('data-act');
    if (kind === 'lead-status') { save('adminSetLeadStatus', { row: Number(e.target.getAttribute('data-row')), status: e.target.value }, 'Status updated.'); return; }
    if (kind !== 'status') return;
    save('adminSetStatus', { row: Number(e.target.getAttribute('data-row')), status: e.target.value }, 'Status updated.');
  });

  /* ---------- batch form ---------- */
  $('batch-form').addEventListener('submit', function (e) {
    e.preventDefault();
    save('adminSaveBatch', { batch: { courseId: $('b-course').value, start: $('b-start').value, time: $('b-time').value.trim(), seats: $('b-seats').value.trim() } }, 'Batch added.')
      .then(function (ok) { if (ok) e.target.reset(); });
  });

  /* ---------- site settings ---------- */
  function fillSettings() {
    var cfg = window.ACE_CONFIG, s = data.settings;
    var defaults = {
      whatsapp: cfg.whatsapp, phone1: cfg.phones[0], phone2: cfg.phones[1], phone3: cfg.phones[2], email: cfg.email, notifyEmail: '',
      address1: cfg.addresses[0], address2: cfg.addresses[1], hours: cfg.hours, topbar: 'Live online classes with expert instructors', accounts: ''
    };
    var saved = Object.keys(s).length > 0;       // once anything is saved, the sheet is the source
    SETTING_KEYS.forEach(function (k) { $('t-' + k).value = saved ? (s[k] || '') : (defaults[k] || ''); });
  }
  $('settings-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var out = {};
    SETTING_KEYS.forEach(function (k) { out[k] = $('t-' + k).value.trim(); });
    out.whatsapp = out.whatsapp.replace(/[^0-9]/g, '');
    if (out.whatsapp.length < 8) { note('error', 'The WhatsApp number looks too short. Include the country code, for example 923418905188.'); return; }
    save('adminSaveSettings', { settings: out }, 'Settings saved.').then(function (ok) { if (ok) $('t-whatsapp').value = out.whatsapp; });
  });

  /* ---------- instructor form ---------- */
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  function findInstructor(id) { return data.instructors.filter(function (p) { return p.id === id; })[0]; }
  function openInstructor(p) {
    $('instructor-form-title').textContent = p ? 'Edit instructor' : 'Add an instructor';
    ['id', 'name', 'role', 'bio', 'photo'].forEach(function (k) { $('i-' + k).value = p ? (p[k] || '') : ''; });
    $('instructor-form').dataset.show = p ? String(p.show) : 'true';
    $('i-preview').src = (p && p.photo) ? imgSrc(p.photo) : BLANK;
    $('i-file').value = ''; photoFile = null;
    $('instructor-form').classList.remove('hidden');
    $('i-name').focus();
  }
  $('add-instructor').addEventListener('click', function () { openInstructor(null); });
  $('instructor-cancel').addEventListener('click', function () { $('instructor-form').classList.add('hidden'); });
  $('i-photo-clear').addEventListener('click', function () {
    $('i-photo').value = ''; $('i-file').value = ''; photoFile = null; $('i-preview').src = BLANK;
  });
  /* Makes the chosen photo a small square JPG (400 x 400) before sending, so it loads fast on the website. */
  $('i-file').addEventListener('change', function () {
    var f = this.files[0];
    photoFile = null;
    if (!f) return;
    if (!/^image\//.test(f.type)) { note('error', 'Please choose a photo (JPG or PNG).'); this.value = ''; return; }
    var url = URL.createObjectURL(f), pic = new Image();
    pic.onload = function () {
      var side = Math.min(pic.width, pic.height), size = Math.min(400, side);
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(pic, (pic.width - side) / 2, (pic.height - side) / 2, side, side, 0, 0, size, size);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      URL.revokeObjectURL(url);
      $('i-preview').src = dataUrl;
      photoFile = { type: 'image/jpeg', data: dataUrl.split(',')[1] };
    };
    pic.onerror = function () { URL.revokeObjectURL(url); note('error', 'That photo could not be opened. Please try another file.'); };
    pic.src = url;
  });
  $('instructor-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var p = { show: $('instructor-form').dataset.show !== 'false' };
    ['id', 'name', 'role', 'bio', 'photo'].forEach(function (k) { p[k] = $('i-' + k).value.trim(); });
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Saving…';
    save('adminSaveInstructor', { instructor: p, photoFile: photoFile }, 'Instructor saved.').then(function (ok) {
      btn.disabled = false; btn.textContent = 'Save instructor';
      if (ok) { $('instructor-form').classList.add('hidden'); photoFile = null; }
    });
  });

  /* ---------- result form ---------- */
  $('result-form').addEventListener('submit', function (e) {
    e.preventDefault();
    save('adminSaveResult', { result: { name: $('s-name').value.trim(), course: $('s-course').value.trim(), score: $('s-score').value.trim(), quote: $('s-quote').value.trim(), show: true } }, 'Result added.')
      .then(function (ok) { if (ok) e.target.reset(); });
  });

  /* ---------- start ---------- */
  if (!API) {
    var m = $('login-msg'); m.className = 'form-msg show error';
    m.textContent = 'The website is not connected to the Google Sheet yet (API_URL in config.js is empty).';
  } else {
    var saved = '';
    try { saved = sessionStorage.getItem(KEY) || ''; } catch (e) { saved = ''; }
    if (saved) signIn(saved, true);
  }
})();
