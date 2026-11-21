#!/bin/bash
# Pazmoonak: when Perplexity drops the connection or blocks for a moment, the exam request is retried (up to 3 more times, ~1 minute) before the user sees an error.
# Run as root:  bash ex-retry.sh      Safe to run more than once.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"; API="${PZ_API:-http://127.0.0.1:8787}"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
[ -f "$APP/fn/node-api.js" ] || { echo "ERR: $APP/fn/node-api.js not found"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERR: python3 missing"; exit 1; }
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node missing"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
BK="/root/ex-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"; cp -p "$APP/fn/node-api.js" "$BK/node-api.js"
cat > "$T/patch_retry.py" <<'PYEND'
import os, sys
APP = os.environ.get("PZ_APP", "/opt/pazmoonak")
p = os.path.join(APP, "fn", "node-api.js"); s = open(p, encoding="utf-8").read()
if "EXRETRY" in s: print("already patched"); sys.exit(0)
a = """    let res = await call();
    if (res && res.status === 429) {
      await new Promise((r) => setTimeout(r, 3e3));
      res = await call();
    }
"""
b = """    const t0 = Date.now();   /* EXRETRY: Perplexity from Iran drops or blocks now and then; try again a few times before giving up */
    const bad = (r) => !r || r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504 || (r.status === 403 && /text\\/html/i.test((r.headers && r.headers.get("content-type")) || ""));
    let res = await call();
    for (let k = 1; k <= 3 && bad(res) && Date.now() - t0 < 9e4; k++) {
      console.error("perplexity retry", pick, k, res ? res.status : "no-response");
      if (res && res.body) { try { await res.body.cancel(); } catch {} }
      await new Promise((r) => setTimeout(r, k * (Number(Deno.env.get("EX_RETRY_MS")) || 4e3)));
      res = await call();
    }
"""
if s.count(a) != 1: print("ANCHOR NOT FOUND in node-api.js (%d)" % s.count(a)); sys.exit(3)
open(p + ".new", "w", encoding="utf-8").write(s.replace(a, b)); print("prepared node-api.js")
PYEND
rm -f "$APP/fn/node-api.js.new"
PZ_APP="$APP" python3 -I "$T/patch_retry.py" || { echo "ERR: node-api.js differs from what is expected; nothing changed. Send me this message."; rm -f "$APP/fn/node-api.js.new"; exit 1; }
if [ -f "$APP/fn/node-api.js.new" ]; then
  cp "$APP/fn/node-api.js.new" "$T/n.mjs"; "$NODE" --check "$T/n.mjs" || { echo "ERR: syntax check failed; nothing changed"; rm -f "$APP/fn/node-api.js.new"; exit 1; }
  chmod --reference="$APP/fn/node-api.js" "$APP/fn/node-api.js.new" 2>/dev/null; chown --reference="$APP/fn/node-api.js" "$APP/fn/node-api.js.new" 2>/dev/null
  mv -f "$APP/fn/node-api.js.new" "$APP/fn/node-api.js"; echo "replaced node-api.js"
  ${PZ_RESTART:-systemctl restart pazmoonak}; sleep 2
  curl -fsS "$API/healthz" >/dev/null 2>&1 && echo "OK service is up" || { echo "ERR: service did not come up. Old file: $BK/node-api.js (copy it back to $APP/fn/ and restart)"; exit 1; }
fi
echo "backup: $BK"; echo "DONE"
