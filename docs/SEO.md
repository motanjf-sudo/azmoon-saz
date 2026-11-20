# SEO plan for pazmoonak.com

This document lists every SEO improvement we found for Pazmoonak, why each one matters, and exactly how to do it. It comes with the `seo-improvements` branch, which already contains the low-risk code changes (section 1). Everything else needs either server access (section 3), product work (sections 5–6), or work outside the codebase (section 8).

**Audit date:** 2026-11-19. All "live" findings were tested against https://pazmoonak.com on that day.

---

## Contents

0. [Summary and priority list](#0-summary-and-priority-list)
1. [What this branch changes](#1-what-this-branch-changes)
2. [How to deploy this branch](#2-how-to-deploy-this-branch)
3. [Server (nginx) changes: needs root on the server](#3-server-nginx-changes)
4. [Persian (Farsi) SEO rules for anyone writing content](#4-persian-farsi-seo-rules)
5. [Content plan: the biggest growth opportunity](#5-content-plan)
6. [Product/code work that unlocks more SEO](#6-productcode-work)
7. [Performance (Core Web Vitals)](#7-performance-core-web-vitals)
8. [Off-page SEO: links, brand, social](#8-off-page-seo)
9. [Measuring results](#9-measuring-results)
10. [Risks specific to an Iranian-hosted site](#10-risks-specific-to-an-iranian-hosted-site)
11. [What is already good (do not break it)](#11-what-is-already-good)

---

## 0. Summary and priority list

The site has a better SEO base than most Persian sites: real 404s, canonical tags, clean Persian text, five well-written guide pages with structured data. It is held back by **a thin home page (fixed in this branch), a duplicate `www` host, crawl and index settings for shared quiz links, no static-file caching, and too little content.**

| Priority | Task | Where | Effort | Section |
|---|---|---|---|---|
| 🔴 Now | Merge this branch and run `pz-front` | repo + server | 10 min | 1, 2 |
| 🔴 Now | Redirect `www.pazmoonak.com` → `pazmoonak.com` (301) | nginx | 15 min | 3.1 |
| 🔴 Now | `X-Robots-Tag: noindex` on app routes, then unblock them in robots.txt | nginx + robots.txt | 20 min | 3.2 |
| 🔴 Now | Start the per-grade «نمونه سوال» pages (Dey exams start ~22 Dec) | content | ongoing | 5.1 |
| 🟠 Soon | Browser caching for fonts, images and versioned JS | nginx | 20 min | 3.3 |
| 🟠 Soon | HSTS, and HTTP/2 check | nginx | 10 min | 3.4 |
| 🟠 Soon | About / Contact / Privacy / Terms pages | content + `pz-front` | 2–3 h | 6.1 |
| 🟠 Soon | Search Console + Bing Webmaster + IndexNow | outside | 1 h | 9 |
| 🟡 Later | Public quiz library (opt-in indexable quizzes) | product | days | 6.2 |
| 🟡 Later | More long-tail guide pages | content | ongoing | 5.2 |
| 🟡 Later | Links from other sites, Aparat videos, Virgool articles | outside | ongoing | 8 |
| 🟡 Later | Subset the Vazirmatn font, check Lighthouse | code | 1–2 h | 7 |

---

## 1. What this branch changes

Everything here is the kind of change that can only help: no URL changes, no removed content, no behavior changes for logged-in users.

### 1.1 Home page has real, visible content (`index.html`)

**Problem.** The home page had about 189 words of Persian text and **no `<h2>`**. Google ranks pages on their text, so the most important page on the site had almost nothing to rank with. Its `FAQPage` structured data also described questions that **were not visible on the page**, which is against Google's structured-data guidelines and can lead to a manual action.

**Change.**
- New `<section id="homeSeo" class="home-seo">` between `<main id="app">` and the footer, with:
  - an introductory H2 and two paragraphs,
  - four cards linking to the four main guide pages (internal links with descriptive anchor text),
  - a features list, a "who is it for" paragraph,
  - a **visible FAQ** whose questions and answers are **character-for-character the same** as the `FAQPage` JSON-LD in `<head>`.
- It sits **under** the app's quiz list, so returning users still see their quizzes first.
- It is shown only on `/`: the existing inline `syncHero()` script now also toggles `#homeSeo` (`hidden` when `location.pathname !== '/'`), and CSS hides it while the sign-up gate (`html.gate-on`) is open.
- Styles were added at the end of the main `<style>` block (`.home-seo`, `.hs-grid`, `.hs-card`, `.hs-faq`) using the existing design tokens, so light and dark themes both work, and a one-column layout below 640px.

**Result** (measured with the audit script): Persian words on the home page went from 189 to 706, and H2s from 0 to 5.

> ⚠️ **Rule for the future:** if you edit the FAQ, edit **both** the visible `<details>` in `#homeSeo` and the `FAQPage` JSON-LD in `<head>`. They must say the same thing.

### 1.2 Home title and H1 lead with the keyword (`index.html`, `app.js`)

- `<title>`, `og:title`, `twitter:title`: `پازمونک | ساخت آزمون آنلاین با هوش مصنوعی` → `ساخت آزمون آنلاین با هوش مصنوعی | پازمونک`. Google weights the start of the title more heavily, and the brand name already appears in the site name.
- `app.js` `setTitle()` (line ~322) produced the old title on the home route, and Google renders JavaScript, so it was updated to match. Without that, the two titles would disagree.
- The H1 now reads «**آزمون آنلاین** بساز، لینکش را بفرست، نتیجه را ببین.», the same slogan with the main keyword in it.

### 1.3 Guide pages use the spelling people actually type (`pages/*.html`)

Persian users type **«سوال»** (no hamza) far more often than **«سؤال»**, and Google doesn't treat the two as fully identical. The page bodies used only «سؤال». In this branch, the topic headings use «سوال», while body text and FAQ headings keep «سؤال», so each page now contains both spellings:

| Page | Heading changed to |
|---|---|
| `azmoon-az-pdf` | `ساخت سوال از جزوه در سه قدم` |
| `azmoon-hoosh-masnoei` | `طراحی سوال با هوش مصنوعی در چهار قدم` |
| `azmoon-testi` | `اصول طراحی سوال تستی استاندارد` |
| `azmoon-online` | `ساخت سوال با هوش مصنوعی` (h3) |
| `azmoon-baraye-moalem` | `سوال از کتاب درسی` (h3) |

### 1.4 Social preview tags on guide pages

Added `og:image:type` and `og:image:alt` to all five guide pages (the home page already had them). Telegram, Bale, WhatsApp and Instagram use these for link previews.

### 1.5 Smaller logo (`logo/mark.png`)

The logo was 404×288 pixels (51.6 KB) but is never shown larger than 73×52. It is now 219×156 (3× the largest display size, so it stays sharp on high-DPI phones), at **21.4 KB**. Same file name, so no references changed. It loads on every page, above the fold.

### 1.6 Google Search Console verification file

`google7f789168ae62f4be.html` was added so a second Google account can verify the site in Search Console with the HTML-file method. **Site owner: only merge this if you want that account to become a verified owner.** The simpler alternative is to keep it out and add the person under *Search Console → Settings → Users and permissions*. The existing `google4a70cfee1665d685.html` must stay.

### 1.7 What was checked before committing

- All JSON-LD blocks on all pages parse as valid JSON.
- Every `FAQPage` question and answer appears as visible text on its page.
- Tag balance check on all pages (no unclosed `section/div/details/...`).
- `node --check app.js` and the inline script in `index.html` pass.
- The home page was rendered in headless Chrome: the new section appears below the quiz list and matches the existing design.

---

## 2. How to deploy this branch

The live site is **not** GitHub Pages. It is nginx on the Iranian server, updated by `pz-front` (installed by `seo-install.sh`), which downloads `main` from GitHub. GitHub Pages only redirects to pazmoonak.com.

1. Review and merge `seo-improvements` into `main`.
2. On the server, run `pz-front`. It copies `index.html`, `app.js` (with a new `?v=` hash), the guide pages, `logo/*` and `google*.html`.
3. Check it:
   ```bash
   curl -s https://pazmoonak.com/ | grep -c 'id="homeSeo"'          # 1
   curl -s https://pazmoonak.com/ | grep -o '<title>[^<]*'          # ساخت آزمون آنلاین ...
   curl -s https://pazmoonak.com/azmoon-testi | grep -c 'طراحی سوال' # 1
   curl -sI https://pazmoonak.com/logo/mark.png | grep -i content-length   # ~21424
   ```
4. Open https://pazmoonak.com/ logged out and logged in, and open `/create` to make sure the new section is **not** shown there.
5. In Search Console: *URL Inspection → https://pazmoonak.com/ → Request indexing*.

---

## 3. Server (nginx) changes

These need root on the server. Back up first, run `nginx -t` before every reload, and keep a root shell open while testing.

```bash
cp -p /etc/nginx/sites-available/pazmoonak-front /root/pazmoonak-front.bak-$(date +%Y%m%d-%H%M%S)
```

> **nginx gotcha:** `add_header` is **not inherited** into a `location` block that has its own `add_header`. Every new `location` that adds a header must repeat the security headers already in `location /` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Content-Security-Policy`). `seo-install.sh` already does this for the app-route block.

### 3.1 Redirect `www` to the main domain (301) 🔴

**Problem (tested live).**
```
http://www.pazmoonak.com/   → 301 → https://www.pazmoonak.com/
https://www.pazmoonak.com/  → 200 (full copy of the site)
```
That's a second, complete copy of the site. The canonical tag points to `https://pazmoonak.com/`, which reduces the damage, but Google still has to crawl both, and links to `www` split ranking signals.

**Fix.** In the HTTPS `server { ... }` block for `pazmoonak.com` (if `www` is in the same block's `server_name`), add at the top:
```nginx
if ($host = www.pazmoonak.com) { return 301 https://pazmoonak.com$request_uri; }
```
and in the port-80 block, send everything straight to the main domain (one hop, not two):
```nginx
return 301 https://pazmoonak.com$request_uri;
```
(`if` with only `return` inside is safe in nginx.) The TLS certificate already covers `www`, since it serves HTTPS today.

**Check.**
```bash
curl -sI https://www.pazmoonak.com/azmoon-testi | grep -iE '^(HTTP|location)'
# HTTP/1.1 301 ... Location: https://pazmoonak.com/azmoon-testi
curl -sI http://www.pazmoonak.com/ | grep -i location     # https://pazmoonak.com/
```

### 3.2 Keep app routes out of Google properly 🔴

**Problem.** `robots.txt` has `Disallow: /q/`, `/m/` and so on. robots.txt stops **crawling**, not **indexing**. Quiz links (`/q/<id>`) get shared widely in Telegram, Bale and WhatsApp groups. Google learns those URLs from links but is not allowed to fetch them, so it never sees the `noindex` that `app.js` adds. Result: entries in search results like "No information is available for this page", reported in Search Console as *"Indexed, though blocked by robots.txt"*. Also, the raw HTML of these routes says `index,follow` with canonical `/` until the JavaScript runs.

**Fix: two steps, in this order.**

1. **First**, in the existing app-routes block that `seo-install.sh` created (`location ~ ^/(create|q|m|edit|g|groups|signup|tutor|tokens|wallet|admin|account)(/|$)`), add:
   ```nginx
   add_header X-Robots-Tag "noindex, nofollow" always;
   ```
   Check:
   ```bash
   curl -sI https://pazmoonak.com/q/abc123 | grep -i x-robots-tag   # noindex, nofollow
   curl -sI https://pazmoonak.com/ | grep -i x-robots-tag           # (nothing!)
   curl -sI https://pazmoonak.com/azmoon-online | grep -i x-robots  # (nothing!)
   ```
2. **Only after step 1 is live**, remove these lines from `robots.txt` so Google can fetch the pages and see the `noindex`: `/q/ /m/ /edit/ /g/ /groups /signup /tutor /create`. You can keep `/admin`, `/wallet`, `/tokens`, `/account`, since nobody shares links to them.

   ⚠️ Doing step 2 without step 1 would let Google crawl the app pages, whose raw HTML says `index`. That's why this branch does **not** change `robots.txt`.

Optional: the 404 page already has `noindex`; nothing to do there.

### 3.3 Browser caching for static files 🟠

**Problem (tested live).** Every file is served with `Cache-Control: no-cache`, including `vazirmatn.woff2` (111 KB), `logo/mark.png`, the favicons and `og-image.png`. Every page view re-checks all of them with the server; on slow Iranian mobile networks each check is a round trip. `app.js` and `config.js` already get a content hash (`?v=…`) from `pz-front`, so they can be cached for a year.

**Fix.**

`/etc/nginx/conf.d/pz-cache.conf` (http context):
```nginx
# versioned JS (index.html links /app.js?v=<hash>): cache forever; unversioned: always revalidate
map $arg_v $pz_js_cache {
    ""      "no-cache";
    default "public, max-age=31536000, immutable";
}
```
In the `pazmoonak.com` server block (before `location /`):
```nginx
location = /vazirmatn.woff2 {
    add_header Cache-Control "public, max-age=31536000, immutable" always;
    # + repeat security headers
}
location ~* ^/(logo/.+|favicon[^/]*|apple-touch-icon\.png|og-image\.png)$ {
    add_header Cache-Control "public, max-age=604800" always;   # 7 days: logo may change again
    # + repeat security headers
}
location ~ ^/(app|config)\.js$ {
    add_header Cache-Control $pz_js_cache always;
    # + repeat security headers
}
```
Keep `no-cache` for HTML, `lp.css`, `katex-bundle.js`, `robots.txt` and `sitemap.xml`, since they're not versioned. If you later add `?v=` to `lp.css` in `pz-front` like `app.js`, it can be cached the same way.

**Check.**
```bash
curl -sI https://pazmoonak.com/vazirmatn.woff2 | grep -i cache-control
curl -s https://pazmoonak.com/ | grep -o 'app.js?v=[0-9a-f]*' | head -1   # then:
curl -sI "https://pazmoonak.com/app.js?v=<that hash>" | grep -i cache-control   # immutable
curl -sI https://pazmoonak.com/ | grep -i cache-control                    # no-cache
```

### 3.4 HSTS and HTTP/2 🟠

- **HSTS** (no header today). In the HTTPS server block:
  ```nginx
  add_header Strict-Transport-Security "max-age=86400" always;
  ```
  Start with one day; after a week with no problems, raise it to `max-age=31536000`. Add `; includeSubDomains` only if **every** subdomain (including `api.`) is HTTPS-only. Remember the inheritance gotcha: this header must also be repeated in locations that have their own `add_header`.
- **HTTP/2:** check that the `listen 443 ssl` line also has `http2` (nginx 1.24 syntax: `listen 443 ssl http2;`). It lets the browser load the many small files in parallel over one connection. Check with `curl -sI --http2 https://pazmoonak.com/ | head -1` from a machine whose curl supports HTTP/2.
- **gzip is already on** for HTML/CSS/JS (tested). Also add `image/svg+xml application/json application/manifest+json` to `gzip_types` if they're missing. Brotli is optional (needs a module).

---

## 4. Persian (Farsi) SEO rules

Rules for anyone writing pages, titles or descriptions. The existing pages already follow 1–3; keep it that way.

1. **Persian ی and ک only, never Arabic ي and ك.** Text pasted from Word, some PDFs, or older Iranian systems often contains the Arabic letters. Google can treat «آزمون ساز» typed with Arabic ي as a different word. Check with:
   ```bash
   grep -nP '[\x{064A}\x{0643}]' index.html pages/*.html   # must print nothing
   ```
2. **Half-space (ZWNJ, U+200C) in compounds:** «می‌شود»، «آزمون‌ها»، «آزمون‌ساز». Google treats the half-space like a word boundary, so «آزمون‌ساز» still matches the search «آزمون ساز».
3. **Persian digits (۰–۹) in body text** are fine and look right. In `<title>` and meta description, use them consistently too.
4. **Use the forms people type.** Search queries are informal and often unpunctuated. Put the common form in titles and headings, and the "correct" form in body text, so both appear:
   | People type | Formal | Advice |
   |---|---|---|
   | سوال | سؤال | headings and titles: سوال; body: either |
   | آزمون ساز | آزمون‌ساز | title: with a space; body: half-space |
   | ازمون (no madda) | آزمون | Google usually maps it; don't write ازمون on purpose |
   | درست و غلط | درست/نادرست | use both on the testi page |
   | امتحان آنلاین | آزمون آنلاین | use both: teachers say «امتحان», sites say «آزمون» |
   | نمونه سوال | – | the biggest education query family (section 5.1) |
   | کوییز / کوئیز | – | young users; mention once on relevant pages |
5. **One topic per page, no self-competition.** Each URL should have one main phrase. Current map:
   | URL | Main phrase |
   |---|---|
   | `/` | ساخت آزمون آنلاین (+ brand پازمونک) |
   | `/azmoon-online` | آزمون ساز آنلاین رایگان |
   | `/azmoon-hoosh-masnoei` | ساخت آزمون با هوش مصنوعی / طراحی سوال با هوش مصنوعی |
   | `/azmoon-az-pdf` | ساخت سوال از PDF / تبدیل جزوه به آزمون |
   | `/azmoon-baraye-moalem` | آزمون آنلاین برای معلمان / امتحان آنلاین مدارس |
   | `/azmoon-testi` | ساخت آزمون تستی / چهارگزینه‌ای |

   Before adding a page, check that its main phrase isn't already another page's main phrase.
6. **Titles:** about 50–65 characters, main phrase first, `| پازمونک` last. **Descriptions:** about 120–160 characters, with one concrete benefit («رایگان»، «بدون نصب»، «نتیجه‌ی زنده»). Persian snippets are cut by pixel width, so check the preview in Search Console.
7. **Slugs in Latin (Finglish), as today** (`azmoon-testi`). Persian URLs work, but they turn into long `%D8%…` strings when shared in messengers, which looks like spam. Keep the current style.
8. **`lang="fa" dir="rtl"`** on `<html>` and **`og:locale=fa_IR`**: already correct, keep them on every new page. No `hreflang` is needed while the site is Persian-only.

---

## 5. Content plan

Google can only rank pages that exist. Pazmoonak has 6 indexable pages; competitors in the Iranian education niche have hundreds. This is the largest lever.

### 5.1 «نمونه سوال» pages per grade and subject 🔴 (time-sensitive)

**Why.** Searches like «نمونه سوال ریاضی هفتم نوبت اول»، «نمونه سوال علوم نهم با جواب»، «امتحان دی ماه فارسی هشتم» are among the largest education query families in Iran, and they peak twice a year: before the **Dey** exams (late December–January) and the **Khordad** exams (May–June). Pages take weeks to get indexed and ranked, so **pages for Dey 1405 must be live by early December 2026.**

**Why Pazmoonak can win here.** The textbooks for grades 7–12 are already loaded into the AI tutor (`books-batch.js`), and the product can turn a chapter into a quiz. No competitor's static page can offer «take this test online and get your score right away».

**Page template** (one page per grade × subject, later per chapter):
- URL: must match `azmoon-[a-z0-9-]+` to work with `pz-front` today, for example `/azmoon-riazi-haftom`, `/azmoon-olum-nohom`, `/azmoon-farsi-hashtom`. «آزمون ریاضی هفتم» is also a real query, so the prefix fits.
- Title: `نمونه سوال ریاضی هفتم با جواب + آزمون آنلاین | پازمونک`
- H1: `نمونه سوال و آزمون آنلاین ریاضی هفتم`
- Content:
  1. a short intro: which chapters, which exam (نوبت اول/دوم)
  2. a chapter list (H2 per chapter) with **10–15 original questions and their answers** written out on the page. Use `<details>` for answers so students can test themselves.
  3. a **«این آزمون را آنلاین بده»** button linking to a real quiz (`/q/<id>`) with the same questions
  4. links to the other subjects of the same grade and the same subject in other grades
  5. a short FAQ + `FAQPage` JSON-LD (visible text must match)
  6. `BreadcrumbList`: پازمونک › پایه‌ی هفتم › ریاضی
- Add each page to `sitemap.xml` and to the **list in `seo-install.sh` / `pz-front` checks** if needed.

**Quality rules.** Write **original** questions based on the curriculum; don't copy the textbook text or other sites' question sets (copyright, and Google filters duplicate content). Have a teacher check every answer: one wrong answer on an exam-prep page destroys trust. Better 10 excellent pages than 100 thin ones.

**Rollout order:** subjects and grades with the most exam pressure first. Suggested: ریاضی and علوم for grades 7, 8, 9; then عربی and زبان انگلیسی; then grade 10–12 subjects. Use Google Trends (geo: Iran) to compare demand before writing.

### 5.2 More long-tail guide pages 🟡

Each targets a phrase no current page owns. Same template as the existing guide pages:

| Slug (suggested) | Main phrase |
|---|---|
| `azmoon-kooiz` | ساخت کوییز آنلاین |
| `azmoon-dorost-ghalat` | ساخت آزمون درست و غلط |
| `azmoon-zamandar` | آزمون آنلاین زمان‌دار |
| `azmoon-estekhdami` | آزمون استخدامی آنلاین برای شرکت‌ها |
| `azmoon-amoozeshgah` | آزمون‌ساز برای آموزشگاه و کلاس خصوصی |
| `azmoon-konkur` | ساخت آزمون تستی کنکور |
| `azmoon-word` | تبدیل فایل Word به آزمون |
| `azmoon-natije-excel` | خروجی اکسل نتایج آزمون |
| `azmoon-gooshi` | ساخت آزمون با گوشی |

Also comparison pages that answer what people already search, for example «جایگزین گوگل فرم برای آزمون» (Google Forms is restricted in Iran). Stay factual; don't name or criticize Iranian competitors.

### 5.3 Blog / help articles 🟡

How-to articles answer the questions people type and attract natural links:
«چطور سوال چهارگزینه‌ای استاندارد طرح کنیم»، «تصحیح خودکار امتحان»، «برگزاری امتحان آنلاین در شاد/بله/ایتا», and so on. One solid article a week is better than five weak ones. This needs a new path (e.g. `/maghale/...`) and a change to the `pz-front` slug check; see 6.1.

### 5.4 Keep content fresh

- Update `<lastmod>` in `sitemap.xml` **only when a page really changes**. Today all URLs share the same date, which Google learns to ignore.
- Before each exam season, review the «نمونه سوال» pages, add questions, and update `dateModified` in their JSON-LD.

---

## 6. Product/code work

### 6.1 Trust pages: About, Contact, Privacy, Terms 🟠

Google's quality guidelines (E-E-A-T) look for who runs a site and how to reach them, especially when it handles payments (پولک) and personal data (phone numbers). The eNamad seal and phone number in the footer help; standalone pages help more.

- Pages: `درباره‌ی ما`، `تماس با ما` (phone, Bale, Instagram, address if possible), `حریم خصوصی`، `قوانین و مقررات`.
- `pz-front` currently accepts only `azmoon-*` slugs. Either extend the check, for example:
  ```bash
  printf '%s' "$s" | grep -Eq '^(azmoon|page)-[a-z0-9-]+$'
  ```
  (and the nginx 301 rule for trailing slashes the same way), or use names like `azmoon-darbare-ma`, which works today but reads oddly.
- Link them from the footer of all pages and add `"url"` / `"address"` to the `Organization` JSON-LD.

### 6.2 Public quiz library 🟡 (biggest long-term lever)

Every quiz is currently private (`/q/<id>`, `noindex`). If creators can **opt in** to making a quiz public, every public quiz becomes a page Google can index; content grows by itself with usage.

- Add a "show this quiz in the public library" checkbox, off by default. Never expose quizzes without consent.
- Public quizzes need **server-rendered or pre-rendered HTML**, not the SPA. Google does render JavaScript, but slowly and unreliably for new sites. Option that fits the current setup: a cron job on the server that writes static HTML files (`/bank/<slug>/index.html`) from the database, like `pz-front` does for guide pages.
- Each page: title, subject, grade, number of questions, the first few questions as text, a "start" button, links to related quizzes. `Quiz` schema.org type (`@type: Quiz`, `educationalLevel`, `about`).
- Category pages (`/bank/riazi-haftom`) link the quizzes together and connect to the «نمونه سوال» pages in 5.1.
- Moderation is needed (spam, copyrighted content), plus `noindex` for quizzes with fewer than about 5 questions.

### 6.3 Small code items

- **Home `<h3>` before `<h2>`:** the "steps" cards in the hero use `<h3>` directly under the `<h1>`. Not harmful, but the step cards could be wrapped with a visually hidden `<h2>` («ساخت آزمون آنلاین در سه قدم») for a clean outline.
- **Footer links on the home page** to guide pages are absolute (`https://pazmoonak.com/azmoon-online`). That's fine; just keep them the main domain, never `www`.
- **`/create/...` links from guide pages** point to URLs blocked in robots.txt. That's fine (they're app pages); don't add them to the sitemap.
- **Sitemap:** consider adding `<image:image>` for `og-image.png` on the home URL, and a separate sitemap file for the «نمونه سوال» pages once there are many (`sitemap-index.xml`).
- **`WebApplication` JSON-LD:** `offers.price: "0"` is correct for free manual creation. Don't add `aggregateRating` unless real, visible user reviews exist (fake ratings lead to a manual action).

---

## 7. Performance (Core Web Vitals)

Page speed is a ranking factor (via Core Web Vitals), and it matters more on Iranian mobile networks.

**Not measured yet.** During the audit the PageSpeed API quota was exhausted and local Lighthouse could not run. Run this before and after the server changes:
```bash
npx lighthouse https://pazmoonak.com/ --view
npx lighthouse https://pazmoonak.com/azmoon-online --view
```
or https://pagespeed.web.dev. Target: LCP < 2.5s, CLS < 0.1, INP < 200ms on mobile.

Known items:
| Item | Today | Suggestion |
|---|---|---|
| `index.html` | 151 KB (mostly inline CSS), gzipped on the wire | acceptable; if Lighthouse flags it, move CSS that only app routes use into a cached external file |
| `app.js` | 428 KB, loaded at end of `<body>` | fine for the home page's first paint; cache it (3.3) |
| `katex-bundle.js` | 646 KB | already lazy-loaded only when math is shown ✅ |
| `vazirmatn.woff2` | 111 KB, preloaded | subset to Persian + basic Latin (e.g. with `pyftsubset`); about 40–60% smaller; then cache 1 year |
| logo | 51 KB → **21 KB in this branch** | could be WebP/SVG later |
| eNamad seal | third-party image in footer | already below the fold; keep it, as it's a trust signal |
| static caching | none | 3.3 |

---

## 8. Off-page SEO

For broad phrases like «ساخت آزمون», links from other sites decide most of the ranking. Code alone can't produce them.

- **Virgool (virgool.io) and education blogs:** useful articles (not ads) that link to the relevant guide page.
- **Aparat:** short tutorial videos («ساخت آزمون آنلاین در ۲ دقیقه»، «تبدیل جزوه به آزمون»), with the page link in the description. Aparat videos also show up in Google results.
- **Teacher communities:** teacher channels on Bale, Eitaa and Telegram, and teacher forums. Teachers are the multipliers: one teacher brings 30 students.
- **Iranian startup and tech media:** product introductions and reportage articles from reputable outlets. **Avoid** bulk link packages and link farms, which can get the site penalized.
- **Directories:** Iranian startup and education-tool directories; the eNamad listing already exists.
- **Brand searches:** people who search «پازمونک» show Google the brand is real. The Instagram and Bale channels drive this; put the site name and URL on every post and video.
- **Quiz links as a channel:** every shared quiz shows the site to new people. Make sure the quiz page has a visible "پازمونک — ساخت آزمون رایگان" link for participants.

---

## 9. Measuring results

1. **Google Search Console** (the owner already has a verified property): *Performance → Queries* per page, *Pages* (indexing problems), *Crawl stats* (important, see 10), *Enhancements* (FAQ/Breadcrumb errors). Submit `https://pazmoonak.com/sitemap.xml` and use *Request indexing* after each important change.
2. **Bing Webmaster Tools:** import the site from Search Console in one click. Bing also powers other search engines and AI search tools.
3. **IndexNow:** a single request tells Bing and Yandex about changed URLs right away. It could be added to `pz-front`: after a deploy, POST the changed URLs. It needs a key file at the site root.
4. **Without Search Console**, weekly:
   - `site:pazmoonak.com` in Google: are all pages indexed?
   - In an incognito window, search the main phrases from the table in 4.5 and record the position.
   - Re-run the live checks in sections 2 and 3.
   - Rich Results Test (https://search.google.com/test/rich-results) for the home page and one guide page.
5. **Expected timeline:**
   - changes picked up in days to about 2 weeks
   - long-tail phrases move in 2–6 weeks
   - broad phrases like «ساخت آزمون» take 3–6+ months and depend on section 8

---

## 10. Risks specific to an Iranian-hosted site

- **International connectivity.** Googlebot crawls from outside Iran. During international internet restrictions, the server may be unreachable from abroad. Google then sees errors, slows crawling, and after long outages drops pages. Watch *Search Console → Settings → Crawl stats → host status*. Consider a CDN with points of presence both inside and outside Iran, so foreign crawlers get answers even during disruptions.
- **Blocking foreign IPs.** Never geo-block foreign traffic on the web server (some Iranian hosts do it by default for "security"); that blocks Googlebot too.
- **Rate limiting.** If a firewall or rate limiter is added later, whitelist verified Googlebot and Bingbot (reverse DNS check), or use generous limits for GET requests to HTML pages.

---

## 11. What is already good

Keep these when changing anything:

- Real HTTP 404 with a `noindex` 404 page; trailing-slash URLs 301 to the version without the slash.
- Unique `<title>`, description, canonical, Open Graph and Twitter tags on every page.
- JSON-LD: `Organization`, `WebSite`, `WebApplication`, and `WebPage` + `BreadcrumbList` + `FAQPage` on the guide pages.
- Clean Persian text: no Arabic ي/ك, consistent half-spaces.
- `lang="fa" dir="rtl"`, `og:locale=fa_IR`.
- Guide pages: 740–925 words each, 7–8 H2s, linked to each other.
- App routes get `noindex` and a correct canonical from `app.js` (strengthened by 3.2).
- `robots.txt` and `sitemap.xml` are served; gzip is on.
- GitHub Pages redirects to pazmoonak.com, so there's no duplicate copy there; files not in the `pz-front` list (e.g. `math7.pdf`, `pages/*.html` paths) return 404 on the live site.
