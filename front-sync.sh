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
