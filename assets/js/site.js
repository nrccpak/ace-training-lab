/* ACE Training Lab — site script.
   Builds the header and footer on every page (one copy, here),
   loads the course list, and fills in the page that is open. */
(function () {
  'use strict';

  var ROOT = document.documentElement.getAttribute('data-root') || '';
  var PAGE = document.body.getAttribute('data-page') || '';
  var CFG = window.ACE_CONFIG;
  var GROUP_INFO = {
    'English tests': { image: 'course-english.jpg', who: 'Going abroad to study or work', text: 'English test preparation for students, nurses, doctors and anyone applying for a visa. All four skills: Listening, Reading, Writing and Speaking.' },
    'Academic': { image: 'course-aolevel.jpg', who: 'For school students and their parents', text: 'O Level and A Level tutoring to the Cambridge and Edexcel curriculum, and preparation for the SAT.' },
    'Quran': { image: 'course-quran.jpg', who: 'For children and adults, anywhere in the world', text: 'One-to-one attention for every student: recitation, Tajweed and Tafsir, at a time that suits your family.' }
  };
  var STATIC_IDS = ((window.ACE_DATA || {}).courses || []).map(function (c) { return c.id; });   // courses that have their own page file
  var CACHE_KEY = 'ace_data_v2';
  var CACHE_MINUTES = 10;

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return document.getElementById(id); }
  function img(file) {
    if (!file) return ROOT + 'assets/images/course-english.jpg';
    return /^https?:\/\//.test(file) ? file : ROOT + 'assets/images/' + file;
  }
  function waLink(text) {
    return 'https://api.whatsapp.com/send/?phone=' + CFG.whatsapp + (text ? '&text=' + encodeURIComponent(text) : '');
  }
  function courseUrl(c) {
    if (STATIC_IDS.indexOf(c.id) >= 0) return ROOT + 'courses/' + c.id + '.html';
    return ROOT + 'courses/course.html?id=' + encodeURIComponent(c.id);
  }
  function demoUrl(c) { return ROOT + 'pages/demo.html' + (c ? '?course=' + encodeURIComponent(c.id) : ''); }
  /** Sends an event to Google Analytics and the Meta pixel, if they are switched on in config.js. */
  function track(name, detail) {
    try { if (window.gtag) window.gtag('event', name, detail || {}); } catch (e) { /* ignore */ }
    try { if (window.fbq) window.fbq('track', name === 'demo_request' ? 'Lead' : name === 'registration' ? 'CompleteRegistration' : 'ViewContent', detail || {}); } catch (e) { /* ignore */ }
  }
  function loadAnalytics() {
    if (CFG.ga4Id) {
      var g = document.createElement('script'); g.async = true;
      g.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga4Id);
      document.head.appendChild(g);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', CFG.ga4Id);
    }
    if (CFG.metaPixelId) {
      var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      var p = document.createElement('script'); p.async = true; p.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(p);
      window.fbq('init', CFG.metaPixelId); window.fbq('track', 'PageView');
    }
  }
  function postForm(payload) {
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); });
  }
  function registerUrl(c, batch) {
    var u = ROOT + 'register/index.html';
    if (c) u += '?course=' + encodeURIComponent(c.id) + (batch ? '&batch=' + encodeURIComponent(batch) : '');
    return u;
  }
  function feeHtml(c) {
    if (!c.fee) return '<span class="price">Ask for fee</span>';
    return '<span class="price">Rs ' + esc(c.fee) + (c.oldFee ? ' <s>Rs ' + esc(c.oldFee) + '</s>' : '') + '</span>';
  }
  function isShown(c) { return !(c.show === false || /^(no|false|0)$/i.test(String(c.show))); }
  function groupsOf(courses) {
    var order = [], map = {};
    Object.keys(GROUP_INFO).forEach(function (g) { order.push(g); map[g] = []; });
    courses.forEach(function (c) {
      var g = c.group || 'Other';
      if (!map[g]) { map[g] = []; order.push(g); }
      map[g].push(c);
    });
    return order.filter(function (g) { return map[g].length; }).map(function (g) { return { name: g, courses: map[g] }; });
  }
  function fmtDate(s) {
    var d = new Date(s);
    if (isNaN(d)) return String(s);
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
  function batchLabel(b) { return fmtDate(b.start) + (b.time ? ', ' + b.time : ''); }
  function param(name) { return new URLSearchParams(location.search).get(name); }

  /* ---------- data ---------- */
  function loadData() {
    var fallback = window.ACE_DATA || { courses: [], batches: [] };
    if (!CFG.API_URL) return Promise.resolve(fallback);
    var cached = null;
    try {
      cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Date.now() - cached.at < CACHE_MINUTES * 60000) return Promise.resolve(cached.data);
    } catch (e) { cached = null; }
    return fetch(CFG.API_URL + '?action=data')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !Array.isArray(data.courses)) throw new Error('bad data');
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* storage blocked */ }
        return data;
      })
      .catch(function () { return cached ? cached.data : fallback; });
  }

  /** Contact details saved in the admin page replace the defaults from config.js. */
  function applySettings(s) {
    if (!s) return;
    var filled = function (v) { return String(v == null ? '' : v).trim(); };
    var digits = filled(s.whatsapp).replace(/[^0-9]/g, '');
    if (digits.length >= 8) CFG.whatsapp = digits;
    var phones = [s.phone1, s.phone2, s.phone3].map(filled).filter(Boolean);
    if (phones.length) CFG.phones = phones;
    if (/^[^@\s]+@[^@\s]+$/.test(filled(s.email))) CFG.email = filled(s.email);
    var addresses = [s.address1, s.address2].map(filled).filter(Boolean);
    if (addresses.length) CFG.addresses = addresses;
    if (filled(s.hours)) CFG.hours = filled(s.hours);
    if (filled(s.topbar)) CFG.topbar = filled(s.topbar);
    var accounts = filled(s.accounts).split('\n').map(function (line) {
      var parts = line.split('|').map(filled).filter(Boolean);
      return parts.length ? { bank: parts[0], lines: parts.slice(1) } : null;
    }).filter(Boolean);
    if (accounts.length) CFG.accounts = accounts;
  }

  /* ---------- header and footer ---------- */
  function renderLayout(courses) {
    var nav = [
      ['home', 'Home', 'index.html'],
      ['courses', 'Courses', 'courses/index.html'],
      ['about', 'About', 'pages/about.html'],
      ['results', 'Results', 'pages/results.html'],
      ['faqs', 'FAQs', 'pages/faqs.html'],
      ['contact', 'Contact', 'pages/contact.html']
    ];
    var section = { hub: 'courses', course: 'courses' }[PAGE] || PAGE;
    var drop = groupsOf(courses).map(function (g) {
      return '<div class="group-name">' + esc(g.name) + '</div>' + g.courses.map(function (c) {
        return '<a href="' + courseUrl(c) + '">' + esc(c.name) + '</a>';
      }).join('');
    }).join('');
    var items = nav.map(function (n) {
      var cls = n[0] === section ? ' class="active"' : '';
      if (n[0] !== 'courses') return '<li><a href="' + ROOT + n[2] + '"' + cls + '>' + n[1] + '</a></li>';
      return '<li class="has-drop"><a href="' + ROOT + n[2] + '"' + cls + '>Courses</a>' +
        '<div class="dropdown">' + drop + '</div></li>';
    }).join('');

    var header = $('site-header');
    if (header) {
      header.innerHTML =
        '<a href="#main" class="skip-link">Skip to content</a>' +
        '<div class="topbar"><div class="container"><span>' + esc(CFG.topbar || 'Live online classes with expert instructors') + '</span>' +
        '<div class="topbar-links"><a href="tel:' + CFG.phones[0].replace(/[^+\d]/g, '') + '">Call ' + esc(CFG.phones[0]) + '</a>' +
        '<a class="wa" href="' + waLink('Hello') + '" target="_blank" rel="noopener">WhatsApp +' + esc(CFG.whatsapp) + '</a></div></div></div>' +
        '<div class="site-header"><div class="container">' +
        '<a class="logo" href="' + ROOT + 'index.html"><img src="' + ROOT + 'assets/images/logo-gold.png" width="358" height="133" alt="ACE English Institute, home"></a>' +
        '<button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '<nav class="main-nav" aria-label="Main"><ul>' + items +
        '<li><a href="' + ROOT + 'register/index.html"' + (PAGE === 'register' ? ' class="active"' : '') + '>Register</a></li>' +
        '<li><a class="btn btn-gold" href="' + ROOT + 'pages/demo.html">Free demo class</a></li></ul></nav>' +
        '</div></div>';
      var toggle = header.querySelector('.nav-toggle');
      var menu = header.querySelector('.main-nav');
      toggle.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    var footer = $('site-footer');
    if (footer) {
      footer.innerHTML =
        '<footer class="site-footer"><div class="container"><div class="footer-grid">' +
        '<div><div class="footer-logo"><img src="' + ROOT + 'assets/images/logo-gold.png" width="358" height="133" loading="lazy" alt="ACE English Institute"></div>' +
        '<p>Quality education is the key to global opportunities and personal growth.</p></div>' +
        '<div><h3>Courses</h3>' + groupsOf(courses).map(function (g) {
          return '<a href="' + ROOT + 'courses/index.html#' + encodeURIComponent(g.name) + '">' + esc(g.name) + '</a>';
        }).join('') + '<a class="gold" href="' + ROOT + 'pages/demo.html">Free demo class</a><a href="' + ROOT + 'register/index.html">Register</a></div>' +
        '<div><h3>Contact</h3>' + CFG.phones.map(function (p) {
          return '<a href="tel:' + p.replace(/[^+\d]/g, '') + '">' + esc(p) + '</a>';
        }).join('') + '<a href="mailto:' + esc(CFG.email) + '">' + esc(CFG.email) + '</a></div>' +
        '<div><h3>Offices</h3>' + CFG.addresses.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') +
        '<p>' + esc(CFG.hours) + '</p></div>' +
        '</div><div class="footer-bottom"><span>&copy; ' + new Date().getFullYear() + ' ACE Training Lab</span>' +
        '<div><a href="' + ROOT + 'pages/privacy.html">Privacy Policy</a><a href="' + ROOT + 'pages/terms.html">Terms &amp; Conditions</a><a href="' + ROOT + 'admin/index.html">Admin</a></div>' +
        '</div></div></footer>' +
        '<a class="wa-float" href="' + waLink('Hello') + '" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-5.1A8.5 8.5 0 1 1 21 11.5z"></path></svg></a>' +
        (PAGE === 'demo' || PAGE === 'register' || PAGE === 'thanks' ? '' :
          '<div class="mobile-bar"><a class="btn btn-gold" href="' + ROOT + 'pages/demo.html">Free demo class</a>' +
          '<a class="btn btn-wa" href="' + waLink('Hello') + '" target="_blank" rel="noopener">WhatsApp</a></div>');
      document.body.classList.toggle('has-mobile-bar', !!footer.querySelector('.mobile-bar'));
    }

    document.querySelectorAll('[data-wa]').forEach(function (a) {
      a.href = waLink(a.getAttribute('data-wa') || 'Hello');
      a.target = '_blank'; a.rel = 'noopener';
    });
  }

  /* ---------- shared pieces ---------- */
  function instructorTile(key) {
    var p = (window.ACE_INSTRUCTORS || {})[key];
    if (!p) return '';
    return '<div class="tile"><img class="photo" loading="lazy" width="84" height="84" src="' + img(p.photo) + '" alt="' + esc(p.name) + '">' +
      '<div class="eyebrow">' + esc(p.role) + '</div><h3>' + esc(p.name) + '</h3><p>' + esc(p.bio) + '</p></div>';
  }
  function courseCard(c) {
    return '<div class="course-card"><img loading="lazy" width="400" height="384" src="' + img(c.image) + '" alt="' + esc(c.name) + '">' +
      '<div class="body"><h3>' + esc(c.name) + '</h3><p>' + esc(c.short) + '</p>' + (c.fee ? feeHtml(c) : '') +
      '<a class="btn btn-gold" href="' + courseUrl(c) + '">View Details</a></div></div>';
  }
  /** The study-material pack shown as the last card on the home page. */
  function materialCard() {
    return '<div class="course-card"><img loading="lazy" width="400" height="384" src="' + img('course-material.jpg') + '" alt="">' +
      '<div class="body"><h3>Digital Study Material</h3><p>IELTS mock tests, TOEFL resources, PTE exam papers and OET guides, all in one downloadable pack.</p>' +
      '<a class="btn btn-gold" target="_blank" rel="noopener" href="' + waLink('Hello, I would like the Digital Study Material pack.') + '">Get Material</a></div></div>';
  }
  function resultCard(r) {
    return '<figure class="result"><blockquote>&ldquo;' + esc(r.quote) + '&rdquo;</blockquote>' +
      '<figcaption><strong>' + esc(r.name) + '</strong>' + (r.course ? '<span>' + esc(r.course) + '</span>' : '') +
      (r.score ? '<span class="score">' + esc(r.score) + '</span>' : '') + '</figcaption></figure>';
  }
  function renderResults(data, limit) {
    var box = $('results');
    if (!box) return;
    var list = (data.results || []).filter(function (r) { return r.quote; });
    if (!list.length) return;                 // keep the built-in testimonial
    box.innerHTML = '<div class="grid grid-3">' + (limit ? list.slice(0, limit) : list).map(resultCard).join('') + '</div>';
  }

  /* ---------- pages ---------- */
  function pageHome(data) {
    var box = $('course-groups');
    if (box) {
      box.innerHTML = data.courses.map(courseCard).join('') + materialCard();
    }
    // anything on the page tied to a course (exam buttons, numbers) shows only while that course is on the website
    var shown = data.courses.map(function (c) { return c.id; });
    document.querySelectorAll('main [data-course]').forEach(function (el) {
      el.hidden = shown.indexOf(el.getAttribute('data-course')) < 0;
    });
    var people = $('instructors');
    if (people) {
      var all = Object.keys(window.ACE_INSTRUCTORS || {});
      var teaching = all.filter(function (k) { return data.courses.some(function (c) { return c.instructor === k; }); });
      people.innerHTML = (teaching.length ? teaching : all).map(instructorTile).join('');
    }
    renderResults(data, 3);
  }

  function pageResults(data) { renderResults(data, 0); }

  function pageHub(data) {
    var box = $('course-list');
    if (!box) return;
    box.innerHTML = groupsOf(data.courses).map(function (g) {
      var info = GROUP_INFO[g.name] || {};
      return '<section class="stack" id="' + esc(g.name) + '" style="gap:24px"><div class="stack" style="gap:6px">' +
        (info.who ? '<div class="eyebrow">' + esc(info.who) + '</div>' : '') + '<h2>' + esc(g.name) + '</h2></div>' +
        '<div class="course-grid">' + g.courses.map(courseCard).join('') + '</div></section>';
    }).join('');
  }

  function pageCourse(data) {
    var box = $('course');
    if (!box) return;
    var id = document.body.getAttribute('data-course') || param('id');
    var c = data.courses.filter(function (x) { return x.id === id; })[0];
    if (!c) {
      box.innerHTML = '<section class="page-hero"><div class="container"><h1>Course not found</h1>' +
        '<p class="muted">This course may have been removed.</p><div><a class="btn btn-navy" href="' + ROOT + 'courses/index.html">See all courses</a></div></div></section>';
      return;
    }
    /* Pages with their own file keep the search title written in the file. */
    if (!document.body.getAttribute('data-course')) document.title = c.name + ' | ACE Training Lab';
    track('view_course', { course: c.id });
    var facts = [['Level', c.level], ['Duration', c.duration], ['Mode', c.mode]].filter(function (f) { return f[1]; })
      .map(function (f) { return '<div class="fact"><small>' + f[0] + '</small><strong>' + esc(f[1]) + '</strong></div>'; }).join('');
    var learn = String(c.learn || '').split('\n').filter(function (l) { return l.trim(); }).map(function (line) {
      var i = line.indexOf(':');
      var title = i > 0 ? line.slice(0, i) : '';
      var text = i > 0 ? line.slice(i + 1).trim() : line;
      return '<div class="tile">' + (title ? '<h3>' + esc(title) + '</h3>' : '') + '<p>' + esc(text) + '</p></div>';
    }).join('');
    var batches = (data.batches || []).filter(function (b) { return b.courseId === c.id; });
    var batchHtml = batches.length
      ? '<div class="table-wrap"><table class="data"><thead><tr><th>Start date</th><th>Time</th><th>Seats left</th><th>Fee</th><th><span class="skip-link">Action</span></th></tr></thead><tbody>' +
        batches.map(function (b) {
          return '<tr><td class="strong">' + esc(fmtDate(b.start)) + '</td><td>' + esc(b.time) + '</td><td>' + esc(b.seats) + '</td><td>' +
            (c.fee ? 'Rs ' + esc(c.fee) : 'Ask') + '</td><td class="right"><a class="btn btn-navy btn-small" href="' + registerUrl(c, batchLabel(b)) + '">Register</a></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="box"><p>New batch dates are shared on WhatsApp. Message us and we will send you the next start date.</p>' +
        '<div><a class="btn btn-navy" target="_blank" rel="noopener" href="' + waLink('Hello, when is the next batch for ' + c.name + '?') + '">Ask for the next batch</a></div></div>';
    var teacher = instructorTile(c.instructor);

    box.innerHTML =
      '<section class="page-hero"><div class="container">' +
      '<div class="crumbs"><a href="' + ROOT + 'index.html">Home</a> / <a href="' + ROOT + 'courses/index.html">Courses</a> / ' + esc(c.group) + '</div>' +
      '<div class="course-top"><div class="grow"><div class="eyebrow">' + esc(c.group) + '</div><h1>' + esc(c.name) + '</h1>' +
      '<p class="muted" style="font-size:18px;max-width:600px">' + esc(c.short) + '</p><div class="facts">' + facts + '</div></div>' +
      '<aside class="fee-card"><span class="muted" style="font-size:14px">Course fee</span>' +
      (c.fee ? '<div><span class="big">Rs ' + esc(c.fee) + '</span>' + (c.oldFee ? ' <s>Rs ' + esc(c.oldFee) + '</s>' : '') + '</div>'
             : '<div class="big" style="font-size:28px">Ask us for the fee</div>') +
      '<a class="btn btn-gold" href="' + demoUrl(c) + '">Book a free demo class</a>' +
      '<a class="btn btn-navy" href="' + registerUrl(c) + '">Register for this course</a>' +
      '<a class="btn btn-line" target="_blank" rel="noopener" href="' + waLink('Hello, I want to know about ' + c.name) + '">Ask on WhatsApp</a></aside>' +
      '</div></div></section>' +
      (learn ? '<section class="section"><div class="container"><div class="section-head"><h2>What you will learn</h2></div><div class="grid">' + learn + '</div></div></section>' : '') +
      '<section class="section section-soft"><div class="container"><div class="section-head"><h2>Upcoming batches</h2></div>' + batchHtml + '</div></section>' +
      (teacher ? '<section class="section"><div class="container"><div class="section-head"><h2>Your instructor</h2></div><div class="grid" style="max-width:520px">' + teacher + '</div></div></section>' : '') +
      '<section class="section-blue"><div class="container split"><h2 class="grow">Ready to start ' + esc(c.name) + '?</h2>' +
      '<div class="btn-row"><a class="btn btn-gold" href="' + demoUrl(c) + '">Book a free demo class</a>' +
      '<a class="btn btn-line-white" href="' + registerUrl(c) + '">Register now</a>' +
      '<a class="btn btn-line-white" target="_blank" rel="noopener" href="' + waLink('Hello, I want to know about ' + c.name) + '">WhatsApp us</a></div></div></section>';
  }

  function pageAbout() {
    var people = $('instructors');
    if (people) people.innerHTML = Object.keys(window.ACE_INSTRUCTORS || {}).map(instructorTile).join('');
  }

  function pageContact() {
    var box = $('contact-details');
    if (!box) return;
    box.innerHTML =
      '<div class="tile"><h3>Phone</h3>' + CFG.phones.map(function (p) {
        return '<p><a href="tel:' + p.replace(/[^+\d]/g, '') + '">' + esc(p) + '</a></p>';
      }).join('') + '</div>' +
      '<div class="tile"><h3>Email</h3><p><a href="mailto:' + esc(CFG.email) + '">' + esc(CFG.email) + '</a></p></div>' +
      '<div class="tile"><h3>Offices</h3>' + CFG.addresses.map(function (a) { return '<p>' + esc(a) + '</p>'; }).join('') + '</div>' +
      '<div class="tile"><h3>Working hours</h3><p>' + esc(CFG.hours) + '</p><p>Sunday closed</p></div>';
  }

  function pageRegister(data) {
    var form = $('reg-form');
    if (!form) return;
    var courseSel = $('r-course'), batchSel = $('r-batch'), batchField = $('batch-field');
    var sumName = $('sum-name'), sumFee = $('sum-fee'), msg = $('reg-msg');
    var wanted = param('course'), wantedBatch = param('batch');

    courseSel.innerHTML = '<option value="">Select a course</option>' + groupsOf(data.courses).map(function (g) {
      return '<optgroup label="' + esc(g.name) + '">' + g.courses.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === wanted ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');

    function current() { return data.courses.filter(function (c) { return c.id === courseSel.value; })[0]; }
    function refresh() {
      var c = current();
      sumName.textContent = c ? c.name : 'No course selected';
      sumFee.textContent = c ? (c.fee ? 'Rs ' + c.fee : 'We will confirm the fee') : '–';
      var list = c ? (data.batches || []).filter(function (b) { return b.courseId === c.id; }) : [];
      batchField.style.display = list.length ? '' : 'none';
      batchSel.innerHTML = list.map(function (b) {
        var label = batchLabel(b);
        return '<option' + (label === wantedBatch ? ' selected' : '') + '>' + esc(label) + '</option>';
      }).join('');
    }
    courseSel.addEventListener('change', refresh);
    refresh();

    $('accounts').innerHTML = CFG.accounts.map(function (a) {
      return '<div class="acct"><b>' + esc(a.bank) + '</b>' + a.lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
    }).join('');

    function show(kind, text) { msg.className = 'form-msg show ' + kind; msg.textContent = text; msg.scrollIntoView({ block: 'center' }); }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!CFG.API_URL) {
        show('info', 'Online registration is not connected yet. Please send your details on WhatsApp for now.');
        return;
      }
      var file = $('r-proof').files[0];
      if (file && file.size > 10 * 1024 * 1024) { show('error', 'The payment screenshot is larger than 10 MB. Please choose a smaller file.'); return; }
      var c = current();
      var fields = {};
      new FormData(form).forEach(function (v, k) { if (typeof v === 'string') fields[k] = v; });
      fields.courseName = c ? c.name : '';
      var button = form.querySelector('button[type=submit]');
      button.disabled = true; button.textContent = 'Sending…';

      function send(proof) {
        postForm({ action: 'register', fields: fields, proof: proof }).then(function (res) {
          if (!res || !res.ok) throw new Error('failed');
          track('registration', { course: fields.course });
          location.href = 'thank-you.html';
        }).catch(function () {
          button.disabled = false; button.textContent = 'Submit registration';
          show('error', 'Your registration could not be sent. Please try again, or send it to us on WhatsApp.');
        });
      }
      if (!file) { send(null); return; }
      var reader = new FileReader();
      reader.onload = function () { send({ name: file.name, type: file.type, data: String(reader.result).split(',')[1] }); };
      reader.onerror = function () { button.disabled = false; button.textContent = 'Submit registration'; show('error', 'The file could not be read. Please choose it again.'); };
      reader.readAsDataURL(file);
    });
  }

  function pageDemo(data) {
    var form = $('demo-form');
    if (!form) return;
    var sel = $('d-course'), msg = $('demo-msg'), wanted = param('course');
    sel.innerHTML = '<option value="">Not sure yet</option>' + groupsOf(data.courses).map(function (g) {
      return '<optgroup label="' + esc(g.name) + '">' + g.courses.map(function (c) {
        return '<option value="' + esc(c.id) + '"' + (c.id === wanted ? ' selected' : '') + '>' + esc(c.name) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
    function show(kind, text) { msg.className = 'form-msg show ' + kind; msg.textContent = text; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var c = data.courses.filter(function (x) { return x.id === sel.value; })[0];
      var fields = { name: $('d-name').value, mobile: $('d-mobile').value, course: sel.value, courseName: c ? c.name : '', note: $('d-note').value, website: $('d-website').value };
      var wa = waLink('Hello, I would like a free demo class' + (c ? ' for ' + c.name : '') + '. My name is ' + fields.name + '.');
      if (!CFG.API_URL) { location.href = wa; return; }
      var button = form.querySelector('button[type=submit]');
      button.disabled = true; button.textContent = 'Sending…';
      postForm({ action: 'lead', fields: fields }).then(function (res) {
        if (!res || !res.ok) throw new Error('failed');
        track('demo_request', { course: fields.course });
        form.innerHTML = '<div class="stack"><div class="eyebrow">Request received</div><h2>Thank you, ' + esc(fields.name) + '</h2>' +
          '<p class="muted">We will message you on WhatsApp to arrange your free demo class.</p>' +
          '<div class="btn-row"><a class="btn btn-navy" target="_blank" rel="noopener" href="' + wa + '">Message us now on WhatsApp</a>' +
          '<a class="btn btn-line" href="' + ROOT + 'courses/index.html">See all courses</a></div></div>';
      }).catch(function () {
        button.disabled = false; button.textContent = 'Request my free demo class';
        show('error', 'Your request could not be sent. Please use the WhatsApp button instead.');
      });
    });
  }

  /* ---------- start ---------- */
  loadAnalytics();
  // Show the header and footer at once, from the last saved copy of the course list (or the built-in one).
  // Everything is drawn again as soon as the live list arrives from the Google Sheet.
  (function () {
    var first = null;
    try { first = (JSON.parse(localStorage.getItem(CACHE_KEY) || 'null') || {}).data; } catch (e) { first = null; }
    first = first || window.ACE_DATA || { courses: [] };
    applySettings(first.settings);
    renderLayout((first.courses || []).filter(isShown));
  })();
  loadData().then(function (data) {
    applySettings(data.settings);
    data = { courses: (data.courses || []).filter(isShown), batches: data.batches || [], results: data.results || [] };
    renderLayout(data.courses);
    ({ home: pageHome, hub: pageHub, course: pageCourse, about: pageAbout, contact: pageContact, register: pageRegister, demo: pageDemo, results: pageResults }[PAGE] || function () {})(data);
    if (location.hash && PAGE === 'hub') {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  });
})();
