# Pazmoonak: audit results, changes made, and what still needs doing

Last updated: 2026-11-19 (28 Aban 1405) · Branch: `seo-improvements`

This document records:
1. what has been changed on this branch, and how to deploy it;
2. every finding from the code audit (ship-ready method) with its current status and a concrete fix;
3. the product, trust and marketing work that the market research says should come next.

Two longer reports sit **outside the repo** (they hold market research, not code):
- `C:\Users\LENOVO\Documents\pazmoonak\reports\Pazmoonak ship-ready audit.md` (full findings, file:line traces)
- `C:\Users\LENOVO\Documents\pazmoonak\reports\Pazmoonak marketing in Iran.md` (positioning, pricing, Instagram, Bale, legal, calendar)

## Contents
- [0. Status at a glance](#0-status-at-a-glance)
- [1. Changes on this branch](#1-changes-on-this-branch)
- [2. How to deploy this branch](#2-how-to-deploy-this-branch)
- [3. Audit findings and their status](#3-audit-findings-and-their-status)
- [4. How to fix each open finding](#4-how-to-fix-each-open-finding)
- [5. Product and pricing changes from the market research](#5-product-and-pricing-changes-from-the-market-research)
- [6. Trust, legal and operations checklist](#6-trust-legal-and-operations-checklist)
- [7. Suggested order of work](#7-suggested-order-of-work)
- [8. What was not verified](#8-what-was-not-verified)

---

## 0. Status at a glance

| Area | Before this branch | Now (after merge) |
|---|---|---|
| Ship-ready verdict | **NOT_READY** (no checks ran; 3 open P1s) | Still **NOT_READY**: F-001 and F-002 remain open |
| Automated checks | None | `scripts/check-site.mjs` on every branch, PR and deploy |
| GitHub Pages deploy | Every push to `main`, unchecked | Only after the check job passes; actions pinned by SHA |
| Production deploy (`pz-front`) | Whatever is on `main` at that moment | Only a commit whose CI check passed, downloaded by exact SHA |
| Home page SEO | Almost no visible text | ~700 words, FAQ, keyword titles (commit `707e9ed`) |

The core money and security code was found to be in good shape: Zibal payments are verified on the server, all 97 SQL functions check sessions and ownership, پولک spending is atomic, and no XSS or committed secrets were found. The blockers are **exam integrity** (F-001), a **dangerous stale update bundle** (F-002), and the lack of **tests** (F-003, now partly addressed).

---

## 1. Changes on this branch

### 1.1 Commit `707e9ed`: SEO (made earlier, reviewed here)

Details are in [`docs/SEO.md`](SEO.md) §1. Summary:
- `index.html`: visible home-page content section and FAQ, shown only on `/`; titles start with the keyword; H1 contains «آزمون آنلاین».
- `app.js`: `setTitle()` home title matches the new `<title>`.
- `pages/*.html`: «سوال» spelling in headings; `og:image:type` and `og:image:alt`.
- `logo/mark.png`: 52 KB → 21 KB.
- `google7f789168ae62f4be.html`: Google Search Console verification.
- `docs/SEO.md`: SEO plan.

**Review result: good to merge.**
- The FAQPage JSON-LD matches the visible FAQ exactly (all 4 questions and answers compared programmatically; this is now enforced by the check script).
- Factual claims were checked against the code: the FAQ says participants must sign in, and `submit_quiz` does require a session; the "up to 100 questions" claim matches the existing guide page.
- No behaviour change apart from the title text and the new home section.

### 1.2 Commit `e80d5ee`: checks, gated deploys, safer `pz-front`

Addresses audit findings **F-003** (no checks before deploy, partly) and **F-007** (unpinned production deploy, fully).

| File | Change |
|---|---|
| `scripts/check-site.mjs` (new) | Dependency-free checks, Node 18+. Fails on: JS syntax errors (`app.js`, `config.js`, `books-batch.js`, `crawl-books.js`); bash syntax errors in every `.sh` installer; invalid JSON-LD; FAQPage JSON-LD that differs from the visible FAQ; missing/duplicate `<title>` or `<h1>`; missing canonical or description on indexable pages; `lang="fa" dir="rtl"` missing; internal links to routes that don't exist (routes are read from the router in `app.js`, so the check follows the code); `src=` assets missing from the repo; sitemap entries without a page and pages missing from the sitemap; files in the `pz-front` deploy list missing from the repo; common committed-secret patterns (private keys, `sk-`, `AIza`, `pplx-`, `ghp_`, JWTs). Warns when `app.js` > 500 KB or `index.html` > 200 KB. |
| `.github/workflows/check.yml` (new) | Runs the checks on every push to a non-`main` branch and on every pull request. |
| `.github/workflows/pages.yml` | New `check` job; `deploy` now `needs: check`. Actions pinned by commit SHA. `pages: write` / `id-token: write` only on the deploy job. |
| `front-sync.sh` (`pz-front`) | Resolves `main` (or `PZ_REF`) to a commit SHA through the GitHub API, asks GitHub whether the `check` run on that commit succeeded, refuses to deploy if it failed, is still running or never ran, then downloads **that exact commit**. New options: `PZ_REF=<commit> pz-front` (roll back to a known version) and `PZ_SKIP_CI=1 pz-front` (emergency override). Messages are in Persian. The rest of the deploy is unchanged. |
| `seo-install.sh` | Its embedded copy of `pz-front` is replaced with the new `front-sync.sh`, byte-for-byte, so re-running the installer can't reinstall the old unchecked version. |
| `README.md` | New section «بررسی خودکار و انتشار»: how to run the checks, how deploys work now, rollback and emergency commands. |

**How it was verified**
- `node scripts/check-site.mjs` passes on the branch (4 JS, 10 shell, 7 HTML files, sitemap, deploy list, 49 tracked files scanned).
- **Fault injection:** in a scratch copy, 8 deliberate faults were each caught with a clear message: FAQ text drift, a JS syntax error, a sitemap typo, a shell syntax error, a fake API key, a broken internal link, a deploy-list file deleted, and a removed `<h1>`.
- `pz-front`'s new JSON parsing was tested against the **live GitHub API** (real SHA for `main`, "no checks" for the current `main`, an invalid branch name) and against synthetic `pending` / `failure` / `success` / garbage responses. The pinned-SHA download URL returns HTTP 200.
- A full local deploy (`PZ_FRONT_DIR=<repo> PZ_WEB=<scratch> bash front-sync.sh`) produced the same file set as before (5 guide pages, cache-busted `app.js?v=…`).
- Stored files use LF line endings (checked in the git index), so the shell scripts are safe on the Linux server.

**Behaviour changes**
- `pz-front` now **refuses** to deploy a commit with no successful `check` run. Pushing directly to `main` still works, but the server will only take it once its check passes (about a minute).
- The very first `pz-front` run after this is merged needs the `pages.yml` check on the merge commit to have finished.
- `pz-front` now also needs `node` on the server (already installed for the workers) and access to `api.github.com` (same network route as `codeload.github.com`, which it already used). GitHub's unauthenticated API allows 60 requests an hour per IP, far more than deploys need.

### 1.3 Commit with this document
Adds `docs/AUDIT-AND-ROADMAP.md` (this file).

---

## 2. How to deploy this branch

1. Open a pull request `seo-improvements` → `main`. The **Site checks** workflow should go green.
2. Merge. `pages.yml` runs `check`, then deploys GitHub Pages.
3. On the server, as root, **once**: `bash seo-install.sh`. This installs the new `pz-front` (it backs up the old one to `/root/pz-front.bak-<date>`), tests nginx, and runs a deploy. It will refuse if the check on `main` hasn't finished yet; wait a minute and re-run.
4. After that, `pz-front` as usual.
5. Recommended in GitHub settings: **branch protection on `main`** requiring the `check` status. Without it, an unchecked push still lands on `main` (the server just won't deploy it).

Rollback: `PZ_REF=<older commit sha> pz-front` (that commit must have a passing check, or add `PZ_SKIP_CI=1`).

---

## 3. Audit findings and their status

Severity scale (ship-ready): **P0** wrong results/data loss/security hole; **P1** likely bug, missing authorization, no safety net; **P2** quality, operability, hardening. No P0 was found.

| ID | Sev | Finding | Status |
|---|---|---|---|
| F-001 | **P1** | Exam integrity: `submit_quiz` returns the full answer key after any submission; unlimited retakes (`quiz_start` restarts a timed quiz once the previous run ended); `p_name` is free text, so a student can submit under someone else's name and the teacher only sees the name. (`timer-install.sh` ≈L190, L221–268, L272) | **Open**: server SQL; needs a database to test |
| F-002 | **P1** | `pazmoonak-update.tar.gz` is older than the timer/tutor/files/lab installers. Running its `update.sh` deletes `/opt/pazmoonak/fn`, re-applies an older `schema.sql` that **removes the server-side timer**, and creates a second `create_quiz` overload so **quiz creation returns 404**. Migration errors are hidden by `\|\| true`. | **Open**: needs owner decision (it may be the only copy of some server code) |
| F-003 | **P1** | No tests or checks; every push deploys. | **Partly fixed** (`e80d5ee`): static checks gate both deploys. Still missing: SQL tests and a browser smoke test. |
| F-004 | P2 | OTP SMS: per-number and per-IP limits but no captcha and no global daily cap (SMS-pumping cost); throwaway email accounts can farm the 20 free پولک. | Open (verify the nginx `limit_req` is live) |
| F-005 | P2 | Super-admin is a hard-coded personal mobile number in public SQL (`schema.sql` `is_admin()`). Personal data exposure, SIM-swap target, single factor. | Open |
| F-006 | P2 | Pages publishes the whole repo (`path: .`): installers, server tarball, 17 MB `math7.pdf` (copyright unclear). The live site (Iranian server) only serves the `pz-front` allowlist, and the repo is public anyway, so this is mostly about the PDF licence and tidiness. | Open |
| F-007 | P2 | Production deploy pulled unpinned `main` as root. | **Fixed** (`e80d5ee`), active after `seo-install.sh` is re-run |
| F-008 | P2 | 30-day session token in `localStorage`; CSP has no `script-src`. No XSS found, but any future one = account takeover. | Open (needs browser testing) |
| F-009 | P2 | Failed AI generation refunds are retried a few times then only logged; the user silently loses پولک. | Open |
| F-010 | P2 | Backups stay on the same server; no restore drill, monitoring or alerts. | Open (verify on server) |
| F-011 | P2 | No build step: `app.js` 435 KB raw / 118 KB gz; ~265 KB gz critical path; never measured on a real phone over 3G. | Open |
| F-012 | P2 | README described an older Supabase/hash-route product. | **Partly fixed**: deploy section added; the rest still describes the old architecture |
| F-013 | P2 | Server code has no single source of truth: base64 blobs in 5 installers, `sed` patches, a stale tarball. Root cause of F-002. | Open |
| P3 | P3 | 8-hex-char quiz IDs; `get_quiz` has no per-user rate limit; old Supabase project may still hold data; Cloudflare AI relay could become an open proxy if its key leaks. | Open |

---

## 4. How to fix each open finding

Ordered by priority. "Test" lines say what evidence closes the finding.

### F-001 Exam integrity (do before any marketing push)
Teachers will hit this in the first real exam.
1. **Bind the name to the account.** In `submit_quiz`, ignore `p_name` for signed-in users and store the account's display name; keep `user_id` on the row (it already is). In `get_results`, return a masked identifier next to the name (e.g. last 4 digits of the phone, or the email's first letters) so the teacher can tell two «علی»s apart.
2. **One attempt per account (creator setting).** Add `quizzes.max_attempts int` (null = unlimited, the current behaviour). Enforce in `submit_quiz` with a count on `(quiz_id, user_id)`; in `quiz_start`, refuse a new run once the limit is reached instead of starting a fresh timer. A partial unique index on `submissions(quiz_id, user_id)` is the strongest guard when `max_attempts = 1`.
3. **Answer-key visibility (creator setting).** Add `quizzes.reveal text check (reveal in ('after_submit','after_close','never'))`, default `'after_submit'` to keep today's behaviour for existing quizzes, and `quizzes.closes_at timestamptz`. `submit_quiz` returns `correct` only when allowed; add `get_answer_key(p_id, p_token)` for the `after_close` case.
4. **UI:** three options in the quiz builder («یک بار شرکت», «نمایش پاسخ‌ها: بلافاصله / بعد از پایان مهلت / هرگز»), and the masked identifier in the results table and XLSX export.
5. **Test:** SQL tests (see F-003) proving that a second submit is refused when `max_attempts = 1`, that `correct` is absent when `reveal = 'never'`, and that `p_name` is ignored for a signed-in user. Ship as a new idempotent installer step or, better, as the first numbered migration (see F-013).

### F-002 / F-013 Stale bundle and server source of truth
1. Do **not** run `pazmoonak-update.tar.gz` again. As a first step, rename it so nobody runs it by habit (e.g. move it to `archive/` with a README saying why).
2. Extract the **live** server code into the repo as plain files: `server/server.js`, `server/fn/*.js`, `server/nginx/*.conf`, `server/db/migrations/001_base.sql`, `002_timer.sql`, `003_tutor.sql`, … Take them from the running server (`/opt/pazmoonak`, `pg_dump --schema-only`), not from the tarball, so they match what actually runs.
3. One `server/update.sh` that applies migrations in order, records them in a `schema_migrations` table, uses `psql -v ON_ERROR_STOP=1` and **no `|| true`**, and only restarts the service if everything succeeded.
4. Extend `scripts/check-site.mjs` (or a sibling `check-server`) to `node --check` the server JS.
5. **Test:** apply all migrations to an empty Postgres and to a copy of production; both must end with exactly one `create_quiz` and the timed `submit_quiz`.

### F-003 Remaining safety net
Done: static checks and gated deploys. Still to do:
1. **SQL tests** with a throwaway Postgres in CI (`services: postgres` in GitHub Actions) for `submit_quiz`, `quiz_start`, `pay_credit` (amount mismatch → `review`; replay → no double credit), `ai_reserve`/`ai_refund`, and admin gating. Depends on F-013 (the schema needs to be in the repo as plain SQL).
2. **One browser smoke test** (Playwright): sign in with dev OTP → create a quiz → take it → see results. Run against a local server in CI.
3. **Branch protection** on `main` requiring the `check` status.

### F-004 SMS and free-credit abuse
1. Global daily SMS budget in `auth-otp.js` (counter in the DB; refuse and alert above N/day).
2. A challenge that works inside Iran on the OTP **send** step: a simple proof-of-work, or a self-hosted captcha. Google reCAPTCHA is unreliable in Iran.
3. Give the signup پولک only after **phone** verification (not email).
4. Confirm `limit_req` is still active on `api.pazmoonak.com` (`nginx -T | grep limit_req`).

### F-005 Admin identity
1. Create an `admins` table (`user_id`, `role`, `created_at`); `is_admin()` reads it.
2. Remove the phone number from SQL and comments; it stays in git history, so treat it as public.
3. Rotate the admin's sessions; consider a second factor for admin actions (`admin_tokens` can mint unlimited پولک).

### F-006 Public surface
1. Check whether `math7.pdf` may be redistributed. If not, remove it (and consider purging it from history).
2. Optionally have `pages.yml` upload only site files. Low priority, since the repo is public and the live site uses the `pz-front` allowlist.

### F-008 Browser hardening
1. Add a CSP header in nginx: `script-src 'self'` plus SHA-256 hashes for the inline bootstrap scripts in `index.html` and `pages/*.html` (theme script, `syncHero`, JSON-LD needs none), and `https://cdnjs.cloudflare.com` only while the KaTeX fallback exists. Start in `Content-Security-Policy-Report-Only` for a week.
2. Shorten the session lifetime (e.g. 7 days sliding) or rotate the token on use.
3. **Test:** click through every page in a browser with the console open; zero CSP violations.

### F-009 Durable refunds
Write a `pending_refunds` row before each AI call; settle it on success, refund it on failure; a reconcile loop (like `reconcilePayments`) refunds anything left pending for more than N minutes.

### F-010 Operations
1. Off-site, encrypted daily backups (e.g. to a second Iranian provider) and a **monthly restore drill**.
2. External uptime check on `/healthz` and the Zibal callback URL, from inside Iran.
3. Alerts (to a Bale account) on: `pay_credit` refused, refund failed, 5xx rate, SMS budget reached.

### F-011 Performance
1. Minify `app.js` in `pz-front` or CI (esbuild), keeping source maps off the public site.
2. Move the inline CSS in `index.html` into a cached, versioned file.
3. Measure LCP and time-to-interactive on a real mid-range Android phone over 3G before and after.

### F-012 README
Rewrite it as a runbook: architecture (Iranian server, PostgREST-style API, Node workers, Cloudflare AI relay), env keys (names only), install/update order, deploy, restore, payments, the question types that actually exist (`mcq`, `tf`, `mixed`; no `blank` yet).

### P3 items
- Lengthen quiz IDs for new quizzes, add a per-user rate limit to `get_quiz`.
- Delete the old Supabase project if it still exists (its URL and publishable key are in `config.js` history).
- Make sure the Cloudflare relay checks `x-relay-key` and only forwards to the AI providers' hosts.

---

## 5. Product and pricing changes from the market research

Source: `Pazmoonak marketing in Iran.md`. Items marked *(decision)* need the owner's call; the rest are straightforward to build.

### 5.1 Pricing (code: `app.js` ≈L1100–1105, `pay.js`, `payments_tokens_check`)
| Item | Today | Recommendation |
|---|---|---|
| Minimum purchase | 1 پولک (`TK_MIN_BUY = 1`, server allows 1–10,000) | **50 پولک** *(decision)*. Zibal's fee is 1%, minimum 2,000 Toman (since 1 Khordad 1405), so a 1-پولک (1,000 Toman) purchase **loses money** on the fee. Change both `TK_MIN_BUY` and the server check in `pay.js`. |
| Signup gift | 20 پولک (`TK_FREE`, value comes from the DB) | 30 پولک *(decision)*, enough for one 20-question quiz from a PDF plus 5 tutor questions. Give it only after phone verification (F-004). |
| Free tier | | Keep quiz hosting, timed quizzes, groups and auto-grading free with no response cap; only AI generation and tutor questions cost پولک. Porsline's free plan caps at 100 responses/month. |
| Named packs | Slider only | Add «بسته‌ی کلاس» (100), «بسته‌ی امتحان» (300), «بسته‌ی آموزشگاه» (1,000+), and a student «بسته‌ی شب امتحان» (60) |
| Repricing | | Review the Toman price per پولک every quarter (inflation ~4.4%/month). Never reduce existing balances. Check the real AI cost per question first. |

### 5.2 Features the marketing plan depends on
| Feature | Why | Exists? |
|---|---|---|
| **Promo / referral codes** that add bonus پولک | One unique code per Instagram placement and per influencer is how paid ads get measured | **No** (no coupon/promo code in `app.js`) |
| **"How did you hear about us?"** at signup (+ store `utm_*` from the landing URL) | Attribution per channel | **No** |
| **Bale bot** with class deep links (`ble.ir/<bot>?start=class_<id>`) | Bale is where teachers and schools already are (Ministry tells staff to use it); a teacher brings ~30 students | No |
| **Bale mini app** (wrap the site; sign in with Bale's verified `initData`, no SMS cost) + Bale invoice payments | Works through shutdowns on the national network; removes OTP cost | No. Needs CSP `frame-src`/`frame-ancestors` to allow `*.bale.ai` (coordinate with F-008). |
| **Textbook page citations** in tutor answers | The "مطابق کتاب درسی" claim; competitor آی‌نو plans a textbook tutor by spring 1406 | Check (books are ingested with page numbers, `books-batch.js`) |
| **«پیش‌نویس هوش مصنوعی؛ قبل از انتشار بازبینی کنید»** label on AI-generated quizzes | Honesty and trust | Check |
| **Shutdown mode**: status banner, sample quiz banks that work without AI, automatic پولک refund and validity extension | 2026 had a 4.5-month national blackout; quiz-taking itself only needs the Iranian server | Partly (core quiz flow is domestic) |
| **Ready-made sample quizzes** per grade/subject, public and copyable | Content for Instagram/Bale posts and for SEO (`docs/SEO.md` §5.1, §6.2) | No |

### 5.3 Trust pages
The footer has «درباره‌ی ما» and «تماس با ما» blocks, but there are no **Privacy** or **Terms** pages. Needed for Enamad and for parents and schools:
- **Privacy** (plain Persian): what is stored (names, phone/email, scores, uploaded files, tutor chats and photos); that AI requests go to foreign AI providers through a relay; that student data is never sold; deletion on request; teachers/parents responsible for under-18 accounts.
- **Terms**: پولک are non-refundable except for failed generations; pricing may change; acceptable use.
- Note: `pz-front` only publishes `pages/azmoon-*.html`, so new pages need either an `azmoon-` name or a small change to the allowlist in `front-sync.sh` (and `seo-install.sh`).

---

## 6. Trust, legal and operations checklist

Not code, but each blocks or affects growth. Details and sources are in the marketing report.

- [ ] **Enamad** (permit on mojavez.ir first, reportedly required since winter 1404), then show the badge on the پولک page.
- [ ] **Tax tracking code** and taxpayer-system registration (my.tax.gov.ir); gateway receipts count as e-invoices until the end of 1405.
- [ ] Confirm Zibal account status; add **Zarinpal** as a second gateway (0.5% + 500 Toman, cheaper on small packs).
- [ ] Confirm whether **Samandehi** is required for this site in 1405.
- [ ] Keep the front end on the Iranian server (already the case); register a `.ir` fallback domain; test from an Iranian IP and from a VPN IP.
- [ ] Document a **backup AI provider**; Gemini and Perplexity block Iran, and the relay is exposed to both sanctions and shutdowns.
- [ ] **No cash-commission programmes for school staff**: a Ministry circular bars selling to students inside schools. Reward teachers with پولک per active class instead.
- [ ] Cafe Bazaar / Myket app: decide billing first. Bazaar requires its own billing (~15%) and forbids external payment links like Zibal.
- [ ] Bale support account, shown on the site and checkout page (works during shutdowns).

---

## 7. Suggested order of work

Timed to the school year: **Azar 1405 (22 Nov–21 Dec 2026)** is the best window, while teachers write the Dey exams.

| When | Engineering | Product/marketing |
|---|---|---|
| **Now (this week)** | Merge this branch; re-run `seo-install.sh`; branch protection on `main`. Stop using the stale tarball (F-002 step 1). | |
| **Azar, weeks 1–2** | **F-001 exam integrity.** Minimum purchase 50 and signup gift 30 (decision). Promo codes + "how did you hear" field. | Enamad / tax / Zibal checks. Bale bot with class deep links. Bale channel. |
| **Azar, weeks 3–4** | F-004 SMS cap and challenge (before ad traffic). F-009 durable refunds. Privacy and Terms pages. | Instagram pilot (≈10M Toman, one code per placement). Vitrine application. |
| **Dey** | F-013 server code into the repo + migrations; SQL tests in CI (F-003). Off-site backups and alerts (F-010). | Student «بسته‌ی شب امتحان»; first Bale channel-ad test. |
| **Bahman–Esfand** | Bale mini app + Bale payments. CSP (F-008). Tutor textbook citations. | Claim «مطابق کتاب درسی» before آی‌نو ships. |
| **Farvardin onward** | Minify and measure (F-011). README runbook (F-012). Admin table (F-005). | Teacher's Day (12 Ordibehesht) and Khordad exam campaigns. |

---

## 8. What was not verified

- Whether the **live server** matches the installers in the repo (which scripts ran, in what order, whether nginx `limit_req` is active). Several findings (F-002, F-004, F-010) depend on this; check on the server.
- Runtime performance on real phones; accessibility with tooling (axe/Lighthouse).
- The Cloudflare relay worker's code (not in the repo).
- The audit tools `gitleaks`, `semgrep` and `jscpd` could not run (not installed); the secret scan was regex-based.
- No database was available, so **no server-side SQL was changed** on this branch.
- Market figures flagged in the marketing report as conflicting or old (current Porsline/Eazm prices, Bale ad rates, Instagram reach since Sep 2026) need checking by hand.
