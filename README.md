# ACE Training Lab website

Plain HTML, CSS and JavaScript, served by GitHub Pages. Course data, demo
requests and registrations live in a Google Sheet, reached through a Google
Apps Script web app.

## Where to change things

| To change | Edit |
|---|---|
| Courses, fees, batches, student results | The admin page: `/admin/` |
| Phone numbers, email, addresses, payment accounts | `assets/js/config.js` |
| Google Analytics / Meta pixel IDs | `assets/js/config.js` |
| Instructors | `assets/js/data.js` |
| Header, footer, how pages are filled | `assets/js/site.js` |
| Colours and fonts | Top of `assets/css/style.css` |
| Page text (About, FAQs, Privacy, Terms) | The page file in `pages/` |

## Folders

- `index.html` home page
- `courses/` courses list, one page per course, and `course.html` for courses added later in admin
- `pages/` about, results, FAQs, contact, free demo class, privacy, terms
- `register/` registration form and thank-you page
- `admin/` admin page (password is set in the Apps Script, never in these files)
- `apps-script/Code.gs` copy of the script that runs inside the Google Sheet
- `assets/` styles, scripts, images

## Backend

The Apps Script web app address is `API_URL` in `assets/js/config.js`. If Google
cannot be reached, the site shows the course list stored in `assets/js/data.js`.

After changing `apps-script/Code.gs`, paste it into the sheet's Apps Script
editor and deploy a new version (Deploy > Manage deployments > edit > New version).

## Publishing

```
git add -A
git commit -m "Describe the change"
git push origin master:main
```
