#!/bin/bash
# Pazmoonak: send Perplexity requests through your own Vercel proxy (outside Iran). Other routes stay as the fallback.
# Run as root:  bash ex-pprelay.sh    (it asks for the proxy address and the secret key you set in Vercel; the key is not shown while typing)
set -u
APP="${PZ_APP:-/opt/pazmoonak}"; ENVF="${PZ_ENV:-/etc/pazmoonak/env}"
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
[ -f "$APP/deno-shim.js" ] && [ -f "$ENVF" ] || { echo "ERR: $APP/deno-shim.js or $ENVF not found"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "ERR: python3 missing"; exit 1; }
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node missing"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
g() { sed -n "s/^$1=//p" "$ENVF" | tail -1; }
export PK="$(g PERPLEXITY_API_KEY)"; [ -n "$PK" ] || { echo "ERR: PERPLEXITY_API_KEY is not set in $ENVF"; exit 1; }
if [ -z "${PPR_URL:-}" ]; then read -r -p "Vercel proxy address (like https://NAME.vercel.app/api/relay): " PPR_URL; fi
if [ -z "${PPR_KEY:-}" ]; then read -r -s -p "Secret key you set in Vercel (RELAY_KEY): " PPR_KEY; echo; fi
PPR_URL="$(echo "$PPR_URL" | tr -d '[:space:]')"
case "$PPR_URL" in https://*/api/relay) ;; *) echo "ERR: the address must start with https:// and end with /api/relay"; exit 1;; esac
[ ${#PPR_KEY} -ge 16 ] || { echo "ERR: the key is too short (at least 16 characters)"; exit 1; }
export PPR_URL PPR_KEY
cat > "$T/test.py" <<'PY'
import os, json, urllib.request, urllib.error, sys
body = json.dumps({"model": "anthropic/claude-haiku-5-5", "instructions": "Answer in one word.", "input": [{"role": "user", "content": "hi"}], "max_output_tokens": 16}).encode()
def call(key):
    h = {"content-type": "application/json", "authorization": "Bearer " + os.environ["PK"], "x-relay-target": "https://api.perplexity.ai/v1/agent", "x-relay-key": key, "user-agent": "node"}
    try:
        r = urllib.request.urlopen(urllib.request.Request(os.environ["PPR_URL"], data=body, method="POST", headers=h), timeout=90); return r.status, ""
    except urllib.error.HTTPError as e: return e.code, e.read(120).decode("utf8", "replace").replace("\n", " ")
    except Exception as e: return 0, str(e)[:80]
c, m = call(os.environ["PPR_KEY"]); print("proxy with your key :", c, m if c != 200 else "OK")
w, _ = call("wrong-key-for-test"); print("proxy with wrong key:", w, "(should be 403)")
sys.exit(0 if c == 200 and w == 403 else 2)
PY
echo "[1/4] testing the proxy"
python3 -I "$T/test.py" || { echo "The proxy does not work yet; nothing was changed. Check: RELAY_KEY is set in Vercel and the project was redeployed after that. Send me the two lines above."; exit 1; }
BK="/root/ex-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"; cp -p "$APP/deno-shim.js" "$BK/deno-shim.js"; cp -p "$ENVF" "$BK/env"; chmod 600 "$BK/env"
echo "[2/4] saving settings"
python3 -I - "$ENVF" <<'PY'
import os, sys, re
p = sys.argv[1]; lines = open(p, encoding="utf-8").read().split("\n")
kv = {"PPLX_RELAY": os.environ["PPR_URL"], "PPLX_RELAY_KEY": os.environ["PPR_KEY"]}
out = [l for l in lines if not re.match(r"^(PPLX_RELAY|PPLX_RELAY_KEY)=", l)]
while out and out[-1] == "": out.pop()
for k, v in kv.items(): out.append("%s=%s" % (k, v))
open(p, "w", encoding="utf-8").write("\n".join(out) + "\n")
PY
echo "[3/4] updating server code"
cat > "$T/patch_pp.py" <<'PYEND'
import os, sys
APP = os.environ.get("PZ_APP", "/opt/pazmoonak")
p = os.path.join(APP, "deno-shim.js"); s = open(p, encoding="utf-8").read()
if "EXPPR" in s: print("shim already patched"); sys.exit(0)
a = "    if (RELAY && RELAY_HOSTS.test(u.hostname)) {\n"
if s.count(a) != 1: print("ANCHOR NOT FOUND in deno-shim.js (%d)" % s.count(a)); sys.exit(3)
b = """    const PPR = (process.env.PPLX_RELAY || '').trim();   /* EXPPR: Perplexity goes through our own proxy outside Iran first; other routes are the fallback */
    if (PPR && /(^|\\.)api\\.perplexity\\.ai$/i.test(u.hostname) && !(init && init.__nopp)) {
      const again = (why) => { console.error('perplexity proxy', why, '- trying the other routes'); return globalThis.fetch(input, Object.assign({}, init, { __nopp: true })); };
      const hh = Object.assign({}, (init && init.headers) || {}, { 'x-relay-target': url, 'x-relay-key': process.env.PPLX_RELAY_KEY || '' });
      return realFetch(PPR, Object.assign({}, init, { headers: hh })).then((r) => {
        if (r && (r.status >= 500 || r.status === 403 && /text\\/html|text\\/plain/i.test((r.headers && r.headers.get('content-type')) || ''))) return again('answered ' + r.status);
        return r;
      }, (e) => {
        if (init && init.signal && init.signal.aborted) throw e;
        return again('failed: ' + String(e && e.cause && e.cause.code || e).slice(0, 60));
      });
    }
"""
open(p + ".new", "w", encoding="utf-8").write(s.replace(a, b + a)); print("prepared deno-shim.js")
PYEND
rm -f "$APP/deno-shim.js.new"
PZ_APP="$APP" python3 -I "$T/patch_pp.py" || { echo "ERR: deno-shim.js differs from what is expected; code not changed (settings were saved). Send me this message."; rm -f "$APP/deno-shim.js.new"; exit 1; }
if [ -f "$APP/deno-shim.js.new" ]; then
  cp "$APP/deno-shim.js.new" "$T/s.js"; "$NODE" --check "$T/s.js" || { echo "ERR: syntax check failed; code not changed"; rm -f "$APP/deno-shim.js.new"; exit 1; }
  chmod --reference="$APP/deno-shim.js" "$APP/deno-shim.js.new" 2>/dev/null; chown --reference="$APP/deno-shim.js" "$APP/deno-shim.js.new" 2>/dev/null
  mv -f "$APP/deno-shim.js.new" "$APP/deno-shim.js"; echo "replaced deno-shim.js"
fi
echo "[4/4] restarting"
${PZ_RESTART:-systemctl restart pazmoonak}
if systemctl cat pazmoonak-files >/dev/null 2>&1; then ${PZ_RESTART_W:-systemctl restart pazmoonak-files}; fi
sleep 2
export PERPLEXITY_API_KEY="$PK" PPLX_RELAY="$PPR_URL" PPLX_RELAY_KEY="$PPR_KEY"
"$NODE" -e '
require(process.argv[1]);
fetch("https://api.perplexity.ai/v1/agent",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+process.env.PERPLEXITY_API_KEY},body:JSON.stringify({model:"anthropic/claude-haiku-5-5",instructions:"Answer in one word.",input:[{role:"user",content:"hi"}],max_output_tokens:16})})
 .then(r=>console.log("test through the server code:",r.status,r.status===200?"OK":"FAILED")).catch(e=>console.log("test error",String(e).slice(0,80)));
' "$APP/deno-shim.js" 2>&1 | grep -v "^perplexity proxy"
echo "backup: $BK"; echo "DONE"
