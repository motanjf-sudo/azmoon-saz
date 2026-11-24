#!/bin/bash
# Pazmoonak: file-mode fix. The files worker called Perplexity directly (blocked from Iran: HTTP 403 html page).
# This makes the worker load the site's deno-shim.js, so its AI calls go through the same proxy as topic mode.
# Only /opt/pazmoonak/files-worker.js is changed (backup in /root). Safe to run more than once. Run as root.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"
ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
RESTART_W="${PZ_RESTART_W:-systemctl restart pazmoonak-files}"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
W="$APP/files-worker.js"
[ -f "$W" ] || { echo "ERR: $W not found"; exit 1; }
[ -f "$APP/deno-shim.js" ] || { echo "ERR: $APP/deno-shim.js not found"; exit 1; }
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node not found"; exit 1; }
grep -q '^PPLX_RELAY=.' "$ENVF" 2>/dev/null && echo "OK PPLX_RELAY is set" || echo "WARN: PPLX_RELAY is not set in $ENVF (the shim will use the other routes)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
BK="/root/worker-proxy-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"; cp -p "$W" "$BK/files-worker.js"
cp "$W" "$T/new.js"
python3 - "$T/new.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "deno-shim.js" in s:
    print("already patched")
else:
    a = "const API = (process.env.PZ_API"
    if s.count(a) != 1:
        print("ERR anchor1"); sys.exit(2)
    shim = ('/* AI calls must go through the same proxy as the site (deno-shim.js), because Perplexity blocks direct requests from Iranian IPs (HTTP 403 html page). */\n'
            'try { require(process.env.SHIM_JS || ((process.env.PZ_APP || "/opt/pazmoonak") + "/deno-shim.js")); } catch (e) { console.log(new Date().toISOString(), "deno-shim not loaded (AI calls go direct):", String(e && e.message || e).slice(0, 120)); }\n')
    s = s.replace(a, shim + a)
    old = '      lastErr = res.status === 401 || res.status === 402 || res.status === 403 ? '
    if s.count(old) != 1:
        print("ERR anchor2"); sys.exit(2)
    s = s.replace(old, '      lastErr = /^\\s*</.test(body) && res.status >= 400 ? "اتصال سرور به هوش مصنوعی برقرار نشد؛ چند دقیقه بعد دوباره امتحان کنید." : ' + old.split("lastErr = ")[1])
    open(p, "w", encoding="utf-8").write(s)
    print("patched")
PY
[ $? -eq 0 ] || { echo "ERR: worker code was not what I expected; nothing changed"; exit 1; }
"$NODE" --check "$T/new.js" || { echo "ERR: syntax check failed; nothing changed"; exit 1; }
cp "$T/new.js" "$W.new"; chmod --reference="$W" "$W.new" 2>/dev/null; chown --reference="$W" "$W.new" 2>/dev/null; mv -f "$W.new" "$W"
echo "OK worker updated (backup: $BK)"
if systemctl cat pazmoonak-files >/dev/null 2>&1; then
  $RESTART_W; sleep 3
  systemctl is-active --quiet pazmoonak-files && echo "OK worker is running" || { echo "ERR: worker not running: journalctl -u pazmoonak-files -n 30 ; old file: $BK/files-worker.js"; exit 1; }
  journalctl -u pazmoonak-files -n 5 --no-pager 2>/dev/null | grep "worker started" | tail -1
fi
echo "DONE - now make a file exam with Sonnet again."
