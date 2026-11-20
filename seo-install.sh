#!/bin/bash
# Pazmoonak SEO: guide pages (pazmoonak.com/azmoon-...) + real 404 for wrong addresses + new pz-front.
# Run as root:  bash seo-install.sh      Safe to run more than once. Backs up and tests nginx; if anything breaks, it restores the old config.
# Upload the files to GitHub FIRST (pages/*.html, lp.css, 404.html, sitemap.xml, index.html, front-sync.sh).
set -u
WEB="${PZ_WEB:-/var/www/pazmoonak}"
NG="${PZ_NGINX:-/etc/nginx/sites-available/pazmoonak-front}"
SYNC="${PZ_SYNC_BIN:-/usr/local/bin/pz-front}"
HOST="${PZ_HOST:-pazmoonak.com}"
MARK="# pz-seo"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT

echo "[1/5] checking"
command -v nginx >/dev/null 2>&1 || { echo "ERR: nginx not found"; exit 1; }
[ -f "$NG" ] || { echo "ERR: nginx site file not found: $NG"; exit 1; }
[ -d "$WEB" ] || { echo "ERR: site folder not found: $WEB"; exit 1; }
nginx -t >/dev/null 2>&1 || { echo "ERR: nginx config already has an error (nginx -t fails); nothing was changed"; nginx -t; exit 1; }
if grep -qF "$MARK" "$NG"; then NGDONE=1
elif grep -qF 'try_files $uri /index.html;' "$NG"; then NGDONE=0
else echo "ERR: unexpected nginx config (no 'try_files \$uri /index.html;' line). Nothing was changed. Send me this:"; grep -n "location\|try_files\|server_name\|listen" "$NG"; exit 1; fi
echo "OK"

echo "[2/5] installing the new pz-front"
cat > "$T/pz-front" <<'PZSYNC_END'
#!/usr/bin/env bash
# آخرین نسخه‌ی سایت را از GitHub می‌گیرد و جایگزین فایل‌های سایت می‌کند:  pz-front
# فقط نسخه‌ای نصب می‌شود که بررسی خودکار GitHub (کار «check» در Actions) رویش موفق بوده است،
# و دقیقاً همان نسخه (با شناسه‌ی commit) دانلود می‌شود، نه هر چه در همان لحظه روی main باشد.
#   PZ_REF=<شاخه یا commit>   نصب یک نسخه‌ی مشخص (مثلاً برگشت به نسخه‌ی قبلی)
#   PZ_SKIP_CI=1              نصب بدون بررسی (فقط در اضطرار)
set -euo pipefail
REPO=motanjf-sudo/azmoon-saz
BRANCH=main
REF=${PZ_REF:-$BRANCH}
WEB=${PZ_WEB:-/var/www/pazmoonak}
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
# خواندن یک مقدار از JSON پاسخ GitHub با node (روی سرور نصب است)
jsget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{let j;try{j=JSON.parse(s)}catch(e){process.exit(1)}
  if(process.argv[1]==="sha"){if(!/^[0-9a-f]{40}$/.test(j.sha||""))process.exit(1);console.log(j.sha);return}
  const r=j.check_runs||[];
  console.log(r.some(x=>x.conclusion==="success")?"success":!r.length?"none":r.some(x=>x.status!=="completed")?"pending":"failure")})' "$1"; }
if [ -n "${PZ_FRONT_DIR:-}" ]; then
  D="${PZ_FRONT_DIR%/}/"            # فقط برای تست: به‌جای GitHub از یک پوشه‌ی محلی
