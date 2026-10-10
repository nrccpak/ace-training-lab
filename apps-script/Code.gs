/**
 * ACE Training Lab — website backend (Google Apps Script)
 *
 * Lives inside the Google Sheet "ACE Training Lab - Website Data".
 *   GET  ?action=data            -> courses (shown only) and batches, for the public site
 *   POST {action:'register'}     -> saves a registration + payment proof, emails the owner and the student
 *   POST {action:'lead'}         -> saves a free demo class request, emails the owner
 *   POST {action:'admin...'}     -> admin page actions, all need the admin password
 *
 * SETTINGS (Project Settings > Script Properties):
 *   ADMIN_PASSWORD   required for the admin page. Admin is locked until this is set.
 *   NOTIFY_EMAIL     optional. Where registration emails go. Default: the sheet owner.
 */

var TAB = { courses: 'Courses', batches: 'Batches', regs: 'Registrations', leads: 'Leads', results: 'Results', settings: 'Settings' };
var PROOF_FOLDER = 'ACE Registrations - Payment proofs';
var MAX_PROOF_BYTES = 10 * 1024 * 1024;
var DATA_CACHE_SECONDS = 300;        // public course data is cached this long (cleared on every admin change)
var MAX_FORMS_PER_10_MIN = 40;       // protection against form spam
var ADMIN_LIST_LIMIT = 300;          // newest rows shown in the admin page
var ACADEMY = 'ACE Training Lab';
var SETTING_KEYS = ['whatsapp', 'phone1', 'phone2', 'phone3', 'email', 'address1', 'address2', 'hours', 'topbar', 'accounts', 'notifyEmail'];
var PRIVATE_SETTINGS = ['notifyEmail'];   // never sent to the public website
var REG_FIELDS = ['course', 'courseName', 'batch', 'name', 'father', 'dob', 'gender', 'mobile', 'email', 'nationality', 'address'];
var COURSE_FIELDS = ['id', 'name', 'group', 'short', 'level', 'duration', 'mode', 'fee', 'oldFee', 'image', 'instructor', 'learn', 'show'];

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'data';
  if (action === 'data') {
    var cache = CacheService.getScriptCache();
    var hit = cache.get('public_data');
    if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
    var out = JSON.stringify({
      courses: readRows(TAB.courses).filter(function (c) { return isTrue(c.show); }).map(cleanCourse),
      batches: readRows(TAB.batches).map(cleanBatch),
      results: readRows(TAB.results).filter(function (r) { return isTrue(r.show); }).map(cleanResult),
      settings: publicSettings()
    });
    try { cache.put('public_data', out, DATA_CACHE_SECONDS); } catch (err) { /* too large to cache: still served */ }
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
  }
  return json({ ok: false, error: 'Unknown action' });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'Bad request' }); }
  try {
    if (body.action === 'register') return json(register(body));
    if (body.action === 'lead') return json(lead(body));
    if (String(body.action).indexOf('admin') === 0) return json(admin(body));
    return json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: 'Server error' });
  }
}

/* ------------------------------------------------------------------ */
/* Public: registration                                                */
/* ------------------------------------------------------------------ */

