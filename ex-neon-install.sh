#!/bin/bash
# Pazmoonak: enable the model "Gemini Neon" (google/gemini-4-neon)
#   topic mode: 4 pulaks per question      file mode: 8 pulaks per question
# Changes: table ex_models (row neon), /opt/pazmoonak/fn/node-api.js and /opt/pazmoonak/files-worker.js (model list).
# Run as root. Safe to run more than once. Then upload the new app.js to GitHub and run pz-front.
set -u
APP="${PZ_APP:-/opt/pazmoonak}"
DB="${PZ_DB:-pazmoonak}"
API="${PZ_API:-http://127.0.0.1:8787}"
RESTART="${PZ_RESTART:-systemctl restart pazmoonak}"
RESTART_W="${PZ_RESTART_W:-systemctl restart pazmoonak-files}"
if [ -z "${PZ_PSQLCMD:-}" ]; then PZ_PSQLCMD="su postgres -c \"psql -q -v ON_ERROR_STOP=1 -At -d $DB\""; fi
[ "$(id -u)" = "0" ] || { echo "ERR: run as root"; exit 1; }
for f in "$APP/fn/node-api.js" "$APP/files-worker.js"; do [ -f "$f" ] || { echo "ERR: $f not found"; exit 1; }; done
NODE=$(command -v node || true); [ -n "$NODE" ] || { echo "ERR: node not found"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
BK="/root/neon-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BK"

echo "[1/4] checking database"
echo "select 1 from ex_models where id='neon'" | eval "$PZ_PSQLCMD" | grep -q 1 || { echo "ERR: row 'neon' not found in ex_models"; exit 1; }
echo "OK"

echo "[2/4] preparing the code changes"
cp "$APP/fn/node-api.js" "$T/node-api.js"; cp "$APP/files-worker.js" "$T/files-worker.js"
python3 - "$T/node-api.js" "$T/files-worker.js" <<'PY'
import sys
A = 'fable: "anthropic/claude-fable-5-2"'
for p in sys.argv[1:]:
    s = open(p, encoding="utf-8").read()
    if "google/gemini-4-neon" in s:
        print("already has neon:", p.split("/")[-1]); continue
    if s.count(A) != 1:
        print("ERR: model list not found in", p, s.count(A)); sys.exit(2)
    s = s.replace(A, A + ', neon: "google/gemini-4-neon"')
    open(p, "w", encoding="utf-8").write(s)
    print("patched:", p.split("/")[-1])
PY
[ $? -eq 0 ] || { echo "ERR: the code is not what I expected; nothing was changed"; exit 1; }
"$NODE" --check "$T/node-api.js" && "$NODE" --check "$T/files-worker.js" || { echo "ERR: syntax check failed; nothing was changed"; exit 1; }
echo "OK"

echo "[3/4] installing (backup: $BK)"
cp -p "$APP/fn/node-api.js" "$BK/node-api.js"; cp -p "$APP/files-worker.js" "$BK/files-worker.js"
echo "select id, price, price_files, on_topic, on_files from ex_models where id='neon'" | eval "$PZ_PSQLCMD" > "$BK/neon-row-before.txt"
echo "update ex_models set price = 4, price_files = 8, on_topic = true, on_files = true where id = 'neon'" | eval "$PZ_PSQLCMD" >/dev/null || { echo "ERR: database update failed; nothing changed"; exit 1; }
for f in node-api.js files-worker.js; do
  dst="$APP/$f"; [ "$f" = node-api.js ] && dst="$APP/fn/node-api.js"
  cp "$T/$f" "$dst.new"; chmod --reference="$dst" "$dst.new" 2>/dev/null; chown --reference="$dst" "$dst.new" 2>/dev/null; mv -f "$dst.new" "$dst"
done
$RESTART
if systemctl cat pazmoonak-files >/dev/null 2>&1; then $RESTART_W; fi
sleep 3

echo "[4/4] checking"
curl -fsS "$API/healthz" >/dev/null 2>&1 && echo "OK site service is up" || { echo "ERR: service did not come up. Old files are in $BK"; exit 1; }
if systemctl cat pazmoonak-files >/dev/null 2>&1; then systemctl is-active --quiet pazmoonak-files && echo "OK worker is running" || { echo "ERR: worker is not running: journalctl -u pazmoonak-files -n 30"; exit 1; }; fi
echo "select format('neon: topic=%s pulak, files=%s pulak, on_topic=%s, on_files=%s', price, price_files, on_topic, on_files) from ex_models where id='neon'" | eval "$PZ_PSQLCMD"
echo "DONE - now upload the new app.js to GitHub and run pz-front."