else
  API="https://api.github.com/repos/${REPO}"
  SHA=$(wget -q -T 30 -t 3 -O - "${API}/commits/${REF}" | jsget sha) || { echo "خطا: شناسه‌ی نسخه‌ی ${REF} از GitHub گرفته نشد. سایت دست‌نخورده ماند."; exit 1; }
  echo "نسخه: ${SHA:0:10} (${REF})"
  if [ "${PZ_SKIP_CI:-}" != 1 ]; then
    CI=$(wget -q -T 30 -t 3 -O - "${API}/commits/${SHA}/check-runs?check_name=check" | jsget ci) || CI=error
    case "$CI" in
      success) echo "بررسی خودکار GitHub: موفق ✅" ;;
      pending) echo "بررسی خودکار GitHub هنوز تمام نشده است؛ یکی دو دقیقه بعد دوباره اجرا کنید. سایت دست‌نخورده ماند."; exit 1 ;;
      none)    echo "برای این نسخه بررسی خودکاری اجرا نشده است. سایت دست‌نخورده ماند. (برای نصب بدون بررسی: PZ_SKIP_CI=1 pz-front)"; exit 1 ;;
      failure) echo "خطا: بررسی خودکار GitHub روی این نسخه شکست خورده است (Actions را ببینید). سایت دست‌نخورده ماند."; exit 1 ;;
      *)       echo "خطا: وضعیت بررسی خودکار از GitHub گرفته نشد. سایت دست‌نخورده ماند. (برای نصب بدون بررسی: PZ_SKIP_CI=1 pz-front)"; exit 1 ;;
    esac
  fi
  echo "دریافت نسخه از GitHub ..."
  wget -q -T 40 -t 3 -O "$T/s.tgz" "https://codeload.github.com/${REPO}/tar.gz/${SHA}" || { echo "خطا: دانلود از GitHub انجام نشد. سایت دست‌نخورده ماند."; exit 1; }
  tar xzf "$T/s.tgz" -C "$T"
  D=$(ls -d "$T"/*/ | head -1)
fi
for f in index.html app.js config.js; do
  [ -s "$D$f" ] || { echo "خطا: فایل $f در نسخه‌ی دریافت‌شده نیست. سایت دست‌نخورده ماند."; exit 1; }
done
mkdir -p "$WEB"
put() { install -m 644 "$D$1" "$WEB/$1.new" && mv -f "$WEB/$1.new" "$WEB/$1"; }
for f in katex-bundle.js app.js config.js style.css lp.css 404.html zibal.html robots.txt sitemap.xml vazirmatn.woff2 favicon.ico favicon-48.png favicon-192.png favicon-512.png apple-touch-icon.png og-image.png site.webmanifest; do [ -f "$D$f" ] && put "$f"; done
# فایل‌های تأیید مالکیت (گوگل: google….html، اینماد و مانند آن: فقط‌عدد.txt)
for g in "$D"google*.html "$D"[0-9]*.txt; do [ -f "$g" ] && put "$(basename "$g")"; done
if [ -d "$D/logo" ]; then mkdir -p "$WEB/logo" && cp -f "$D"logo/* "$WEB/logo/" && chmod 644 "$WEB"/logo/*; fi
# صفحه‌های راهنما (سئو): pages/azmoon-xxx.html  ←  نشانی https://pazmoonak.com/azmoon-xxx
n=0
for p in "$D"pages/*.html; do
  [ -f "$p" ] || continue
  s=$(basename "$p" .html)
  case "$s" in azmoon-*) ;; *) echo "رد شد (نام نامعتبر): $s"; continue ;; esac
  printf '%s' "$s" | grep -Eq '^azmoon-[a-z0-9-]+$' || { echo "رد شد (نام نامعتبر): $s"; continue; }
  mkdir -p "$WEB/$s" && install -m 644 "$p" "$WEB/$s/index.html.new" && mv -f "$WEB/$s/index.html.new" "$WEB/$s/index.html"
  n=$((n+1))
done
# نسخه‌گذاری خودکار: مرورگرها بعد از هر به‌روزرسانی، app.js و config.js تازه را می‌گیرند (بدون نیاز به Ctrl+F5)
cp "$D/index.html" "$T/index.html"
for f in app.js config.js; do
  v=$(md5sum "$D$f" | cut -c1-10)
  sed -i "s|src=\"/\?$f\(?v=[0-9a-f]*\)\?\"|src=\"/$f?v=$v\"|" "$T/index.html"
done
install -m 644 "$T/index.html" "$WEB/index.html.new" && mv -f "$WEB/index.html.new" "$WEB/index.html"
echo "سایت به‌روز شد ✅  (صفحه‌های راهنما: $n)  ($(du -sh "$WEB" | cut -f1))"
PZSYNC_END
bash -n "$T/pz-front" || { echo "ERR: pz-front file is damaged"; exit 1; }
[ -f "$SYNC" ] && cp -p "$SYNC" "/root/pz-front.bak-$(date +%Y%m%d-%H%M%S)"
install -m 755 "$T/pz-front" "$SYNC"
echo "OK"

echo "[3/5] downloading the site from GitHub"
"$SYNC" || { echo "ERR: pz-front failed (see above). nginx was not changed."; exit 1; }
MISS=""
for f in 404.html lp.css sitemap.xml azmoon-online/index.html azmoon-hoosh-masnoei/index.html azmoon-az-pdf/index.html azmoon-baraye-moalem/index.html azmoon-testi/index.html; do
  [ -s "$WEB/$f" ] || MISS="$MISS $f"
done
[ -z "$MISS" ] || { echo "ERR: these files are not on GitHub yet:$MISS"; echo "Upload them (pages folder too), then run this again. nginx was not changed."; exit 1; }
grep -q "azmoon-online" "$WEB/sitemap.xml" || { echo "ERR: sitemap.xml on GitHub is the old one; upload the new one and run again"; exit 1; }
echo "OK"

echo "[4/5] nginx: real 404 for wrong addresses"
BK=""
if [ "$NGDONE" = "1" ]; then
  nginx -t >/dev/null 2>&1 && { systemctl reload nginx 2>/dev/null || nginx -s reload; }
  echo "already configured (skipped)"
else
  BK="/root/pazmoonak-front.seo-bak-$(date +%Y%m%d-%H%M%S)"
  cp -p "$NG" "$BK"
  # the security headers of the existing "location /" are repeated in the new blocks (nginx does not inherit them)
  awk '/^[ \t]*location[ \t]+\/[ \t]*\{/{f=1;next} f&&/add_header/{print} f&&/\}/{exit}' "$NG" | sed 's/^[ \t]*//' > "$T/h"
  {
    echo "    $MARK: pages of the app go to index.html; guide pages are files; any other address gets a real 404"
    echo "    error_page 404 /404.html;"
    echo "    location = /404.html { internal; add_header Cache-Control \"no-cache\" always; }"
    echo "    location ~ ^/(azmoon-[a-z0-9-]+)/\$ { absolute_redirect off; return 301 /\$1\$is_args\$args; }"
    echo "    location ~ ^/(create|q|m|edit|g|groups|signup|tutor|tokens|wallet|admin|account)(/|\$) {"
    sed 's/^/        /' "$T/h"
    echo "        try_files \$uri /index.html;"
    echo "    }"
  } > "$T/blk"
  # 1) "location /": a file, or a guide page folder, or 404   2) the new blocks go right before every "location /"
  sed 's#try_files \$uri /index.html;#try_files $uri $uri/index.html =404;#' "$NG" > "$T/ng1"
  awk -v B="$T/blk" '
    /^[ \t]*location[ \t]+\/[ \t]*\{/ { while ((getline l < B) > 0) print l; close(B) }
    { print }' "$T/ng1" > "$T/ng.new"
  cat "$T/ng.new" > "$NG"
  if nginx -t >/dev/null 2>&1; then
    systemctl reload nginx 2>/dev/null || nginx -s reload
    echo "OK (backup: $BK)"
  else
    cp -p "$BK" "$NG"
    echo "ERR: new nginx config did not pass the test; the old one was restored. Details:"; nginx -t 2>&1 | tail -5
    exit 1
  fi
fi
sleep 1

echo "[5/5] checking the live site"
if curl --noproxy '*' -sk -o /dev/null -m 10 --resolve "$HOST:443:127.0.0.1" "https://$HOST/"; then
  get() { curl --noproxy '*' -sk -m 15 -o "$T/b" -w "%{http_code}" --resolve "$HOST:443:127.0.0.1" "https://$HOST$1"; }
else
  get() { curl --noproxy '*' -s -m 15 -o "$T/b" -w "%{http_code}" -H "Host: $HOST" "http://127.0.0.1$1"; }
fi
FAIL=0; CRIT=0
chk() { # path expected-code [text] [critical]
  local c; c=$(get "$1")
  if [ "$c" = "$2" ] && { [ -z "${3:-}" ] || grep -q "$3" "$T/b"; }; then echo "  ok   $1 -> $c"
  else echo "  FAIL $1 -> $c (expected $2${3:+ with '$3'})"; FAIL=1; [ "${4:-}" = "crit" ] && CRIT=1; fi
}
chk / 200 'id="app"' crit
chk /create 200 'id="app"' crit
chk /create/ai 200 'id="app"' crit
chk /q/abc123 200 'id="app"' crit
chk /m/abc123 200 'id="app"' crit
chk /groups 200 'id="app"' crit
chk /tokens 200 'id="app"' crit
chk /signup 200 'id="app"' crit
chk /app.js 200 "" crit
chk /config.js 200 "" crit
chk /logo/mark.png 200 "" crit
chk /azmoon-online 200 '<h1'
chk /azmoon-hoosh-masnoei 200 '<h1'
chk /azmoon-az-pdf 200 '<h1'
chk /azmoon-baraye-moalem 200 '<h1'
chk /azmoon-testi 200 '<h1'
chk /azmoon-online/ 301
chk /lp.css 200
chk /sitemap.xml 200 'azmoon-testi'
chk /robots.txt 200 'Sitemap'
chk /this-page-does-not-exist-123 404 '404'
if [ "$CRIT" = "1" ] && [ -n "$BK" ]; then
  cp -p "$BK" "$NG"; nginx -t >/dev/null 2>&1 && { systemctl reload nginx 2>/dev/null || nginx -s reload; }
  echo "ERR: the main site did not answer correctly, so the old nginx config was restored. Send me the lines above."
  exit 2
fi
if [ "$FAIL" = "0" ]; then
  echo "DONE ✅  Guide pages are live. Now submit https://$HOST/sitemap.xml in Google Search Console."
else
  echo "FINISHED WITH PROBLEMS (see FAIL lines). The main site works; send me the lines above."
  exit 2
fi