function register(body) {
  var f = body.fields || {};
  if (text(f.website)) return { ok: true };            // hidden field filled in: a bot, quietly ignored
  if (!text(f.name) || !text(f.mobile) || !text(f.course)) return { ok: false, error: 'Missing details' };
  if (!rateOk()) return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };

  var proofUrl = '';
  var p = body.proof;
  if (p && p.data) {
    var type = String(p.type || '');
    if (!/^image\//.test(type) && type !== 'application/pdf') return { ok: false, error: 'File type not allowed' };
    var bytes = Utilities.base64Decode(p.data);
    if (bytes.length > MAX_PROOF_BYTES) return { ok: false, error: 'File too large' };
    var fileName = stamp('yyyyMMdd-HHmmss') + ' ' + text(f.name).replace(/[^\w .-]/g, '').slice(0, 60) + ' ' +
      String(p.name || 'proof').replace(/[^\w .-]/g, '').slice(-40);
    var file = proofFolder().createFile(Utilities.newBlob(bytes, type, fileName));
    proofUrl = file.getUrl();           // private: only the sheet owner can open it
  }

  var row = [new Date()].concat(REG_FIELDS.map(function (k) { return safeCell(f[k]); })).concat([proofUrl, 'New']);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { sheet(TAB.regs).appendRow(row); } finally { lock.releaseLock(); }

  try {
    MailApp.sendEmail({
      to: notifyEmail(),
      subject: 'New registration: ' + text(f.name) + ' - ' + text(f.courseName || f.course),
      body: 'A new registration has arrived.\n\n' +
        'Course: ' + text(f.courseName || f.course) + '\n' +
        'Batch: ' + text(f.batch) + '\n' +
        'Name: ' + text(f.name) + '\n' +
        'Mobile: ' + text(f.mobile) + '\n' +
        'Email: ' + text(f.email) + '\n' +
        'Payment proof: ' + (proofUrl || 'not uploaded') + '\n\n' +
        'Full details are in the Registrations tab:\n' + SpreadsheetApp.getActive().getUrl()
    });
  } catch (err) { console.error('Email failed: ' + err); }   // the registration is saved even if email fails

  // confirmation to the student
  var studentEmail = text(f.email);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(studentEmail)) {
    try {
      MailApp.sendEmail({
        to: studentEmail,
        name: ACADEMY,
        subject: 'We received your registration - ' + ACADEMY,
        body: 'Dear ' + text(f.name) + ',\n\n' +
          'Thank you for registering for ' + text(f.courseName || f.course) + (text(f.batch) ? ' (' + text(f.batch) + ')' : '') + '.\n\n' +
          'What happens next:\n' +
          '1. We check your payment.\n' +
          '2. We confirm your seat on WhatsApp or email.\n' +
          '3. We send you the class link and timetable before your first class.\n\n' +
          'If you have any question, reply to this email or message us on WhatsApp.\n\n' +
          ACADEMY
      });
    } catch (err) { console.error('Student email failed: ' + err); }
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Public: free demo class request                                     */
/* ------------------------------------------------------------------ */

function lead(body) {
  var f = body.fields || {};
  if (text(f.website)) return { ok: true };            // bot
  if (!text(f.name) || !text(f.mobile)) return { ok: false, error: 'Missing details' };
  if (!rateOk()) return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };

  var row = [new Date(), safeCell(f.name), safeCell(f.mobile), safeCell(f.course), safeCell(f.courseName), safeCell(f.note), 'New'];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { sheet(TAB.leads).appendRow(row); } finally { lock.releaseLock(); }

  try {
    MailApp.sendEmail({
      to: notifyEmail(),
      subject: 'Demo class request: ' + text(f.name) + ' - ' + text(f.courseName || f.course || 'no course chosen'),
      body: 'Someone asked for a free demo class.\n\n' +
        'Name: ' + text(f.name) + '\n' +
        'WhatsApp: ' + text(f.mobile) + '\n' +
        'Course: ' + text(f.courseName || f.course) + '\n' +
        'Note: ' + text(f.note) + '\n\n' +
        'All requests are in the Leads tab:\n' + SpreadsheetApp.getActive().getUrl()
    });
  } catch (err) { console.error('Email failed: ' + err); }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

function admin(body) {
  var check = checkPassword(body.password);
  if (!check.ok) return check;

  var result = adminAction(body);
  if (body.action !== 'adminLogin' && body.action !== 'adminData') bustCache();
  return result;
}

function adminAction(body) {
  switch (body.action) {
    case 'adminLogin':
      return { ok: true };

    case 'adminData':
      return {
        ok: true,
        courses: readRows(TAB.courses).map(cleanCourse),
        batches: readRows(TAB.batches).map(function (b) { var o = cleanBatch(b); o.row = b._row; return o; }),
        registrations: readRows(TAB.regs).map(function (r) {
          var o = { row: r._row };
          ['timestamp', 'courseName', 'batch', 'name', 'father', 'dob', 'gender', 'mobile', 'email', 'nationality', 'address', 'proof', 'status']
            .forEach(function (k) { o[k] = r[k] instanceof Date ? stampOf(r[k], 'yyyy-MM-dd HH:mm') : String(r[k] == null ? '' : r[k]); });
          return o;
        }).reverse().slice(0, ADMIN_LIST_LIMIT),
        leads: readRows(TAB.leads).map(function (r) {
          var o = { row: r._row };
          ['timestamp', 'name', 'mobile', 'courseName', 'note', 'status']
            .forEach(function (k) { o[k] = r[k] instanceof Date ? stampOf(r[k], 'yyyy-MM-dd HH:mm') : String(r[k] == null ? '' : r[k]); });
          return o;
        }).reverse().slice(0, ADMIN_LIST_LIMIT),
        results: readRows(TAB.results).map(function (r) { var o = cleanResult(r); o.row = r._row; o.show = isTrue(r.show); return o; }),
        settings: readSettings()
      };

    case 'adminSaveCourse':   return saveCourse(body.course || {});
    case 'adminDeleteCourse': return deleteCourse(text(body.id));
    case 'adminSaveBatch':    return saveBatch(body.batch || {});
    case 'adminDeleteBatch':  return deleteRow(TAB.batches, body.row);
    case 'adminSetStatus':    return setStatus(TAB.regs, body.row, text(body.status), ['New', 'Payment checked', 'Confirmed', 'Cancelled']);
    case 'adminSetLeadStatus': return setStatus(TAB.leads, body.row, text(body.status), ['New', 'Contacted', 'Demo done', 'Joined', 'Not interested']);
    case 'adminSaveResult':   return saveResult(body.result || {});
    case 'adminDeleteResult': return deleteRow(TAB.results, body.row);
    case 'adminSaveSettings': return saveSettings(body.settings || {});
  }
  return { ok: false, error: 'Unknown action' };
}

function saveCourse(c) {
  if (!text(c.name)) return { ok: false, error: 'Course name is required' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet(TAB.courses), rows = readRows(TAB.courses), headers = headersOf(sh);
    var existing = rows.filter(function (r) { return r.id === c.id; })[0];
    if (!existing) {
      var base = slug(c.id || c.name), id = base, n = 2;
      while (rows.some(function (r) { return r.id === id; })) id = base + '-' + (n++);
      c.id = id;
    }
    var values = headers.map(function (h) {
      if (h === 'show') return c.show === undefined ? true : isTrue(c.show);
      if (COURSE_FIELDS.indexOf(h) < 0) return existing ? existing[h] : '';
      return safeCell(c[h]);
    });
    if (existing) sh.getRange(existing._row, 1, 1, headers.length).setValues([values]);
    else sh.appendRow(values);
    return { ok: true, id: c.id };
  } finally { lock.releaseLock(); }
}

function deleteCourse(id) {
  if (!id) return { ok: false, error: 'Missing id' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var course = readRows(TAB.courses).filter(function (r) { return r.id === id; })[0];
    if (!course) return { ok: false, error: 'Course not found' };
    sheet(TAB.courses).deleteRow(course._row);
    // remove this course's batches too, from the bottom up so row numbers stay valid
    readRows(TAB.batches).filter(function (b) { return b.courseId === id; }).reverse()
      .forEach(function (b) { sheet(TAB.batches).deleteRow(b._row); });
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function saveBatch(b) {
  if (!text(b.courseId) || !text(b.start)) return { ok: false, error: 'Course and start date are required' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.start)) return { ok: false, error: 'Start date must be YYYY-MM-DD' };
  var parts = b.start.split('-');
  var values = [safeCell(b.courseId), new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])), safeCell(b.time), safeCell(b.seats)];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet(TAB.batches);
    if (validRow(sh, b.row)) sh.getRange(Number(b.row), 1, 1, 4).setValues([values]);
    else sh.appendRow(values);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function deleteRow(tab, row) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet(tab);
    if (!validRow(sh, row)) return { ok: false, error: 'Row not found' };
    sh.deleteRow(Number(row));
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function saveResult(r) {
  if (!text(r.name) || !text(r.quote)) return { ok: false, error: 'Name and quote are required' };
  var values = [safeCell(r.name), safeCell(r.course), safeCell(r.score), safeCell(r.quote), r.show === undefined ? true : isTrue(r.show)];
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet(TAB.results);
    if (validRow(sh, r.row)) sh.getRange(Number(r.row), 1, 1, 5).setValues([values]);
    else sh.appendRow(values);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

function setStatus(tab, row, status, allowed) {
  if (allowed.indexOf(status) < 0) return { ok: false, error: 'Unknown status' };
  var sh = sheet(tab);
  if (!validRow(sh, row)) return { ok: false, error: 'Row not found' };
  var col = headersOf(sh).indexOf('status') + 1;
  sh.getRange(Number(row), col).setValue(status);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Password check, with a lock-out after repeated wrong attempts       */
/* ------------------------------------------------------------------ */

function checkPassword(given) {
  var real = prop('ADMIN_PASSWORD');
  if (!real) return { ok: false, error: 'Admin is not set up yet' };
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('admin_fails') || 0);
  if (fails >= 8) return { ok: false, error: 'Too many wrong attempts. Try again in 15 minutes.' };
  if (!sameText(String(given || ''), real)) {
    cache.put('admin_fails', String(fails + 1), 900);
    return { ok: false, error: 'Wrong password' };
  }
  return { ok: true };
}

function sameText(a, b) {
  var x = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, a);
  var y = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b);
  var diff = 0;
  for (var i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function sheet(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing tab: ' + name);
  return sh;
}

function headersOf(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

/** Reads a tab into objects keyed by the header row. Each object also has _row (its sheet row number). */
function readRows(name) {
  var sh = sheet(name), last = sh.getLastRow();
  if (last < 2) return [];
  var headers = headersOf(sh);
  return sh.getRange(2, 1, last - 1, headers.length).getValues().map(function (r, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, c) { if (h) o[h] = r[c]; });
    return o;
  }).filter(function (o) { return headers.some(function (h) { return h && o[h] !== '' && o[h] !== null; }); });
}

