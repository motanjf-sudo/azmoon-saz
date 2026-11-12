#!/usr/bin/env bash
# آخرین نسخه‌ی سایت را از GitHub می‌گیرد و جایگزین فایل‌های سایت می‌کند:  pz-front
set -euo pipefail
REPO=motanjf-sudo/azmoon-saz
BRANCH=main
WEB=/var/www/pazmoonak
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT
echo "دریافت آخرین نسخه از GitHub ..."
wget -q -T 40 -t 3 -O "$T/s.tgz" "https://codeload.github.com/${REPO}/tar.gz/refs/heads/${BRANCH}" || { echo "خطا: دانلود از GitHub انجام نشد. سایت دست‌نخورده ماند."; exit 1; }
tar xzf "$T/s.tgz" -C "$T"
D=$(ls -d "$T"/*/ | head -1)
for f in index.html app.js config.js; do
  [ -s "$D$f" ] || { echo "خطا: فایل $f در نسخه‌ی دریافت‌شده نیست. سایت دست‌نخورده ماند."; exit 1; }
done
mkdir -p "$WEB"
put() { install -m 644 "$D$1" "$WEB/$1.new" && mv -f "$WEB/$1.new" "$WEB/$1"; }
for f in katex-bundle.js app.js config.js style.css robots.txt sitemap.xml vazirmatn.woff2 favicon.ico favicon-48.png favicon-192.png favicon-512.png apple-touch-icon.png og-image.png site.webmanifest; do [ -f "$D$f" ] && put "$f"; done
# فایل‌های تأیید مالکیت گوگل (google….html)
for g in "$D"google*.html; do [ -f "$g" ] && put "$(basename "$g")"; done
if [ -d "$D/logo" ]; then mkdir -p "$WEB/logo" && cp -f "$D"logo/* "$WEB/logo/" && chmod 644 "$WEB"/logo/*; fi
# نسخه‌گذاری خودکار: مرورگرها بعد از هر به‌روزرسانی، app.js و config.js تازه را می‌گیرند (بدون نیاز به Ctrl+F5)
for f in app.js config.js; do
  v=$(md5sum "$D$f" | cut -c1-10)
  sed -i "s|src=\"/\?$f\(?v=[0-9a-f]*\)\?\"|src=\"/$f?v=$v\"|" "$D/index.html"
done
put index.html
echo "سایت به‌روز شد ✅  ($(du -sh "$WEB" | cut -f1))"
