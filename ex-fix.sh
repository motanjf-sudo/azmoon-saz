#!/bin/bash
# Pazmoonak: fix for "this model is not available" (Perplexity answers the server with a 403 web page).
# Tests Perplexity directly and through the relay (prints only HTTP codes, never the keys); if the relay works, the server is made to
# retry through it automatically. Run as root:  bash ex-fix.sh      Safe to run more than once.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"; ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERR: python3 missing"; exit 1; }
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node missing"; exit 1; }
[ -f "$APP/deno-shim.js" ] && [ -f "$APP/files-worker.js" ] || { echo "ERR: files not found in $APP"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
g() { sed -n "s/^$1=//p" "$ENVF" | tail -1; }
export PK="$(g PERPLEXITY_API_KEY)" RELAY="$(g AI_RELAY)" RKEY="$(g AI_RELAY_KEY)"
[ -n "$PK" ] || { echo "ERR: PERPLEXITY_API_KEY is not set in $ENVF"; exit 1; }
cat > "$T/diag.py" <<'PY'
import os, json, urllib.request, urllib.error, sys
U = os.environ.get("PZ_PPURL") or "https://api.perplexity.ai/v1/agent"
body = json.dumps({"model": "anthropic/claude-haiku-5-5", "instructions": "Answer in one word.", "input": [{"role": "user", "content": "hi"}], "max_output_tokens": 40}).encode()
def call(via):
    h = {"user-agent": "node", "content-type": "application/json", "authorization": "Bearer " + os.environ["PK"]}
    if via: h.update({"x-relay-target": U, "x-relay-key": os.environ["RKEY"]})
    try:
        r = urllib.request.urlopen(urllib.request.Request(os.environ["RELAY"] if via else U, data=body, method="POST", headers=h), timeout=40)
        return r.status, r.headers.get("content-type", "")
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("content-type", "")
    except Exception as e:
        return 0, str(e)[:60]
d = call(False); print("direct   :", d[0], d[1][:30])
r = call(True) if os.environ.get("RELAY") and os.environ.get("RKEY") else (0, "AI_RELAY not set")
print("by relay :", r[0], r[1][:30])
sys.exit(0 if r[0] == 200 else 2)
PY
echo "[1/3] testing Perplexity from this server"
python3 -I "$T/diag.py"; RC=$?
if [ $RC -ne 0 ]; then echo "The relay does not work for Perplexity either (see above). Nothing was changed. Send me this output."; exit 1; fi
echo "[2/3] patching"
BK="/root/ex-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"; cp -p "$APP/deno-shim.js" "$APP/files-worker.js" "$BK/"
cat > "$T/patch_shim.py" <<'PYEND'
import os, sys
APP = os.environ.get("PZ_APP", "/opt/pazmoonak")
def rd(p): return open(p, encoding="utf-8").read()
changed = []
# 1) deno-shim.js: a direct answer that is Perplexity/DeepSeek's "403 + html page" (edge block) is retried through the relay
p = os.path.join(APP, "deno-shim.js"); s = rd(p)
if "EXBLOCK" in s: print("shim already patched")
else:
    a = "        return realFetch(input, init).catch((e) => {\n"
    if s.count(a) != 1: print("ANCHOR NOT FOUND in deno-shim.js (%d)" % s.count(a)); sys.exit(3)
    b = ("        return realFetch(input, init).then((r) => {   /* EXBLOCK */\n"
         "          if (r && r.status === 403 && /text\\/html/i.test((r.headers && r.headers.get('content-type')) || '')) {\n"
         "            console.error('direct fetch blocked (403 html), using relay:', u.hostname);\n"
         "            return viaRelay();\n"
         "          }\n"
         "          return r;\n"
         "        }).catch((e) => {\n")
    open(p + ".new", "w", encoding="utf-8").write(s.replace(a, b)); changed.append(p)
# 2) files-worker.js: use the same shim (so exam-from-file calls to Perplexity can use the relay too)
p = os.path.join(APP, "files-worker.js"); s = rd(p)
if "EXSHIM" in s: print("worker already uses shim")
else:
    a = 'const PPKEY = process.env.PERPLEXITY_API_KEY || "";'
    if s.count(a) != 1: print("ANCHOR NOT FOUND in files-worker.js (%d)" % s.count(a)); sys.exit(3)
    b = 'try { require(process.env.SHIM_JS || "/opt/pazmoonak/deno-shim.js"); } catch (e) { /* بدون AI_RELAY */ }   /* EXSHIM */\n' + a
    open(p + ".new", "w", encoding="utf-8").write(s.replace(a, b)); changed.append(p)
print("prepared:", " ".join(os.path.basename(c) for c in changed) or "nothing")
PYEND
rm -f "$APP/deno-shim.js.new" "$APP/files-worker.js.new"
PZ_APP="$APP" python3 -I "$T/patch_shim.py" || { echo "ERR: server files differ from what is expected; nothing changed. Send me this message."; rm -f "$APP/deno-shim.js.new" "$APP/files-worker.js.new"; exit 1; }
[ -f "$APP/deno-shim.js.new" ] && { cp "$APP/deno-shim.js.new" "$T/s.js"; "$NODE" --check "$T/s.js" || { echo "ERR: syntax (shim)"; rm -f "$APP"/*.new; exit 1; }; }
[ -f "$APP/files-worker.js.new" ] && { cp "$APP/files-worker.js.new" "$T/w.js"; "$NODE" --check "$T/w.js" || { echo "ERR: syntax (worker)"; rm -f "$APP"/*.new; exit 1; }; }
for f in "$APP/deno-shim.js" "$APP/files-worker.js"; do
  if [ -f "$f.new" ]; then chmod --reference="$f" "$f.new" 2>/dev/null; chown --reference="$f" "$f.new" 2>/dev/null; mv -f "$f.new" "$f"; echo "replaced $(basename "$f")"; fi
done
echo "[3/3] restarting"
${PZ_RESTART:-systemctl restart pazmoonak}
if systemctl cat pazmoonak-files >/dev/null 2>&1; then ${PZ_RESTART_W:-systemctl restart pazmoonak-files}; fi
sleep 2
echo "test through the server's own fetch:"
set -a; export PERPLEXITY_API_KEY="$PK" AI_RELAY="$RELAY" AI_RELAY_KEY="$RKEY"; set +a
"$NODE" -e '
require(process.argv[1]);
fetch(process.env.PZ_PPURL||"https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.PERPLEXITY_API_KEY},body:JSON.stringify({model:"anthropic/claude-haiku-5-5",instructions:"Answer in one word.",input:[{role:"user",content:"hi"}],max_output_tokens:40})})
 .then(r=>{console.log("result:",r.status, r.status===200?"OK - exams with Perplexity models should work now":"STILL FAILING")}).catch(e=>console.log("result: error",String(e).slice(0,80)));
' "$APP/deno-shim.js" 2>&1 | grep -v "direct fetch blocked"
echo "backup: $BK"
echo "DONE"