function cleanCourse(c) {
  var o = {};
  COURSE_FIELDS.forEach(function (k) { o[k] = k === 'show' ? isTrue(c[k]) : String(c[k] == null ? '' : c[k]); });
  return o;
}

function cleanBatch(b) {
  return {
    courseId: String(b.courseId || ''),
    start: b.start instanceof Date ? stampOf(b.start, 'yyyy-MM-dd') : String(b.start || ''),
    time: String(b.time || ''),
    seats: String(b.seats == null ? '' : b.seats)
  };
}

/** Site settings (phone numbers, email, addresses...) kept in the Settings tab as key / value rows. */
function readSettings() {
  var sh = SpreadsheetApp.getActive().getSheetByName(TAB.settings);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    var k = String(r[0]).trim();
    if (SETTING_KEYS.indexOf(k) >= 0) out[k] = String(r[1] == null ? '' : r[1]);
  });
  return out;
}

function publicSettings() {
  var s = readSettings();
  PRIVATE_SETTINGS.forEach(function (k) { delete s[k]; });
  return s;
}

function saveSettings(input) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(TAB.settings) || ss.insertSheet(TAB.settings);
    var current = readSettings();
    var rows = SETTING_KEYS.map(function (k) {
      var v = Object.prototype.hasOwnProperty.call(input, k) ? String(input[k] == null ? '' : input[k]).trim().slice(0, 3000) : (current[k] || '');
      return [k, /^[=+\-@]/.test(v) ? "'" + v : v];
    });
    sh.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    sh.getRange(2, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/** Where registration and demo emails go: Settings tab, then the NOTIFY_EMAIL property, then the sheet owner. */
function notifyEmail() {
  var s = readSettings().notifyEmail;
  return (s && /@/.test(s)) ? s : (prop('NOTIFY_EMAIL') || Session.getEffectiveUser().getEmail());
}

function cleanResult(r) {
  return { name: String(r.name || ''), course: String(r.course || ''), score: String(r.score || ''), quote: String(r.quote || '') };
}

function bustCache() { CacheService.getScriptCache().remove('public_data'); }

/** Allows at most MAX_FORMS_PER_10_MIN public form submissions in any 10-minute window. */
function rateOk() {
  var cache = CacheService.getScriptCache();
  var key = 'forms_' + Math.floor(Date.now() / 600000);
  var n = Number(cache.get(key) || 0);
  if (n >= MAX_FORMS_PER_10_MIN) return false;
  cache.put(key, String(n + 1), 700);
  return true;
}

function proofFolder() {
  var found = DriveApp.getFoldersByName(PROOF_FOLDER);
  return found.hasNext() ? found.next() : DriveApp.createFolder(PROOF_FOLDER);
}

function validRow(sh, row) { row = Number(row); return row >= 2 && row <= sh.getLastRow() && Math.floor(row) === row; }
function isTrue(v) { return v === true || /^(true|yes|1)$/i.test(String(v)); }
function text(v) { return String(v == null ? '' : v).trim().slice(0, 2000); }
/** Stops a typed value from being run as a spreadsheet formula. */
function safeCell(v) { var s = text(v); return /^[=+\-@]/.test(s) ? "'" + s : s; }
function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'course'; }
function prop(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function stamp(fmt) { return stampOf(new Date(), fmt); }
function stampOf(d, fmt) { return Utilities.formatDate(d, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), fmt); }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/**
 * Run this once from the editor (Run > authorise).
 * It asks Google for the permissions the script needs: Sheets, Drive and sending email.
 */
function authorise() {
  proofFolder();
  MailApp.getRemainingDailyQuota();
  SpreadsheetApp.getActive().toast('Script authorised. You can deploy it now.');
}
