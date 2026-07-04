# ACE Training Lab — Website

This is a complete, independent rebuild of the ACE Training Lab website as
plain HTML, CSS, and JavaScript. There is no WordPress, no page builder, and
no database — just static files you fully own and can edit yourself.

## Project structure

```
ielet/
├── index.html                  ← Homepage
├── pages/                      ← Every other page
│   ├── about-us.html
│   ├── our-courses.html        ← Course hub (links to the 7 course pages below)
│   ├── ielts-academic-general.html
│   ├── oet-for-healthcare-professionals.html
│   ├── toefl-pte-langcert.html
│   ├── sat.html
│   ├── a-o-level-subjects.html
│   ├── quran-classes-with-tajweed.html
│   ├── online-english-spoken-course.html
│   ├── faqs.html
│   ├── testimonial.html
│   ├── contact-us.html
│   ├── registration.html       ← Standalone enrollment/payment form (no header/footer)
│   └── thankyou-for-enrolling.html
├── assets/
│   ├── css/style.css           ← All styling, organized into numbered sections
│   ├── js/main.js              ← Mobile menu, FAQ accordion, form submission
│   └── images/                 ← All photos, logo, icons
└── README.md                   ← You are here
```

## How to edit content (no coding experience needed)

Every page is a plain `.html` file you can open in any text editor (Notepad,
VS Code, etc.) or even Word-like tools that support HTML.

- **Text**: find the sentence you want to change and type over it. Text sits
  between tags like `<p>...</p>` or `<h2>...</h2>` — just edit what's between
  the tags, not the tags themselves.
- **Images**: replace a file in `assets/images/` with a new image **using the
  exact same filename**, and it will update everywhere it's used. To use a
  different filename, also update the `src="assets/images/..."` reference in
  the HTML.
- **Colors / fonts**: open `assets/css/style.css` and look at the very top —
  section `1. CSS VARIABLES`. Every color used across the whole site is
  defined once there (e.g. `--color-navy`, `--color-accent-on-dark`). Change
  a value there and it updates everywhere.
- **Navigation menu / footer**: the header and footer are repeated at the top
  and bottom of every page (since this is plain HTML with no shared
  template engine). If you add/rename a page, update the menu in **every**
  HTML file — search for `<nav class="main-nav">` and `<footer class="site-footer">`.
- **Adding a new course page**: copy an existing course page (e.g.
  `pages/toefl-pte-langcert.html`), rename the file, edit its content, then
  add a link to it from `pages/our-courses.html` and the main nav menu.

## The enrollment forms (Formspree)

There are two forms on this site, both currently pointing to **placeholder**
Formspree endpoints that will NOT work until you set them up:

1. **"Enroll Now" widget** — the floating form in the bottom-right corner on
   every page (and the extra form on the Contact Us page). Placeholder:
   `YOUR_FORMSPREE_ENROLL_ID`
2. **Registration form** — the detailed form on `pages/registration.html`,
   including a file upload for the payment screenshot. Placeholder:
   `YOUR_FORMSPREE_REGISTRATION_ID`

### Setting up Formspree (takes ~5 minutes)

1. Go to [formspree.io](https://formspree.io) and sign up for a free account
   using **infoacetraininglab@gmail.com** (or whichever inbox should receive
   submissions).
2. Click **"New Form"**, name it e.g. "Enroll Now", and copy the form
   endpoint it gives you — it looks like `https://formspree.io/f/abcd1234`.
3. In every HTML file, find `YOUR_FORMSPREE_ENROLL_ID` (it appears once per
   page, inside the floating Enroll Now widget, plus once extra on
   `contact-us.html`) and replace it with your real ID, e.g. `abcd1234`.
4. Repeat steps 2–3 for a second form named e.g. "Registration" and replace
   `YOUR_FORMSPREE_REGISTRATION_ID` in `pages/registration.html`.
5. The **first submission** to each new endpoint triggers a confirmation
   email from Formspree — you must click the link in that email once to
   activate the form before it will forward any further submissions.
6. Formspree's free plan includes 50 submissions/month and supports file
   attachments up to 10MB, which covers the Registration form's payment
   screenshot upload.

You can find every placeholder quickly by searching your editor for
`YOUR_FORMSPREE` across the whole project folder.

### How the forms behave

Both forms submit via JavaScript (see `assets/js/main.js`) so the visitor
sees an inline "Thanks, we got it" message instead of leaving the page. If
JavaScript is disabled, the form still submits normally via a full page
POST to Formspree.

A `pages/thankyou-for-enrolling.html` page is included but not required —
it exists in case you'd rather redirect visitors to a real "thank you" page
instead of showing the inline message (you'd wire this up via Formspree's
`_next` hidden field if you want that behavior later).

## Deploying to GitHub Pages

1. Create a new GitHub repository (or use an existing one).
2. Push this entire folder to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial site"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages**.
4. Under "Build and deployment", set **Source** to "Deploy from a branch",
   choose the **main** branch and **/ (root)** folder, then **Save**.
5. GitHub will give you a live URL, typically
   `https://YOUR-USERNAME.github.io/YOUR-REPO/` within a minute or two.
6. If you're using a custom domain (e.g. acetraininglab.com), add it under
   "Custom domain" in the same Pages settings, and update your domain's DNS
   records to point to GitHub Pages (GitHub shows the exact records needed).

### Redeploying after edits

Every time you edit a file locally, redeploy with:
```bash
git add .
git commit -m "Describe what you changed"
git push
```
GitHub Pages automatically rebuilds within a minute of the push — no build
step required since this is plain HTML/CSS/JS.

### Previewing changes locally before pushing

Because the site uses relative file paths, you can just double-click
`index.html` to open it in a browser and it will work. If you want the most
accurate local preview (matching how it behaves once deployed), run a
simple local server from the project folder instead:
```bash
python -m http.server 8000
```
then open `http://localhost:8000/` in your browser.

## Notes on what changed from the original site

- **Color scheme &amp; font**: restyled to a blue (`#024793`) / navy
  (`#012d5d`) / white palette using a single font family (Poppins), inspired
  by a reference site the site owner liked. The original ACE navy/gold +
  Roboto/Roboto Slab/Inter look is gone; every color lives in the
  `CSS VARIABLES` section at the top of `assets/css/style.css` if you want
  to adjust it further or revert.
- **Course cards**: redesigned as a "poster" style — photo on top, bold blue
  gradient panel below with a big uppercase course name — instead of the
  original's plain white card body. Built with live HTML/CSS (not a
  flattened image), so the text stays fully editable.
- **"Our Courses" page**: the original WordPress page repeated some course
  card descriptions across mismatched cards (e.g. the Quran Classes blurb
  appeared under the PTE card). This rebuild shows each of the 7 courses
  with its own correct description.
- **IELTS course schedule table**: the original site auto-generated a
  rolling list of upcoming class dates from the WordPress database. Since
  this static site has no database, the dates in
  `pages/ielts-academic-general.html` are a fixed example — search that
  file for the schedule `<table>` and update the dates/seats/prices by hand
  periodically.
- A small typo in the original Online English Spoken Course page
  ("ransform your English...") was corrected to "Transform your English...".
